use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    #[serde(default = "default_memory_continuity_mode")]
    pub memory_continuity_mode: String,
}

fn default_memory_continuity_mode() -> String {
    "session".to_string()
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            memory_continuity_mode: default_memory_continuity_mode(),
        }
    }
}

fn config_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Orkestrate")
        .join("config.json")
}

pub fn load_config() -> AppConfig {
    let path = config_path();
    if !path.exists() {
        return AppConfig::default();
    }
    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

pub fn get_memory_continuity_mode() -> String {
    load_config().memory_continuity_mode
}

pub fn set_memory_continuity_mode(mode: &str) -> Result<(), String> {
    let mut config = load_config();
    config.memory_continuity_mode = mode.to_string();
    save_config(&config)
}
