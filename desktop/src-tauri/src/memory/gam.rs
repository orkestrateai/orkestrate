use crate::db;
use crate::timer::Timer;

/// Simple semantic shift detection based on keyword overlap
pub fn detect_semantic_shift(user_msg: &str, previous_user_msg: Option<&str>) -> bool {
    let _timer = Timer::new("memory::gam::semantic_shift");

    let Some(prev) = previous_user_msg else {
        return true; // First message is always a shift
    };

    let current_words: std::collections::HashSet<String> = user_msg
        .to_lowercase()
        .split_whitespace()
        .map(|s| s.trim_matches(|c: char| !c.is_alphanumeric()).to_string())
        .filter(|s| s.len() > 2)
        .collect();

    let prev_words: std::collections::HashSet<String> = prev
        .to_lowercase()
        .split_whitespace()
        .map(|s| s.trim_matches(|c: char| !c.is_alphanumeric()).to_string())
        .filter(|s| s.len() > 2)
        .collect();

    if current_words.is_empty() || prev_words.is_empty() {
        return true;
    }

    let intersection: std::collections::HashSet<_> =
        current_words.intersection(&prev_words).collect();
    let overlap =
        intersection.len() as f64 / std::cmp::max(current_words.len(), prev_words.len()) as f64;

    overlap < 0.3
}

pub fn store_event(
    turn_index: i64,
    session_id: &str,
    user_message: Option<&str>,
    assistant_message: Option<&str>,
    semantic_shift: bool,
) -> Result<String, String> {
    let _timer = Timer::new("memory::gam::store_event");
    db::store_event(
        turn_index,
        session_id,
        user_message,
        assistant_message,
        semantic_shift,
    )
}
