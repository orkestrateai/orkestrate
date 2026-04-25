use async_trait::async_trait;
use serde_json::{json, Value};

use crate::db;

/// Tool for the agent to explicitly link two memories with a relationship.
/// This creates a graph edge between episodes, enabling multi-hop retrieval.
pub struct ConnectMemoriesTool;

#[async_trait]
impl crate::tools::Tool for ConnectMemoriesTool {
    fn name(&self) -> &'static str {
        "connect_memories"
    }

    fn description(&self) -> &'static str {
        "Create a directed relationship (edge) between two stored memories. \
Use this when you notice that two memories are related — e.g., one event \
caused another, one is a follow-up to another, or they share a common entity. \
This improves future retrieval by enabling graph-walk search. \
You need the episode IDs of both memories."
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "from_episode_id": {
                    "type": "string",
                    "description": "ID of the source memory episode"
                },
                "to_episode_id": {
                    "type": "string",
                    "description": "ID of the target memory episode"
                },
                "relation": {
                    "type": "string",
                    "enum": ["caused", "followed_by", "related_to", "contradicts", "refines"],
                    "description": "Type of relationship between the two memories"
                },
                "confidence": {
                    "type": "number",
                    "description": "Confidence that this relationship exists, 0.0 to 1.0"
                }
            },
            "required": ["from_episode_id", "to_episode_id", "relation", "confidence"]
        })
    }

    async fn execute(&self, args: Value) -> Result<String, String> {
        let from_id = args["from_episode_id"]
            .as_str()
            .ok_or("Missing 'from_episode_id' parameter")?;
        let to_id = args["to_episode_id"]
            .as_str()
            .ok_or("Missing 'to_episode_id' parameter")?;
        let relation = args["relation"]
            .as_str()
            .ok_or("Missing 'relation' parameter")?;
        let confidence = args["confidence"]
            .as_f64()
            .ok_or("Missing 'confidence' parameter")?;

        if confidence < 0.7 {
            return Err(format!(
                "Confidence {} is below minimum threshold of 0.7. Connection not stored.",
                confidence
            ));
        }

        // Verify both episodes exist
        let from_exists = db::get_episode(from_id).map_err(|e| e.to_string())?.is_some();
        let to_exists = db::get_episode(to_id).map_err(|e| e.to_string())?.is_some();

        if !from_exists {
            return Err(format!("Source episode '{}' not found", from_id));
        }
        if !to_exists {
            return Err(format!("Target episode '{}' not found", to_id));
        }

        db::store_episode_edge(
            from_id,
            to_id,
            relation,
            confidence,
            None,
        )
        .map_err(|e| format!("Failed to store connection: {}", e))?;

        Ok(format!(
            "Connected episode {} → {} with relation '{}' (confidence={:.2})",
            from_id, to_id, relation, confidence
        ))
    }
}
