use serde::{Deserialize, Serialize};

const OPENROUTER_EMBED_URL: &str = "https://openrouter.ai/api/v1/embeddings";
const EMBED_MODEL: &str = "nvidia/llama-nemotron-embed-vl-1b-v2:free";
const EMBED_DIMENSION: usize = 768; // Llama-Nemotron-embed-vl-1b produces 768-dim vectors

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingRecord {
    pub vector: Vec<f32>,
    pub model: String,
    pub timestamp: String,
}

/// Call OpenRouter embeddings API.
pub async fn embed_text(text: &str) -> Result<Vec<f32>, String> {
    let api_key = std::env::var("OPENROUTER_API_KEY")
        .map_err(|_| "OPENROUTER_API_KEY environment variable not set. Add it to your .env file.".to_string())?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let response = client
        .post(OPENROUTER_EMBED_URL)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://orkestrate.app")
        .header("X-Title", "Orkestrate")
        .json(&serde_json::json!({
            "model": EMBED_MODEL,
            "input": text,
        }))
        .send()
        .await
        .map_err(|e| format!("OpenRouter embed request failed: {e}"))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read embed response: {e}"))?;

    if !status.is_success() {
        return Err(format!("OpenRouter embed HTTP {}: {}", status, body));
    }

    #[derive(Deserialize)]
    struct EmbedData {
        embedding: Vec<f32>,
    }

    #[derive(Deserialize)]
    struct EmbedResponse {
        data: Vec<EmbedData>,
    }

    let parsed: EmbedResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse embed response: {e}"))?;

    parsed
        .data
        .into_iter()
        .next()
        .map(|d| d.embedding)
        .ok_or_else(|| "No embedding data in response".to_string())
}

/// Cosine similarity between two vectors.
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f64 {
    if a.len() != b.len() {
        return 0.0;
    }
    let dot: f64 = a.iter().zip(b.iter()).map(|(x, y)| (*x as f64) * (*y as f64)).sum();
    let norm_a: f64 = a.iter().map(|x| (*x as f64).powi(2)).sum::<f64>().sqrt();
    let norm_b: f64 = b.iter().map(|x| (*x as f64).powi(2)).sum::<f64>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    dot / (norm_a * norm_b)
}

/// Build a text representation of a memory entry for embedding.
pub fn memory_to_embed_text(domain: &str, topic: &str, title: &str, content: &str, entities: &[String]) -> String {
    let mut text = format!("Domain: {}. Topic: {}. Title: {}. Content: {}", domain, topic, title, content);
    if !entities.is_empty() {
        text.push_str(&format!(" Entities: {}.", entities.join(", ")));
    }
    text
}
