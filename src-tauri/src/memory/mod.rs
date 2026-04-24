pub mod batch_queue;
pub mod compiler;
pub mod gam;
pub mod gap_auditor;
pub mod learn;
pub mod recent_summary;
pub mod schema;
pub mod schema_mapper;
pub mod triage_extractor;

use crate::db;
use crate::timer::Timer;
use crate::HistoryMessage;

/// Extract just the latest user+assistant exchange from the full message history.
fn extract_latest_exchange(messages: &[HistoryMessage]) -> Vec<HistoryMessage> {
    // Find the last assistant message, then take everything from the last user before it
    let last_assistant_idx = messages
        .iter()
        .rposition(|m| m.role == "assistant");

    if let Some(idx) = last_assistant_idx {
        // Find the user message right before this assistant message
        let user_idx = messages[..idx]
            .iter()
            .rposition(|m| m.role == "user");

        if let Some(u_idx) = user_idx {
            return messages[u_idx..=idx].to_vec();
        }
    }

    // Fallback: return last 2 messages if they exist
    messages.iter().rev().take(2).cloned().collect::<Vec<_>>().into_iter().rev().collect()
}

/// Process a conversation turn through the memory pipeline.
/// This should be spawned in a background task so it doesn't block chat.
pub async fn process_turn(
    session_id: String,
    messages: Vec<HistoryMessage>,
    api_key: String,
) {
    let _timer = Timer::new("memory::process_turn");

    println!("[Memory] process_turn started | session={} | messages={}", session_id, messages.len());

    if messages.is_empty() {
        println!("[Memory] Aborting: empty messages");
        return;
    }

    // 1. Ensure schema exists
    let _ = schema::ensure_schema();

    // 2. Increment turn count (or estimate for existing sessions)
    let turn_count = match db::increment_turn_count(&session_id) {
        Ok(n) => n,
        Err(_) => {
            // Session might be old without turn_count — estimate from message count
            db::estimate_turn_count(&session_id).unwrap_or(0)
        }
    };
    println!("[Memory] turn_count={}", turn_count);

    // 3. Extract latest exchange and queue for batch processing
    let latest_exchange = extract_latest_exchange(&messages);
    println!("[Memory] Queuing {} messages for batch extraction", latest_exchange.len());
    batch_queue::enqueue(session_id.clone(), latest_exchange, api_key.clone());

    // 4. Store GAM event (cheap DB insert, still per-turn)
    let user_msg = messages.iter().find(|m| m.role == "user").map(|m| m.content.as_str());
    let assistant_msg = messages.iter().find(|m| m.role == "assistant").map(|m| m.content.as_str());
    let prev_user_msg = if messages.len() >= 2 {
        messages.iter().rev().skip(1).find(|m| m.role == "user").map(|m| m.content.as_str())
    } else {
        None
    };

    let semantic_shift = gam::detect_semantic_shift(user_msg.unwrap_or(""), prev_user_msg);
    println!("[Memory] GAM: semantic_shift={}", semantic_shift);

    match gam::store_event(
        turn_count,
        &session_id,
        user_msg,
        assistant_msg,
        semantic_shift,
    ) {
        Ok(id) => println!("[Memory] Event stored with id={}", id),
        Err(e) => eprintln!("[Memory] Failed to store event: {}", e),
    }

    // 5. Check semantic boundary and compile session summary if needed
    let boundary_api_key = api_key.clone();
    let boundary_messages = messages.clone();
    let session_id_for_boundary = session_id.clone();
    let user_msg_for_boundary = messages.iter().find(|m| m.role == "user").map(|m| m.content.clone());
    tokio::spawn(async move {
        let turns_since = recent_summary::increment_turn_counter();
        let mut should_compile = turns_since >= 10;

        if let Some(user_msg) = user_msg_for_boundary {
            let (_, boundary_triggered) = recent_summary::check_semantic_boundary(&user_msg).await;
            if boundary_triggered {
                println!("[Memory][Boundary] Semantic boundary detected — compiling summary early");
                should_compile = true;
            }
        }

        if should_compile && turns_since > 0 {
            println!("[Memory][SummaryTask] Compiling session summary (turns_since={})...", turns_since);
            match recent_summary::compile(&session_id_for_boundary, &boundary_api_key, &boundary_messages).await {
                Ok(summary) => {
                    println!("[Memory][SummaryTask] Session summary updated ({} chars)", summary.len());
                    recent_summary::reset_turn_counter();
                }
                Err(e) => eprintln!("[Memory][SummaryTask] Session summary compilation failed: {}", e),
            }
        }
    });

    // 6. Spawn global summary compiler every 5 turns
    let global_api_key = api_key.clone();
    let global_messages = messages.clone();
    let global_turn = turn_count;
    tokio::spawn(async move {
        if global_turn % 5 == 0 && global_turn > 0 {
            println!("[Memory][GlobalSummaryTask] Compiling global summary (turn={})...", global_turn);
            match recent_summary::compile_global(&global_api_key, &global_messages).await {
                Ok(summary) => println!("[Memory][GlobalSummaryTask] Global summary updated ({} chars)", summary.len()),
                Err(e) => eprintln!("[Memory][GlobalSummaryTask] Global summary compilation failed: {}", e),
            }
        }
    });

    // 7. Spawn compiler + gap auditor independently
    let compile_api_key = api_key.clone();
    let compile_session_id = session_id.clone();
    tokio::spawn(async move {
        let total_episodes = db::count_all_episodes().unwrap_or(0);
        let active_contradictions = db::load_active_contradictions(50).unwrap_or_default();

        println!("[Memory][CompileTask] total_episodes={} active_contradictions={}", total_episodes, active_contradictions.len());

        if compiler::should_compile(total_episodes, &active_contradictions) {
            println!("[Memory][CompileTask] Expert 3: Compiler running...");
            let recent_episodes = db::load_recent_episodes(50).unwrap_or_default();
            match compiler::compile(&compile_api_key, &recent_episodes, &active_contradictions).await {
                Ok(_) => println!("[Memory][CompileTask] Schema compiled successfully"),
                Err(e) => eprintln!("[Memory][CompileTask] Compiler failed: {}", e),
            }

            // Expert 4: Gap Auditor
            println!("[Memory][CompileTask] Expert 4: Gap Auditor running...");
            match gap_auditor::audit(&compile_api_key, &recent_episodes).await {
                Ok(audit_result) => {
                    println!("[Memory][CompileTask] Gap Auditor found {} gaps", audit_result.gaps.len());
                    if !audit_result.gaps.is_empty() {
                        if let Err(e) = gap_auditor::store_gaps(&audit_result.gaps, Some(&compile_session_id)) {
                            eprintln!("[Memory][CompileTask] Failed to store gaps: {}", e);
                        }
                    }
                }
                Err(e) => eprintln!("[Memory][CompileTask] Gap Auditor failed: {}", e),
            }
        } else {
            println!("[Memory][CompileTask] Skipping compilation — not enough episodes or pressure");
        }
    });
}
