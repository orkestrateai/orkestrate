use crate::pscm::db::PscmDb;
use hnsw_rs::hnsw::Hnsw;
use hnsw_rs::anndists::dist::distances::DistCosine;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tantivy::schema::{Schema, TEXT, STORED, FAST, Field, Value};
use tantivy::{Index, IndexWriter, doc, TantivyDocument, query::QueryParser, collector::TopDocs};
use tantivy::schema::STRING;

pub struct MemoryIndex {
    pub hnsw: Arc<Mutex<Hnsw<'static, f32, DistCosine>>>,
    pub hnsw_id_map: Arc<Mutex<HashMap<String, usize>>>,
    pub next_hnsw_id: Arc<Mutex<usize>>,
    pub tantivy_index: Index,
    pub tantivy_writer: Arc<Mutex<IndexWriter>>,
    pub schema: IndexSchema,
}

pub struct IndexSchema {
    pub trace_id: Field,
    pub raw_text: Field,
    pub timestamp: Field,
}

impl MemoryIndex {
    pub fn new(_db: &PscmDb) -> Result<Self, String> {
        // ─── HNSW for vector search ────────────────────────────────────────
        let hnsw = Hnsw::new(
            16,         // max_nb_conn
            10_000,     // max_elements
            10,         // max_layer
            200,        // ef_construction
            DistCosine,
        );

        // ─── Tantivy for BM25 lexical search ───────────────────────────────
        let mut schema_builder = Schema::builder();
        let trace_id = schema_builder.add_text_field("trace_id", STRING | STORED);
        let raw_text = schema_builder.add_text_field("raw_text", TEXT | STORED);
        let timestamp = schema_builder.add_date_field("timestamp", FAST);
        let schema = schema_builder.build();

        let index_path = dirs::data_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("Orkestrate")
            .join("tantivy_index");

        let _ = std::fs::create_dir_all(&index_path);

        // Open existing index if possible, otherwise create new
        let tantivy_index = if index_path.join("meta.json").exists() {
            Index::open_in_dir(&index_path).map_err(|e| format!("Failed to open Tantivy index: {}", e))?
        } else {
            Index::create_in_dir(&index_path, schema.clone())
                .map_err(|e| format!("Failed to create Tantivy index: {}", e))?
        };

        let tantivy_writer = Arc::new(Mutex::new(
            tantivy_index.writer(50_000_000).map_err(|e| e.to_string())?
        ));

        Ok(Self {
            hnsw: Arc::new(Mutex::new(hnsw)),
            hnsw_id_map: Arc::new(Mutex::new(HashMap::new())),
            next_hnsw_id: Arc::new(Mutex::new(0)),
            tantivy_index,
            tantivy_writer,
            schema: IndexSchema { trace_id, raw_text, timestamp },
        })
    }

    pub fn add_trace(&self, trace_id: &str, text: &str, embedding: &[f32]) -> Result<(), String> {
        // Add to HNSW (needs numeric ID)
        {
            let hnsw = self.hnsw.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
            let mut id_map = self.hnsw_id_map.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
            let mut next_id = self.next_hnsw_id.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
            
            let numeric_id = *next_id;
            *next_id += 1;
            id_map.insert(trace_id.to_string(), numeric_id);
            
            hnsw.insert_slice((embedding, numeric_id));
        }

        // Add to Tantivy
        {
            let writer = self.tantivy_writer.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
            writer.add_document(doc!(
                self.schema.trace_id => trace_id,
                self.schema.raw_text => text,
                self.schema.timestamp => tantivy::DateTime::from_timestamp_secs(
                    chrono::Utc::now().timestamp()
                ),
            )).map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    pub fn commit(&self) -> Result<(), String> {
        #[allow(unused_mut)]
        let mut writer = self.tantivy_writer.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
        writer.commit().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn search_vector(&self, query_embedding: &[f32], k: usize) -> Vec<(String, f32)> {
        let hnsw = self.hnsw.lock().unwrap();
        let id_map = self.hnsw_id_map.lock().unwrap();
        let results = hnsw.search(query_embedding, k, 50);
        
        // Reverse map: numeric_id -> trace_id
        let reverse_map: HashMap<usize, String> = id_map.iter()
            .map(|(k, v)| (*v, k.clone()))
            .collect();
        
        results
            .into_iter()
            .filter_map(|n| {
                reverse_map.get(&(n.d_id as usize))
                    .map(|trace_id| (trace_id.clone(), n.distance))
            })
            .collect()
    }

    pub fn search_bm25(&self, query: &str, k: usize) -> Result<Vec<(String, f32)>, String> {
        let reader = self.tantivy_index.reader().map_err(|e| e.to_string())?;
        let searcher = reader.searcher();

        // Escape special characters for Tantivy query parser
        let escaped_query = query.replace('"', "\\\"").replace('\'', "\\'");
        
        let query_parser = QueryParser::for_index(&self.tantivy_index, vec![self.schema.raw_text]);
        let q = match query_parser.parse_query(&escaped_query) {
            Ok(q) => q,
            Err(e) => {
                // Fallback: search for each word individually
                let safe_query = query.split_whitespace()
                    .map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()))
                    .filter(|w| !w.is_empty())
                    .collect::<Vec<_>>()
                    .join(" OR ");
                query_parser.parse_query(&safe_query)
                    .map_err(|e2| format!("Tantivy query parse error: {} (fallback also failed: {})", e, e2))?
            }
        };

        // TopDocs::with_limit(k).order_by_score() returns impl Collector
        let top_docs = searcher.search(&q, &TopDocs::with_limit(k).order_by_score())
            .map_err(|e| e.to_string())?;

        let mut results = Vec::new();
        for (score, doc_address) in top_docs {
            let doc: TantivyDocument = searcher.doc(doc_address).map_err(|e| e.to_string())?;
            if let Some(trace_id_value) = doc.get_first(self.schema.trace_id) {
                let trace_id: Option<&str> = trace_id_value.as_str();
                if let Some(id) = trace_id {
                    results.push((id.to_string(), score));
                }
            }
        }
        Ok(results)
    }
}


