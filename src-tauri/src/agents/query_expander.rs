use serde::{Deserialize, Serialize};
use serde_json::json;

/// A single expanded query with its intent and priority.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpandedQuery {
    pub query: String,
    pub intent: String,
    pub priority: i32, // 1-10, higher = more important
    pub category: String, // "entity", "relationship", "constraint", "state", "pattern", "recent_context"
}

/// Expand a user prompt into multiple memory search queries.
/// This is Agent Alpha's Hop 1 — intent decomposition.
pub async fn expand_query(prompt: &str, api_key: &str) -> Result<Vec<ExpandedQuery>, String> {
    let client = reqwest::Client::new();

    let system_prompt = r#"You are a Query Expander for an AI memory system.

Given a user message, generate 8-15 search queries that would retrieve ALL relevant context needed to respond optimally.

For each query, specify:
- query: The actual search string (dense keyword cluster, optimized for semantic similarity)
- intent: What you're trying to find out
- priority: 1-10 (10 = absolutely critical, 1 = nice to have)
- category: One of [entity, relationship, constraint, state, pattern, recent_context, goal]

Think broadly. The user might be:
- Stating a fact ("I have a meeting tomorrow")
- Asking a question ("What should I cook?")
- Expressing emotion ("I'm worried about Mia")
- Making a decision ("Should I quit my job?")

For each, ask:
1. Who/what entities are mentioned? What do we know about them?
2. What's the relationship context?
3. Are there hard constraints (dietary, time, financial, emotional)?
4. What's the user's current emotional state?
5. Are there relevant patterns from history?
6. What's happened recently that might matter?
7. What is the user ACTUALLY asking for (stated vs inferred)?

Output ONLY valid JSON. No markdown, no explanations."#;

    let user_prompt = format!(
        r#"User message: "{}"

Generate the expanded search queries."#,
        prompt.replace('"', "\\\"")
    );

    let resp = client
        .post("https://opencode.ai/zen/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&json!({
            "model": "nemotron-3-super-free",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "stream": false,
            "temperature": 0.3,
            "max_tokens": 2000
        }))
        .send()
        .await
        .map_err(|e| format!("query expander request failed: {}", e))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("query expander response parse failed: {}", e))?;

    let content = body["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("missing content in expander response")?;

    // Extract JSON from potential markdown code blocks
    let json_str = extract_json(content);

    let queries: Vec<ExpandedQuery> = serde_json::from_str(&json_str)
        .map_err(|e| format!("failed to parse expanded queries: {} | raw: {}", e, json_str))?;

    // Sort by priority descending
    let mut queries = queries;
    queries.sort_by(|a, b| b.priority.cmp(&a.priority));

    Ok(queries)
}

/// Extract JSON from a string that might be wrapped in markdown code blocks.
fn extract_json(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.starts_with("```") {
        // Remove first line (```json) and last line (```)
        let lines: Vec<&str> = trimmed.lines().collect();
        if lines.len() >= 2 {
            return lines[1..lines.len() - 1].join("\n");
        }
    }
    trimmed.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_json() {
        let md = "```json\n[{\"query\": \"test\"}]\n```";
        assert_eq!(extract_json(md), "[{\"query\": \"test\"}]");
    }
}
