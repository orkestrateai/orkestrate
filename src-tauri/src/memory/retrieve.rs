use chrono::{DateTime, Utc};
use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::agents::query_expander::ExpandedQuery;
use crate::memory::embedding;
use crate::memory::schema::get_db;

/// A retrieved memory with relevance score.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetrievedMemory {
    pub id: String,
    pub content: String,
    pub capacity: String,
    pub relevance_score: f32,
    pub timestamp: String,
    pub entities: Vec<String>,
}

/// Deserialize a BLOB back into Vec<f32>.
fn deserialize_embedding(blob: &[u8]) -> Vec<f32> {
    blob.chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect()
}

/// Load all entity embeddings from the database.
fn load_entity_embeddings(conn: &rusqlite::Connection) -> Result<Vec<(String, String, String, String, Vec<f32>)>, String> {
    let mut stmt = conn
        .prepare("SELECT e.id, e.name, e.profile, e.last_seen, ee.embedding FROM entities e LEFT JOIN entity_embeddings ee ON e.id = ee.entity_id")
        .map_err(|e| format!("entity embed prep: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let profile: String = row.get(2)?;
            let last_seen: String = row.get(3)?;
            let embed_blob: Option<Vec<u8>> = row.get(4)?;
            let embedding = embed_blob.map(|b| deserialize_embedding(&b)).unwrap_or_default();
            Ok((id, name, profile, last_seen, embedding))
        })
        .map_err(|e| format!("entity embed query: {}", e))?;

    rows.filter_map(|r| r.ok()).collect::<Vec<_>>()
        .into_iter()
        .filter(|(_, _, _, _, embed)| !embed.is_empty())
        .collect::<Vec<_>>()
        .into_iter()
        .map(|(id, name, profile, last_seen, embedding)| Ok((id, name, profile, last_seen, embedding)))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e: String| e)
}

/// Load all history embeddings from the database.
fn load_history_embeddings(conn: &rusqlite::Connection) -> Result<Vec<(String, String, String, String, Vec<f32>)>, String> {
    let mut stmt = conn
        .prepare("SELECT h.id, h.description, h.timestamp, h.entities_involved, he.embedding FROM history h LEFT JOIN history_embeddings he ON h.id = he.history_id")
        .map_err(|e| format!("history embed prep: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let description: String = row.get(1)?;
            let timestamp: String = row.get(2)?;
            let entities_json: String = row.get(3)?;
            let embed_blob: Option<Vec<u8>> = row.get(4)?;
            let embedding = embed_blob.map(|b| deserialize_embedding(&b)).unwrap_or_default();
            Ok((id, description, timestamp, entities_json, embedding))
        })
        .map_err(|e| format!("history embed query: {}", e))?;

    rows.filter_map(|r| r.ok()).collect::<Vec<_>>()
        .into_iter()
        .filter(|(_, _, _, _, embed)| !embed.is_empty())
        .collect::<Vec<_>>()
        .into_iter()
        .map(|(id, desc, ts, entities, embedding)| Ok((id, desc, ts, entities, embedding)))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e: String| e)
}

/// Retrieve memories matching a set of expanded queries.
/// Uses brute-force cosine similarity in Rust. O(N) per query, fine for personal scale.
pub async fn retrieve_context(
    queries: &[ExpandedQuery],
    top_n: usize,
) -> Result<Vec<RetrievedMemory>, String> {
    let conn = get_db().map_err(|e| format!("db open failed: {}", e))?;

    // Step 1: Compute all query embeddings async
    let mut query_embeddings: Vec<(&ExpandedQuery, Vec<f32>)> = Vec::new();
    for query in queries.iter().take(10) {
        if query.priority < 3 {
            continue;
        }
        match embedding::embed(&query.query).await {
            Ok(vec) => query_embeddings.push((query, vec)),
            Err(e) => {
                eprintln!("Embedding failed for query '{}': {}", query.query, e);
                continue;
            }
        }
    }

    if query_embeddings.is_empty() {
        // Fallback: text search only
        return text_search_fallback(&conn, queries, top_n);
    }

    // Step 2: Load all stored embeddings (sync)
    let entity_embeds = load_entity_embeddings(&conn).unwrap_or_default();
    let history_embeds = load_history_embeddings(&conn).unwrap_or_default();

    // Step 3: Score all candidates
    let mut all_results: Vec<RetrievedMemory> = Vec::new();

    for (query, q_embed) in query_embeddings {
        // Score entities
        for (id, name, profile, last_seen, e_embed) in &entity_embeds {
            if e_embed.len() != q_embed.len() {
                continue;
            }
            let sim = embedding::cosine_similarity(&q_embed, e_embed);
            if sim > 0.5 {
                all_results.push(RetrievedMemory {
                    id: id.clone(),
                    content: format!("{}: {}", name, profile),
                    capacity: "entity".to_string(),
                    relevance_score: sim * (query.priority as f32 / 10.0),
                    timestamp: last_seen.clone(),
                    entities: vec![name.clone()],
                });
            }
        }

        // Score history
        for (id, description, timestamp, entities_json, h_embed) in &history_embeds {
            if h_embed.len() != q_embed.len() {
                continue;
            }
            let sim = embedding::cosine_similarity(&q_embed, h_embed);
            if sim > 0.5 {
                let entities: Vec<String> = serde_json::from_str(entities_json).unwrap_or_default();
                all_results.push(RetrievedMemory {
                    id: id.clone(),
                    content: description.clone(),
                    capacity: "history".to_string(),
                    relevance_score: sim * (query.priority as f32 / 10.0),
                    timestamp: timestamp.clone(),
                    entities,
                });
            }
        }
    }

    // Step 4: Deduplicate, recency boost, sort
    dedupe_and_rank(all_results, top_n)
}

