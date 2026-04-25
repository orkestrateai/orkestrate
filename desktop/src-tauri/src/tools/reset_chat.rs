use async_trait::async_trait;
use serde_json::{json, Value};

use super::Tool;

pub struct ResetChatTool;

#[async_trait]
impl Tool for ResetChatTool {
    fn name(&self) -> &'static str {
        "reset_chat"
    }

    fn description(&self) -> &'static str {
        "Clear the current conversation history and start fresh."
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {},
            "required": []
        })
    }

    async fn execute(&self, _args: Value) -> Result<String, String> {
        Ok("Chat history cleared. Ready for a new conversation.".to_string())
    }
}
