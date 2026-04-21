use serde::{Deserialize, Serialize};
use serde_json::json;

/// A classified memory extraction ready for storage.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassifiedMemory {
    pub capacity: String, // entity, relationship, history, constraint, state, goal, pattern
    pub content: String,
    pub confidence: f32,
    #[serde(default)]
    pub entities_involved: Vec<String>,
    #[serde(default)]
    pub related_turn_id: String,
}

/// Storage Classifier — determines what type of memory capacity a piece of information belongs to.
/// This is Epsilon's first step before routing to specialized agents.
pub async fn classify_storage(
    user_message: &str,
    assistant_response: &str,
    _turn_id: &str,
    api_key: &str,
) -> Result<Vec<ClassifiedMemory>, String> {
    let client = reqwest::Client::new();

    let system_prompt = r#"You are a Memory Storage Classifier for an AI companion.

Your job: analyze a conversation turn and classify every piece of information worth remembering into one of 7 memory capacities.

## The 7 Capacities

1. **entity** — A person, place, project, concept, or thing mentioned. Include type, any new facts, and how it connects to the user's life.
   Example: "Mia is a close friend of the user, currently stressed about work"

2. **relationship** — How two entities interact, their dynamic, tension, or bond.
   Example: "User tends to offer practical help (cooking) when Mia needs emotional presence"

3. **history** — A discrete event that happened. What, when, who, outcome.
   Example: "User cooked for Mia while she was stressed. Mia appreciated it but seemed distant."

4. **constraint** — A hard limit: dietary, financial, time, energy, skill, emotional boundary, allergy.
   Example: "User is vegetarian. Mia has shellfish allergy. User is a beginner cook."

5. **state** — The user's emotional/situational snapshot. What they feel, what they need but haven't asked for.
   Example: "User is worried about Mia but defaults to practical gestures. Underlying need: reassurance that they're a good friend."

6. **goal** — What the user wants (stated or inferred). Active objectives, open loops.
   Example: "User wants to comfort Mia. Open loop: didn't resolve whether Mia wants company or space."

7. **pattern** — A recurring behavior, tendency, or cycle.
   Example: "User consistently offers food/gifts when people are upset instead of emotional conversation"

## Output Format
Output a JSON array of objects. Each object MUST have these exact fields:
- `capacity`: One of ["entity", "relationship", "history", "constraint", "state", "goal", "pattern"]
- `content`: The extracted information as a concise sentence
- `confidence`: Float 0.0-1.0
- `entities_involved`: Array of strings (names of entities involved, e.g. ["Mia", "user"]). Use ["user"] if only the user is involved.

## Rules
- Extract BOTH explicit facts AND implicit inferences (read between the lines)
- Confidence: 0.0-1.0. Be conservative — 0.9+ only for direct statements, 0.5-0.7 for inferences
- Every entity mentioned gets an entity entry
- Every interaction between entities gets a relationship entry
- Always include `entities_involved` as an array, even if empty
- If you can't determine a capacity, skip it — don't force it
- Focus on information that would help future responses be optimal

Output ONLY valid JSON array. No markdown, no explanations."#;

    let user_prompt = format!(
        r#"User: {}
Assistant: {}

Classify all memorable information from this turn."#,
        user_message.replace('"', "\\\""),
        assistant_response.replace('"', "\\\"")
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
            "temperature": 0.2,
            "max_tokens": 2500
        }))
        .send()
        .await
        .map_err(|e| format!("storage classifier request failed: {}", e))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("storage classifier response parse failed: {}", e))?;

    let content = body["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("missing content in classifier response")?;

    let json_str = extract_json(content);

    let memories: Vec<ClassifiedMemory> = serde_json::from_str(&json_str)
        .map_err(|e| format!("failed to parse classified memories: {} | raw: {}", e, json_str))?;

    // Filter out low-confidence extractions
    let memories: Vec<ClassifiedMemory> = memories
        .into_iter()
        .filter(|m| m.confidence >= 0.4)
        .collect();

    Ok(memories)
}

fn extract_json(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.starts_with("```") {
        let lines: Vec<&str> = trimmed.lines().collect();
        if lines.len() >= 2 {
            return lines[1..lines.len() - 1].join("\n");
        }
    }
    trimmed.to_string()
}
