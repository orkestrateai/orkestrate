use std::path::PathBuf;
use serde::{Serialize, Deserialize};
use super::storage::{ContextTreeStorage, MemoryEntry};
use super::scoring::{apply_decay, add_access_bonus, CompoundScore};
use super::embeddings::cosine_similarity;
use super::constants::*;
use crate::ai::memory::extraction::ExtractedFact;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Memory {
    pub id: String,
    pub content: String,
    pub category: String,
    pub tags: Vec<String>,
    pub confidence: f64,
    pub entities: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub score: f64,
}

pub struct MemoryManager {
    storage: ContextTreeStorage,
}

impl MemoryManager {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self {
            storage: ContextTreeStorage::new(app_data_dir),
        }
    }

    pub fn storage(&self) -> &ContextTreeStorage {
        &self.storage
    }

    pub fn record_access_hit(&self, memory_id: &str) -> std::io::Result<()> {
        let mut entries = self.storage.list_all_entries()?;
        if let Some(entry) = entries.iter_mut().find(|e| {
            let eid = format!("{}/{}/{}", e.domain, e.topic, e.title);
            eid == memory_id
        }) {
            add_access_bonus(&mut entry.signals);
            self.storage.write_entry(entry)?;
        }
        Ok(())
    }

    fn compute_bm25_score(text: &str, query: &str, boost: f64) -> f64 {
        let q_lower = query.to_lowercase();
        let text_lower = text.to_lowercase();

        if text_lower.contains(&q_lower) {
            let count = text_lower.matches(&q_lower).count() as f64;
            let raw = count * boost;
            raw / (1.0 + raw)
        } else {
            0.0
        }
    }

    pub fn search(&self, queries: Vec<String>) -> std::io::Result<Vec<Memory>> {
        let mut entries = self.storage.list_all_entries()?;
        let mut results = Vec::new();

        for entry in &mut entries {
            apply_decay(&mut entry.signals);

            let mut best_bm25_normalised = 0.0;

            for query in &queries {
                let title_score = Self::compute_bm25_score(&entry.title, query, SEARCH_TITLE_BOOST);
                let content_score = Self::compute_bm25_score(&entry.content, query, SEARCH_CONTENT_BOOST);
                let path_score = Self::compute_bm25_score(
                    &format!("{}/{}/{}", entry.domain, entry.topic, entry.title),
                    query,
                    SEARCH_PATH_BOOST,
                );

                let combined = (title_score * SEARCH_TITLE_BOOST
                    + content_score * SEARCH_CONTENT_BOOST
                    + path_score * SEARCH_PATH_BOOST)
                    / (SEARCH_TITLE_BOOST + SEARCH_CONTENT_BOOST + SEARCH_PATH_BOOST);

                if combined > best_bm25_normalised {
                    best_bm25_normalised = combined;
                }
            }

            if best_bm25_normalised > 0.0 {
                let cat_weight = category_to_weight(&entry.signals.category);
                let compound = CompoundScore {
                    base_score: best_bm25_normalised,
                    importance: entry.signals.importance,
                    recency: entry.signals.recency,
                    maturity: entry.signals.maturity,
                    category_weight: cat_weight,
                    confidence: entry.signals.confidence,
                };

                let final_score = compound.calculate();

                results.push(Memory {
                    id: format!("{}/{}/{}", entry.domain, entry.topic, entry.title),
                    content: entry.content.clone(),
                    category: entry.signals.category.clone(),
                    tags: vec![entry.topic.clone()],
                    confidence: entry.signals.confidence,
                    entities: entry.entities.clone(),
                    created_at: entry.signals.last_updated_at,
                    updated_at: entry.signals.last_updated_at,
                    score: final_score,
                });
            }
        }

        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        Ok(results.into_iter().take(SEARCH_MAX_RESULTS).collect())
    }

    /// Semantic search using pre-computed embeddings.
    /// Returns memories sorted by cosine similarity to the query embedding.
    pub fn search_semantic(&self, query_embedding: &[f32], top_k: usize) -> std::io::Result<Vec<Memory>> {
        let entries = self.storage.list_all_entries()?;
        let mut scored = Vec::new();

        for entry in &entries {
            let relative_path = format!("{}/{}/{}{}.md",
                entry.domain,
                entry.topic,
                entry.subtopic.as_ref().map(|s| format!("{}/", s)).unwrap_or_default(),
                entry.title
            );

            if let Some(emb) = self.storage.read_embedding_by_relative_path(&relative_path) {
                let sim = cosine_similarity(query_embedding, &emb);
                if sim > 0.5 { // threshold to avoid noise
                    scored.push((
                        Memory {
                            id: format!("{}/{}/{}", entry.domain, entry.topic, entry.title),
                            content: entry.content.clone(),
                            category: entry.signals.category.clone(),
                            tags: vec![entry.topic.clone()],
                            confidence: entry.signals.confidence,
                            entities: entry.entities.clone(),
                            created_at: entry.signals.last_updated_at,
                            updated_at: entry.signals.last_updated_at,
                            score: sim,
                        },
                        sim,
                    ));
                }
            }
        }

        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        Ok(scored.into_iter().map(|(m, _)| m).take(top_k).collect())
    }

    pub fn store_extracted_fact(&self, fact: &ExtractedFact) -> std::io::Result<()> {
        let now_iso = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
        let category = fact.domain.clone();
        let decay_cat = category_to_decay(&category);

        let mut signals = super::signals::RuntimeSignals::default();
        signals.confidence = fact.confidence;
        signals.category = category.clone();
        signals.decay_category = decay_cat;
        signals.provenance = fact.provenance.clone();

        let entry = MemoryEntry {
            title: fact.title.clone(),
            summary: fact.summary.clone(),
            domain: category,
            topic: fact.topic.clone(),
            subtopic: None,
            content: fact.content.clone(),
            tags: fact.tags.clone(),
            keywords: fact.keywords.clone(),
            category: fact.domain.clone(),
            confidence: fact.confidence,
            entities: fact.entities.clone(),
            provenance: fact.provenance.clone(),
            created_at: now_iso.clone(),
            updated_at: now_iso,
            signals,
        };
        self.storage.write_entry(&entry)
    }

    pub fn get_user_profile(&self) -> String {
        if let Ok(Some(content)) = self.storage.read_user_profile() {
            let body = ContextTreeStorage::strip_frontmatter(&content);
            let trimmed = body.trim();
            if trimmed.is_empty() {
                return String::new();
            }
            format!("\n[USER PROFILE]\n{}\n[/USER PROFILE]", trimmed)
        } else {
            String::new()
        }
    }

    pub fn update_user_profile(&self, fact: &ExtractedFact) -> std::io::Result<()> {
        let section = match fact.domain.as_str() {
            "identity" => "## Identity",
            "relationships" => "## Relationships",
            "preferences" => "## Preferences",
            "goals" => "## Goals",
            "emotional" => "## Active Context",
            _ => return Ok(()),
        };

        if fact.confidence < 0.7 {
            return Ok(());
        }

        let content_line = format!("- {}", fact.content);
        let now_iso = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();

        let profile = self.storage.read_user_profile()?.unwrap_or_else(|| {
            format!(
                "---\ntitle: User Profile\ncategory: identity\nconfidence: 1.0\nprovenance: consolidated\nupdatedAt: {}\n---\n\n## Identity\n\n## Relationships\n\n## Preferences\n\n## Goals\n\n## Active Context\n",
                now_iso
            )
        });

        let body = ContextTreeStorage::strip_frontmatter(&profile);
        let mut lines: Vec<String> = body.lines().map(|l| l.to_string()).collect();

        let section_idx = lines.iter().position(|l| l.trim() == section);
        if let Some(idx) = section_idx {
            let mut found = false;
            for i in (idx + 1)..lines.len() {
                if lines[i].starts_with("## ") {
                    break;
                }
                if lines[i].trim().to_lowercase() == content_line.to_lowercase() {
                    found = true;
                    break;
                }
            }

            if !found {
                let mut insert_at = idx + 1;
                for i in (idx + 1)..lines.len() {
                    if lines[i].starts_with("## ") {
                        break;
                    }
                    if !lines[i].trim().is_empty() {
                        insert_at = i + 1;
                    }
                }
                lines.insert(insert_at, content_line);
            }
        }

        let new_body = lines.join("\n");
        let frontmatter = format!(
            "---\ntitle: User Profile\ncategory: identity\nconfidence: 1.0\nprovenance: consolidated\nupdatedAt: {}\n---\n\n",
            now_iso
        );
        let full = format!("{}{}", frontmatter, new_body);

        if full != profile {
            self.storage.write_user_profile(&full)?;
        }

        Ok(())
    }

    pub fn store_memory(&self, domain: &str, topic: &str, title: &str, content: &str) -> std::io::Result<()> {
        let now_iso = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
        let entry = MemoryEntry {
            title: title.to_string(),
            summary: String::new(),
            domain: domain.to_string(),
            topic: topic.to_string(),
            subtopic: None,
            content: content.to_string(),
            tags: Vec::new(),
            keywords: Vec::new(),
            category: domain.to_string(),
            confidence: 0.5,
            entities: Vec::new(),
            provenance: "direct".to_string(),
            created_at: now_iso.clone(),
            updated_at: now_iso,
            signals: Default::default(),
        };
        self.storage.write_entry(&entry)
    }
}
