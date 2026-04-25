use crate::pscm::db::Trace;
use crate::pscm::graph::ConceptGraph;
use std::collections::HashMap;

/// Causal Weaver Agent
///
/// Discovers causal links between concepts by analyzing temporal co-occurrence
/// and emotional valence transitions across traces.
///
/// Inspired by Kumiho's typed causal edges and E-mem's temporal analysis.
pub struct CausalWeaverAgent;

impl CausalWeaverAgent {
    pub fn new() -> Self {
        Self
    }

    /// Analyze traces and return proposed causal links without mutating graph.
    pub fn analyze(&self, traces: Vec<Trace>) -> Vec<CausalLink> {
        let mut links = Vec::new();

        // Group traces by session and sort by turn_index
        let mut sessions: HashMap<String, Vec<Trace>> = HashMap::new();
        for trace in traces {
            sessions.entry(trace.session_id.clone()).or_default().push(trace);
        }

        for (_session_id, mut session_traces) in sessions {
            session_traces.sort_by_key(|t| t.turn_index);

            // Analyze transitions between consecutive traces
            for window in session_traces.windows(2) {
                let before = &window[0];
                let after = &window[1];

                // Extract concepts from both
                let before_concepts = extract_concept_names(before);
                let after_concepts = extract_concept_names(after);

                // Detect valence shifts (emotional causation)
                let valence_shift = after.valence - before.valence;
                if valence_shift.abs() > 0.5 {
                    for bc in &before_concepts {
                        for ac in &after_concepts {
                            if bc != ac {
                                let edge_type = if valence_shift > 0.0 {
                                    "ENABLES"
                                } else {
                                    "CAUSED_BY"
                                };
                                links.push(CausalLink {
                                    from: bc.clone(),
                                    to: ac.clone(),
                                    edge_type: edge_type.to_string(),
                                    confidence: valence_shift.abs().min(1.0),
                                    _evidence: format!("valence shift {} -> {}", before.valence, after.valence),
                                });
                            }
                        }
                    }
                }

                // Detect topic drift causation
                if after.topic_drift && !before.topic_drift {
                    for bc in &before_concepts {
                        for ac in &after_concepts {
                            if bc != ac {
                                links.push(CausalLink {
                                    from: bc.clone(),
                                    to: ac.clone(),
                                    edge_type: "FOLLOWS".to_string(),
                                    confidence: 0.6,
                                    _evidence: "topic drift detected".to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }

        // Deduplicate by keeping max confidence
        let mut seen = HashMap::new();
        for link in &links {
            let key = (link.from.clone(), link.to.clone(), link.edge_type.clone());
            let entry = seen.entry(key).or_insert(link.clone());
            entry.confidence = entry.confidence.max(link.confidence);
        }

        seen.into_values().collect()
    }

    /// Apply discovered links to the graph and DB.
    pub fn apply_links(
        &self,
        links: &[CausalLink],
        graph: &mut ConceptGraph,
    ) -> Result<(), String> {
        let timestamp = chrono::Utc::now().to_rfc3339();
        for link in links {
            if let (Some(from_idx), Some(to_idx)) = (
                graph.name_to_index.get(&link.from),
                graph.name_to_index.get(&link.to),
            ) {
                let from_id = graph.graph[*from_idx].id.clone();
                let to_id = graph.graph[*to_idx].id.clone();
                graph.upsert_edge(
                    &from_id,
                    &to_id,
                    &link.edge_type,
                    link.confidence,
                    &timestamp,
                    None,
                    link.confidence,
                )?;
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct CausalLink {
    pub from: String,
    pub to: String,
    pub edge_type: String,
    pub confidence: f64,
    pub _evidence: String,
}

fn extract_concept_names(trace: &Trace) -> Vec<String> {
    let mut names = Vec::new();
    for word in trace.raw_text.split_whitespace() {
        let cleaned = word.trim_matches(|c: char| !c.is_alphabetic());
        if cleaned.len() > 1 && cleaned.chars().next().map_or(false, |c| c.is_uppercase()) {
            names.push(cleaned.to_string());
        }
    }
    names
}
