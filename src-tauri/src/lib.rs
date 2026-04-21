use serde::{Deserialize, Serialize};
use tauri::{image::Image, Manager};

mod agent;
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

// ─── Tauri App Entry ───────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![chat_opencode])
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
