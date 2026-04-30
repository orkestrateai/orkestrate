use std::path::{Path, PathBuf};
use std::fs;
use std::collections::HashMap;
use crate::ai::memory::types::{PersonalEntry, MemoType, MemoSource, MaturityTier, UserProfile};

const CONTEXT_TREE_ROOT: &str = ".brv/context-tree";
const FACTS_DIR: &str = "facts";
const EPISODIC_DIR: &str = "episodic";
const PROFILE_FILE: &str = "profile.json";

pub struct ContextTreeStorage {
    root_path: PathBuf,
}

fn now_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

// ─── Backward-compat type alias for MemoryEntry ───────────────────────────
// Keep old struct so existing callers don't break; will be phased out.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MemoryEntry {
    pub title: String,
    pub summary: String,
    pub domain: String,
    pub topic: String,
    pub subtopic: Option<String>,
    pub content: String,
    pub tags: Vec<String>,
    pub keywords: Vec<String>,
    pub category: String,
    pub confidence: f64,
    pub entities: Vec<String>,
    pub provenance: String,
    pub created_at: String,
    pub updated_at: String,
}

// ─── Frontmatter ──────────────────────────────────────────────────────────

pub fn parse_frontmatter(raw: &str) -> (HashMap<String, String>, String) {
    let mut meta = HashMap::new();
    if !raw.starts_with("---\n") && !raw.starts_with("---\r\n") {
        return (meta, raw.to_string());
    }
    // Find end of frontmatter
    let body_start = if let Some(pos) = raw.find("\n---\n") {
        pos + 5
    } else if let Some(pos) = raw.find("\r\n---\r\n") {
        pos + 7
    } else {
        return (meta, raw.to_string());
    };
    let fm = &raw[4..body_start.saturating_sub(5.min(body_start))];
    let body = &raw[body_start..];

    for line in fm.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }
        if let Some(col) = line.find(':') {
            let (key, val) = (line[..col].trim(), line[col + 1..].trim());
            if val == "[]" { continue; }
            // Multi-line list detection: if val is empty and next lines start with "  -"
            // For now just store what we have. Lists come as empty value + separate entries.
            meta.insert(key.to_string(), val.to_string());
        }
    }
    (meta, body.to_string())
}

fn parse_list(raw: &str, key: &str) -> Vec<String> {
    let mut items = Vec::new();
    let mut in_section = false;
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with(&format!("{}:", key)) {
            in_section = true;
            // Check inline list
            if let Some(after) = trimmed.trim_start_matches(&format!("{}:", key)).trim_start().strip_prefix('[') {
                if let Some(inner) = after.strip_suffix(']') {
                    for item in inner.split(',') {
                        let i = item.trim().trim_matches('"').trim();
                        if !i.is_empty() { items.push(i.to_string()); }
                    }
                }
            }
            continue;
        }
        if trimmed.starts_with("  - ") && in_section {
            items.push(trimmed[4..].to_string());
        } else if in_section && (trimmed.is_empty() || trimmed.ends_with(':') || !trimmed.starts_with("  ")) {
            in_section = false;
        }
    }
    items
}

impl ContextTreeStorage {
    pub fn new(root_path: PathBuf) -> Self {
        let tree_path = root_path.join(CONTEXT_TREE_ROOT);
        fs::create_dir_all(tree_path.join(FACTS_DIR)).unwrap_or_default();
        fs::create_dir_all(tree_path.join(EPISODIC_DIR)).unwrap_or_default();
        Self { root_path: tree_path }
    }

    pub fn root(&self) -> &Path {
        &self.root_path
    }

    // ─── Facts ────────────────────────────────────────────────────────────

    fn fact_path(&self, id: &str) -> PathBuf {
        self.root_path.join(FACTS_DIR).join(format!("{}.md", id))
    }

    /// Personal memory hierarchy: types → domain, first topic → subdomain
    /// identity/         — facts about who the user is
    /// relationships/    — people, family, friends, colleagues
    /// preferences/      — likes, dislikes, communication style
    /// professional/     — work, career, skills
    /// projects/         — active projects and tasks
    /// knowledge/        — general facts and knowledge
    /// episodes/         — conversation summaries
    fn personal_path(&self, entry: &PersonalEntry) -> PathBuf {
        use crate::ai::memory::types::MemoType;
        let domain = match entry.memo_type {
            MemoType::Fact | MemoType::Insight => "knowledge",
            MemoType::Preference => "preferences",
            MemoType::Relationship => "relationships",
            MemoType::Task => "projects",
            MemoType::Context => "identity",
            MemoType::Episode => "episodes",
        };
        let topic = entry.topics.first().map(|s| s.as_str()).unwrap_or("general");
        let slug = slugify(&entry.title);
        let path = self.root_path.join(domain).join(topic);
        fs::create_dir_all(&path).unwrap_or_default();
        path.join(format!("{}.md", slug))
    }

