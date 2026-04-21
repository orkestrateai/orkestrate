use reqwest::Client;
use serde_json::json;

/// Generate an embedding vector using nomic-embed-text via Ollama.
/// Returns a 768-dimensional f32 vector.
pub async fn embed(text: &str) -> Result<Vec<f32>, String> {
    let client = Client::new();
    let resp = client
        .post("http://localhost:11434/api/embeddings")
        .json(&json!({
            "model": "nomic-embed-text",
            "prompt": text
        }))
        .send()
        .await
        .map_err(|e| format!("ollama embed request failed: {}", e))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("ollama embed response parse failed: {}", e))?;

    let embedding = body["embedding"]
        .as_array()
        .ok_or("embedding field missing")?
        .iter()
        .map(|v| v.as_f64().unwrap_or(0.0) as f32)
        .collect::<Vec<f32>>();

    if embedding.len() != 768 {
        return Err(format!(
            "expected 768-dim embedding, got {}",
            embedding.len()
        ));
    }

    Ok(embedding)
}

/// Cosine similarity between two vectors.
#[allow(dead_code)]
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    dot / (norm_a * norm_b)
}

/// Serialize a vector to SQLite vec0 format (blob of f32s).
pub fn serialize_embedding(vec: &[f32]) -> Vec<u8> {
    vec.iter()
        .flat_map(|f| f.to_le_bytes())
        .collect()
}
