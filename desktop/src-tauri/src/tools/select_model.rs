use async_trait::async_trait;
use serde_json::{json, Value};

use super::Tool;

pub struct SelectModelTool;

#[async_trait]
impl Tool for SelectModelTool {
    fn name(&self) -> &'static str {
        "select_model"
    }

    fn description(&self) -> &'static str {
        "Switch the active LLM model. Available models: nemotron-3-super-free, minimax-m2.5-free, big-pickle."
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "model": {
                    "type": "string",
                    "enum": [
                        "nemotron-3-super-free",
                        "minimax-m2.5-free",
                        "big-pickle"
                    ],
                    "description": "The model ID to switch to"
                }
            },
            "required": ["model"]
        })
    }

    async fn execute(&self, args: Value) -> Result<String, String> {
        let model = args["model"]
            .as_str()
            .ok_or("Missing 'model' argument")?;

        let valid_models = [
            "nemotron-3-super-free",
            "minimax-m2.5-free",
            "big-pickle",
        ];

        if valid_models.contains(&model) {
            Ok(format!("Model switched to {}", model))
        } else {
            Err(format!(
                "Invalid model: {}. Available: {:?}",
                model, valid_models
            ))
        }
    }
}
