use crate::pscm::db::{PscmDb, Trace};
use crate::pscm::graph::ConceptGraph;
use crate::pscm::index::MemoryIndex;
use crate::pscm::provider::embed;
use std::collections::HashMap;

/// Dual-route memory retrieval.
///
/// Phase 1 — PCL Expansion: resolve slang/aliases in the query.
/// Phase 2 — System-1 (Fast Associative): HNSW vector search + Tantivy BM25 + RRF fusion.
/// Phase 3 — System-2 (Slow Causal): petgraph traversal from entities in the query.
/// Phase 4 — Composite reranking: merge both routes with temporal, access, and causal boosts.
pub async fn retrieve(
    query: &str,
    db: &PscmDb,
    graph: &ConceptGraph,
    index: &MemoryIndex,
    top_k: usize,
) -> Result<Vec<RetrievedTrace>, String> {
    // ─── Phase 1: PCL Expansion ──────────────────────────────────────────
    let expanded_query = graph.expand_query(query);
    println!("[PSCM Retrieve] expanded: '{}' -> '{}'", query, expanded_query);

    // ─── Phase 2: System-1 (Fast Associative) ────────────────────────────
    let system1_results = system1_retrieve(&expanded_query, index, top_k * 3).await?;

    // ─── Phase 3: System-2 (Slow Causal) ─────────────────────────────────
    let system2_results = system2_retrieve(query, graph, db, top_k * 3).await?;

    // ─── Phase 4: Composite Merge ────────────────────────────────────────
    let merged = merge_routes(system1_results, system2_results);
    let reranked = super::rerank::composite_rerank(merged, db, graph)?;

    // Take top_k
    let final_results: Vec<RetrievedTrace> = reranked.into_iter().take(top_k).collect();

    println!("[PSCM Retrieve] returned {} traces", final_results.len());
    Ok(final_results)
}

#[derive(Debug, Clone)]
pub struct RetrievedTrace {
    pub trace: Trace,
    pub system1_score: f64,
    pub system2_score: f64,
    pub composite_score: f64,
    pub route: Route,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Route {
    System1,
    System2,
    Both,
}

// ─── System-1: HNSW + BM25 + RRF ───────────────────────────────────────

async fn system1_retrieve(
    query: &str,
    index: &MemoryIndex,
    k: usize,
) -> Result<Vec<(String, f64)>, String> {
    // Embed the query
    let query_embedding = embed::embed_vec(query).await?;

    // HNSW vector search
    let vector_results = index.search_vector(&query_embedding, k);

    // Tantivy BM25 search
    let bm25_results = index.search_bm25(query, k)?;

    // Reciprocal Rank Fusion
    let fused = reciprocal_rank_fusion(vector_results, bm25_results, 60.0);

    Ok(fused)
}

fn reciprocal_rank_fusion(
    vector_results: Vec<(String, f32)>,
    bm25_results: Vec<(String, f32)>,
    k: f64,
) -> Vec<(String, f64)> {
    let mut scores: HashMap<String, f64> = HashMap::new();

    // Add vector scores (rank-based)
    for (rank, (id, _score)) in vector_results.iter().enumerate() {
        let s = scores.entry(id.clone()).or_insert(0.0);
        *s += 1.0 / (k + rank as f64 + 1.0);
    }

    // Add BM25 scores (rank-based)
    for (rank, (id, _score)) in bm25_results.iter().enumerate() {
        let s = scores.entry(id.clone()).or_insert(0.0);
        *s += 1.0 / (k + rank as f64 + 1.0);
    }

    let mut results: Vec<(String, f64)> = scores.into_iter().collect();
    results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    results
}

// ─── System-2: Graph Traversal ─────────────────────────────────────────

async fn system2_retrieve(
    query: &str,
    graph: &ConceptGraph,
    db: &PscmDb,
    k: usize,
) -> Result<Vec<(String, f64)>, String> {
    // Extract entities from query using the TraceAnalyzer agent
    let entities = match super::agents::trace_analyzer::extract_entities(query).await {
        Ok(e) => e,
        Err(e) => {
            eprintln!("[PSCM Retrieve] TraceAnalyzer failed: {}. Falling back to empty entity set.", e);
            Vec::new()
        }
    };

    let mut trace_scores: HashMap<String, f64> = HashMap::new();

    for (entity_name, _node_type) in entities {
        // Traverse graph from this entity
        let linked = graph.traverse_from_entity(&entity_name, 3);

        for (linked_name, traversal_score) in linked {
            // Find traces that mention this linked concept
            let traces = find_traces_for_concept(&linked_name, db)?;
            for trace_id in traces {
                let entry = trace_scores.entry(trace_id).or_insert(0.0);
                *entry = entry.max(traversal_score);
            }
        }
    }

    let mut results: Vec<(String, f64)> = trace_scores.into_iter().collect();
    results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    results.truncate(k);
    Ok(results)
}

fn find_traces_for_concept(concept_name: &str, db: &PscmDb) -> Result<Vec<String>, String> {
    let conn = db.conn()?;
    let mut stmt = conn
        .prepare(
            "SELECT tc.trace_id FROM trace_concepts tc
             JOIN concepts c ON tc.concept_id = c.id
             WHERE c.canonical_name = ?1 OR c.id = ?1"
        )
        .map_err(|e| e.to_string())?;

    let trace_ids: Result<Vec<String>, _> = stmt
        .query_map([concept_name], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect();

    trace_ids.map_err(|e| e.to_string())
}

// ─── Merge Routes ──────────────────────────────────────────────────────

fn merge_routes(
    system1: Vec<(String, f64)>,
    system2: Vec<(String, f64)>,
) -> HashMap<String, (f64, f64, Route)> {
    let mut merged: HashMap<String, (f64, f64, Route)> = HashMap::new();

    for (id, score) in system1 {
        merged.insert(id, (score, 0.0, Route::System1));
    }

    for (id, score) in system2 {
        let entry = merged.entry(id).or_insert((0.0, 0.0, Route::System2));
        entry.1 = score;
        if entry.2 == Route::System1 {
            entry.2 = Route::Both;
        }
    }

    merged
}
