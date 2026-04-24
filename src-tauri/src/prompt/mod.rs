const DEFAULT_PERSONA: &str = include_str!("orkestrate.txt");

pub fn load_persona() -> String {
    // Try to load from app data directory for runtime editing
    let prompt_path = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Orkestrate")
        .join("prompt.txt");

    if prompt_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&prompt_path) {
            if !content.trim().is_empty() {
                return content;
            }
        }
    }

    // Fallback to embedded default
    DEFAULT_PERSONA.to_string()
}

pub fn ensure_prompt_file() {
    let prompt_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Orkestrate");

    let prompt_path = prompt_dir.join("prompt.txt");

    if !prompt_path.exists() {
        let _ = std::fs::create_dir_all(&prompt_dir);
        let _ = std::fs::write(&prompt_path, DEFAULT_PERSONA);
    }
}
