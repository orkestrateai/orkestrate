use std::path::{Path, PathBuf};
use std::fs;
use serde::{Serialize, Deserialize};

fn fmt_list(items: &[String]) -> String {
    if items.is_empty() {
        return "[]".to_string();
    }
    let lines: Vec<String> = items.iter().map(|i| format!("  - {}", i)).collect();
    format!("\n{}", lines.join("\n"))
}

fn generate_frontmatter(
    title: &str,
    summary: &str,
    category: &str,
    confidence: f64,
    entities: &[String],
    tags: &[String],
    keywords: &[String],
    created_at: &str,
    updated_at: &str,
    provenance: &str,
) -> String {
    format!(
        "---\ntitle: {title}\nsummary: {summary}\ncategory: {cat}\nconfidence: {conf}\nprovenance: {prov}\nentities: {ents}\ntags: {tags}\nkeywords: {kws}\ncreatedAt: {created}\nupdatedAt: {updated}\n---\n\n",
        title = title,
        summary = summary,
        cat = category,
        conf = confidence,
        prov = provenance,
        ents = fmt_list(entities),
        tags = fmt_list(tags),
        kws = fmt_list(keywords),
        created = created_at,
        updated = updated_at,
    )
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

pub struct ContextTreeStorage {
    root_path: PathBuf,
}

const CONTEXT_TREE_ROOT: &str = ".brv/context-tree";
const ARCHIVE_DIR: &str = "archive";
const CONTEXT_FILE: &str = "context.md";
const SUMMARY_INDEX_FILE: &str = "summary.md";

impl ContextTreeStorage {
    pub fn new(root_path: PathBuf) -> Self {
        let tree_path = root_path.join(CONTEXT_TREE_ROOT);
        if !tree_path.exists() {
            fs::create_dir_all(&tree_path).unwrap_or_default();
        }
        Self { root_path: tree_path }
    }

    fn get_entry_path(&self, domain: &str, topic: &str, subtopic: Option<&str>, title: &str) -> PathBuf {
        let mut path = self.root_path.join(domain).join(topic);
        if let Some(st) = subtopic {
            path = path.join(st);
        }
        path.join(format!("{}.md", title))
    }

    fn now_iso() -> String {
        chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
    }

    pub fn write_entry(&self, entry: &MemoryEntry) -> std::io::Result<()> {
        let file_path = self.get_entry_path(&entry.domain, &entry.topic, entry.subtopic.as_deref(), &entry.title);

        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let frontmatter = generate_frontmatter(
            &entry.title,
            &entry.summary,
            &entry.category,
            entry.confidence,
            &entry.entities,
            &entry.tags,
            &entry.keywords,
            &entry.created_at,
            &entry.updated_at,
            &entry.provenance,
        );
        let full_content = format!("{}{}", frontmatter, entry.content);

        let tmp_path = file_path.with_extension("tmp");
        fs::write(&tmp_path, &full_content)?;
        fs::rename(&tmp_path, &file_path)?;

        Ok(())
    }

    pub fn list_all_entries(&self) -> std::io::Result<Vec<MemoryEntry>> {
        let mut entries = Vec::new();
        if !self.root_path.exists() {
            return Ok(entries);
        }
        self.walk_dir(&self.root_path, &mut entries, 0)?;
        Ok(entries)
    }

    pub fn list_entries_in_dir(&self, dir: &str) -> std::io::Result<Vec<MemoryEntry>> {
        let dir_path = self.root_path.join(dir);
        let mut entries = Vec::new();
        self.walk_dir(&dir_path, &mut entries, 0)?;
        Ok(entries)
    }

    pub fn read_entry_raw(&self, relative_path: &str) -> std::io::Result<Option<String>> {
        let file_path = self.root_path.join(relative_path);
        if !file_path.exists() {
            return Ok(None);
        }
        fs::read_to_string(&file_path).map(Some)
    }

    pub fn read_user_profile(&self) -> std::io::Result<Option<String>> {
        let path = self.root_path.join("user.md");
        if !path.exists() {
            return Ok(None);
        }
        fs::read_to_string(&path).map(Some)
    }

    pub fn write_user_profile(&self, content: &str) -> std::io::Result<()> {
        let path = self.root_path.join("user.md");
        let tmp_path = path.with_extension("tmp");
        fs::write(&tmp_path, content)?;
        fs::rename(&tmp_path, &path)?;
        Ok(())
    }

    fn walk_dir(
        &self,
        dir_path: &Path,
        entries: &mut Vec<MemoryEntry>,
        depth: usize,
    ) -> std::io::Result<()> {
        if depth > 4 {
            return Ok(());
        }

        if !dir_path.is_dir() {
            return Ok(());
        }

        for entry in fs::read_dir(dir_path)? {
            let entry = entry?;
            let path = entry.path();

            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with('.') {
                    continue;
                }
            }

            if path.is_dir() {
                if path.file_name().and_then(|n| n.to_str()) == Some(ARCHIVE_DIR) {
                    continue;
                }
                self.walk_dir(&path, entries, depth + 1)?;
            } else if path.extension().and_then(|s| s.to_str()) == Some("md") {
                let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

                if fname == CONTEXT_FILE || fname == SUMMARY_INDEX_FILE || fname == "entity.md" {
                    continue;
                }

                let relative_path = path.strip_prefix(&self.root_path).unwrap_or(&path);
                let components: Vec<_> = relative_path.components().collect();
                if components.len() < 2 {
                    continue;
                }

                let domain = components[0].as_os_str().to_string_lossy().to_string();
                let topic = components[1].as_os_str().to_string_lossy().to_string();
                let (subtopic, title_file) = if components.len() >= 4 {
                    (Some(components[2].as_os_str().to_string_lossy().to_string()), components[3])
                } else {
                    (None, components[2])
                };

                let title = title_file.as_os_str().to_string_lossy().trim_end_matches(".md").to_string();

                if let Ok(content) = fs::read_to_string(&path) {
                    let body = Self::strip_frontmatter(&content);
                    entries.push(MemoryEntry {
                        title,
                        summary: String::new(),
                        domain,
                        topic,
                        subtopic,
                        content: body,
                        tags: Vec::new(),
                        keywords: Vec::new(),
                        category: String::new(),
                        confidence: 0.5,
                        entities: Vec::new(),
                        provenance: String::new(),
                        created_at: Self::now_iso(),
                        updated_at: Self::now_iso(),
                    });
                }
            }
        }

        Ok(())
    }

    pub(crate) fn strip_frontmatter(content: &str) -> String {
        if content.starts_with("---\n") || content.starts_with("---\r\n") {
            if let Some(end) = content.find("\n---\n") {
                return content[end + 5..].to_string();
            }
            if let Some(end) = content.find("\r\n---\r\n") {
                return content[end + 7..].to_string();
            }
        }
        content.to_string()
    }
}
