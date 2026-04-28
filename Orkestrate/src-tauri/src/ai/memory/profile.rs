use aisdk::core::LanguageModelRequest;
use aisdk::providers::Opencode;
use crate::ai::memory::MemoryManager;

const PROFILE_SYSTEM: &str = r#"You are a user profile maintenance agent. Read the facts and current profile, then output an updated user.md file."#;

fn gather_facts_text(manager: &MemoryManager) -> String {
    let domains = ["identity", "relationships", "preferences", "goals", "projects", "emotional"];
    let mut all = Vec::new();

    for domain in &domains {
        if let Ok(entries) = manager.storage().list_entries_in_dir(domain) {
            if entries.is_empty() {
                continue;
            }
            all.push(format!("\n--- {} ---", domain));
            for entry in &entries {
                let content_preview: String = entry.content.chars().take(200).collect();
                all.push(format!(
                    "- content: {} | confidence: {} | entities: {:?} | updated: {}",
                    content_preview,
                    entry.confidence,
                    entry.entities,
                    entry.updated_at.chars().take(10).collect::<String>(),
                ));
            }
        }
    }

    if all.is_empty() {
        return "No facts found.".to_string();
    }
    all.join("\n")
}

/// Run the LLM-based profile consolidation. Reads all stored facts + current user.md,
/// has the LLM produce a clean, deduplicated, contradiction-resolved version.
pub async fn consolidate(manager: &MemoryManager) -> Result<(), String> {
    let current_profile = manager.storage().read_user_profile()
        .map_err(|e| format!("Failed to read user profile: {e}"))?;
    let current_text = current_profile.unwrap_or_else(|| "No profile yet.".to_string());
    let facts_text = gather_facts_text(manager);

    let prompt = format!(
        r#"You maintain a user profile file. You receive the current user.md and extracted facts about the user. Rewrite user.md following these rules:

1. Deduplicate — if multiple facts say the same thing, keep the most specific version
2. Resolve contradictions — newer facts override older ones
3. Organize into sections: ## Identity, ## Relationships, ## Preferences, ## Goals, ## Active Context
4. ## Identity should include name, age, location, occupation
5. ## Relationships should list people and how they relate to the user
6. ## Preferences should cover likes, dislikes, habits, tastes
7. ## Goals should list ambitions, plans, aspirations
8. ## Active Context should hold recent emotional state, project status, ongoing situations (last 7 days only)
9. Every bullet must be a concrete statement — no "something", "someone", or vague language
10. If a fact contains the user's name, include it as "Name: ..." in the Identity section
11. Remove facts with confidence < 0.3
12. Keep the YAML frontmatter intact. Update updatedAt to: {}
13. Output ONLY the complete user.md file including frontmatter. No explanation.

Current user.md:
{}

Extracted facts:
{}"#,
        chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ"),
        current_text,
        facts_text,
    );

    let domain_count = facts_text.lines().filter(|l| l.starts_with("---")).count();
    eprintln!("[profile] Consolidating user.md with {domain_count} domains of facts...");

    let response = LanguageModelRequest::builder()
        .model(Opencode::minimax_m2_5_free())
        .system(PROFILE_SYSTEM.to_string())
        .messages(vec![aisdk::core::Message::User(aisdk::core::UserMessage {
            content: prompt,
        })])
        .build()
        .generate_text()
        .await
        .map_err(|e| format!("Profile consolidation LLM call failed: {e}"))?;

    let text = response.text().ok_or("No response text from profile consolidation")?;

    // Extract markdown between first --- and last ---
    let start = text.find("---").ok_or("No frontmatter start in LLM output")?;
    let after_start = &text[start + 3..];
    let end = after_start.rfind("---").ok_or("No frontmatter end in LLM output")? + 3;
    let cleaned = text[start..start + 3 + end].to_string();

    if cleaned != current_text {
        eprintln!("[profile] user.md changed, writing update...");
        manager.storage().write_user_profile(&cleaned)
            .map_err(|e| format!("Failed to write user profile: {e}"))?;
        eprintln!("[profile] Consolidation complete.");
    } else {
        eprintln!("[profile] No changes to user.md.");
    }

    Ok(())
}
