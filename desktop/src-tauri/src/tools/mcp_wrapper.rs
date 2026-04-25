use async_trait::async_trait;
use serde_json::Value;

use crate::mcp::McpClient;
use crate::timer::Timer;

use super::Tool;

/// Wrapper that exposes an MCP server's tool as a native Orkestrate tool.
pub struct McpToolWrapper {
    pub server_name: String,
    pub tool_name: String,
    pub tool_description: String,
    pub input_schema: Value,
    // We store a cloneable reference to the client... but McpClient isn't Clone.
    // Instead, we'll create a fresh client per call or use a shared pool.
    // For simplicity: create a new client connection per tool call.
    // This is slightly slower but avoids complex lifetime management.
    pub server_config: crate::mcp::types::ServerConfig,
}

#[async_trait]
impl Tool for McpToolWrapper {
    fn name(&self) -> &'static str {
        self.tool_name.clone().leak()
    }

    fn description(&self) -> &'static str {
        self.tool_description.clone().leak()
    }

    fn parameters(&self) -> Value {
        self.input_schema.clone()
    }

    async fn execute(&self, args: Value) -> Result<String, String> {
        let _timer = Timer::new(&format!("tool::mcp::{}::{}", self.server_name, self.tool_name));

        // Connect fresh for each call
        let mut client = McpClient::connect(&self.server_name, &self.server_config).await?;

        let result = client.call_tool(&self.tool_name, args).await;

        client.disconnect().await;

        result
    }
}
