use serde_json::json;
use std::sync::OnceLock;
use tiktoken_rs::CoreBPE;

use crate::config;
use crate::db;
use crate::memory::recent_summary;
use crate::memory::schema;
use crate::prompt;
use crate::timer::Timer;
use crate::HistoryMessage;

const HISTORY_BUDGET: usize = 5000;

static CL100K_BPE: OnceLock<CoreBPE> = OnceLock::new();

fn get_bpe() -> &'static CoreBPE {
    CL100K_BPE.get_or_init(|| {
        tiktoken_rs::cl100k_base().expect("Failed to initialize tiktoken cl100k_base")
    })
}

pub struct ContextBuilder {
    session_id: String,
    session_name: Option<String>,
    history: Vec<HistoryMessage>,
}

impl ContextBuilder {
    pub fn new(session_id: &str) -> Self {
        Self {
            session_id: session_id.to_string(),
            session_name: None,
            history: Vec::new(),
        }
    }

    pub fn with_history(mut self, history: Vec<HistoryMessage>) -> Self {
        self.history = history;
        self
    }

    pub fn with_session_name(mut self, name: &str) -> Self {
        self.session_name = Some(name.to_string());
        self
    }

    pub fn build(self) -> Vec<serde_json::Value> {
        let t = Timer::new("ContextBuilder::build");
        let mut messages: Vec<serde_json::Value> = Vec::new();

        // 1. System persona prompt
        let persona_timer = Timer::new("ContextBuilder::load_persona");
        let persona = prompt::load_persona();
        persona_timer.log(&format!("persona_len={}", persona.len()));

        // 2. Load compiled user schema (user.md) — cap to prevent context bloat
        let schema_timer = Timer::new("ContextBuilder::load_schema");
        let user_md_raw = schema::read_schema();
        let user_md = cap_profile(&user_md_raw, 2500);
        schema_timer.log(&format!("schema_raw_len={} schema_capped_len={}", user_md_raw.len(), user_md.len()));

        // 3. Load recent conversation summary based on config
        let continuity_mode = config::get_memory_continuity_mode();
        let summary_block = build_summary_block(&continuity_mode, &self.session_id, &self.history);

        let session_context = if let Some(name) = &self.session_name {
            format!("\n\nCurrent session: {}", name)
        } else {
            String::new()
        };

        let memory_hint = "\n\nNOTE: The profile above may be incomplete or stale. \
You have access to the `search_memory` tool to search for additional facts, preferences, \
and history stored in your memory. Use it when the user's question is broad \
(e.g. 'tell me everything about me') or when the profile seems thin. \
For temporal questions like 'what were we last talking about', search for 'recent' or 'last'. \
Results include timestamps ('2 hr ago', '3 days ago') so you can answer chronologically.";

        // Temporal + environment context
        let now = chrono::Local::now();
        let time_context = format!(
            "\n\nCurrent time: {} ({}).",
            now.format("%I:%M %p"),
            now.format("%A, %B %d, %Y")
        );
        let env_context = format!(
            "\nEnvironment: Orkestrate desktop app on {}.",
            std::env::consts::OS
        );

        let system_content = format!(
            "{}\n\nHere is what you know about the user:\n{}{}{}{}{}{}",
            persona, user_md, summary_block, memory_hint, time_context, env_context, session_context
        );

        messages.push(json!({
            "role": "system",
            "content": system_content
        }));

        // 4. Truncate history to fit budget
        let history_len = self.history.len();
        let truncated = truncate_history(self.history, HISTORY_BUDGET);
        t.log(&format!("history_in={} history_out={}", history_len, truncated.len()));

        for msg in truncated {
            if msg.role == "assistant" && msg.tool_calls.is_some() {
                let tool_calls: Vec<serde_json::Value> = serde_json::from_str(
                    msg.tool_calls.as_ref().unwrap()
                ).unwrap_or_default();
                messages.push(json!({
                    "role": "assistant",
                    "content": serde_json::Value::Null,
                    "tool_calls": tool_calls
                }));
            } else if msg.role == "tool" && msg.tool_call_id.is_some() {
                messages.push(json!({
                    "role": "tool",
                    "tool_call_id": msg.tool_call_id.as_ref().unwrap(),
                    "content": msg.content
                }));
            } else {
                messages.push(json!({
                    "role": msg.role,
                    "content": msg.content
                }));
            }
        }

        messages
    }
}

/// Build the summary/continuity block based on the configured mode.
fn build_summary_block(mode: &str, session_id: &str, history: &[HistoryMessage]) -> String {
    match mode {
        "session" => build_session_continuity(session_id, history),
        "global" => build_global_continuity(),
        _ => {
            // "off" or unknown — just show current session summary
            let current_summary = recent_summary::read_summary(session_id);
            if current_summary.is_empty() {
                "\n\nRecent conversation summary: (none yet)".to_string()
            } else {
                format!("\n\nRecent conversation summary:\n{}", current_summary)
            }
        }
    }
}

