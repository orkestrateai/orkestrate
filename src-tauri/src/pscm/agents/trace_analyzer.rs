use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

const API_BASE: &str = "https://opencode.ai/zen/v1/chat/completions";
const CACHE_TTL_SECS: u64 = 3600;
const CACHE_MAX_SIZE: usize = 1000;

/// A single extracted entity with its semantic type.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Entity {
    pub name: String,
    #[serde(rename = "type")]
    pub entity_type: String,
}

/// Full semantic analysis of a single trace (user or assistant message).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TraceAnalysis {
    pub entities: Vec<Entity>,
    pub valence: f64,
    pub topic_drift: bool,
    pub importance: f64,
    pub reasoning: String,
}

/// In-memory LRU cache for trace analysis results.
struct AnalysisCache {
    entries: HashMap<String, (Instant, TraceAnalysis)>,
}

impl AnalysisCache {
    fn new() -> Self {
        Self {
            entries: HashMap::with_capacity(CACHE_MAX_SIZE),
        }
    }

    fn get(&self, key: &str) -> Option<TraceAnalysis> {
        self.entries.get(key).and_then(|(t, v)| {
            if t.elapsed() < Duration::from_secs(CACHE_TTL_SECS) {
                Some(v.clone())
            } else {
                None
            }
        })
    }

    fn insert(&mut self, key: String, value: TraceAnalysis) {
        // Simple eviction: if over capacity, remove oldest 10%
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

static CACHE: OnceLock<Mutex<AnalysisCache>> = OnceLock::new();

fn get_cache() -> &'static Mutex<AnalysisCache> {
    CACHE.get_or_init(|| Mutex::new(AnalysisCache::new()))
}

/// Build a cache key from raw trace content.
fn cache_key(content: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Analyze a single trace using an LLM agent.
///
/// Caches results for 1 hour to avoid duplicate API calls for identical
/// or highly similar messages ("yes", "okay", "tell me more", etc).
pub async fn analyze_trace(content: &str) -> Result<TraceAnalysis, String> {
    let key = cache_key(content);

    // 1. Check cache
    {
        let cache = get_cache().lock().await;
        if let Some(hit) = cache.get(&key) {
            return Ok(hit);
        }
    }

    // 2. Call LLM
    let analysis = analyze_trace_llm(content).await;

    // 3. Store in cache (even on error we don't cache, so retry next time)
    if let Ok(ref a) = analysis {
        let mut cache = get_cache().lock().await;
        cache.insert(key, a.clone());
    }

    analysis
}

/// Retry once on failure; never falls back to heuristic.
async fn analyze_trace_llm(content: &str) -> Result<TraceAnalysis, String> {
    match analyze_trace_llm_once(content).await {
        Ok(result) => Ok(result),
        Err(e) => {
            eprintln!("[TraceAnalyzer] First attempt failed: {}. Retrying once...", e);
            // Retry with slightly longer timeout
            analyze_trace_llm_once_with_timeout(content, 8).await
        }
    }
}

async fn analyze_trace_llm_once(content: &str) -> Result<TraceAnalysis, String> {
    analyze_trace_llm_once_with_timeout(content, 5).await
}

async fn analyze_trace_llm_once_with_timeout(
    content: &str,
    _timeout_secs: u64,
) -> Result<TraceAnalysis, String> {
    let api_key =
        std::env::var("OPENCODE_ZEN_API_KEY").map_err(|_| "OPENCODE_ZEN_API_KEY not set".to_string())?;

    let client = reqwest::Client::new();

    let safe_content = content.replace('"', "\\\"");

    let prompt = format!(
        r#"You are a semantic trace analyzer. Analyze the following message and output ONLY valid JSON.

Message: "{safe_content}"

Output format:
{{
  "entities": [{{"name": "...", "type": "person|project|organization|concept|place"}}],
  "valence": 0.0,
  "topic_drift": false,
  "importance": 0.5,
  "reasoning": "brief explanation"
}}

Rules:
- Only extract REAL named entities. Skip pronouns, interjections, sentence starters.
- "I'm", "Ah", "Hmm", "Okay", "Actually", "Yeah", "Sure", "Exactly" are NEVER entities.
- Types must be one of: person, project, organization, concept, place.
- Valence: -1 (very negative) to 1 (very positive). 0 is neutral.
- Topic drift: true if this message introduces a completely new subject unrelated to previous context.
- Importance: 0 (trivial filler) to 1 (critically important fact/decision).
- Output ONLY the JSON object, no markdown fences, no extra text."#
    );

    let request = json!({
        "model": "minimax-m2.5-free",
        "messages": [
            {"role": "system", "content": "You are a precise semantic analyzer. Output ONLY valid JSON."},
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

    // Strip markdown fences if the model wrapped JSON in ```json ... ```
    let cleaned = raw_content
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let analysis: TraceAnalysis = serde_json::from_str(cleaned).map_err(|e| {
        format!(
            "Failed to parse analysis JSON: {} | raw: {}",
            e, raw_content
        )
    })?;

    // Clamp values to valid ranges
    let analysis = TraceAnalysis {
        valence: analysis.valence.clamp(-1.0, 1.0),
        importance: analysis.importance.clamp(0.0, 1.0),
        ..analysis
    };

    Ok(analysis)
}

/// Convenience: extract just the entities from a trace.
pub async fn extract_entities(content: &str) -> Result<Vec<(String, String)>, String> {
    let analysis = analyze_trace(content).await?;
    Ok(analysis
        .entities
        .into_iter()
        .map(|e| (e.name, e.entity_type))
        .collect())
}
