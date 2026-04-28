use aisdk::core::LanguageModelRequest;
use aisdk::providers::Opencode;
use super::types::ExtractedFact;
use crate::ai::memory::session::ToolCallRecord;

const JSON_FORMAT: &str = r#"JSON format for EACH fact (all fields required):
{
  "domain": "the_domain_name",          // MUST match the domain you're extracting for
  "topic": "short_category_label",      // e.g. "stress", "project", "sister"
  "title": "Brief Title",               // human-readable title (3-6 words)
  "summary": "One-line summary",        // complete sentence
  "content": "Specific factual statement with all details from the conversation",
  "tags": ["relevant", "tags"],         // 2-4 tags
  "keywords": ["searchable", "keywords"],
  "entities": ["EntityName"],           // people, places, concepts mentioned
  "confidence": 0.0,                    // 0.9=explicit, 0.6=implied, 0.3=weak
  "provenance": "direct"                // "direct"|"inferred"|"conversational"|"incomplete"
}

Example for "emotional" domain:
{"domain": "emotional", "topic": "stress", "title": "Karan Exam Stress", "summary": "Karan is stressed about Power System Protection exam", "content": "Karan is stressed about the Power System Protection exam, user finds it amusing.", "tags": ["emotional", "stress", "exam"], "keywords": ["karan", "stressed", "exam", "power system"], "entities": ["Karan"], "confidence": 0.9, "provenance": "direct"}

Return ONLY a JSON object with a "facts" array. No other text."#;

fn domain_system_prompt(domain: &str, trace_text: &str) -> String {
    let base = match domain {
        "identity" => r#"You extract IDENTITY facts from conversations.
Focus on: name, age, location, occupation, demographics, self-descriptions.
- Extract ONLY identity-related facts
- "content" must be SPECIFIC — never use "something", "someone", "somehow"
- If details are missing, set confidence to 0.1 and provenance to "incomplete"
- If the user message contains "lol", "haha", "lmao", "jk", cap confidence at 0.3
- Use the memory search results below to enrich specificity"#,

        "emotional" => r#"You extract EMOTIONAL STATE facts from conversations.
Focus on: feelings, moods, mental state, stress, anxiety, excitement, frustration.
- Extract ONLY emotion-related facts
- "content" must be SPECIFIC — what they feel AND why (if known)
- NEVER use "something" or "someone" — be precise
- If user says "lol", "haha", cap confidence at 0.3 and use provenance "conversational"
- Use the memory search results below to enrich specificity"#,

        "relationships" => r#"You extract RELATIONSHIP facts from conversations.
Focus on: family, friends, coworkers, pets, how people relate to each other.
- Extract ONLY relationship-related facts  
- "content" must be SPECIFIC — name the person AND the relationship
- NEVER use "someone" — name the person if known
- Use the memory search results below to enrich specificity"#,

        "preferences" => r#"You extract PREFERENCE and GOAL facts from conversations.
Focus on: likes, dislikes, tastes, habits, ambitions, plans, aspirations.
- Extract ONLY preference/goal-related facts
- "content" must be SPECIFIC
- Use the memory search results below to enrich specificity"#,

        _ => r#"You extract personal information from conversations.
Focus on: the domain you are asked about.
- Extract ONLY relevant facts
- Each fact's "domain" field MUST be set to the domain you are extracting for
- "content" must be SPECIFIC
- NEVER use "something", "someone"
- Use the memory search results below to enrich specificity"#,
    };

    format!(
        "{}\n\nDomain: {}\n\n{}\n\n{}",
        base, domain, trace_text, JSON_FORMAT
    )
}

async fn extract_domain(
    user_message: &str,
    assistant_message: &str,
    trace_text: &str,
    entity_context: &str,
    domain: &str,
    conversation_history: &str,
) -> Vec<ExtractedFact> {
    let system = domain_system_prompt(domain, trace_text);

    let prompt = format!(
        "[CONVERSATION HISTORY]\n{}\n[/CONVERSATION HISTORY]\n\n[LATEST EXCHANGE]\nUser: {}\n\nAssistant: {}\n[/LATEST EXCHANGE]\n\n{}",
        conversation_history,
        user_message,
        assistant_message,
        if entity_context.is_empty() {
            String::new()
        } else {
            format!("[KNOWN ENTITY CONTEXT]\n{}\n[/KNOWN ENTITY CONTEXT]", entity_context)
        },
    );

    match LanguageModelRequest::builder()
        .model(Opencode::minimax_m2_5_free())
        .system(system)
        .messages(vec![aisdk::core::Message::User(aisdk::core::UserMessage {
            content: prompt,
        })])
        .build()
        .generate_text()
        .await
    {
        Ok(response) => {
            let text = match response.text() {
                Some(t) => t,
                None => return Vec::new(),
            };
            let json_start = match text.find('{') {
                Some(s) => s,
                None => return Vec::new(),
            };
            let json_end = text.rfind('}').map(|e| e + 1).unwrap_or(text.len());
            let json_str = &text[json_start..json_end];

            #[derive(serde::Deserialize)]
            struct Resp {
                facts: Vec<ExtractedFact>,
            }

            match serde_json::from_str::<Resp>(json_str) {
                Ok(r) => {
                    eprintln!("[memory] Extractor '{}' returned {} fact(s)", domain, r.facts.len());
                    r.facts
                }
                Err(e) => {
                    eprintln!("[memory] Extractor '{}' parse error: {} — raw: {}", domain, e, json_str.chars().take(100).collect::<String>());
                    Vec::new()
                }
            }
        }
        Err(e) => {
            eprintln!("[extraction] Domain extractor '{}' failed: {e}", domain);
            Vec::new()
        }
    }
}

pub async fn extract_all(
    user_message: &str,
    assistant_message: &str,
    tool_trace: &[ToolCallRecord],
    entity_context: &str,
    domains: &[String],
    conversation_history: &str,
) -> Vec<ExtractedFact> {
    if domains.is_empty() {
        return Vec::new();
    }

    let trace_text = format_tool_trace(tool_trace);

    let handles: Vec<_> = domains.iter().map(|domain| {
        let msg = user_message.to_string();
        let asst = assistant_message.to_string();
        let trace = trace_text.clone();
        let ctx = entity_context.to_string();
        let d = domain.clone();
        let ch = conversation_history.to_string();

        tokio::spawn(async move {
            extract_domain(&msg, &asst, &trace, &ctx, &d, &ch).await
        })
    }).collect();

    let mut all = Vec::new();
    for handle in handles {
        if let Ok(facts) = handle.await {
            all.extend(facts);
        }
    }
    all
}

fn format_tool_trace(trace: &[ToolCallRecord]) -> String {
    if trace.is_empty() {
        return "[MEMORY SEARCH RESULTS]\nNo memory searches performed.\n[/MEMORY SEARCH RESULTS]".to_string();
    }
    let mut out = String::from("[MEMORY SEARCH RESULTS]\n");
    for record in trace {
        out.push_str(&format!("\nSearched for: {}\n", record.queries.join(", ")));
        out.push_str("Retrieved facts:\n");
        if record.memory_content.is_empty()
            || (record.memory_content.len() == 1 && record.memory_content[0] == "No results found")
        {
            out.push_str("- No results found\n");
        } else {
            for content in &record.memory_content {
                out.push_str(&format!("  - \"{}\"\n", content));
            }
        }
    }
    out.push_str("[/MEMORY SEARCH RESULTS]");
    out
}