    pub fn personal_write(&self, entry: &PersonalEntry) -> std::io::Result<()> {
        let file_path = self.personal_path(entry);
        let fm = self.build_frontmatter(entry);
        let full = format!("{}{}", fm, entry.content);
        let tmp_path = file_path.with_extension("tmp");
        fs::write(&tmp_path, &full)?;
        fs::rename(&tmp_path, &file_path)?;
        Ok(())
    }

    fn build_frontmatter(&self, entry: &PersonalEntry) -> String {
        let mut fm = String::from("---\n");
        fm.push_str(&format!("title: {}\n", entry.title));
        fm.push_str(&format!("type: {}\n", serialize_enum(&entry.memo_type)));
        fm.push_str(&format!("source: {}\n", serialize_enum(&entry.source)));
        fm.push_str(&format!("confidence: {}\n", entry.confidence));
        fm.push_str(&format!("importance: {}\n", entry.importance));
        fm.push_str(&format!("maturity: {}\n", serialize_enum(&entry.maturity)));
        fm.push_str(&format!("accessCount: {}\n", entry.access_count));
        fm.push_str(&format!("lastAccessed: {}\n", entry.last_accessed));
        fm.push_str(&format!("sessionId: {}\n", entry.session_id));
        if !entry.people.is_empty() { fm.push_str(&format!("people: [{}]\n", entry.people.join(", "))); }
        if !entry.places.is_empty() { fm.push_str(&format!("places: [{}]\n", entry.places.join(", "))); }
        if !entry.topics.is_empty() { fm.push_str(&format!("topics: [{}]\n", entry.topics.join(", "))); }
        if !entry.tags.is_empty() { fm.push_str(&format!("tags: [{}]\n", entry.tags.join(", "))); }
        fm.push_str(&format!("summary: {}\n", entry.summary));
        fm.push_str(&format!("createdAt: {}\n", entry.created_at));
        fm.push_str(&format!("updatedAt: {}\n", entry.updated_at));
        if let Some(ref exp) = entry.expires_at {
            fm.push_str(&format!("expiresAt: {}\n", exp));
        }
        fm.push_str("---\n\n");
        fm
    }

    pub fn personal_list_all(&self) -> std::io::Result<Vec<PersonalEntry>> {
        let mut entries = Vec::new();
        self.walk_personal(&self.root_path, &mut entries, 0)?;
        Ok(entries)
    }

