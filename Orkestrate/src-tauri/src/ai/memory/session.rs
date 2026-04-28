use serde::{Serialize, Deserialize};
use dashmap::DashMap;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::fs;

pub static SESSION_REGISTRY: Lazy<DashMap<String, SessionWorkingMemory>> = Lazy::new(|| DashMap::new());

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallRecord {
    pub queries: Vec<String>,
    pub memory_content: Vec<String>,
}

pub static TOOL_TRACES: Lazy<DashMap<String, Vec<ToolCallRecord>>> = Lazy::new(|| DashMap::new());

// ─────────────────────────────────────────────────────────────────────────────
// Session Working Memory + Session Summaries
// ─────────────────────────────────────────────────────────────────────────────

/// A single conversational turn stored in the sliding window.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Turn {
    pub role: String,
    pub content: String,
    pub entities: Vec<String>,
    pub timestamp: i64,
}

/// Recorded when the conversation shifts to a new topic.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicShift {
    pub old_topic: String,
    pub new_topic: String,
    pub turn_index: u64,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionWorkingMemory {
    pub session_id: String,
    pub current_topic: String,
    pub topic_history: Vec<TopicShift>,
    pub active_entities: HashMap<String, String>,
    pub entity_bindings: HashMap<String, String>,
    pub recent_turns: Vec<Turn>,
    pub last_memory_ids: Vec<String>,
    pub turn_count: u64,
    pub last_updated: i64,
    // Session summary for cross-session continuity
    pub summary: String,
    pub last_messages: Vec<Turn>, // last 5 messages for context injection
}

const MAX_RECENT_TURNS: usize = 10;
const MAX_TOPIC_HISTORY: usize = 5;
const MAX_MEMORY_IDS: usize = 5;
const TURN_CONTENT_MAX_LEN: usize = 300;
const MAX_LAST_MESSAGES: usize = 5;

impl SessionWorkingMemory {
    pub fn new(session_id: &str) -> Self {
        Self {
            session_id: session_id.to_string(),
            current_topic: "General".to_string(),
            topic_history: Vec::new(),
            active_entities: HashMap::new(),
            entity_bindings: HashMap::new(),
            recent_turns: Vec::new(),
            last_memory_ids: Vec::new(),
            turn_count: 0,
            last_updated: chrono::Utc::now().timestamp_millis(),
            summary: String::new(),
            last_messages: Vec::new(),
        }
    }

    pub fn add_turn(&mut self, role: &str, content: &str, entities: Vec<String>) {
        let truncated = if content.len() > TURN_CONTENT_MAX_LEN {
            format!("{}...", &content[..TURN_CONTENT_MAX_LEN])
        } else {
            content.to_string()
        };

        let turn = Turn {
            role: role.to_string(),
            content: truncated.clone(),
            entities,
            timestamp: chrono::Utc::now().timestamp_millis(),
        };

        self.recent_turns.push(turn.clone());
        if self.recent_turns.len() > MAX_RECENT_TURNS {
            self.recent_turns.drain(0..self.recent_turns.len() - MAX_RECENT_TURNS);
        }

        // Also track last_messages for cross-session persistence
        self.last_messages.push(turn);
        if self.last_messages.len() > MAX_LAST_MESSAGES {
            self.last_messages.drain(0..self.last_messages.len() - MAX_LAST_MESSAGES);
        }

        self.last_updated = chrono::Utc::now().timestamp_millis();
    }

    pub fn update_topic(&mut self, new_topic: &str) {
        if new_topic.is_empty() || new_topic == self.current_topic {
            return;
        }
        let old_topic = self.current_topic.clone();
        self.topic_history.push(TopicShift {
            old_topic: old_topic.clone(),
            new_topic: new_topic.to_string(),
            turn_index: self.turn_count,
            timestamp: chrono::Utc::now().timestamp_millis(),
        });
        if self.topic_history.len() > MAX_TOPIC_HISTORY {
            self.topic_history.drain(0..self.topic_history.len() - MAX_TOPIC_HISTORY);
        }
        self.current_topic = new_topic.to_string();
        eprintln!("[swm] Topic updated: '{}' → '{}'", old_topic, new_topic);
    }

    pub fn update_bindings(&mut self, bindings: HashMap<String, String>) {
        for (pronoun, entity) in bindings {
            self.entity_bindings.insert(pronoun, entity);
        }
        eprintln!("[swm] Updated {} pronoun bindings", self.entity_bindings.len());
    }

