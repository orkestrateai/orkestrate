use crate::ai::memory::ChatMemoryService;
use crate::ai::paths::get_app_data_dir;
use axum::{body::{Body, Bytes}, http::StatusCode, response::Response, Json};
use futures::StreamExt;
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use tokio::task_local;

const PERSONA_PROMPT: &str = include_str!("../../orkestrate.txt");

// ─── Types matching Vercel AI SDK UI ──────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    #[serde(default)]
    pub parts: Vec<MessagePart>,
}

#[derive(Debug, Deserialize)]
pub struct MessagePart {
    #[serde(rename = "type")]
    pub part_type: String,
    pub text: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub id: Option<String>,
    pub messages: Vec<ChatMessage>,
}

#[derive(Debug, Serialize)]
struct ChatPayload {
    messages: Vec<ChatPayloadMessage>,
    model: String,
}

#[derive(Debug, Serialize)]
struct ChatPayloadMessage {
    role: String,
    content: Vec<ContentBlock>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
enum ContentBlock {
    #[serde(rename = "text")]
    Text { text: String },
}

// ─── Helpers ────────────────────────────────────────────────────────────

task_local! {
    pub static SESSION_ID: String;
}

static MEMORY_SERVICE: OnceCell<ChatMemoryService> = OnceCell::new();

fn get_memory_service() -> &'static ChatMemoryService {
    MEMORY_SERVICE.get_or_init(|| ChatMemoryService::new(get_app_data_dir()))
}

fn temporal_context() -> String {
    format!(
        "[TEMPORAL CONTEXT]\nCurrent time: {}\nDay of week: {}\nDate: {}\n[/TEMPORAL CONTEXT]",
        chrono::Local::now().format("%H:%M"),
        chrono::Local::now().format("%A"),
        chrono::Local::now().format("%Y-%m-%d"),
    )
}

fn environment_block() -> String {
    format!(
        "[ENVIRONMENT]\nPlatform: {}\nWorking directory: {}\n[/ENVIRONMENT]",
        std::env::consts::OS,
        std::env::current_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_default(),
    )
}

// ─── Chat Handler ───────────────────────────────────────────────────────

pub async fn chat_handler(
    Json(request): Json<ChatRequest>,
) -> Result<Response, (StatusCode, String)> {
    let session_id = request.id.clone().unwrap_or_else(|| "default".to_string());

    let user_message: String = request.messages.iter()
        .rev()
        .find(|m| m.role == "user")
        .and_then(|m| m.parts.first())
        .and_then(|p| p.text.clone())
        .unwrap_or_default();

    // Update SWM
    {
        let mut swm = crate::ai::memory::session::SESSION_REGISTRY
            .entry(session_id.clone())
            .or_insert_with(|| crate::ai::memory::session::SessionWorkingMemory::new(&session_id));
        swm.add_turn("user", &user_message);
    }

    let user_profile = get_memory_service().get_user_profile();
    let previous_session_context = crate::ai::memory::session::load_previous_session_context(&get_app_data_dir());

    // Build system prompt
    let system_prompt = format!(
        "{}\n\n{}\n\n{}\n\n{}\n\n{}",
        PERSONA_PROMPT, user_profile, previous_session_context, environment_block(), temporal_context(),
    );

    // Convert messages for API
    let api_messages: Vec<ChatPayloadMessage> = request.messages.iter().map(|m| {
        let text = m.parts.iter()
            .filter(|p| p.part_type == "text" && p.text.is_some())
            .map(|p| p.text.clone().unwrap())
            .collect::<Vec<_>>()
            .join("\n");
        ChatPayloadMessage {
            role: m.role.clone(),
            content: vec![ContentBlock::Text { text }],
        }
    }).collect();

    let payload = serde_json::json!({
        "messages": api_messages,
        "system": system_prompt,
    });

    let token = match crate::ai::auth::get_valid_access_token().await {
        Some(t) => t,
        None => {
            return Err((StatusCode::UNAUTHORIZED, "Not authenticated or token refresh failed".to_string()));
        }
    };
    let client = reqwest::Client::new();

    let resp = client
        .post("https://orkestrate.space/api/chat")
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Chat API unreachable: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err((StatusCode::BAD_GATEWAY, format!("Chat API error {}: {}", status, body)));
    }

    // Forward raw stream bytes directly — no SSE re-wrapping
    let status = resp.status();
    let headers = resp.headers().clone();
    let stream = resp.bytes_stream().map(|result| {
        match result {
            Ok(bytes) => Ok::<_, std::convert::Infallible>(bytes),
            Err(e) => {
                eprintln!("[chat] stream error: {}", e);
                Ok(Bytes::new())
            }
        }
    });

    // Background: save session
    let sid = session_id.clone();
    let user_msg = user_message.clone();
    let app_dir = get_app_data_dir();
    tokio::spawn(async move {
        let mut swm = crate::ai::memory::session::SESSION_REGISTRY
            .entry(sid.clone())
            .or_insert_with(|| crate::ai::memory::session::SessionWorkingMemory::new(&sid));
        swm.add_turn("assistant", &user_msg);
        swm.summary = crate::ai::memory::session::summarize_session(&swm.recent_turns);
        crate::ai::memory::session::save_session_context(&app_dir, &swm);
    });

    let mut response_builder = Response::builder().status(status);
    // Forward important headers from the website
    for (key, value) in headers.iter() {
        if let Ok(name) = axum::http::header::HeaderName::from_bytes(key.as_ref()) {
            let name_str = name.as_str().to_lowercase();
            if name_str == "content-type" 
                || name_str == "cache-control"
                || name_str == "connection"
                || name_str.starts_with("x-") {
                response_builder = response_builder.header(name, value);
            }
        }
    }

    response_builder
        .body(Body::from_stream(stream))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Response build error: {}", e)))
}