    fn walk_personal(&self, dir_path: &Path, entries: &mut Vec<PersonalEntry>, depth: usize) -> std::io::Result<()> {
        if depth > 3 || !dir_path.is_dir() { return Ok(()); }
        for entry in fs::read_dir(dir_path)? {
            let entry = entry?;
            let path = entry.path();
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with('.') || name == PROFILE_FILE || name == "episodes" { continue; }
            }
            if path.is_dir() {
                self.walk_personal(&path, entries, depth + 1)?;
            } else if path.extension().and_then(|s| s.to_str()) == Some("md") {
                if let Ok(raw) = fs::read_to_string(&path) {
                    let id = Self::derive_id_from_path(&path);
                    entries.push(Self::raw_to_entry(&id, &raw));
                }
            }
        }
        Ok(())
    }

    fn derive_id_from_path(path: &Path) -> String {
        path.file_stem().and_then(|s| s.to_str()).unwrap_or("unknown").to_string()
    }

    pub fn write_fact(&self, entry: &PersonalEntry) -> std::io::Result<()> {
        self.personal_write(entry)
    }

    pub fn read_fact(&self, id: &str) -> std::io::Result<Option<PersonalEntry>> {
        // Search through the personal hierarchy for a file matching the ID
        let entries = self.personal_list_all()?;
        Ok(entries.into_iter().find(|e| e.id == id))
    }

    pub fn list_all_facts(&self) -> std::io::Result<Vec<PersonalEntry>> {
        self.personal_list_all()
    }

    pub fn delete_fact(&self, id: &str) -> std::io::Result<()> {
        let path = self.fact_path(id);
        if path.exists() {
            fs::remove_file(path)?;
        }
        Ok(())
    }

    // ─── Episodic ─────────────────────────────────────────────────────────

    pub fn episode_path(&self, session_id: &str) -> PathBuf {
        self.root_path.join(EPISODIC_DIR).join(format!("{}.md", session_id))
    }

    pub fn write_episode(&self, session_id: &str, summary: &str, facts_extracted: &[String]) -> std::io::Result<()> {
        let path = self.episode_path(session_id);
        let ts = now_iso();
        let mut content = format!("---\nsessionId: {}\ncreatedAt: {}\n---\n\n# Session {}\n\n{}\n", session_id, ts, ts, summary);
        if !facts_extracted.is_empty() {
            content.push_str("\n## Extracted Facts\n\n");
            for f in facts_extracted {
                content.push_str(&format!("- {}\n", f));
            }
        }
        let tmp = path.with_extension("tmp");
        fs::write(&tmp, &content)?;
        fs::rename(&tmp, &path)?;
        Ok(())
    }

    pub fn list_recent_episodes(&self, limit: usize) -> std::io::Result<Vec<(String, String)>> {
        let dir = self.root_path.join(EPISODIC_DIR);
        if !dir.exists() { return Ok(Vec::new()); }
        let mut files: Vec<_> = fs::read_dir(&dir)?.filter_map(|e| e.ok()).collect();
        files.sort_by_key(|e| std::cmp::Reverse(e.file_name()));
        let mut results = Vec::new();
        for entry in files.iter().take(limit) {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("md") { continue; }
            let sid = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
            if let Ok(raw) = fs::read_to_string(&path) {
                let (_meta, body) = parse_frontmatter(&raw);
                results.push((sid, body));
            }
        }
        Ok(results)
    }

    // ─── Profile ──────────────────────────────────────────────────────────

    fn profile_path(&self) -> PathBuf {
        self.root_path.join(PROFILE_FILE)
    }

    pub fn read_profile(&self) -> std::io::Result<Option<UserProfile>> {
        let path = self.profile_path();
        if !path.exists() { return Ok(None); }
        let raw = fs::read_to_string(&path)?;
        serde_json::from_str(&raw).map(Some).map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))
    }

    pub fn write_profile(&self, profile: &UserProfile) -> std::io::Result<()> {
        let path = self.profile_path();
        let json = serde_json::to_string_pretty(profile).map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
        let tmp = path.with_extension("tmp");
        fs::write(&tmp, &json)?;
        fs::rename(&tmp, &path)?;
        Ok(())
    }

    // ─── Backward-compat: old MemoryEntry API (for handler.rs migration) ──

    pub fn write_entry(&self, entry: &MemoryEntry) -> std::io::Result<()> {
        // Convert old MemoryEntry to new PersonalEntry and write to facts/
        let id = format!("{}_{}", entry.domain, slugify(&entry.title));
        let pe = PersonalEntry {
            id,
            title: entry.title.clone(),
            content: entry.content.clone(),
            summary: entry.summary.clone(),
            memo_type: MemoType::Fact,
            source: if entry.provenance == "user-stated" { MemoSource::Explicit } else { MemoSource::Inferred },
            confidence: entry.confidence,
            session_id: String::new(),
            people: Vec::new(),
            places: Vec::new(),
            topics: entry.keywords.clone(),
            tags: entry.tags.clone(),
            importance: 50.0,
            maturity: MaturityTier::Draft,
            access_count: 0,
            last_accessed: 0,
            created_at: entry.created_at.clone(),
            updated_at: entry.updated_at.clone(),
            expires_at: None,
        };
        self.write_fact(&pe)
    }

    pub fn list_all_entries(&self) -> std::io::Result<Vec<MemoryEntry>> {
        // Read new PersonalEntry facts and convert back to old MemoryEntry
        let facts = self.list_all_facts()?;
        Ok(facts.into_iter().map(|pe| MemoryEntry {
            title: pe.title,
            summary: pe.summary,
            domain: "facts".to_string(),
            topic: pe.memo_type.to_topic(),
            subtopic: None,
            content: pe.content,
            tags: pe.tags,
            keywords: pe.topics,
            category: format!("{:?}", pe.memo_type).to_lowercase(),
            confidence: pe.confidence,
            entities: pe.people,
            provenance: format!("{:?}", pe.source).to_lowercase(),
            created_at: pe.created_at,
            updated_at: pe.updated_at,
        }).collect())
    }

    // ─── Helpers ──────────────────────────────────────────────────────────

    pub(crate) fn strip_frontmatter(content: &str) -> String {
        let (_, body) = parse_frontmatter(content);
        body
    }

    fn raw_to_entry(id: &str, raw: &str) -> PersonalEntry {
        let fm_raw = raw;
        let meta = parse_raw_frontmatter_map(fm_raw);
        let (_, body) = parse_frontmatter(raw);

        PersonalEntry {
            id: id.to_string(),
            title: meta.get("title").cloned().unwrap_or_default(),
            content: body.trim().to_string(),
            summary: meta.get("summary").cloned().unwrap_or_default(),
            memo_type: parse_memo_type(meta.get("type").map(|s| s.as_str()).unwrap_or("fact")),
            source: parse_memo_source(meta.get("source").map(|s| s.as_str()).unwrap_or("explicit")),
            confidence: meta.get("confidence").and_then(|s| s.parse().ok()).unwrap_or(0.5),
            session_id: meta.get("sessionId").cloned().unwrap_or_default(),
            people: parse_inline_list(meta.get("people")),
            places: parse_inline_list(meta.get("places")),
            topics: parse_inline_list(meta.get("topics")),
            tags: parse_inline_list(meta.get("tags")),
            importance: meta.get("importance").and_then(|s| s.parse().ok()).unwrap_or(50.0),
            maturity: parse_maturity(meta.get("maturity").map(|s| s.as_str()).unwrap_or("draft")),
            access_count: meta.get("accessCount").and_then(|s| s.parse().ok()).unwrap_or(0),
            last_accessed: meta.get("lastAccessed").and_then(|s| s.parse().ok()).unwrap_or(0),
            created_at: meta.get("createdAt").cloned().unwrap_or_else(now_iso),
            updated_at: meta.get("updatedAt").cloned().unwrap_or_else(now_iso),
            expires_at: meta.get("expiresAt").cloned(),
        }
    }

    // Also expose list_all_entries for backward compat (from old path)
    pub fn list_entries_in_dir(&self, _dir: &str) -> std::io::Result<Vec<MemoryEntry>> {
        self.list_all_entries()
    }

    pub fn read_entry_raw(&self, _relative_path: &str) -> std::io::Result<Option<String>> {
        Ok(None) // No longer used with new flat structure
    }
}

