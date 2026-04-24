use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::{json, Value};

use crate::mcp::config::load_config;
use crate::mcp::transport::{HttpTransport, McpTransport, StdioTransport};
use crate::mcp::types::{CallToolParams, CallToolResult, ClientCapabilities, ClientInfo, InitializeParams, JsonRpcRequest, ListToolsResult, McpTool, ServerConfig, ServerInfo};

static REQUEST_ID: AtomicU64 = AtomicU64::new(1);

fn next_id() -> u64 {
    REQUEST_ID.fetch_add(1, Ordering::Relaxed)
}

/// MCP Client — connects to a server, discovers tools, calls them.
pub struct McpClient {
    transport: Box<dyn McpTransport>,
    server_info: Option<ServerInfo>,
    pub name: String,
}

impl McpClient {
    /// Create and initialize a client from server configuration.
    pub async fn connect(name: &str, config: &ServerConfig) -> Result<Self, String> {
        let transport: Box<dyn McpTransport> = match config {
            ServerConfig::Http { url, headers } => {
                Box::new(HttpTransport::new(url.clone(), headers.clone()))
            }
            ServerConfig::Stdio { command, args, env } => {
                let args_slice = args.as_deref();
                let env_ref = env.as_ref();
                Box::new(StdioTransport::new(command, args_slice, env_ref).await?)
            }
        };

        let mut client = Self {
            transport,
            server_info: None,
            name: name.to_string(),
        };

        client.initialize().await?;
        Ok(client)
    }

    /// Perform MCP initialization handshake.
    async fn initialize(&mut self) -> Result<(), String> {
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: next_id(),
            method: "initialize".to_string(),
            params: Some(json!(InitializeParams {
                protocol_version: "2024-11-05".to_string(),
                capabilities: ClientCapabilities { sampling: None },
                client_info: ClientInfo {
                    name: "Orkestrate".to_string(),
                    version: env!("CARGO_PKG_VERSION").to_string(),
                },
            })),
        };

        let result = self.transport.send(request).await?;
        let info: ServerInfo = serde_json::from_value(result)
            .map_err(|e| format!("Failed to parse initialize response: {}", e))?;

        println!("[MCP] Connected to '{}' (protocol={})", self.name, info.protocol_version);

        // Send initialized notification
        let notify = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: next_id(),
            method: "notifications/initialized".to_string(),
            params: None,
        };
        let _ = self.transport.send(notify).await;

        self.server_info = Some(info);
        Ok(())
    }

    /// List all tools exposed by the server.
    pub async fn list_tools(&mut self) -> Result<Vec<McpTool>, String> {
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: next_id(),
            method: "tools/list".to_string(),
            params: None,
        };

        let result = self.transport.send(request).await?;
        let list: ListToolsResult = serde_json::from_value(result)
            .map_err(|e| format!("Failed to parse tools/list: {}", e))?;

        println!("[MCP] Server '{}' exposes {} tools", self.name, list.tools.len());
        Ok(list.tools)
    }

    /// Call a tool by name with JSON arguments.
    pub async fn call_tool(&mut self, name: &str, arguments: Value) -> Result<String, String> {
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: next_id(),
            method: "tools/call".to_string(),
            params: Some(json!(CallToolParams {
                name: name.to_string(),
                arguments,
            })),
        };

        let result = self.transport.send(request).await?;
        let call_result: CallToolResult = serde_json::from_value(result)
            .map_err(|e| format!("Failed to parse tools/call result: {}", e))?;

        // Concatenate all text content
        let mut output = String::new();
        for content in &call_result.content {
            if let Some(text) = &content.text {
                output.push_str(text);
                output.push('\n');
            }
        }

        if output.is_empty() {
            output = "(Tool returned no text content)".to_string();
        }

        Ok(output.trim().to_string())
    }

    pub async fn disconnect(&mut self) {
        self.transport.close().await;
    }
}

/// Load MCP config and connect to all configured servers.
/// Returns a map of server name → (client, tools).
pub async fn discover_all_tools() -> Result<std::collections::HashMap<String, (McpClient, Vec<McpTool>)>, String> {
    let config = load_config()?;
    let mut discovered = std::collections::HashMap::new();

    for (name, server_config) in &config.servers {
        match McpClient::connect(name, server_config).await {
            Ok(mut client) => {
                match client.list_tools().await {
                    Ok(tools) => {
                        discovered.insert(name.clone(), (client, tools));
                    }
                    Err(e) => {
                        eprintln!("[MCP] Failed to list tools for '{}': {}", name, e);
                        client.disconnect().await;
                    }
                }
            }
            Err(e) => {
                eprintln!("[MCP] Failed to connect to '{}': {}", name, e);
            }
        }
    }

    Ok(discovered)
}
