mod ai;

use ai::handler::{chat_handler, generate_chat_title};
use axum::{routing::post, Router};
use std::path::PathBuf;
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use tower_http::cors::CorsLayer;
use url::Url;

use crate::ai::paths::APP_DATA_DIR;

fn process_auth_url(url_str: &str) {
    let parsed = match Url::parse(url_str) {
        Ok(u) => u,
        Err(_) => return,
    };
    // URL is orkestrate://auth/callback — "auth" is the host, path is "/callback"
    if parsed.host_str() != Some("auth") || parsed.path() != "/callback" {
        return;
    }
    let params: std::collections::HashMap<String, String> = parsed
        .query_pairs()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect();

    let access_token = match params.get("access_token") {
        Some(t) => t.clone(),
        None => return,
    };
    let refresh_token = params.get("refresh_token").cloned().unwrap_or_default();
    let expires_in: i64 = params.get("expires_in")
        .and_then(|s| s.parse().ok())
        .unwrap_or(3600);

    ai::auth::store_tokens(&access_token, &refresh_token, expires_in);
}

fn process_cli_args(args: &[String]) {
    let joined = args.join(" ");
    if let Some(start) = joined.find("orkestrate://") {
        let remaining = &joined[start..];
        let end = remaining.find(|c: char| c.is_whitespace()).unwrap_or(remaining.len());
        process_auth_url(&remaining[..end]);
    }
}

#[tauri::command]
async fn start_oauth() -> Result<String, String> {
    open::that("https://orkestrate.space/login?desktop=1")
        .map_err(|e| format!("Failed to open browser: {e}"))?;
    Ok("opened".to_string())
}

#[tauri::command]
async fn get_auth_state() -> Result<String, String> {
    if ai::auth::is_authenticated() {
        Ok("authenticated".to_string())
    } else {
        Ok("unauthenticated".to_string())
    }
}

#[tauri::command]
async fn get_user_info() -> Result<Option<serde_json::Value>, String> {
    match ai::auth::fetch_user_info().await {
        Some(info) => Ok(Some(serde_json::json!({
            "id": info.id,
            "email": info.email,
            "name": info.name,
            "avatar_url": info.avatar_url,
        }))),
        None => Ok(None),
    }
}

#[tauri::command]
async fn sign_out() -> Result<(), String> {
    ai::auth::sign_out();
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenvy::dotenv().ok();

    // Initialize auth with correct AppData path before Tauri builder setup.
    // This ensures the second instance (from deep link) writes to the right location.
    let local_appdata = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".to_string());
    let pre_app_data_dir = PathBuf::from(local_appdata).join("com.orkestrate.app");
    ai::auth::init(&pre_app_data_dir);
    let _ = APP_DATA_DIR.set(pre_app_data_dir);

    // Process deep link URL from CLI args (handles & splitting on Windows)
    let cmd_args: Vec<String> = std::env::args().skip(1).collect();
    if !cmd_args.is_empty() {
        process_cli_args(&cmd_args);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if !args.is_empty() {
                process_cli_args(&args);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            generate_chat_title,
            start_oauth,
            get_auth_state,
            get_user_info,
            sign_out,
        ])
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            let _ = APP_DATA_DIR.set(app_data_dir.clone());
            ai::auth::init(&app_data_dir);

            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    process_auth_url(url.as_str());
                }
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.emit("deep-link-auth", serde_json::json!({
                        "authenticated": true,
                    }));
                }
            });

            tauri::async_runtime::spawn(async {
                let cors = CorsLayer::permissive();
                let app = Router::new()
                    .route("/api/chat", post(chat_handler))
                    .layer(cors);

                let listener = tokio::net::TcpListener::bind("127.0.0.1:3001")
                    .await
                    .unwrap();
                axum::serve(listener, app).await.unwrap();
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
