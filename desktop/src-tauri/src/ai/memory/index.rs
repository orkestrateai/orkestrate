use std::collections::HashMap;
use crate::ai::memory::types::{PersonalEntry, SearchResult};

// ─── In-memory BM25 inverted index ────────────────────────────────────────

const K1: f64 = 1.2;
const B: f64 = 0.75;

pub struct SearchIndex {
    // term -> [(doc_idx, term_frequency)]
    inverted: HashMap<String, Vec<(usize, u32)>>,
    documents: Vec<IndexDoc>,
    // Average document length (in tokens)
    avg_doc_len: f64,
}

pub struct IndexDoc {
    pub id: String,
    pub title: String,
    pub content: String,
    title_tokens: Vec<String>,
    content_tokens: Vec<String>,
    pub people: Vec<String>,
    places: Vec<String>,
    pub topics: Vec<String>,
    pub doc_len: f64,
}

impl SearchIndex {
    pub fn new() -> Self {
        Self {
            inverted: HashMap::new(),
            documents: Vec::new(),
            avg_doc_len: 0.0,
        }
    }

    // ─── Tokenization ────────────────────────────────────────────────────

    fn tokenize(text: &str) -> Vec<String> {
        text.to_lowercase()
            .split(|c: char| !c.is_alphanumeric())
            .filter(|t| t.len() >= 2)
            .map(|t| t.to_string())
            .collect()
    }

    // ─── Index building ──────────────────────────────────────────────────

    pub fn clear(&mut self) {
        self.inverted.clear();
        self.documents.clear();
        self.avg_doc_len = 0.0;
    }

    pub fn add_document(&mut self, id: String, title: &str, content: &str, people: &[String], topics: &[String]) {
        let title_tokens = Self::tokenize(title);
        let content_tokens = Self::tokenize(content);
        let doc_len = (title_tokens.len() + content_tokens.len()) as f64;
        let idx = self.documents.len();

        // Add to inverted index (title tokens boosted by appearing in title field)
        let mut all_tokens: Vec<String> = title_tokens.iter()
            .chain(content_tokens.iter())
            .cloned()
            .collect();
        all_tokens.extend(people.iter().flat_map(|p| Self::tokenize(p)));
        all_tokens.extend(topics.iter().flat_map(|t| Self::tokenize(t)));

        let mut tf: HashMap<String, u32> = HashMap::new();
        for token in &all_tokens {
            let count = tf.entry(token.clone()).or_insert(0);
            *count += 1;
        }

        for (term, freq) in tf {
            self.inverted.entry(term).or_default().push((idx, freq));
        }

        self.documents.push(IndexDoc {
            id,
            title: title.to_string(),
            content: content.to_string(),
            title_tokens,
            content_tokens,
            people: people.to_vec(),
            places: Vec::new(), // Not indexed separately
            topics: topics.to_vec(),
            doc_len,
        });

        self.recalc_avg_len();
    }

    pub fn remove_document(&mut self, id: &str) {
        // Find document index
        let idx = self.documents.iter().position(|d| d.id == id);
        if let Some(idx) = idx {
            self.documents.remove(idx);
            // Rebuild inverted index (could optimize but simple is fine for personal agent scale)
            self.rebuild_inverted();
        }
    }

    fn rebuild_inverted(&mut self) {
        self.inverted.clear();
        for (i, doc) in self.documents.iter().enumerate() {
            let all_tokens: Vec<String> = doc.title_tokens.iter()
                .chain(doc.content_tokens.iter())
                .cloned()
                .collect();

            let mut tf: HashMap<String, u32> = HashMap::new();
            for token in &all_tokens {
                *tf.entry(token.clone()).or_insert(0) += 1;
            }

            for (term, freq) in tf {
                self.inverted.entry(term).or_default().push((i, freq));
            }
        }
        self.recalc_avg_len();
    }

    fn recalc_avg_len(&mut self) {
        if self.documents.is_empty() {
            self.avg_doc_len = 0.0;
        } else {
            self.avg_doc_len = self.documents.iter().map(|d| d.doc_len).sum::<f64>() / self.documents.len() as f64;
        }
    }

    // ─── BM25 Scoring ───────────────────────────────────────────────────

    fn idf(&self, term: &str) -> f64 {
        let n = self.documents.len() as f64;
        let df = self.inverted.get(term).map(|v| v.len() as f64).unwrap_or(0.0);
        if df == 0.0 { return 0.0; }
        ((n - df + 0.5) / (df + 0.5)).ln_1p() // ln(1 + x) for smoothing
    }

    fn bm25_score(&self, doc_idx: usize, query_tokens: &[String], field_mul: f64) -> f64 {
        let doc = &self.documents[doc_idx];
        let doc_len_norm = doc.doc_len / self.avg_doc_len.max(1.0);

        let mut score = 0.0;
        for qt in query_tokens {
            let idf = self.idf(qt);
            if idf == 0.0 { continue; }

            let tf = self.inverted.get(qt)
                .and_then(|postings| postings.iter().find(|(d, _)| *d == doc_idx))
                .map(|(_, f)| *f as f64)
                .unwrap_or(0.0);

            if tf == 0.0 { continue; }

            let numerator = tf * (K1 + 1.0);
            let denominator = tf + K1 * (1.0 - B + B * doc_len_norm);
            score += idf * (numerator / denominator);
        }

        score * field_mul
    }

