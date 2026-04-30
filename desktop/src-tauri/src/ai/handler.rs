use crate::ai::memory::ChatMemoryService;
use crate::ai::memory::types::PersonalEntry;
use crate::ai::paths::get_app_data_dir;
use axum::{body::{Body, Bytes}, extract::Json as AxumJson, http::StatusCode, response::Response, Json};
use futures::StreamExt;
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};

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

// ─── Helpers ──────────────────────────────────────────────────────────────

static MEMORY_SERVICE: OnceCell<ChatMemoryService> = OnceCell::new();

fn get_memory_service() -> &'static ChatMemoryService {
    MEMORY_SERVICE.get_or_init(|| ChatMemoryService::new(get_app_data_dir()))
}

fn temporal_context() -> String {
    format!(
        "[TEMPORAL CONTEXT]\nCurrent time: {}\nDay of week: {}\nDate: {}[/TEMPORAL CONTEXT]",
        chrono::Local::now().format("%H:%M"),
        chrono::Local::now().format("%A"),
        chrono::Local::now().format("%Y-%m-%d"),
    )
}

fn environment_block() -> String {
    format!(
        "[ENVIRONMENT]\nPlatform: {}\n[/ENVIRONMENT]",
        std::env::consts::OS,
    )
}

// ─── Chat Handler ─────────────────────────────────────────────────────────

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
    let recent_episodes = get_memory_service().manager().get_recent_episodes(3).unwrap_or_default();

    // Pre-fetch relevant memories from the user's message
    let pre_fetched_memories = {
        let query = &user_message;
        let queries = if query.len() > 5 {
            vec![query.to_string()]
        } else {
            vec![]
        };
        match get_memory_service().manager().search(queries) {
            Ok(results) if !results.is_empty() => {
                let mut block = String::from("\n[RELEVANT MEMORIES]\n");
                for (i, r) in results.iter().take(5).enumerate() {
                    block.push_str(&format!("{}. [{}] {} (confidence: {:.0}%)\n",
                        i + 1, format!("{:?}", r.memo_type).to_lowercase(), r.content, r.confidence * 100.0));
                }
                block.push_str("[/RELEVANT MEMORIES]\n");
                block
            }
            _ => String::new(),
        }
    };

    // Build system prompt with pre-fetched memories
    let system_prompt = format!(
        "{}\n{}\n{}\n{}\n{}{}\n{}",
        PERSONA_PROMPT, user_profile, previous_session_context, recent_episodes,
        pre_fetched_memories, environment_block(), temporal_context(),
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

    // Background: save session + trigger memory extraction agent
    let sid = session_id.clone();
    let app_dir = get_app_data_dir();
    tokio::spawn(async move {
        let mut swm = crate::ai::memory::session::SESSION_REGISTRY
            .entry(sid.clone())
            .or_insert_with(|| crate::ai::memory::session::SessionWorkingMemory::new(&sid));

        swm.summary = crate::ai::memory::session::summarize_session(&swm.recent_turns);
        crate::ai::memory::session::save_session_context(&app_dir, &swm);
        get_memory_service().manager().store_episode(&sid, &swm.summary, &swm.extracted_facts).ok();

        // Trigger background memory extraction agent
        let turns: Vec<serde_json::Value> = swm.recent_turns.iter().map(|t| {
            serde_json::json!({ "role": t.role, "content": t.content })
        }).collect();

        let token = match crate::ai::auth::get_valid_access_token().await {
            Some(t) => t,
            None => return,
        };

        let profile_block = get_memory_service().get_user_profile();

        let client = reqwest::Client::new();
        let _ = client
            .post("http://localhost:3000/api/memory")
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({
                "turns": turns,
                "profile": profile_block,
                "session_id": sid,
            }))
            .send()
            .await;
    });

    let mut response_builder = Response::builder().status(status);
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

// ─── Memory Tool Handlers ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct MemorySearchRequest {
    pub queries: Vec<String>,
}

pub async fn memory_search_handler(
    AxumJson(request): AxumJson<MemorySearchRequest>,
) -> Result<Json<Vec<serde_json::Value>>, (StatusCode, String)> {
    let results = get_memory_service().manager().search(request.queries)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Memory search error: {}", e)))?;

    Ok(Json(results.into_iter().map(|r| serde_json::json!({
        "id": r.id,
        "title": r.title,
        "content": r.content,
        "score": r.score.to_string(),
        "type": format!("{:?}", r.memo_type).to_lowercase(),
        "confidence": r.confidence,
        "people": r.people,
        "topics": r.topics,
    })).collect()))
}

#[derive(Debug, Deserialize)]
pub struct MemoryStoreRequest {
    pub content: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub entities: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub memo_type: String,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub people: Vec<String>,
    #[serde(default)]
    pub places: Vec<String>,
    #[serde(default)]
    pub topics: Vec<String>,
    #[serde(default)]
    pub session_id: String,
}

