use crate::pscm::db::PscmDb;
use crate::pscm::graph::ConceptGraph;

/// Concept Drift Agent
///
/// Monitors how concept meanings shift over time. When a concept's usage
/// diverges from its original embedding (by cosine distance > 0.4), this
/// agent proposes a new node type or triggers a "state-of" edge update.
///
/// Inspired by Kumiho's node-type evolution and E-mem's hierarchical drift detection.
pub struct ConceptDriftAgent;

impl ConceptDriftAgent {
    pub fn new() -> Self {
        Self
    }

    pub async fn run(&self, db: &PscmDb, _graph: &ConceptGraph) -> Result<Vec<DriftReport>, String> {
        let mut reports = Vec::new();
        let concepts = db.load_concepts()?;

        for concept in &concepts {
            if concept.node_type == "sense" {
                // Senses are volatile by design — check if they've stabilized
                if concept.access_count > 10 {
                    reports.push(DriftReport {
                        concept_id: concept.id.clone(),
                        concept_name: concept.canonical_name.clone(),
                        drift_type: DriftType::Stabilization,
                        confidence: 0.7,
                        action: format!("Consider promoting '{}' from 'sense' to 'entity'", concept.canonical_name),
                    });
                }
            }

            // Check for emerging aliases (new capitalized mentions of this concept)
            // TODO: implement embedding-based drift detection when embeddings are stored per-trace
        }

        println!("[Dream: ConceptDrift] checked {} concepts, found {} drifts", concepts.len(), reports.len());
        Ok(reports)
    }
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct DriftReport {
    pub concept_id: String,
    pub concept_name: String,
    pub drift_type: DriftType,
    pub confidence: f64,
    pub action: String,
}

#[derive(Debug, Clone, Copy, PartialEq)]
#[allow(dead_code)]
pub enum DriftType {
    Stabilization,      // Sense → Entity promotion
    SemanticShift,      // Meaning changed over time
    EmergingAlias,      // New slang detected
    FadingRelevance,    // Concept no longer mentioned
}
