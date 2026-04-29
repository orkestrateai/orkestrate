use serde::{Serialize, Deserialize};
use dashmap::DashMap;
use once_cell::sync::Lazy;
use std::path::{Path, PathBuf};
use std::fs;

pub static SESSION_REGISTRY: Lazy<DashMap<String, SessionWorkingMemory>> = Lazy::new(|| DashMap::new());

// ─────────────────────────────────────────────────────────────────────────────
// Session Working Memory
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Turn {
    pub role: String,
    pub content: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionWorkingMemory {
    pub session_id: String,
    pub recent_turns: Vec<Turn>,
    pub turn_count: u64,
    pub last_updated: i64,
    // Session summary for cross-session continuity
    pub summary: String,
    pub last_messages: Vec<Turn>, // last 5 messages for context injection
}

const MAX_RECENT_TURNS: usize = 10;
const MAX_LAST_MESSAGES: usize = 5;
const TURN_CONTENT_MAX_LEN: usize = 300;

impl SessionWorkingMemory {
    pub fn new(session_id: &str) -> Self {
        Self {
            session_id: session_id.to_string(),
            recent_turns: Vec::new(),
            turn_count: 0,
            last_updated: chrono::Utc::now().timestamp_millis(),
            summary: String::new(),
            last_messages: Vec::new(),
        }
    }

    pub fn add_turn(&mut self, role: &str, content: &str) {
        let truncated = if content.len() > TURN_CONTENT_MAX_LEN {
            format!("{}...", &content[..TURN_CONTENT_MAX_LEN])
        } else {
            content.to_string()
        };

        let turn = Turn {
            role: role.to_string(),
            content: truncated.clone(),
            timestamp: chrono::Utc::now().timestamp_millis(),
        };

        self.recent_turns.push(turn.clone());
        if self.recent_turns.len() > MAX_RECENT_TURNS {
            self.recent_turns.drain(0..self.recent_turns.len() - MAX_RECENT_TURNS);
        }

        self.last_messages.push(turn);
        if self.last_messages.len() > MAX_LAST_MESSAGES {
            self.last_messages.drain(0..self.last_messages.len() - MAX_LAST_MESSAGES);
        }

        self.last_updated = chrono::Utc::now().timestamp_millis();
    }

    pub fn to_prompt_string(&self) -> String {
        let mut prompt = String::from("\n[SESSION WORKING MEMORY]\n");

        if !self.recent_turns.is_empty() {
            prompt.push_str("Recent Conversation:\n");
            for (i, turn) in self.recent_turns.iter().enumerate() {
                let preview = if turn.content.len() > 120 {
                    format!("{}...", &turn.content[..120])
                } else {
                    turn.content.clone()
                };
                prompt.push_str(&format!(
                    "  [{}] {}: {}\n",
                    i + 1,
                    turn.role,
                    preview.replace('\n', " ")
                ));
            }
        }

        prompt.push_str("[/SESSION WORKING MEMORY]\n");
        prompt
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Summary Persistence
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionContextFile {
    pub session_id: String,
    pub summary: String,
    pub last_messages: Vec<Turn>,
    pub timestamp: i64,
}

fn session_summaries_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(".brv").join("session-summaries")
}

pub fn save_session_context(app_data_dir: &Path, swm: &SessionWorkingMemory) {
    if swm.last_messages.is_empty() && swm.summary.is_empty() {
        return;
    }

    let dir = session_summaries_dir(app_data_dir);
    if let Err(e) = fs::create_dir_all(&dir) {
        eprintln!("[session] Failed to create summaries dir: {e}");
        return;
    }

    let file = SessionContextFile {
        session_id: swm.session_id.clone(),
        summary: swm.summary.clone(),
        last_messages: swm.last_messages.clone(),
        timestamp: chrono::Utc::now().timestamp_millis(),
    };

    let path = dir.join(format!("{}.json", swm.session_id));
    let tmp_path = path.with_extension("tmp");
    match serde_json::to_string_pretty(&file) {
        Ok(json) => {
            if let Err(e) = fs::write(&tmp_path, json) {
                eprintln!("[session] Failed to write summary tmp: {e}");
                return;
            }
            if let Err(e) = fs::rename(&tmp_path, &path) {
                eprintln!("[session] Failed to rename summary: {e}");
            }
        }
        Err(e) => eprintln!("[session] Failed to serialize summary: {e}"),
    }
}

pub fn load_previous_session_context(app_data_dir: &Path) -> String {
    let dir = session_summaries_dir(app_data_dir);
    if !dir.exists() {
        return String::new();
    }

    let mut latest: Option<SessionContextFile> = None;
    let mut latest_time = 0i64;

    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(file) = serde_json::from_str::<SessionContextFile>(&content) {
                    if file.timestamp > latest_time {
                        latest_time = file.timestamp;
                        latest = Some(file);
                    }
                }
            }
        }
    }

    let file = match latest {
        Some(f) => f,
        None => return String::new(),
    };

    let mut prompt = String::from("\n[PREVIOUS SESSION CONTEXT]\n");

    if !file.summary.is_empty() {
        prompt.push_str("Summary: ");
        prompt.push_str(&file.summary);
        prompt.push('\n');
    }

    if !file.last_messages.is_empty() {
        prompt.push_str("Last messages:\n");
        for turn in &file.last_messages {
            prompt.push_str(&format!(
                "  {}: {}\n",
                turn.role,
                turn.content.replace('\n', " ")
            ));
        }
    }

    prompt.push_str("[/PREVIOUS SESSION CONTEXT]\n");
    prompt
}

/// Build a summary from recent turns (no LLM needed — just concatenates last messages).
pub fn summarize_session(turns: &[Turn]) -> String {
    if turns.is_empty() {
        return String::new();
    }
    let count = turns.len();
    let previews: Vec<&str> = turns.iter().rev().take(3).map(|t| t.content.as_str()).collect();
    format!("Last {} messages: {}", count, previews.join(" | "))
}
