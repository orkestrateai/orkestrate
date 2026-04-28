use crate::ai::memory::{MemoryManager, SESSION_REGISTRY};

/// Look up entity context and return a formatted string for system prompt injection.
/// Format:
///   <entity-context>
///   Mia (your sister)
///   Known: stressed about work, cooks together for stress relief
///   Relationship: Mia and Karan know each other
///   </entity-context>
pub fn resolve_entity_context(manager: &MemoryManager, user_message: &str) -> String {
    let known_entities = extract_entity_names(user_message);
    if known_entities.is_empty() {
        return String::new();
    }

    let mut context_parts: Vec<String> = Vec::new();

    for entity_name in &known_entities {
        let entity_path = format!("people/{}/entity.md", entity_name.to_lowercase());
        let facts_dir = format!("people/{}", entity_name.to_lowercase());

        // Try to read entity definition
        let entity_def = manager.storage().read_entry_raw(&entity_path);

        // Collect facts about this entity
        let entity_facts = manager.storage().list_entries_in_dir(&facts_dir);

        if let Ok(Some(_)) = entity_def {
            let mut entity_block = format!("{}", entity_name);

            // Collect known facts
            if !entity_facts.is_ok() || entity_facts.as_ref().map(|f| f.is_empty()).unwrap_or(true) {
                // Entity exists but no facts yet
                context_parts.push(format!("Known: {} is a known person.", entity_name));
                continue;
            }

            let facts = entity_facts.unwrap();
            let mut summaries: Vec<String> = Vec::new();
            for fact in &facts {
                if !fact.summary.is_empty() {
                    summaries.push(fact.summary.clone());
                } else if !fact.content.is_empty() {
                    let truncated: String = fact.content.chars().take(100).collect();
                    summaries.push(truncated);
                }
            }
            if !summaries.is_empty() {
                entity_block.push_str(&format!("\n  Known: {}", summaries.join("; ")));
            }

            // Check SWM for entity-to-entity relationships
            let mut relationships: Vec<String> = Vec::new();
            if let Some(swm) = SESSION_REGISTRY.get("swm") {
                for (domain, value) in &swm.active_entities {
                    if domain != entity_name && value == "Recently stored" {
                        relationships.push(format!("  Relationship: {} and {}", entity_name, domain));
                    }
                }
            }

            if !relationships.is_empty() {
                entity_block.push_str(&format!("\n{}", relationships.join("\n")));
            }

            context_parts.push(entity_block);
        } else {
            // Entity not yet stored — check if it was recently mentioned in SWM
            if let Some(swm) = SESSION_REGISTRY.get("swm") {
                if swm.active_entities.contains_key(entity_name) {
                    context_parts.push(format!("{} (recently mentioned)", entity_name));
                }
            }
        }
    }

    if context_parts.is_empty() {
        return String::new();
    }

    format!(
        "\n<entity-context>\n{}\n</entity-context>",
        context_parts.join("\n\n")
    )
}

/// Very simple entity name extraction from user message.
/// Finds capitalized words that might be names.
/// This is intentionally a heuristic — the LLM agent handles full extraction.
fn extract_entity_names(text: &str) -> Vec<String> {
    let mut names: Vec<String> = Vec::new();

    for word in text.split_whitespace() {
        let cleaned: String = word
            .trim_matches(|c: char| !c.is_alphanumeric())
            .to_string();

        if cleaned.len() < 2 {
            continue;
        }

        // First letter capitalized = possible entity name
        if cleaned.chars().next().map(|c| c.is_uppercase()).unwrap_or(false) {
            // Skip common false positives
            let lower = cleaned.to_lowercase();
            if matches!(
                lower.as_str(),
                "i" | "a" | "the" | "it" | "this" | "that" | "what" | "which"
                    | "how" | "why" | "where" | "when" | "my" | "your" | "his"
                    | "her" | "its" | "our" | "their" | "you" | "he" | "she" | "we"
                    | "they" | "me" | "him" | "us" | "them"
            ) {
                continue;
            }

            if !names.contains(&cleaned) {
                names.push(cleaned);
            }
        }
    }

    names
}
