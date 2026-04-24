use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::HistoryMessage;
use crate::memory::schema;
use crate::timer::Timer;

const API_BASE: &str = "https://opencode.ai/zen/v1/chat/completions";

#[derive(Serialize)]
struct ExtractorRequest {
    model: String,
    messages: Vec<serde_json::Value>,
    stream: bool,
    max_tokens: i32,
}

#[derive(Deserialize, Debug)]
struct ExtractorChoice {
    message: ExtractorMessage,
}

#[derive(Deserialize, Debug)]
struct ExtractorMessage {
    content: String,
}

#[derive(Deserialize, Debug)]
struct ExtractorResponse {
    choices: Vec<ExtractorChoice>,
}

#[derive(Debug, Clone)]
pub struct ExtractedCandidate {
    pub content: String,
    pub type_: String,
    pub confidence: f64,
    pub suggested_section: String,
    pub entities: Vec<(String, String)>, // (name, entity_type)
}

#[derive(Debug, Clone)]
pub struct RawInference {
    pub content: String,
    pub confidence: f64,
}

#[derive(Debug, Clone)]
pub struct ExtractionResult {
    pub candidates: Vec<ExtractedCandidate>,
    pub raw_inferences: Vec<RawInference>,
}

pub async fn extract(
    api_key: &str,
    messages: &[HistoryMessage],
) -> Result<ExtractionResult, String> {
    let _timer = Timer::new("memory::triage_extractor");

    let client = reqwest::Client::new();
    let user_md = schema::read_schema();

    let prompt = build_extraction_prompt(messages, &user_md);

    let request = ExtractorRequest {
        model: "minimax-m2.5-free".to_string(),
        messages: vec![json!({
            "role": "system",
            "content": "You are a memory extraction system. Extract facts and inferences from conversation turns. Output ONLY valid JSON."
        }), json!({
            "role": "user",
            "content": prompt
        })],
        stream: false,
        max_tokens: 4096,
    };

    let response = client
        .post(API_BASE)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Extractor request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Extractor API Error {}: {}", status, body));
    }

    let data: ExtractorResponse = response
        .json()
        .await
        .map_err(|e| format!("Extractor JSON parse error: {}", e))?;

    let content = data
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();

    parse_extraction_output(&content)
}

fn build_extraction_prompt(messages: &[HistoryMessage], user_md: &str) -> String {
    let conversation = messages
        .iter()
        .map(|m| format!("{}: {}", m.role, m.content))
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        r#"Current user profile:
{}

Recent conversation:
{}

Your job is to extract EVERY distinct, atomic memory from this conversation. Do not summarize — atomize.

If the user says three things, extract three (or more) separate memories.

For each candidate, also extract any named entities mentioned (people, projects, companies, places, products).
Use the exact name as it appears in the text. Entity types: person, project, company, place, product, event.

Output JSON in this exact format:
{{
  "candidates": [
    {{
      "content": "User likes calling the assistant 'Orky'",
      "type": "preference",
      "confidence": 0.95,
      "suggested_section": "preferences",
      "entities": [
        {{"name": "Orky", "type": "product"}}
      ]
    }},
    {{
      "content": "User is working on project Keiyara with Karan",
      "type": "fact",
      "confidence": 0.9,
      "suggested_section": "projects",
      "entities": [
        {{"name": "Keiyara", "type": "project"}},
        {{"name": "Karan", "type": "person"}}
      ]
    }}
  ],
  "raw_inferences": [
    {{
      "content": "User has an informal, playful communication style",
      "confidence": 0.55
    }}
  ]
}}

Types for candidates:
- fact: something objectively true about the user or their world
- preference: likes, dislikes, choices the user actively states
- goal: stated intentions or targets
- relationship: dynamics with people, brands, or entities
- habit: recurring behaviors or patterns
- trait: personality or communication characteristics

Entity extraction rules:
- Extract ALL named entities in each candidate's content
- Use exact names as they appear in text
- Types: person, project, company, place, product, event
- If no entities, use empty array []

Confidence rules:
- candidates: explicit statements the user made (0.6–1.0)
- raw_inferences: things you can reasonably guess but the user did not explicitly say (0.3–0.59)

Rules:
1. Extract MULTIPLE candidates per turn when multiple facts are present.
2. Each candidate must be ONE atomic statement. Do not merge.
3. If the user says "I like X and I also do Y", that's two candidates.
4. Capture exact names, nicknames, and specific wording when relevant.
5. Extract entities for EVERY candidate — this is critical for memory graph accuracy.
6. If nothing worth extracting, return empty arrays."#,
        user_md, conversation
    )
}

fn parse_extraction_output(content: &str) -> Result<ExtractionResult, String> {
    let json_str = content.trim();
    let json_str = if json_str.starts_with("```json") {
        json_str.trim_start_matches("```json").trim_end_matches("```").trim()
    } else if json_str.starts_with("```") {
        json_str.trim_start_matches("```").trim_end_matches("```").trim()
    } else {
        json_str
    };

    let parsed: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse extractor JSON: {} | Raw: {}", e, content))?;

    let mut candidates = Vec::new();
    if let Some(arr) = parsed.get("candidates").and_then(|v| v.as_array()) {
        for item in arr {
            if let (Some(content), Some(type_), Some(confidence), Some(section)) = (
                item.get("content").and_then(|v| v.as_str()),
                item.get("type").and_then(|v| v.as_str()),
                item.get("confidence").and_then(|v| v.as_f64()),
                item.get("suggested_section").and_then(|v| v.as_str()),
            ) {
                // Parse entities
                let mut entities = Vec::new();
                if let Some(ent_arr) = item.get("entities").and_then(|v| v.as_array()) {
                    for ent in ent_arr {
                        if let (Some(name), Some(ent_type)) = (
                            ent.get("name").and_then(|v| v.as_str()),
                            ent.get("type").and_then(|v| v.as_str()),
                        ) {
                            entities.push((name.to_string(), ent_type.to_string()));
                        }
                    }
                }

                candidates.push(ExtractedCandidate {
                    content: content.to_string(),
                    type_: type_.to_string(),
                    confidence,
                    suggested_section: section.to_string(),
                    entities,
                });
            }
        }
    }

    let mut raw_inferences = Vec::new();
    if let Some(arr) = parsed.get("raw_inferences").and_then(|v| v.as_array()) {
        for item in arr {
            if let (Some(content), Some(confidence)) = (
                item.get("content").and_then(|v| v.as_str()),
                item.get("confidence").and_then(|v| v.as_f64()),
            ) {
                raw_inferences.push(RawInference {
                    content: content.to_string(),
                    confidence,
                });
            }
        }
    }

    Ok(ExtractionResult {
        candidates,
        raw_inferences,
    })
}
