use aisdk::core::LanguageModelRequest;
use aisdk::providers::Opencode;
use super::types::AnalyzerPlan;

const ANALYZER_SYSTEM_PROMPT: &str = r#"You are a conversation analyzer for a personal memory system.

Given the conversation below, determine:
1. Does this exchange contain any NEW personal information worth storing?
2. Which domains are relevant?
3. What entities (people, places, projects, concepts) are mentioned?
4. What is the current topic of conversation?
5. What pronoun bindings should be established? (e.g., "she" → "Mia")

Rules:
- "Hello", "Thanks", "Goodbye", "What's up", and other trivial greetings → should_extract: false
- Expressing feelings, mentioning people, stating preferences, discussing goals → should_extract: true
- If the user is just confirming or acknowledging something the assistant already knew, set should_extract to false — no new info was added
- If the user provides NEW detail or emotional reaction to existing knowledge, set should_extract: true
- For pronoun bindings, only bind when the referent is unambiguous. If multiple people of the same gender are mentioned, do not bind.
- For topic, be specific: "Mia's Exam Stress" not "emotional"

Available domains:
- identity: name, age, location, occupation, demographics
- emotional: feelings, moods, mental state, stress, anxiety, excitement
- relationships: family, friends, coworkers, pets, relationships
- preferences: likes, dislikes, tastes, habits
- goals: ambitions, plans, aspirations
- knowledge: general facts, learned information
- life_events: events, milestones, experiences
- conversations: things the user said worth noting
- projects: work, side projects, creative endeavors

Output ONLY valid JSON:
{"should_extract": true, "domains": ["emotional", "relationships"], "reasoning": "...", "swm": {"entities": ["Mia", "Karan"], "topic": "Mia's Exam Stress", "pronoun_bindings": {"she": "Mia", "her": "Mia", "he": "Karan"}}}"#;

pub async fn analyze(
    user_message: &str,
    assistant_message: &str,
    conversation_history: &str,
) -> Result<AnalyzerPlan, String> {
    let prompt = format!(
        "[CONVERSATION HISTORY]\n{}\n[/CONVERSATION HISTORY]\n\n[LATEST EXCHANGE]\nUser: {}\n\nAssistant: {}\n[/LATEST EXCHANGE]",
        conversation_history, user_message, assistant_message
    );

    let response = LanguageModelRequest::builder()
        .model(Opencode::minimax_m2_5_free())
        .system(ANALYZER_SYSTEM_PROMPT.to_string())
        .messages(vec![aisdk::core::Message::User(aisdk::core::UserMessage {
            content: prompt,
        })])
        .build()
        .generate_text()
        .await
        .map_err(|e| format!("Analyzer LLM call failed: {e}"))?;

    let text = response.text().ok_or("No response text from analyzer")?;

    eprintln!("[memory] Analyzer raw response: {}", text.chars().take(200).collect::<String>());

    let json_start = text.find('{').ok_or("No JSON found in analyzer response")?;
    let json_end = text.rfind('}').ok_or("No JSON closing brace in analyzer response")? + 1;
    let json_str = &text[json_start..json_end];

    serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse analyzer JSON: {e}"))
}
