use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::{Connection, Result as SqliteResult};
use std::sync::OnceLock;

// use crate::timer::Timer;

static DB_POOL: OnceLock<r2d2::Pool<SqliteConnectionManager>> = OnceLock::new();

fn init_pool() -> r2d2::Pool<SqliteConnectionManager> {
    let db_path = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Orkestrate")
        .join("orkestrate_v2.db");

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
    // ─── Immutable Episodic Traces ─────────────────────────────────────────
    conn.execute(
        "CREATE TABLE IF NOT EXISTS traces (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            turn_index INTEGER NOT NULL,
            raw_text TEXT NOT NULL,
            role TEXT NOT NULL,
            valence REAL DEFAULT 0.0,
            topic_drift BOOLEAN DEFAULT 0,
            timestamp TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_traces_session_time ON traces(session_id, timestamp DESC)",
        [],
    )?;

    // ─── Personal Concept Lexicon ──────────────────────────────────────────
    conn.execute(
        "CREATE TABLE IF NOT EXISTS concepts (
            id TEXT PRIMARY KEY,
            canonical_name TEXT NOT NULL,
            node_type TEXT CHECK(node_type IN ('entity', 'sense')) NOT NULL,
            embedding BLOB,
            first_seen TEXT NOT NULL,
            last_activated TEXT NOT NULL,
            access_count INTEGER DEFAULT 0
        )",
        [],
    )?;

    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_concepts_name ON concepts(canonical_name)",
        [],
    )?;

    // ─── Concept Edges (Causal / Semantic) ─────────────────────────────────
    conn.execute(
        "CREATE TABLE IF NOT EXISTS concept_edges (
            from_id TEXT NOT NULL,
            to_id TEXT NOT NULL,
            edge_type TEXT CHECK(edge_type IN ('ALIASES','SLANG_FOR','STATE_OF','CAUSED_BY','FOLLOWS','ENABLES','CO_OCCURS')) NOT NULL,
            weight REAL DEFAULT 1.0,
            valid_from TEXT NOT NULL,
            valid_until TEXT,
            confidence REAL DEFAULT 1.0,
            PRIMARY KEY (from_id, to_id, edge_type)
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_edges_from ON concept_edges(from_id)",
        [],
    )?;

    // ─── Trace-to-Concept Links ────────────────────────────────────────────
    conn.execute(
        "CREATE TABLE IF NOT EXISTS trace_concepts (
            trace_id TEXT NOT NULL,
            concept_id TEXT NOT NULL,
            role TEXT DEFAULT 'mentioned',
            PRIMARY KEY (trace_id, concept_id)
        )",
        [],
    )?;

    // ─── Reasoning Patterns (ReasoningBank) ────────────────────────────────
    conn.execute(
        "CREATE TABLE IF NOT EXISTS reasoning_patterns (
            id TEXT PRIMARY KEY,
            pattern_text TEXT NOT NULL,
            success_count INTEGER DEFAULT 0,
            failure_count INTEGER DEFAULT 0,
            derived_from_trace_id TEXT,
            created_at TEXT NOT NULL
        )",
        [],
    )?;

    // ─── Embedding Provider Preference ─────────────────────────────────────
    conn.execute(
        "CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    Ok(())
}

pub struct PscmDb;

impl PscmDb {
    pub fn new() -> Result<Self, String> {
        let _ = DB_POOL.get_or_init(init_pool);
        Ok(Self)
    }

    pub fn conn(&self) -> Result<r2d2::PooledConnection<SqliteConnectionManager>, String> {
        DB_POOL
            .get()
            .ok_or("DB pool not initialized")?
            .get()
            .map_err(|e| e.to_string())
    }
}

// ─── Trace Operations ────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct Trace {
    pub id: String,
    pub session_id: String,
    pub turn_index: i64,
    pub raw_text: String,
    pub role: String,
    pub valence: f64,
    pub topic_drift: bool,
    pub timestamp: String,
}

