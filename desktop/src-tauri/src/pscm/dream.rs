use crate::pscm::agents::concept_drift::ConceptDriftAgent;
use crate::pscm::agents::causal_weaver::CausalWeaverAgent;
use crate::pscm::agents::episodic_pruner::EpisodicPrunerAgent;
use crate::pscm::state;

/// Dream State Orchestrator
///
/// Runs a lightweight multi-agent swarm during idle time (no user messages
/// for > 60 seconds) or on app startup. The swarm performs background
/// consolidation: concept drift detection, causal link discovery, and
/// episodic memory pruning.
pub struct DreamState;

impl DreamState {
    pub fn new() -> Self {
        Self
    }

    pub async fn run_once(&self) -> Result<DreamReport, String> {
        let mut state_guard = state()
            .ok_or("PSCM not initialized")?
            .write()
            .await;

        // Agent 1: Concept Drift (immutable borrows only)
        let drift_reports = {
            let db = &state_guard.db;
            let graph = &state_guard.graph;
            ConceptDriftAgent::new().run(db, graph).await?
        };

        // Agent 2: Causal Weaver
        // Load traces first (immutable borrow), then mutate graph
        let traces = state_guard.db.load_recent_traces(1000)?;
        let causal_links = {
            let graph = &mut state_guard.graph;
            let weaver = CausalWeaverAgent::new();
            let links = weaver.analyze(traces);
            weaver.apply_links(&links, graph)?;
            links
        };

        // Agent 3: Episodic Pruner (immutable borrow only)
        let prune_report = EpisodicPrunerAgent::new().run(&state_guard.db).await?;

        Ok(DreamReport {
            drift_reports,
            causal_links,
            prune_report,
        })
    }
}

#[derive(Debug, Clone)]
pub struct DreamReport {
    pub drift_reports: Vec<crate::pscm::agents::concept_drift::DriftReport>,
    pub causal_links: Vec<crate::pscm::agents::causal_weaver::CausalLink>,
    pub prune_report: crate::pscm::agents::episodic_pruner::PruneReport,
}

/// Spawn a background task that runs the dream state every 60 seconds of idle time.
pub fn spawn_idle_timer() {
    tokio::spawn(async move {
        let mut idle_count = 0;
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
            idle_count += 1;

            // Run dream state every 6 idle ticks (~60 seconds)
            if idle_count >= 6 {
                let dream = DreamState::new();
                match dream.run_once().await {
                    Ok(report) => {
                        println!(
                            "[Dream State] completed: {} drifts, {} causal links, {} pruned",
                            report.drift_reports.len(),
                            report.causal_links.len(),
                            report.prune_report.compressed_count
                        );
                    }
                    Err(e) => {
                        eprintln!("[Dream State] error: {}", e);
                    }
                }
                idle_count = 0;
            }
        }
    });
}

#[allow(dead_code)]
/// Reset idle counter on user activity.
pub fn reset_idle() {
    // TODO: implement actual idle tracking with atomic counter
}