// ─── Title Generation ───────────────────────────────────────────────────

const BANNED_TITLE_WORDS: &[&str] = &[
    "greeting", "hello", "hi", "hey", "chat", "discussion", "conversation",
    "introduction", "welcome", "question", "inquiry", "query", "request",
    "message", "new", "untitled", "general", "miscellaneous", "misc",
    "unknown", "undefined", "none", "no title", "placeholder", "talk",
    "dialogue", "exchange", "interaction", "session", "update",
];

fn is_title_banned(title: &str) -> bool {
    let lower = title.to_lowercase();
    BANNED_TITLE_WORDS.iter().any(|&w| lower.contains(w))
}

fn heuristic_title(user_message: &str) -> String {
    let stop_words: &[&str] = &[
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "must", "shall", "can", "need", "to", "of",
        "in", "for", "on", "with", "at", "by", "from", "as", "into", "through",
        "during", "before", "after", "above", "below", "between", "under",
        "and", "but", "or", "yet", "so", "if", "because", "although", "though",
        "while", "where", "when", "that", "which", "who", "whom", "whose",
        "what", "this", "these", "those", "i", "you", "he", "she", "it", "we",
        "they", "me", "him", "her", "us", "them", "my", "your", "his", "its",
        "our", "their", "am", "just", "only", "also", "even", "still",
        "already", "yet", "too", "very", "really", "quite", "about", "how",
    ];

    let words: Vec<&str> = user_message.split_whitespace()
        .filter(|w| {
            let clean = w.trim_matches(|c: char| !c.is_alphanumeric());
            !clean.is_empty() && !stop_words.contains(&clean.to_lowercase().as_str()) && clean.len() > 2
        })
        .take(4)
        .collect();

    if words.is_empty() {
        return "New Chat".to_string();
    }

    words.iter().map(|w| {
        let mut chars = w.chars();
        match chars.next() {
            None => String::new(),
            Some(first) => format!("{}{}", first.to_uppercase(), chars.collect::<String>().to_lowercase()),
        }
    }).collect::<Vec<_>>().join(" ")
}

#[tauri::command]
pub async fn generate_chat_title(
    user_message: String,
    _assistant_message: Option<String>,
) -> Result<String, String> {
    let title = heuristic_title(&user_message);
    if is_title_banned(&title) {
        Ok("New Chat".to_string())
    } else {
        Ok(title)
    }
}
