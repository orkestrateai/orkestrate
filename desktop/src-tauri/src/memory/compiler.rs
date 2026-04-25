use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::db;
use crate::memory::schema;
use crate::timer::Timer;

const API_BASE: &str = "https://opencode.ai/zen/v1/chat/completions";

#[derive(Serialize)]
struct CompilerRequest {
    model: String,
    messages: Vec<serde_json::Value>,
    stream: bool,
    max_tokens: i32,
}

#[derive(Deserialize, Debug)]
struct CompilerChoice {
    message: CompilerMessage,
}

#[derive(Deserialize, Debug)]
struct CompilerMessage {
    content: String,
}

#[derive(Deserialize, Debug)]
struct CompilerResponse {
    choices: Vec<CompilerChoice>,
}

pub async fn compile(
    api_key: &str,
    uncompiled_episodes: &[db::Episode],
    active_contradictions: &[db::Contradiction],
) -> Result<String, String> {
    let _timer = Timer::new("memory::compiler");

    let client = reqwest::Client::new();
    let current_schema = schema::read_schema();

    let prompt = build_compiler_prompt(&current_schema, uncompiled_episodes, active_contradictions);

    let request = CompilerRequest {
        model: "minimax-m2.5-free".to_string(),
        messages: vec![
            json!({
                "role": "system",
                "content": "You are a schema compiler. Rewrite a user profile from raw data. Output ONLY markdown."
            }),
            json!({
                "role": "user",
                "content": prompt
            }),
        ],
        stream: false,
        max_tokens: 8192,
    };

    let response = client
        .post(API_BASE)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Compiler request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Compiler API Error {}: {}", status, body));
    }

    let data: CompilerResponse = response
        .json()
        .await
        .map_err(|e| format!("Compiler JSON parse error: {}", e))?;

    let new_schema = data
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();

    // Strip markdown code fences if present
    let new_schema = new_schema.trim();
    let new_schema = if new_schema.starts_with("```markdown") {
        new_schema
            .trim_start_matches("```markdown")
            .trim_end_matches("```")
            .trim()
    } else if new_schema.starts_with("```") {
        new_schema
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim()
    } else {
        new_schema
    };

    println!(
        "[Memory][Compiler] Writing schema ({} chars)",
        new_schema.len()
    );
    schema::write_schema(new_schema)?;
    Ok(new_schema.to_string())
}

fn build_compiler_prompt(
    current_schema: &str,
    episodes: &[db::Episode],
    contradictions: &[db::Contradiction],
) -> String {
    let episodes_json = serde_json::to_string_pretty(&json!({
        "episodes": episodes.iter().map(|e| json!({
            "content": e.content,
            "type": e.type_,
            "compression": e.compression_level,
            "section": e.schema_section
        })).collect::<Vec<_>>()
    }))
    .unwrap_or_default();

    let contradictions_text = contradictions
        .iter()
        .map(|c| {
            format!(
                "- Existing: '{}' | New evidence: '{}' | Pressure: {}",
                c.existing_content, c.new_evidence_content, c.pressure_score
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        r#"Rewrite the following user profile by incorporating new information and resolving contradictions.

Current profile:
{}

New episodes to integrate:
{}

Active contradictions:
{}

Rules:
1. Maintain the same markdown structure with sections: Identity, Projects, Relationships, Preferences, Patterns, Open Questions
2. Integrate new facts naturally into existing sections
3. For contradictions: preserve the trajectory. Example: "You used to prefer X but recently mentioned Y."
4. Remove resolved contradictions from the narrative
5. Update Open Questions based on what's still unknown
6. Be concise. Bullet points preferred. No fluff.

Output the complete rewritten profile as markdown."#,
        current_schema, episodes_json, contradictions_text
    )
}

pub fn should_compile(total_episodes: i64, contradictions: &[db::Contradiction]) -> bool {
    // Safety net: if profile is still default but episodes exist, compile now
    let current_schema = schema::read_schema();
    let is_default = current_schema.contains("Name: Unknown")
        && current_schema.contains("## Projects\n\n## Relationships");
    if is_default && total_episodes >= 3 {
        println!(
            "[Memory][Compiler] Forcing compilation: profile is default but {} episodes exist",
            total_episodes
        );
        return true;
    }

    // Early user: compile every 5 episodes to build profile fast
    if total_episodes > 0 && total_episodes < 50 {
        return total_episodes % 5 == 0;
    }
    // Growing profile: compile every 20 episodes
    if total_episodes >= 50 && total_episodes < 100 {
        return total_episodes % 20 == 0;
    }
    // Mature profile: compile every 50 episodes
    if total_episodes >= 100 && total_episodes % 50 == 0 {
        return true;
    }

    // Always compile on high-pressure contradictions
    for c in contradictions {
        let threshold = if c.existing_content.len() < 30 { 2 } else { 3 };
        if c.pressure_score >= threshold {
            return true;
        }
    }

    false
}
