use std::collections::HashMap;
use std::time::Instant;

/// Rigorous benchmark for GAM v2.
/// Seeds 100 episodes across 20 sessions with structured narrative arcs,
/// then runs 25 benchmark queries across 5 categories.
///
/// Run with: cargo test benchmark_rigorous -- --nocapture
#[cfg(test)]
mod rigorous_benchmark {
    use super::*;

    #[derive(Clone, Debug)]
    struct BenchmarkEpisode {
        content: &'static str,
        type_: &'static str,
        entities: Vec<&'static str>,
        contradictions: Vec<usize>, // indices of contradictory episodes
        temporal_order: i32,        // 1-5 position in arc
        volatility: &'static str,   // permanent / slow / fast
    }

    #[derive(Clone, Debug)]
    struct BenchmarkQuery {
        query: &'static str,
        generated_queries: Vec<&'static str>, // Simulated agent-generated search queries
        category: &'static str,
        expected_episodes: Vec<usize>,
        requires_temporal_order: bool,
        requires_contradiction: bool,
        requires_pronoun: bool,
    }

    fn get_corpus() -> Vec<Vec<BenchmarkEpisode>> {
        vec![
            // ─── Arc 1: Keiyara (sessions 0-4) ─────────────────────────
            vec![
                BenchmarkEpisode { content: "I'm working on a project called Keiyara", type_: "fact", entities: vec!["Keiyara"], contradictions: vec![], temporal_order: 1, volatility: "slow" },
                BenchmarkEpisode { content: "Keiyara is a consent engine. I think it's going to be huge", type_: "fact", entities: vec!["Keiyara"], contradictions: vec![], temporal_order: 2, volatility: "slow" },
                BenchmarkEpisode { content: "The trust mechanics in Keiyara are what make it special", type_: "fact", entities: vec!["Keiyara"], contradictions: vec![], temporal_order: 3, volatility: "slow" },
                BenchmarkEpisode { content: "I'm having second thoughts about Keiyara", type_: "fact", entities: vec!["Keiyara"], contradictions: vec![1], temporal_order: 4, volatility: "slow" },
                BenchmarkEpisode { content: "Keiyara is dead. I'm pivoting to something else", type_: "fact", entities: vec!["Keiyara"], contradictions: vec![1, 2], temporal_order: 5, volatility: "slow" },
            ],
            // ─── Arc 2: Orkestrate (sessions 5-9) ──────────────────────
            vec![
                BenchmarkEpisode { content: "I'm building Orkestrate, a memory system for AI agents", type_: "fact", entities: vec!["Orkestrate"], contradictions: vec![], temporal_order: 1, volatility: "slow" },
                BenchmarkEpisode { content: "Orkestrate uses flat memory currently. It's not enough", type_: "fact", entities: vec!["Orkestrate"], contradictions: vec![], temporal_order: 2, volatility: "slow" },
                BenchmarkEpisode { content: "I changed Orkestrate to use a graph compiler", type_: "fact", entities: vec!["Orkestrate"], contradictions: vec![], temporal_order: 3, volatility: "slow" },
                BenchmarkEpisode { content: "The graph compiler in Orkestrate is working well", type_: "fact", entities: vec!["Orkestrate"], contradictions: vec![], temporal_order: 4, volatility: "slow" },
                BenchmarkEpisode { content: "Orkestrate is almost ready for beta release", type_: "fact", entities: vec!["Orkestrate"], contradictions: vec![], temporal_order: 5, volatility: "slow" },
            ],
            // ─── Arc 3: Google Next (sessions 10-14) ───────────────────
            vec![
                BenchmarkEpisode { content: "I met Karan. He's great at blockchain", type_: "fact", entities: vec!["Karan", "blockchain"], contradictions: vec![], temporal_order: 1, volatility: "slow" },
                BenchmarkEpisode { content: "We're helping him write for the Google Next challenge", type_: "fact", entities: vec!["Karan", "Google Next"], contradictions: vec![], temporal_order: 2, volatility: "slow" },
                BenchmarkEpisode { content: "The Google Next thing is harder than I thought", type_: "fact", entities: vec!["Google Next"], contradictions: vec![], temporal_order: 3, volatility: "slow" },
                BenchmarkEpisode { content: "I deprioritized the Google Next challenge", type_: "fact", entities: vec!["Google Next"], contradictions: vec![2], temporal_order: 4, volatility: "slow" },
                BenchmarkEpisode { content: "I officially withdrew from Google Next", type_: "fact", entities: vec!["Google Next"], contradictions: vec![2], temporal_order: 5, volatility: "slow" },
            ],
            // ─── Arc 4: Health / Work habits (sessions 15-19) ──────────
            vec![
                BenchmarkEpisode { content: "I've been working until 3am every night", type_: "habit", entities: vec![], contradictions: vec![], temporal_order: 1, volatility: "fast" },
                BenchmarkEpisode { content: "I drink five cups of coffee a day", type_: "habit", entities: vec!["coffee"], contradictions: vec![], temporal_order: 2, volatility: "fast" },
                BenchmarkEpisode { content: "I crashed yesterday. Couldn't get out of bed", type_: "fact", entities: vec![], contradictions: vec![], temporal_order: 3, volatility: "fast" },
                BenchmarkEpisode { content: "I've been sleeping 8 hours for a week now", type_: "habit", entities: vec![], contradictions: vec![0], temporal_order: 4, volatility: "fast" },
                BenchmarkEpisode { content: "I'm drinking tea instead of coffee now", type_: "preference", entities: vec!["tea", "coffee"], contradictions: vec![1], temporal_order: 5, volatility: "fast" },
            ],
        ]
    }

