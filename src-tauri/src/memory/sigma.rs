use chrono::Utc;
use rusqlite::params;
use serde_json::json;

use crate::memory::schema::get_db;

/// Compile the Life Document from all memory capacities.
/// This is Sigma's job — periodic consolidation.
pub fn compile_life_document() -> Result<serde_json::Value, String> {
    let conn = get_db().map_err(|e| format!("db open failed: {}", e))?;

    // Collect entities
    let mut entity_stmt = conn
        .prepare("SELECT name, type, profile, mention_count, last_seen FROM entities ORDER BY mention_count DESC")
        .map_err(|e| format!("entity prepare failed: {}", e))?;

    let entities: Vec<serde_json::Value> = entity_stmt
        .query_map([], |row| {
            Ok(json!({
                "name": row.get::<_, String>(0)?,
                "type": row.get::<_, String>(1)?,
                "profile": row.get::<_, String>(2)?,
                "mention_count": row.get::<_, i32>(3)?,
                "last_seen": row.get::<_, String>(4)?
            }))
        })
        .map_err(|e| format!("entity query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Collect relationships
    let mut rel_stmt = conn
        .prepare("SELECT source_id, target_id, dynamics, strength FROM relationships ORDER BY strength DESC")
        .map_err(|e| format!("relationship prepare failed: {}", e))?;

    let relationships: Vec<serde_json::Value> = rel_stmt
        .query_map([], |row| {
            Ok(json!({
                "source": row.get::<_, String>(0)?,
                "target": row.get::<_, String>(1)?,
                "dynamics": row.get::<_, String>(2)?,
                "strength": row.get::<_, f64>(3)?
            }))
        })
        .map_err(|e| format!("relationship query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Collect constraints
    let mut constraint_stmt = conn
        .prepare("SELECT entity_id, constraint_type, description, severity FROM constraints")
        .map_err(|e| format!("constraint prepare failed: {}", e))?;

    let constraints: Vec<serde_json::Value> = constraint_stmt
        .query_map([], |row| {
            Ok(json!({
                "entity": row.get::<_, String>(0)?,
                "type": row.get::<_, String>(1)?,
                "description": row.get::<_, String>(2)?,
                "severity": row.get::<_, String>(3)?
            }))
        })
        .map_err(|e| format!("constraint query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Collect goals
    let mut goal_stmt = conn
        .prepare("SELECT description, status, priority, related_entity_ids FROM goals WHERE status = 'active' ORDER BY priority DESC")
        .map_err(|e| format!("goal prepare failed: {}", e))?;

    let goals: Vec<serde_json::Value> = goal_stmt
        .query_map([], |row| {
            Ok(json!({
                "description": row.get::<_, String>(0)?,
                "status": row.get::<_, String>(1)?,
                "priority": row.get::<_, i32>(2)?,
                "related_entities": row.get::<_, String>(3)?
            }))
        })
        .map_err(|e| format!("goal query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Collect patterns
    let mut pattern_stmt = conn
        .prepare("SELECT description, pattern_type, confidence, trigger_conditions, typical_outcome FROM patterns ORDER BY confidence DESC")
        .map_err(|e| format!("pattern prepare failed: {}", e))?;

    let patterns: Vec<serde_json::Value> = pattern_stmt
        .query_map([], |row| {
            Ok(json!({
                "description": row.get::<_, String>(0)?,
                "type": row.get::<_, String>(1)?,
                "confidence": row.get::<_, f64>(2)?,
                "trigger": row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                "outcome": row.get::<_, Option<String>>(4)?.unwrap_or_default()
            }))
        })
        .map_err(|e| format!("pattern query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Recent history (last 30 days)
    let thirty_days_ago = Utc::now() - chrono::Duration::days(30);
    let mut history_stmt = conn
        .prepare("SELECT description, timestamp, emotional_valence FROM history WHERE timestamp > ?1 ORDER BY timestamp DESC LIMIT 50")
        .map_err(|e| format!("history prepare failed: {}", e))?;

    let recent_history: Vec<serde_json::Value> = history_stmt
        .query_map(params![thirty_days_ago.to_rfc3339()], |row| {
            Ok(json!({
                "description": row.get::<_, String>(0)?,
                "timestamp": row.get::<_, String>(1)?,
                "valence": row.get::<_, String>(2)?
            }))
        })
        .map_err(|e| format!("history query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Build the document
    let document = json!({
        "compiled_at": Utc::now().to_rfc3339(),
        "version": 1,
        "identity": {
            "entities": entities,
            "relationships": relationships
        },
        "constraints": constraints,
        "active_goals": goals,
        "patterns": patterns,
        "recent_history": recent_history,
        "current_state": {
            "summary": "Compiled from recent states and history"
        }
    });

    // Save to life_document table
    conn.execute(
        "INSERT OR REPLACE INTO life_document (id, document, last_compiled, version)
         VALUES (1, ?1, ?2, ?3)",
        params![
            serde_json::to_string(&document).unwrap_or_default(),
            Utc::now().to_rfc3339(),
            1
        ],
    )
    .map_err(|e| format!("life document save failed: {}", e))?;

    Ok(document)
}
