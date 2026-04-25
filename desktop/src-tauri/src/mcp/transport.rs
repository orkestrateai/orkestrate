use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};

use crate::mcp::types::JsonRpcRequest;

/// Trait for MCP transports — both HTTP and stdio implement this.
#[async_trait::async_trait]
pub trait McpTransport: Send + Sync {
    async fn send(&mut self, request: JsonRpcRequest) -> Result<Value, String>;
    async fn close(&mut self);
}

// ─── HTTP Transport (reqwest + SSE parsing) ────────────────────────────

pub struct HttpTransport {
    client: reqwest::Client,
    url: String,
    headers: Option<std::collections::HashMap<String, String>>,
}

impl HttpTransport {
    pub fn new(url: String, headers: Option<std::collections::HashMap<String, String>>) -> Self {
        Self {
            client: reqwest::Client::new(),
            url,
            headers,
        }
    }
}

#[async_trait::async_trait]
impl McpTransport for HttpTransport {
    async fn send(&mut self, request: JsonRpcRequest) -> Result<Value, String> {
        let body = serde_json::to_string(&request)
            .map_err(|e| format!("JSON serialize error: {}", e))?;

        let mut req = self
            .client
            .post(&self.url)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream");

        // Add custom headers (e.g., Authorization)
        if let Some(ref headers) = self.headers {
            for (key, value) in headers {
                req = req.header(key, value);
            }
        }

        let response = req
            .body(body)
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body_text = response.text().await.unwrap_or_default();
            return Err(format!("HTTP {}: {}", status, body_text));
        }

        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        // Handle SSE responses (Exa MCP returns SSE)
        if content_type.contains("text/event-stream") {
            let body_text = response.text().await.map_err(|e| format!("Read SSE body: {}", e))?;
            parse_sse_response(&body_text)
        } else {
            // Regular JSON response
            let value: Value = response.json().await.map_err(|e| format!("JSON parse: {}", e))?;
            extract_result(value)
        }
    }

    async fn close(&mut self) {
        // HTTP is stateless — nothing to close
    }
}

/// Parse SSE (Server-Sent Events) response body.
/// Looks for `data: {...}` lines and extracts the JSON payload.
fn parse_sse_response(body: &str) -> Result<Value, String> {
    for line in body.lines() {
        let line = line.trim();
        if line.starts_with("data: ") {
            let data = &line[6..];
            if data == "[DONE]" {
                continue;
            }
            let value: Value = serde_json::from_str(data)
                .map_err(|e| format!("SSE data parse error: {} | raw: {}", e, data))?;
            return extract_result(value);
        }
    }
    Err("No data found in SSE response".to_string())
}

/// Extract the `result` field from a JSON-RPC response.
fn extract_result(value: Value) -> Result<Value, String> {
    if let Some(error) = value.get("error") {
        let msg = error["message"].as_str().unwrap_or("Unknown JSON-RPC error");
        return Err(format!("JSON-RPC error: {}", msg));
    }
    value
        .get("result")
        .cloned()
        .ok_or_else(|| "Missing result in JSON-RPC response".to_string())
}

// ─── Stdio Transport (spawn child process) ─────────────────────────────

pub struct StdioTransport {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

impl StdioTransport {
    pub async fn new(command: &str, args: Option<&[String]>, env: Option<&std::collections::HashMap<String, String>>) -> Result<Self, String> {
        let mut cmd = Command::new(command);
        if let Some(args) = args {
            cmd.args(args);
        }
        if let Some(env) = env {
            for (key, value) in env {
                cmd.env(key, value);
            }
        }

        cmd.stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null());

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn MCP server '{}': {}", command, e))?;

        let stdin = child.stdin.take().ok_or("Failed to open stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to open stdout")?;

        Ok(Self {
            child,
            stdin,
            stdout: BufReader::new(stdout),
        })
    }
}

#[async_trait::async_trait]
impl McpTransport for StdioTransport {
    async fn send(&mut self, request: JsonRpcRequest) -> Result<Value, String> {
        let body = serde_json::to_string(&request)
            .map_err(|e| format!("JSON serialize error: {}", e))?;

        // Write JSON-RPC line + newline
        let line = format!("{}\n", body);
        self.stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| format!("Write to MCP server: {}", e))?;
        self.stdin
            .flush()
            .await
            .map_err(|e| format!("Flush stdin: {}", e))?;

        // Read response line
        let mut response_line = String::new();
        self.stdout
            .read_line(&mut response_line)
            .await
            .map_err(|e| format!("Read from MCP server: {}", e))?;

        let value: Value = serde_json::from_str(&response_line)
            .map_err(|e| format!("JSON parse from MCP server: {} | raw: {}", e, response_line))?;

        extract_result(value)
    }

    async fn close(&mut self) {
        let _ = self.stdin.shutdown().await;
        let _ = self.child.kill().await;
    }
}
