use std::path::PathBuf;
use crate::ai::memory::manager::MemoryManager;
use crate::ai::memory::types::SearchResult;

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
        self.manager.get_profile_block()
    }

    pub async fn search_context_with_session(&self, queries: Vec<String>) -> String {
        self.manager.search_context_with_session(queries).await
    }

    pub fn search_memories(&self, queries: Vec<String>) -> std::io::Result<Vec<SearchResult>> {
        self.manager.search(queries)
    }
}
