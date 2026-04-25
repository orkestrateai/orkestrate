use serde_json::json;

use crate::timer::Timer;

// ─── Ollama Configuration ────────────────────────────────────────────────
const OLLAMA_BASE: &str = "http://localhost:11434/api/embeddings";
const OLLAMA_MODEL: &str = "nomic-embed-text:latest";
pub const OLLAMA_DIMS: usize = 768;

// ─── OpenRouter Fallback Configuration ───────────────────────────────────
const OPENROUTER_BASE: &str = "https://openrouter.ai/api/v1/embeddings";
const OPENROUTER_MODEL: &str = "nvidia/llama-nemotron-embed-vl-1b-v2:free";
pub const OPENROUTER_DIMS: usize = 2048;

/// Which provider was used for the last embedding.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EmbedProvider {
    Ollama,
    OpenRouter,
}

impl EmbedProvider {
    pub fn model_name(&self) -> &'static str {
        match self {
            EmbedProvider::Ollama => OLLAMA_MODEL,
            EmbedProvider::OpenRouter => OPENROUTER_MODEL,
        }
    }
}

/// Get the embedding API key for OpenRouter fallback.
pub fn get_openrouter_key() -> Result<String, String> {
    std::env::var("OPENROUTER_KEY").map_err(|_| "OPENROUTER_KEY not set".to_string())
}

/// Generate an embedding vector.
///
/// Strategy:
/// 1. Try Ollama (local, fast, 768-dim).
/// 2. If Ollama fails, fall back to OpenRouter (remote, 2048-dim).
///
/// Returns the vector and the provider used so callers can record it.
pub async fn embed(text: &str) -> Result<(Vec<f32>, EmbedProvider), String> {
    let _timer = Timer::new("embed::embed");

    // Attempt 1: Ollama
    match embed_ollama(text).await {
        Ok(vec) => {
            if vec.len() == OLLAMA_DIMS {
                println!("[Embed] Ollama {}-dim for {} chars", vec.len(), text.len());
                return Ok((vec, EmbedProvider::Ollama));
            }
            eprintln!(
                "[Embed] Ollama returned wrong dims ({}), trying fallback",
                vec.len()
            );
        }
        Err(e) => {
            eprintln!("[Embed] Ollama failed: {}", e);
        }
    }

    // Attempt 2: OpenRouter fallback
    match embed_openrouter(text).await {
        Ok(vec) => {
            if vec.len() == OPENROUTER_DIMS {
                println!("[Embed] OpenRouter {}-dim for {} chars", vec.len(), text.len());
                return Ok((vec, EmbedProvider::OpenRouter));
            }
            Err(format!(
                "OpenRouter returned wrong dims: expected {}, got {}",
                OPENROUTER_DIMS,
                vec.len()
            ))
        }
        Err(e) => Err(format!("Both Ollama and OpenRouter failed. Last error: {}", e)),
    }
}

/// Batch embed multiple texts concurrently.
/// Uses the same provider for all texts in the batch.
pub async fn embed_batch(texts: &[String]) -> Result<Vec<(Vec<f32>, EmbedProvider)>, String> {
    use std::sync::Arc;
    use tokio::sync::Semaphore;

    let semaphore = Arc::new(Semaphore::new(5));

    let mut handles = Vec::with_capacity(texts.len());
    for text in texts {
        let text = text.clone();
        let permit = semaphore.clone();
        let handle = tokio::spawn(async move {
            let _permit = permit
                .acquire()
                .await
                .map_err(|e| format!("Semaphore error: {}", e))?;
            embed(&text).await
        });
        handles.push(handle);
    }

    let mut results = Vec::with_capacity(texts.len());
    for handle in handles {
        match handle.await {
            Ok(Ok(result)) => results.push(result),
            Ok(Err(e)) => {
                eprintln!("[Embed] Failed to embed text: {}", e);
                results.push((vec![0.0f32; OLLAMA_DIMS], EmbedProvider::Ollama));
            }
            Err(e) => {
                eprintln!("[Embed] Task join error: {}", e);
                results.push((vec![0.0f32; OLLAMA_DIMS], EmbedProvider::Ollama));
            }
        }
    }

    Ok(results)
}

// ─── Ollama Implementation ───────────────────────────────────────────────

async fn embed_ollama(text: &str) -> Result<Vec<f32>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Ollama client build failed: {}", e))?;

    let request = json!({
        "model": OLLAMA_MODEL,
        "prompt": text
    });

    let response = client
        .post(OLLAMA_BASE)
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Ollama API Error {}: {}", status, body));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Ollama JSON parse error: {}", e))?;

    let embedding = data["embedding"]
        .as_array()
        .ok_or("Missing embedding array in Ollama response")?;

    let vec: Vec<f32> = embedding
        .iter()
        .filter_map(|v| v.as_f64().map(|f| f as f32))
        .collect();

    Ok(vec)
}

// ─── OpenRouter Implementation ───────────────────────────────────────────

async fn embed_openrouter(text: &str) -> Result<Vec<f32>, String> {
    let api_key = get_openrouter_key()?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("OpenRouter client build failed: {}", e))?;

    let request = json!({
        "model": OPENROUTER_MODEL,
        "input": text
    });

    let response = client
        .post(OPENROUTER_BASE)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("OpenRouter request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("OpenRouter API Error {}: {}", status, body));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("OpenRouter JSON parse error: {}", e))?;

    let embedding = data["data"][0]["embedding"]
        .as_array()
        .ok_or("Missing embedding array in OpenRouter response")?;

    let vec: Vec<f32> = embedding
        .iter()
        .filter_map(|v| v.as_f64().map(|f| f as f32))
        .collect();

    Ok(vec)
}
