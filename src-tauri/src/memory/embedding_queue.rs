use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::memory::embedding;
use crate::memory::schema::get_db;

/// A pending embedding job.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingJob {
    pub id: String,
    pub target_table: String, // "entity_embeddings" or "history_embeddings"
    pub target_id: String,
    pub text_to_embed: String,
    pub attempts: i32,
}

/// Queue an embedding job for later processing.
pub fn queue_embedding(
    target_table: &str,
    target_id: &str,
    text_to_embed: &str,
) -> Result<(), String> {
    let conn = get_db().map_err(|e| format!("db open failed: {}", e))?;
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO embedding_queue (id, target_table, target_id, text_to_embed, attempts, created_at)
         VALUES (?1, ?2, ?3, ?4, 0, ?5)",
        params![&id, target_table, target_id, text_to_embed, Utc::now().to_rfc3339()],
    )
    .map_err(|e| format!("embedding queue insert failed: {}", e))?;

    Ok(())
}

/// Process all pending embedding jobs.
/// Call this from a background task periodically.
pub async fn process_embedding_queue() -> Result<usize, String> {
    // Step 1: Collect all pending jobs (sync, no await while holding statement)
    let jobs = {
        let conn = get_db().map_err(|e| format!("db open failed: {}", e))?;
        let mut stmt = conn
            .prepare(
                "SELECT id, target_table, target_id, text_to_embed, attempts
                 FROM embedding_queue
                 WHERE attempts < 3
                 ORDER BY created_at
                 LIMIT 20",
            )
            .map_err(|e| format!("prepare failed: {}", e))?;

        let jobs: Vec<EmbeddingJob> = stmt
            .query_map([], |row| {
                Ok(EmbeddingJob {
                    id: row.get(0)?,
                    target_table: row.get(1)?,
                    target_id: row.get(2)?,
                    text_to_embed: row.get(3)?,
                    attempts: row.get(4)?,
                })
            })
            .map_err(|e| format!("query failed: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        jobs
    }; // conn and stmt dropped here before any await

    let mut processed = 0;

    for job in jobs {
        // Step 2: Generate embedding async
        match embedding::embed(&job.text_to_embed).await {
            Ok(embedding_vec) => {
                let serialized = embedding::serialize_embedding(&embedding_vec);

                // Step 3: Insert into target table (sync)
                let conn = get_db().map_err(|e| format!("db re-open failed: {}", e))?;

                let result = conn.execute(
                    &format!(
                        "INSERT INTO {} ({}_id, embedding) VALUES (?1, ?2)",
                        job.target_table,
                        if job.target_table == "entity_embeddings" {
                            "entity"
                        } else {
                            "history"
                        }
                    ),
                    params![&job.target_id, &serialized],
                );

                match result {
                    Ok(_) => {
                        // Delete from queue
                        let _ = conn.execute(
                            "DELETE FROM embedding_queue WHERE id = ?1",
                            params![&job.id],
                        );
                        processed += 1;
                    }
                    Err(e) => {
                        eprintln!("Embedding insert failed: {}", e);
                        let _ = conn.execute(
                            "UPDATE embedding_queue SET attempts = attempts + 1 WHERE id = ?1",
                            params![&job.id],
                        );
                    }
                }
            }
            Err(e) => {
                eprintln!("Embedding generation failed: {}", e);
                let conn = get_db().map_err(|e| format!("db re-open failed: {}", e))?;
                let _ = conn.execute(
                    "UPDATE embedding_queue SET attempts = attempts + 1 WHERE id = ?1",
                    params![&job.id],
                );
            }
        }
    }

    Ok(processed)
}
