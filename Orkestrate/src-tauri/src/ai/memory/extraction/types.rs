use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedFact {
    pub domain: String,
    pub topic: String,
    pub title: String,
    pub summary: String,
    pub content: String,
    pub tags: Vec<String>,
    pub keywords: Vec<String>,
    pub entities: Vec<String>,
    pub confidence: f64,
    pub provenance: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwmAnalysis {
    pub entities: Vec<String>,
    pub topic: String,
    pub pronoun_bindings: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzerPlan {
    pub should_extract: bool,
    pub domains: Vec<String>,
    pub reasoning: String,
    pub swm: SwmAnalysis,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationDecision {
    pub fact: ExtractedFact,
    pub action: DecisionAction,
    pub reason: Option<String>,
    pub existing_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DecisionAction {
    Store,
    Reject,
    UpdateConfidence,
    Contradiction,
}