    pub fn to_prompt_string(&self) -> String {
        let mut prompt = String::from("\n[SESSION WORKING MEMORY]\n");

        prompt.push_str(&format!("Current Topic: {}\n", self.current_topic));

        if !self.topic_history.is_empty() {
            prompt.push_str("Topic History:\n");
            for shift in &self.topic_history {
                prompt.push_str(&format!(
                    "- Turn {}: {} → {}\n",
                    shift.turn_index, shift.old_topic, shift.new_topic
                ));
            }
        }

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

        if !self.entity_bindings.is_empty() {
            let mut seen = std::collections::HashSet::new();
            let mut bindings: Vec<String> = Vec::new();
            for (pronoun, entity) in &self.entity_bindings {
                let key = format!("{}={}", pronoun, entity);
                if seen.insert(key) {
                    bindings.push(format!("{} → {}", pronoun, entity));
                }
            }
            if !bindings.is_empty() {
                prompt.push_str("Pronoun Bindings:\n");
                for b in bindings {
                    prompt.push_str(&format!("  {}\n", b));
                }
            }
        }

        if !self.active_entities.is_empty() {
            prompt.push_str("Active Entities:\n");
            for (key, value) in &self.active_entities {
                prompt.push_str(&format!("- {}: {}\n", key, value));
            }
        }

        if !self.last_memory_ids.is_empty() {
            prompt.push_str(&format!(
                "Recent Context IDs: {}\n",
                self.last_memory_ids.join(", ")
            ));
        }

        prompt.push_str("[/SESSION WORKING MEMORY]\n");
        prompt
    }

    pub fn add_extracted_memory(&mut self, title: &str, domain: &str) {
        let id = format!("{}/{}", domain, title);
        if !self.last_memory_ids.contains(&id) {
            self.last_memory_ids.push(id);
        }
        self.active_entities
            .insert(domain.to_string(), "Recently stored".to_string());
        if self.last_memory_ids.len() > MAX_MEMORY_IDS {
            self.last_memory_ids.drain(0..self.last_memory_ids.len() - MAX_MEMORY_IDS);
        }
        self.last_updated = chrono::Utc::now().timestamp_millis();
    }

    pub fn update_from_search(&mut self, memories: &[super::manager::Memory]) {
        for mem in memories {
            if !self.last_memory_ids.contains(&mem.id) {
                self.last_memory_ids.push(mem.id.clone());
            }
            for tag in &mem.tags {
                if !self.active_entities.contains_key(tag) {
                    self.active_entities.insert(tag.clone(), "Active in context".to_string());
                }
            }
        }
        if self.last_memory_ids.len() > MAX_MEMORY_IDS {
            self.last_memory_ids.drain(0..self.last_memory_ids.len() - MAX_MEMORY_IDS);
        }
        self.last_updated = chrono::Utc::now().timestamp_millis();
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

/// Save a session's summary and last messages to disk.
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

/// Load the most recent previous session's summary and last messages.
/// Returns a formatted string for system prompt injection, or empty if none.
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

/// Generate a session summary from recent conversation turns using an LLM.
pub async fn summarize_session(turns: &[Turn]) -> Result<String, String> {
    if turns.len() < 2 {
        return Ok(String::new());
    }

    let conversation: String = turns
        .iter()
        .map(|t| format!("{}: {}", t.role, t.content))
        .collect::<Vec<_>>()
        .join("\n");

    let prompt = format!(
        "Summarize this conversation in 1-2 sentences. Focus on what was being discussed, key people mentioned, and any important decisions or facts. Be specific with names.\n\n{}",
        conversation
    );

    use aisdk::core::LanguageModelRequest;
    use aisdk::providers::Opencode;

    let response = LanguageModelRequest::builder()
        .model(Opencode::minimax_m2_5_free())
        .system("You summarize conversations. Be specific with names and topics. Output only the summary, no explanation.".to_string())
        .messages(vec![aisdk::core::Message::User(aisdk::core::UserMessage {
            content: prompt,
        })])
        .build()
        .generate_text()
        .await
        .map_err(|e| format!("Summary LLM failed: {e}"))?;

    let text = response.text().ok_or("No response text")?;
    Ok(text.trim().to_string())
}
