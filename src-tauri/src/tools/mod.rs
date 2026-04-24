use async_trait::async_trait;
use serde_json::Value;

pub mod connect_memories;
pub mod reset_chat;
pub mod search_memory;
pub mod select_model;
pub mod set_theme;
pub mod store_memory;
pub mod web_fetch;
pub mod web_search;
pub mod mcp_wrapper;

use connect_memories::ConnectMemoriesTool;
use reset_chat::ResetChatTool;
use search_memory::SearchMemoryTool;
use select_model::SelectModelTool;
use set_theme::SetThemeTool;
use store_memory::StoreMemoryTool;
use web_fetch::WebFetchTool;
use web_search::WebSearchTool;

/// A tool that the LLM can invoke.
#[async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> &'static str;
    fn description(&self) -> &'static str;
    fn parameters(&self) -> Value;
    async fn execute(&self, args: Value) -> Result<String, String>;
}

/// Registry of all available tools.
pub struct ToolRegistry {
    tools: Vec<Box<dyn Tool>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: vec![
                Box::new(SetThemeTool),
                Box::new(SelectModelTool),
                Box::new(ResetChatTool),
                Box::new(SearchMemoryTool),
                Box::new(StoreMemoryTool),
                Box::new(ConnectMemoriesTool),
                Box::new(WebSearchTool),
                Box::new(WebFetchTool),
            ],
        }
    }

    /// Create a registry with native tools + discovered MCP tools.
    pub async fn new_with_mcp() -> Self {
        let mut registry = Self::new();

        match crate::mcp::discover_all_tools().await {
            Ok(discovered) => {
                for (server_name, (client, tools)) in discovered {
                    let server_config = match crate::mcp::config::load_config() {
                        Ok(cfg) => cfg.servers.get(&server_name).cloned(),
                        Err(_) => None,
                    };

                    if let Some(config) = server_config {
                        for tool in tools {
                            println!("[ToolRegistry] Registering MCP tool '{}' from server '{}'", tool.name, server_name);
                            registry.tools.push(Box::new(mcp_wrapper::McpToolWrapper {
                                server_name: server_name.clone(),
                                tool_name: tool.name.clone(),
                                tool_description: tool.description.clone(),
                                input_schema: tool.input_schema.clone(),
                                server_config: config.clone(),
                            }));
                        }
                    }

                    // Note: client is dropped here. McpToolWrapper creates fresh connections per call.
                    drop(client);
                }
            }
            Err(e) => {
                eprintln!("[ToolRegistry] MCP discovery failed: {}", e);
            }
        }

        registry
    }

    #[allow(dead_code)]
    pub fn add(&mut self, tool: Box<dyn Tool>) {
        self.tools.push(tool);
    }

    pub fn all(&self) -> &Vec<Box<dyn Tool>> {
        &self.tools
    }

    pub fn find(&self, name: &str) -> Option<&Box<dyn Tool>> {
        self.tools.iter().find(|t| t.name() == name)
    }
}
