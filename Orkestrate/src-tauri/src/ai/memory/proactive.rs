use aisdk::core::LanguageModelRequest;
use aisdk::providers::Opencode;
use crate::ai::memory::{MemoryManager, SESSION_REGISTRY};
use crate::ai::memory::manager::Memory;
use crate::ai::memory::retrieval::relevance_rank;

const PROACTIVE_SYSTEM: &str = r#"You are a proactive memory agent. Your job is to decide which memories from the user's long-term storage are relevant enough to bring up proactively in the current conversation.

The user has NOT explicitly asked about these memories. You must judge whether bringing them up would be helpful, natural, and non-intrusive.

# RULES
1. ONLY suggest memories that are DIRECTLY relevant to the current topic or people being discussed.
2. NEVER suggest memories that are off-topic or would feel like a non-sequitur.
3. Favor memories about the SAME people or projects currently being discussed.
4. If the user is asking a factual question (weather, code, definitions), DO NOT suggest personal memories.
5. If the conversation is about personal matters (feelings, relationships, goals), DO suggest related personal memories.
6. Each suggestion must include WHY it's relevant.
7. NEVER suggest more than 3 memories.

# OUTPUT FORMAT
Output exactly:
{"should_inject": true, "memories": [{"id": "memory_id", "reason": "why this is relevant"}], "context_line": "One-sentence summary of what to mention"}

If no memories are relevant:
{"should_inject": false, "memories": [], "context_line": ""}"#;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct ProactiveMemory {
    id: String,
    reason: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct ProactiveResult {
    should_inject: bool,
    memories: Vec<ProactiveMemory>,
    context_line: String,
}

/// Run the proactive memory agent.
/// Returns a formatted string of proactive memories to inject into the system prompt,
/// or an empty string if nothing is relevant.
pub async fn proactive_memory_agent(
    manager: &MemoryManager,
    user_message: &str,
    session_id: &str,
) -> String {
    // Skip if message is too short or looks like a command
    if user_message.len() < 10 {
        return String::new();
    }

    // Build search queries from user message + active entities
    let mut queries = vec![user_message.to_string()];
    if let Some(swm) = SESSION_REGISTRY.get(session_id) {
        for entity in &swm.recent_turns.last().map(|t| t.entities.clone()).unwrap_or_default() {
            queries.push(entity.clone());
        }
    }

    // Search memory
    let mut memories = match manager.search(queries) {
        Ok(m) => m,
        Err(e) => {
            eprintln!("[proactive] Search failed: {e}");
            return String::new();
        }
    };

    if memories.is_empty() {
        return String::new();
    }

    // Re-rank with LLM relevance
    relevance_rank(user_message, &mut memories).await;

    // Take top 5 for proactive consideration
    let top_memories: Vec<&Memory> = memories.iter().take(5).collect();

    // Build prompt for proactive agent
    let memory_descriptions: Vec<String> = top_memories
        .iter()
        .map(|m| format!("- [{}] {} (entities: {:?}, score: {:.2})", m.id, m.content, m.entities, m.score))
        .collect();

    let prompt = format!(
        "Current user message: {}\n\nCandidate memories:\n{}\n\nDecide which memories to proactively bring up.",
        user_message,
        memory_descriptions.join("\n")
    );

    let response = match LanguageModelRequest::builder()
        .model(Opencode::minimax_m2_5_free())
        .system(PROACTIVE_SYSTEM.to_string())
        .messages(vec![aisdk::core::Message::User(aisdk::core::UserMessage {
            content: prompt,
        })])
        .build()
        .generate_text()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[proactive] LLM call failed: {e}");
            return String::new();
        }
    };

    let text = match response.text() {
        Some(t) => t,
        None => {
            eprintln!("[proactive] No response text");
            return String::new();
        }
    };

    let json_start = match text.find('{') {
        Some(i) => i,
        None => {
            eprintln!("[proactive] No JSON in response");
            return String::new();
        }
    };
    let json_end = match text.rfind('}') {
        Some(i) => i + 1,
        None => {
            eprintln!("[proactive] No JSON closing brace");
            return String::new();
        }
    };
    let json_str = &text[json_start..json_end];

    let result: ProactiveResult = match serde_json::from_str(json_str) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[proactive] JSON parse error: {e}");
            return String::new();
        }
    };

    if !result.should_inject || result.memories.is_empty() {
        eprintln!("[proactive] No proactive memories to inject");
        return String::new();
    }

    // Build injection text
    let mut injection = String::from("\n[PROACTIVE MEMORY]\n");
    injection.push_str(&format!("Context: {}\n", result.context_line));
    injection.push_str("Relevant past information:\n");

    for pm in &result.memories {
        // Find the actual memory content
        if let Some(mem) = memories.iter().find(|m| m.id == pm.id) {
            injection.push_str(&format!("- {} (relevance: {})\n", mem.content, pm.reason));
        }
    }
    injection.push_str("[/PROACTIVE MEMORY]\n");

    eprintln!(
        "[proactive] Injecting {} proactive memories",
        result.memories.len()
    );
    injection
}
