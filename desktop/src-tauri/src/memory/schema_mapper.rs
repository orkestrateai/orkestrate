use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::db;
use crate::memory::schema;
use crate::memory::triage_extractor::ExtractedCandidate;
use crate::timer::Timer;

const API_BASE: &str = "https://opencode.ai/zen/v1/chat/completions";

#[derive(Serialize)]
struct MapperRequest {
    model: String,
    messages: Vec<serde_json::Value>,
    stream: bool,
    max_tokens: i32,
}

#[derive(Deserialize, Debug)]
struct MapperChoice {
    message: MapperMessage,
}

#[derive(Deserialize, Debug)]
struct MapperMessage {
    content: String,
}

#[derive(Deserialize, Debug)]
struct MapperResponse {
    choices: Vec<MapperChoice>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct SchemaPatch {
    pub section: String,
    pub action: String, // set | add | remove
    pub value: String,
    pub compression: String, // ephemeral | episodic | semantic | rule
}

#[derive(Debug, Clone)]
pub struct NewEpisode {
    pub content: String,
    pub type_: String,
    pub confidence: f64,
    pub importance: f64,
    pub compression_level: String,
    pub schema_section: String,
    pub entities: Vec<(String, String)>, // (name, entity_type)
}

#[derive(Debug, Clone)]
pub struct ContradictionCandidate {
    pub existing_episode_id: String,
    pub existing_content: String,
    pub new_evidence: String,
    #[allow(dead_code)]
    pub pressure_score: i64,
}

#[derive(Debug, Clone)]
pub struct MapperResult {
    #[allow(dead_code)]
    pub schema_patches: Vec<SchemaPatch>,
    pub new_episodes: Vec<NewEpisode>,
    pub contradictions: Vec<ContradictionCandidate>,
}

pub async fn map(
    api_key: &str,
    candidates: &[ExtractedCandidate],
    semantic_contexts: &[Vec<(String, String, f32)>],
) -> Result<MapperResult, String> {
    let _timer = Timer::new("memory::schema_mapper");

    if candidates.is_empty() {
        return Ok(MapperResult {
            schema_patches: vec![],
            new_episodes: vec![],
            contradictions: vec![],
        });
    }

    let client = reqwest::Client::new();
    let user_md = schema::read_schema();

    // Load recent episodes for contradiction detection (reduced to 5)
    let existing_episodes = db::load_recent_episodes(5).unwrap_or_default();

    let prompt = build_mapper_prompt(candidates, &user_md, &existing_episodes, semantic_contexts);

    let request = MapperRequest {
        model: "minimax-m2.5-free".to_string(),
        messages: vec![json!({
            "role": "system",
            "content": "You are a schema mapping system. Map extracted facts to a user profile schema. Output ONLY valid JSON."
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
        .map_err(|e| format!("Mapper request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Mapper API Error {}: {}", status, body));
    }

    let data: MapperResponse = response
        .json()
        .await
        .map_err(|e| format!("Mapper JSON parse error: {}", e))?;

    let content = data
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();

    parse_mapper_output(&content)
}

fn build_mapper_prompt(
    candidates: &[ExtractedCandidate],
    user_md: &str,
    existing_episodes: &[db::Episode],
    semantic_contexts: &[Vec<(String, String, f32)>],
) -> String {
    // Build per-candidate blocks with their semantic context
    let empty_context: Vec<(String, String, f32)> = vec![];
    let candidate_blocks: Vec<String> = candidates.iter().enumerate().map(|(idx, c)| {
        let context = semantic_contexts.get(idx).unwrap_or(&empty_context);
        let similar_json = serde_json::to_string_pretty(&json!({
            "semantically_similar_memories": context.iter().map(|(id, content, sim)| json!({
                "id": id,
                "content": content,
                "similarity_score": sim
            })).collect::<Vec<_>>()
        })).unwrap_or_default();

        format!(
            "Candidate {}:\ncontent: {}\ntype: {}\nconfidence: {}\nsuggested_section: {}\n\nSemantic context (top similar memories):\n{}",
            idx + 1, c.content, c.type_, c.confidence, c.suggested_section, similar_json
        )
    }).collect();

    let candidates_text = candidate_blocks.join("\n\n---\n\n");

    let existing_json = serde_json::to_string_pretty(&json!({
        "recent_existing_episodes": existing_episodes.iter().map(|e| json!({
            "id": e.id,
            "content": e.content,
            "type": e.type_,
            "schema_section": e.schema_section
        })).collect::<Vec<_>>()
    })).unwrap_or_default();

    format!(
        r#"Current user profile:
{}

Extracted candidates with semantic context:
{}

Recent existing episodes (check for contradictions):
{}

For each candidate, decide:
1. Is it new? → add to new_episodes
2. Does it conflict with or refine an existing memory? → add to contradictions
3. Is it core identity info? → add to schema_patches

The semantic context shows the most similar existing memories with similarity scores (0-1, higher = more similar).
Memories with similarity > 0.85 have already been filtered as duplicates.
Use the semantic context to detect contradictions that keyword search would miss.

Output JSON:
{{
  "schema_patches": [],
  "new_episodes": [
    {{
      "content": "factual statement",
      "type": "preference",
      "confidence": 0.95,
      "importance": 0.8,
      "compression_level": "semantic",
      "schema_section": "preferences",
      "entities": [
        {{"name": "EntityName", "type": "person"}}
      ]
    }}
  ],
  "contradictions": [
    {{
      "existing_episode_id": "id_from_existing",
      "existing_content": "User prefers to call the assistant 'Orky'",
      "new_evidence": "User now says they prefer to call the assistant 'Ork'",
      "pressure_score": 1
    }}
  ]
}}

Compression levels:
- rule: core identity facts (name, core values) — permanent
- semantic: durable preferences, relationships — long-term but updatable
- episodic: specific events, mentions — medium-term
- ephemeral: passing mentions, uncertain — may decay

Contradiction rules — BE STRICT. Most candidates do NOT create contradictions:
- Direct conflict ONLY: old says X, new says not-X (e.g., "lives in NYC" vs "lives in LA")
- Refinement ONLY when detail is meaningfully different: old says X, new says X with incompatible detail
- Do NOT create contradictions for: related topics, additional info, elaborations, or synonyms
- Do NOT create contradictions for confidence differences or minor wording changes
- If unsure, do NOT create a contradiction — bias toward empty contradictions array

NON-CONTRADICTION examples (do NOT flag these):
- "likes pizza" + "had pizza for dinner" → NOT a contradiction (elaboration)
- "works at Google" + "works in tech" → NOT a contradiction (generalization)
- "prefers tea" + "drinks coffee sometimes" → NOT a contradiction (additional preference)
- "lives in Brooklyn" + "lives in New York" → NOT a contradiction (Brooklyn is in NYC)

CONTRADICTION examples (ONLY flag these):
- "lives in NYC" + "moved to Chicago last month" → contradiction
- "hates cilantro" + "cilantro is my favorite herb" → contradiction
- "single" + "got married yesterday" → contradiction

pressure_score is always 1 for new contradictions"#,
        user_md, candidates_text, existing_json
    )
}

fn parse_mapper_output(content: &str) -> Result<MapperResult, String> {
    let json_str = content.trim();
    let json_str = if json_str.starts_with("```json") {
        json_str.trim_start_matches("```json").trim_end_matches("```").trim()
    } else if json_str.starts_with("```") {
        json_str.trim_start_matches("```").trim_end_matches("```").trim()
    } else {
        json_str
    };

    let parsed: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse mapper JSON: {} | Raw: {}", e, content))?;

    let mut schema_patches = Vec::new();
    if let Some(arr) = parsed.get("schema_patches").and_then(|v| v.as_array()) {
        for item in arr {
            if let (Some(section), Some(action), Some(value), Some(compression)) = (
                item.get("section").and_then(|v| v.as_str()),
                item.get("action").and_then(|v| v.as_str()),
                item.get("value").and_then(|v| v.as_str()),
                item.get("compression").and_then(|v| v.as_str()),
            ) {
                schema_patches.push(SchemaPatch {
                    section: section.to_string(),
                    action: action.to_string(),
                    value: value.to_string(),
                    compression: compression.to_string(),
                });
            }
        }
    }

    let mut new_episodes = Vec::new();
    if let Some(arr) = parsed.get("new_episodes").and_then(|v| v.as_array()) {
        for item in arr {
            if let (Some(content), Some(type_), Some(confidence), Some(importance), Some(compression), Some(section)) = (
                item.get("content").and_then(|v| v.as_str()),
                item.get("type").and_then(|v| v.as_str()),
                item.get("confidence").and_then(|v| v.as_f64()),
                item.get("importance").and_then(|v| v.as_f64()),
                item.get("compression_level").and_then(|v| v.as_str()),
                item.get("schema_section").and_then(|v| v.as_str()),
            ) {
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

                new_episodes.push(NewEpisode {
                    content: content.to_string(),
                    type_: type_.to_string(),
                    confidence,
                    importance,
                    compression_level: compression.to_string(),
                    schema_section: section.to_string(),
                    entities,
                });
            }
        }
    }

    let mut contradictions = Vec::new();
    if let Some(arr) = parsed.get("contradictions").and_then(|v| v.as_array()) {
        for item in arr {
            if let (Some(existing_id), Some(existing), Some(new_evidence)) = (
                item.get("existing_episode_id").and_then(|v| v.as_str()),
                item.get("existing_content").and_then(|v| v.as_str()),
                item.get("new_evidence").and_then(|v| v.as_str()),
            ) {
                contradictions.push(ContradictionCandidate {
                    existing_episode_id: existing_id.to_string(),
                    existing_content: existing.to_string(),
                    new_evidence: new_evidence.to_string(),
                    pressure_score: item.get("pressure_score").and_then(|v| v.as_i64()).unwrap_or(1),
                });
            }
        }
    }

    Ok(MapperResult {
        schema_patches,
        new_episodes,
        contradictions,
    })
}
