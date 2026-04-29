use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

static TOKENS: OnceCell<std::sync::Mutex<Option<Tokens>>> = OnceCell::new();

const SUPABASE_URL: &str = "https://zydapvkiwfnxppzeydct.supabase.co";
const SUPABASE_ANON_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5ZGFwdmtpd2ZueHBwemV5ZGN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDEyMTAsImV4cCI6MjA4MTM3NzIxMH0.3aUJEHG9g0TJwEX-AlRQZyANe0v28SVpbaOrAzYZ9WU";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct UserInfo {
    pub id: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RefreshResponse {
    access_token: String,
    refresh_token: String,
    expires_in: i64,
    #[serde(default)]
    expires_at: Option<i64>,
}

pub fn init(app_data_dir: &PathBuf) {
    let tokens_file = app_data_dir.join("session.json");
    let loaded = std::fs::read_to_string(&tokens_file)
        .ok()
        .and_then(|s| serde_json::from_str::<Tokens>(&s).ok());
    TOKENS.set(std::sync::Mutex::new(loaded)).ok();
}

fn tokens_file() -> PathBuf {
    crate::ai::paths::get_app_data_dir().join("session.json")
}

fn save_tokens(t: &Tokens) {
    if let Ok(json) = serde_json::to_string_pretty(t) {
        let _ = std::fs::write(tokens_file(), json);
    }
}

pub fn store_tokens(access_token: &str, refresh_token: &str, expires_in: i64) {
    let tokens = Tokens {
        access_token: access_token.to_string(),
        refresh_token: refresh_token.to_string(),
        expires_at: chrono::Utc::now().timestamp() + expires_in,
    };
    save_tokens(&tokens);
    if let Some(lock) = TOKENS.get() {
        if let Ok(mut guard) = lock.lock() {
            *guard = Some(tokens);
        }
    }
}

fn is_expired(t: &Tokens) -> bool {
    let now = chrono::Utc::now().timestamp();
    // Consider expired 60 seconds before actual expiry to avoid race conditions
    now >= t.expires_at - 60
}

async fn do_refresh(refresh_token: &str) -> Option<Tokens> {
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/auth/v1/token?grant_type=refresh_token", SUPABASE_URL))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "refresh_token": refresh_token }))
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        eprintln!("[auth] refresh failed: HTTP {}", resp.status());
        return None;
    }

    let data: RefreshResponse = resp.json().await.ok()?;
    let expires_in = data.expires_in;
    let tokens = Tokens {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: chrono::Utc::now().timestamp() + expires_in,
    };
    save_tokens(&tokens);
    eprintln!("[auth] Token refreshed successfully");
    Some(tokens)
}

pub async fn get_valid_access_token() -> Option<String> {
    let lock = TOKENS.get()?;

    // Scope 1: check expiry and clone refresh token if needed
    let needs_refresh = {
        let guard = lock.lock().ok()?;
        let tokens = guard.as_ref()?;
        if is_expired(tokens) {
            Some(tokens.refresh_token.clone())
        } else {
            None
        }
    };

    if let Some(refresh_token) = needs_refresh {
        eprintln!("[auth] Token expired, refreshing...");
        match do_refresh(&refresh_token).await {
            Some(new_tokens) => {
                let token = new_tokens.access_token.clone();
                let mut guard = lock.lock().ok()?;
                *guard = Some(new_tokens);
                Some(token)
            }
            None => {
                eprintln!("[auth] Token refresh failed, clearing session");
                let mut guard = lock.lock().ok()?;
                *guard = None;
                let _ = std::fs::remove_file(tokens_file());
                None
            }
        }
    } else {
        let guard = lock.lock().ok()?;
        let tokens = guard.as_ref()?;
        Some(tokens.access_token.clone())
    }
}

pub fn get_access_token() -> Option<String> {
    let lock = TOKENS.get()?;
    let guard = lock.lock().ok()?;
    guard.as_ref().map(|t| t.access_token.clone())
}

pub fn is_authenticated() -> bool {
    let lock = match TOKENS.get() {
        Some(l) => l,
        None => return false,
    };
    let guard = match lock.lock() {
        Ok(g) => g,
        Err(_) => return false,
    };
    guard.is_some()
}

pub fn sign_out() {
    if let Some(lock) = TOKENS.get() {
        if let Ok(mut guard) = lock.lock() {
            *guard = None;
        }
    }
    let _ = std::fs::remove_file(tokens_file());
}

pub async fn fetch_user_info() -> Option<UserInfo> {
    let token = get_valid_access_token().await?;
    let client = reqwest::Client::new();
    let resp = client
        .get("https://orkestrate.space/api/auth/me")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .ok()?;
    let json: serde_json::Value = resp.json().await.ok()?;
    Some(UserInfo {
        id: json["id"].as_str()?.to_string(),
        email: json["email"].as_str().map(|s| s.to_string()),
        name: json["user_metadata"]["full_name"].as_str().map(|s| s.to_string()),
        avatar_url: json["user_metadata"]["avatar_url"].as_str().map(|s| s.to_string()),
    })
}
