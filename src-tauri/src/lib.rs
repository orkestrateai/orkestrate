use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{image::Image, Manager};

mod agent;
mod agents;
mod memory;
mod tools;

// ─── Event Payload Types ───────────────────────────────────────────────

#[derive(Serialize, Clone)]
struct ToolCallEvent {
    request_id: String,
    tool: String,
    args: serde_json::Value,
    id: String,
}

#[derive(Serialize, Clone)]
struct ToolResultEvent {
    request_id: String,
    tool: String,
    result: String,
    id: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct HistoryMessage {
    pub role: String,
    pub content: String,
}

// ─── Tauri Commands ────────────────────────────────────────────────────

#[tauri::command]
async fn chat_opencode(
    window: tauri::Window,
    request_id: String,
    history: Vec<HistoryMessage>,
    model: Option<String>,
) -> Result<(), String> {
    dotenvy::dotenv().ok();
    let api_key =
        std::env::var("OPENCODE_ZEN_API_KEY").map_err(|_| "OPENCODE_ZEN_API_KEY not set")?;

    let selected_model = model.unwrap_or_else(|| "nemotron-3-super-free".to_string());

    println!(
        ">>> Starting agent loop for request: {} | model: {}",
        request_id, selected_model
    );

    agent::run_agent(window, request_id, history, selected_model, api_key).await
}

#[tauri::command]
fn get_memories() -> Result<serde_json::Value, String> {
    let conn = memory::schema::get_db().map_err(|e| format!("db failed: {}", e))?;

    let mut entities = Vec::new();
    let mut stmt = conn.prepare("SELECT name, type, profile, mention_count, last_seen FROM entities ORDER BY mention_count DESC LIMIT 50")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(json!({
            "name": row.get::<_, String>(0)?,
            "type": row.get::<_, String>(1)?,
            "profile": row.get::<_, String>(2)?,
            "mentions": row.get::<_, i32>(3)?,
            "last_seen": row.get::<_, String>(4)?
        }))
    }).map_err(|e| e.to_string())?;
    for row in rows {
        if let Ok(r) = row { entities.push(r); }
    }

    let mut history = Vec::new();
    let mut stmt = conn.prepare("SELECT description, timestamp, emotional_valence FROM history ORDER BY timestamp DESC LIMIT 50")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(json!({
            "description": row.get::<_, String>(0)?,
            "timestamp": row.get::<_, String>(1)?,
            "valence": row.get::<_, String>(2)?
        }))
    }).map_err(|e| e.to_string())?;
    for row in rows {
        if let Ok(r) = row { history.push(r); }
    }

    let mut goals = Vec::new();
    let mut stmt = conn.prepare("SELECT description, status, priority FROM goals WHERE status = 'active' ORDER BY priority DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(json!({
            "description": row.get::<_, String>(0)?,
            "status": row.get::<_, String>(1)?,
            "priority": row.get::<_, i32>(2)?
        }))
    }).map_err(|e| e.to_string())?;
    for row in rows {
        if let Ok(r) = row { goals.push(r); }
    }

    let mut patterns = Vec::new();
    let mut stmt = conn.prepare("SELECT description, pattern_type, confidence FROM patterns ORDER BY confidence DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(json!({
            "description": row.get::<_, String>(0)?,
            "type": row.get::<_, String>(1)?,
            "confidence": row.get::<_, f64>(2)?
        }))
    }).map_err(|e| e.to_string())?;
    for row in rows {
        if let Ok(r) = row { patterns.push(r); }
    }

    Ok(json!({
        "entities": entities,
        "history": history,
        "goals": goals,
        "patterns": patterns
    }))
}

#[tauri::command]
fn consolidate_memories() -> Result<serde_json::Value, String> {
    let doc = memory::sigma::compile_life_document()?;
    Ok(doc)
}

// ─── Tauri App Entry ───────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![chat_opencode, get_memories, consolidate_memories])
        .setup(|app| {
            // Force the window icon at runtime to bypass Windows taskbar caching
            if let Some(window) = app.get_webview_window("main") {
                let icon_bytes = include_bytes!("../icons/icon.png");
                if let Ok(icon) = Image::from_bytes(icon_bytes) {
                    let _ = window.set_icon(icon);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
