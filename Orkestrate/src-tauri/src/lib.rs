mod ai;

use ai::handler::{chat_handler, generate_chat_title};
use axum::{routing::post, Router};
use tower_http::cors::CorsLayer;

use tauri::Manager;
use crate::ai::paths::APP_DATA_DIR;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file (from src-tauri/.env)
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, generate_chat_title])
        .setup(|app| {
            // Set global app data dir
            let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            let _ = APP_DATA_DIR.set(app_data_dir);

            // Spawn the embedded Axum AI server in a background task
            tauri::async_runtime::spawn(async {
                let cors = CorsLayer::permissive();

                let app = Router::new()
                    .route("/api/chat", post(chat_handler))
                    .layer(cors);

                let listener = tokio::net::TcpListener::bind("127.0.0.1:3001")
                    .await
                    .unwrap();
                println!("Embedded AI Server running on http://127.0.0.1:3001");
                axum::serve(listener, app).await.unwrap();
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
