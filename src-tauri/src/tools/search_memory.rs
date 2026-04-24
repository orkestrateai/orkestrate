use async_trait::async_trait;
use serde_json::{json, Value};
use std::collections::HashMap;

use crate::db;

use super::Tool;

const ZEN_API_BASE: &str = "https://opencode.ai/zen/v1/chat/completions";

/// Format an ISO datetime as a human-readable relative time.
fn relative_time(iso: &str) -> String {
    let Ok(dt) = chrono::DateTime::parse_from_rfc3339(iso) else {
        return iso.to_string();
    };
    let now = chrono::Utc::now();
    let duration = now.signed_duration_since(dt.with_timezone(&chrono::Utc));
    let mins = duration.num_minutes();
    let hours = duration.num_hours();
    let days = duration.num_days();

    if mins < 1 {
        "just now".to_string()
    } else if mins < 60 {
        format!("{} min ago", mins)
    } else if hours < 24 {
        format!("{} hr ago", hours)
    } else if days < 7 {
        format!("{} day{} ago", days, if days == 1 { "" } else { "s" })
    } else if days < 30 {
        format!("{} week{} ago", days / 7, if days / 7 == 1 { "" } else { "s" })
    } else {
        format!("{} month{} ago", days / 30, if days / 30 == 1 { "" } else { "s" })
    }
}

#[derive(Debug, Clone)]
struct QuerySchema {
    entities: Vec<String>,
    temporal: bool,
    contradiction_sensitive: bool,
    pronoun_resolutions: HashMap<String, String>,
}

/// Generative schema parsing via OpenCode Zen.
async fn parse_query_schema(query: &str) -> QuerySchema {
    let api_key = match std::env::var("OPENCODE_ZEN_API_KEY") {
        Ok(k) => k,
        Err(_) => {
            return parse_query_schema_heuristic(query);
        }
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    let prompt = format!(
        "Parse this user query into a structured schema for memory retrieval.\n\nQuery: \"{}\"\n\nExtract:\n1. Named entities (people, projects, companies, places, products, events) with exact names\n2. Pronoun antecedents (what 'him', 'her', 'it', 'they', 'that' refer to)\n3. Temporal scope (is this asking about recent, past, or all-time events?)\n4. Contradiction sensitivity (is the user asking if something changed?)\n\nOutput ONLY valid JSON:\n{{\n  \"entities\": [\"Karan\", \"Keiyara\"],\n  \"pronoun_resolutions\": {{\"him\": \"Karan\", \"that\": \"the Google Next challenge\"}},\n  \"temporal\": false,\n  \"contradiction_sensitive\": false\n}}\n\nIf no pronouns, use empty object {{}} for pronoun_resolutions.\nIf no entities, use empty array [].",
        query.replace('"', "\\\"")
    );

    let request = json!({
        "model": "minimax-m2.5-free",
        "messages": [
            {"role": "system", "content": "You are a query parsing system. Extract structured information from natural language queries. Output ONLY valid JSON."},
            {"role": "user", "content": prompt}
        ],
        "stream": false,
        "max_tokens": 512
    });

    let response = match client
        .post(ZEN_API_BASE)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request)
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return parse_query_schema_heuristic(query),
    };

    if !response.status().is_success() {
        return parse_query_schema_heuristic(query);
    }

    let data: serde_json::Value = match response.json().await {
        Ok(d) => d,
        Err(_) => return parse_query_schema_heuristic(query),
    };

    let content = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("{}");

    let json_str = content.trim();
    let json_str = if json_str.starts_with("```json") {
        json_str.trim_start_matches("```json").trim_end_matches("```").trim()
    } else if json_str.starts_with("```") {
        json_str.trim_start_matches("```").trim_end_matches("```").trim()
    } else {
        json_str
    };

    let parsed: serde_json::Value = match serde_json::from_str(json_str) {
        Ok(v) => v,
        Err(_) => return parse_query_schema_heuristic(query),
    };

    let mut entities: Vec<String> = parsed["entities"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let pronoun_resolutions: HashMap<String, String> = parsed["pronoun_resolutions"]
        .as_object()
        .map(|obj| {
            obj.iter()
                .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                .collect()
        })
        .unwrap_or_default();

    // Merge pronoun resolutions into entities for graph search
    for resolved_entity in pronoun_resolutions.values() {
        if !entities.contains(resolved_entity) {
            entities.push(resolved_entity.clone());
        }
    }

    let temporal = parsed["temporal"].as_bool().unwrap_or(false);
    let contradiction_sensitive = parsed["contradiction_sensitive"].as_bool().unwrap_or(false);

    QuerySchema {
        entities,
        temporal,
        contradiction_sensitive,
        pronoun_resolutions,
    }
}

