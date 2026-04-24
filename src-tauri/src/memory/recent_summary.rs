use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Mutex,
};

use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::db;
use crate::timer::Timer;

// ── Semantic Boundary Detection State ─────────────────────────────────

/// Running average embedding of the current conversation window.
/// Updated incrementally as new messages arrive.
static RUNNING_EMBEDDING: Mutex<Option<Vec<f32>>> = Mutex::new(None);

/// Number of turns since the last summary compilation.
static TURNS_SINCE_SUMMARY: AtomicUsize = AtomicUsize::new(0);

#[allow(dead_code)]
/// Reset boundary detection state (e.g., on new session or manual reset).
pub fn reset_boundary_state() {
    let mut emb = RUNNING_EMBEDDING.lock().unwrap();
    *emb = None;
    TURNS_SINCE_SUMMARY.store(0, Ordering::Relaxed);
}

/// Compute embedding drift between a new message and the running average.
/// Returns (drift_score, should_compile) where should_compile is true if drift > 0.7.
pub async fn check_semantic_boundary(message: &str) -> (f32, bool) {
    let (new_embedding, _provider) = match crate::embed::embed(message).await {
        Ok((emb, prov)) => (emb, prov),
        Err(e) => {
            eprintln!("[Boundary] Embedding failed: {}", e);
            return (0.0, false);
        }
    };

    let mut running = RUNNING_EMBEDDING.lock().unwrap();
    let should_compile = if let Some(ref avg) = *running {
        let sim = crate::vector::cosine_similarity(&new_embedding, avg);
        let drift = 1.0 - sim;
        println!("[Boundary] drift={:.3} (sim={:.3})", drift, sim);
        drift > 0.7
    } else {
        println!("[Boundary] First message — no drift to compare");
        false
    };

    // Update running average with exponential moving average
    if let Some(ref mut avg) = *running {
        let alpha = 0.3; // EMA smoothing factor
        for i in 0..avg.len() {
            avg[i] = alpha * new_embedding[i] + (1.0 - alpha) * avg[i];
        }
    } else {
        *running = Some(new_embedding);
    }

    (if should_compile { 1.0 } else { 0.0 }, should_compile)
}

/// Increment turns-since-summary counter and check if max window reached.
pub fn increment_turn_counter() -> usize {
    TURNS_SINCE_SUMMARY.fetch_add(1, Ordering::Relaxed) + 1
}

/// Reset turns-since-summary counter after compilation.
pub fn reset_turn_counter() {
    TURNS_SINCE_SUMMARY.store(0, Ordering::Relaxed);
}

const API_BASE: &str = "https://opencode.ai/zen/v1/chat/completions";

fn summaries_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Orkestrate")
        .join("summaries")
}

pub fn summary_path(session_id: &str) -> PathBuf {
    summaries_dir().join(format!("{}.txt", session_id))
}

pub fn global_summary_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Orkestrate")
        .join("global_summary.txt")
}

pub fn read_summary(session_id: &str) -> String {
    let path = summary_path(session_id);
    if !path.exists() {
        String::new()
    } else {
        std::fs::read_to_string(&path).unwrap_or_default()
    }
}

pub fn read_global_summary() -> String {
    let path = global_summary_path();
    if !path.exists() {
        String::new()
    } else {
        std::fs::read_to_string(&path).unwrap_or_default()
    }
}

fn write_summary_to(path: &PathBuf, content: &str) -> Result<(), String> {
    let _ = std::fs::create_dir_all(path.parent().unwrap());
    std::fs::write(path, content).map_err(|e| e.to_string())
}

pub fn write_summary(session_id: &str, content: &str) -> Result<(), String> {
    write_summary_to(&summary_path(session_id), content)
}

pub fn write_global_summary(content: &str) -> Result<(), String> {
    write_summary_to(&global_summary_path(), content)
}

