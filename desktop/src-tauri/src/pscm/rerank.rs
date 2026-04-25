use crate::pscm::db::PscmDb;
use crate::pscm::retrieve::{RetrievedTrace, Route};
use std::collections::HashMap;

/// Composite reranking combining System-1 and System-2 scores with temporal,
/// access-frequency, and causal-proximity boosts.
pub fn composite_rerank(
    merged: HashMap<String, (f64, f64, Route)>,
    db: &PscmDb,
    _graph: &crate::pscm::graph::ConceptGraph,
) -> Result<Vec<RetrievedTrace>, String> {
    let mut results = Vec::with_capacity(merged.len());

    for (trace_id, (s1, s2, route)) in merged {
        let Some(trace) = db.load_trace_by_id(&trace_id)? else {
            continue;
        };

        // Temporal recency boost (14-day half-life)
        let recency_boost = compute_recency_boost(&trace.timestamp);

        // Access frequency boost
        let access_boost = 0.0; // TODO: load from trace access log

        // Causal proximity boost (average graph traversal score to query entities)
        let causal_boost = 0.0; // TODO: compute from graph distance

        let composite = 0.5 * s1 + 0.3 * s2 + 0.1 * recency_boost + 0.05 * access_boost + 0.05 * causal_boost;

        results.push(RetrievedTrace {
            trace,
            system1_score: s1,
            system2_score: s2,
            composite_score: composite,
            route,
        });
    }

    // Sort by composite score descending
    results.sort_by(|a, b| b.composite_score.partial_cmp(&a.composite_score).unwrap());

    Ok(results)
}

/// Compute a recency boost using exponential decay with a 14-day half-life.
fn compute_recency_boost(timestamp: &str) -> f64 {
    let Ok(trace_time) = chrono::DateTime::parse_from_rfc3339(timestamp) else {
        return 0.0;
    };

    let now = chrono::Utc::now();
    let duration = now.signed_duration_since(trace_time.with_timezone(&chrono::Utc));
    let days = duration.num_days() as f64;

    if days < 0.0 {
        return 1.0; // Future-dated traces get max boost (shouldn't happen)
    }

    // Exponential decay: boost = e^(-λ·days), where λ = ln(2)/14
    let lambda = f64::ln(2.0) / 14.0;
    let boost = (-lambda * days).exp();

    // Normalize to [0, 1] range for the reranker
    boost
}
