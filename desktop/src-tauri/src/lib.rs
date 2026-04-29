mod ai;

use ai::handler::{chat_handler, generate_chat_title};
use axum::{routing::post, Router};
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use tower_http::cors::CorsLayer;

use crate::ai::paths::APP_DATA_DIR;

#[tauri::command]
async fn start_oauth() -> Result<String, String> {
    let url = "https://orkestrate.space/login?desktop_redirect=orkestrate://auth/callback";
    open::that(url).map_err(|e| format!("Failed to open browser: {e}"))?;
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

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
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

            // Deep link handler — processes orkestrate://auth/callback URLs
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for parsed in event.urls() {
                    if parsed.path() != "/auth/callback" {
                        continue;
                    }
                    let params: std::collections::HashMap<String, String> = parsed
                        .query_pairs()
                        .map(|(k, v)| (k.to_string(), v.to_string()))
                        .collect();

                    if let Some(access_token) = params.get("access_token") {
                        let refresh_token = params.get("refresh_token")
                            .cloned()
                            .unwrap_or_default();
                        let expires_in: i64 = params.get("expires_in")
                            .and_then(|s| s.parse().ok())
                            .unwrap_or(3600);

                        ai::auth::store_tokens(access_token, &refresh_token, expires_in);

                        if let Some(window) = handle.get_webview_window("main") {
                            let _ = window.emit("deep-link-auth", serde_json::json!({
                                "authenticated": true,
                            }));
                        }
                    }
                }
            });

            // Embedded Axum server — chat proxy only
            tauri::async_runtime::spawn(async {
                let cors = CorsLayer::permissive();
                let app = Router::new()
                    .route("/api/chat", post(chat_handler))
                    .layer(cors);

                let listener = tokio::net::TcpListener::bind("127.0.0.1:3001")
                    .await
                    .unwrap();
                println!("Orkestrate server running on http://127.0.0.1:3001");
                axum::serve(listener, app).await.unwrap();
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
