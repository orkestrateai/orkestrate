use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use crate::ai::memory::types::{PersonalEntry, MaturityTier, SearchResult, UserProfile};
use crate::ai::memory::storage::ContextTreeStorage;
use crate::ai::memory::index::SearchIndex;

pub struct MemoryManager {
    storage: Arc<RwLock<ContextTreeStorage>>,
    index: Arc<RwLock<SearchIndex>>,
    profile: Arc<RwLock<UserProfile>>,
    // 5-tier query cache (Tier 0-1)
    query_cache: Arc<RwLock<HashMap<String, CachedResult>>>,
}

struct CachedResult {
    results: Vec<SearchResult>,
    query_hash: u64,
    timestamp_ms: u64,
}

const SEARCH_MAX_RESULTS: usize = 10;
const AKL_DECAY_CORE: f64 = 0.999;
const AKL_DECAY_VALIDATED: f64 = 0.997;
const AKL_DECAY_DRAFT: f64 = 0.990;
const ACCESS_BOOST: f64 = 3.0;
const UPDATE_BOOST: f64 = 5.0;
const CORE_THRESHOLD: f64 = 85.0;
const VALIDATED_THRESHOLD: f64 = 65.0;
const DEMOTE_VALIDATED: f64 = 35.0;
const DEMOTE_CORE: f64 = 60.0;
const CACHE_TTL_MS: u64 = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_ENTRIES: usize = 200;

impl MemoryManager {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let storage = Arc::new(RwLock::new(ContextTreeStorage::new(app_data_dir.clone())));

        let profile = storage.read().unwrap()
            .read_profile()
            .unwrap_or(None)
            .unwrap_or_default();

        // Build index from existing facts
        let mut index = SearchIndex::new();
        if let Ok(facts) = storage.read().unwrap().list_all_facts() {
            for fact in &facts {
                index.add_document(
                    fact.id.clone(),
                    &fact.title,
                    &fact.content,
                    &fact.people,
                    &fact.topics,
                );
            }
        }

