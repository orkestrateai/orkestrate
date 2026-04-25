use serde::{Deserialize, Serialize};
use tauri::{image::Image, Manager};

mod agent;
#[cfg(test)]
mod bench;
mod config;
mod context;
mod db;
mod embed;
mod mcp;
mod memory;
mod pscm;
mod prompt;
mod timer;
mod tools;
mod vector;

// ─── Event Payload Types ───────────────────────────────────────────────

#[derive(Serialize, Clone)]
struct ToolCallEvent {
    request_id: String,
    tool: String,
    args: serde_json::Value,
    id: String,
}

#[derive(Serialize, Clone)]
struct ToolResultEvent {
    request_id: String,
    tool: String,
    result: String,
    id: String,
}

// ─── Learn Agent Commands ──────────────────────────────────────────────

#[tauri::command]
async fn run_learn(
    window: tauri::Window,
    request_id: String,
    history: Vec<HistoryMessage>,
) -> Result<(), String> {
    dotenvy::dotenv().ok();
    let api_key =
        std::env::var("OPENCODE_ZEN_API_KEY").map_err(|_| "OPENCODE_ZEN_API_KEY not set")?;
    agent::learn::run_learn_agent(window, request_id, history, api_key).await
}

#[tauri::command]
fn get_learn_queue() -> Result<Vec<db::LearnQueueItem>, String> {
    db::load_pending_learn_items(20)
}

#[tauri::command]
fn count_pending_learn_items() -> Result<i64, String> {
    db::count_pending_learn_items()
}

#[tauri::command]
fn dismiss_learn_item(id: String) -> Result<(), String> {
    db::dismiss_learn_item(&id)
}

#[tauri::command]
fn snooze_learn_item(id: String) -> Result<(), String> {
    db::snooze_learn_item(&id)
}

#[tauri::command]
async fn process_learn_answer(
    history: Vec<HistoryMessage>,
    target_item_id: Option<String>,
) -> Result<(), String> {
    dotenvy::dotenv().ok();
    let api_key =
        std::env::var("OPENCODE_ZEN_API_KEY").map_err(|_| "OPENCODE_ZEN_API_KEY not set")?;
    memory::learn::process_learn_answer(&api_key, &history, target_item_id.as_deref()).await
}

