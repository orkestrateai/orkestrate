use crate::pscm::db::PscmDb;
use petgraph::stable_graph::{StableGraph, NodeIndex};
use petgraph::visit::EdgeRef;
use std::collections::HashMap;

pub struct ConceptGraph {
    pub graph: StableGraph<ConceptNode, CausalEdge>,
    pub name_to_index: HashMap<String, NodeIndex>,
}

#[derive(Debug, Clone)]
pub struct ConceptNode {
    pub id: String,
    pub canonical_name: String,
    pub node_type: String,
}

#[derive(Debug, Clone)]
pub struct CausalEdge {
    pub edge_type: String,
    pub weight: f64,
    pub _valid_from: String,
    pub valid_until: Option<String>,
    pub confidence: f64,
}

impl ConceptGraph {
    pub fn new(db: &PscmDb) -> Result<Self, String> {
        let mut graph = StableGraph::new();
        let mut name_to_index = HashMap::new();

        let concepts = db.load_concepts()?;
        for c in concepts {
            let node = ConceptNode {
                id: c.id.clone(),
                canonical_name: c.canonical_name.clone(),
                node_type: c.node_type.clone(),
            };
            let idx = graph.add_node(node);
            name_to_index.insert(c.canonical_name, idx);
            name_to_index.insert(c.id, idx);
        }

        let edges = db.load_edges()?;
        for e in edges {
            if let (Some(&from), Some(&to)) = (
                name_to_index.get(&e.from_id),
                name_to_index.get(&e.to_id),
            ) {
                let edge = CausalEdge {
                    edge_type: e.edge_type,
                    weight: e.weight,
                    _valid_from: e.valid_from,
                    valid_until: e.valid_until,
                    confidence: e.confidence,
                };
                graph.add_edge(from, to, edge);
            }
        }

        Ok(Self { graph, name_to_index })
    }

    #[allow(dead_code)]
    pub fn resolve_alias(&self, name: &str) -> Option<String> {
        let idx = self.name_to_index.get(name)?;
        self.graph[*idx].canonical_name.clone().into()
    }

    pub fn expand_query(&self, query: &str) -> String {
        let mut expanded = query.to_string();
        for (word, idx) in &self.name_to_index {
            if query.to_lowercase().contains(&word.to_lowercase()) {
                let node = &self.graph[*idx];
                // Replace slang with canonical
                if node.node_type == "sense" {
                    // Find what it aliases to
                    for edge in self.graph.edges(*idx) {
                        if edge.weight().edge_type == "SLANG_FOR" {
                            let target = &self.graph[edge.target()];
                            expanded = expanded.replace(
                                &word.to_lowercase(),
                                &target.canonical_name.to_lowercase(),
                            );
                        }
                    }
                }
            }
        }
        expanded
    }

    pub fn traverse_from_entity(
        &self,
        entity_name: &str,
        max_depth: usize,
    ) -> Vec<(String, f64)> {
        let mut results = Vec::new();
        let Some(start) = self.name_to_index.get(entity_name) else {
            return results;
        };

        let mut visited = HashMap::new();
        let mut queue = vec![(*start, 0usize, 1.0f64)];

        while let Some((node, depth, score)) = queue.pop() {
            if depth > max_depth {
                continue;
            }
            if visited.get(&node).map_or(false, |&d| d <= depth) {
                continue;
            }
            visited.insert(node, depth);

            let concept = &self.graph[node];
            if depth > 0 {
                results.push((concept.canonical_name.clone(), score));
            }

            for edge in self.graph.edges(node) {
                let target = edge.target();
                let weight = &edge.weight();
                // Skip expired edges
                if let Some(ref until) = weight.valid_until {
                    let now = chrono::Utc::now().to_rfc3339();
                    if until < &now {
                        continue;
                    }
                }
                let new_score = score * weight.weight * weight.confidence;
                queue.push((target, depth + 1, new_score));
            }
        }

        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        results
    }

    pub fn upsert_concept(&mut self, id: &str, name: &str, node_type: &str) -> Result<NodeIndex, String> {
        let node = ConceptNode {
            id: id.to_string(),
            canonical_name: name.to_string(),
            node_type: node_type.to_string(),
        };
        let idx = self.graph.add_node(node);
        self.name_to_index.insert(name.to_string(), idx);
        self.name_to_index.insert(id.to_string(), idx);
        Ok(idx)
    }

    pub fn upsert_edge(&mut self, from_id: &str, to_id: &str, edge_type: &str, weight: f64, valid_from: &str, valid_until: Option<&str>, confidence: f64) -> Result<(), String> {
        if let (Some(&from), Some(&to)) = (self.name_to_index.get(from_id), self.name_to_index.get(to_id)) {
            let edge = CausalEdge {
                edge_type: edge_type.to_string(),
                weight,
                _valid_from: valid_from.to_string(),
                valid_until: valid_until.map(|s| s.to_string()),
                confidence,
            };
            // Remove old edge if exists
            let existing = self.graph.find_edge(from, to);
            if let Some(e) = existing {
                if self.graph[e].edge_type == edge_type {
                    self.graph.remove_edge(e);
                }
            }
            self.graph.add_edge(from, to, edge);
        }
        Ok(())
    }

    #[allow(dead_code)]
    pub fn persist_edge(&self, db: &PscmDb, from_id: &str, to_id: &str, edge_type: &str, weight: f64, valid_from: &str, valid_until: Option<&str>, confidence: f64) -> Result<(), String> {
        db.upsert_edge(from_id, to_id, edge_type, weight, valid_from, valid_until, confidence)
    }
}
