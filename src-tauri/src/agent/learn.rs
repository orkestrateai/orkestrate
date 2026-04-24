use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::Emitter;

use crate::db;
use crate::timer::Timer;
use crate::HistoryMessage;

const API_BASE: &str = "https://opencode.ai/zen/v1/chat/completions";

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<serde_json::Value>,
    stream: bool,
    max_tokens: i32,
}

#[derive(Deserialize, Debug)]
struct StreamChoice {
    delta: StreamDelta,
}

#[derive(Deserialize, Debug, Default)]
struct StreamDelta {
    content: Option<String>,
}

#[derive(Deserialize, Debug)]
struct StreamChunk {
    choices: Vec<StreamChoice>,
}

/// Run the learn agent loop — a focused interview to resolve gaps and contradictions.
pub async fn run_learn_agent(
    window: tauri::Window,
    request_id: String,
    history: Vec<HistoryMessage>,
    api_key: String,
) -> Result<(), String> {
    let _agent_timer = Timer::new(&format!("run_learn_agent | req={}", request_id));
    let client = reqwest::Client::new();

    let pending_items = db::load_pending_learn_items(10).unwrap_or_default();
    let agenda = build_agenda(&pending_items);

    let system_prompt = format!(
        r#"You are Orkestrate. You are having a focused conversation to clarify things you don't fully understand.

CURRENT AGENDA:
{}

Rules:
- Work through the agenda naturally. Don't read it like a list.
- Ask one thing at a time. Let the user answer fully before moving on.
- If the user goes off-topic, follow briefly, then gently return.
- If the user gives vague or unclear answers, probe once. If still unclear, note what you can and move on.
- When the agenda is complete, say something warm and close the conversation.
- Do NOT explain that you are "in learning mode" or mention the agenda explicitly.
- Be brief. One or two sentences per response."#,
        agenda
    );

    let mut messages = vec![json!({
        "role": "system",
        "content": system_prompt
    })];

    for msg in &history {
        messages.push(json!({
            "role": msg.role,
            "content": msg.content
        }));
    }

    // If starting fresh (empty history), inject a synthetic user message so the
    // model has a clear conversational hook to respond to.
    if history.is_empty() {
        messages.push(json!({
            "role": "user",
            "content": "Go ahead — what's your first question?"
        }));
    }

    let request = ChatRequest {
        model: "minimax-m2.5-free".to_string(),
        messages,
        stream: true,
        max_tokens: 2048,
    };

    let response = client
        .post(API_BASE)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Learn agent request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Learn agent API Error {}: {}", status, body));
    }

    let mut stream = response.bytes_stream();
    let mut partial_line = String::new();
    let mut full_response = String::new();
    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);
        partial_line.push_str(&text);

        while let Some(pos) = partial_line.find('\n') {
            let line = partial_line[..pos].trim().to_string();
            partial_line = partial_line[pos + 1..].to_string();

            if line.starts_with("data: ") {
                let data = &line[6..];
                if data == "[DONE]" {
                    continue;
                }
                if let Ok(chunk) = serde_json::from_str::<StreamChunk>(data) {
                    if let Some(choice) = chunk.choices.first() {
                        if let Some(content) = &choice.delta.content {
                            full_response.push_str(content);
                            let _ = window.emit(
                                "learn-chunk",
                                json!({ "requestId": request_id, "content": content }),
                            );
                        }
                    }
                }
            }
        }
    }

    // Persist the assistant response so the conversation survives panel close/reopen.
    if !full_response.is_empty() {
        let _ = db::store_message("__learn__", "assistant", &full_response, None, None);
    }

    let _ = window.emit("learn-done", json!({ "requestId": request_id }));
    Ok(())
}

/// Generate a single learn question without streaming. Used for background pre-generation.
/// Saves the response to the __learn__ message history.
pub async fn generate_learn_question(
    history: Vec<HistoryMessage>,
    api_key: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let pending_items = db::load_pending_learn_items(10).unwrap_or_default();
    let agenda = build_agenda(&pending_items);

    let system_prompt = format!(
        r#"You are Orkestrate. You are having a focused conversation to clarify things you don't fully understand.

CURRENT AGENDA:
{}

Rules:
- Work through the agenda naturally. Don't read it like a list.
- Ask one thing at a time. Let the user answer fully before moving on.
- If the user goes off-topic, follow briefly, then gently return.
- If the user gives vague or unclear answers, probe once. If still unclear, note what you can and move on.
- When the agenda is complete, say something warm and close the conversation.
- Do NOT explain that you are "in learning mode" or mention the agenda explicitly.
- Be brief. One or two sentences per response."#,
        agenda
    );

    let mut messages = vec![json!({
        "role": "system",
        "content": system_prompt
    })];

    for msg in &history {
        messages.push(json!({
            "role": msg.role,
            "content": msg.content
        }));
    }

    // If starting fresh (empty history), inject a synthetic user message
    if history.is_empty() {
        messages.push(json!({
            "role": "user",
            "content": "Go ahead — what's your first question?"
        }));
    }

    let request = ChatRequest {
        model: "minimax-m2.5-free".to_string(),
        messages,
        stream: false,
        max_tokens: 2048,
    };

    let response = client
        .post(API_BASE)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Learn question generation failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Learn question generation API Error {}: {}", status, body));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Learn question generation JSON parse error: {}", e))?;

    let content = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim();

    if !content.is_empty() {
        let _ = db::store_message("__learn__", "assistant", content, None, None);
    }

    Ok(content.to_string())
}

fn build_agenda(items: &[db::LearnQueueItem]) -> String {
    if items.is_empty() {
        return "(No items remaining — the user is all caught up. Wrap up warmly.)".to_string();
    }

    items
        .iter()
        .enumerate()
        .map(|(i, item)| {
            format!(
                "{}. [{}] {}",
                i + 1,
                item.type_,
                item.question
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}
