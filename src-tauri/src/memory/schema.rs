use rusqlite::{Connection, Result as SqliteResult};

/// Initialize the complete memory database schema.
/// Creates all 7 capacity tables + the life document table.
pub fn init_schema(conn: &Connection) -> SqliteResult<()> {
    // Enable vector search extension if available
    let _ = conn.execute_batch("SELECT load_extension('sqlite_vec');");

    // 1. ENTITIES: Who/what exists in the user's world
    conn.execute(
        "CREATE TABLE IF NOT EXISTS entities (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            first_seen TEXT NOT NULL,
            last_seen TEXT NOT NULL,
            mention_count INTEGER DEFAULT 1,
            profile TEXT NOT NULL DEFAULT '{}'
        )",
        [],
    )?;

    // Entity embeddings — stored as BLOBs, searched via brute-force cosine similarity in Rust
    conn.execute(
        "CREATE TABLE IF NOT EXISTS entity_embeddings (
            entity_id TEXT PRIMARY KEY REFERENCES entities(id),
            embedding BLOB NOT NULL
        )",
        [],
    )?;

    // 2. RELATIONSHIPS: How entities connect and interact
    conn.execute(
        "CREATE TABLE IF NOT EXISTS relationships (
            id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL REFERENCES entities(id),
            target_id TEXT NOT NULL REFERENCES entities(id),
            relation_type TEXT NOT NULL,
            dynamics TEXT,
            strength REAL DEFAULT 0.5,
            first_observed TEXT NOT NULL,
            last_observed TEXT NOT NULL,
            evidence_count INTEGER DEFAULT 1,
            UNIQUE(source_id, target_id, relation_type)
        )",
        [],
    )?;

    // 3. HISTORY: Events in sequence
    conn.execute(
        "CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            description TEXT NOT NULL,
            entities_involved TEXT NOT NULL DEFAULT '[]',
            emotional_valence TEXT DEFAULT 'neutral',
            outcome TEXT,
            linked_memory_ids TEXT DEFAULT '[]',
            turn_id TEXT
        )",
        [],
    )?;

    // History embeddings — stored as BLOBs, searched via brute-force cosine similarity in Rust
    conn.execute(
        "CREATE TABLE IF NOT EXISTS history_embeddings (
            history_id TEXT PRIMARY KEY REFERENCES history(id),
            embedding BLOB NOT NULL
        )",
        [],
    )?;

    // 4. CONSTRAINTS: Hard limits
    conn.execute(
        "CREATE TABLE IF NOT EXISTS constraints (
            id TEXT PRIMARY KEY,
            entity_id TEXT REFERENCES entities(id),
            constraint_type TEXT NOT NULL,
            description TEXT NOT NULL,
            severity TEXT NOT NULL DEFAULT 'soft',
            first_stated TEXT NOT NULL,
            last_confirmed TEXT NOT NULL
        )",
        [],
    )?;

    // 5. STATES: Emotional and situational snapshots
    conn.execute(
        "CREATE TABLE IF NOT EXISTS states (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            mood TEXT,
            stress_level INTEGER CHECK(stress_level BETWEEN 1 AND 10),
            energy_level INTEGER CHECK(energy_level BETWEEN 1 AND 10),
            top_concerns TEXT DEFAULT '[]',
            inferred_needs TEXT DEFAULT '[]',
            evidence TEXT,
            turn_id TEXT
        )",
        [],
    )?;

    // 6. GOALS: What they want (stated and inferred)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS goals (
            id TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            stated_or_inferred TEXT NOT NULL DEFAULT 'inferred',
            status TEXT NOT NULL DEFAULT 'active',
            priority INTEGER DEFAULT 5,
            related_entity_ids TEXT DEFAULT '[]',
            open_loops TEXT DEFAULT '[]',
            created_at TEXT NOT NULL,
            last_updated TEXT NOT NULL
        )",
        [],
    )?;

    // 7. PATTERNS: Recurring behaviors and cycles
    conn.execute(
        "CREATE TABLE IF NOT EXISTS patterns (
            id TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            pattern_type TEXT NOT NULL,
            confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 1),
            corroborating_evidence TEXT DEFAULT '[]',
            first_observed TEXT NOT NULL,
            last_observed TEXT NOT NULL,
            trigger_conditions TEXT,
            typical_outcome TEXT
        )",
        [],
    )?;

    // Master Life Document (compiled by Sigma)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS life_document (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            document TEXT NOT NULL DEFAULT '{}',
            last_compiled TEXT NOT NULL DEFAULT '',
            version INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )?;

    // Raw memory queue (unprocessed extractions)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS memory_queue (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            turn_id TEXT NOT NULL,
            raw_content TEXT NOT NULL,
            extracted_json TEXT,
            processed INTEGER NOT NULL DEFAULT 0,
            agent TEXT NOT NULL DEFAULT 'unknown'
        )",
        [],
    )?;

    // Embedding job queue (async processing)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS embedding_queue (
            id TEXT PRIMARY KEY,
            target_table TEXT NOT NULL,
            target_id TEXT NOT NULL,
            text_to_embed TEXT NOT NULL,
            attempts INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )",
        [],
    )?;

    // Indexes for fast lookup
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_states_timestamp ON states(timestamp)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_memory_queue_turn ON memory_queue(turn_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_memory_queue_processed ON memory_queue(processed)",
        [],
    )?;

    Ok(())
}

use std::sync::OnceLock;
use r2d2_sqlite::SqliteConnectionManager;

static DB_POOL: OnceLock<r2d2::Pool<SqliteConnectionManager>> = OnceLock::new();

/// Initialize the connection pool.
fn init_pool() -> r2d2::Pool<SqliteConnectionManager> {
    let db_path = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Orkestrate")
        .join("memory.db");

    if let Some(parent) = db_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let manager = SqliteConnectionManager::file(&db_path);
    let pool = r2d2::Pool::builder()
        .max_size(10)
        .build(manager)
        .expect("Failed to create SQLite connection pool");

    // Initialize schema on first connection
    let conn = pool.get().expect("Failed to get connection from pool");
    init_schema(&conn).expect("Failed to initialize schema");

    pool
}

/// Get a connection from the pool.
pub fn get_db() -> SqliteResult<r2d2::PooledConnection<SqliteConnectionManager>> {
    let pool = DB_POOL.get_or_init(init_pool);
    pool.get().map_err(|e| rusqlite::Error::SqliteFailure(
        rusqlite::ffi::Error::new(1),
        Some(format!("pool error: {}", e)),
    ))
}