/// Build continuity block from the previous session (summary + key messages).
fn build_session_continuity(current_session_id: &str, history: &[HistoryMessage]) -> String {
    // Only inject continuity on the first exchange (history length <= 2)
    if history.len() > 2 {
        let current_summary = recent_summary::read_summary(current_session_id);
        return if current_summary.is_empty() {
            "\n\nRecent conversation summary: (none yet)".to_string()
        } else {
            format!("\n\nRecent conversation summary:\n{}", current_summary)
        };
    }

    let prev_session_id = match db::get_previous_session(current_session_id) {
        Ok(Some(id)) => id,
        _ => return "\n\nRecent conversation summary: (none yet)".to_string(),
    };

    let prev_summary = recent_summary::read_summary(&prev_session_id);

    // Load last 3 messages from previous session
    let last_msgs = db::load_session_messages(&prev_session_id, 3).unwrap_or_default();

    // If there's no summary AND no messages, there's nothing to inject
    if prev_summary.is_empty() && last_msgs.is_empty() {
        return "\n\nRecent conversation summary: (none yet)".to_string();
    }

    // If there's a current user query, search for relevant messages in previous session
    let user_query = history.iter().find(|m| m.role == "user").map(|m| m.content.as_str());
    let relevant_msgs: Vec<db::StoredMessage> = user_query
        .and_then(|q| db::search_messages(&prev_session_id, q, 2).ok())
        .unwrap_or_default();

    // Hybrid: last 2 + up to 1 relevant (deduplicated)
    let mut selected: Vec<&db::StoredMessage> = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();

    // Add last 2 messages
    for msg in last_msgs.iter().rev().take(2) {
        seen_ids.insert(&msg.id);
        selected.push(msg);
    }

    // Add 1 relevant message that isn't already selected
    for msg in relevant_msgs.iter() {
        if !seen_ids.contains(&msg.id) && selected.len() < 3 {
            selected.push(msg);
            seen_ids.insert(&msg.id);
        }
    }

    // Sort back to chronological order
    selected.sort_by_key(|m| &m.timestamp);

    let messages_text = selected
        .iter()
        .map(|m| format!("[{}]: {}", m.role, m.content))
        .collect::<Vec<_>>()
        .join("\n");

    let summary_line = if prev_summary.is_empty() {
        "Summary: (no summary compiled yet — showing raw messages)".to_string()
    } else {
        format!("Summary: {}", prev_summary)
    };

    format!(
        "\n\nPrevious session continuity:\n{}\n\nKey messages from that session:\n{}",
        summary_line,
        if messages_text.is_empty() { "(no messages retrieved)" } else { &messages_text }
    )
}

/// Build continuity block from the global rolling summary.
fn build_global_continuity() -> String {
    let global_summary = recent_summary::read_global_summary();
    if global_summary.is_empty() {
        "\n\nRecent conversation summary: (none yet)".to_string()
    } else {
        format!("\n\nRecent conversations across sessions:\n{}", global_summary)
    }
}

/// Estimate token count using tiktoken (cl100k_base is used by GPT-4, Claude, etc.)
fn estimate_tokens(text: &str) -> usize {
    let t = Timer::new("estimate_tokens");
    let count = get_bpe().encode_with_special_tokens(text).len();
    t.log(&format!("len={} tokens={}", text.len(), count));
    count
}

/// Cap the compiled profile to a token budget, trimming sections by priority.
fn cap_profile(profile: &str, token_budget: usize) -> String {
    let estimated_tokens = estimate_tokens(profile);
    if estimated_tokens <= token_budget {
        return profile.to_string();
    }

    // Priority order: keep Identity and Preferences fully, trim others
    let section_priority = ["Identity", "Preferences", "Relationships", "Projects", "Patterns", "Open Questions"];
    let mut result = String::new();
    let mut section_lines: Vec<(String, Vec<String>)> = Vec::new();

    for line in profile.lines() {
        if line.starts_with("## ") {
            let current_section = line.trim_start_matches("## ").trim();
            section_lines.push((current_section.to_string(), Vec::new()));
        } else if let Some((_, lines)) = section_lines.last_mut() {
            lines.push(line.to_string());
        }
    }

    for section_name in section_priority {
        if let Some((_, lines)) = section_lines.iter().find(|(name, _)| name == section_name) {
            let section_text = format!("## {}\n{}", section_name, lines.join("\n"));
            let section_tokens = estimate_tokens(&section_text);
            let current_tokens = estimate_tokens(&result);

            if current_tokens + section_tokens <= token_budget {
                if !result.is_empty() {
                    result.push('\n');
                }
                result.push_str(&section_text);
            } else if section_name == "Identity" || section_name == "Preferences" {
                // Always keep at least the heading for high-priority sections
                if !result.is_empty() {
                    result.push('\n');
                }
                result.push_str(&format!("## {}\n", section_name));
            }
        }
    }

    result
}

/// Truncate history from the oldest messages until it fits the budget.
fn truncate_history(history: Vec<HistoryMessage>, budget: usize) -> Vec<HistoryMessage> {
    let t = Timer::new("truncate_history");
    let mut total_tokens = 0;
    let mut result = Vec::new();
    let input_len = history.len();

    // Iterate from most recent to oldest
    for msg in history.into_iter().rev() {
        let msg_text = format!("{}: {}", msg.role, msg.content);
        let tokens = estimate_tokens(&msg_text);

        if total_tokens + tokens > budget && !result.is_empty() {
            // Budget exceeded and we have at least one message
            break;
        }

        total_tokens += tokens;
        result.push(msg);
    }

    // Reverse back to chronological order (oldest first)
    result.reverse();
    t.log(&format!("input={} output={} total_tokens={} budget={}", input_len, result.len(), total_tokens, budget));
    result
}

/// Estimate total tokens for a message array (for debugging/monitoring)
#[allow(dead_code)]
pub fn count_message_tokens(messages: &[serde_json::Value]) -> usize {
    let mut total = 0;
    for msg in messages {
        if let Some(content) = msg.get("content").and_then(|c| c.as_str()) {
            total += estimate_tokens(content);
        }
        if let Some(role) = msg.get("role").and_then(|r| r.as_str()) {
            total += estimate_tokens(role);
        }
    }
    total
}
