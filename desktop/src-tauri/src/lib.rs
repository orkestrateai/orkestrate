mod ai;

use ai::handler::{
    chat_handler, generate_chat_title, memory_search_handler, memory_store_handler,
    update_profile_handler, memory_delete_handler, store_episode_handler,
};
use axum::{routing::{post, get}, Router};
use std::path::PathBuf;
use tauri::{Emitter, Manager, WebviewWindowBuilder, WebviewUrl};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_global_shortcut::ShortcutState;
use tower_http::cors::CorsLayer;
use url::Url;
#[cfg(target_os = "windows")]
use window_vibrancy::{apply_acrylic, clear_acrylic};
#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

use crate::ai::paths::APP_DATA_DIR;

fn process_auth_url(url_str: &str) {
    let parsed = match Url::parse(url_str) {
        Ok(u) => u,
        Err(_) => return,
    };
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
    let expires_in: i64 = params
        .get("expires_in")
        .and_then(|s| s.parse().ok())
        .unwrap_or(3600);

    ai::auth::store_tokens(&access_token, &refresh_token, expires_in);
}

fn process_cli_args(args: &[String]) {
    let joined = args.join(" ");
    if let Some(start) = joined.find("orkestrate://") {
        let remaining = &joined[start..];
        let end = remaining
            .find(|c: char| c.is_whitespace())
            .unwrap_or(remaining.len());
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

#[tauri::command]
async fn get_app_data_path() -> Result<String, String> {
    Ok(crate::ai::paths::get_app_data_dir()
        .to_string_lossy()
        .to_string())
}

#[tauri::command]
async fn set_window_theme(window: tauri::WebviewWindow, theme: String) {
    let t = match theme.as_str() {
        "light" => tauri::Theme::Light,
        _ => tauri::Theme::Dark,
    };
    let _ = window.set_theme(Some(t));

    #[cfg(target_os = "windows")]
    {
        if theme == "light" {
            let _ = clear_acrylic(&window);
        } else {
            let _ = apply_acrylic(&window, Some((18, 18, 18, 50)));
        }
    }
}

fn toggle_spotlight(app: &tauri::AppHandle) {
    if let Some(spotlight) = app.get_webview_window("spotlight") {
        if let Ok(visible) = spotlight.is_visible() {
            if visible {
                let _ = spotlight.hide();
            } else {
                let _ = spotlight.center();
                let _ = spotlight.show();
                let _ = spotlight.set_focus();
            }
        }
        return;
    }

    // Lazily create the spotlight window on first toggle
    // (creating it hidden causes ERR_NETWORK_IO_SUSPENDED on Windows)
    let spotlight = WebviewWindowBuilder::new(
        app,
        "spotlight",
        WebviewUrl::App("spotlight.html".into()),
    )
    .title("Orkestrate")
    .inner_size(640.0, 90.0)
    .min_inner_size(640.0, 90.0)
    .max_inner_size(640.0, 400.0)
    .decorations(false)
    .transparent(true)
    .skip_taskbar(true)
    .always_on_top(true)
    .shadow(false)
    .visible(true)
    .center()
    .build();

    match spotlight {
        Ok(w) => {
            // Auto-hide when clicking outside (focus loss)
            let w_clone = w.clone();
            w.on_window_event(move |event| {
                if let tauri::WindowEvent::Focused(false) = event {
                    let _ = w_clone.hide();
                }
            });
        }
        Err(e) => {
            println!("[spotlight] Failed to create window: {e}");
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenvy::dotenv().ok();

    let local_appdata = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".to_string());
    let pre_app_data_dir = PathBuf::from(local_appdata).join("com.orkestrate.app");
    ai::auth::init(&pre_app_data_dir);
    let _ = APP_DATA_DIR.set(pre_app_data_dir);

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
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts(["CommandOrControl+Shift+O"])
                .unwrap()
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        toggle_spotlight(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            generate_chat_title,
            start_oauth,
            get_auth_state,
            get_user_info,
            sign_out,
            get_app_data_path,
            set_window_theme,
        ])
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));
            let _ = APP_DATA_DIR.set(app_data_dir.clone());
            ai::auth::init(&app_data_dir);

            let window = app.get_webview_window("main").unwrap();

            let _ = window.set_theme(Some(tauri::Theme::Dark));

            #[cfg(target_os = "macos")]
            {
                match apply_vibrancy(&window, NSVisualEffectMaterial::Sidebar, None, None) {
                    Ok(_) => println!("[vibrancy] macOS vibrancy applied successfully"),
                    Err(e) => println!("[vibrancy] macOS vibrancy failed: {e}"),
                }
            }

            // Close behavior: on macOS, let the system handle Cmd+Q / red X naturally.
            // On Windows/Linux, hide to tray instead of closing.
            let main_clone = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    #[cfg(not(target_os = "macos"))]
                    {
                        api.prevent_close();
                        let _ = main_clone.hide();
                    }
                    // On macOS, allow the close — app stays in Dock, Cmd+Q quits naturally
                }
            });

            // macOS native menu bar
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{Menu, Submenu, MenuItem, PredefinedMenuItem};
                let app_menu = Submenu::with_items(app, "Orkestrate", true, &[
                    &MenuItem::with_id(app, "about", "About Orkestrate", true, None::<&str>)?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "hide", "Hide Orkestrate", true, Some("Cmd+H"))?,
                    &MenuItem::with_id(app, "hide_others", "Hide Others", true, Some("Cmd+Alt+H"))?,
                    &MenuItem::with_id(app, "show_all", "Show All", true, None::<&str>)?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "quit", "Quit Orkestrate", true, Some("Cmd+Q"))?,
                ])?;
                let file_menu = Submenu::with_items(app, "File", true, &[
                    &MenuItem::with_id(app, "close_window", "Close Window", true, Some("Cmd+W"))?,
                ])?;
                let window_menu = Submenu::with_items(app, "Window", true, &[
                    &MenuItem::with_id(app, "minimize", "Minimize", true, Some("Cmd+M"))?,
                ])?;
                let menu = Menu::with_items(app, &[
                    &app_menu,
                    &file_menu,
                    &window_menu,
                ])?;
                app.set_menu(menu)?;

                // Handle menu events
                app.on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "about" => { /* could open about dialog */ }
                        "hide" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.hide();
                            }
                        }
                        "hide_others" => { /* macOS handles this natively */ }
                        "show_all" => { /* macOS handles this natively */ }
                        "quit" => { app.exit(0); }
                        "close_window" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.close();
                            }
                        }
                        "minimize" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.minimize();
                            }
                        }
                        _ => {}
                    }
                });
            }

            // System tray
            use tauri::menu::{Menu, MenuItemBuilder, PredefinedMenuItem};
            let open_i = MenuItemBuilder::new("Open Orkestrate")
                .id("open")
                .build(app)?;
            let spotlight_i = MenuItemBuilder::new("Quick Chat")
                .id("spotlight")
                .build(app)?;
            let quit_i = MenuItemBuilder::new("Quit")
                .id("quit")
                .build(app)?;
            let tray_menu = Menu::with_items(
                app,
                &[
                    &open_i,
                    &spotlight_i,
                    &PredefinedMenuItem::separator(app)?,
                    &quit_i,
                ],
            )?;

            let mut tray_builder = tauri::tray::TrayIconBuilder::new();
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }
            tray_builder
                .menu(&tray_menu)
                .on_menu_event(|app: &tauri::AppHandle, event| {
                    match event.id.as_ref() {
                        "open" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "spotlight" => {
                            toggle_spotlight(app);
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|_tray: &tauri::tray::TrayIcon, event| {
                    use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(w) = _tray.app_handle().get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    process_auth_url(url.as_str());
                }
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.emit(
                        "deep-link-auth",
                        serde_json::json!({
                            "authenticated": true,
                        }),
                    );
                }
            });

            tauri::async_runtime::spawn(async {
                let cors = CorsLayer::permissive();
                let app = Router::new()
                    .route("/api/chat", post(chat_handler))
                    .route("/api/tool/memory-search", post(memory_search_handler))
                    .route("/api/tool/memory-store", post(memory_store_handler))
                    .route("/api/tool/memory-delete", post(memory_delete_handler))
                    .route("/api/tool/update-profile", post(update_profile_handler))
                    .route("/api/tool/store-episode", post(store_episode_handler))
                    .route("/api/health", get(|| async { "ok" }))
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
