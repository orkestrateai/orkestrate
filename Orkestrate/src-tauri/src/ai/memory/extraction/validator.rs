use aisdk::core::LanguageModelRequest;
use aisdk::providers::Opencode;
use super::types::{ExtractedFact, ValidationDecision, DecisionAction};
use crate::ai::memory::MemoryManager;

const VAGUE_WORDS: &[&str] = &[
    "something", "someone", "somehow", "somewhere", "some", "thing",
];

fn contains_vague_word(text: &str) -> bool {
    let lower = text.to_lowercase();
    // Check whole words to avoid false positives (e.g., "thundering" shouldn't match "thing")
    let words: Vec<&str> = lower.split_whitespace().collect();
    for w in &words {
        let cleaned: String = w.trim_matches(|c: char| !c.is_alphanumeric()).to_string();
        if VAGUE_WORDS.contains(&cleaned.as_str()) {
            return true;
        }
    }
    false
}

fn has_humor_marker(text: &str) -> bool {
    let lower = text.to_lowercase();
    lower.contains("lol") || lower.contains("haha") || lower.contains("lmao")
        || lower.contains(" jk") || lower.starts_with("jk")
        || lower.contains(" idk") || lower.starts_with("idk")
}

fn apply_tone_confidence(fact: &mut ExtractedFact, user_message: &str) {
    if has_humor_marker(user_message) {
        let orig_confidence = fact.confidence;
        let orig_provenance = fact.provenance.clone();
        fact.confidence = fact.confidence.min(0.3);
        if fact.provenance == "direct" || fact.provenance == "inferred" {
            fact.provenance = "conversational".to_string();
        }
        eprintln!("[memory]   Tone marker detected: confidence {orig_confidence}→{}, provenance {orig_provenance}→{}",
            fact.confidence, orig_provenance);
    }
}

fn apply_vagueness_penalty(fact: &mut ExtractedFact) -> bool {
    if contains_vague_word(&fact.content) {
        fact.confidence = fact.confidence.min(0.1);
        fact.provenance = "incomplete".to_string();
        return true;
    }
    false
}

fn is_duplicate(fact: &ExtractedFact, existing: &[super::types::ExtractedFact]) -> bool {
    let content_lower = fact.content.to_lowercase();
    existing.iter().any(|e| {
        let similarity = strsim::normalized_levenshtein(&e.content.to_lowercase(), &content_lower);
        similarity > 0.85
    })
}

pub async fn validate(
    manager: &MemoryManager,
    facts: Vec<ExtractedFact>,
    user_message: &str,
) -> Vec<ValidationDecision> {
    if facts.is_empty() {
        return Vec::new();
    }

    // Step 1: Programmatic checks
    let mut decisions = Vec::new();
    let mut llm_candidates = Vec::new();

    eprintln!("[memory] Validator checking {} fact(s)...", facts.len());
    for mut fact in facts {
        // Always apply tone penalty
        apply_tone_confidence(&mut fact, user_message);

        // Vague check
        apply_vagueness_penalty(&mut fact);

        // Duplicate check via BM25
        let query = format!("{} {}", fact.content, fact.entities.join(" "));
        if let Ok(existing) = manager.search(vec![query]) {
            let existing_facts: Vec<ExtractedFact> = existing.iter().map(|m| ExtractedFact {
                domain: m.category.clone(),
                topic: String::new(),
                title: String::new(),
                summary: String::new(),
                content: m.content.clone(),
                tags: Vec::new(),
                keywords: Vec::new(),
                entities: Vec::new(),
                confidence: m.confidence,
                provenance: "direct".to_string(),
            }).collect();

            if is_duplicate(&fact, &existing_facts) {
                eprintln!("[memory]   Rejected (duplicate): content=\"{}\"", fact.content.chars().take(60).collect::<String>());
                decisions.push(ValidationDecision {
                    fact,
                    action: DecisionAction::Reject,
                    reason: Some("duplicate".to_string()),
                    existing_id: existing.first().map(|m| m.id.clone()),
                });
                continue;
            }
        }

        // If vague, reject immediately (no need for LLM)
        if fact.confidence <= 0.1 && fact.provenance == "incomplete" {
            eprintln!("[memory]   Rejected (vague): content=\"{}\"", fact.content.chars().take(60).collect::<String>());
            decisions.push(ValidationDecision {
                action: DecisionAction::Reject,
                reason: Some("vague".to_string()),
                existing_id: None,
                fact,
            });
            continue;
        }

        eprintln!("[memory]   Passed programmatic checks, sending to LLM: domain={} confidence={} content=\"{}\"",
            fact.domain, fact.confidence, fact.content.chars().take(60).collect::<String>());
        llm_candidates.push(fact);
    }

    // Step 2: LLM validation for remaining candidates
    if !llm_candidates.is_empty() {
        eprintln!("[memory] Validator: sending {} fact(s) to LLM validation", llm_candidates.len());
        let llm_decisions = llm_validate(llm_candidates).await;
        decisions.extend(llm_decisions);
    } else {
        eprintln!("[memory] Validator: all facts handled by programmatic checks, no LLM validation needed");
    }

    decisions
}