#[tauri::command]
async fn get_suggestions() -> Result<Vec<String>, String> {
    dotenvy::dotenv().ok();
    let user_md = memory::schema::read_schema();

    // Gather rich context
    let recent_session = db::get_most_recent_session().unwrap_or_default();
    let recent_messages = recent_session
        .as_ref()
        .and_then(|(id, _name)| db::load_messages(id, 3).ok())
        .unwrap_or_default();

    let session_summary = recent_session
        .as_ref()
        .map(|(id, _)| memory::recent_summary::read_summary(id))
        .unwrap_or_default();

    let global_summary = memory::recent_summary::read_global_summary();

    let learn_items = db::load_pending_learn_items(3).unwrap_or_default();

    let recent_episodes = db::load_recent_episodes(5).unwrap_or_default();

    // Build context block
    let mut context = String::new();

    if !user_md.trim().is_empty() && !user_md.contains("Name: Unknown") {
        context.push_str("User Profile:\n");
        context.push_str(&user_md);
        context.push_str("\n\n");
    }

    if !recent_messages.is_empty() {
        context.push_str("Recent Chat:\n");
        for m in &recent_messages {
            context.push_str(&format!(
                "{}: {}\n",
                m.role,
                m.content.chars().take(200).collect::<String>()
            ));
        }
        context.push_str("\n");
    }

    if !session_summary.is_empty() {
        context.push_str("Session Summary:\n");
        context.push_str(&session_summary);
        context.push_str("\n\n");
    }

    if !global_summary.is_empty() {
        context.push_str("Global Summary:\n");
        context.push_str(&global_summary);
        context.push_str("\n\n");
    }

    if !learn_items.is_empty() {
        context.push_str("What Orkestrate wants to ask:\n");
        for item in &learn_items {
            context.push_str(&format!("- [{}] {}\n", item.type_, item.question));
        }
        context.push_str("\n");
    }

    if !recent_episodes.is_empty() {
        context.push_str("Recent Memories:\n");
        for ep in &recent_episodes {
            context.push_str(&format!(
                "- [{}] {}\n",
                ep.type_,
                ep.content.chars().take(120).collect::<String>()
            ));
        }
        context.push_str("\n");
    }

    // If there's essentially no context, return fallbacks
    if context.trim().is_empty() {
        return Ok(vec![
            "What are you working on?".to_string(),
            "Tell me something interesting".to_string(),
            "What did we discuss last?".to_string(),
            "Search my memory".to_string(),
        ]);
    }

    let api_key =
        std::env::var("OPENCODE_ZEN_API_KEY").map_err(|_| "OPENCODE_ZEN_API_KEY not set")?;
    let client = reqwest::Client::new();

    let prompt = format!(
        r#"Generate 3 short user prompts (max 10 words each) that the USER would send to Orkestrate — their personal AI with perfect memory.

These prompts must fall into ONE of two categories:
1. COMMANDS — the user telling Orkestrate what to DO, CONTINUE, CREATE, or HELP WITH
2. MEMORY QUERIES — the user asking Orkestrate to recall something THEY THEMSELVES said or did before

Context about the user's recent activity:
{}

STRICT RULES — DO:
- "Continue working on the Google Next writing challenge"
- "What did I say I wanted to do with Keiyara?"
- "Draft an outline for my dev.to post"
- "Help me refine the Orkestrate memory pipeline"
- "Did I mention any arxiv papers I wanted to read?"
- "Search my memory for that project idea I had"

STRICT RULES — NEVER DO:
- NEVER ask Orkestrate to explain or tell the user about general topics
- NEVER phrase prompts as if Orkestrate is the source of knowledge
- NEVER write "Tell me more about X" or "What is X?" or "Explain X"
- NEVER ask Orkestrate to do research or fetch info the user doesn't already know
- NEVER write greetings, small talk, or questions TO the AI

The user has goals and memories. Orkestrate remembers them. The prompts are either commands for Orkestrate to act on those memories, or queries for Orkestrate to recall them.

Output ONLY a JSON array of strings:"#,
        context
    );

    let request = serde_json::json!({
        "model": "minimax-m2.5-free",
        "messages": [
            { "role": "system", "content": "You generate action-oriented user prompts for an AI assistant. Output ONLY a JSON array of 3 strings." },
            { "role": "user", "content": prompt }
        ],
        "stream": false,
        "max_tokens": 2048
    });

    let response = client
        .post("https://opencode.ai/zen/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Suggestions request failed: {}", e))?;

    println!("[Suggestions] Response: {:?}", response);
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Suggestions API Error {}: {}", status, body));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Suggestions JSON parse error: {}", e))?;

    println!("[Suggestions] Data: {:?}", data);
    let content = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim();

    println!("[Suggestions] Content: {}", content);

    // Strip markdown code blocks if present
    let json_str = if content.starts_with("```json") {
        content
            .trim_start_matches("```json")
            .trim_end_matches("```")
            .trim()
    } else if content.starts_with("```") {
        content
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim()
    } else {
        content
    };

    let parsed: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse suggestions JSON: {} | Raw: {}", e, content))?;

    let suggestions: Vec<String> = parsed
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();

    if suggestions.is_empty() {
        return Ok(vec![
            "What are you working on?".to_string(),
            "Tell me something interesting".to_string(),
            "What did we discuss last?".to_string(),
            "Search my memory".to_string(),
        ]);
    }

    Ok(suggestions)
}

#[derive(Serialize, Deserialize, Clone)]
pub struct HistoryMessage {
    pub role: String,
    pub content: String,
    pub tool_call_id: Option<String>,
    pub tool_calls: Option<String>,
}

// ─── Tauri Commands ────────────────────────────────────────────────────

