use async_trait::async_trait;
use serde_json::Value;

pub mod reset_chat;
pub mod select_model;
pub mod set_theme;

use reset_chat::ResetChatTool;
use select_model::SelectModelTool;
use set_theme::SetThemeTool;

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
            ],
        }
    }

    pub fn all(&self) -> &Vec<Box<dyn Tool>> {
        &self.tools
    }

    pub fn find(&self, name: &str) -> Option<&Box<dyn Tool>> {
        self.tools.iter().find(|t| t.name() == name)
    }
}
