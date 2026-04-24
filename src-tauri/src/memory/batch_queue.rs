use std::collections::{HashMap, VecDeque};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    LazyLock, Mutex,
};
use std::time::{Duration, Instant};

use crate::db;
use crate::timer::Timer;
use crate::HistoryMessage;

const BATCH_SIZE: usize = 8;
const TIMEOUT_SECS: u64 = 100;
const SCAN_INTERVAL_SECS: u64 = 10;
const MAX_BUFFERS: usize = 50;
const MAX_CONCURRENT_FLUSHES: usize = 2;

struct SessionBuffer {
    messages: Vec<HistoryMessage>,
    last_activity: Instant,
}

static BUFFERS: LazyLock<Mutex<HashMap<String, SessionBuffer>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

static CONCURRENT_FLUSHES: AtomicUsize = AtomicUsize::new(0);
static FLUSH_QUEUE: LazyLock<Mutex<VecDeque<(String, String)>>> =
    LazyLock::new(|| Mutex::new(VecDeque::new()));

/// Add a new exchange to the session buffer. Triggers flush if batch is full.
pub fn enqueue(session_id: String, exchange: Vec<HistoryMessage>, api_key: String) {
    let mut buffers = BUFFERS.lock().unwrap();

    // LRU eviction if cap reached and this is a new session
    if !buffers.contains_key(&session_id) && buffers.len() >= MAX_BUFFERS {
        let oldest = buffers
            .iter()
            .min_by_key(|(_, b)| b.last_activity)
            .map(|(id, _)| id.clone());
        if let Some(oldest_id) = oldest {
            buffers.remove(&oldest_id);
            println!(
                "[BatchQueue] Evicted oldest buffer for session={}",
                oldest_id
            );
        }
    }

    let buffer = buffers.entry(session_id.clone()).or_insert(SessionBuffer {
        messages: Vec::new(),
        last_activity: Instant::now(),
    });

    buffer.messages.extend(exchange);
    buffer.last_activity = Instant::now();

    let should_flush = buffer.messages.len() >= BATCH_SIZE;
    drop(buffers);

    if should_flush {
        try_flush(session_id, api_key);
    }
}

/// Try to flush with backpressure. If max concurrent flushes reached, queue instead.
fn try_flush(session_id: String, api_key: String) {
    let current = CONCURRENT_FLUSHES.load(Ordering::Relaxed);
    if current >= MAX_CONCURRENT_FLUSHES {
        let mut queue = FLUSH_QUEUE.lock().unwrap();
        queue.push_back((session_id, api_key));
        println!(
            "[BatchQueue] Flush queued ({} active, {} queued)",
            current,
            queue.len()
        );
        return;
    }

    CONCURRENT_FLUSHES.fetch_add(1, Ordering::Relaxed);
    tokio::spawn(async move {
        flush(session_id, api_key).await;
        CONCURRENT_FLUSHES.fetch_sub(1, Ordering::Relaxed);
        // Process queued flushes if any
        process_flush_queue().await;
    });
}

/// Process any queued flushes one at a time.
async fn process_flush_queue() {
    loop {
        let next = {
            let mut queue = FLUSH_QUEUE.lock().unwrap();
            queue.pop_front()
        };
        if let Some((session_id, api_key)) = next {
            let current = CONCURRENT_FLUSHES.load(Ordering::Relaxed);
            if current >= MAX_CONCURRENT_FLUSHES {
                // Re-queue if still at capacity
                let mut queue = FLUSH_QUEUE.lock().unwrap();
                queue.push_front((session_id, api_key));
                break;
            }
            CONCURRENT_FLUSHES.fetch_add(1, Ordering::Relaxed);
            flush(session_id, api_key).await;
            CONCURRENT_FLUSHES.fetch_sub(1, Ordering::Relaxed);
        } else {
            break;
        }
    }
}