#[tauri::command]
async fn chat_opencode(
    window: tauri::Window,
    request_id: String,
    session_id: String,
    session_name: Option<String>,
    history: Vec<HistoryMessage>,
    model: Option<String>,
) -> Result<(), String> {
    let _total = timer::Timer::new(&format!("chat_opencode | req={}", request_id));
    dotenvy::dotenv().ok();
    let api_key =
        std::env::var("OPENCODE_ZEN_API_KEY").map_err(|_| "OPENCODE_ZEN_API_KEY not set")?;

    let selected_model = model.unwrap_or_else(|| "minimax-m2.5-free".to_string());

    println!(
        ">>> Starting agent loop for request: {} | session: {} | model: {} | history_len={}",
        request_id,
        session_id,
        selected_model,
        history.len()
    );

    let result = agent::run_agent(
        window,
        request_id,
        session_id,
        session_name,
        history,
        selected_model,
        api_key,
    )
    .await;

    result
}

#[tauri::command]
fn save_message(
    session_id: String,
    role: String,
    content: String,
    tool_call_id: Option<String>,
    tool_calls: Option<String>,
) -> Result<(), String> {
    let t = timer::Timer::new("db::store_message");
    let r = db::store_message(
        &session_id,
        &role,
        &content,
        tool_call_id.as_deref(),
        tool_calls.as_deref(),
    );
    t.log(&format!("session={} role={}", session_id, role));
    r
}

#[tauri::command]
fn get_messages(session_id: String, limit: i64) -> Result<Vec<db::StoredMessage>, String> {
    let t = timer::Timer::new("db::load_messages");
    let r = db::load_messages(&session_id, limit);
    if let Ok(ref msgs) = r {
        t.log(&format!(
            "session={} limit={} count={}",
            session_id,
            limit,
            msgs.len()
        ));
    } else {
        t.log(&format!("session={} limit={} err", session_id, limit));
    }
    r
}

#[tauri::command]
fn create_session(name: String) -> Result<String, String> {
    let t = timer::Timer::new("db::create_session");
    let r = db::create_session(&name);
    t.log(&format!("name={}", name));
    r
}

#[tauri::command]
fn update_session_name(session_id: String, name: String) -> Result<(), String> {
    let t = timer::Timer::new("db::update_session_name");
    let r = db::update_session_name(&session_id, &name);
    t.log(&format!("session={}", session_id));
    r
}

#[tauri::command]
async fn generate_session_name(
    session_id: String,
    user_message: String,
    assistant_message: String,
) -> Result<String, String> {
    dotenvy::dotenv().ok();
    let api_key =
        std::env::var("OPENCODE_ZEN_API_KEY").map_err(|_| "OPENCODE_ZEN_API_KEY not set")?;

    let client = reqwest::Client::new();
    let prompt = format!(
        r#"Generate a concise 2-4 word title for a chat conversation based on this first exchange.

User: {}
Assistant: {}

Rules:
- 2-4 words only
- Descriptive and specific
- No quotes, no trailing punctuation
- Output ONLY the title"#,
        user_message, assistant_message
    );

    let request = serde_json::json!({
        "model": "minimax-m2.5-free",
        "messages": [
            { "role": "system", "content": "You generate concise chat titles. Output ONLY the title." },
            { "role": "user", "content": prompt }
        ],
        "stream": false,
        "max_tokens": 256
    });

    let response = client
        .post("https://opencode.ai/zen/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Title generation request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Title API Error {}: {}", status, body));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Title JSON parse error: {}", e))?;

    let title = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .trim_end_matches('.')
        .trim_end_matches('?')
        .trim_end_matches('!')
        .to_string();

    if title.is_empty() {
        return Err("Generated title was empty".to_string());
    }

    db::update_session_name(&session_id, &title)?;
    Ok(title)
}

#[tauri::command]
fn get_sessions() -> Result<Vec<serde_json::Value>, String> {
    let t = timer::Timer::new("db::list_sessions");
    let r = db::list_sessions();
    if let Ok(ref sessions) = r {
        t.log(&format!("count={}", sessions.len()));
    } else {
        t.log("err");
    }
    r
}

#[tauri::command]
fn clear_messages(session_id: String) -> Result<(), String> {
    let t = timer::Timer::new("db::clear_messages");
    let r = db::clear_messages(&session_id);
    t.log(&format!("session={}", session_id));
    r
}

