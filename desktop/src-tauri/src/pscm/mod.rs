pub mod agents;
pub mod db;
pub mod dream;
pub mod graph;
pub mod index;
pub mod ingest;
pub mod provider;
pub mod rerank;
pub mod retrieve;

use std::sync::OnceLock;
use tokio::sync::RwLock;

use crate::pscm::db::PscmDb;
use crate::pscm::graph::ConceptGraph;
use crate::pscm::index::MemoryIndex;

/// Global PSCM state.
static PSCM: OnceLock<RwLock<PscmState>> = OnceLock::new();

pub struct PscmState {
    pub db: PscmDb,
    pub graph: ConceptGraph,
    pub index: MemoryIndex,
}

impl PscmState {
    pub fn new() -> Result<Self, String> {
        let db = PscmDb::new()?;
        let graph = ConceptGraph::new(&db)?;
        let index = MemoryIndex::new(&db)?;
        Ok(Self { db, graph, index })
    }
}

/// Initialize the global PSCM state.
pub async fn init() -> Result<(), String> {
    let state = PscmState::new()?;
    let _ = PSCM.set(RwLock::new(state));
    // Start the dream state background timer
    dream::spawn_idle_timer();
    Ok(())
}

/// Access the global PSCM state.
/// Returns None if PSCM has not been initialized.
pub fn state() -> Option<&'static RwLock<PscmState>> {
    PSCM.get()
}