async fn llm_validate(candidates: Vec<ExtractedFact>) -> Vec<ValidationDecision> {
    let facts_json = match serde_json::to_string_pretty(&candidates) {
        Ok(j) => j,
        Err(e) => {
            eprintln!("[validation] Failed to serialize candidates: {e}");
            return candidates.into_iter().map(|f| ValidationDecision {
                action: DecisionAction::Store,
                reason: None,
                existing_id: None,
                fact: f,
            }).collect();
        }
    };

    let system = r#"You are a memory fact validator. Given extracted facts, decide the action for each.

Rules:
- If a fact contains "something", "someone", "somehow" → reject with reason "vague"
- If a fact is clearly a duplicate of another in the same batch → reject with reason "duplicate"
- If a fact contradicts another in the same batch → keep both but mark the newer one as "contradiction"
- If multiple facts say the same thing → keep the most specific one, reject others
- All other facts → approve with "store"

Output JSON:
{"decisions": [{"index": 0, "action": "store", "reason": "..."}, ...]}"#;

    let prompt = format!(
        "Facts to validate:\n{}\n\nOutput decisions as JSON.",
        facts_json
    );

    match LanguageModelRequest::builder()
        .model(Opencode::minimax_m2_5_free())
        .system(system.to_string())
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
                None => return fallback_store(candidates),
            };

            let json_start = match text.find('{') {
                Some(s) => s,
                None => return fallback_store(candidates),
            };
            let json_end = text.rfind('}').map(|e| e + 1).unwrap_or(text.len());
            let json_str = &text[json_start..json_end];

            #[derive(serde::Deserialize)]
            struct LlmDecision {
                index: usize,
                action: String,
                reason: Option<String>,
            }

            #[derive(serde::Deserialize)]
            struct LlmResponse {
                decisions: Vec<LlmDecision>,
            }

            match serde_json::from_str::<LlmResponse>(json_str) {
                Ok(r) => {
                    r.decisions.into_iter().map(|d| {
                        let fact = candidates.get(d.index).cloned()
                            .unwrap_or_else(|| candidates[0].clone());
                        let action = match d.action.as_str() {
                            "store" => DecisionAction::Store,
                            "reject" => DecisionAction::Reject,
                            "contradiction" => DecisionAction::Contradiction,
                            _ => DecisionAction::Store,
                        };
                        ValidationDecision {
                            fact,
                            action,
                            reason: d.reason,
                            existing_id: None,
                        }
                    }).collect()
                }
                Err(e) => {
                    eprintln!("[validation] Failed to parse LLM response: {e}");
                    fallback_store(candidates)
                }
            }
        }
        Err(e) => {
            eprintln!("[validation] LLM call failed: {e}");
            fallback_store(candidates)
        }
    }
}

fn fallback_store(candidates: Vec<ExtractedFact>) -> Vec<ValidationDecision> {
    candidates.into_iter().map(|fact| ValidationDecision {
        action: DecisionAction::Store,
        reason: None,
        existing_id: None,
        fact,
    }).collect()
}