#[tauri::command]
fn delete_session(session_id: String) -> Result<(), String> {
    let t = timer::Timer::new("db::delete_session");
    let r = db::delete_session(&session_id);
    t.log(&format!("session={}", session_id));
    r
}

// ─── Config Commands ───────────────────────────────────────────────────

#[tauri::command]
fn get_memory_continuity_mode() -> Result<String, String> {
    Ok(config::get_memory_continuity_mode())
}

#[tauri::command]
fn set_memory_continuity_mode(mode: String) -> Result<(), String> {
    config::set_memory_continuity_mode(&mode)
}

// ─── Memory Debug Commands ─────────────────────────────────────────────

#[derive(Serialize)]
struct MemoryState {
    profile: String,
    episodes: Vec<db::Episode>,
    contradictions: Vec<db::Contradiction>,
    events: Vec<db::Event>,
    gaps: Vec<db::Episode>,
    summaries: Vec<memory::recent_summary::Summary>,
}

#[tauri::command]
fn get_memory_state() -> Result<MemoryState, String> {
    let profile = memory::schema::read_schema();
    let episodes = db::load_recent_episodes(30).unwrap_or_default();
    let contradictions = db::load_all_contradictions(30).unwrap_or_default();
    let events = db::load_recent_events(20).unwrap_or_default();
    let gaps = db::load_gaps(20).unwrap_or_default();
    let summaries = memory::recent_summary::list_summaries().unwrap_or_default();

    Ok(MemoryState {
        profile,
        episodes,
        contradictions,
        events,
        gaps,
        summaries,
    })
}

#[tauri::command]
fn get_summaries() -> Result<Vec<memory::recent_summary::Summary>, String> {
    memory::recent_summary::list_summaries()
}

#[tauri::command]
fn resolve_contradiction(id: String) -> Result<(), String> {
    db::resolve_contradiction(&id)
}

#[tauri::command]
fn delete_episode(id: String) -> Result<(), String> {
    db::delete_episode(&id)
}

// ─── MCP Management Commands ───────────────────────────────────────────

#[tauri::command]
fn get_mcp_config() -> Result<crate::mcp::types::McpConfig, String> {
    crate::mcp::config::load_config()
}

#[tauri::command]
fn set_mcp_config(config: crate::mcp::types::McpConfig) -> Result<(), String> {
    crate::mcp::config::save_config(&config)
}

#[tauri::command]
async fn discover_mcp_tools() -> Result<Vec<serde_json::Value>, String> {
    let discovered = crate::mcp::discover_all_tools().await?;
    let mut results = Vec::new();
    for (server_name, (_, tools)) in discovered {
        for tool in tools {
            results.push(serde_json::json!({
                "server": server_name,
                "name": tool.name,
                "description": tool.description,
                "schema": tool.input_schema
            }));
        }
    }
    Ok(results)
}

// ─── PSCM Commands ─────────────────────────────────────────────────────

#[tauri::command]
async fn pscm_search_memory(query: String, limit: Option<usize>) -> Result<Vec<serde_json::Value>, String> {
    let limit = limit.unwrap_or(10);
    let state_guard = pscm::state()
        .ok_or("PSCM not initialized")?
        .read()
        .await;
    let db = &state_guard.db;
    let graph = &state_guard.graph;
    let index = &state_guard.index;

    let results = pscm::retrieve::retrieve(&query, db, graph, index, limit).await?;

    let json_results: Vec<serde_json::Value> = results.into_iter().map(|r| {
        serde_json::json!({
            "trace_id": r.trace.id,
            "session_id": r.trace.session_id,
            "content": r.trace.raw_text,
            "role": r.trace.role,
            "timestamp": r.trace.timestamp,
            "system1_score": r.system1_score,
            "system2_score": r.system2_score,
            "composite_score": r.composite_score,
            "route": match r.route {
                pscm::retrieve::Route::System1 => "system1",
                pscm::retrieve::Route::System2 => "system2",
                pscm::retrieve::Route::Both => "both",
            }
        })
    }).collect();

    Ok(json_results)
}