// ─── Old profile helpers for backward compat ─────────────────────────────

impl ContextTreeStorage {
    pub fn read_user_profile(&self) -> std::io::Result<Option<String>> {
        match self.read_profile() {
            Ok(Some(p)) => Ok(Some(p.to_prompt_block())),
            Ok(None) => Ok(None),
            Err(_) => Ok(None),
        }
    }

    pub fn write_user_profile(&self, content: &str) -> std::io::Result<()> {
        let path = self.root_path.join("user.md");
        let tmp = path.with_extension("tmp");
        fs::write(&tmp, content)?;
        fs::rename(&tmp, &path)?;
        Ok(())
    }
}

// ─── Parsing helpers ─────────────────────────────────────────────────────

fn parse_raw_frontmatter_map(raw: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    if !raw.starts_with("---\n") && !raw.starts_with("---\r\n") {
        return map;
    }
    let end = raw.find("\n---\n").or_else(|| raw.find("\r\n---\r\n")).unwrap_or(0);
    if end == 0 { return map; }
    let fm = &raw[4..end];

    let mut current_key: Option<String> = None;
    for line in fm.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() { continue; }
        if trimmed.starts_with("  - ") {
            // Append list item to current key
            if let Some(ref key) = current_key {
                let existing = map.get(key).cloned().unwrap_or_default();
                if !existing.is_empty() {
                    map.insert(key.clone(), format!("{}, {}", existing, &trimmed[4..]));
                } else {
                    map.insert(key.clone(), trimmed[4..].to_string());
                }
            }
            continue;
        }
        if let Some(col) = trimmed.find(':') {
            let key = trimmed[..col].trim().to_string();
            let val = trimmed[col + 1..].trim().to_string();
            current_key = Some(key.clone());
            if val == "[]" { continue; }
            map.insert(key, val);
        } else {
            current_key = None;
        }
    }
    map
}

fn parse_memo_type(s: &str) -> MemoType {
    match s {
        "preference" => MemoType::Preference,
        "episode" => MemoType::Episode,
        "task" => MemoType::Task,
        "relationship" => MemoType::Relationship,
        "context" => MemoType::Context,
        "insight" => MemoType::Insight,
        _ => MemoType::Fact,
    }
}

fn parse_memo_source(s: &str) -> MemoSource {
    match s {
        "inferred" => MemoSource::Inferred,
        "derived" => MemoSource::Derived,
        _ => MemoSource::Explicit,
    }
}

fn parse_maturity(s: &str) -> MaturityTier {
    match s {
        "validated" => MaturityTier::Validated,
        "core" => MaturityTier::Core,
        _ => MaturityTier::Draft,
    }
}

fn parse_inline_list(raw: Option<&String>) -> Vec<String> {
    match raw {
        Some(s) if !s.is_empty() => s.split(',').map(|p| p.trim().trim_matches('"').to_string()).filter(|p| !p.is_empty()).collect(),
        _ => Vec::new(),
    }
}

fn slugify(title: &str) -> String {
    title.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
}

fn serialize_enum<T: serde::Serialize>(val: &T) -> String {
    serde_json::to_string(val).unwrap_or_default().trim_matches('"').to_string()
}

impl MemoType {
    fn to_topic(&self) -> String {
        format!("{:?}", self).to_lowercase()
    }
}