/// Pure text search fallback when embeddings fail.
fn text_search_fallback(
    conn: &rusqlite::Connection,
    queries: &[ExpandedQuery],
    top_n: usize,
) -> Result<Vec<RetrievedMemory>, String> {
    let mut all_results: Vec<RetrievedMemory> = Vec::new();

    for query in queries.iter().take(5) {
        if query.priority < 3 {
            continue;
        }
        let pattern = format!("%{}%", query.query.replace(' ', "%"));

        // Text search entities
        let mut stmt = conn
            .prepare("SELECT id, name, profile, last_seen FROM entities WHERE name LIKE ?1 OR profile LIKE ?1 LIMIT 5")
            .map_err(|e| format!("entity text prep: {}", e))?;
        let rows = stmt.query_map(params![&pattern], |row| {
            Ok(RetrievedMemory {
                id: row.get(0)?,
                content: format!("{}: {}", row.get::<_, String>(1)?, row.get::<_, String>(2)?),
                capacity: "entity".to_string(),
                relevance_score: 0.7 * (query.priority as f32 / 10.0),
                timestamp: row.get(3)?,
                entities: vec![row.get::<_, String>(1)?],
            })
        }).map_err(|e| format!("entity text query: {}", e))?;
        for row in rows {
            if let Ok(mem) = row { all_results.push(mem); }
        }

        // Text search history
        let mut stmt = conn
            .prepare("SELECT id, description, timestamp, entities_involved FROM history WHERE description LIKE ?1 LIMIT 5")
            .map_err(|e| format!("history text prep: {}", e))?;
        let rows = stmt.query_map(params![&pattern], |row| {
            let entities_json: String = row.get(3)?;
            let entities: Vec<String> = serde_json::from_str(&entities_json).unwrap_or_default();
            Ok(RetrievedMemory {
                id: row.get(0)?,
                content: row.get(1)?,
                capacity: "history".to_string(),
                relevance_score: 0.7 * (query.priority as f32 / 10.0),
                timestamp: row.get(2)?,
                entities,
            })
        }).map_err(|e| format!("history text query: {}", e))?;
        for row in rows {
            if let Ok(mem) = row { all_results.push(mem); }
        }
    }

    dedupe_and_rank(all_results, top_n)
}

/// Deduplicate by ID, apply recency boost, sort by relevance, truncate.
fn dedupe_and_rank(mut memories: Vec<RetrievedMemory>, top_n: usize) -> Result<Vec<RetrievedMemory>, String> {
    let mut seen = std::collections::HashSet::new();
    memories.retain(|m| seen.insert(m.id.clone()));

    let now = Utc::now();
    for mem in &mut memories {
        if let Ok(ts) = DateTime::parse_from_rfc3339(&mem.timestamp) {
            let days_old = (now - ts.with_timezone(&Utc)).num_days();
            let recency_boost = if days_old < 1 { 1.5 } else if days_old < 7 { 1.2 } else if days_old < 30 { 1.0 } else { 0.8 };
            mem.relevance_score *= recency_boost;
        }
    }

    memories.sort_by(|a, b| b.relevance_score.partial_cmp(&a.relevance_score).unwrap());
    memories.truncate(top_n);
    Ok(memories)
}

/// Get the current Life Document (compiled by Sigma).
pub fn get_life_document() -> Result<serde_json::Value, String> {
    let conn = get_db().map_err(|e| format!("db open failed: {}", e))?;
    let doc: String = conn
        .query_row("SELECT document FROM life_document WHERE id = 1", [], |row| row.get(0))
        .unwrap_or_else(|_| "{}".to_string());
    serde_json::from_str(&doc).map_err(|e| format!("life document parse failed: {}", e))
}