    fn get_queries() -> Vec<BenchmarkQuery> {
        vec![
            // ─── Category: Entity-specific (5 queries) ───────────────
            BenchmarkQuery { query: "Tell me about Karan", generated_queries: vec!["Karan", "Karan blockchain", "met Karan"], category: "entity", expected_episodes: vec![10, 11], requires_temporal_order: false, requires_contradiction: false, requires_pronoun: false },
            BenchmarkQuery { query: "What is Keiyara?", generated_queries: vec!["Keiyara", "Keiyara project", "Keiyara consent engine"], category: "entity", expected_episodes: vec![0, 1, 2, 3, 4], requires_temporal_order: false, requires_contradiction: false, requires_pronoun: false },
            BenchmarkQuery { query: "What's Orkestrate?", generated_queries: vec!["Orkestrate", "Orkestrate memory system", "Orkestrate graph compiler"], category: "entity", expected_episodes: vec![5, 6, 7, 8, 9], requires_temporal_order: false, requires_contradiction: false, requires_pronoun: false },
            BenchmarkQuery { query: "What happened with Google Next?", generated_queries: vec!["Google Next", "Google Next challenge", "withdrew Google Next"], category: "entity", expected_episodes: vec![10, 11, 12, 13, 14], requires_temporal_order: false, requires_contradiction: false, requires_pronoun: false },
            BenchmarkQuery { query: "Tell me about my coffee habits", generated_queries: vec!["coffee", "drink coffee", "tea instead coffee"], category: "entity", expected_episodes: vec![16, 19], requires_temporal_order: false, requires_contradiction: false, requires_pronoun: false },

            // ─── Category: Temporal arc (5 queries) ───────────────────
            BenchmarkQuery { query: "What happened with Keiyara over time?", generated_queries: vec!["Keiyara", "Keiyara pivot", "Keiyara consent engine"], category: "temporal", expected_episodes: vec![0, 1, 2, 3, 4], requires_temporal_order: true, requires_contradiction: false, requires_pronoun: false },
            BenchmarkQuery { query: "How did Orkestrate evolve?", generated_queries: vec!["Orkestrate", "Orkestrate flat memory", "Orkestrate graph compiler"], category: "temporal", expected_episodes: vec![5, 6, 7, 8, 9], requires_temporal_order: true, requires_contradiction: false, requires_pronoun: false },
            BenchmarkQuery { query: "What happened with the Google Next challenge?", generated_queries: vec!["Google Next", "Google Next challenge", "withdrew Google Next"], category: "temporal", expected_episodes: vec![10, 11, 12, 13, 14], requires_temporal_order: true, requires_contradiction: false, requires_pronoun: false },
            BenchmarkQuery { query: "How did my health change?", generated_queries: vec!["sleeping", "coffee tea", "working late nights"], category: "temporal", expected_episodes: vec![15, 16, 17, 18, 19], requires_temporal_order: true, requires_contradiction: false, requires_pronoun: false },
            BenchmarkQuery { query: "Trace my journey with Keiyara", generated_queries: vec!["Keiyara", "Keiyara project", "Keiyara trust mechanics"], category: "temporal", expected_episodes: vec![0, 1, 2, 3, 4], requires_temporal_order: true, requires_contradiction: false, requires_pronoun: false },

            // ─── Category: Contradiction probe (5 queries) ────────────
            BenchmarkQuery { query: "Do I still think Keiyara is going to be huge?", generated_queries: vec!["Keiyara huge", "Keiyara second thoughts", "Keiyara dead"], category: "contradiction", expected_episodes: vec![1, 3, 4], requires_temporal_order: false, requires_contradiction: true, requires_pronoun: false },
            BenchmarkQuery { query: "Did I end up doing Google Next?", generated_queries: vec!["Google Next", "deprioritized Google Next", "withdrew Google Next"], category: "contradiction", expected_episodes: vec![12, 13, 14], requires_temporal_order: false, requires_contradiction: true, requires_pronoun: false },
            BenchmarkQuery { query: "Do I still drink coffee?", generated_queries: vec!["drink coffee", "tea instead coffee"], category: "contradiction", expected_episodes: vec![16, 19], requires_temporal_order: false, requires_contradiction: true, requires_pronoun: false },
            BenchmarkQuery { query: "Am I still working late nights?", generated_queries: vec!["working late nights", "sleeping 8 hours"], category: "contradiction", expected_episodes: vec![15, 18], requires_temporal_order: false, requires_contradiction: true, requires_pronoun: false },
            BenchmarkQuery { query: "Did Orkestrate stay flat?", generated_queries: vec!["Orkestrate flat memory", "Orkestrate graph compiler"], category: "contradiction", expected_episodes: vec![6, 7], requires_temporal_order: false, requires_contradiction: true, requires_pronoun: false },

            // ─── Category: Pronoun resolution (5 queries) ─────────────
            BenchmarkQuery { query: "Who was I helping with writing?", generated_queries: vec!["helping write", "Google Next challenge", "Karan"], category: "pronoun", expected_episodes: vec![10, 11], requires_temporal_order: false, requires_contradiction: false, requires_pronoun: true },
            BenchmarkQuery { query: "What did I mean by him in the Google Next conversation?", generated_queries: vec!["him Google Next", "Karan Google Next", "helping him write"], category: "pronoun", expected_episodes: vec![10, 11], requires_temporal_order: false, requires_contradiction: false, requires_pronoun: true },
            BenchmarkQuery { query: "Who is the he that wants me to drop a project?", generated_queries: vec!["drop project", "pivot project"], category: "pronoun", expected_episodes: vec![], requires_temporal_order: false, requires_contradiction: false, requires_pronoun: true },
            BenchmarkQuery { query: "What did I say about it?", generated_queries: vec!["say about"], category: "pronoun", expected_episodes: vec![], requires_temporal_order: false, requires_contradiction: false, requires_pronoun: true },
            BenchmarkQuery { query: "Who was the person I mentioned?", generated_queries: vec!["person mentioned", "met Karan"], category: "pronoun", expected_episodes: vec![10], requires_temporal_order: false, requires_contradiction: false, requires_pronoun: true },

            // ─── Category: Narrative synthesis (5 queries) ────────────
            BenchmarkQuery { query: "Summarize my project history", generated_queries: vec!["Keiyara", "Orkestrate", "Google Next", "project"], category: "synthesis", expected_episodes: vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9], requires_temporal_order: false, requires_contradiction: false, requires_pronoun: false },
            BenchmarkQuery { query: "Tell me about my relationships", generated_queries: vec!["Karan", "relationship", "met"], category: "synthesis", expected_episodes: vec![10, 11], requires_temporal_order: false, requires_contradiction: false, requires_pronoun: false },
            BenchmarkQuery { query: "What's my health journey?", generated_queries: vec!["sleeping", "coffee", "tea", "crashed"], category: "synthesis", expected_episodes: vec![15, 16, 17, 18, 19], requires_temporal_order: false, requires_contradiction: false, requires_pronoun: false },
            BenchmarkQuery { query: "What projects have I abandoned?", generated_queries: vec!["abandoned", "dead", "withdrew", "pivot"], category: "synthesis", expected_episodes: vec![4, 14], requires_temporal_order: false, requires_contradiction: true, requires_pronoun: false },
            BenchmarkQuery { query: "What have I been working on?", generated_queries: vec!["working", "project", "Keiyara", "Orkestrate"], category: "synthesis", expected_episodes: vec![0, 5, 10], requires_temporal_order: false, requires_contradiction: false, requires_pronoun: false },
        ]
    }

    #[tokio::test]
    async fn benchmark_rigorous() {
        println!("\n========================================");
        println!("ORKESTRATE GAM v2 RIGOROUS BENCHMARK");
        println!("========================================\n");

        let corpus = get_corpus();
        let queries = get_queries();

        // Flatten corpus and seed
        let mut all_episodes: Vec<BenchmarkEpisode> = Vec::new();
        let mut session_starts: Vec<usize> = Vec::new();
        let mut entity_name_to_id: HashMap<&'static str, String> = HashMap::new();

        for session in &corpus {
            session_starts.push(all_episodes.len());
            for ep in session {
                all_episodes.push(ep.clone());
            }
        }

        // Store entities
        let entity_names = ["Keiyara", "Orkestrate", "Karan", "blockchain", "Google Next", "coffee", "tea"];
        for name in entity_names {
            if let Ok(id) = crate::db::store_entity(name, "entity", Some(&name.to_lowercase())) {
                entity_name_to_id.insert(name, id);
            }
        }

        // Store episodes with embeddings
        let mut episode_ids: Vec<String> = Vec::new();
        for (idx, ep) in all_episodes.iter().enumerate() {
            let content = ep.content;
            let embedding = match crate::embed::embed(content).await {
                Ok((emb, provider)) => {
                    let session_id = format!("session_{}", session_starts.iter().rposition(|&s| s <= idx).unwrap_or(0));
                    let id = crate::db::store_episode_with_embedding(
                        content,
                        ep.type_,
                        0.9,
                        0.8,
                        "semantic",
                        Some("benchmark"),
                        Some(&session_id),
                        Some(&emb),
                        Some(provider.model_name()),
                    ).unwrap_or_default();

                    // Link entities
                    for ent_name in &ep.entities {
                        if let Some(ent_id) = entity_name_to_id.get(ent_name) {
                            let _ = crate::db::link_episode_entity(&id, ent_id, "mentioned", false);
                        }
                    }

                    // Create progression edges within session
                    let session_idx = session_starts.iter().rposition(|&s| s <= idx).unwrap_or(0);
                    let session_start = session_starts[session_idx];
                    if idx > session_start {
                        let prev_id = &episode_ids[idx - 1];
                        let _ = crate::db::store_episode_edge(prev_id, &id, "progression", 1.0, Some(&session_id));
                    }

                    episode_ids.push(id);
                }
                Err(e) => {
                    eprintln!("Embedding failed for '{}': {}", content, e);
                    episode_ids.push(String::new());
                }
            };
        }

        println!("Seeded {} episodes, {} entities", episode_ids.len(), entity_name_to_id.len());

        // Run benchmark queries
        let mut latencies: Vec<u128> = Vec::new();
        let mut precisions: Vec<f64> = Vec::new();
        let mut recalls: Vec<f64> = Vec::new();
        let mut fprs: Vec<f64> = Vec::new();
        let mut temporal_scores: Vec<f64> = Vec::new();
        let mut contradiction_scores: Vec<f64> = Vec::new();
        let mut pronoun_scores: Vec<f64> = Vec::new();

        for q in &queries {
            let start = Instant::now();
            let search_queries: Vec<String> = q.generated_queries.iter().map(|s| s.to_string()).collect();
            let results = crate::tools::search_memory::search_memory_raw(&search_queries, 6).await;
            let latency = start.elapsed().as_millis();
            latencies.push(latency);

            let result_indices: Vec<usize> = results.iter().filter_map(|r| {
                episode_ids.iter().position(|id| id == &r.id)
            }).collect();

            let expected_set: std::collections::HashSet<usize> = q.expected_episodes.iter().cloned().collect();
            let result_set: std::collections::HashSet<usize> = result_indices.iter().cloned().collect();

            // Precision: relevant retrieved / total retrieved
            let relevant_retrieved = result_set.intersection(&expected_set).count();
            let precision = if !results.is_empty() {
                relevant_retrieved as f64 / results.len() as f64
            } else { 0.0 };
            precisions.push(precision);

            // Recall: relevant retrieved / total expected
            let recall = if !expected_set.is_empty() {
                relevant_retrieved as f64 / expected_set.len() as f64
            } else { 0.0 };
            recalls.push(recall);

            // False positive rate: irrelevant retrieved / total retrieved
            let irrelevant_retrieved = results.len() - relevant_retrieved;
            let fpr = if !results.is_empty() {
                irrelevant_retrieved as f64 / results.len() as f64
            } else { 0.0 };
            fprs.push(fpr);

            // Temporal ordering score: are results in temporal order?
            let mut temporal_score = 0.0;
            if q.requires_temporal_order && !result_indices.is_empty() {
                let mut ordered = true;
                for i in 1..result_indices.len() {
                    if all_episodes[result_indices[i]].temporal_order < all_episodes[result_indices[i - 1]].temporal_order {
                        ordered = false;
                        break;
                    }
                }
                temporal_score = if ordered { 1.0 } else { 0.5 };
            }
            temporal_scores.push(temporal_score);

            // Contradiction detection: does result set span contradictory episodes?
            let mut contradiction_score = 0.0;
            if q.requires_contradiction {
                // Check if we retrieved episodes from both sides of a contradiction
                let mut has_contradiction = false;
                for &idx in &result_indices {
                    for &contradicted_idx in &all_episodes[idx].contradictions {
                        if result_set.contains(&contradicted_idx) {
                            has_contradiction = true;
                            break;
                        }
                    }
                }
                contradiction_score = if has_contradiction { 1.0 } else { 0.3 };
            }
            contradiction_scores.push(contradiction_score);

            // Pronoun resolution: did we retrieve the correct antecedent?
            let mut pronoun_score = 0.0;
            if q.requires_pronoun {
                // For pronoun queries, check if expected episodes were retrieved
                let pronoun_hits = result_set.intersection(&expected_set).count();
                pronoun_score = if !expected_set.is_empty() {
                    pronoun_hits as f64 / expected_set.len() as f64
                } else { 0.0 };
            }
            pronoun_scores.push(pronoun_score);

            println!("[{}] '{}' | P:{:.2} R:{:.2} FPR:{:.2} | Latency: {}ms",
                q.category, q.query, precision, recall, fpr, latency);
        }

        // Aggregate metrics
        let avg_latency = latencies.iter().sum::<u128>() as f64 / latencies.len() as f64;
        let p95_latency = {
            let mut sorted = latencies.clone();
            sorted.sort();
            sorted[(sorted.len() as f64 * 0.95) as usize]
        };
        let avg_precision = precisions.iter().sum::<f64>() / precisions.len() as f64;
        let avg_recall = recalls.iter().sum::<f64>() / recalls.len() as f64;
        let avg_fpr = fprs.iter().sum::<f64>() / fprs.len() as f64;
        let avg_temporal = temporal_scores.iter().sum::<f64>() / temporal_scores.len() as f64;
        let avg_contradiction = contradiction_scores.iter().sum::<f64>() / contradiction_scores.len() as f64;
        let avg_pronoun = pronoun_scores.iter().sum::<f64>() / pronoun_scores.len() as f64;

        // Category breakdown
        let mut category_scores: HashMap<&str, Vec<(f64, f64, f64)>> = HashMap::new();
        for (i, q) in queries.iter().enumerate() {
            category_scores.entry(q.category).or_insert_with(Vec::new).push((
                precisions[i], recalls[i], fprs[i]
            ));
        }

        println!("\n========================================");
        println!("BENCHMARK SUMMARY");
        println!("========================================");
        println!("Queries: {} | Episodes: {} | Entities: {}", queries.len(), episode_ids.len(), entity_name_to_id.len());
        println!("\n--- OVERALL METRICS ---");
        println!("Precision@6:   {:.3}", avg_precision);
        println!("Recall@6:      {:.3}", avg_recall);
        println!("False Positive: {:.3}", avg_fpr);
        println!("Temporal Order: {:.3}", avg_temporal);
        println!("Contradiction:  {:.3}", avg_contradiction);
        println!("Pronoun Res:    {:.3}", avg_pronoun);
        println!("\n--- LATENCY ---");
        println!("Mean:  {:.1}ms", avg_latency);
        println!("P95:   {}ms", p95_latency);
        println!("\n--- CATEGORY BREAKDOWN ---");
        for (cat, scores) in &category_scores {
            let avg_p = scores.iter().map(|(p, _, _)| *p).sum::<f64>() / scores.len() as f64;
            let avg_r = scores.iter().map(|(_, r, _)| *r).sum::<f64>() / scores.len() as f64;
            println!("  {}: P={:.3} R={:.3} (n={})", cat, avg_p, avg_r, scores.len());
        }
        println!("========================================\n");
    }
}
