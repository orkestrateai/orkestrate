use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

const API_BASE: &str = "https://opencode.ai/zen/v1/chat/completions";
const CACHE_TTL_SECS: u64 = 1800; // 30 minutes for queries
const CACHE_MAX_SIZE: usize = 500;

/// Per-channel weight recommendation from the QueryParser agent.
/// All weights sum to 1.0. Defaults are provided for backwards compatibility.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ChannelWeights {
    #[serde(default = "default_semantic")]
    pub semantic: f64,
    #[serde(default = "default_keyword")]
    pub keyword: f64,
    #[serde(default = "default_entity")]
    pub entity: f64,
    #[serde(default = "default_temporal")]
    pub temporal: f64,
}

fn default_semantic() -> f64 { 0.40 }
fn default_keyword() -> f64 { 0.20 }
fn default_entity() -> f64 { 0.30 }
fn default_temporal() -> f64 { 0.10 }

impl Default for ChannelWeights {
    fn default() -> Self {
        Self {
            semantic: default_semantic(),
            keyword: default_keyword(),
            entity: default_entity(),
            temporal: default_temporal(),
        }
    }
}

/// Structured representation of a memory search query.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct QuerySchema {
    pub entities: Vec<String>,
    pub keywords: Vec<String>,
    pub temporal: bool,
    pub contradiction_sensitive: bool,
    pub pronoun_resolutions: HashMap<String, String>,
    #[serde(default)]
    pub channel_weights: ChannelWeights,
    /// How many days until recency score drops to 50%.
    /// The agent sets this based on query temporal scope.
    /// Short for "yesterday" (2), medium for "recently" (14), long for "ever" (60).
    #[serde(default = "default_halflife")]
    pub recency_halflife_days: f64,
}

fn default_halflife() -> f64 { 14.0 }

/// In-memory LRU cache for query parsing results.
struct QueryCache {
    entries: HashMap<String, (Instant, QuerySchema)>,
}

impl QueryCache {
    fn new() -> Self {
        Self {
            entries: HashMap::with_capacity(CACHE_MAX_SIZE),
        }
    }

    fn get(&self, key: &str) -> Option<QuerySchema> {
        self.entries.get(key).and_then(|(t, v)| {
            if t.elapsed() < Duration::from_secs(CACHE_TTL_SECS) {
                Some(v.clone())
            } else {
                None
            }
        })
    }

    fn insert(&mut self, key: String, value: QuerySchema) {
        if self.entries.len() >= CACHE_MAX_SIZE {
            let mut items: Vec<(String, Instant)> = self
                .entries
                .iter()
                .map(|(k, (t, _))| (k.clone(), *t))
                .collect();
            items.sort_by(|a, b| a.1.cmp(&b.1));
            let to_remove = items.len() / 10;
            for (k, _) in items.into_iter().take(to_remove) {
                self.entries.remove(&k);
            }
        }
        self.entries.insert(key, (Instant::now(), value));
    }
}

static CACHE: std::sync::OnceLock<Mutex<QueryCache>> = std::sync::OnceLock::new();

fn get_cache() -> &'static Mutex<QueryCache> {
    CACHE.get_or_init(|| Mutex::new(QueryCache::new()))
}

