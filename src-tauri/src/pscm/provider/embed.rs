use serde_json::json;
use crate::timer::Timer;

// ─── OpenRouter Configuration ────────────────────────────────────────────
const OPENROUTER_BASE: &str = "https://openrouter.ai/api/v1/embeddings";
const OPENROUTER_MODEL: &str = "nvidia/llama-nemotron-embed-vl-1b-v2:free";
pub const OPENROUTER_DIMS: usize = 2048;

// ─── Ollama Fallback Configuration ───────────────────────────────────────
const OLLAMA_BASE: &str = "http://localhost:11434/api/embeddings";
const OLLAMA_MODEL: &str = "nomic-embed-text:latest";
pub const OLLAMA_DIMS: usize = 768;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EmbedProvider {
    OpenRouter,
    Ollama,
}

/// Generate an embedding vector.
///
/// Strategy:
/// 1. Try OpenRouter (remote, 2048-dim).
/// 2. If OpenRouter fails, fall back to Ollama (local, 768-dim).
pub async fn embed(text: &str) -> Result<(Vec<f32>, EmbedProvider), String> {
    let _timer = Timer::new("pscm::embed");

    // Attempt 1: OpenRouter
    match embed_openrouter(text).await {
        Ok(vec) => {
            if vec.len() == OPENROUTER_DIMS {
                println!("[PSCM Embed] OpenRouter {}-dim for {} chars", vec.len(), text.len());
                return Ok((vec, EmbedProvider::OpenRouter));
            }
            eprintln!(
                "[PSCM Embed] OpenRouter returned wrong dims ({}), trying fallback",
                vec.len()
            );
        }
        Err(e) => {
            eprintln!("[PSCM Embed] OpenRouter failed: {}", e);
        }
    }

    // Attempt 2: Ollama fallback
    match embed_ollama(text).await {
        Ok(vec) => {
            if vec.len() == OLLAMA_DIMS {
                println!("[PSCM Embed] Ollama {}-dim for {} chars", vec.len(), text.len());
                return Ok((vec, EmbedProvider::Ollama));
            }
            Err(format!(
                "Ollama returned wrong dims: expected {}, got {}",
                OLLAMA_DIMS,
                vec.len()
            ))
        }
        Err(e) => Err(format!("Both OpenRouter and Ollama failed. Last error: {}", e)),
    }
}

/// Convenience: embed and ignore provider info.
pub async fn embed_vec(text: &str) -> Result<Vec<f32>, String> {
    embed(text).await.map(|(v, _)| v)
}

// ─── OpenRouter Implementation ───────────────────────────────────────────

async fn embed_openrouter(text: &str) -> Result<Vec<f32>, String> {
    let api_key = std::env::var("OPENROUTER_KEY")
        .map_err(|_| "OPENROUTER_KEY not set".to_string())?;

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
