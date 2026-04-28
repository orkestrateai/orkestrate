use serde::{Serialize, Deserialize};
use super::constants::DecayCategory;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MaturityTier {
    Draft,
    Validated,
    Core,
}

impl Default for MaturityTier {
    fn default() -> Self {
        Self::Draft
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeSignals {
    // ByteRover legacy fields
    pub importance: f64,
    pub recency: f64,
    pub maturity: MaturityTier,
    pub access_count: u64,
    pub update_count: u64,
    pub last_accessed_at: i64,
    pub last_updated_at: i64,

    // Personal memory fields
    pub confidence: f64,
    pub confirmation_count: u64,
    pub decay_category: DecayCategory,
    pub provenance: String,
    pub category: String,
}

impl Default for RuntimeSignals {
    fn default() -> Self {
        Self {
            importance: 50.0,
            recency: 1.0,
            maturity: MaturityTier::Draft,
            access_count: 0,
            update_count: 0,
            last_accessed_at: chrono::Utc::now().timestamp_millis(),
            last_updated_at: chrono::Utc::now().timestamp_millis(),
            confidence: 0.5,
            confirmation_count: 0,
            decay_category: DecayCategory::Normal,
            provenance: "direct".to_string(),
            category: "fact".to_string(),
        }
    }
}