const STOP_WORDS: &[&str] = &[
    "what", "how", "tell", "did", "who", "when", "where", "why", "which",
    "about", "with", "have", "been", "the", "and", "for", "are", "but",
    "not", "you", "all", "can", "had", "her", "was", "one", "our", "out",
    "day", "get", "has", "him", "his", "how", "its", "may", "new", "now",
    "old", "see", "two", "way", "who", "boy", "did", "she", "use", "her",
    "way", "many", "oil", "sit", "set", "run", "eat", "far", "sea", "eye",
    "ago", "off", "too", "any", "say", "man", "try", "ask", "end", "why",
    "let", "put", "say", "she", "try", "way", "own", "say", "too", "old",
    "tell", "very", "when", "come", "could", "would", "there", "their",
    "them", "then", "than", "over", "also", "back", "after", "first",
    "well", "where", "much", "before", "right", "through", "around",
    "down", "off", "too", "any", "say", "man", "try", "ask", "end",
    "why", "let", "put", "say", "she", "try", "way", "own", "say",
    "too", "old", "tell", "very", "when", "come", "could", "would",
    "there", "their", "them", "then", "than", "over", "also", "back",
    "after", "first", "well", "where", "much", "before", "right",
    "through", "around", "down", "should", "still", "being", "while",
    "this", "that", "these", "those", "from", "into", "just", "like",
    "know", "take", "year", "good", "some", "come", "make", "well",
    "only", "even", "want", "here", "look", "more", "find", "give",
    "does", "made", "part", "such", "keep", "call", "came", "need",
    "feel", "seem", "turn", "hand", "high", "sure", "upon", "head",
    "help", "home", "side", "move", "both", "five", "once", "same",
    "each", "done", "open", "case", "show", "live", "play", "went",
    "told", "seen", "heard", "began", "given", "quite", "small",
    "large", "long", "last", "next", "under", "above", "between",
    "against", "within", "without", "during", "before", "after",
    "think", "thought", "found", "sound", "voice", "trace", "journey",
    "summarize", "project", "history", "relationship", "habit",
];

/// Fallback heuristic schema parser with stop-word filtering.
fn parse_query_schema_heuristic(query: &str) -> QuerySchema {
    let lowered = query.to_lowercase();
    let mut entities: Vec<String> = Vec::new();
    let mut pronoun_resolutions: HashMap<String, String> = HashMap::new();

    // Detect pronouns
    let pronouns: [(&str, Option<&str>); 5] = [("him", None), ("her", None), ("it", None), ("they", None), ("that", None)];
    for (pronoun, _) in &pronouns {
        if lowered.contains(pronoun) {
            // Try to find a recent entity from memory as antecedent
            // For now, flag it and let the system know
            pronoun_resolutions.insert(pronoun.to_string(), "UNKNOWN".to_string());
        }
    }

    // Multi-word entity detection first
    let words: Vec<&str> = query.split_whitespace().collect();
    let mut skip_indices = std::collections::HashSet::new();

    // Look for adjacent capitalized words (e.g., "Google Next")
    for i in 0..words.len().saturating_sub(1) {
        let w1 = words[i].trim_matches(|c: char| !c.is_alphanumeric());
        let w2 = words[i + 1].trim_matches(|c: char| !c.is_alphanumeric());
        if w1.len() > 1 && w2.len() > 1 {
            let w1_lower = w1.to_lowercase();
            let w2_lower = w2.to_lowercase();
            if !STOP_WORDS.contains(&w1_lower.as_str()) && !STOP_WORDS.contains(&w2_lower.as_str()) {
                if w1.chars().next().map(|c| c.is_uppercase()).unwrap_or(false)
                    && w2.chars().next().map(|c| c.is_uppercase()).unwrap_or(false)
                {
                    let combined = format!("{} {}", w1, w2);
                    if !entities.contains(&combined) {
                        entities.push(combined);
                    }
                    skip_indices.insert(i);
                    skip_indices.insert(i + 1);
                }
            }
        }
    }

    // Single-word entity detection
    for (i, word) in words.iter().enumerate() {
        if skip_indices.contains(&i) {
            continue;
        }
        let cleaned = word.trim_matches(|c: char| !c.is_alphanumeric());
        if cleaned.len() <= 2 {
            continue;
        }
        let cleaned_lower = cleaned.to_lowercase();
        if STOP_WORDS.contains(&cleaned_lower.as_str()) {
            continue;
        }
        if cleaned.chars().next().map(|c| c.is_uppercase()).unwrap_or(false) {
            if !entities.contains(&cleaned.to_string()) {
                entities.push(cleaned.to_string());
            }
        }
    }

    let temporal = ["recent", "last", "ago", "yesterday", "before", "earlier",
        "previous", "latest", "newest", "old", "first", "initial", "over time",
        "evolve", "change", "journey", "trace"]
        .iter().any(|w| lowered.contains(w));

    let contradiction_sensitive = ["still", "now", "currently", "changed", "before", "used to",
        "did you", "do i still", "did i", "end up", "stay"]
        .iter().any(|w| lowered.contains(w));

    QuerySchema {
        entities,
        temporal,
        contradiction_sensitive,
        pronoun_resolutions,
    }
}

