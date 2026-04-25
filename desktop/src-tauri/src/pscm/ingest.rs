use crate::pscm::agents::trace_analyzer;
use crate::pscm::db::PscmDb;
use crate::pscm::graph::ConceptGraph;
use crate::pscm::index::MemoryIndex;
use crate::pscm::provider::embed;

use uuid::Uuid;

#[allow(dead_code)]
pub async fn process_turn(
    session_id: &str,
    turn_index: i64,
    role: &str,
    content: &str,
    db: &PscmDb,
    graph: &mut ConceptGraph,
    index: &MemoryIndex,
) -> Result<(), String> {
    let trace_id = Uuid::new_v4().to_string();
    let timestamp = chrono::Utc::now().to_rfc3339();

    // 1. Agent-based semantic analysis (replaces heuristic entity extraction,
    //    hardcoded valence 0.0, and hardcoded topic_drift false)
    let analysis = match trace_analyzer::analyze_trace(content).await {
        Ok(a) => a,
        Err(e) => {
            eprintln!("[PSCM Ingest] TraceAnalyzer failed: {}. Skipping entity extraction for this trace.", e);
            // Store trace without entities, but still embed it
            db.store_trace(&trace_id, session_id, turn_index, content, role, 0.0, false, &timestamp)?;
            let (embedding, provider) = embed::embed(content).await?;
            index.add_trace(&trace_id, content, &embedding)?;
            println!("[PSCM Ingest] trace={} | provider={:?} | concepts=0 (agent failed)", trace_id, provider);
            return Ok(());
        }
    };

    // 2. Store raw trace with real sentiment and drift detection
    db.store_trace(
        &trace_id,
        session_id,
        turn_index,
        content,
        role,
        analysis.valence,
        analysis.topic_drift,
        &timestamp,
    )?;

    // 3. Insert concepts from agent-extracted entities
    // Deduplicate: if concept already exists in graph, reuse its ID
    let mut concept_ids = Vec::new();
    for entity in &analysis.entities {
        let concept_id = if let Some(&idx) = graph.name_to_index.get(&entity.name) {
            // Reuse existing concept
            graph.graph[idx].id.clone()
        } else {
            // Create new concept
            let id = Uuid::new_v4().to_string();
            graph.upsert_concept(&id, &entity.name, &entity.entity_type)?;
            id
        };
        db.upsert_concept(&concept_id, &entity.name, &entity.entity_type, None, &timestamp)?;
        db.link_trace_concept(&trace_id, &concept_id, "mentioned")?;
        concept_ids.push((concept_id, entity.name.clone()));
    }

    // 4. Create co-occurrence edges between concepts in the same trace
    for i in 0..concept_ids.len() {
        for j in (i + 1)..concept_ids.len() {
            let (from_id, from_name) = &concept_ids[i];
            let (to_id, to_name) = &concept_ids[j];
            if from_name != to_name {
                let _ = graph.upsert_edge(from_id, to_id, "CO_OCCURS", 0.5, &timestamp, None, 0.5);
                let _ = db.upsert_edge(from_id, to_id, "CO_OCCURS", 0.5, &timestamp, None, 0.5);
            }
        }
    }

    // 5. Embed trace text
    let (embedding, provider) = embed::embed(content).await?;

    // 6. Upsert into indices
    index.add_trace(&trace_id, content, &embedding)?;

    println!(
        "[PSCM Ingest] trace={} | provider={:?} | valence={:.2} | drift={} | importance={:.2} | entities={} | concepts={}",
        trace_id,
        provider,
        analysis.valence,
        analysis.topic_drift,
        analysis.importance,
        analysis.entities.len(),
        graph.graph.node_count()
    );

    Ok(())
}
