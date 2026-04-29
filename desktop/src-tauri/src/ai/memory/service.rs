use std::path::PathBuf;
use serde_json::json;
use crate::ai::memory::MemoryManager;

pub struct ChatMemoryService {
    manager: MemoryManager,
}

impl ChatMemoryService {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self {
            manager: MemoryManager::new(app_data_dir),
        }
    }

    pub fn manager(&self) -> &MemoryManager {
        &self.manager
    }

    pub fn get_user_profile(&self) -> String {
        self.manager.get_user_profile()
    }

    pub async fn search_context_with_session(&self, queries: Vec<String>) -> String {
        match self.manager.search(queries) {
            Ok(memories) => {
                if memories.is_empty() {
                    return "No relevant information found in memory.".to_string();
                }
                json!({
                    "results": memories.iter().map(|m| {
                        json!({
                            "content": m.content,
                            "id": m.id,
                            "relevance": m.score,
                        })
                    }).collect::<Vec<_>>()
                }).to_string()
            }
            Err(e) => format!("Error searching memory: {}", e),
        }
    }
}