fn cache_key(query: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    query.to_lowercase().hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Parse a natural-language memory query into a structured schema using an LLM agent.
///
/// Caches results for 30 minutes. Queries are case-insensitive for caching.
pub async fn parse_query(query: &str) -> QuerySchema {
    let key = cache_key(query);

    {
        let cache = get_cache().lock().await;
        if let Some(hit) = cache.get(&key) {
            return hit;
        }
    }

    let schema = parse_query_llm(query).await;

    if let Ok(ref s) = schema {
        let mut cache = get_cache().lock().await;
        cache.insert(key, s.clone());
    }

    schema.unwrap_or_else(|e| {
        eprintln!("[QueryParser] Agent failed: {}. Returning empty schema.", e);
        QuerySchema {
            entities: Vec::new(),
            keywords: Vec::new(),
            temporal: false,
            contradiction_sensitive: false,
            pronoun_resolutions: HashMap::new(),
            channel_weights: Default::default(),
            recency_halflife_days: default_halflife(),
        }
    })
}

async fn parse_query_llm(query: &str) -> Result<QuerySchema, String> {
    let api_key =
        std::env::var("OPENCODE_ZEN_API_KEY").map_err(|_| "OPENCODE_ZEN_API_KEY not set".to_string())?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| format!("Client build failed: {}", e))?;

    let safe_query = query.replace('"', "\\\"");

    let prompt = format!(
        r#"You are a query parsing system. Analyze the following user query and output ONLY valid JSON.

Query: "{safe_query}"

Extract:
1. Named entities (people, projects, companies, places, products, events) with exact names
2. Keywords for lexical search (important content words, excluding common stop words like "the", "and", "what", "how")
3. Pronoun antecedents (what 'him', 'her', 'it', 'they', 'that' refer to)
4. Temporal scope (is this asking about recent, past, or all-time events?)
5. Contradiction sensitivity (is the user asking if something changed?)
6. Channel weights — how much should each retrieval channel contribute?

Output format:
{{
  "entities": ["Karan", "Keiyara"],
  "keywords": ["project", "deadline", "status"],
  "pronoun_resolutions": {{"him": "Karan", "that": "the Google Next challenge"}},
  "temporal": false,
  "contradiction_sensitive": false,
  "channel_weights": {{
    "semantic": 0.40,
    "keyword": 0.20,
    "entity": 0.30,
    "temporal": 0.10
  }},
  "recency_halflife_days": 14
}}

Rules:
- Output ONLY the JSON object. No markdown fences, no extra text.
- keywords: Extract 3-8 content words that would help find relevant documents. Exclude pronouns, articles, prepositions, and generic verbs (is, have, do, can, will). Include nouns, verbs with semantic weight, and adjectives.
- channel_weights: Must sum to 1.0. Adjust based on query type:
  * Entity-heavy queries (mentions specific people/projects) → boost entity (up to 0.45)
  * Factual/recall queries ("what did I say about...") → boost semantic (up to 0.50)
  * Temporal queries ("what happened recently") → boost temporal (up to 0.30)
  * Vague/keyword-heavy queries → boost keyword (up to 0.35)
- recency_halflife_days: How many days back should "recent" mean?
  * "yesterday", "last night" → 2
  * "recently", "last week" → 7
  * "last month", "a while ago" → 30
  * "tell me everything", "all time" → 60
  * Default / vague → 14
- If no pronouns, use empty object {{}} for pronoun_resolutions.
- If no entities, use empty array [].
- temporal: true if query contains words like recent, last, ago, yesterday, before, earlier, previous, latest, old, first, initial, over time, evolve, change, journey.
- contradiction_sensitive: true if query contains words like still, now, currently, changed, before, used to, did you, do i still, did i, end up, stay."#
    );

    let request = json!({
        "model": "minimax-m2.5-free",
        "messages": [
            {"role": "system", "content": "You are a precise query parser. Output ONLY valid JSON."},
            {"role": "user", "content": prompt}
        ],
        "stream": false,
        "max_tokens": 1024
    });

    let response = client
        .post(API_BASE)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("API Error {}: {}", status, body));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))?;

    let raw_content = data["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("Missing response content")?;

    let cleaned = raw_content
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let parsed: serde_json::Value = serde_json::from_str(cleaned).map_err(|e| {
        format!("Failed to parse query JSON: {} | raw: {}", e, raw_content)
    })?;

    let mut entities: Vec<String> = parsed["entities"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let keywords: Vec<String> = parsed["keywords"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let pronoun_resolutions: HashMap<String, String> = parsed["pronoun_resolutions"]
        .as_object()
        .map(|obj| {
            obj.iter()
                .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                .collect()
        })
        .unwrap_or_default();

    // Merge pronoun resolutions into entities for graph search
    for resolved_entity in pronoun_resolutions.values() {
        if !entities.contains(resolved_entity) {
            entities.push(resolved_entity.clone());
        }
    }

    let temporal = parsed["temporal"].as_bool().unwrap_or(false);
    let contradiction_sensitive = parsed["contradiction_sensitive"].as_bool().unwrap_or(false);

    let channel_weights: ChannelWeights = parsed["channel_weights"]
        .as_object()
        .and_then(|obj| {
            let semantic = obj.get("semantic")?.as_f64()?;
            let keyword = obj.get("keyword")?.as_f64()?;
            let entity = obj.get("entity")?.as_f64()?;
            let temporal = obj.get("temporal")?.as_f64()?;
            let sum = semantic + keyword + entity + temporal;
            if (sum - 1.0).abs() < 0.15 {
                // Normalize to exactly 1.0 if close
                Some(ChannelWeights {
                    semantic: semantic / sum,
                    keyword: keyword / sum,
                    entity: entity / sum,
                    temporal: temporal / sum,
                })
            } else {
                None
            }
        })
        .unwrap_or_default();

    let recency_halflife_days = parsed["recency_halflife_days"]
        .as_f64()
        .map(|v| v.clamp(1.0, 365.0))
        .unwrap_or_else(default_halflife);

    Ok(QuerySchema {
        entities,
        keywords,
        temporal,
        contradiction_sensitive,
        pronoun_resolutions,
        channel_weights,
        recency_halflife_days,
    })
}