impl PscmDb {
    pub fn store_trace(
        &self,
        id: &str,
        session_id: &str,
        turn_index: i64,
        raw_text: &str,
        role: &str,
        valence: f64,
        topic_drift: bool,
        timestamp: &str,
    ) -> Result<(), String> {
        let conn = self.conn()?;
        conn.execute(
            "INSERT INTO traces (id, session_id, turn_index, raw_text, role, valence, topic_drift, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![id, session_id, turn_index, raw_text, role, valence, topic_drift, timestamp],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn load_recent_traces(&self, limit: i64) -> Result<Vec<Trace>, String> {
        let conn = self.conn()?;
        let mut stmt = conn
            .prepare("SELECT id, session_id, turn_index, raw_text, role, valence, topic_drift, timestamp FROM traces ORDER BY timestamp DESC LIMIT ?1")
            .map_err(|e| e.to_string())?;
        let traces = stmt
            .query_map([limit], |row| {
                Ok(Trace {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    turn_index: row.get(2)?,
                    raw_text: row.get(3)?,
                    role: row.get(4)?,
                    valence: row.get(5)?,
                    topic_drift: row.get(6)?,
                    timestamp: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(traces)
    }

    pub fn load_trace_by_id(&self, id: &str) -> Result<Option<Trace>, String> {
        let conn = self.conn()?;
        let mut stmt = conn
            .prepare("SELECT id, session_id, turn_index, raw_text, role, valence, topic_drift, timestamp FROM traces WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        let mut iter = stmt
            .query_map([id], |row| {
                Ok(Trace {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    turn_index: row.get(2)?,
                    raw_text: row.get(3)?,
                    role: row.get(4)?,
                    valence: row.get(5)?,
                    topic_drift: row.get(6)?,
                    timestamp: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?;
        Ok(iter.next().transpose().map_err(|e| e.to_string())?)
    }
}

// ─── Concept Operations ──────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct Concept {
    pub id: String,
    pub canonical_name: String,
    pub node_type: String,
    pub _embedding: Option<Vec<u8>>,
    pub _first_seen: String,
    pub _last_activated: String,
    pub access_count: i64,
}

impl PscmDb {
    pub fn upsert_concept(
        &self,
        id: &str,
        canonical_name: &str,
        node_type: &str,
        embedding: Option<&[u8]>,
        timestamp: &str,
    ) -> Result<(), String> {
        let conn = self.conn()?;
        conn.execute(
            "INSERT INTO concepts (id, canonical_name, node_type, embedding, first_seen, last_activated, access_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)
             ON CONFLICT(id) DO UPDATE SET
                last_activated = excluded.last_activated,
                access_count = access_count + 1,
                embedding = COALESCE(excluded.embedding, concepts.embedding)",
            rusqlite::params![id, canonical_name, node_type, embedding, timestamp, timestamp],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn load_concepts(&self) -> Result<Vec<Concept>, String> {
        let conn = self.conn()?;
        let mut stmt = conn
            .prepare("SELECT id, canonical_name, node_type, embedding, first_seen, last_activated, access_count FROM concepts")
            .map_err(|e| e.to_string())?;
        let concepts = stmt
            .query_map([], |row| {
                Ok(Concept {
                    id: row.get(0)?,
                    canonical_name: row.get(1)?,
                    node_type: row.get(2)?,
                    _embedding: row.get(3)?,
                    _first_seen: row.get(4)?,
                    _last_activated: row.get(5)?,
                    access_count: row.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(concepts)
    }
}

// ─── Edge Operations ─────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ConceptEdge {
    pub from_id: String,
    pub to_id: String,
    pub edge_type: String,
    pub weight: f64,
    pub valid_from: String,
    pub valid_until: Option<String>,
    pub confidence: f64,
}

impl PscmDb {
    pub fn upsert_edge(
        &self,
        from_id: &str,
        to_id: &str,
        edge_type: &str,
        weight: f64,
        valid_from: &str,
        valid_until: Option<&str>,
        confidence: f64,
    ) -> Result<(), String> {
        let conn = self.conn()?;
        conn.execute(
            "INSERT INTO concept_edges (from_id, to_id, edge_type, weight, valid_from, valid_until, confidence)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(from_id, to_id, edge_type) DO UPDATE SET
                weight = excluded.weight,
                valid_from = excluded.valid_from,
                valid_until = excluded.valid_until,
                confidence = excluded.confidence",
            rusqlite::params![from_id, to_id, edge_type, weight, valid_from, valid_until, confidence],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn load_edges(&self) -> Result<Vec<ConceptEdge>, String> {
        let conn = self.conn()?;
        let mut stmt = conn
            .prepare("SELECT from_id, to_id, edge_type, weight, valid_from, valid_until, confidence FROM concept_edges")
            .map_err(|e| e.to_string())?;
        let edges = stmt
            .query_map([], |row| {
                Ok(ConceptEdge {
                    from_id: row.get(0)?,
                    to_id: row.get(1)?,
                    edge_type: row.get(2)?,
                    weight: row.get(3)?,
                    valid_from: row.get(4)?,
                    valid_until: row.get(5)?,
                    confidence: row.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(edges)
    }

    pub fn delete_edge(&self, from_id: &str, to_id: &str, edge_type: &str) -> Result<(), String> {
        let conn = self.conn()?;
        conn.execute(
            "DELETE FROM concept_edges WHERE from_id = ?1 AND to_id = ?2 AND edge_type = ?3",
            rusqlite::params![from_id, to_id, edge_type],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }
}

// ─── Trace-Concept Link Operations ───────────────────────────────────────

impl PscmDb {
    pub fn link_trace_concept(
        &self,
        trace_id: &str,
        concept_id: &str,
        role: &str,
    ) -> Result<(), String> {
        let conn = self.conn()?;
        conn.execute(
            "INSERT OR IGNORE INTO trace_concepts (trace_id, concept_id, role) VALUES (?1, ?2, ?3)",
            rusqlite::params![trace_id, concept_id, role],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }
}

// ─── Config Operations ───────────────────────────────────────────────────

impl PscmDb {
    pub fn set_config(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn()?;
        conn.execute(
            "INSERT INTO config (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rusqlite::params![key, value],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_config(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.conn()?;
        let mut stmt = conn
            .prepare("SELECT value FROM config WHERE key = ?1")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt.query([key]).map_err(|e| e.to_string())?;
        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            Ok(Some(row.get(0).map_err(|e| e.to_string())?))
        } else {
            Ok(None)
        }
    }
}
