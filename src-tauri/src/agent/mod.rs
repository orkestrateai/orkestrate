use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::Emitter;

use crate::agents::query_expander;
use crate::agents::storage_classifier;
use crate::memory::retrieve;
use crate::memory::store;
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
/// Now with integrated memory retrieval and storage.
pub async fn run_agent(
    window: tauri::Window,
    request_id: String,
    history: Vec<HistoryMessage>,
    model: String,
    api_key: String,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let registry = ToolRegistry::new();
    let tools_json = registry_to_json(&registry);

    // Extract the user's last message for memory operations
    let last_user_message = history
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .map(|m| m.content.clone())
        .unwrap_or_default();

    // Retrieve memory context asynchronously
    let memory_context = if !last_user_message.is_empty() {
        match retrieve_memory_context(&last_user_message, &api_key).await {
            Ok(ctx) => ctx,
            Err(e) => {
                eprintln!("Memory retrieval failed: {}", e);
                String::new()
            }
        }
    } else {
        String::new()
    };

    let mut messages = build_messages(history, &memory_context);
    let mut step = 0;

    loop {
        step += 1;
        if step > MAX_STEPS {
            let _ = window.emit(
                "chat-chunk",
                json!({ "requestId": request_id, "content": "\n\n[Reached maximum reasoning steps]" }),
            );
            break;
        }

        // Build request
        let request = ChatRequest {
            model: model.clone(),
            messages: messages.clone(),
            stream: true,
            tools: if step == 1 { Some(tools_json.clone()) } else { Some(tools_json.clone()) },
        };

        // Send request
        let response = client
            .post(API_BASE)
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("API Error {}: {}", status, body));
        }

        // Stream and accumulate
        let mut stream = response.bytes_stream();
        let mut partial_line = String::new();
        let mut accumulated_content = String::new();
        let mut accumulated_reasoning = String::new();
        let mut tool_calls_in_progress: Vec<AccumulatedToolCall> = Vec::new();

        while let Some(item) = stream.next().await {
            let chunk = item.map_err(|e| e.to_string())?;
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
                                    let _ = window.emit(
                                        "reasoning-chunk",
                                        json!({ "requestId": request_id, "content": reasoning }),
                                    );
                                }
                                if let Some(ref reasoning) = delta.reasoning_content {
                                    accumulated_reasoning.push_str(reasoning);
                                    let _ = window.emit(
                                        "reasoning-chunk",
                                        json!({ "requestId": request_id, "content": reasoning }),
                                    );
                                }

                                // Content
                                if let Some(ref content) = delta.content {
                                    accumulated_content.push_str(content);
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
                    match tool.execute(tool_args).await {
                        Ok(r) => {
                            emit_tool_effect(&window, &tc.name, &tc.arguments);
                            r
                        }
                        Err(e) => format!("Error: {}", e),
                    }
                } else {
                    format!("Unknown tool: {}", tc.name)
                };

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

            continue; // Loop back to LLM
        }

        // No tool calls — done
        break;
    }

    // Store memories in background (non-blocking)
    if !last_user_message.is_empty() {
        let assistant_response = messages
            .iter()
            .rev()
            .find(|m| m.get("role") == Some(&json!("assistant")))
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_str())
            .unwrap_or("")
            .to_string();

        let turn_id = request_id.clone();
        let api_key_clone = api_key.clone();

        tokio::spawn(async move {
            // Store classified memories
            if let Err(e) = store_memories(&last_user_message, &assistant_response, &turn_id, &api_key_clone).await {
                eprintln!("Background memory storage failed: {}", e);
            }

            // Process any pending embedding jobs
            match crate::memory::embedding_queue::process_embedding_queue().await {
                Ok(count) => {
                    if count > 0 {
                        println!("Processed {} embedding jobs", count);
                    }
                }
                Err(e) => {
                    eprintln!("Embedding queue processing failed: {}", e);
                }
            }
        });
    }

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

