use serde_json::json;

use crate::db;
use crate::timer::Timer;
use crate::HistoryMessage;

const API_BASE: &str = "https://opencode.ai/zen/v1/chat/completions";

/// After a learn exchange, extract atomic facts from the user's answer,
/// store them as high-confidence episodes, and mark queue items as addressed.
pub async fn process_learn_answer(
    api_key: &str,
    history: &[HistoryMessage],
    target_item_id: Option<&str>,
) -> Result<(), String> {
    let _timer = Timer::new("memory::learn::process_answer");

    // Extract the latest user answer
    let user_answer = history
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .map(|m| m.content.as_str())
        .unwrap_or("");

    if user_answer.is_empty() {
        return Ok(());
    }

    // Get the latest assistant prompt to understand context
    let assistant_prompt = history
        .iter()
        .rev()
        .find(|m| m.role == "assistant")
        .map(|m| m.content.as_str())
        .unwrap_or("");

    // 1. Call LLM to reformulate answer into atomic statements
    let facts = extract_facts(api_key, assistant_prompt, user_answer).await?;

    if facts.is_empty() {
        println!("[Learn] No facts extracted from answer");
        return Ok(());
    }

    // 2. Store each fact as a high-confidence episode
    let mut stored_count = 0;
    for fact in &facts {
        match db::store_episode(
            fact,
            "fact",
            0.95,
            0.9,
            "semantic",
            None,
            None,
        ) {
            Ok(id) => {
                println!("[Learn] Stored fact: {} (id={})", fact, id);
                stored_count += 1;
            }
            Err(e) => eprintln!("[Learn] Failed to store fact: {}", e),
        }
    }

    // 3. Mark the addressed learn item and resolve underlying contradictions
    let item_to_mark = target_item_id.and_then(|id| {
        if id.is_empty() { None } else { Some(id) }
    });

    let mut addressed_learn_id: Option<String> = None;

    if let Some(id) = item_to_mark {
        let answer_summary = if facts.len() == 1 {
            facts[0].clone()
        } else {
            format!("{} facts: {}", facts.len(), facts.join("; "))
        };
        if let Err(e) = db::mark_learn_item_addressed(id, Some(&answer_summary)) {
            eprintln!("[Learn] Failed to mark item {} addressed: {}", id, e);
        } else {
            println!("[Learn] Marked item {} as addressed", id);
            addressed_learn_id = Some(id.to_string());
        }
    } else if let Ok(pending) = db::load_pending_learn_items(1) {
        // Fallback heuristic: mark the top pending item
        if let Some(item) = pending.first() {
            let answer_summary = if facts.len() == 1 {
                facts[0].clone()
            } else {
                format!("{} facts: {}", facts.len(), facts.join("; "))
            };
            if let Err(e) = db::mark_learn_item_addressed(&item.id, Some(&answer_summary)) {
                eprintln!("[Learn] Failed to mark item addressed: {}", e);
            } else {
                println!("[Learn] Marked item {} as addressed", item.id);
                addressed_learn_id = Some(item.id.clone());
            }
        }
    }

    // 3b. If the addressed item was a contradiction, resolve it and deprecate old episode
    if let Some(learn_id) = addressed_learn_id {
        if let Ok(Some(item)) = db::get_learn_item(&learn_id) {
            if item.type_ == "contradiction" {
                if let Some(contradiction_id) = item.source_id {
                    // Fetch contradiction BEFORE resolving to get old episode ID
                    let old_episode_id = db::get_contradiction(&contradiction_id)
                        .ok()
                        .flatten()
                        .map(|c| c.existing_episode_id);

                    if let Err(e) = db::resolve_contradiction(&contradiction_id) {
                        eprintln!("[Learn] Failed to resolve contradiction {}: {}", contradiction_id, e);
                    } else {
                        println!("[Learn] Resolved contradiction {}", contradiction_id);
                        // Deprecate the old episode so it stops surfacing in searches
                        if let Some(ep_id) = old_episode_id {
                            if let Err(e) = db::deprecate_episode(&ep_id) {
                                eprintln!("[Learn] Failed to deprecate old episode {}: {}", ep_id, e);
                            } else {
                                println!("[Learn] Deprecated old episode {}", ep_id);
                            }
                        }
                    }
                }
            }
        }
    }

    // 4. Trigger compiler if we stored enough new facts
    if stored_count >= 1 {
        let total = db::count_all_episodes().unwrap_or(0);
        let contradictions = db::load_active_contradictions(50).unwrap_or_default();
        if crate::memory::compiler::should_compile(total, &contradictions) {
            println!("[Learn] Triggering compiler after learn exchange...");
            let recent = db::load_recent_episodes(50).unwrap_or_default();
            let _ = crate::memory::compiler::compile(api_key, &recent, &contradictions).await;
        }
    }

    // 5. Trigger background generation of next question if needed
    trigger_background_question_generation();

    Ok(())
}

/// Fire-and-forget background task to generate the next learn question
/// when one is needed (empty history or user just answered).
pub fn trigger_background_question_generation() {
    tauri::async_runtime::spawn(async {
        dotenvy::dotenv().ok();
        let api_key = match std::env::var("OPENCODE_ZEN_API_KEY") {
            Ok(k) => k,
            Err(_) => return,
        };

        let history = match db::load_messages("__learn__", 50) {
            Ok(h) => h,
            Err(_) => return,
        };

        let needs_question = history.is_empty()
            || history.last().map(|m| m.role == "user").unwrap_or(true);

        if !needs_question {
            return;
        }

        let history_msgs: Vec<crate::HistoryMessage> = history
            .into_iter()
            .map(|m| crate::HistoryMessage {
                role: m.role,
                content: m.content,
                tool_call_id: m.tool_call_id,
                tool_calls: m.tool_calls,
            })
            .collect();

        let _ = crate::agent::learn::generate_learn_question(history_msgs, &api_key).await;
    });
}

async fn extract_facts(api_key: &str, context: &str, answer: &str) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();

    let prompt = format!(
        r#"Context — the question I asked:
{}

User's answer:
{}

Extract 1-3 atomic factual statements from the user's answer. Each statement should be a single, specific fact that can be stored as a memory.

Rules:
- Output ONLY a JSON array of strings
- Each string is one atomic fact
- If the answer is vague or off-topic, return an empty array
- Do NOT include opinions, guesses, or unclear statements
- Do NOT include meta-commentary like "the user said"

Output format:
["fact one", "fact two"]"#,
        context, answer
    );

    let request = json!({
        "model": "minimax-m2.5-free",
        "messages": [
            { "role": "system", "content": "You extract atomic facts from user answers. Output ONLY valid JSON arrays." },
            { "role": "user", "content": prompt }
        ],
        "stream": false,
        "max_tokens": 1024
    });

    let response = client
        .post(API_BASE)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Fact extraction request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Fact extraction API Error {}: {}", status, body));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Fact extraction JSON parse error: {}", e))?;

    let content = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim();

    // Strip markdown code blocks if present
    let json_str = if content.starts_with("```json") {
        content.trim_start_matches("```json").trim_end_matches("```").trim()
    } else if content.starts_with("```") {
        content.trim_start_matches("```").trim_end_matches("```").trim()
    } else {
        content
    };

    let parsed: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse facts JSON: {} | Raw: {}", e, content))?;

    let facts: Vec<String> = parsed
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();

    Ok(facts)
}