/// Compile a session-scoped narrative summary.
pub async fn compile(
    session_id: &str,
    api_key: &str,
    messages: &[crate::HistoryMessage],
) -> Result<String, String> {
    let _timer = Timer::new("memory::recent_summary::compile");

    let existing = read_summary(session_id);

    // Only include last 10 messages for the summary window
    let window = messages.iter().rev().take(10).rev().collect::<Vec<_>>();
    let conversation = window
        .iter()
        .map(|m| format!("{}: {}", m.role, m.content))
        .collect::<Vec<_>>()
        .join("\n");

    let prompt = format!(
        r#"You maintain a running summary of your conversations with the user.

Existing summary (may be empty):
{}

New turns to incorporate:
{}

Rewrite the summary in 100-250 words. Include:
- What the user has revealed about themselves
- What you've learned recently
- Any open questions or unresolved threads
- The current tone/mood of the conversation

Output ONLY the summary paragraph. No quotes, no markdown headers."#,
        if existing.is_empty() {
            "(none yet)"
        } else {
            &existing
        },
        conversation
    );

    let summary = call_summary_llm(api_key, &prompt).await?;
    write_summary(session_id, &summary)?;
    Ok(summary)
}

/// Compile a global summary spanning multiple sessions.
pub async fn compile_global(
    api_key: &str,
    messages: &[crate::HistoryMessage],
) -> Result<String, String> {
    let _timer = Timer::new("memory::recent_summary::compile_global");

    let existing = read_global_summary();

    let conversation = messages
        .iter()
        .map(|m| format!("{}: {}", m.role, m.content))
        .collect::<Vec<_>>()
        .join("\n");

    let prompt = format!(
        r#"You maintain a running summary of ALL recent conversations with the user across all sessions.

Existing global summary (may be empty):
{}

New turns to incorporate:
{}

Rewrite the global summary in 100-250 words. Include:
- What the user has been working on across sessions
- Consistent themes, preferences, or patterns
- Any unresolved threads that span multiple conversations
- The overall trajectory of your relationship

Output ONLY the summary paragraph. No quotes, no markdown headers."#,
        if existing.is_empty() {
            "(none yet)"
        } else {
            &existing
        },
        conversation
    );

    let summary = call_summary_llm(api_key, &prompt).await?;
    write_global_summary(&summary)?;
    Ok(summary)
}

async fn call_summary_llm(api_key: &str, prompt: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let request = json!({
        "model": "minimax-m2.5-free",
        "messages": [
            { "role": "system", "content": "You write concise conversation summaries. Output ONLY plain text." },
            { "role": "user", "content": prompt }
        ],
        "stream": false,
        "max_tokens": 4096
    });

    let response = client
        .post(API_BASE)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Summary request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Summary API Error {}: {}", status, body));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Summary JSON parse error: {}", e))?;

    let summary = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();

    if summary.is_empty() {
        return Err("Generated summary was empty".to_string());
    }

    Ok(summary)
}

// ─── Summary Listing for UI ────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Summary {
    pub id: String,
    pub name: String,
    pub content: String,
    pub is_global: bool,
    pub updated_at: Option<String>,
}

/// List all available summaries: global + one per session that has a summary file.
pub fn list_summaries() -> Result<Vec<Summary>, String> {
    let mut results = Vec::new();

    // Global summary
    let global_path = global_summary_path();
    if global_path.exists() {
        let content = std::fs::read_to_string(&global_path).unwrap_or_default();
        if !content.is_empty() {
            let meta = std::fs::metadata(&global_path).ok();
            let updated_at = meta
                .and_then(|m| m.modified().ok())
                .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339());
            results.push(Summary {
                id: "global".to_string(),
                name: "Global".to_string(),
                content,
                is_global: true,
                updated_at,
            });
        }
    }

    // Session summaries
    let dir = summaries_dir();
    if dir.exists() {
        let entries = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
        // Build a lookup of session id -> name
        let sessions = db::list_sessions().unwrap_or_default();
        let session_names: std::collections::HashMap<String, String> = sessions
            .into_iter()
            .filter_map(|s| {
                let id = s.get("id")?.as_str()?.to_string();
                let name = s.get("name")?.as_str()?.to_string();
                Some((id, name))
            })
            .collect();

        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("txt") {
                continue;
            }
            let filename = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
            if filename.is_empty() || filename == "global" {
                continue;
            }
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            if content.is_empty() {
                continue;
            }
            let meta = entry.metadata().ok();
            let updated_at = meta
                .and_then(|m| m.modified().ok())
                .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339());
            let name = session_names
                .get(filename)
                .cloned()
                .unwrap_or_else(|| "Unnamed session".to_string());
            results.push(Summary {
                id: filename.to_string(),
                name,
                content,
                is_global: false,
                updated_at,
            });
        }
    }

    // Sort: global first, then by updated_at desc
    results.sort_by(|a, b| match (a.is_global, b.is_global) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => b.updated_at.cmp(&a.updated_at),
    });

    Ok(results)
}