// ─── Channel Result Types ────────────────────────────────────────────────

struct ChannelResult {
    episodes: Vec<db::Episode>,
    raw_scores: HashMap<String, f32>,
}

// ─── 4-Channel Retrieval ─────────────────────────────────────────────────

/// Channel 1: Semantic search using vector embeddings.
async fn semantic_channel(queries: &[String], top_k: usize) -> ChannelResult {
    let mut all_scores: HashMap<String, f32> = HashMap::new();
    let mut all_ids: Vec<String> = Vec::new();

    for query in queries {
        match crate::embed::embed(query).await {
            Ok((embedding, provider)) => {
                let model_name = provider.model_name();
                match db::search_semantic(&embedding, top_k * 2, Some(model_name)) {
                    Ok(results) => {
                        for (id, score) in results {
                            let entry = all_scores.entry(id.clone()).or_insert(0.0);
                            *entry = entry.max(score);
                            if !all_ids.contains(&id) {
                                all_ids.push(id);
                            }
                        }
                    }
                    Err(e) => eprintln!("[semantic_channel] Semantic search failed: {}", e),
                }
            }
            Err(e) => eprintln!("[semantic_channel] Embedding failed: {}", e),
        }
    }

    let mut episodes = Vec::new();
    for id in &all_ids {
        if let Ok(Some(ep)) = db::get_episode(id) {
            episodes.push(ep);
        }
    }

    ChannelResult { episodes, raw_scores: all_scores }
}

/// Channel 2: Keyword / lexical search using tokenized word matching.
/// Splits queries into individual words, filters stop words, and scores
/// based on how many query words appear in each episode.
async fn keyword_channel(queries: &[String], top_k: usize) -> ChannelResult {
    // Tokenize all queries into searchable words
    let mut search_words: Vec<String> = Vec::new();
    for q in queries {
        for word in q.split_whitespace() {
            let cleaned = word.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();
            if cleaned.len() >= 3 && !STOP_WORDS.contains(&cleaned.as_str()) {
                if !search_words.contains(&cleaned) {
                    search_words.push(cleaned);
                }
            }
        }
    }

    if search_words.is_empty() {
        return ChannelResult { episodes: Vec::new(), raw_scores: HashMap::new() };
    }

    // Search for episodes containing any of the words using existing DB function
    let episodes = db::search_memory(&search_words, top_k as i64 * 2).unwrap_or_default();

    // Score each episode by how many search words it contains
    let mut scores: HashMap<String, f32> = HashMap::new();
    for ep in &episodes {
        let content_lower = ep.content.to_lowercase();
        let mut matches = 0;
        for word in &search_words {
            if content_lower.contains(word) {
                matches += 1;
            }
        }
        let score = (matches as f32 / search_words.len() as f32).min(1.0);
        if score > 0.0 {
            scores.insert(ep.id.clone(), score);
        }
    }

    // Filter to episodes with at least one match
    let filtered_episodes: Vec<db::Episode> = episodes
        .into_iter()
        .filter(|ep| scores.get(&ep.id).copied().unwrap_or(0.0) > 0.0)
        .collect();

    ChannelResult { episodes: filtered_episodes, raw_scores: scores }
}