/// Drain buffer and run extraction + mapping once on combined batch.
async fn flush(session_id: String, api_key: String) {
    let batch = {
        let mut buffers = BUFFERS.lock().unwrap();
        buffers
            .remove(&session_id)
            .map(|b| b.messages)
            .unwrap_or_default()
    };

    if batch.is_empty() {
        return;
    }

    let _timer = Timer::new("batch_queue::flush");
    println!(
        "[BatchQueue] Flushing {} messages for session={}",
        batch.len(),
        session_id
    );

    // ── Expert 1: Triage-Extractor ──────────────────────────────────────
    let extraction = match crate::memory::triage_extractor::extract(&api_key, &batch).await {
        Ok(result) => {
            println!(
                "[BatchQueue] Extractor found {} candidates, {} inferences",
                result.candidates.len(),
                result.raw_inferences.len()
            );
            result
        }
        Err(e) => {
            eprintln!("[BatchQueue] Extractor failed: {}", e);
            return;
        }
    };

    // Store raw inferences as low-confidence episodes
    for inference in &extraction.raw_inferences {
        if let Ok(id) = db::store_episode(
            &inference.content,
            "inference",
            inference.confidence,
            0.3,
            "ephemeral",
            None,
            Some(&session_id),
        ) {
            // Extract simple entities from inference content
            let words: Vec<&str> = inference.content.split_whitespace().collect();
            for word in words {
                let cleaned: String = word.trim_matches(|c: char| !c.is_alphanumeric()).to_string();
                if cleaned.len() > 2
                    && cleaned.chars().next().map(|c| c.is_uppercase()).unwrap_or(false)
                    && !cleaned.starts_with("I")
                    && !cleaned.starts_with("A")
                    && !cleaned.starts_with("The")
                {
                    if let Ok(entity_id) = db::store_entity(&cleaned, "entity", Some(&cleaned.to_lowercase())) {
                        let _ = db::link_episode_entity(&id, &entity_id, "mentioned", false);
                    }
                }
            }
        }
    }

    if extraction.candidates.is_empty() {
        println!("[BatchQueue] No high-confidence candidates — stopping at extractor");
        return;
    }

    // ── Pre-Mapper Semantic Search & Deduplication ──────────────────────
    // Stricter dedup: exact string pre-filter + 0.90 semantic threshold + 0.05 boost
    let candidate_texts: Vec<String> = extraction
        .candidates
        .iter()
        .map(|c| c.content.clone())
        .collect();
    let candidate_embeddings = match crate::embed::embed_batch(&candidate_texts).await {
        Ok(embs) => embs,
        Err(e) => {
            eprintln!("[BatchQueue] Embedding generation failed: {}", e);
            Vec::new()
        }
    };

    // Load existing episodes with embeddings for semantic comparison
    let existing_with_embeddings = db::load_episodes_with_embeddings(5000, None).unwrap_or_default();
    let existing_embeddings: Vec<Vec<f32>> = existing_with_embeddings
        .iter()
        .map(|(_, _, emb)| emb.clone())
        .collect();

    // Build exact-string lookup for fast pre-filter
    let existing_normalized: std::collections::HashSet<String> = existing_with_embeddings
        .iter()
        .map(|(_, content, _)| {
            content
                .to_lowercase()
                .replace(|c: char| !c.is_alphanumeric(), "")
                .trim()
                .to_string()
        })
        .collect();

    // For each candidate, find top-15 semantically similar existing episodes
    let mut filtered_candidates = Vec::new();
    let mut semantic_contexts: Vec<Vec<(String, String, f32)>> = Vec::new();

    for (idx, candidate) in extraction.candidates.iter().enumerate() {
        // Exact-string pre-filter
        let normalized = candidate
            .content
            .to_lowercase()
            .replace(|c: char| !c.is_alphanumeric(), "")
            .trim()
            .to_string();
        if existing_normalized.contains(&normalized) {
            println!(
                "[BatchQueue] Exact duplicate pre-filtered: '{}'",
                candidate.content
            );
            continue;
        }

        let (emb, _emb_provider) = match candidate_embeddings.get(idx) {
            Some((v, p)) => (v, p),
            None => {
                filtered_candidates.push(candidate.clone());
                semantic_contexts.push(vec![]);
                continue;
            }
        };

        // Check for duplicates via semantic similarity
        let top_similar = crate::vector::top_k_similarities(emb, &existing_embeddings, 15);
        let mut similar_episodes = Vec::new();
        let mut is_duplicate = false;

        for (sim_idx, sim_score) in top_similar {
            let (id, content, _) = &existing_with_embeddings[sim_idx];
            similar_episodes.push((id.clone(), content.clone(), sim_score));

            if sim_score > 0.90 {
                // Duplicate detected — skip storing, boost existing
                println!(
                    "[BatchQueue] Duplicate detected (sim={:.3}): '{}' ≈ '{}'",
                    sim_score, candidate.content, content
                );
                if let Err(e) = db::boost_episode_importance(id, 0.05) {
                    eprintln!("[BatchQueue] Failed to boost importance: {}", e);
                }
                is_duplicate = true;
                break;
            }
        }

        if !is_duplicate {
            filtered_candidates.push(candidate.clone());
            semantic_contexts.push(similar_episodes);
        }
    }

    if filtered_candidates.is_empty() {
        println!("[BatchQueue] All candidates were duplicates — nothing to map");
        return;
    }

    // ── Expert 2: Schema Mapper (with semantic context) ─────────────────
    println!(
        "[BatchQueue] Mapper running with {} candidates (after dedup)...",
        filtered_candidates.len()
    );
    let mapper_result =
        match crate::memory::schema_mapper::map(&api_key, &filtered_candidates, &semantic_contexts)
            .await
        {
            Ok(result) => {
                println!(
                    "[BatchQueue] Mapper returned {} episodes, {} contradictions, {} patches",
                    result.new_episodes.len(),
                    result.contradictions.len(),
                    result.schema_patches.len()
                );
                result
            }
            Err(e) => {
                eprintln!("[BatchQueue] Mapper failed: {}", e);
                return;
            }
        };

    // Store new episodes with their embeddings and entities
    let mut stored_episode_ids: Vec<String> = Vec::new();
    for (idx, episode) in mapper_result.new_episodes.iter().enumerate() {
        let (emb_vec, emb_provider) = match candidate_embeddings.get(idx) {
            Some((v, p)) => (Some(v.as_slice()), p.model_name()),
            None => (None, "unknown"),
        };
        match db::store_episode_with_embedding(
            &episode.content,
            &episode.type_,
            episode.confidence,
            episode.importance,
            &episode.compression_level,
            Some(&episode.schema_section),
            Some(&session_id),
            emb_vec,
            Some(emb_provider),
        ) {
            Ok(id) => {
                println!("[BatchQueue] Episode stored with id={}", id);
                stored_episode_ids.push(id.clone());

                // Store entities and link to episode
                for (ent_name, ent_type) in &episode.entities {
                    match db::store_entity(ent_name, ent_type, Some(&ent_name.to_lowercase())) {
                        Ok(entity_id) => {
                            if let Err(e) = db::link_episode_entity(&id, &entity_id, "mentioned", false) {
                                eprintln!("[BatchQueue] Failed to link entity {} to episode: {}", ent_name, e);
                            }
                        }
                        Err(e) => eprintln!("[BatchQueue] Failed to store entity {}: {}", ent_name, e),
                    }
                }
            }
            Err(e) => eprintln!("[BatchQueue] Failed to store episode: {}", e),
        }
    }

    // Create progression edges between consecutive episodes in this batch
    for i in 1..stored_episode_ids.len() {
        let prev = &stored_episode_ids[i - 1];
        let curr = &stored_episode_ids[i];
        if let Err(e) = db::store_episode_edge(prev, curr, "progression", 1.0, Some(&session_id)) {
            eprintln!("[BatchQueue] Failed to store progression edge: {}", e);
        }
    }

    // Store contradictions and create learn queue items for them
    for contradiction in &mapper_result.contradictions {
        match db::store_contradiction(
            &contradiction.existing_episode_id,
            &contradiction.existing_content,
            &contradiction.new_evidence,
            None,
            0.5,
        ) {
            Ok(id) => {
                println!("[BatchQueue] Contradiction stored with id={}", id);
                // Create learn item so agent can ask user to resolve it
                let question = format!(
                    "You used to say '{}', but lately you've been saying '{}'. What's the current situation?",
                    contradiction.existing_content,
                    contradiction.new_evidence
                );
                let _ = db::store_learn_item(
                    "contradiction",
                    &question,
                    Some(&contradiction.existing_content),
                    Some(&id),
                );
            }
            Err(e) => eprintln!("[BatchQueue] Failed to store contradiction: {}", e),
        }
    }

    // ── Expert 3: Compiler + Expert 4: Gap Auditor ──────────────────────
    // Background batches also trigger profile compilation so user.md
    // stays up-to-date even without active chat turns.
    let compile_api_key = api_key.clone();
    tauri::async_runtime::spawn(async move {
        let total_episodes = db::count_all_episodes().unwrap_or(0);
        let active_contradictions = db::load_active_contradictions(50).unwrap_or_default();

        if crate::memory::compiler::should_compile(total_episodes, &active_contradictions) {
            println!("[BatchQueue][CompileTask] total_episodes={} active_contradictions={}", total_episodes, active_contradictions.len());
            let recent_episodes = db::load_recent_episodes(50).unwrap_or_default();
            match crate::memory::compiler::compile(&compile_api_key, &recent_episodes, &active_contradictions).await {
                Ok(_) => println!("[BatchQueue][CompileTask] Schema compiled successfully"),
                Err(e) => eprintln!("[BatchQueue][CompileTask] Compiler failed: {}", e),
            }

            match crate::memory::gap_auditor::audit(&compile_api_key, &recent_episodes).await {
                Ok(audit_result) => {
                    println!("[BatchQueue][CompileTask] Gap Auditor found {} gaps", audit_result.gaps.len());
                    if !audit_result.gaps.is_empty() {
                        if let Err(e) = crate::memory::gap_auditor::store_gaps(&audit_result.gaps, None) {
                            eprintln!("[BatchQueue][CompileTask] Failed to store gaps: {}", e);
                        }
                    }
                }
                Err(e) => eprintln!("[BatchQueue][CompileTask] Gap Auditor failed: {}", e),
            }
        } else {
            println!("[BatchQueue][CompileTask] Skipping compilation — not enough episodes or pressure");
        }
    });

    // Trigger background question generation if needed
    crate::memory::learn::trigger_background_question_generation();
}

/// Background task: scans all buffers every 10s, flushes stale ones.
pub fn spawn_background_timer(api_key: String) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(SCAN_INTERVAL_SECS)).await;

            let now = Instant::now();
            let stale_sessions: Vec<String> = {
                let buffers = BUFFERS.lock().unwrap();
                buffers
                    .iter()
                    .filter(|(_, b)| {
                        now.duration_since(b.last_activity) >= Duration::from_secs(TIMEOUT_SECS)
                    })
                    .map(|(id, _)| id.clone())
                    .collect()
            };

            for session_id in stale_sessions {
                let api_key = api_key.clone();
                try_flush(session_id, api_key);
            }
        }
    });
}
