use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::{Connection, Result as SqliteResult};
use std::sync::OnceLock;

use crate::timer::Timer;

static DB_POOL: OnceLock<r2d2::Pool<SqliteConnectionManager>> = OnceLock::new();

fn init_pool() -> r2d2::Pool<SqliteConnectionManager> {
    let db_path = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Orkestrate")
        .join("orkestrate.db");

    if let Some(parent) = db_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let manager = SqliteConnectionManager::file(&db_path);
    let pool = r2d2::Pool::builder()
        .max_size(5)
        .build(manager)
        .expect("Failed to create SQLite pool");

    let conn = pool.get().expect("Failed to get connection");
    init_schema(&conn).expect("Failed to init schema");
    pool
}

fn init_schema(conn: &Connection) -> SqliteResult<()> {
    // ─── Current schema ────────────────────────────────────────────────────
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL,
            last_accessed TEXT NOT NULL,
            turn_count INTEGER DEFAULT 0
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_messages_session_time ON messages(session_id, timestamp DESC)",
        [],
    )?;

    // ─── Migrations ────────────────────────────────────────────────────────
    // Add turn_count to existing sessions tables
    let has_turn_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('sessions') WHERE name = 'turn_count'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if has_turn_count == 0 {
        conn.execute(
            "ALTER TABLE sessions ADD COLUMN turn_count INTEGER DEFAULT 0",
            [],
        )?;
    }

    // Migration: add tool metadata to existing messages tables
    let has_tool_call_id: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('messages') WHERE name = 'tool_call_id'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if has_tool_call_id == 0 {
        conn.execute("ALTER TABLE messages ADD COLUMN tool_call_id TEXT", [])?;
    }

    let has_tool_calls: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('messages') WHERE name = 'tool_calls'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if has_tool_calls == 0 {
        conn.execute("ALTER TABLE messages ADD COLUMN tool_calls TEXT", [])?;
    }

    // ─── Memory System Tables ──────────────────────────────────────────────
    conn.execute(
        "CREATE TABLE IF NOT EXISTS episodes (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            type TEXT NOT NULL,
            confidence REAL DEFAULT 0.5,
            importance REAL DEFAULT 0.5,
            compression_level TEXT DEFAULT 'episodic',
            schema_section TEXT,
            session_id TEXT,
            embedding BLOB,
            created_at TEXT NOT NULL
        )",
        [],
    )?;

    // Migration: add embedding column to existing episodes tables
    let has_embedding: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('episodes') WHERE name = 'embedding'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if has_embedding == 0 {
        conn.execute("ALTER TABLE episodes ADD COLUMN embedding BLOB", [])?;
    }

    // Migration: add embedding_model column to episodes
    let has_embedding_model: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('episodes') WHERE name = 'embedding_model'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if has_embedding_model == 0 {
        conn.execute("ALTER TABLE episodes ADD COLUMN embedding_model TEXT DEFAULT 'openrouter'", [])?;
    }

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_episodes_section ON episodes(schema_section)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_episodes_session ON episodes(session_id, created_at DESC)",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            turn_index INTEGER NOT NULL,
            session_id TEXT NOT NULL,
            user_message TEXT,
            assistant_message TEXT,
            semantic_shift_detected BOOLEAN DEFAULT 0,
            created_at TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, turn_index DESC)",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS contradictions (
            id TEXT PRIMARY KEY,
            existing_episode_id TEXT NOT NULL,
            existing_content TEXT NOT NULL,
            new_evidence_content TEXT NOT NULL,
            new_evidence_episode_id TEXT,
            status TEXT DEFAULT 'contested',
            pressure_score INTEGER DEFAULT 1,
            importance REAL DEFAULT 0.5,
            created_at TEXT NOT NULL,
            resolved_at TEXT
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_contradictions_status ON contradictions(status, pressure_score DESC)",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS learn_queue (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            question TEXT NOT NULL,
            context TEXT,
            source_id TEXT,
            status TEXT DEFAULT 'pending',
            answer TEXT,
            created_at TEXT NOT NULL,
            addressed_at TEXT
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_learn_queue_status ON learn_queue(status, created_at DESC)",
        [],
    )?;

    // ─── Entity Graph Tables ───────────────────────────────────────────────
    conn.execute(
        "CREATE TABLE IF NOT EXISTS entities (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            canonical_name TEXT,
            first_seen TEXT NOT NULL,
            mention_count INTEGER DEFAULT 0,
            embedding_model TEXT DEFAULT 'openrouter'
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name)",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS episode_entities (
            episode_id TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            role TEXT DEFAULT 'mentioned',
            is_resolved BOOLEAN DEFAULT 0,
            PRIMARY KEY (episode_id, entity_id),
            FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
            FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_episode_entities_entity ON episode_entities(entity_id)",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS episode_edges (
            from_episode_id TEXT NOT NULL,
            to_episode_id TEXT NOT NULL,
            edge_type TEXT NOT NULL,
            weight REAL DEFAULT 1.0,
            session_id TEXT,
            created_at TEXT NOT NULL,
            PRIMARY KEY (from_episode_id, to_episode_id, edge_type),
            FOREIGN KEY (from_episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
            FOREIGN KEY (to_episode_id) REFERENCES episodes(id) ON DELETE CASCADE
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_episode_edges_from ON episode_edges(from_episode_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_episode_edges_session ON episode_edges(session_id)",
        [],
    )?;

    Ok(())
}

