use serde::{Serialize, Deserialize};

// ── Compound Scoring Weights (Equation 3) ──
pub const W_RELEVANCE: f64 = 0.6;
pub const W_IMPORTANCE: f64 = 0.2;
pub const W_RECENCY: f64 = 0.2;

// ── AKL Decay ──
pub const DECAY_RECENCY_FACTOR: f64 = 30.0;
pub const DECAY_IMPORTANCE_FACTOR: f64 = 0.995;

// ── AKL Importance Bonuses ──
pub const ACCESS_IMPORTANCE_BONUS: f64 = 3.0;
pub const UPDATE_IMPORTANCE_BONUS: f64 = 5.0;

// ── Maturity Hysteresis Thresholds ──
pub const PROMOTE_TO_VALIDATED: f64 = 65.0;
pub const PROMOTE_TO_CORE: f64 = 85.0;
pub const DEMOTE_FROM_CORE: f64 = 60.0;
pub const DEMOTE_FROM_VALIDATED: f64 = 35.0;

// ── Default Signal Values ──
pub const DEFAULT_IMPORTANCE: f64 = 50.0;
pub const DEFAULT_RECENCY: f64 = 1.0;

// ── Search / BM25 ──
pub const SEARCH_TITLE_BOOST: f64 = 5.0;
pub const SEARCH_PATH_BOOST: f64 = 1.5;
pub const SEARCH_CONTENT_BOOST: f64 = 1.0;
pub const SEARCH_MAX_RESULTS: usize = 32;
pub const SEARCH_MAX_CONTENT_LENGTH: usize = 8000;
pub const SEARCH_FUZZY_THRESHOLD: f64 = 0.2;
pub const SEARCH_OOD_THRESHOLD: f64 = 0.85;
pub const SEARCH_HIGH_CONFIDENCE: f64 = 0.93;
pub const SEARCH_MINIMUM_SCORE: f64 = 0.85;
pub const SEARCH_GAP_THRESHOLD: f64 = 0.08;

// ── Cache ──
pub const CACHE_FUZZY_THRESHOLD: f64 = 0.6;

// ── Tier Boosts ──
pub const TIER_BOOST_CORE: f64 = 1.15;
pub const TIER_BOOST_VALIDATED: f64 = 1.0;
pub const TIER_BOOST_DRAFT: f64 = 0.85;

// ── Tier 3 (Optimised LLM) ──
pub const TIER_3_MAX_TOKENS: usize = 1024;
pub const TIER_3_TEMPERATURE: f64 = 0.3;

// ── Tier 4 (Full Agentic) ──
pub const TIER_4_MAX_TOKENS: usize = 2048;
pub const TIER_4_TEMPERATURE: f64 = 0.5;
pub const TIER_4_MAX_ITERATIONS: usize = 50;

// ── Curation Limits ──
pub const MAX_FILES_PER_OPERATION: usize = 5;
pub const MAX_CHARS_PER_FILE: usize = 40_000;

// ── Directory / File Structure ──
pub const BRV_DIR: &str = ".brv";
pub const CONTEXT_TREE_DIR: &str = "context-tree";
pub const CONTEXT_TREE_ROOT: &str = ".brv/context-tree";
pub const SIDECAR_FILENAME: &str = ".signals.json";
pub const CONTEXT_FILE: &str = "context.md";
pub const SUMMARY_INDEX_FILE: &str = "_index.md";
pub const ARCHIVE_DIR: &str = "_archived";
pub const ARCHIVE_IMPORTANCE_THRESHOLD: f64 = 35.0;

// ── Personal Memory: Per-Category Decay ──

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DecayCategory {
    Permanent,
    Slow,
    Normal,
    Fast,
    Ephemeral,
}

impl DecayCategory {
    pub fn decay_factor(&self) -> f64 {
        match self {
            Self::Permanent => 0.9999,
            Self::Slow => 0.999,
            Self::Normal => 0.995,
            Self::Fast => 0.95,
            Self::Ephemeral => 0.8,
        }
    }

    #[allow(dead_code)]
    pub fn half_life_days(&self) -> f64 {
        match self {
            Self::Permanent => 6931.0,
            Self::Slow => 693.0,
            Self::Normal => 138.0,
            Self::Fast => 13.5,
            Self::Ephemeral => 3.1,
        }
    }
}

impl Default for DecayCategory {
    fn default() -> Self {
        Self::Normal
    }
}

/// Maps a domain/category string to its category weight (0.0 - 1.0)
/// Used for category-weighted scoring.
pub fn category_to_weight(category: &str) -> f64 {
    match category {
        "identity" => 0.9,
        "relationships" => 0.7,
        "preferences" => 0.6,
        "projects" => 0.5,
        "goals" => 0.5,
        "knowledge" => 0.4,
        "life_events" => 0.4,
        "observations" => 0.3,
        "emotional" => 0.3,
        "emotional_state" => 0.3,
        "conversations" => 0.2,
        _ => 0.5,
    }
}

/// Maps a domain/category string to its DecayCategory.
pub fn category_to_decay(category: &str) -> DecayCategory {
    match category {
        "identity" => DecayCategory::Permanent,
        "relationships" => DecayCategory::Slow,
        "preferences" => DecayCategory::Normal,
        "knowledge" => DecayCategory::Normal,
        "projects" => DecayCategory::Fast,
        "observations" => DecayCategory::Fast,
        "emotional" => DecayCategory::Ephemeral,
        "emotional_state" => DecayCategory::Ephemeral,
        "conversations" => DecayCategory::Fast,
        _ => DecayCategory::Normal,
    }
}
