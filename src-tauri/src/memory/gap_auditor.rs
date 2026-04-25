use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::db;
use crate::memory::schema;
use crate::timer::Timer;

const API_BASE: &str = "https://opencode.ai/zen/v1/chat/completions";

#[derive(Serialize)]
struct AuditorRequest {
    model: String,
    messages: Vec<serde_json::Value>,
    stream: bool,
    max_tokens: i32,
}

#[derive(Deserialize, Debug)]
struct AuditorChoice {
    message: AuditorMessage,
}

#[derive(Deserialize, Debug)]
struct AuditorMessage {
    content: String,
}

#[derive(Deserialize, Debug)]
struct AuditorResponse {
    choices: Vec<AuditorChoice>,
}

#[derive(Debug, Clone)]
pub struct GapObservation {
    pub section: String,
    pub observation: String,
    pub severity: f64,
}

#[derive(Debug, Clone)]
pub struct AuditorResult {
    pub gaps: Vec<GapObservation>,
}

/// Run the Gap Auditor over recent episodes and the current schema.
/// Returns gap observations that represent negative space — what is missing
/// or under-developed despite signals in the raw data.
pub async fn audit(
    api_key: &str,
    recent_episodes: &[db::Episode],
) -> Result<AuditorResult, String> {
    let _timer = Timer::new("memory::gap_auditor");

    if recent_episodes.is_empty() {
        return Ok(AuditorResult { gaps: vec![] });
    }

    let client = reqwest::Client::new();
    let user_md = schema::read_schema();

    let prompt = build_auditor_prompt(&user_md, recent_episodes);

    let request = AuditorRequest {
        model: "minimax-m2.5-free".to_string(),
        messages: vec![json!({
            "role": "system",
            "content": "You are a gap detection system. Find missing or under-developed areas in a user profile. Output ONLY valid JSON."
        }), json!({
            "role": "user",
            "content": prompt
        })],
        stream: false,
        max_tokens: 8192,
    };

    let response = client
        .post(API_BASE)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Auditor request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Auditor API Error {}: {}", status, body));
    }

    let data: AuditorResponse = response
        .json()
        .await
        .map_err(|e| format!("Auditor JSON parse error: {}", e))?;

    let content = data
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();

    parse_auditor_output(&content)
}

fn build_auditor_prompt(user_md: &str, episodes: &[db::Episode]) -> String {
    let episodes_json = serde_json::to_string_pretty(&json!({
        "episodes": episodes.iter().map(|e| json!({
            "content": e.content,
            "type": e.type_,
            "section": e.schema_section,
            "compression": e.compression_level
        })).collect::<Vec<_>>()
    })).unwrap_or_default();

    format!(
        r#"Current compiled user profile:
{}

Recent raw episodes:
{}

Detect gaps — missing or under-developed areas in the profile. Consider:
1. Empty sections that should have content based on the episodes
2. Sections mentioned in episodes but entirely missing from the profile
3. Under-developed areas where many episodes exist but the compiled profile is thin
4. Logical next questions that remain unanswered

Output JSON:
{{
  "gaps": [
    {{
      "section": "projects",
      "observation": "User has mentioned building a coding agent but hasn't named it or described its target users",
      "severity": 0.8
    }}
  ]
}}

Rules:
- Only include gaps with severity >= 0.75
- Be specific and concrete. "User mentioned a new job but hasn't said what field" NOT "More info needed about work"
- Do NOT create generic gaps like "user hasn't discussed family" unless episodes strongly imply family is relevant
- Do NOT flag absence of information the user has no reason to have shared
- Severity: 0.75 = minor gap, 0.9 = critical missing piece
- If no significant gaps, return empty array
- MAXIMUM 3 gaps per run. If you have more than 3, keep only the most severe."#,
        user_md, episodes_json
    )
}

fn parse_auditor_output(content: &str) -> Result<AuditorResult, String> {
    let json_str = content.trim();
    let json_str = if json_str.starts_with("```json") {
        json_str.trim_start_matches("```json").trim_end_matches("```").trim()
    } else if json_str.starts_with("```") {
        json_str.trim_start_matches("```").trim_end_matches("```").trim()
    } else {
        json_str
    };

    let parsed: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse auditor JSON: {} | Raw: {}", e, content))?;

    let mut gaps = Vec::new();
    if let Some(arr) = parsed.get("gaps").and_then(|v| v.as_array()) {
        for item in arr {
            if let (Some(section), Some(observation), Some(severity)) = (
                item.get("section").and_then(|v| v.as_str()),
                item.get("observation").and_then(|v| v.as_str()),
                item.get("severity").and_then(|v| v.as_f64()),
            ) {
                if severity >= 0.75 {
                    gaps.push(GapObservation {
                        section: section.to_string(),
                        observation: observation.to_string(),
                        severity,
                    });
                }
            }
        }
    }

    // Cap to 3 most severe gaps
    gaps.sort_by(|a, b| b.severity.partial_cmp(&a.severity).unwrap());
    gaps.truncate(3);

    Ok(AuditorResult { gaps })
}

/// Store gap observations as ephemeral episodes AND create learn queue items
/// so the agent can proactively ask the user to fill them in.
pub fn store_gaps(gaps: &[GapObservation], session_id: Option<&str>) -> Result<(), String> {
    for gap in gaps {
        let episode_id = db::store_episode(
            &format!("[GAP] {}: {}", gap.section, gap.observation),
            "gap",
            gap.severity,
            gap.severity,
            "ephemeral",
            Some(&gap.section),
            session_id,
        )?;

        // Generate a natural question from the gap observation
        let question = generate_gap_question(&gap.section, &gap.observation);
        let _ = db::store_learn_item(
            "gap",
            &question,
            Some(&gap.observation),
            Some(&episode_id),
        );
    }

    // Trigger background question generation if needed
    crate::memory::learn::trigger_background_question_generation();

    Ok(())
}

fn generate_gap_question(section: &str, observation: &str) -> String {
    // Simple template-based question generation
    // In the future this could be an LLM call for more natural phrasing
    let lower = observation.to_lowercase();
    if lower.contains("hasn't said") || lower.contains("hasn't mentioned") || lower.contains("never said") {
        observation.replace("User", "You").replace("hasn't", "haven't").replace("never said", "never mentioned") + ". Mind filling me in?"
    } else if lower.contains("missing") || lower.contains("unclear") {
        format!("I'm a bit unclear about your {}. {}", section, observation.replace("User", "you"))
    } else {
        format!("You mentioned something about {} but I didn't catch the details. {}", section, observation.replace("User", "you"))
    }
}
