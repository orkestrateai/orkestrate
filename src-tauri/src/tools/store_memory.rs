use async_trait::async_trait;
use serde_json::{json, Value};

use crate::db;

/// Tool for the agent to proactively store a high-confidence memory.
/// Also generates embedding and extracts entities automatically.
pub struct StoreMemoryTool;

#[async_trait]
impl crate::tools::Tool for StoreMemoryTool {
    fn name(&self) -> &'static str {
        "store_memory"
    }

    fn description(&self) -> &'static str {
        "Store a factual observation about the user into long-term memory. \
Use this when the user shares something clearly worth remembering \
that you want to ensure is captured. Only store atomic, specific facts. \
Do NOT store vague impressions, guesses, or low-confidence observations. \
This tool stores silently — the user will not see a confirmation. \
If the memory mentions specific people, projects, or places, they will be \
automatically extracted and linked for entity-graph retrieval."
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "The atomic factual observation to store. Be specific and concise."
                },
                "type": {
                    "type": "string",
                    "enum": ["fact", "preference", "goal", "relationship", "habit"],
                    "description": "Category of the memory."
                },
                "confidence": {
                    "type": "number",
                    "description": "Your confidence in this observation, 0.0 to 1.0. Must be >= 0.8."
                }
            },
            "required": ["content", "type", "confidence"]
        })
    }

    async fn execute(&self, args: Value) -> Result<String, String> {
        let content = args["content"]
            .as_str()
            .ok_or("Missing 'content' parameter")?;
        let type_ = args["type"]
            .as_str()
            .ok_or("Missing 'type' parameter")?;
        let confidence = args["confidence"]
            .as_f64()
            .ok_or("Missing 'confidence' parameter")?;

        if confidence < 0.8 {
            return Err(format!(
                "Confidence {} is below minimum threshold of 0.8. Memory not stored.",
                confidence
            ));
        }

        let valid_types = ["fact", "preference", "goal", "relationship", "habit"];
        if !valid_types.contains(&type_) {
            return Err(format!("Invalid type '{}'. Must be one of: {:?}", type_, valid_types));
        }

        // Map type to schema section
        let schema_section = match type_ {
            "fact" => "identity",
            "preference" => "preferences",
            "goal" => "goals",
            "relationship" => "relationships",
            "habit" => "patterns",
            _ => "identity",
        };

        // Generate embedding via Ollama/OpenRouter
        let (embedding, provider) = match crate::embed::embed(content).await {
            Ok((emb, prov)) => (Some(emb), prov.model_name()),
            Err(e) => {
                eprintln!("[StoreMemory] Embedding failed: {}, storing without embedding", e);
                (None, "none")
            }
        };

        let id = db::store_episode_with_embedding(
            content,
            type_,
            confidence,
            confidence, // importance same as confidence for agent-stored memories
            "semantic",
            Some(schema_section),
            None, // no specific session for agent-stored memories
            embedding.as_deref(),
            Some(provider),
        )
        .map_err(|e| format!("Failed to store memory: {}", e))?;

        // Extract simple entities from content (capitalized words heuristic)
        let words: Vec<&str> = content.split_whitespace().collect();
        for (i, word) in words.iter().enumerate() {
            let cleaned: String = word.trim_matches(|c: char| !c.is_alphanumeric()).to_string();
            if cleaned.len() > 2 
                && cleaned.chars().next().map(|c| c.is_uppercase()).unwrap_or(false)
                && !cleaned.starts_with("I")
                && !cleaned.starts_with("A")
                && !cleaned.starts_with("The")
                && !cleaned.starts_with("It")
            {
                // Determine entity type heuristically
                let ent_type = if i > 0 && words.get(i.saturating_sub(1)).map(|w| w.to_lowercase()) == Some("project".to_string()) {
                    "project"
                } else if i > 0 && words.get(i.saturating_sub(1)).map(|w| w.to_lowercase()) == Some("person".to_string()) {
                    "person"
                } else {
                    "entity"
                };

                match db::store_entity(&cleaned, ent_type, Some(&cleaned.to_lowercase())) {
                    Ok(entity_id) => {
                        if let Err(e) = db::link_episode_entity(&id, &entity_id, "mentioned", false) {
                            eprintln!("[StoreMemory] Failed to link entity: {}", e);
                        }
                    }
                    Err(e) => eprintln!("[StoreMemory] Failed to store entity: {}", e),
                }
            }
        }

        Ok(format!("Memory stored successfully with id={}.", id))
    }
}
