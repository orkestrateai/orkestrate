use async_trait::async_trait;
use serde_json::{json, Value};
use std::collections::HashMap;

use crate::db;

use super::Tool;

/// Format an ISO datetime as a human-readable relative time.
fn relative_time(iso: &str) -> String {
    let Ok(dt) = chrono::DateTime::parse_from_rfc3339(iso) else {
        return iso.to_string();
    };
    let now = chrono::Utc::now();
    let duration = now.signed_duration_since(dt.with_timezone(&chrono::Utc));
    let mins = duration.num_minutes();
    let hours = duration.num_hours();
    let days = duration.num_days();

    if mins < 1 {
        "just now".to_string()
    } else if mins < 60 {
        format!("{} min ago", mins)
    } else if hours < 24 {
        format!("{} hr ago", hours)
    } else if days < 7 {
        format!("{} day{} ago", days, if days == 1 { "" } else { "s" })
    } else if days < 30 {
        format!("{} week{} ago", days / 7, if days / 7 == 1 { "" } else { "s" })
    } else {
        format!("{} month{} ago", days / 30, if days / 30 == 1 { "" } else { "s" })
    }
}



// ─── Channel Result Types ────────────────────────────────────────────────

struct ChannelResult {
    episodes: Vec<db::Episode>,
    raw_scores: HashMap<String, f32>,
}

// ─── 4-Channel Retrieval ─────────────────────────────────────────────────

/// Channel 1: Semantic search using vector embeddings.
async fn semantic_channel(queries: &[String], top_k: usize) -> ChannelResult {
    let mut all_scores: HashMap<String, f32> = HashMap::new();
    let mut all_ids: Vec<String> = Vec::new();

    for query in queries {
        match crate::embed::embed(query).await {
            Ok((embedding, provider)) => {
                let model_name = provider.model_name();
                match db::search_semantic(&embedding, top_k * 2, Some(model_name)) {
                    Ok(results) => {
                        for (id, score) in results {
                            let entry = all_scores.entry(id.clone()).or_insert(0.0);
                            *entry = entry.max(score);
                            if !all_ids.contains(&id) {
                                all_ids.push(id);
                            }
                        }
                    }
                    Err(e) => eprintln!("[semantic_channel] Semantic search failed: {}", e),
                }
            }
            Err(e) => eprintln!("[semantic_channel] Embedding failed: {}", e),
        }
    }

    let mut episodes = Vec::new();
    for id in &all_ids {
        if let Ok(Some(ep)) = db::get_episode(id) {
            episodes.push(ep);
        }
    }

    ChannelResult { episodes, raw_scores: all_scores }
}

/// Channel 2: Keyword / lexical search using agent-extracted keywords.
/// The QueryParser agent already extracts high-quality keywords from the
/// query, so we use those directly instead of naive tokenization + stop-word filtering.
async fn keyword_channel(schema: &crate::pscm::agents::query_parser::QuerySchema, top_k: usize) -> ChannelResult {
    let search_words: Vec<String> = schema.keywords.clone();

    if search_words.is_empty() {
        return ChannelResult { episodes: Vec::new(), raw_scores: HashMap::new() };
    }

    // Search for episodes containing any of the words using existing DB function
    let episodes = db::search_memory(&search_words, top_k as i64 * 2).unwrap_or_default();

    // Score each episode by how many search words it contains
    let mut scores: HashMap<String, f32> = HashMap::new();
    for ep in &episodes {
        let content_lower = ep.content.to_lowercase();
        let mut matches = 0;
        for word in &search_words {
            if content_lower.contains(word) {
                matches += 1;
            }
        }
        let score = (matches as f32 / search_words.len() as f32).min(1.0);
        if score > 0.0 {
            scores.insert(ep.id.clone(), score);
        }
    }

    // Filter to episodes with at least one match
    let filtered_episodes: Vec<db::Episode> = episodes
        .into_iter()
        .filter(|ep| scores.get(&ep.id).copied().unwrap_or(0.0) > 0.0)
        .collect();

    ChannelResult { episodes: filtered_episodes, raw_scores: scores }
}

