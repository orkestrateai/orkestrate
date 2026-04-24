pub mod learn;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Instant;
use tauri::Emitter;

use crate::context::ContextBuilder;
use crate::db;
use crate::memory;
use crate::timer::{ChunkTimer, Timer};
use crate::tools::ToolRegistry;
use crate::{HistoryMessage, ToolCallEvent, ToolResultEvent};

const MAX_STEPS: usize = 5;
const API_BASE: &str = "https://opencode.ai/zen/v1/chat/completions";

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<serde_json::Value>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<serde_json::Value>>,
    max_tokens: i32,
}

#[derive(Deserialize, Debug)]
struct StreamChoice {
    delta: StreamDelta,
}

#[derive(Deserialize, Debug, Default)]
struct StreamDelta {
    content: Option<String>,
    reasoning: Option<String>,
    reasoning_content: Option<String>,
    #[serde(default)]
    tool_calls: Option<Vec<StreamToolCall>>,
}

#[derive(Deserialize, Debug, Clone)]
struct StreamToolCall {
    index: usize,
    id: Option<String>,
    #[serde(rename = "type")]
    #[allow(dead_code)]
    call_type: Option<String>,
    function: Option<StreamFunction>,
}

#[derive(Deserialize, Debug, Clone)]
struct StreamFunction {
    name: Option<String>,
    arguments: Option<String>,
}

#[derive(Deserialize, Debug)]
struct StreamChunk {
    choices: Vec<StreamChoice>,
}

/// Accumulated tool call during streaming.
#[derive(Debug)]
struct AccumulatedToolCall {
    id: String,
    name: String,
    arguments: String,
}