        Self {
            storage,
            index: Arc::new(RwLock::new(index)),
            profile: Arc::new(RwLock::new(profile)),
            query_cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    // ─── 5-Tier Retrieval ──────────────────────────────────────────────────
    // Tier 0: Exact cache hit (hash match within TTL)
    // Tier 1: Fuzzy cache hit (7-character prefix match)
    // Tier 2: Inverted index BM25 search (no LLM)
    // Tier 3: Optimized LLM call (handled by agent on website)
    // Tier 4: Full agentic loop (handled by agent on website)

    fn hash_query(query: &str) -> u64 {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        query.hash(&mut h);
        h.finish()
    }

    fn now_ms() -> u64 {
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64
    }

    fn cache_key(queries: &[String]) -> String {
        let mut sorted: Vec<&str> = queries.iter().map(|s| s.as_str()).collect();
        sorted.sort();
        sorted.join("||")
    }

    fn check_cache(&self, queries: &[String]) -> Option<Vec<SearchResult>> {
        let cache = self.query_cache.read().unwrap();
        let key = Self::cache_key(queries);

        // Tier 0: exact match
        if let Some(cached) = cache.get(&key) {
            if Self::now_ms() - cached.timestamp_ms < CACHE_TTL_MS {
                return Some(cached.results.clone());
            }
        }

        // Tier 1: fuzzy prefix match (first 7 chars of key)
        if key.len() > 7 {
            let prefix = &key[..7.min(key.len())];
            let now = Self::now_ms();
            for (k, cached) in cache.iter() {
                if k.len() > 7 && &k[..7] == prefix && now - cached.timestamp_ms < CACHE_TTL_MS {
                    return Some(cached.results.clone());
                }
            }
        }

        None
    }

    fn store_cache(&self, queries: &[String], results: &[SearchResult]) {
        let mut cache = self.query_cache.write().unwrap();
        if cache.len() >= CACHE_MAX_ENTRIES {
            let now = Self::now_ms();
            cache.retain(|_, v| now - v.timestamp_ms < CACHE_TTL_MS);
        }
        if cache.len() >= CACHE_MAX_ENTRIES {
            return;
        }
        let key = Self::cache_key(queries);
        let hash = Self::hash_query(&key);
        cache.insert(key, CachedResult {
            results: results.to_vec(),
            query_hash: hash,
            timestamp_ms: Self::now_ms(),
        });
    }

    // ─── Search ──────────────────────────────────────────────────────────────

    pub fn search(&self, queries: Vec<String>) -> std::io::Result<Vec<SearchResult>> {
        // Tier 0-1: Check cache
        if let Some(cached) = self.check_cache(&queries) {
            return Ok(cached);
        }

        // Tier 2: Use inverted index if available
        let facts = self.storage.read().unwrap().list_all_facts()?;
        let index = self.index.read().unwrap();
        let now_ms = chrono::Utc::now().timestamp_millis();

        // Prefer index results, fall back to linear scan
        let mut scored: Vec<(SearchResult, f64)> = if index.size() > 0 {
            self.scored_index_search(&index, &facts, &queries, now_ms)
        } else {
            self.linear_scored_search(&facts, &queries, now_ms)
        };

        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        let results: Vec<SearchResult> = scored.into_iter().take(SEARCH_MAX_RESULTS).map(|(r, _)| r).collect();

        // Store in cache
        self.store_cache(&queries, &results);

        // Record access on matched entries for AKL
        for result in &results {
            self.record_access(&result.id);
        }

        Ok(results)
    }

    fn scored_index_search(
        &self,
        index: &SearchIndex,
        facts: &[PersonalEntry],
        queries: &[String],
        now_ms: i64,
    ) -> Vec<(SearchResult, f64)> {
        let mut scored = Vec::new();
        let query_str = queries.join(" ");
        let doc_indices = index.search(&query_str);

        // Build a lookup from doc ID to entry
        let entry_map: HashMap<&str, &PersonalEntry> = facts.iter().map(|f| (f.id.as_str(), f)).collect();

        for doc_idx in doc_indices {
            if let Some(doc) = index.doc_by_index(doc_idx) {
                if let Some(entry) = entry_map.get(doc.id.as_str()) {
                    let decay = self.compute_decay(entry, now_ms);
                    let importance_norm = entry.importance.clamp(0.0, 100.0) / 100.0;

                    // Index provides the BM25 relevance; combine with AKL
                    let compound = 0.6 + importance_norm * 0.25 + decay * 0.15;

                    scored.push((SearchResult {
                        id: entry.id.clone(),
                        title: entry.title.clone(),
                        content: entry.content.clone(),
                        score: compound,
                        memo_type: entry.memo_type,
                        confidence: entry.confidence,
                        people: entry.people.clone(),
                        topics: entry.topics.clone(),
                    }, compound));
                }
            }
        }
        scored
    }

    fn linear_scored_search(
        &self,
        facts: &[PersonalEntry],
        queries: &[String],
        now_ms: i64,
    ) -> Vec<(SearchResult, f64)> {
        let mut scored = Vec::new();

        for fact in facts {
            let decay = self.compute_decay(fact, now_ms);
            let importance_norm = fact.importance.clamp(0.0, 100.0) / 100.0;

            let mut best_score = 0.0;
            for query in queries {
                let q_tokens: Vec<String> = query.to_lowercase()
                    .split(|c: char| !c.is_alphanumeric())
                    .filter(|t| t.len() >= 2)
                    .map(|t| t.to_string())
                    .collect();

                if q_tokens.is_empty() { continue; }

                let title_lower = fact.title.to_lowercase();
                let title_matches = q_tokens.iter().filter(|t| title_lower.contains(t.as_str())).count() as f64;
                let title_score = if title_matches > 0.0 {
                    (title_matches * 5.0) / (1.0 + title_matches)
                } else { 0.0 };

                let content_lower = fact.content.to_lowercase();
                let content_matches = q_tokens.iter().filter(|t| content_lower.contains(t.as_str())).count() as f64;
                let content_score = if content_matches > 0.0 {
                    (content_matches * 1.0) / (1.0 + content_matches)
                } else { 0.0 };

                let people_lower: Vec<String> = fact.people.iter().map(|p| p.to_lowercase()).collect();
                let people_score = if people_lower.iter().any(|p| {
                    q_tokens.iter().any(|qt| p.contains(qt) || fuzzy_match(p, qt))
                }) { 4.0 } else { 0.0 };

                let topics_lower: Vec<String> = fact.topics.iter().map(|t| t.to_lowercase()).collect();
                let topic_score = if topics_lower.iter().any(|t| q_tokens.iter().any(|qt| t.contains(qt))) {
                    3.0
                } else { 0.0 };

                let combined = title_score + content_score + people_score + topic_score;
                if combined > best_score { best_score = combined; }
            }

            if best_score > 0.0 {
                let compound = (best_score / 10.0).min(1.0) * 0.6 + importance_norm * 0.25 + decay * 0.15;

                scored.push((SearchResult {
                    id: fact.id.clone(),
                    title: fact.title.clone(),
                    content: fact.content.clone(),
                    score: compound,
                    memo_type: fact.memo_type,
                    confidence: fact.confidence,
                    people: fact.people.clone(),
                    topics: fact.topics.clone(),
                }, compound));
            }
        }
        scored
    }

    // ─── Store / Delete ──────────────────────────────────────────────────────

    pub fn store_entry(&self, entry: &PersonalEntry) -> std::io::Result<()> {
        let mut entry = entry.clone();
        if entry.id.is_empty() {
            entry.id = format!("mem_{}", chrono::Utc::now().timestamp_millis());
        }
        if entry.importance < 1.0 {
            entry.importance = entry.memo_type.base_importance();
        }
        if entry.updated_at.is_empty() {
            entry.updated_at = UserProfile::now_iso();
        }
        if entry.created_at.is_empty() {
            entry.created_at = entry.updated_at.clone();
        }

        self.storage.write().unwrap().write_fact(&entry)?;

        // Incrementally update search index
        self.index.write().unwrap().add_document(
            entry.id.clone(),
            &entry.title,
            &entry.content,
            &entry.people,
            &entry.topics,
        );

        // Invalidate cache on write
        self.query_cache.write().unwrap().clear();

        Ok(())
    }

    pub fn delete_entry(&self, id: &str) -> std::io::Result<()> {
        self.storage.write().unwrap().delete_fact(id)?;
        self.index.write().unwrap().remove_document(id);
        self.query_cache.write().unwrap().clear();
        Ok(())
    }

    // ─── Profile ─────────────────────────────────────────────────────────────

    pub fn get_profile(&self) -> UserProfile {
        self.profile.read().unwrap().clone()
    }

    pub fn get_profile_block(&self) -> String {
        let p = self.profile.read().unwrap();
        if p.name.is_empty() && p.identity.is_empty() {
            String::new()
        } else {
            p.to_prompt_block()
        }
    }

    pub fn update_profile_field(&self, field: &str, value: &str) -> std::io::Result<()> {
        let mut profile = self.profile.write().unwrap();
        match field {
            "name" => { profile.name = value.to_string(); }
            "add_identity" => { dedup_append(&mut profile.identity, value); }
            "add_relationship" => { dedup_append(&mut profile.relationships, value); }
            "add_preference" => { dedup_append(&mut profile.preferences, value); }
            "add_professional" => { dedup_append(&mut profile.professional, value); }
            "add_context" => { dedup_append(&mut profile.context, value); }
            "add_interest" => { dedup_append(&mut profile.interests, value); }
            _ => {}
        }
        profile.updated_at = UserProfile::now_iso();
        self.storage.write().unwrap().write_profile(&profile)?;
        Ok(())
    }

    // ─── Episodic ────────────────────────────────────────────────────────────

    pub fn store_episode(&self, session_id: &str, summary: &str, facts_extracted: &[String]) -> std::io::Result<()> {
        self.storage.write().unwrap().write_episode(session_id, summary, facts_extracted)
    }

    pub fn get_recent_episodes(&self, limit: usize) -> std::io::Result<String> {
        let episodes = self.storage.read().unwrap().list_recent_episodes(limit)?;
        if episodes.is_empty() { return Ok(String::new()); }
        let mut out = String::from("\n[RECENT EPISODES]\n");
        for (_i, (_sid, body)) in episodes.iter().enumerate() {
            let preview: String = body.lines().take(3).collect::<Vec<_>>().join("\n");
            out.push_str(&format!("{}. {}\n", _i + 1, preview));
        }
        out.push_str("[/RECENT EPISODES]\n");
        Ok(out)
    }

    // ─── Search with session context ─────────────────────────────────────────

    pub async fn search_context_with_session(&self, queries: Vec<String>) -> String {
        let results = match self.search(queries) {
            Ok(r) => r,
            Err(_) => return "No relevant memories found.".to_string(),
        };
        if results.is_empty() {
            return "No relevant memories found.".to_string();
        }
        let mut out = String::from("[MEMORY RESULTS]\n");
        for (i, r) in results.iter().enumerate() {
            out.push_str(&format!("{}. [{}] {}: {} (confidence: {:.0}%)\n",
                i + 1, format!("{:?}", r.memo_type).to_lowercase(), r.title, r.content, r.confidence * 100.0));
        }
        out.push_str("[/MEMORY RESULTS]\n");
        out
    }

    // ─── AKL Helpers ─────────────────────────────────────────────────────────

    fn compute_decay(&self, entry: &PersonalEntry, now_ms: i64) -> f64 {
        let days_since_update = ((now_ms - entry.last_accessed).max(0) as f64) / (24.0 * 3600.0 * 1000.0);
        let tau = match entry.maturity {
            MaturityTier::Core => AKL_DECAY_CORE,
            MaturityTier::Validated => AKL_DECAY_VALIDATED,
            MaturityTier::Draft => AKL_DECAY_DRAFT,
        };
        tau.powf(days_since_update)
    }

    fn record_access(&self, id: &str) {
        let storage = self.storage.write().unwrap();
        if let Some(mut entry) = read_fact(&storage, id) {
            entry.importance = (entry.importance + ACCESS_BOOST).min(100.0);
            entry.access_count += 1;
            entry.last_accessed = chrono::Utc::now().timestamp_millis();
            self.reevaluate_maturity(&mut entry);
            let _ = storage.write_fact(&entry);
        }
    }

    fn reevaluate_maturity(&self, entry: &mut PersonalEntry) {
        match entry.maturity {
            MaturityTier::Draft => {
                if entry.importance >= VALIDATED_THRESHOLD { entry.maturity = MaturityTier::Validated; }
            }
            MaturityTier::Validated => {
                if entry.importance >= CORE_THRESHOLD { entry.maturity = MaturityTier::Core; }
                else if entry.importance < DEMOTE_VALIDATED { entry.maturity = MaturityTier::Draft; }
            }
            MaturityTier::Core => {
                if entry.importance < DEMOTE_CORE { entry.maturity = MaturityTier::Validated; }
            }
        }
    }
}

fn read_fact(storage: &ContextTreeStorage, id: &str) -> Option<PersonalEntry> {
    storage.read_fact(id).ok().flatten()
}

fn fuzzy_match(a: &str, b: &str) -> bool {
    if a.len() < 3 || b.len() < 3 { return false; }
    if a.contains(b) || b.contains(a) { return true; }
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let mut matches = 0;
    for i in 0..a_chars.len().min(b_chars.len()) {
        if a_chars[i] == b_chars[i] { matches += 1; }
    }
    let ratio = matches as f64 / a_chars.len().max(b_chars.len()).max(1) as f64;
    ratio > 0.7
}

fn dedup_append(list: &mut Vec<String>, value: &str) {
    if !value.is_empty() && !list.iter().any(|i| i.to_lowercase() == value.to_lowercase()) {
        list.push(value.to_string());
    }
}