pub async fn memory_store_handler(
    AxumJson(request): AxumJson<MemoryStoreRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
    let title = if request.title.is_empty() {
        request.content.chars().take(80).collect::<String>()
    } else {
        request.title
    };

    // Check for UPSERT — if a matching entry exists by title, update instead
    let existing = {
        let svc = get_memory_service();
        let facts = svc.manager().search(vec![title.clone()]).unwrap_or_default();
        facts.into_iter().find(|f| f.title.to_lowercase() == title.to_lowercase())
    };

    let (operation, applied_id) = if let Some(prev) = existing {
        // UPDATE existing entry (UPSERT)
        let entry = PersonalEntry {
            id: prev.id.clone(),
            title: title.clone(),
            summary: String::new(),
            content: request.content,
            memo_type: parse_memo_type(&request.memo_type),
            source: parse_memo_source(&request.source),
            confidence: 1.0,
            session_id: request.session_id,
            people: if !request.people.is_empty() { request.people } else { request.entities },
            places: request.places,
            topics: request.topics,
            tags: request.tags,
            importance: (prev.confidence * 100.0).min(95.0) + 5.0,
            maturity: crate::ai::memory::types::MaturityTier::Draft,
            access_count: 0,
            last_accessed: chrono::Utc::now().timestamp_millis(),
            created_at: String::new(), // will default to now in manager
            updated_at: now,
            expires_at: None,
        };
        get_memory_service().manager().store_entry(&entry)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Memory update error: {}", e)))?;
        ("UPDATE", entry.id)
    } else {
        // ADD new entry
        let entry = PersonalEntry {
            id: format!("mem_{}", chrono::Utc::now().timestamp_millis()),
            title,
            summary: String::new(),
            content: request.content,
            memo_type: parse_memo_type(&request.memo_type),
            source: parse_memo_source(&request.source),
            confidence: 1.0,
            session_id: request.session_id,
            people: if !request.people.is_empty() { request.people } else { request.entities },
            places: request.places,
            topics: request.topics,
            tags: request.tags,
            importance: 0.0,
            maturity: crate::ai::memory::types::MaturityTier::Draft,
            access_count: 0,
            last_accessed: 0,
            created_at: now.clone(),
            updated_at: now,
            expires_at: None,
        };
        get_memory_service().manager().store_entry(&entry)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Memory store error: {}", e)))?;
        ("ADD", entry.id)
    };

    Ok(Json(serde_json::json!({
        "applied": [{"type": operation, "id": applied_id, "status": "success"}],
        "summary": {"added": if operation == "ADD" { 1 } else { 0 }, "updated": if operation == "UPDATE" { 1 } else { 0 }, "deleted": 0, "failed": 0}
    })))
}

#[derive(Debug, Deserialize)]
pub struct ProfileUpdateRequest {
    pub field: String,
    pub value: String,
}

pub async fn update_profile_handler(
    AxumJson(request): AxumJson<ProfileUpdateRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    get_memory_service().manager().update_profile_field(&request.field, &request.value)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Profile update error: {}", e)))?;

    Ok(Json(serde_json::json!({ "updated": true, "field": request.field })))
}

#[derive(Debug, Deserialize)]
pub struct MemoryDeleteRequest {
    pub id: String,
}

pub async fn memory_delete_handler(
    AxumJson(request): AxumJson<MemoryDeleteRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    get_memory_service().manager().delete_entry(&request.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Memory delete error: {}", e)))?;

    Ok(Json(serde_json::json!({ "deleted": true, "id": request.id })))
}

#[derive(Debug, Deserialize)]
pub struct EpisodeExtractRequest {
    pub session_id: String,
    pub summary: String,
    pub facts_extracted: Vec<String>,
}

pub async fn store_episode_handler(
    AxumJson(request): AxumJson<EpisodeExtractRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    get_memory_service().manager().store_episode(&request.session_id, &request.summary, &request.facts_extracted)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Episode store error: {}", e)))?;

    Ok(Json(serde_json::json!({ "stored": true })))
}

// ─── Title Generation ─────────────────────────────────────────────────────
// Fast heuristic (0ms) — the LLM can generate better titles via the agent,
// but this serves as the instant UI fallback while the agent response streams.

fn fast_title(user_message: &str) -> String {
    let text = user_message.trim();
    if text.is_empty() { return "New Chat".to_string(); }

    // Take the first sentence or first 60 chars, whichever is shorter
    let first_sentence = text
        .split(|c: char| c == '.' || c == '?' || c == '!' || c == '\n')
        .next()
        .unwrap_or(text)
        .trim();

    let truncated: String = first_sentence.chars().take(60).collect();
    if truncated.len() < first_sentence.len() {
        format!("{}...", truncated.trim())
    } else {
        first_sentence.to_string()
    }
}

#[tauri::command]
pub async fn generate_chat_title(
    user_message: String,
    _assistant_message: Option<String>,
) -> Result<String, String> {
    Ok(fast_title(&user_message))
}

// ─── Helpers ──────────────────────────────────────────────────────────────

fn parse_memo_type(s: &str) -> crate::ai::memory::types::MemoType {
    use crate::ai::memory::types::MemoType;
    match s {
        "preference" => MemoType::Preference,
        "episode" => MemoType::Episode,
        "task" => MemoType::Task,
        "relationship" => MemoType::Relationship,
        "context" => MemoType::Context,
        "insight" => MemoType::Insight,
        _ => MemoType::Fact,
    }
}

fn parse_memo_source(s: &str) -> crate::ai::memory::types::MemoSource {
    use crate::ai::memory::types::MemoSource;
    match s {
        "inferred" => MemoSource::Inferred,
        "derived" => MemoSource::Derived,
        _ => MemoSource::Explicit,
    }
}