/// Build initial message list from history, injecting memory context.
fn build_messages(history: Vec<HistoryMessage>, memory_context: &str) -> Vec<serde_json::Value> {
    let system_content = if memory_context.is_empty() {
        "You are Orkestrate, a helpful AI assistant. You have access to tools that let you control the application. When the user asks to change the theme, switch models, or reset the chat, use the appropriate tool.".to_string()
    } else {
        format!(
            "You are Orkestrate, a helpful AI assistant. You have access to tools that let you control the application.\n\n## Relevant Context from Memory\n{}\n\nUse this context to personalize your response. Ground everything in what you know about the user.",
            memory_context
        )
    };

    let mut messages = vec![json!({
        "role": "system",
        "content": system_content
    })];

    for msg in history {
        messages.push(json!({
            "role": msg.role,
            "content": msg.content
        }));
    }

    messages
}

/// Retrieve relevant memory context for a user message.
async fn retrieve_memory_context(user_message: &str, api_key: &str) -> Result<String, String> {
    // Expand the query into multiple search queries
    let expanded = query_expander::expand_query(user_message, api_key).await?;

    // Retrieve memories
    let memories = retrieve::retrieve_context(&expanded, 15).await?;

    if memories.is_empty() {
        return Ok(String::new());
    }

    // Also get the life document
    let life_doc = retrieve::get_life_document().unwrap_or(json!({}));

    // Format into a readable context block
    let mut sections = Vec::new();

    // Add life document summary if available
    if let Some(identity) = life_doc.get("identity") {
        sections.push(format!("**User Identity**: {}", identity));
    }
    if let Some(current_state) = life_doc.get("current_state") {
        sections.push(format!("**Current State**: {}", current_state));
    }

    // Group memories by capacity
    let mut entity_mems = Vec::new();
    let mut rel_mems = Vec::new();
    let mut hist_mems = Vec::new();
    let mut constraint_mems = Vec::new();
    let mut state_mems = Vec::new();
    let mut goal_mems = Vec::new();
    let mut pattern_mems = Vec::new();

    for mem in memories {
        match mem.capacity.as_str() {
            "entity" => entity_mems.push(mem),
            "relationship" => rel_mems.push(mem),
            "history" => hist_mems.push(mem),
            "constraint" => constraint_mems.push(mem),
            "state" => state_mems.push(mem),
            "goal" => goal_mems.push(mem),
            "pattern" => pattern_mems.push(mem),
            _ => {}
        }
    }

    if !entity_mems.is_empty() {
        sections.push("**People & Entities**:".to_string());
        for m in entity_mems {
            sections.push(format!("- {}", m.content));
        }
    }
    if !rel_mems.is_empty() {
        sections.push("**Relationships & Dynamics**:".to_string());
        for m in rel_mems {
            sections.push(format!("- {}", m.content));
        }
    }
    if !constraint_mems.is_empty() {
        sections.push("**Constraints & Limits**:".to_string());
        for m in constraint_mems {
            sections.push(format!("- {}", m.content));
        }
    }
    if !state_mems.is_empty() {
        sections.push("**Recent States**:".to_string());
        for m in state_mems {
            sections.push(format!("- {}", m.content));
        }
    }
    if !hist_mems.is_empty() {
        sections.push("**Relevant History**:".to_string());
        for m in hist_mems {
            sections.push(format!("- {}", m.content));
        }
    }
    if !goal_mems.is_empty() {
        sections.push("**Active Goals**:".to_string());
        for m in goal_mems {
            sections.push(format!("- {}", m.content));
        }
    }
    if !pattern_mems.is_empty() {
        sections.push("**Patterns**:".to_string());
        for m in pattern_mems {
            sections.push(format!("- {}", m.content));
        }
    }

    Ok(sections.join("\n"))
}

/// Store classified memories from a conversation turn (background task).
async fn store_memories(
    user_message: &str,
    assistant_response: &str,
    turn_id: &str,
    api_key: &str,
) -> Result<(), String> {
    // Classify what to store
    let classified = storage_classifier::classify_storage(
        user_message,
        assistant_response,
        turn_id,
        api_key,
    )
    .await?;

    if classified.is_empty() {
        return Ok(());
    }

    // Store each classified memory
    for memory in classified {
        if let Err(e) = store::store_classified(&memory).await {
            eprintln!("Failed to store memory: {}", e);
        }
    }

    Ok(())
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