/// Run the ReAct agent loop using raw reqwest + manual JSON.
pub async fn run_agent(
    window: tauri::Window,
    request_id: String,
    session_id: String,
    session_name: Option<String>,
    history: Vec<HistoryMessage>,
    model: String,
    api_key: String,
) -> Result<(), String> {
    let _agent_timer = Timer::new(&format!("run_agent | req={}", request_id));
    let client = reqwest::Client::new();
    let registry = ToolRegistry::new_with_mcp().await;
    let tools_json = registry_to_json(&registry);

    let ctx_timer = Timer::new("run_agent::build_context");
    let mut messages = ContextBuilder::new(&session_id)
        .with_history(history.clone())
        .with_session_name(session_name.as_deref().unwrap_or("New Chat"))
        .build();
    ctx_timer.log(&format!("messages_count={}", messages.len()));

    // ── Auto memory search: inject retrieved memories before every request ──
    if let Some(last_user_msg) = history.iter().rev().find(|m| m.role == "user") {
        let search_timer = Timer::new("run_agent::auto_memory_search");
        let query = last_user_msg.content.clone();
        let search_handle = tauri::async_runtime::spawn(async move {
            let episodes = crate::tools::search_memory::search_memory_raw(&[query], 5).await;
            crate::tools::search_memory::format_retrieved_memories(&episodes)
        });

        match search_handle.await {
            Ok(memories_str) if !memories_str.is_empty() => {
                // Insert after the main system prompt (index 0)
                messages.insert(1, json!({
                    "role": "system",
                    "content": memories_str
                }));
                search_timer.log("injected");
            }
            Ok(_) => search_timer.log("no_results"),
            Err(e) => {
                eprintln!("[Agent] Auto memory search join error: {}", e);
                search_timer.log("join_error");
            }
        }
    }

    let history_start_idx = messages.len();
    let mut step = 0;
    let mut accumulated_content = String::new();

    loop {
        step += 1;
        let step_timer = Timer::new(&format!("react_step_{}", step));
        if step > MAX_STEPS {
            let _ = window.emit(
                "chat-chunk",
                json!({ "requestId": request_id, "content": "\n\n[Reached maximum reasoning steps]" }),
            );
            break;
        }

        // Build request
        let req_build_timer = Timer::new(&format!("step_{}::build_request", step));
        let request = ChatRequest {
            model: model.clone(),
            messages: messages.clone(),
            stream: true,
            tools: Some(tools_json.clone()),
            max_tokens: 8192,
        };
        let body_json = serde_json::to_string(&request).unwrap_or_default();
        req_build_timer.log(&format!("body_bytes={}", body_json.len()));

        println!("\n=== REQUEST BODY (step {}) ===", step);
        println!("{}", serde_json::to_string_pretty(&request).unwrap_or_default());
        println!("=== END REQUEST BODY ===\n");

        // Send request — measure TTFB
        let send_timer = Timer::new(&format!("step_{}::api_send", step));
        let ttfb_start = Instant::now();
        let response = client
            .post(API_BASE)
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;
        let ttfb_ms = ttfb_start.elapsed().as_millis();
        send_timer.log(&format!("ttfb={}ms status={}", ttfb_ms, response.status()));

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("API Error {}: {}", status, body));
        }

        // Stream and accumulate
        let stream_timer = Timer::new(&format!("step_{}::stream", step));
        let mut chunk_timer = ChunkTimer::new();
        let mut stream = response.bytes_stream();
        let mut partial_line = String::new();
        let mut step_content = String::new();
        let mut accumulated_reasoning = String::new();
        let mut tool_calls_in_progress: Vec<AccumulatedToolCall> = Vec::new();
        let mut content_chunks = 0usize;
        let mut reasoning_chunks = 0usize;

        while let Some(item) = stream.next().await {
            let chunk = item.map_err(|e| e.to_string())?;
            chunk_timer.record(chunk.len());
            let text = String::from_utf8_lossy(&chunk);

            let combined = partial_line + &text;
            let mut lines = combined.split('\n').collect::<Vec<_>>();

            if !text.ends_with('\n') {
                partial_line = lines.pop().unwrap_or("").to_string();
            } else {
                partial_line = String::new();
            }

            for line in lines {
                let line = line.trim();
                if line.is_empty() || line == "data: [DONE]" {
                    continue;
                }

                if let Some(json_str) = line.strip_prefix("data:") {
                    let json_str = json_str.trim();
                    match serde_json::from_str::<StreamChunk>(json_str) {
                        Ok(chunk_data) => {
                            for choice in chunk_data.choices {
                                let delta = choice.delta;

                                // Reasoning
                                if let Some(ref reasoning) = delta.reasoning {
                                    accumulated_reasoning.push_str(reasoning);
                                    reasoning_chunks += 1;
                                    let _ = window.emit(
                                        "reasoning-chunk",
                                        json!({ "requestId": request_id, "content": reasoning }),
                                    );
                                }
                                if let Some(ref reasoning) = delta.reasoning_content {
                                    accumulated_reasoning.push_str(reasoning);
                                    reasoning_chunks += 1;
                                    let _ = window.emit(
                                        "reasoning-chunk",
                                        json!({ "requestId": request_id, "content": reasoning }),
                                    );
                                }

                                // Content
                                if let Some(ref content) = delta.content {
                                    step_content.push_str(content);
                                    content_chunks += 1;
                                    let _ = window.emit(
                                        "chat-chunk",
                                        json!({ "requestId": request_id, "content": content }),
                                    );
                                }

                                // Tool calls
                                if let Some(ref calls) = delta.tool_calls {
                                    for tc in calls {
                                        let idx = tc.index;
                                        // Ensure we have enough slots
                                        while tool_calls_in_progress.len() <= idx {
                                            tool_calls_in_progress.push(AccumulatedToolCall {
                                                id: String::new(),
                                                name: String::new(),
                                                arguments: String::new(),
                                            });
                                        }
                                        let slot = &mut tool_calls_in_progress[idx];
                                        if let Some(id) = &tc.id {
                                            slot.id.push_str(id);
                                        }
                                        if let Some(func) = &tc.function {
                                            if let Some(name) = &func.name {
                                                slot.name.push_str(name);
                                            }
                                            if let Some(args) = &func.arguments {
                                                slot.arguments.push_str(args);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("[Agent] JSON Parse Error: {} | Raw: {}", e, json_str);
                        }
                    }
                }
            }
        }
        chunk_timer.summary();
        accumulated_content.push_str(&step_content);
        stream_timer.log(&format!("content_chunks={} reasoning_chunks={} content_len={} reasoning_len={}",
            content_chunks, reasoning_chunks, accumulated_content.len(), accumulated_reasoning.len()));

        if !accumulated_reasoning.is_empty() {
            println!("\n=== REASONING (step {}) ===", step);
            println!("{}", accumulated_reasoning);
            println!("=== END REASONING ===\n");
        }

        // Check for completed tool calls
        let completed_tool_calls: Vec<AccumulatedToolCall> = tool_calls_in_progress
            .into_iter()
            .filter(|tc| !tc.id.is_empty() && !tc.name.is_empty())
            .collect();

        if !completed_tool_calls.is_empty() {
            // Add assistant message with tool calls to history
            let tool_calls_json: Vec<serde_json::Value> = completed_tool_calls
                .iter()
                .map(|tc| {
                    json!({
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": tc.arguments
                        }
                    })
                })
                .collect();

            messages.push(json!({
                "role": "assistant",
                "content": null,
                "tool_calls": tool_calls_json
            }));

            // Execute each tool
            for tc in &completed_tool_calls {
                let tool_timer = Timer::new(&format!("tool_execute::{} step={}", tc.name, step));
                let tool_args: serde_json::Value =
                    serde_json::from_str(&tc.arguments).unwrap_or(json!({}));

                // Emit tool-call event
                let _ = window.emit(
                    "tool-call",
                    ToolCallEvent {
                        request_id: request_id.clone(),
                        tool: tc.name.clone(),
                        args: tool_args.clone(),
                        id: tc.id.clone(),
                    },
                );

                // Execute
                let result = if let Some(tool) = registry.find(&tc.name) {
                    match tool.execute(tool_args.clone()).await {
                        Ok(r) => {
                            emit_tool_effect(&window, &tc.name, &tc.arguments);
                            // Emit step events for UI rendering
                            match tc.name.as_str() {
                                "search_memory" => {
                                    let queries: Vec<String> = tool_args["queries"]
                                        .as_array()
                                        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                                        .unwrap_or_default();
                                    let result_count = serde_json::from_str::<serde_json::Value>(&r)
                                        .ok()
                                        .and_then(|v| v["result_count"].as_i64())
                                        .unwrap_or(0);
                                    let _ = window.emit("memory-search-step", json!({
                                        "requestId": request_id,
                                        "queries": queries,
                                        "resultCount": result_count
                                    }));
                                }
                                "web_search" => {
                                    let query = tool_args["query"].as_str().unwrap_or("").to_string();
                                    let _ = window.emit("web-search-step", json!({
                                        "requestId": request_id,
                                        "query": query
                                    }));
                                }
                                "web_fetch" => {
                                    let url = tool_args["url"].as_str().unwrap_or("").to_string();
                                    let _ = window.emit("web-fetch-step", json!({
                                        "requestId": request_id,
                                        "url": url
                                    }));
                                }
                                _ => {}
                            }
                            r
                        }
                        Err(e) => format!("Error: {}", e),
                    }
                } else {
                    format!("Unknown tool: {}", tc.name)
                };
                tool_timer.log(&format!("result_len={}", result.len()));

                // Emit tool-result event
                let _ = window.emit(
                    "tool-result",
                    ToolResultEvent {
                        request_id: request_id.clone(),
                        tool: tc.name.clone(),
                        result: result.clone(),
                        id: tc.id.clone(),
                    },
                );

                // Add tool result to history
                messages.push(json!({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result
                }));
            }

            step_timer.log(&format!("tools_executed={}", completed_tool_calls.len()));
            continue; // Loop back to LLM
        }

        step_timer.log("no_tools");
        // No tool calls — done
        break;
    }

    // ── Add assistant response to message history before memory extraction ──
    messages.push(json!({
        "role": "assistant",
        "content": accumulated_content
    }));

    // ── Persist all new messages from this turn ───────────────────────────
    for msg in &messages[history_start_idx..] {
        if let Some(role) = msg.get("role").and_then(|v| v.as_str()) {
            let content = msg.get("content").and_then(|v| v.as_str()).unwrap_or("");
            let tool_call_id = msg.get("tool_call_id").and_then(|v| v.as_str());
            let tool_calls = msg.get("tool_calls").map(|v| v.to_string());
            if let Err(e) = db::store_message(&session_id, role, content, tool_call_id, tool_calls.as_deref()) {
                eprintln!("[Agent] Failed to save message: {}", e);
            }
        }
    }

    // ── Background memory extraction ──────────────────────────────────────
    // Capture the complete latest turn: everything from the last user message
    // to the end. Skip system messages, tool results, and assistant tool-call
    // placeholders (content: null) — only the user message and the assistant's
    // final synthesized response matter for memory extraction.
    let latest_exchange: Vec<HistoryMessage> = {
        let user_idx = messages.iter().rposition(|m| {
            m.get("role").and_then(|r| r.as_str()) == Some("user")
        });

        if let Some(idx) = user_idx {
            messages[idx..].iter().filter_map(|m| {
                let role = m.get("role")?.as_str()?;
                if role == "system" {
                    return None;
                }
                let content = match m.get("content") {
                    Some(v) => v.as_str().unwrap_or(""),
                    None => "",
                };
                // Skip tool results and assistant messages that are just
                // tool-call placeholders with no readable content.
                if role == "tool" || (role == "assistant" && content.is_empty()) {
                    return None;
                }
                Some(HistoryMessage {
                    role: role.to_string(),
                    content: content.to_string(),
                    tool_call_id: None,
                    tool_calls: None,
                })
            }).collect()
        } else {
            // Fallback: last 2 non-system, non-tool messages with actual content
            messages.iter().rev().take(2).filter_map(|m| {
                let role = m.get("role")?.as_str()?;
                let content = m.get("content")?.as_str()?;
                if role == "system" || role == "tool" {
                    None
                } else {
                    Some(HistoryMessage {
                        role: role.to_string(),
                        content: content.to_string(),
                        tool_call_id: None,
                        tool_calls: None,
                    })
                }
            }).collect::<Vec<_>>().into_iter().rev().collect()
        }
    };

    println!("[Memory] Spawning pipeline with {} messages", latest_exchange.len());

    let memory_session_id = session_id.clone();
    let memory_api_key = api_key.clone();
    tokio::spawn(async move {
        memory::process_turn(
            memory_session_id,
            latest_exchange,
            memory_api_key,
        )
        .await;
    });

    let _ = window.emit("done", json!({ "requestId": request_id }));
    Ok(())
}

/// Convert tool registry to OpenAI-compatible JSON.
fn registry_to_json(registry: &ToolRegistry) -> Vec<serde_json::Value> {
    registry
        .all()
        .iter()
        .map(|tool| {
            json!({
                "type": "function",
                "function": {
                    "name": tool.name(),
                    "description": tool.description(),
                    "parameters": tool.parameters()
                }
            })
        })
        .collect()
}

/// Emit Tauri events for tool side effects.
fn emit_tool_effect(window: &tauri::Window, tool_name: &str, args: &str) {
    match tool_name {
        "set_theme" => {
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(args) {
                if let Some(theme) = value["theme"].as_str() {
                    let _ = window.emit("theme-changed", json!({ "theme": theme }));
                }
            }
        }
        "select_model" => {
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(args) {
                if let Some(model) = value["model"].as_str() {
                    let _ = window.emit("model-selected", json!({ "model": model }));
                }
            }
        }
        "reset_chat" => {
            let _ = window.emit("chat-reset", json!({}));
        }
        _ => {}
    }
}