#[tauri::command]
fn pscm_get_concept_graph() -> Result<serde_json::Value, String> {
    let state = pscm::state().ok_or("PSCM not initialized")?;
    let state_guard = match state.try_read() {
        Ok(guard) => guard,
        Err(_) => return Err("PSCM state locked".to_string()),
    };
    let graph = &state_guard.graph;

    let mut nodes = Vec::new();
    for node_idx in graph.graph.node_indices() {
        let node = &graph.graph[node_idx];
        nodes.push(serde_json::json!({
            "id": node.id,
            "name": node.canonical_name,
            "type": node.node_type
        }));
    }

    let mut edges = Vec::new();
    use petgraph::visit::{IntoEdgeReferences, EdgeRef};
    for edge_ref in graph.graph.edge_references() {
        let edge: &crate::pscm::graph::CausalEdge = edge_ref.weight();
        let source = &graph.graph[edge_ref.source()];
        let target = &graph.graph[edge_ref.target()];
        edges.push(serde_json::json!({
            "source": source.id,
            "target": target.id,
            "source_name": source.canonical_name,
            "target_name": target.canonical_name,
            "type": edge.edge_type,
            "weight": edge.weight,
            "confidence": edge.confidence
        }));
    }

    Ok(serde_json::json!({ "nodes": nodes, "edges": edges }))
}

#[tauri::command]
async fn pscm_add_concept_alias(
    canonical_name: String,
    alias: String,
    node_type: Option<String>,
) -> Result<(), String> {
    let mut state_guard = pscm::state()
        .ok_or("PSCM not initialized")?
        .write()
        .await;
    let timestamp = chrono::Utc::now().to_rfc3339();

    // Create the alias concept in graph
    let alias_id = uuid::Uuid::new_v4().to_string();
    let type_ = node_type.unwrap_or_else(|| "sense".to_string());
    state_guard.graph.upsert_concept(&alias_id, &alias, &type_)?;

    // Find the canonical concept
    let canonical_idx = state_guard.graph.name_to_index.get(&canonical_name)
        .ok_or_else(|| format!("Canonical concept '{}' not found", canonical_name))?;
    let canonical_id = state_guard.graph.graph[*canonical_idx].id.clone();

    // Create ALIASES edge in graph
    state_guard.graph.upsert_edge(&alias_id, &canonical_id, "ALIASES", 1.0, &timestamp, None, 1.0)?;
    
    // Persist to DB
    state_guard.db.upsert_concept(&alias_id, &alias, &type_, None, &timestamp)?;
    state_guard.db.upsert_edge(&alias_id, &canonical_id, "ALIASES", 1.0, &timestamp, None, 1.0)?;

    Ok(())
}

#[tauri::command]
async fn pscm_delete_concept_edge(
    from_id: String,
    to_id: String,
    edge_type: String,
) -> Result<(), String> {
    let mut state_guard = pscm::state()
        .ok_or("PSCM not initialized")?
        .write()
        .await;

    state_guard.db.delete_edge(&from_id, &to_id, &edge_type)?;

    let graph = &mut state_guard.graph;
    if let (Some(&from_idx), Some(&to_idx)) = (
        graph.name_to_index.get(&from_id),
        graph.name_to_index.get(&to_id),
    ) {
        if let Some(edge_idx) = graph.graph.find_edge(from_idx, to_idx) {
            if graph.graph[edge_idx].edge_type == edge_type {
                graph.graph.remove_edge(edge_idx);
            }
        }
    }

    Ok(())
}

#[tauri::command]
fn pscm_get_traces(limit: Option<i64>) -> Result<Vec<serde_json::Value>, String> {
    let limit = limit.unwrap_or(50);
    let state = pscm::state().ok_or("PSCM not initialized")?;
    let state_guard = match state.try_read() {
        Ok(guard) => guard,
        Err(_) => return Err("PSCM state locked".to_string()),
    };
    let traces = state_guard.db.load_recent_traces(limit)?;

    let json_traces: Vec<serde_json::Value> = traces.into_iter().map(|t| {
        serde_json::json!({
            "id": t.id,
            "session_id": t.session_id,
            "turn_index": t.turn_index,
            "content": t.raw_text,
            "role": t.role,
            "timestamp": t.timestamp
        })
    }).collect();

    Ok(json_traces)
}

