/// Serialize a Vec<f32> embedding into a compact byte blob for SQLite storage.
pub fn serialize(embedding: &[f32]) -> Vec<u8> {
    embedding
        .iter()
        .flat_map(|f| f.to_le_bytes())
        .collect()
}

/// Deserialize a byte blob back into Vec<f32>.
pub fn deserialize(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|chunk| {
            let arr: [u8; 4] = chunk.try_into().unwrap_or([0; 4]);
            f32::from_le_bytes(arr)
        })
        .collect()
}

/// Cosine similarity between two vectors.
/// Returns value in [-1, 1]. Higher = more similar.
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return -1.0;
    }

    let mut dot = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    for i in 0..a.len() {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }

    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom == 0.0 {
        return 0.0;
    }

    dot / denom
}

/// Find top-k most similar embeddings from a list.
/// Returns Vec<(index, similarity_score)> sorted by score descending.
pub fn top_k_similarities(query: &[f32], candidates: &[Vec<f32>], k: usize) -> Vec<(usize, f32)> {
    let mut scored: Vec<(usize, f32)> = candidates
        .iter()
        .enumerate()
        .map(|(idx, cand)| (idx, cosine_similarity(query, cand)))
        .collect();

    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(k);
    scored
}

/// Apply recency decay to an importance score.
/// Formula: importance * exp(-days / 14.0) where 14 days is the half-life.
/// This is applied lazily during search, not persisted to the database.
pub fn decay_importance(importance: f64, created_at_iso: &str) -> f64 {
    let Ok(dt) = chrono::DateTime::parse_from_rfc3339(created_at_iso) else {
        return importance;
    };
    let now = chrono::Utc::now();
    let days = now.signed_duration_since(dt.with_timezone(&chrono::Utc)).num_days() as f64;
    if days <= 0.0 {
        return importance;
    }
    importance * (-days / 14.0).exp()
}

/// Merge semantic and lexical search results with weighted scoring.
///
/// - semantic_results: Vec<(episode_id, semantic_score)>
///   where semantic_score is in [0, 1] (already normalized from cosine similarity)
/// - lexical_results: Vec<(episode_id, lexical_score)>
///   where lexical_score is in [0, 1]
/// - semantic_weight: weight for semantic (e.g., 0.7)
/// - lexical_weight: weight for lexical (e.g., 0.3)
///
/// Returns top results sorted by combined score.
pub fn hybrid_merge(
    semantic_results: &[(String, f32)],
    lexical_results: &[(String, f32)],
    semantic_weight: f32,
    lexical_weight: f32,
    top_n: usize,
) -> Vec<(String, f32)> {
    use std::collections::HashMap;

    let mut scores: HashMap<String, f32> = HashMap::new();

    for (id, score) in semantic_results {
        *scores.entry(id.clone()).or_insert(0.0) += score * semantic_weight;
    }

    for (id, score) in lexical_results {
        *scores.entry(id.clone()).or_insert(0.0) += score * lexical_weight;
    }

    let mut merged: Vec<(String, f32)> = scores.into_iter().collect();
    merged.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    merged.truncate(top_n);
    merged
}
