use async_trait::async_trait;
use serde_json::{json, Value};

use super::Tool;

pub struct SetThemeTool;

#[async_trait]
impl Tool for SetThemeTool {
    fn name(&self) -> &'static str {
        "set_theme"
    }

    fn description(&self) -> &'static str {
        "Change the application theme to light or dark mode."
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "theme": {
                    "type": "string",
                    "enum": ["light", "dark"],
                    "description": "The theme to apply"
                }
            },
            "required": ["theme"]
        })
    }

    async fn execute(&self, args: Value) -> Result<String, String> {
        let theme = args["theme"]
            .as_str()
            .ok_or("Missing 'theme' argument")?;

        match theme {
            "light" | "dark" => Ok(format!("Theme set to {}", theme)),
            _ => Err(format!("Invalid theme: {}. Must be 'light' or 'dark'.", theme)),
        }
    }
}