#[tauri::command]
async fn pscm_run_dream_state() -> Result<serde_json::Value, String> {
    let dream = pscm::dream::DreamState::new();
    let report = dream.run_once().await?;

    Ok(serde_json::json!({
        "drift_count": report.drift_reports.len(),
        "causal_links": report.causal_links.len(),
        "pruned": report.prune_report.compressed_count
    }))
}

#[tauri::command]
fn pscm_get_embedding_provider() -> Result<String, String> {
    let state = pscm::state().ok_or("PSCM not initialized")?;
    let state_guard = match state.try_read() {
        Ok(guard) => guard,
        Err(_) => return Err("PSCM state locked".to_string()),
    };
    match state_guard.db.get_config("embedding_provider")? {
        Some(p) => Ok(p),
        None => Ok("openrouter".to_string()),
    }
}

#[tauri::command]
fn pscm_set_embedding_provider(provider: String) -> Result<(), String> {
    let state = pscm::state().ok_or("PSCM not initialized")?;
    let state_guard = match state.try_read() {
        Ok(guard) => guard,
        Err(_) => return Err("PSCM state locked".to_string()),
    };
    state_guard.db.set_config("embedding_provider", &provider)?;
    Ok(())
}

#[tauri::command]
fn clear_old_memories() -> Result<(), String> {
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Orkestrate");
    
    let old_db = data_dir.join("orkestrate.db");
    if old_db.exists() {
        std::fs::remove_file(&old_db)
            .map_err(|e| format!("Failed to delete old memory DB: {}", e))?;
    }
    
    let new_db = data_dir.join("orkestrate_v2.db");
    if new_db.exists() {
        std::fs::remove_file(&new_db)
            .map_err(|e| format!("Failed to delete new memory DB: {}", e))?;
    }
    
    let tantivy_dir = data_dir.join("tantivy_index");
    if tantivy_dir.exists() {
        std::fs::remove_dir_all(&tantivy_dir)
            .map_err(|e| format!("Failed to delete Tantivy index: {}", e))?;
    }
    
    Ok(())
}

// ─── Tauri App Entry ───────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            chat_opencode,
            save_message,
            get_messages,
            create_session,
            update_session_name,
            get_sessions,
            clear_messages,
            delete_session,
            get_memory_state,
            resolve_contradiction,
            delete_episode,
            generate_session_name,
            get_memory_continuity_mode,
            set_memory_continuity_mode,
            get_summaries,
            run_learn,
            get_learn_queue,
            count_pending_learn_items,
            dismiss_learn_item,
            snooze_learn_item,
            process_learn_answer,
            get_suggestions,
            get_mcp_config,
            set_mcp_config,
            discover_mcp_tools,
            pscm_search_memory,
            pscm_get_concept_graph,
            pscm_add_concept_alias,
            pscm_delete_concept_edge,
            pscm_get_traces,
            pscm_run_dream_state,
            pscm_get_embedding_provider,
            pscm_set_embedding_provider,
            clear_old_memories
        ])
        .setup(|app| {
            // Ensure prompt file exists in app data for runtime editing
            prompt::ensure_prompt_file();

            // Initialize PSCM (new dual-route memory system)
            tauri::async_runtime::spawn(async move {
                if let Err(e) = pscm::init().await {
                    eprintln!("[PSCM] Failed to initialize: {}", e);
                } else {
                    println!("[PSCM] Initialized successfully");
                }
            });

            // Start batch queue background timer for legacy memory extraction
            dotenvy::dotenv().ok();
            if let Ok(api_key) = std::env::var("OPENCODE_ZEN_API_KEY") {
                memory::batch_queue::spawn_background_timer(api_key);
            }

            // Force the window icon at runtime to bypass Windows taskbar caching
            if let Some(window) = app.get_webview_window("main") {
                let icon_bytes = include_bytes!("../icons/icon.png");
                if let Ok(icon) = Image::from_bytes(icon_bytes) {
                    let _ = window.set_icon(icon);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
