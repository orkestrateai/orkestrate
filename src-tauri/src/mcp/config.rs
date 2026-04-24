use std::path::PathBuf;

use crate::mcp::types::McpConfig;

pub fn config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Orkestrate")
        .join("mcp.json")
}

pub fn load_config() -> Result<McpConfig, String> {
    let path = config_path();
    if !path.exists() {
        return Ok(McpConfig {
            servers: std::collections::HashMap::new(),
        });
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read MCP config: {}", e))?;

    let config: McpConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse MCP config: {}", e))?;

    Ok(config)
}

pub fn save_config(config: &McpConfig) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize MCP config: {}", e))?;

    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write MCP config: {}", e))?;

    Ok(())
}
