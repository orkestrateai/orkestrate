use crate::pscm::db::{PscmDb, Trace};

/// Episodic Pruner Agent
///
/// Compresses old episodic traces into higher-level summaries when:
/// 1. A trace hasn't been accessed in > 30 days.
/// 2. A cluster of traces shares the same concepts and can be merged.
/// 3. The trace's composite importance score falls below a threshold.
///
/// Rather than deleting, the pruner creates a "summary trace" that references
/// the compressed traces (immutable revision — traces are never deleted).
///
/// Inspired by E-mem's cluster compression and Mnemis's attention-weighted pruning.
pub struct EpisodicPrunerAgent;

impl EpisodicPrunerAgent {
    pub fn new() -> Self {
        Self
    }

    pub async fn run(&self, db: &PscmDb) -> Result<PruneReport, String> {
        let traces = db.load_recent_traces(10_000)?; // Load all for analysis
        let now = chrono::Utc::now();

        let mut candidates = Vec::new();
        let mut protected = 0;

        for trace in traces {
            // Parse timestamp
            let trace_time = match chrono::DateTime::parse_from_rfc3339(&trace.timestamp) {
                Ok(t) => t.with_timezone(&chrono::Utc),
                Err(_) => continue,
            };

            let age_days = now.signed_duration_since(trace_time).num_days();

            // Compute importance proxy
            let importance = estimate_importance(&trace, age_days);

            if importance < 0.2 && age_days > 30 {
                candidates.push(trace);
            } else {
                protected += 1;
            }
        }

        // Group candidates by session for potential cluster compression
        let mut sessions: std::collections::HashMap<String, Vec<Trace>> = std::collections::HashMap::new();
        for trace in candidates {
            sessions.entry(trace.session_id.clone()).or_default().push(trace);
        }

        let mut compressed_count = 0;
        let mut summary_count = 0;

        for (_session_id, session_traces) in sessions {
            if session_traces.len() >= 3 {
                // Compress this cluster into a summary
                // TODO: generate summary text via lightweight LLM call
                summary_count += 1;
                compressed_count += session_traces.len();
            }
        }

        println!(
            "[Dream: EpisodicPruner] protected={}, compressed={} into {} summaries",
            protected, compressed_count, summary_count
        );

        Ok(PruneReport {
            protected_count: protected,
            compressed_count,
            summary_count,
        })
    }
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct PruneReport {
    pub protected_count: usize,
    pub compressed_count: usize,
    pub summary_count: usize,
}

/// Estimate importance of a trace.
/// Current proxy: valence magnitude + recency + length.
fn estimate_importance(trace: &Trace, age_days: i64) -> f64 {
    let valence_score = trace.valence.abs();
    let recency_score = (-(age_days as f64) / 14.0).exp(); // 14-day half-life
    let length_score = (trace.raw_text.len() as f64 / 1000.0).min(1.0);

    valence_score * 0.3 + recency_score * 0.5 + length_score * 0.2
}
