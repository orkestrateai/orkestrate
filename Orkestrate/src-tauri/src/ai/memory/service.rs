use std::path::PathBuf;
use serde_json::json;
use crate::ai::memory::{MemoryManager, SESSION_REGISTRY, TOOL_TRACES};
use crate::ai::handler::SESSION_ID;
use crate::ai::memory::extraction::run_pipeline;
use crate::ai::memory::extraction::DecisionAction;
use crate::ai::memory::entity::resolve_entity_context;
use crate::ai::memory::session::ToolCallRecord;
use crate::ai::memory::embeddings::{embed_text, memory_to_embed_text};
use crate::ai::memory::constants::SEARCH_MAX_RESULTS;

pub struct ChatMemoryService {
    manager: MemoryManager,
}

impl ChatMemoryService {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self {
            manager: MemoryManager::new(app_data_dir),
        }
    }

    pub fn manager(&self) -> &MemoryManager {
        &self.manager
    }

    pub fn get_user_profile(&self) -> String {
        self.manager.get_user_profile()
    }

    pub async fn extract_and_store(
        &self,
        session_id: &str,
        user_message: &str,
        assistant_message: &str,
        tool_trace: &[ToolCallRecord],
        entity_context: &str,
        conversation_history: &str,
    ) -> Result<(), String> {
        eprintln!("[memory] Starting extraction for session {}...", session_id);
        eprintln!("[memory]   user: {}", user_message.chars().take(60).collect::<String>());
        let result = run_pipeline(
            &self.manager,
            user_message,
            assistant_message,
            tool_trace,
            entity_context,
            conversation_history,
        ).await?;

        let decisions = result.decisions;
        let plan = result.plan;

        eprintln!("[memory] Pipeline returned {} decisions", decisions.len());

        // Update SWM from LLM analyzer output (replaces heuristics)
        {
            if let Some(mut swm) = SESSION_REGISTRY.get_mut(session_id) {
                if !plan.swm.topic.is_empty() && plan.swm.topic != "General" {
                    swm.update_topic(&plan.swm.topic);
                }
                if !plan.swm.entities.is_empty() {
                    // Update the latest user turn with LLM-extracted entities
                    if let Some(last_turn) = swm.recent_turns.last_mut() {
                        if last_turn.role == "user" {
                            last_turn.entities = plan.swm.entities.clone();
                        }
                    }
                }
                if !plan.swm.pronoun_bindings.is_empty() {
                    swm.update_bindings(plan.swm.pronoun_bindings.clone());
                }
                swm.turn_count += 1;
            }
        }

        for decision in &decisions {
            let fact_preview = decision.fact.content.chars().take(80).collect::<String>();
            match decision.action {
                DecisionAction::Store => {
                    eprintln!("[memory]   STORE domain={} topic={} confidence={} provenance={} content=\"{}\"",
                        decision.fact.domain, decision.fact.topic, decision.fact.confidence,
                        decision.fact.provenance, fact_preview);
                    self.manager
                        .store_extracted_fact(&decision.fact)
                        .map_err(|e| format!("Failed to store fact '{}': {}", decision.fact.title, e))?;

                    if let Err(e) = self.manager.update_user_profile(&decision.fact) {
                        eprintln!("[memory] Failed to update user profile: {e}");
                    }

                    // Generate and store embedding
                    let embed_text_str = memory_to_embed_text(
                        &decision.fact.domain,
                        &decision.fact.topic,
                        &decision.fact.title,
                        &decision.fact.content,
                        &decision.fact.entities,
                    );
                    match embed_text(&embed_text_str).await {
                        Ok(vector) => {
                            if let Err(e) = self.manager.storage().write_embedding(
                                &decision.fact.domain,
                                &decision.fact.topic,
                                None,
                                &decision.fact.title,
                                &vector,
                            ) {
                                eprintln!("[memory] Failed to store embedding for '{}': {}", decision.fact.title, e);
                            } else {
                                eprintln!("[memory]   Embedding stored for '{}' (dim={})", decision.fact.title, vector.len());
                            }
                        }
                        Err(e) => {
                            eprintln!("[memory] Embedding generation failed for '{}': {}", decision.fact.title, e);
                        }
                    }

                    if let Some(mut swm) = SESSION_REGISTRY.get_mut(session_id) {
                        swm.add_extracted_memory(&decision.fact.title, &decision.fact.domain);
                    }
                }
                DecisionAction::Contradiction => {
                    eprintln!("[memory]   CONTRADICTION content=\"{}\" reason={:?}", fact_preview, decision.reason);
                    self.manager
                        .store_extracted_fact(&decision.fact)
                        .map_err(|e| format!("Failed to store contradiction: {}", e))?;
                }
                DecisionAction::UpdateConfidence => {
                    eprintln!("[memory]   UPDATE_CONFIDENCE content=\"{}\"", fact_preview);
                }
                DecisionAction::Reject => {
                    eprintln!("[memory]   REJECT reason={:?} content=\"{}\"", decision.reason, fact_preview);
                }
            }
        }

        eprintln!("[memory] Extraction complete for session {}", session_id);

        // Periodic profile consolidation every 5 turns
        let turn_count = SESSION_REGISTRY.get(session_id).map(|s| s.turn_count).unwrap_or(0);
        if turn_count > 0 && turn_count % 5 == 0 {
            eprintln!("[memory] Turn {turn_count} — triggering profile consolidation...");
            if let Err(e) = crate::ai::memory::profile::consolidate(&self.manager).await {
                eprintln!("[memory] Profile consolidation failed: {e}");
            }
        }

        Ok(())
    }

    /// Returns entity context for system prompt injection.
    pub fn get_entity_context(&self, user_message: &str) -> String {
        resolve_entity_context(&self.manager, user_message)
    }

    pub async fn search_context_with_session(&self, queries: Vec<String>) -> String {
        let trace_queries = queries.clone();

        // 1. BM25 search
        let bm25_results = match self.manager.search(queries.clone()) {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[memory] BM25 search failed: {}", e);
                Vec::new()
            }
        };

        // 2. Semantic search: embed the first query and find nearest neighbors
        let semantic_results = if !queries.is_empty() {
            let query_text = queries.join(" ");
            match embed_text(&query_text).await {
                Ok(query_emb) => {
                    match self.manager.search_semantic(&query_emb, 8) {
                        Ok(r) => r,
                        Err(e) => {
                            eprintln!("[memory] Semantic search failed: {}", e);
                            Vec::new()
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[memory] Query embedding failed: {}", e);
                    Vec::new()
                }
            }
        } else {
            Vec::new()
        };

        // 3. Blend results: normalize BM25 scores, combine with semantic
        let mut combined: std::collections::HashMap<String, crate::ai::memory::manager::Memory> =
            std::collections::HashMap::new();

        // Normalize BM25 scores to 0-1 range
        let max_bm25 = bm25_results.iter().map(|m| m.score).fold(0.0, f64::max);
        for mut m in bm25_results {
            if max_bm25 > 0.0 {
                m.score = (m.score / max_bm25) * 0.5; // BM25 weight = 0.5
            }
            combined.insert(m.id.clone(), m);
        }

        // Add semantic scores (already 0-1 from cosine similarity)
        for mut m in semantic_results {
            m.score = m.score * 0.5; // Semantic weight = 0.5
            if let Some(existing) = combined.get_mut(&m.id) {
                existing.score += m.score;
            } else {
                combined.insert(m.id.clone(), m);
            }
        }

        let mut memories: Vec<crate::ai::memory::manager::Memory> = combined.into_values().collect();
        memories.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        memories.truncate(SEARCH_MAX_RESULTS);

        if memories.is_empty() {
            let _ = SESSION_ID.try_with(|sid: &String| {
                TOOL_TRACES.entry(sid.clone()).or_insert_with(Vec::new)
                    .push(ToolCallRecord {
                        queries: trace_queries,
                        memory_content: vec!["No results found".to_string()],
                    });
            });
            return "No relevant information found in memory.".to_string();
        }

        for m in &memories {
            if let Err(e) = self.manager.record_access_hit(&m.id) {
                eprintln!("[memory] Failed to record access hit for {}: {}", m.id, e);
            }
        }

        let trace_contents: Vec<String> = memories.iter().map(|m| m.content.clone()).collect();

        let _ = SESSION_ID.try_with(|sid: &String| {
            if let Some(mut swm) = SESSION_REGISTRY.get_mut(sid.as_str()) {
                swm.update_from_search(&memories);
            }

            TOOL_TRACES.entry(sid.clone()).or_insert_with(Vec::new)
                .push(ToolCallRecord {
                    queries: trace_queries,
                    memory_content: trace_contents,
                });
        });

        json!({
            "results": memories.iter().map(|m| {
                json!({
                    "content": m.content,
                    "id": m.id,
                    "relevance": m.score,
                    "confidence": m.confidence,
                    "entities": m.entities
                })
            }).collect::<Vec<_>>()
        }).to_string()
    }
}
