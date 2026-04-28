use aisdk::core::LanguageModelRequest;
use aisdk::providers::Opencode;
use crate::ai::memory::manager::Memory;

const RELEVANCE_SYSTEM: &str = r#"You are a memory relevance scorer. Given a user's message and a memory, score how relevant the memory is to the current conversation.

Score from 0.0 to 1.0:
- 1.0: Directly answers the user's question or is about the exact same topic/people
- 0.7-0.9: Strongly related, same people or closely related topic
- 0.4-0.6: Somewhat related, tangential connection
- 0.1-0.3: Weakly related, only loose thematic connection
- 0.0: Completely irrelevant

Rules:
- Favor recency: memories from recent conversations score higher
- Favor specificity: memories about named people/places/projects score higher than vague generalities
- Penalize contradictions: if the memory contradicts what the user just said, score low
- Consider the conversation context, not just keyword matching

Output exactly: {"score": 0.85, "reason": "brief explanation"}"#;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct RelevanceScore {
    score: f64,
    reason: String,
}

/// LLM-based relevance ranking of memories against a user query.
/// Re-ranks BM25 search results with semantic understanding.
pub async fn relevance_rank(query: &str, memories: &mut [Memory]) {
    if memories.is_empty() {
        return;
    }

    // Batch scoring: score top N memories to avoid too many LLM calls
    let top_n = std::cmp::min(memories.len(), 8);
    let mut scored = Vec::with_capacity(top_n);

    for mem in &memories[..top_n] {
        let prompt = format!(
            "User message: {}\n\nMemory: {}\n\nMemory entities: {:?}\n\nScore the relevance.",
            query, mem.content, mem.entities
        );

        match score_single(&prompt).await {
            Ok((score, reason)) => {
                eprintln!(
                    "[retrieval] Relevance: id={} score={:.2} reason=\"{}\"",
                    mem.id, score, reason
                );
                scored.push((mem.id.clone(), score));
            }
            Err(e) => {
                eprintln!("[retrieval] Relevance scoring failed for {}: {}", mem.id, e);
            }
        }
    }

    // Apply LLM scores as boost to existing BM25 scores
    let score_map: std::collections::HashMap<String, f64> = scored.into_iter().collect();
    for mem in memories.iter_mut() {
        if let Some(llm_score) = score_map.get(&mem.id) {
            // Blend BM25 score (0.4 weight) with LLM relevance (0.6 weight)
            mem.score = mem.score * 0.4 + llm_score * 0.6;
        }
    }

    // Re-sort by blended score
    memories.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
}

async fn score_single(prompt: &str) -> Result<(f64, String), String> {
    let response = LanguageModelRequest::builder()
        .model(Opencode::minimax_m2_5_free())
        .system(RELEVANCE_SYSTEM.to_string())
        .messages(vec![aisdk::core::Message::User(aisdk::core::UserMessage {
            content: prompt.to_string(),
        })])
        .build()
        .generate_text()
        .await
        .map_err(|e| format!("Relevance LLM failed: {e}"))?;

    let text = response.text().ok_or("No response text")?;
    let json_start = text.find('{').ok_or("No JSON")?;
    let json_end = text.rfind('}').ok_or("No JSON")? + 1;
    let json_str = &text[json_start..json_end];

    let score: RelevanceScore = serde_json::from_str(json_str)
        .map_err(|e| format!("JSON parse error: {e}"))?;

    Ok((score.score.clamp(0.0, 1.0), score.reason))
}

const SUMMARY_SYSTEM: &str = r#"You summarize old memories into concise, timeless facts.

Given a memory that hasn't been accessed in a while, produce a single-sentence summary that captures the essential fact. Remove temporal noise ("last week", "recently", "yesterday") and convert to timeless statements.

Examples:
- "Mia was stressed about her exam last Tuesday" → "Mia experiences exam-related stress"
- "User started learning Rust 3 months ago" → "User is learning Rust"
- "Karan and user had coffee at Starbucks on Monday" → "Karan and user occasionally meet for coffee"

Output exactly: {"summary": "the timeless summary"}"#;

/// Summarize an old memory into a timeless fact.
pub async fn summarize_memory(content: &str) -> Result<String, String> {
    let prompt = format!("Memory: {}\n\nSummarize into a timeless fact.", content);

    let response = LanguageModelRequest::builder()
        .model(Opencode::minimax_m2_5_free())
        .system(SUMMARY_SYSTEM.to_string())
        .messages(vec![aisdk::core::Message::User(aisdk::core::UserMessage {
            content: prompt,
        })])
        .build()
        .generate_text()
        .await
        .map_err(|e| format!("Summary LLM failed: {e}"))?;

    let text = response.text().ok_or("No response text")?;
    let json_start = text.find('{').ok_or("No JSON")?;
    let json_end = text.rfind('}').ok_or("No JSON")? + 1;
    let json_str = &text[json_start..json_end];

    #[derive(serde::Deserialize)]
    struct SummaryResult {
        summary: String,
    }

    let result: SummaryResult = serde_json::from_str(json_str)
        .map_err(|e| format!("JSON parse error: {e}"))?;

    Ok(result.summary)
}
