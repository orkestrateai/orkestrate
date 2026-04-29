use std::cmp::Ordering;
use serde::{Serialize, Deserialize};
use super::storage::{ContextTreeStorage, MemoryEntry};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Memory {
    pub id: String,
    pub content: String,
    pub score: f64,
    pub confidence: f64,
}

pub struct MemoryManager {
    storage: ContextTreeStorage,
}

const SEARCH_MAX_RESULTS: usize = 10;
const SEARCH_TITLE_BOOST: f64 = 2.0;
const SEARCH_CONTENT_BOOST: f64 = 1.0;
const SEARCH_PATH_BOOST: f64 = 1.5;

impl MemoryManager {
    pub fn new(app_data_dir: std::path::PathBuf) -> Self {
        Self {
            storage: ContextTreeStorage::new(app_data_dir),
        }
    }

    pub fn storage(&self) -> &ContextTreeStorage {
        &self.storage
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
        let entries = self.storage.list_all_entries()?;
        let mut results = Vec::new();

        for entry in &entries {
            let mut best_bm25 = 0.0;

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

                if combined > best_bm25 {
                    best_bm25 = combined;
                }
            }

            if best_bm25 > 0.0 {
                results.push(Memory {
                    id: format!("{}/{}/{}", entry.domain, entry.topic, entry.title),
                    content: entry.content.clone(),
                    confidence: entry.confidence,
                    score: best_bm25,
                });
            }
        }

        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(Ordering::Equal));
        Ok(results.into_iter().take(SEARCH_MAX_RESULTS).collect())
    }

    pub fn store_entry(&self, entry: &MemoryEntry) -> std::io::Result<()> {
        self.storage.write_entry(entry)
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

    pub fn update_user_profile(&self, section: &str, content_line: &str) -> std::io::Result<()> {
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
                lines.insert(insert_at, content_line.to_string());
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
}
