use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum MemoType {
    #[default]
    #[serde(rename = "fact")]
    Fact,
    #[serde(rename = "preference")]
    Preference,
    #[serde(rename = "episode")]
    Episode,
    #[serde(rename = "task")]
    Task,
    #[serde(rename = "relationship")]
    Relationship,
    #[serde(rename = "context")]
    Context,
    #[serde(rename = "insight")]
    Insight,
}

impl MemoType {
    pub fn base_importance(&self) -> f64 {
        match self {
            Self::Relationship | Self::Fact => 60.0,
            Self::Preference => 50.0,
            Self::Task | Self::Context => 35.0,
            Self::Episode => 20.0,
            Self::Insight => 40.0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MemoSource {
    #[serde(rename = "explicit")]
    Explicit,
    #[serde(rename = "inferred")]
    Inferred,
    #[serde(rename = "derived")]
    Derived,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Default)]
pub enum MaturityTier {
    #[default]
    #[serde(rename = "draft")]
    Draft,
    #[serde(rename = "validated")]
    Validated,
    #[serde(rename = "core")]
    Core,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonalEntry {
    pub id: String,
    pub title: String,
    pub content: String,
    pub summary: String,

    #[serde(rename = "type")]
    pub memo_type: MemoType,

    pub source: MemoSource,
    pub confidence: f64,
    pub session_id: String,

    #[serde(default)]
    pub people: Vec<String>,
    #[serde(default)]
    pub places: Vec<String>,
    #[serde(default)]
    pub topics: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,

    // AKL
    #[serde(default = "default_importance")]
    pub importance: f64,
    #[serde(default)]
    pub maturity: MaturityTier,
    #[serde(default)]
    pub access_count: u64,
    #[serde(default)]
    pub last_accessed: i64,

    pub created_at: String,
    pub updated_at: String,
    pub expires_at: Option<String>,
}

fn default_importance() -> f64 { 50.0 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub content: String,
    pub score: f64,
    pub memo_type: MemoType,
    pub confidence: f64,
    pub people: Vec<String>,
    pub topics: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub name: String,
    #[serde(default)]
    pub pronouns: String,
    #[serde(default)]
    pub identity: Vec<String>,
    #[serde(default)]
    pub relationships: Vec<String>,
    #[serde(default)]
    pub preferences: Vec<String>,
    #[serde(default)]
    pub professional: Vec<String>,
    #[serde(default)]
    pub context: Vec<String>,
    #[serde(default)]
    pub interests: Vec<String>,
    pub updated_at: String,
}

impl Default for UserProfile {
    fn default() -> Self {
        Self {
            name: String::new(),
            pronouns: String::new(),
            identity: Vec::new(),
            relationships: Vec::new(),
            preferences: Vec::new(),
            professional: Vec::new(),
            context: Vec::new(),
            interests: Vec::new(),
            updated_at: Self::now_iso(),
        }
    }
}

impl UserProfile {
    pub fn now_iso() -> String {
        chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
    }

    pub fn to_prompt_block(&self) -> String {
        let mut p = String::from("\n[USER PROFILE]\n");
        if !self.name.is_empty() {
            p.push_str(&format!("Name: {}\n", self.name));
        }
        if !self.pronouns.is_empty() {
            p.push_str(&format!("Pronouns: {}\n", self.pronouns));
        }
        for (label, items) in &[
            ("Identity", &self.identity),
            ("Relationships", &self.relationships),
            ("Preferences", &self.preferences),
            ("Professional", &self.professional),
            ("Active Context", &self.context),
            ("Interests", &self.interests),
        ] {
            if !items.is_empty() {
                p.push_str(&format!("{}:\n", label));
                for item in *items {
                    p.push_str(&format!("  - {}\n", item));
                }
            }
        }
        p.push_str("[/USER PROFILE]\n");
        p
    }
}