    // ─── Search ──────────────────────────────────────────────────────────

    /// Search for entries matching the query tokens.
    /// Returns results sorted by score descending.
    /// Uses field boosting: title 5x, people 4x, topics 3x, content 1x.
    pub fn search(&self, query: &str) -> Vec<usize> {
        let query_tokens = Self::tokenize(query);
        if query_tokens.is_empty() { return Vec::new(); }

        let mut scores: Vec<(usize, f64)> = Vec::new();
        for (idx, doc) in self.documents.iter().enumerate() {
            // Title field search
            let title_score = {
                let title_query = Self::tokenize(query);
                self.bm25_score_field(idx, &title_query, &doc.title_tokens, 5.0)
            };

            // Content field search
            let content_score = self.bm25_score_field(idx, &query_tokens, &doc.content_tokens, 1.0);

            // People boost
            let people_score: f64 = if doc.people.iter().any(|p| {
                let p_lower = p.to_lowercase();
                query_tokens.iter().any(|qt| p_lower.contains(qt) || Self::fuzzy_matches(&p_lower, qt))
            }) { 4.0 } else { 0.0 };

            // Topics boost
            let topics_score: f64 = if doc.topics.iter().any(|t| {
                let t_lower = t.to_lowercase();
                query_tokens.iter().any(|qt| t_lower.contains(qt))
            }) { 3.0 } else { 0.0 };

            let score = title_score + content_score + people_score + topics_score;
            if score > 0.0 {
                scores.push((idx, score));
            }
        }

        scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        scores.into_iter().map(|(i, _)| i).collect()
    }

    fn bm25_score_field(&self, doc_idx: usize, query_tokens: &[String], field_tokens: &[String], field_mul: f64) -> f64 {
        let _doc = &self.documents[doc_idx];
        let doc_len = field_tokens.len() as f64;
        let doc_len_norm = doc_len / self.avg_doc_len.max(1.0);

        let mut score = 0.0;
        for qt in query_tokens {
            let idf = self.idf(qt);
            if idf == 0.0 { continue; }

            let tf = field_tokens.iter().filter(|t| t == &qt).count() as f64;
            if tf == 0.0 { continue; }

            let numerator = tf * (K1 + 1.0);
            let denominator = tf + K1 * (1.0 - B + B * doc_len_norm);
            score += idf * (numerator / denominator);
        }

        score * field_mul
    }

    // ─── Fuzzy Matching ──────────────────────────────────────────────────

    fn fuzzy_matches(a: &str, b: &str) -> bool {
        if a.len() < 3 || b.len() < 3 { return false; }
        if a.contains(b) || b.contains(a) { return true; }
        edit_distance(a, b) <= 1
    }

    pub fn get_results(&self, entries: &[PersonalEntry], query: &str) -> Vec<SearchResult> {
        let indices = self.search(query);
        indices.into_iter()
            .filter_map(|idx| {
                let doc = &self.documents[idx];
                entries.iter()
                    .find(|e| e.id == doc.id)
                    .map(|entry| SearchResult {
                        id: entry.id.clone(),
                        title: entry.title.clone(),
                        content: entry.content.clone(),
                        score: 0.0, // Would need to recompute per-entry score
                        memo_type: entry.memo_type,
                        confidence: entry.confidence,
                        people: entry.people.clone(),
                        topics: entry.topics.clone(),
                    })
            })
            .collect()
    }

    pub fn size(&self) -> usize {
        self.documents.len()
    }

    pub fn doc_by_index(&self, idx: usize) -> Option<&IndexDoc> {
        self.documents.get(idx)
    }

    pub fn doc_id(&self, idx: usize) -> Option<&str> {
        self.documents.get(idx).map(|d| d.id.as_str())
    }
}

fn edit_distance(a: &str, b: &str) -> usize {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let n = a_chars.len();
    let m = b_chars.len();

    let mut prev: Vec<usize> = (0..=m).collect();
    let mut curr = vec![0; m + 1];

    for i in 1..=n {
        curr[0] = i;
        for j in 1..=m {
            let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
            curr[j] = (prev[j] + 1)
                .min(curr[j - 1] + 1)
                .min(prev[j - 1] + cost);
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    prev[m]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_edit_distance() {
        assert_eq!(edit_distance("alex", "alexander"), 4);
        assert_eq!(edit_distance("alex", "alex"), 0);
        assert_eq!(edit_distance("alex", "alexa"), 1);
        assert_eq!(edit_distance("joe", "joey"), 1);
    }

    #[test]
    fn test_tokenize() {
        let tokens = SearchIndex::tokenize("Hello, World! I'm Alex.");
        assert!(tokens.contains(&"hello".to_string()));
        assert!(tokens.contains(&"world".to_string()));
        assert!(tokens.contains(&"alex".to_string()));
    }

    #[test]
    fn test_index_search() {
        let mut idx = SearchIndex::new();
        idx.add_document("1".into(), "Alex's Job", "Alex works at Google as a senior engineer", &["Alex".into()], &["work".into(), "career".into()]);
        idx.add_document("2".into(), "Favorite Food", "Alex loves Italian food especially pasta", &["Alex".into()], &["food".into()]);

        let results = idx.search("Alex job");
        assert!(!results.is_empty());
    }
}
