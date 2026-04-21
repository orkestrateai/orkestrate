use chrono::Utc;
use rusqlite::params;
use serde_json;
use uuid::Uuid;

use crate::agents::storage_classifier::ClassifiedMemory;
use crate::memory::embedding_queue;
use crate::memory::schema::get_db;

/// Store a classified memory into the appropriate table and queue.
/// NOTE: Gets its own DB connection and does NOT hold it across await points.
pub async fn store_classified(memory: &ClassifiedMemory) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    // Open connection for sync operations
    let conn = get_db().map_err(|e| format!("db open failed: {}", e))?;

    // Queue for async processing
    conn.execute(
        "INSERT INTO memory_queue (id, timestamp, turn_id, raw_content, extracted_json, processed, agent)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, 'epsilon')",
        params![
            &id,
            &now,
            &memory.related_turn_id,
            &memory.content,
            serde_json::to_string(memory).unwrap_or_default()
        ],
    )
    .map_err(|e| format!("queue insert failed: {}", e))?;

    // Route to appropriate capacity table (all sync)
    match memory.capacity.as_str() {
        "entity" => store_entity(memory, &conn)?,
        "relationship" => store_relationship(memory, &conn)?,
        "history" => store_history(memory, &conn)?,
        "constraint" => store_constraint(memory, &conn)?,
        "state" => store_state(memory, &conn)?,
        "goal" => store_goal(memory, &conn)?,
        "pattern" => store_pattern(memory, &conn)?,
        _ => {}
    }

    Ok(())
}

fn store_entity(memory: &ClassifiedMemory, conn: &rusqlite::Connection) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let name = memory
        .content
        .split(|c: char| c == '"' || c == '\'')
        .nth(1)
        .unwrap_or(&memory.content)
        .split_whitespace()
        .next()
        .unwrap_or("unknown")
        .to_string();

    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM entities WHERE name = ?1",
            params![&name],
            |row| row.get(0),
        )
        .ok();

    if let Some(existing_id) = existing {
        // Fetch current profile and merge
        let current_profile: String = conn
            .query_row(
                "SELECT profile FROM entities WHERE id = ?1",
                params![&existing_id],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| "{}".to_string());

        let mut profile: serde_json::Value = serde_json::from_str(&current_profile).unwrap_or(serde_json::json!({}));
        if let Some(obj) = profile.as_object_mut() {
            obj.insert("latest".to_string(), serde_json::Value::String(memory.content.clone()));
            obj.insert("last_updated".to_string(), serde_json::Value::String(now.clone()));
        }

        conn.execute(
            "UPDATE entities SET last_seen = ?1, mention_count = mention_count + 1,
             profile = ?2
             WHERE id = ?3",
            params![
                &now,
                serde_json::to_string(&profile).unwrap_or_default(),
                &existing_id
            ],
        )
        .map_err(|e| format!("entity update failed: {}", e))?;
    } else {
        conn.execute(
            "INSERT INTO entities (id, name, type, first_seen, last_seen, mention_count, profile)
             VALUES (?1, ?2, 'person', ?3, ?4, 1, ?5)",
            params![
                &id,
                &name,
                &now,
                &now,
                serde_json::to_string(&serde_json::json!({"latest": &memory.content}))
                    .unwrap_or_default()
            ],
        )
        .map_err(|e| format!("entity insert failed: {}", e))?;

        // Queue embedding generation for new entity
        let _ = embedding_queue::queue_embedding(
            "entity_embeddings",
            &id,
            &memory.content,
        );
    }

    Ok(())
}

fn store_relationship(
    memory: &ClassifiedMemory,
    conn: &rusqlite::Connection,
) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO relationships (id, source_id, target_id, relation_type, dynamics, first_observed, last_observed)
         VALUES (?1, ?2, ?3, 'interacts_with', ?4, ?5, ?6)",
        params![
            &id,
            &memory.entities_involved.get(0).unwrap_or(&"user".to_string()),
            &memory.entities_involved.get(1).unwrap_or(&"unknown".to_string()),
            &memory.content,
            &now,
            &now
        ],
    )
    .map_err(|e| format!("relationship insert failed: {}", e))?;

    Ok(())
}

fn store_history(memory: &ClassifiedMemory, conn: &rusqlite::Connection) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO history (id, timestamp, description, entities_involved, turn_id)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            &id,
            &now,
            &memory.content,
            serde_json::to_string(&memory.entities_involved).unwrap_or_default(),
            &memory.related_turn_id
        ],
    )
    .map_err(|e| format!("history insert failed: {}", e))?;

    // Queue embedding generation for history entry
    let _ = embedding_queue::queue_embedding(
        "history_embeddings",
        &id,
        &memory.content,
    );

    Ok(())
}

fn store_constraint(
    memory: &ClassifiedMemory,
    conn: &rusqlite::Connection,
) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO constraints (id, entity_id, constraint_type, description, severity, first_stated, last_confirmed)
         VALUES (?1, ?2, 'general', ?3, 'soft', ?4, ?5)",
        params![
            &id,
            memory.entities_involved.get(0).unwrap_or(&"user".to_string()),
            &memory.content,
            &now,
            &now
        ],
    )
    .map_err(|e| format!("constraint insert failed: {}", e))?;

    Ok(())
}

fn store_state(memory: &ClassifiedMemory, conn: &rusqlite::Connection) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO states (id, timestamp, mood, evidence, turn_id)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![&id, &now, &memory.content, &memory.content, &memory.related_turn_id],
    )
    .map_err(|e| format!("state insert failed: {}", e))?;

    Ok(())
}

fn store_goal(memory: &ClassifiedMemory, conn: &rusqlite::Connection) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO goals (id, description, stated_or_inferred, status, priority, related_entity_ids, created_at, last_updated)
         VALUES (?1, ?2, 'inferred', 'active', 5, ?3, ?4, ?5)",
        params![
            &id,
            &memory.content,
            serde_json::to_string(&memory.entities_involved).unwrap_or_default(),
            &now,
            &now
        ],
    )
    .map_err(|e| format!("goal insert failed: {}", e))?;

    Ok(())
}

fn store_pattern(memory: &ClassifiedMemory, conn: &rusqlite::Connection) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO patterns (id, description, pattern_type, confidence, first_observed, last_observed)
         VALUES (?1, ?2, 'behavioral', ?3, ?4, ?5)",
        params![&id, &memory.content, memory.confidence, &now, &now],
    )
    .map_err(|e| format!("pattern insert failed: {}", e))?;

    Ok(())
}
