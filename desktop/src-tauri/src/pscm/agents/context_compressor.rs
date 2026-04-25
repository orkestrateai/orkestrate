use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;

const API_BASE: &str = "https://opencode.ai/zen/v1/chat/completions";

/// A scored message with its relevance to the current query.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct MessageScore {
    pub index: usize,
    pub score: f64,
    pub reason: String,
}

/// Result from the context compressor agent.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CompressionResult {
    pub keep_indices: Vec<usize>,
    pub summary_of_dropped: String,
}

/// Compress conversation history by scoring each message's relevance to the
/// current user query, then keeping the most important ones within token budget.
///
/// This agent is only invoked when history exceeds the budget. It makes a single
/// batched LLM call to score all messages, then selects the top-scoring ones.
pub async fn compress_history(
    query: &str,
    messages: &[(String, String)], // (role, content)
    target_count: usize,
) -> Result<CompressionResult, String> {
    if messages.len() <= target_count {
        return Ok(CompressionResult {
            keep_indices: (0..messages.len()).collect(),
            summary_of_dropped: String::new(),
        });
    }

    let scores = score_messages(query, messages).await?;

    // Sort by score descending
    let mut scored: Vec<(usize, f64)> = scores
        .into_iter()
        .map(|s| (s.index, s.score))
        .collect();
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

    // Take top target_count, then sort back to original order
    let mut keep_indices: Vec<usize> = scored
        .into_iter()
        .take(target_count)
        .map(|(idx, _)| idx)
        .collect();
    keep_indices.sort();

    // Summarize dropped messages
    let dropped_indices: Vec<usize> = (0..messages.len())
        .filter(|i| !keep_indices.contains(i))
        .collect();

    let summary = if dropped_indices.len() > 3 {
        summarize_dropped(query, messages, &dropped_indices).await.unwrap_or_default()
    } else {
        String::new()
    };

    Ok(CompressionResult {
        keep_indices,
        summary_of_dropped: summary,
    })
}

async fn score_messages(
    query: &str,
    messages: &[(String, String)],
) -> Result<Vec<MessageScore>, String> {
    let api_key = std::env::var("OPENCODE_ZEN_API_KEY")
        .map_err(|_| "OPENCODE_ZEN_API_KEY not set".to_string())?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| format!("Client build failed: {}", e))?;

    // Build a compact representation of messages
    let message_list: String = messages
        .iter()
        .enumerate()
        .map(|(i, (role, content))| {
            let preview = if content.len() > 120 {
                format!("{}...", &content[..120])
            } else {
                content.to_string()
            };
            format!("[{}] {}: {}", i, role, preview.replace('"', "\\\""))
        })
        .collect::<Vec<_>>()
        .join("\n");

    let safe_query = query.replace('"', "\\\"");

    let prompt = format!(
        r#"You are a context relevance scorer. Given a user query and a list of conversation messages, score EACH message's importance for answering the query.

Current query: "{safe_query}"

Messages:
{message_list}

For each message, output a JSON object with:
- "index": the message index
- "score": 0.0-1.0 (1.0 = critical, 0.0 = irrelevant)
- "reason": one-word reason (e.g., "defines_entity", "answers_query", "background", "filler")

Output ONLY a JSON array:
[{{"index": 0, "score": 0.9, "reason": "defines_entity"}}, ...]

Rules:
- Messages that define entities mentioned in the query score HIGH.
- Messages that directly answer or relate to the query score HIGH.
- Recent messages score slightly higher than old ones.
- Greetings, filler, or off-topic messages score LOW.
- Tool results that contain relevant data score HIGH.
- Output ONLY the JSON array. No markdown, no extra text."#
    );

    let request = json!({
        "model": "minimax-m2.5-free",
        "messages": [
            {"role": "system", "content": "You are a precise relevance scorer. Output ONLY valid JSON arrays."},
            {"role": "user", "content": prompt}
        ],
        "stream": false,
        "max_tokens": 2048
    });

    let response = client
        .post(API_BASE)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("API Error {}: {}", status, body));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))?;

    let raw_content = data["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("Missing response content")?;

    let cleaned = raw_content
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let scores: Vec<MessageScore> = serde_json::from_str(cleaned).map_err(|e| {
        format!(
            "Failed to parse message scores JSON: {} | raw: {}",
            e, raw_content
        )
    })?;

    Ok(scores)
}

async fn summarize_dropped(
    query: &str,
    messages: &[(String, String)],
    dropped_indices: &[usize],
) -> Result<String, String> {
    let api_key = std::env::var("OPENCODE_ZEN_API_KEY")
        .map_err(|_| "OPENCODE_ZEN_API_KEY not set".to_string())?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Client build failed: {}", e))?;

    let dropped_text: String = dropped_indices
        .iter()
        .map(|&i| {
            let (role, content) = &messages[i];
            format!("{}: {}", role, content.replace('"', "\\\""))
        })
        .collect::<Vec<_>>()
        .join("\n");

    let safe_query = query.replace('"', "\\\"");

    let prompt = format!(
        r#"Summarize the key facts from these dropped conversation messages that might be relevant to answering: "{safe_query}"

Messages:
{dropped_text}

Output a single concise sentence (max 30 words) capturing only the most important fact. If nothing is relevant, output "(no relevant context)".

Output ONLY the sentence, no extra text."#
    );

    let request = json!({
        "model": "minimax-m2.5-free",
        "messages": [
            {"role": "system", "content": "You are a concise summarizer. Output a single sentence."},
            {"role": "user", "content": prompt}
        ],
        "stream": false,
        "max_tokens": 128
    });

    let response = client
        .post(API_BASE)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    if !response.status().is_success() {
        return Ok(String::new());
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|_| String::new())?;

    let content = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();

    if content.is_empty() || content == "(no relevant context)" {
        Ok(String::new())
    } else {
        Ok(content)
    }
}