pub fn get_db() -> SqliteResult<r2d2::PooledConnection<SqliteConnectionManager>> {
    let pool = DB_POOL.get_or_init(init_pool);
    pool.get().map_err(|e| {
        rusqlite::Error::SqliteFailure(rusqlite::ffi::Error::new(1), Some(format!("pool: {}", e)))
    })
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct StoredMessage {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
    pub tool_call_id: Option<String>,
    pub tool_calls: Option<String>,
}

pub fn store_message(
    session_id: &str,
    role: &str,
    content: &str,
    tool_call_id: Option<&str>,
    tool_calls: Option<&str>,
) -> Result<(), String> {
    let t = Timer::new("db::store_message_inner");
    let conn = get_db().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO messages (id, session_id, role, content, timestamp, tool_call_id, tool_calls) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![&id, session_id, role, content, &now, tool_call_id, tool_calls],
    ).map_err(|e| e.to_string())?;

    // Update session last_accessed
    conn.execute(
        "UPDATE sessions SET last_accessed = ?1 WHERE id = ?2",
        [&now, session_id],
    )
    .map_err(|e| e.to_string())?;

    t.log(&format!(
        "session={} role={} content_len={}",
        session_id,
        role,
        content.len(),
    ));
    Ok(())
}

pub fn load_messages(session_id: &str, limit: i64) -> Result<Vec<StoredMessage>, String> {
    let t = Timer::new("db::load_messages_inner");
    let conn = get_db().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, role, content, timestamp, tool_call_id, tool_calls FROM messages
         WHERE session_id = ?1 ORDER BY timestamp DESC LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let messages = stmt
        .query_map([session_id, &limit.to_string()], |row| {
            Ok(StoredMessage {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                timestamp: row.get(4)?,
                tool_call_id: row.get(5)?,
                tool_calls: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect::<Vec<_>>();

    // Reverse so oldest first
    let mut messages = messages;
    messages.reverse();
    t.log(&format!(
        "session={} limit={} count={}",
        session_id,
        limit,
        messages.len()
    ));
    Ok(messages)
}

pub fn create_session(name: &str) -> Result<String, String> {
    let t = Timer::new("db::create_session_inner");
    let conn = get_db().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO sessions (id, name, created_at, last_accessed) VALUES (?1, ?2, ?3, ?3)",
        [&id, name, &now],
    )
    .map_err(|e| e.to_string())?;

    t.log(&format!("name={} id={}", name, id));
    Ok(id)
}

pub fn update_session_name(session_id: &str, name: &str) -> Result<(), String> {
    let t = Timer::new("db::update_session_name_inner");
    let conn = get_db().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE sessions SET name = ?1 WHERE id = ?2",
        [name, session_id],
    )
    .map_err(|e| e.to_string())?;
    t.log(&format!("session={}", session_id));
    Ok(())
}

pub fn list_sessions() -> Result<Vec<serde_json::Value>, String> {
    let t = Timer::new("db::list_sessions_inner");
    let conn = get_db().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, last_accessed FROM sessions ORDER BY last_accessed DESC")
        .map_err(|e| e.to_string())?;

    let sessions: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "lastAccessed": row.get::<_, String>(2)?
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    t.log(&format!("count={}", sessions.len()));
    Ok(sessions)
}

pub fn clear_messages(session_id: &str) -> Result<(), String> {
    let t = Timer::new("db::clear_messages_inner");
    let conn = get_db().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM messages WHERE session_id = ?1", [session_id])
        .map_err(|e| e.to_string())?;
    t.log(&format!("session={}", session_id));
    Ok(())
}

pub fn delete_session(session_id: &str) -> Result<(), String> {
    let t = Timer::new("db::delete_session_inner");
    let conn = get_db().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM messages WHERE session_id = ?1", [session_id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM sessions WHERE id = ?1", [session_id])
        .map_err(|e| e.to_string())?;
    t.log(&format!("session={}", session_id));
    Ok(())
}

pub fn increment_turn_count(session_id: &str) -> Result<i64, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE sessions SET turn_count = turn_count + 1 WHERE id = ?1",
        [session_id],
    )
    .map_err(|e| e.to_string())?;
    let count: i64 = conn
        .query_row(
            "SELECT turn_count FROM sessions WHERE id = ?1",
            [session_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(count)
}

#[allow(dead_code)]
pub fn get_turn_count(session_id: &str) -> Result<i64, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let count: i64 = conn
        .query_row(
            "SELECT turn_count FROM sessions WHERE id = ?1",
            [session_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(count)
}

pub fn estimate_turn_count(session_id: &str) -> Result<i64, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM messages WHERE session_id = ?1 AND role = 'user'",
            [session_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(count)
}

// ─── Episode Operations ────────────────────────────────────────────────

#[derive(serde::Serialize, Clone, Debug)]
pub struct Episode {
    pub id: String,
    pub content: String,
    pub type_: String,
    pub confidence: f64,
    pub importance: f64,
    pub compression_level: String,
    pub schema_section: Option<String>,
    pub session_id: Option<String>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embedding: Option<Vec<f32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embedding_model: Option<String>,
}

pub fn store_episode(
    content: &str,
    type_: &str,
    confidence: f64,
    importance: f64,
    compression_level: &str,
    schema_section: Option<&str>,
    session_id: Option<&str>,
) -> Result<String, String> {
    store_episode_with_embedding(
        content,
        type_,
        confidence,
        importance,
        compression_level,
        schema_section,
        session_id,
        None,
        None,
    )
}

pub fn store_episode_with_embedding(
    content: &str,
    type_: &str,
    confidence: f64,
    importance: f64,
    compression_level: &str,
    schema_section: Option<&str>,
    session_id: Option<&str>,
    embedding: Option<&[f32]>,
    embedding_model: Option<&str>,
) -> Result<String, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let embedding_blob = embedding.map(|emb| crate::vector::serialize(emb));

    conn.execute(
        "INSERT INTO episodes (id, content, type, confidence, importance, compression_level, schema_section, session_id, embedding, embedding_model, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            &id,
            content,
            type_,
            confidence,
            importance,
            compression_level,
            schema_section.unwrap_or(""),
            session_id.unwrap_or(""),
            embedding_blob.as_deref(),
            embedding_model.unwrap_or("unknown"),
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(id)
}

#[allow(dead_code)]
pub fn load_episodes_by_section(_section: &str, limit: i64) -> Result<Vec<Episode>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, content, type, confidence, importance, compression_level, schema_section, session_id, created_at
         FROM episodes WHERE schema_section = ?1 ORDER BY created_at DESC LIMIT ?2"
    ).map_err(|e| e.to_string())?;

    let episodes = stmt
        .query_map([&limit.to_string()], |row| {
            Ok(Episode {
                id: row.get(0)?,
                content: row.get(1)?,
                type_: row.get(2)?,
                confidence: row.get(3)?,
                importance: row.get(4)?,
                compression_level: row.get(5)?,
                schema_section: row.get::<_, Option<String>>(6)?,
                session_id: row.get::<_, Option<String>>(7)?,
                created_at: row.get(8)?,
                embedding: None,
                embedding_model: None,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(episodes)
}

// ─── Cross-Session Helpers ─────────────────────────────────────────────

/// Find the most recently accessed session.
pub fn get_most_recent_session() -> Result<Option<(String, String)>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let result: Option<(String, String)> = conn
        .query_row(
            "SELECT id, name FROM sessions ORDER BY last_accessed DESC LIMIT 1",
            [],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .ok();
    Ok(result)
}

/// Find the most recently accessed session other than the given one.
pub fn get_previous_session(current_id: &str) -> Result<Option<String>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let id: Option<String> = conn
        .query_row(
            "SELECT id FROM sessions WHERE id != ?1 ORDER BY last_accessed DESC LIMIT 1",
            [current_id],
            |row| row.get(0),
        )
        .ok();
    Ok(id)
}

/// Search messages within a specific session for relevance to a query.
pub fn search_messages(
    session_id: &str,
    query: &str,
    limit: i64,
) -> Result<Vec<StoredMessage>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", query);
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, role, content, timestamp, tool_call_id, tool_calls FROM messages
         WHERE session_id = ?1 AND content LIKE ?2
         ORDER BY timestamp DESC LIMIT ?3",
        )
        .map_err(|e| e.to_string())?;

    let messages = stmt
        .query_map([session_id, &pattern, &limit.to_string()], |row| {
            Ok(StoredMessage {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                timestamp: row.get(4)?,
                tool_call_id: row.get(5)?,
                tool_calls: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(messages)
}

/// Load the last N messages from a specific session.
pub fn load_session_messages(session_id: &str, limit: i64) -> Result<Vec<StoredMessage>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, role, content, timestamp, tool_call_id, tool_calls FROM messages
         WHERE session_id = ?1 ORDER BY timestamp DESC LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let mut messages: Vec<StoredMessage> = stmt
        .query_map([session_id, &limit.to_string()], |row| {
            Ok(StoredMessage {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                timestamp: row.get(4)?,
                tool_call_id: row.get(5)?,
                tool_calls: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Reverse to chronological order
    messages.reverse();
    Ok(messages)
}

// ─── Memory Search ─────────────────────────────────────────────────────

/// Search episodes, contradictions, and events for matches against queries.
/// Returns deduplicated episodes ranked by match count × importance.
pub fn search_memory(queries: &[String], limit: i64) -> Result<Vec<Episode>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;

    // Detect temporal queries to boost recency sorting
    let temporal_words = [
        "recent",
        "last",
        "ago",
        "yesterday",
        "before",
        "earlier",
        "previous",
        "latest",
        "newest",
    ];
    let has_temporal = queries.iter().any(|q| {
        let ql = q.to_lowercase();
        temporal_words.iter().any(|w| ql.contains(w))
    });
    let episode_order = if has_temporal {
        "created_at DESC, importance DESC"
    } else {
        "importance DESC, created_at DESC"
    };

    // Build OR conditions for episodes
    let episode_conditions = queries
        .iter()
        .map(|q| format!("content LIKE '%{}%'", q.replace("'", "''")))
        .collect::<Vec<_>>()
        .join(" OR ");

    let mut episode_results: Vec<Episode> = Vec::new();
    if !episode_conditions.is_empty() {
        let sql = format!(
            "SELECT id, content, type, confidence, importance, compression_level, schema_section, session_id, created_at
             FROM episodes WHERE {} ORDER BY {} LIMIT ?1",
            episode_conditions, episode_order
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        episode_results = stmt
            .query_map([&limit.to_string()], |row| {
            Ok(Episode {
                id: row.get(0)?,
                content: row.get(1)?,
                type_: row.get(2)?,
                confidence: row.get(3)?,
                importance: row.get(4)?,
                compression_level: row.get(5)?,
                schema_section: row.get::<_, Option<String>>(6)?,
                session_id: row.get::<_, Option<String>>(7)?,
                created_at: row.get(8)?,
                embedding: None,
                embedding_model: None,
            })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
    }

    // Build OR conditions for contradictions — treat existing_content as an episode-like fact
    let contradiction_conditions = queries
        .iter()
        .map(|q| format!("existing_content LIKE '%{}%'", q.replace("'", "''")))
        .collect::<Vec<_>>()
        .join(" OR ");

    if !contradiction_conditions.is_empty() {
        let sql = format!(
            "SELECT id, existing_content, status, pressure_score, created_at
             FROM contradictions WHERE {} ORDER BY pressure_score DESC, created_at DESC LIMIT ?1",
            contradiction_conditions
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let contradictions: Vec<(String, String, i64)> = stmt
            .query_map([&limit.to_string()], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(3)?, // pressure_score as importance proxy
                ))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        for (id, content, pressure) in contradictions {
            // Convert contradiction to an episode-like result
            episode_results.push(Episode {
                id,
                content: format!("[Contradiction] {}", content),
                type_: "contradiction".to_string(),
                confidence: 0.8,
                importance: (pressure as f64 * 0.2).min(1.0),
                compression_level: "semantic".to_string(),
                schema_section: None,
                session_id: None,
                created_at: chrono::Utc::now().to_rfc3339(),
                embedding: None,
                embedding_model: None,
            });
        }
    }

    // Build OR conditions for events (search user_message and assistant_message)
    let event_conditions = queries
        .iter()
        .map(|q| {
            format!(
                "user_message LIKE '%{}%' OR assistant_message LIKE '%{}%'",
                q.replace("'", "''"),
                q.replace("'", "''")
            )
        })
        .collect::<Vec<_>>()
        .join(" OR ");

    if !event_conditions.is_empty() {
        let sql = format!(
            "SELECT id, user_message, assistant_message, created_at
             FROM events WHERE {} ORDER BY created_at DESC LIMIT ?1",
            event_conditions
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let events: Vec<(String, String, String, String)> = stmt
            .query_map([&limit.to_string()], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        for (id, user_msg, assistant_msg, created_at) in events {
            let content = format!("[Event] User: {} | Assistant: {}", user_msg, assistant_msg);
            episode_results.push(Episode {
                id,
                content,
                type_: "event".to_string(),
                confidence: 0.6,
                importance: 0.4,
                compression_level: "episodic".to_string(),
                schema_section: None,
                session_id: None,
                created_at,
                embedding: None,
                embedding_model: None,
            });
        }
    }

    // Deduplicate by content (simple: strip punctuation, lowercase, first 60 chars as key)
    let mut seen = std::collections::HashSet::new();
    episode_results.retain(|ep| {
        let key = ep
            .content
            .to_lowercase()
            .replace(|c: char| !c.is_alphanumeric(), "")
            .chars()
            .take(60)
            .collect::<String>();
        if seen.contains(&key) {
            false
        } else {
            seen.insert(key);
            true
        }
    });

    // Trim to limit
    episode_results.truncate(limit as usize);

    Ok(episode_results)
}

// ─── Semantic Search with Embeddings ───────────────────────────────────

/// Load episodes that have embeddings, returning (id, content, embedding_vec).
/// Optionally filter by embedding_model to ensure dimension compatibility.
pub fn load_episodes_with_embeddings(
    limit: i64,
    embedding_model: Option<&str>,
) -> Result<Vec<(String, String, Vec<f32>)>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;

    let sql = if let Some(model) = embedding_model {
        format!(
            "SELECT id, content, embedding FROM episodes
             WHERE embedding IS NOT NULL AND (embedding_model = '{}' OR embedding_model IS NULL)
             ORDER BY created_at DESC LIMIT ?1",
            model.replace("'", "''")
        )
    } else {
        "SELECT id, content, embedding FROM episodes
         WHERE embedding IS NOT NULL
         ORDER BY created_at DESC LIMIT ?1".to_string()
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([&limit.to_string()], |row| {
            let id: String = row.get(0)?;
            let content: String = row.get(1)?;
            let blob: Vec<u8> = row.get(2)?;
            let embedding = crate::vector::deserialize(&blob);
            Ok((id, content, embedding))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

/// Semantic search using brute-force cosine similarity.
/// Loads all embeddings with the query and returns top-k by similarity.
/// Filters by embedding_model to ensure dimension compatibility.
pub fn search_semantic(
    query_embedding: &[f32],
    top_k: usize,
    embedding_model: Option<&str>,
) -> Result<Vec<(String, f32)>, String> {
    let t = Timer::new("db::search_semantic");

    let candidates = load_episodes_with_embeddings(5000, embedding_model)?;
    if candidates.is_empty() {
        return Ok(vec![]);
    }

    let embeddings: Vec<Vec<f32>> = candidates.iter().map(|(_, _, emb)| emb.clone()).collect();
    let top = crate::vector::top_k_similarities(query_embedding, &embeddings, top_k);

    let results: Vec<(String, f32)> = top
        .into_iter()
        .map(|(idx, sim)| (candidates[idx].0.clone(), sim))
        .collect();

    t.log(&format!(
        "candidates={} top_k={}",
        candidates.len(),
        results.len()
    ));
    Ok(results)
}

/// Boost the importance of an existing episode (used when a duplicate is detected).
pub fn boost_episode_importance(episode_id: &str, boost: f64) -> Result<(), String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE episodes SET importance = min(importance + ?1, 1.0) WHERE id = ?2",
        [&boost.to_string(), episode_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_gaps(limit: i64) -> Result<Vec<Episode>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, content, type, confidence, importance, compression_level, schema_section, session_id, created_at
         FROM episodes WHERE type = 'gap' ORDER BY created_at DESC LIMIT ?1"
    ).map_err(|e| e.to_string())?;

    let episodes = stmt
        .query_map([&limit.to_string()], |row| {
            Ok(Episode {
                id: row.get(0)?,
                content: row.get(1)?,
                type_: row.get(2)?,
                confidence: row.get(3)?,
                importance: row.get(4)?,
                compression_level: row.get(5)?,
                schema_section: row.get::<_, Option<String>>(6)?,
                session_id: row.get::<_, Option<String>>(7)?,
                created_at: row.get(8)?,
                embedding: None,
                embedding_model: None,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(episodes)
}

// ─── Contradiction Operations ──────────────────────────────────────────

#[derive(serde::Serialize, Clone, Debug)]
pub struct Contradiction {
    pub id: String,
    pub existing_episode_id: String,
    pub existing_content: String,
    pub new_evidence_content: String,
    pub status: String,
    pub pressure_score: i64,
    pub created_at: String,
}

pub fn store_contradiction(
    existing_episode_id: &str,
    existing_content: &str,
    new_evidence_content: &str,
    new_evidence_episode_id: Option<&str>,
    importance: f64,
) -> Result<String, String> {
    let conn = get_db().map_err(|e| e.to_string())?;

    let existing_id: Option<String> = conn
        .query_row(
            "SELECT id FROM contradictions WHERE existing_episode_id = ?1 AND status = 'contested' LIMIT 1",
            [existing_episode_id],
            |row| row.get(0),
        )
        .ok();

    if let Some(id) = existing_id {
        conn.execute(
            "UPDATE contradictions SET pressure_score = pressure_score + 1, new_evidence_content = ?1, new_evidence_episode_id = ?2 WHERE id = ?3",
            [
                new_evidence_content,
                new_evidence_episode_id.unwrap_or(""),
                &id,
            ],
        ).map_err(|e| e.to_string())?;
        return Ok(id);
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO contradictions (id, existing_episode_id, existing_content, new_evidence_content, new_evidence_episode_id, status, pressure_score, importance, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'contested', 1, ?6, ?7)",
        [
            &id,
            existing_episode_id,
            existing_content,
            new_evidence_content,
            new_evidence_episode_id.unwrap_or(""),
            &importance.to_string(),
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(id)
}

#[allow(dead_code)]
pub fn increment_contradiction_pressure(contradiction_id: &str) -> Result<(), String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE contradictions SET pressure_score = pressure_score + 1 WHERE id = ?1",
        [contradiction_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_active_contradictions(limit: i64) -> Result<Vec<Contradiction>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, existing_episode_id, existing_content, new_evidence_content, status, pressure_score, created_at
         FROM contradictions WHERE status = 'contested' ORDER BY pressure_score DESC LIMIT ?1"
    ).map_err(|e| e.to_string())?;

    let contradictions = stmt
        .query_map([&limit.to_string()], |row| {
            Ok(Contradiction {
                id: row.get(0)?,
                existing_episode_id: row.get(1)?,
                existing_content: row.get(2)?,
                new_evidence_content: row.get(3)?,
                status: row.get(4)?,
                pressure_score: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(contradictions)
}

pub fn load_all_contradictions(limit: i64) -> Result<Vec<Contradiction>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, existing_episode_id, existing_content, new_evidence_content, status, pressure_score, created_at
         FROM contradictions ORDER BY created_at DESC LIMIT ?1"
    ).map_err(|e| e.to_string())?;

    let contradictions = stmt
        .query_map([&limit.to_string()], |row| {
            Ok(Contradiction {
                id: row.get(0)?,
                existing_episode_id: row.get(1)?,
                existing_content: row.get(2)?,
                new_evidence_content: row.get(3)?,
                status: row.get(4)?,
                pressure_score: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(contradictions)
}

pub fn get_contradiction(id: &str) -> Result<Option<Contradiction>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, existing_episode_id, existing_content, new_evidence_content, status, pressure_score, created_at
         FROM contradictions WHERE id = ?1 LIMIT 1"
    ).map_err(|e| e.to_string())?;

    let item = stmt
        .query_map([id], |row| {
            Ok(Contradiction {
                id: row.get(0)?,
                existing_episode_id: row.get(1)?,
                existing_content: row.get(2)?,
                new_evidence_content: row.get(3)?,
                status: row.get(4)?,
                pressure_score: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .next();

    Ok(item)
}

pub fn resolve_contradiction(id: &str) -> Result<(), String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE contradictions SET status = 'resolved', resolved_at = ?1 WHERE id = ?2",
        [&now, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_episode(id: &str) -> Result<(), String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM episodes WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Lower an episode's importance so it rarely surfaces in searches.
/// Used when a contradiction is resolved in favor of newer evidence.
pub fn deprecate_episode(id: &str) -> Result<(), String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE episodes SET importance = MIN(importance, 0.2) WHERE id = ?1",
        [id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Event Operations ──────────────────────────────────────────────────

#[derive(serde::Serialize, Clone, Debug)]
pub struct Event {
    pub id: String,
    pub turn_index: i64,
    pub session_id: String,
    pub user_message: Option<String>,
    pub assistant_message: Option<String>,
    pub semantic_shift_detected: bool,
    pub created_at: String,
}

pub fn store_event(
    turn_index: i64,
    session_id: &str,
    user_message: Option<&str>,
    assistant_message: Option<&str>,
    semantic_shift: bool,
) -> Result<String, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO events (id, turn_index, session_id, user_message, assistant_message, semantic_shift_detected, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        [
            &id,
            &turn_index.to_string(),
            session_id,
            user_message.unwrap_or(""),
            assistant_message.unwrap_or(""),
            &(if semantic_shift { 1 } else { 0 }).to_string(),
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(id)
}

pub fn load_recent_events(limit: i64) -> Result<Vec<Event>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, turn_index, session_id, user_message, assistant_message, semantic_shift_detected, created_at
         FROM events ORDER BY created_at DESC LIMIT ?1"
    ).map_err(|e| e.to_string())?;

    let events = stmt
        .query_map([&limit.to_string()], |row| {
            let shift_i64: i64 = row.get(5)?;
            Ok(Event {
                id: row.get(0)?,
                turn_index: row.get(1)?,
                session_id: row.get(2)?,
                user_message: row.get::<_, Option<String>>(3)?,
                assistant_message: row.get::<_, Option<String>>(4)?,
                semantic_shift_detected: shift_i64 != 0,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(events)
}

// ─── Episode Helpers ───────────────────────────────────────────────────

pub fn load_recent_episodes(limit: i64) -> Result<Vec<Episode>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, content, type, confidence, importance, compression_level, schema_section, session_id, created_at
         FROM episodes ORDER BY created_at DESC LIMIT ?1"
    ).map_err(|e| e.to_string())?;

    let episodes = stmt
        .query_map([&limit.to_string()], |row| {
            Ok(Episode {
                id: row.get(0)?,
                content: row.get(1)?,
                type_: row.get(2)?,
                confidence: row.get(3)?,
                importance: row.get(4)?,
                compression_level: row.get(5)?,
                schema_section: row.get::<_, Option<String>>(6)?,
                session_id: row.get::<_, Option<String>>(7)?,
                created_at: row.get(8)?,
                embedding: None,
                embedding_model: None,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(episodes)
}

pub fn count_all_episodes() -> Result<i64, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM episodes", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    Ok(count)
}

/// Load a single episode by ID.
pub fn get_episode(id: &str) -> Result<Option<Episode>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, content, type, confidence, importance, compression_level, schema_section, session_id, created_at
         FROM episodes WHERE id = ?1 LIMIT 1"
    ).map_err(|e| e.to_string())?;

    let episode = stmt
        .query_map([id], |row| {
            Ok(Episode {
                id: row.get(0)?,
                content: row.get(1)?,
                type_: row.get(2)?,
                confidence: row.get(3)?,
                importance: row.get(4)?,
                compression_level: row.get(5)?,
                schema_section: row.get::<_, Option<String>>(6)?,
                session_id: row.get::<_, Option<String>>(7)?,
                created_at: row.get(8)?,
                embedding: None,
                embedding_model: None,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .next();

    Ok(episode)
}

// ─── Learn Queue Operations ────────────────────────────────────────────

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct LearnQueueItem {
    pub id: String,
    pub type_: String,
    pub question: String,
    pub context: Option<String>,
    pub source_id: Option<String>,
    pub status: String,
    pub answer: Option<String>,
    pub created_at: String,
    pub addressed_at: Option<String>,
}

pub fn store_learn_item(
    type_: &str,
    question: &str,
    context: Option<&str>,
    source_id: Option<&str>,
) -> Result<String, String> {
    let conn = get_db().map_err(|e| e.to_string())?;

    // Deduplicate: skip if pending item with same source_id already exists
    if let Some(src) = source_id {
        let existing: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM learn_queue WHERE source_id = ?1 AND status = 'pending'",
                [src],
                |row| row.get(0),
            )
            .unwrap_or(0);
        if existing > 0 {
            return Ok(String::new()); // silently skip duplicate
        }
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO learn_queue (id, type, question, context, source_id, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6)",
        [
            &id,
            type_,
            question,
            context.unwrap_or(""),
            source_id.unwrap_or(""),
            &now,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(id)
}

pub fn load_pending_learn_items(limit: i64) -> Result<Vec<LearnQueueItem>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, type, question, context, source_id, status, answer, created_at, addressed_at
         FROM learn_queue
         WHERE status = 'pending'
         ORDER BY
             CASE type WHEN 'contradiction' THEN 0 WHEN 'gap' THEN 1 ELSE 2 END ASC,
             created_at DESC
         LIMIT ?1"
    ).map_err(|e| e.to_string())?;

    let items = stmt
        .query_map([&limit.to_string()], |row| {
            Ok(LearnQueueItem {
                id: row.get(0)?,
                type_: row.get(1)?,
                question: row.get(2)?,
                context: row.get::<_, Option<String>>(3)?,
                source_id: row.get::<_, Option<String>>(4)?,
                status: row.get(5)?,
                answer: row.get::<_, Option<String>>(6)?,
                created_at: row.get(7)?,
                addressed_at: row.get::<_, Option<String>>(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(items)
}

pub fn get_learn_item(id: &str) -> Result<Option<LearnQueueItem>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, type, question, context, source_id, status, answer, created_at, addressed_at
         FROM learn_queue WHERE id = ?1 LIMIT 1"
    ).map_err(|e| e.to_string())?;

    let item = stmt
        .query_map([id], |row| {
            Ok(LearnQueueItem {
                id: row.get(0)?,
                type_: row.get(1)?,
                question: row.get(2)?,
                context: row.get::<_, Option<String>>(3)?,
                source_id: row.get::<_, Option<String>>(4)?,
                status: row.get(5)?,
                answer: row.get::<_, Option<String>>(6)?,
                created_at: row.get(7)?,
                addressed_at: row.get::<_, Option<String>>(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .next();

    Ok(item)
}

pub fn count_pending_learn_items() -> Result<i64, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM learn_queue WHERE status = 'pending'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(count)
}

pub fn mark_learn_item_addressed(id: &str, answer: Option<&str>) -> Result<(), String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE learn_queue SET status = 'addressed', answer = ?1, addressed_at = ?2 WHERE id = ?3",
        [answer.unwrap_or(""), &now, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn dismiss_learn_item(id: &str) -> Result<(), String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE learn_queue SET status = 'dismissed' WHERE id = ?1",
        [id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn snooze_learn_item(id: &str) -> Result<(), String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE learn_queue SET status = 'snoozed' WHERE id = ?1",
        [id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Entity Graph Operations ───────────────────────────────────────────

#[derive(serde::Serialize, Clone, Debug)]
pub struct Entity {
    pub id: String,
    pub name: String,
    pub type_: String,
    pub canonical_name: Option<String>,
    pub first_seen: String,
    pub mention_count: i64,
}

/// Store a new entity or update mention count if it already exists.
pub fn store_entity(name: &str, type_: &str, canonical_name: Option<&str>) -> Result<String, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    // Check if entity already exists
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM entities WHERE name = ?1 AND type = ?2 LIMIT 1",
            [name, type_],
            |row| row.get(0),
        )
        .ok();

    if let Some(id) = existing {
        conn.execute(
            "UPDATE entities SET mention_count = mention_count + 1, first_seen = ?1 WHERE id = ?2",
            [&now, &id],
        ).map_err(|e| e.to_string())?;
        return Ok(id);
    }

    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO entities (id, name, type, canonical_name, first_seen, mention_count) VALUES (?1, ?2, ?3, ?4, ?5, 1)",
        rusqlite::params![&id, name, type_, canonical_name.unwrap_or(name), &now],
    ).map_err(|e| e.to_string())?;

    Ok(id)
}

/// Link an episode to an entity.
pub fn link_episode_entity(
    episode_id: &str,
    entity_id: &str,
    role: &str,
    is_resolved: bool,
) -> Result<(), String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO episode_entities (episode_id, entity_id, role, is_resolved) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![episode_id, entity_id, role, if is_resolved { 1 } else { 0 }],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

/// Store an edge between two episodes (e.g., progression, association, contradiction).
pub fn store_episode_edge(
    from_episode_id: &str,
    to_episode_id: &str,
    edge_type: &str,
    weight: f64,
    session_id: Option<&str>,
) -> Result<(), String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT OR REPLACE INTO episode_edges (from_episode_id, to_episode_id, edge_type, weight, session_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![from_episode_id, to_episode_id, edge_type, weight, session_id.unwrap_or(""), &now],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

/// Find all episodes linked to a given entity.
pub fn get_episodes_for_entity(entity_id: &str, limit: i64) -> Result<Vec<Episode>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT e.id, e.content, e.type, e.confidence, e.importance, e.compression_level, e.schema_section, e.session_id, e.created_at
         FROM episodes e
         JOIN episode_entities ee ON e.id = ee.episode_id
         WHERE ee.entity_id = ?1
         ORDER BY e.created_at DESC
         LIMIT ?2"
    ).map_err(|e| e.to_string())?;

    let episodes = stmt
        .query_map(rusqlite::params![entity_id, limit], |row| {
            Ok(Episode {
                id: row.get(0)?,
                content: row.get(1)?,
                type_: row.get(2)?,
                confidence: row.get(3)?,
                importance: row.get(4)?,
                compression_level: row.get(5)?,
                schema_section: row.get::<_, Option<String>>(6)?,
                session_id: row.get::<_, Option<String>>(7)?,
                created_at: row.get(8)?,
                embedding: None,
                embedding_model: None,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(episodes)
}

#[allow(dead_code)]
/// Find entities mentioned in an episode.
pub fn get_entities_for_episode(episode_id: &str) -> Result<Vec<Entity>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT ent.id, ent.name, ent.type, ent.canonical_name, ent.first_seen, ent.mention_count
         FROM entities ent
         JOIN episode_entities ee ON ent.id = ee.entity_id
         WHERE ee.episode_id = ?1
         ORDER BY ent.mention_count DESC"
    ).map_err(|e| e.to_string())?;

    let entities = stmt
        .query_map([episode_id], |row| {
            Ok(Entity {
                id: row.get(0)?,
                name: row.get(1)?,
                type_: row.get(2)?,
                canonical_name: row.get::<_, Option<String>>(3)?,
                first_seen: row.get(4)?,
                mention_count: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(entities)
}

/// Find entities by name (partial match).
pub fn search_entities(query: &str, limit: i64) -> Result<Vec<Entity>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT id, name, type, canonical_name, first_seen, mention_count
         FROM entities
         WHERE name LIKE ?1 OR canonical_name LIKE ?1
         ORDER BY mention_count DESC
         LIMIT ?2"
    ).map_err(|e| e.to_string())?;

    let entities = stmt
        .query_map(rusqlite::params![&pattern, limit.to_string()], |row| {
            Ok(Entity {
                id: row.get(0)?,
                name: row.get(1)?,
                type_: row.get(2)?,
                canonical_name: row.get::<_, Option<String>>(3)?,
                first_seen: row.get(4)?,
                mention_count: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(entities)
}

/// Find related episodes by following episode edges.
pub fn get_related_episodes(
    episode_id: &str,
    edge_type: Option<&str>,
    limit: i64,
) -> Result<Vec<Episode>, String> {
    let conn = get_db().map_err(|e| e.to_string())?;

    let sql = if let Some(et) = edge_type {
        format!(
            "SELECT e.id, e.content, e.type, e.confidence, e.importance, e.compression_level, e.schema_section, e.session_id, e.created_at
             FROM episodes e
             JOIN episode_edges edge ON (e.id = edge.to_episode_id OR e.id = edge.from_episode_id)
             WHERE (edge.from_episode_id = '{}' OR edge.to_episode_id = '{}')
               AND edge.edge_type = '{}'
               AND e.id != '{}'
             ORDER BY edge.weight DESC
             LIMIT ?1",
            episode_id.replace("'", "''"),
            episode_id.replace("'", "''"),
            et.replace("'", "''"),
            episode_id.replace("'", "''")
        )
    } else {
        format!(
            "SELECT e.id, e.content, e.type, e.confidence, e.importance, e.compression_level, e.schema_section, e.session_id, e.created_at
             FROM episodes e
             JOIN episode_edges edge ON (e.id = edge.to_episode_id OR e.id = edge.from_episode_id)
             WHERE (edge.from_episode_id = '{}' OR edge.to_episode_id = '{}')
               AND e.id != '{}'
             ORDER BY edge.weight DESC
             LIMIT ?1",
            episode_id.replace("'", "''"),
            episode_id.replace("'", "''"),
            episode_id.replace("'", "''")
        )
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let episodes = stmt
        .query_map([&limit.to_string()], |row| {
            Ok(Episode {
                id: row.get(0)?,
                content: row.get(1)?,
                type_: row.get(2)?,
                confidence: row.get(3)?,
                importance: row.get(4)?,
                compression_level: row.get(5)?,
                schema_section: row.get::<_, Option<String>>(6)?,
                session_id: row.get::<_, Option<String>>(7)?,
                created_at: row.get(8)?,
                embedding: None,
                embedding_model: None,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(episodes)
}