/// Channel 3: Entity graph search with spreading activation.
async fn entity_graph_channel(schema: &QuerySchema, top_k: usize) -> ChannelResult {
    let mut all_episodes: Vec<db::Episode> = Vec::new();
    let mut scores: HashMap<String, f32> = HashMap::new();

    for entity_name in &schema.entities {
        match db::search_entities(entity_name, 5) {
            Ok(entities) => {
                for entity in entities {
                    match db::get_episodes_for_entity(&entity.id, top_k as i64) {
                        Ok(eps) => {
                            for ep in eps {
                                let ep_id = ep.id.clone();
                                let entry = scores.entry(ep_id.clone()).or_insert(0.0);
                                *entry = entry.max(0.95);
                                if !all_episodes.iter().any(|e| e.id == ep_id) {
                                    all_episodes.push(ep);
                                }

                                // Spreading activation: 1-hop follow with strong decay
                                // Only activate if corpus is large enough to avoid arc pollution
                                let min_corpus_for_spreading = 50;
                                if db::count_all_episodes().unwrap_or(0) >= min_corpus_for_spreading {
                                    for edge_type in &["progression", "association"] {
                                        match db::get_related_episodes(&ep_id, Some(edge_type), 2) {
                                            Ok(related) => {
                                                for rel_ep in related {
                                                    let decayed = 0.40 * 0.95; // strong decay
                                                    let entry = scores.entry(rel_ep.id.clone()).or_insert(0.0);
                                                    *entry = entry.max(decayed);
                                                    if !all_episodes.iter().any(|e| e.id == rel_ep.id) {
                                                        all_episodes.push(rel_ep);
                                                    }
                                                }
                                            }
                                            Err(e) => eprintln!("[entity_graph_channel] Spreading activation failed: {}", e),
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => eprintln!("[entity_graph_channel] Failed to load episodes: {}", e),
                    }
                }
            }
            Err(e) => eprintln!("[entity_graph_channel] Entity search failed: {}", e),
        }
    }

    ChannelResult { episodes: all_episodes, raw_scores: scores }
}

/// Channel 4: Temporal channel.
async fn temporal_channel(top_k: usize, schema: &QuerySchema) -> ChannelResult {
    let episodes = db::load_recent_episodes(top_k as i64).unwrap_or_default();
    let mut scores = HashMap::new();

    let now = chrono::Utc::now();
    for ep in &episodes {
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&ep.created_at) {
            let days = now.signed_duration_since(dt.with_timezone(&chrono::Utc)).num_days() as f32;
            let recency_score = (-days / 14.0).exp();
            let boost = if schema.temporal { recency_score * 1.5 } else { recency_score };
            scores.insert(ep.id.clone(), boost.min(1.0));
        }
    }

    ChannelResult { episodes, raw_scores: scores }
}

// ─── Fusion ──────────────────────────────────────────────────────────────

/// Fuse 4 channel results into a single ranked list using max-pool fusion.
/// Weights: semantic 40%, keyword 20%, entity 25%, temporal 15%
/// Filters out results below min_score threshold.
fn fuse_channels(
    semantic: ChannelResult,
    keyword: ChannelResult,
    entity: ChannelResult,
    temporal: ChannelResult,
    top_k: usize,
    min_score: f32,
) -> Vec<db::Episode> {
    let mut fused: HashMap<String, (f32, Option<db::Episode>)> = HashMap::new();

    let mut add_channel = |channel: ChannelResult, weight: f32| {
        for ep in channel.episodes {
            let score = channel.raw_scores.get(&ep.id).copied().unwrap_or(0.0);
            let entry = fused.entry(ep.id.clone()).or_insert((0.0, None));
            entry.0 = entry.0.max(score * weight);
            if entry.1.is_none() {
                entry.1 = Some(ep);
            }
        }
    };

    add_channel(semantic, 0.40);
    add_channel(keyword, 0.20);
    add_channel(entity, 0.30);
    add_channel(temporal, 0.08);

    let mut scored: Vec<(f32, db::Episode)> = fused
        .into_iter()
        .filter_map(|(_, (score, ep_opt))| {
            ep_opt.map(|ep| (score, ep))
        })
        .filter(|(score, _)| *score >= min_score)
        .collect();

    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(top_k);

    scored.into_iter().map(|(_, ep)| ep).collect()
}

// ─── Public API ──────────────────────────────────────────────────────────

/// Multi-channel memory search with schema-aware retrieval.
pub async fn search_memory_raw(queries: &[String], top_k: usize) -> Vec<db::Episode> {
    if queries.is_empty() {
        return Vec::new();
    }

    let primary_query = queries.first().map(|s| s.as_str()).unwrap_or("");
    let schema = parse_query_schema(primary_query).await;

    println!(
        "[search_memory_raw] Query: '{}' | Entities: {:?} | Temporal: {} | Contradiction-aware: {} | Pronouns: {:?}",
        primary_query, schema.entities, schema.temporal, schema.contradiction_sensitive, schema.pronoun_resolutions
    );

    let semantic_fut = semantic_channel(queries, top_k);
    let keyword_fut = keyword_channel(queries, top_k);
    let entity_fut = entity_graph_channel(&schema, top_k);
    let temporal_fut = temporal_channel(top_k, &schema);

    let (semantic_res, keyword_res, entity_res, temporal_res) =
        tokio::join!(semantic_fut, keyword_fut, entity_fut, temporal_fut);

    // Use min_score threshold to filter out pure noise. Temporal-only episodes
    // score at most 0.08, so min_score of 0.09 filters them unless another
    // channel also finds the episode.
    let min_score = 0.09;
    let mut results = fuse_channels(semantic_res, keyword_res, entity_res, temporal_res, top_k, min_score);

    // If contradiction-sensitive, inject known contradictions for top entities
    if schema.contradiction_sensitive && !schema.entities.is_empty() {
        for entity_name in &schema.entities {
            if let Ok(entities) = db::search_entities(entity_name, 3) {
                for entity in entities {
                    if let Ok(eps) = db::get_episodes_for_entity(&entity.id, 10) {
                        for ep in eps {
                            if !results.iter().any(|r| r.id == ep.id) {
                                results.push(ep);
                            }
                        }
                    }
                }
            }
        }
    }

    results.truncate(top_k);
    results
}

/// Format episodes into a concise string for injection into the system prompt.
pub fn format_retrieved_memories(episodes: &[db::Episode]) -> String {
    if episodes.is_empty() {
        return String::new();
    }

    let items: Vec<String> = episodes
        .iter()
        .map(|ep| {
            let when = relative_time(&ep.created_at);
            format!("- [{}] {} ({})", ep.type_, ep.content, when)
        })
        .collect();

    format!(
        "Retrieved from your memory:\n{}\n\nUse these facts to ground your response. If they conflict with the user's current statement, ask about the change.",
        items.join("\n")
    )
}

// ─── Tauri Command Wrapper ───────────────────────────────────────────────

pub struct SearchMemoryTool;

#[async_trait]
impl Tool for SearchMemoryTool {
    fn name(&self) -> &'static str {
        "search_memory"
    }

    fn description(&self) -> &'static str {
        "Query your memory store for facts about the user. \
This is your long-term memory — it contains everything you know about them across all conversations: \
their projects, preferences, habits, goals, relationships, and past statements. \
Call this when the user's question involves anything personal ('what do I like', 'what did I say'), \
anything about their work or projects, or anytime the context seems thin and you need grounding. \
Also call this when the compiled profile above looks empty or incomplete. \
Generate 3-7 targeted search queries."
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "queries": {
                    "type": "array",
                    "items": { "type": "string" },
                    "description": "3-7 search queries to run against the memory store"
                }
            },
            "required": ["queries"]
        })
    }

    async fn execute(&self, args: Value) -> Result<String, String> {
        let queries: Vec<String> = args["queries"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        if queries.is_empty() {
            return Err("No queries provided".to_string());
        }

        let episodes = search_memory_raw(&queries, 15).await;

        let json_result = json!({
            "query_count": queries.len(),
            "result_count": episodes.len(),
            "results": episodes.iter().map(|ep| {
                let decayed_importance = crate::vector::decay_importance(ep.importance, &ep.created_at);
                json!({
                    "content": ep.content,
                    "type": ep.type_,
                    "confidence": ep.confidence,
                    "importance": ep.importance,
                    "decayed_importance": decayed_importance,
                    "section": ep.schema_section,
                    "when": relative_time(&ep.created_at)
                })
            }).collect::<Vec<_>>()
        });

        Ok(json_result.to_string())
    }
}