/// Channel 3: Entity graph search with spreading activation.
async fn entity_graph_channel(schema: &crate::pscm::agents::query_parser::QuerySchema, top_k: usize) -> ChannelResult {
    let mut all_episodes: Vec<db::Episode> = Vec::new();
    let mut scores: HashMap<String, f32> = HashMap::new();

    for entity_name in &schema.entities {
        match db::search_entities(entity_name, 5) {
            Ok(entities) => {
                for entity in entities {
                    match db::get_episodes_for_entity(&entity.id, top_k as i64) {
                        Ok(eps) => {
                            for ep in eps {
                                let ep_id = ep.id.clone();
                                let entry = scores.entry(ep_id.clone()).or_insert(0.0);
                                *entry = entry.max(0.95);
                                if !all_episodes.iter().any(|e| e.id == ep_id) {
                                    all_episodes.push(ep);
                                }

                                // Spreading activation: 1-hop follow with strong decay
                                // Only activate if corpus is large enough to avoid arc pollution
                                let min_corpus_for_spreading = 50;
                                if db::count_all_episodes().unwrap_or(0) >= min_corpus_for_spreading {
                                    for edge_type in &["progression", "association"] {
                                        match db::get_related_episodes(&ep_id, Some(edge_type), 2) {
                                            Ok(related) => {
                                                for rel_ep in related {
                                                    let decayed = 0.40 * 0.95; // strong decay
                                                    let entry = scores.entry(rel_ep.id.clone()).or_insert(0.0);
                                                    *entry = entry.max(decayed);
                                                    if !all_episodes.iter().any(|e| e.id == rel_ep.id) {
                                                        all_episodes.push(rel_ep);
                                                    }
                                                }
                                            }
                                            Err(e) => eprintln!("[entity_graph_channel] Spreading activation failed: {}", e),
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => eprintln!("[entity_graph_channel] Failed to load episodes: {}", e),
                    }
                }
            }
            Err(e) => eprintln!("[entity_graph_channel] Entity search failed: {}", e),
        }
    }

    ChannelResult { episodes: all_episodes, raw_scores: scores }
}

/// Channel 4: Temporal channel.
async fn temporal_channel(top_k: usize, schema: &crate::pscm::agents::query_parser::QuerySchema) -> ChannelResult {
    let episodes = db::load_recent_episodes(top_k as i64).unwrap_or_default();
    let mut scores = HashMap::new();

    let now = chrono::Utc::now();
    let halflife = schema.recency_halflife_days as f32;
    for ep in &episodes {
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&ep.created_at) {
            let days = now.signed_duration_since(dt.with_timezone(&chrono::Utc)).num_days() as f32;
            let recency_score = (-days / halflife).exp();
            let boost = if schema.temporal { recency_score * 1.5 } else { recency_score };
            scores.insert(ep.id.clone(), boost.min(1.0));
        }
    }

    ChannelResult { episodes, raw_scores: scores }
}

// ─── Fusion ──────────────────────────────────────────────────────────────

/// Fuse 4 channel results into a single ranked list using max-pool fusion.
/// Weights: semantic 40%, keyword 20%, entity 25%, temporal 15%
/// Filters out results below min_score threshold.
fn fuse_channels(
    semantic: ChannelResult,
    keyword: ChannelResult,
    entity: ChannelResult,
    temporal: ChannelResult,
    schema: &crate::pscm::agents::query_parser::QuerySchema,
    top_k: usize,
    min_score: f32,
) -> Vec<db::Episode> {
    let mut fused: HashMap<String, (f32, Option<db::Episode>)> = HashMap::new();

    let mut add_channel = |channel: ChannelResult, weight: f32| {
        for ep in channel.episodes {
            let score = channel.raw_scores.get(&ep.id).copied().unwrap_or(0.0);
            let entry = fused.entry(ep.id.clone()).or_insert((0.0, None));
            entry.0 = entry.0.max(score * weight);
            if entry.1.is_none() {
                entry.1 = Some(ep);
            }
        }
    };

    // Use adaptive weights from the QueryParser agent instead of hardcoded values
    let w = &schema.channel_weights;
    add_channel(semantic, w.semantic as f32);
    add_channel(keyword, w.keyword as f32);
    add_channel(entity, w.entity as f32);
    add_channel(temporal, w.temporal as f32);

    println!(
        "[fuse_channels] adaptive weights | semantic={:.2} keyword={:.2} entity={:.2} temporal={:.2}",
        w.semantic, w.keyword, w.entity, w.temporal
    );

    let mut scored: Vec<(f32, db::Episode)> = fused
        .into_iter()
        .filter_map(|(_, (score, ep_opt))| {
            ep_opt.map(|ep| (score, ep))
        })
        .filter(|(score, _)| *score >= min_score)
        .collect();

    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(top_k);

    scored.into_iter().map(|(_, ep)| ep).collect()
}

// ─── Public API ──────────────────────────────────────────────────────────

/// Multi-channel memory search with schema-aware retrieval.
pub async fn search_memory_raw(queries: &[String], top_k: usize) -> Vec<db::Episode> {
    if queries.is_empty() {
        return Vec::new();
    }

    let primary_query = queries.first().map(|s| s.as_str()).unwrap_or("");
    let schema = crate::pscm::agents::query_parser::parse_query(primary_query).await;

    println!(
        "[search_memory_raw] Query: '{}' | Entities: {:?} | Keywords: {:?} | Temporal: {} | Contradiction-aware: {} | Pronouns: {:?} | Weights: s={:.2} k={:.2} e={:.2} t={:.2}",
        primary_query, schema.entities, schema.keywords, schema.temporal, schema.contradiction_sensitive,
        schema.pronoun_resolutions, schema.channel_weights.semantic, schema.channel_weights.keyword,
        schema.channel_weights.entity, schema.channel_weights.temporal
    );

    let semantic_fut = semantic_channel(queries, top_k);
    let keyword_fut = keyword_channel(&schema, top_k);
    let entity_fut = entity_graph_channel(&schema, top_k);
    let temporal_fut = temporal_channel(top_k, &schema);

    let (semantic_res, keyword_res, entity_res, temporal_res) =
        tokio::join!(semantic_fut, keyword_fut, entity_fut, temporal_fut);

    // Use min_score threshold to filter out pure noise. Temporal-only episodes
    // score at most 0.08, so min_score of 0.09 filters them unless another
    // channel also finds the episode.
    let min_score = 0.09;
    let mut results = fuse_channels(semantic_res, keyword_res, entity_res, temporal_res, &schema, top_k, min_score);

    // If contradiction-sensitive, inject known contradictions for top entities
    if schema.contradiction_sensitive && !schema.entities.is_empty() {
        for entity_name in &schema.entities {
            if let Ok(entities) = db::search_entities(entity_name, 3) {
                for entity in entities {
                    if let Ok(eps) = db::get_episodes_for_entity(&entity.id, 10) {
                        for ep in eps {
                            if !results.iter().any(|r| r.id == ep.id) {
                                results.push(ep);
                            }
                        }
                    }
                }
            }
        }
    }

    results.truncate(top_k);
    results
}

/// Format episodes into a concise string for injection into the system prompt.
pub fn format_retrieved_memories(episodes: &[db::Episode]) -> String {
    if episodes.is_empty() {
        return String::new();
    }

    let items: Vec<String> = episodes
        .iter()
        .map(|ep| {
            let when = relative_time(&ep.created_at);
            format!("- [{}] {} ({})", ep.type_, ep.content, when)
        })
        .collect();

    format!(
        "Retrieved from your memory:\n{}\n\nUse these facts to ground your response. If they conflict with the user's current statement, ask about the change.",
        items.join("\n")
    )
}

// ─── Tauri Command Wrapper ───────────────────────────────────────────────

pub struct SearchMemoryTool;

#[async_trait]
impl Tool for SearchMemoryTool {
    fn name(&self) -> &'static str {
        "search_memory"
    }

    fn description(&self) -> &'static str {
        "Query your memory store for facts about the user. \
This is your long-term memory — it contains everything you know about them across all conversations: \
their projects, preferences, habits, goals, relationships, and past statements. \
Call this when the user's question involves anything personal ('what do I like', 'what did I say'), \
anything about their work or projects, or anytime the context seems thin and you need grounding. \
Also call this when the compiled profile above looks empty or incomplete. \
Generate 3-7 targeted search queries."
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "queries": {
                    "type": "array",
                    "items": { "type": "string" },
                    "description": "3-7 search queries to run against the memory store"
                }
            },
            "required": ["queries"]
        })
    }

    async fn execute(&self, args: Value) -> Result<String, String> {
        let queries: Vec<String> = args["queries"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        if queries.is_empty() {
            return Err("No queries provided".to_string());
        }

        let episodes = search_memory_raw(&queries, 15).await;

        let json_result = json!({
            "query_count": queries.len(),
            "result_count": episodes.len(),
            "results": episodes.iter().map(|ep| {
                let decayed_importance = crate::vector::decay_importance(ep.importance, &ep.created_at);
                json!({
                    "content": ep.content,
                    "type": ep.type_,
                    "confidence": ep.confidence,
                    "importance": ep.importance,
                    "decayed_importance": decayed_importance,
                    "section": ep.schema_section,
                    "when": relative_time(&ep.created_at)
                })
            }).collect::<Vec<_>>()
        });

        Ok(json_result.to_string())
    }
}
