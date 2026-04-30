use serde::{Serialize, Deserialize};
use dashmap::DashMap;
use once_cell::sync::Lazy;
use std::path::Path;
use std::fs;

pub static SESSION_REGISTRY: Lazy<DashMap<String, SessionWorkingMemory>> = Lazy::new(|| DashMap::new());

// ─── Session Working Memory ───────────────────────────────────────────────

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
    pub summary: String,
    pub last_messages: Vec<Turn>,
    pub extracted_facts: Vec<String>,
}

const MAX_RECENT_TURNS: usize = 10;
const MAX_LAST_MESSAGES: usize = 5;
const TURN_CONTENT_MAX_LEN: usize = 500;

impl SessionWorkingMemory {
    pub fn new(session_id: &str) -> Self {
        Self {
            session_id: session_id.to_string(),
            recent_turns: Vec::new(),
            turn_count: 0,
            last_updated: chrono::Utc::now().timestamp_millis(),
            summary: String::new(),
            last_messages: Vec::new(),
            extracted_facts: Vec::new(),
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

        self.turn_count += 1;
        self.last_updated = chrono::Utc::now().timestamp_millis();
    }

    pub fn add_extracted_fact(&mut self, fact: &str) {
        if !fact.is_empty() && !self.extracted_facts.iter().any(|f| f == fact) {
            self.extracted_facts.push(fact.to_string());
        }
    }

    pub fn to_prompt_string(&self) -> String {
        let mut prompt = String::from("\n[SESSION WORKING MEMORY]\n");
        prompt.push_str(&format!("Turn count: {}\n", self.turn_count));

        if !self.recent_turns.is_empty() {
            prompt.push_str("Recent Conversation:\n");
            for (i, turn) in self.recent_turns.iter().enumerate() {
                let preview = if turn.content.len() > 120 {
                    format!("{}...", &turn.content[..120])
                } else {
                    turn.content.clone()
                };
                prompt.push_str(&format!("  [{}] {}: {}\n", i + 1, turn.role, preview.replace('\n', " ")));
            }
        }

        if !self.extracted_facts.is_empty() {
            prompt.push_str("Extracted facts this session:\n");
            for fact in &self.extracted_facts {
                prompt.push_str(&format!("  - {}\n", fact));
            }
        }

        prompt.push_str("[/SESSION WORKING MEMORY]\n");
        prompt
    }
}

// ─── Session Summary Persistence ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionContextFile {
    pub session_id: String,
    pub summary: String,
    pub last_messages: Vec<Turn>,
    pub extracted_facts: Vec<String>,
    pub timestamp: i64,
}

fn session_summaries_dir(app_data_dir: &Path) -> std::path::PathBuf {
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
        extracted_facts: swm.extracted_facts.clone(),
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
            if path.extension().and_then(|s| s.to_str()) != Some("json") { continue; }
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
    if !file.extracted_facts.is_empty() {
        prompt.push_str("Previous facts discovered:\n");
        for f in &file.extracted_facts {
            prompt.push_str(&format!("  - {}\n", f));
        }
    }
    if !file.last_messages.is_empty() {
        prompt.push_str("Last messages:\n");
        for turn in &file.last_messages {
            prompt.push_str(&format!("  {}: {}\n", turn.role, turn.content.replace('\n', " ")));
        }
    }
    prompt.push_str("[/PREVIOUS SESSION CONTEXT]\n");
    prompt
}

/// Fast heuristic summary (0ms) — extracts key topics from recent turns.
/// For LLM-curated summaries, the agent's summarize_session tool generates
/// richer context via the website API.
pub fn summarize_session(turns: &[Turn]) -> String {
    if turns.is_empty() { return String::new(); }
    let count = turns.len();
    let user_turns: Vec<&str> = turns.iter()
        .filter(|t| t.role == "user")
        .map(|t| t.content.as_str())
        .rev()
        .take(3)
        .collect();

    if user_turns.is_empty() {
        return format!("{} total turns in this session.", count);
    }

    format!("Session with {} turns. Recent topics: {}", count, user_turns.join("; "))
}
