use std::path::PathBuf;

const DEFAULT_SCHEMA: &str = r#"# User Profile

## Identity
- Name: Unknown

## Projects

## Relationships

## Preferences

## Patterns

## Open Questions
- [ ] What is your name?
"#;

pub fn schema_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Orkestrate")
        .join("user.md")
}

pub fn ensure_schema() -> String {
    let path = schema_path();
    if !path.exists() {
        let _ = std::fs::create_dir_all(path.parent().unwrap());
        let _ = std::fs::write(&path, DEFAULT_SCHEMA);
        DEFAULT_SCHEMA.to_string()
    } else {
        std::fs::read_to_string(&path).unwrap_or_else(|_| DEFAULT_SCHEMA.to_string())
    }
}

pub fn read_schema() -> String {
    let path = schema_path();
    if !path.exists() {
        ensure_schema()
    } else {
        std::fs::read_to_string(&path).unwrap_or_else(|_| DEFAULT_SCHEMA.to_string())
    }
}

pub fn write_schema(content: &str) -> Result<(), String> {
    let path = schema_path();
    let _ = std::fs::create_dir_all(path.parent().unwrap());
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[allow(dead_code)]
pub fn get_schema_section(schema: &str, section: &str) -> Option<String> {
    let heading = format!("## {}", section);
    let lines = schema.lines();
    let mut capturing = false;
    let mut result = Vec::new();

    for line in lines {
        if line.trim() == heading {
            capturing = true;
            continue;
        }
        if capturing && line.starts_with("## ") {
            break;
        }
        if capturing {
            result.push(line);
        }
    }

    if result.is_empty() {
        None
    } else {
        Some(result.join("\n").trim().to_string())
    }
}
