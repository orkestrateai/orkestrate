use crate::ai::memory::ChatMemoryService;
use crate::ai::memory::TOOL_TRACES;
use crate::ai::paths::get_app_data_dir;
use aisdk::{
    core::{tools::Tool, utils::step_count_is, LanguageModelRequest},
    integrations::{axum::AxumSseResponse, vercel_aisdk_ui::VercelUIRequest},
    macros::tool,
    providers::Opencode,
};
use axum::{http::StatusCode, Json};
use futures::StreamExt;
use once_cell::sync::OnceCell;
use schemars::JsonSchema;
use serde::Deserialize;

use tokio::task_local;

const PERSONA_PROMPT: &str = include_str!("../../orkestrate.txt");

task_local! {
    pub static SESSION_ID: String;
}

static MEMORY_SERVICE: OnceCell<ChatMemoryService> = OnceCell::new();

fn get_memory_service() -> &'static ChatMemoryService {
    MEMORY_SERVICE.get_or_init(|| ChatMemoryService::new(get_app_data_dir()))
}

#[derive(JsonSchema, Deserialize)]
pub struct ChatTitle {
    pub title: String,
}

fn temporal_context() -> String {
    let now = chrono::Local::now();
    format!(
        "[TEMPORAL CONTEXT]\nCurrent time: {}\nDay of week: {}\nDate: {}\n[/TEMPORAL CONTEXT]",
        now.format("%H:%M"),
        now.format("%A"),
        now.format("%Y-%m-%d"),
    )
}

fn environment_block() -> String {
    format!(
        "[ENVIRONMENT]\nPlatform: {}\nWorking directory: {}\n[/ENVIRONMENT]",
        std::env::consts::OS,
        std::env::current_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_default(),
    )
}

fn tools_block() -> String {
    crate::ai::tools::get_tools_block()
}

/// Simple entity extraction for SWM turn tracking.
/// Finds capitalized words that look like proper nouns / names.
fn extract_entities_simple(text: &str) -> Vec<String> {
    let mut names = Vec::new();
    let false_positives: &[&str] = &[
        "i", "a", "the", "it", "this", "that", "what", "which", "how", "why",
        "where", "when", "my", "your", "his", "her", "its", "our", "their",
        "you", "he", "she", "we", "they", "me", "him", "us", "them", "am",
        "is", "are", "was", "were", "be", "been", "being", "have", "has",
        "had", "do", "does", "did", "will", "would", "could", "should",
        "may", "might", "must", "shall", "can", "need", "dare", "ought",
        "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
        "as", "into", "through", "during", "before", "after", "above",
        "below", "between", "under", "and", "but", "or", "yet", "so", "if",
        "because", "although", "though", "while", "here", "there", "now",
        "then", "today", "tomorrow", "yesterday", "just", "only", "also",
        "even", "back", "still", "already", "too", "very", "really", "quite",
        "rather", "pretty", "enough", "almost", "nearly", "hardly", "simply",
        "completely", "absolutely", "definitely", "certainly", "probably",
        "possibly", "perhaps", "maybe", "surely", "actually", "basically",
        "literally", "seriously", "honestly", "frankly", "clearly", "obviously",
        "apparently", "presumably", "supposedly", "reportedly", "allegedly",
        "arguably", "admittedly", "conceivably", "understandably",
        "interestingly", "significantly", "importantly", "fortunately",
        "unfortunately", "surprisingly", "amazingly", "remarkably", "notably",
        "especially", "particularly", "specifically", "mainly", "mostly",
        "largely", "partly", "fully", "totally", "utterly", "entirely",
        "wholly", "thoroughly", "deeply", "greatly", "highly", "strongly",
        "widely", "closely", "directly", "indirectly", "exactly", "precisely",
        "correctly", "properly", "easily", "readily", "quickly", "slowly",
        "soon", "early", "late", "recently", "lately", "finally", "eventually",
        "initially", "originally", "previously", "formerly", "meanwhile",
        "otherwise", "instead", "besides", "furthermore", "moreover",
        "nevertheless", "nonetheless", "however", "therefore", "thus", "hence",
        "consequently", "accordingly", "subsequently", "alternatively",
        "similarly", "likewise", "conversely", "regardless", "notwithstanding",
        "overall", "generally", "typically", "usually", "normally", "commonly",
        "frequently", "often", "sometimes", "occasionally", "rarely", "seldom",
        "never", "always", "constantly", "continuously", "repeatedly",
        "regularly", "periodically", "daily", "weekly", "monthly", "yearly",
        "annually", "once", "twice", "again", "about", "above", "across",
        "after", "against", "along", "among", "around", "before", "behind",
        "beneath", "beside", "beyond", "despite", "down", "except", "inside",
        "into", "near", "off", "onto", "opposite", "outside", "over", "past",
        "regarding", "round", "since", "toward", "towards", "until", "upon",
        "within", "without",
    ];

    for word in text.split_whitespace() {
        let clean: String = word.trim_matches(|c: char| !c.is_alphanumeric()).to_string();
        if clean.len() < 2 {
            continue;
        }
        if clean.chars().next().map(|c| c.is_uppercase()).unwrap_or(false) {
            let lower = clean.to_lowercase();
            if !false_positives.contains(&lower.as_str()) && !names.contains(&clean) {
                names.push(clean);
            }
        }
    }
    names
}

#[tool]
/// This is your long-term memory — it contains everything you know about the user across all conversations.
///
/// Call this ONCE when the user asks about something personal, references past conversations,
/// or mentions people/places/projects you might have stored. Generate ALL your search queries
/// in a SINGLE call to this tool. After you receive the results, answer the user directly.
/// Do NOT call this tool more than once for the same question.
///
/// Generate 3-7 targeted search queries covering different angles of what the user is asking about.
/// Include names, topics, keywords, and related concepts so the search has multiple ways to match.
///
/// Example: If the user says "my sister Mia is stressed", search for ["mia", "mia sister", "mia stressed", "sister relationship"]
pub async fn search_context(queries: Vec<String>) -> Tool {
    let results = get_memory_service()
        .search_context_with_session(queries)
        .await;
    Ok(results)
}

#[tool]
/// Fetch content from a URL. Supports HTML pages (converted to markdown), PDF documents
/// (text extracted), plain text files, and images. Returns content in markdown format.
///
/// Pass a fully-formed URL starting with http:// or https://.
/// HTTP URLs are automatically upgraded to HTTPS.
pub async fn fetch_url(url: String) -> Tool {
    match fetch_url_impl(&url).await {
        Ok(content) => Ok(content),
        Err(e) => Ok(format!("Error fetching URL: {e}")),
    }
}

#[tool]
/// Search the web using Exa AI. Returns relevant search results with content snippets.
/// Use this to find up-to-date information, research topics, or gather information beyond your training data.
/// Use fetch_url when you need content from a specific URL instead.
pub async fn web_search(query: String) -> Tool {
    match web_search_impl(&query).await {
        Ok(content) => Ok(content),
        Err(e) => Ok(format!("Error searching web: {e}")),
    }
}

async fn fetch_url_impl(url: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let response = client
        .get(url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .header("Accept", "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8")
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("HTTP {status}"));
    }

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_lowercase();

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response body: {e}"))?;

    if content_type.contains("pdf") {
        let text = pdf_extract::extract_text_from_mem(&bytes)
            .map_err(|e| format!("PDF text extraction failed: {e}"))?;
        Ok(format!("[PDF Content from: {url}]\n{text}"))
    } else if content_type.contains("html") {
        let html = String::from_utf8_lossy(&bytes);
        let markdown = html2md::parse_html(&html);
        Ok(format!("[Content from: {url}]\n{markdown}"))
    } else {
        let text = String::from_utf8_lossy(&bytes).to_string();
        Ok(format!("[Content from: {url}]\n{text}"))
    }
}

async fn web_search_impl(query: &str) -> Result<String, String> {
    let api_key = std::env::var("EXA_API_KEY")
        .map_err(|_| {
            "EXA_API_KEY environment variable not set. Set it in your environment or .env file.".to_string()
        })?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let response = client
        .post("https://api.exa.ai/search")
        .header("x-api-key", &api_key)
        .header("content-type", "application/json")
        .json(&serde_json::json!({
            "query": query,
            "type": "auto",
            "numResults": 5,
            "contents": {
                "text": true
            }
        }))
        .send()
        .await
        .map_err(|e| format!("Exa AI search request failed: {e}"))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read search response: {e}"))?;

    if !status.is_success() {
        return Err(format!("Exa AI returned HTTP {status}: {text}"));
    }

    Ok(text)
}

#[tool]
/// Remember something the user asks you to store. Call this when they say
/// "remember that...", "save this...", or ask you to record information.
/// Pass a complete, specific description of what to remember.
pub async fn store_memory(fact: String) -> Tool {
    let service = get_memory_service();
    let extracted = crate::ai::memory::extraction::ExtractedFact {
        domain: "conversations".to_string(),
        topic: "explicit".to_string(),
        title: "Explicit Memory".to_string(),
        summary: fact.chars().take(120).collect(),
        content: fact,
        tags: vec!["explicit".to_string(), "user-requested".to_string()],
        keywords: Vec::new(),
        entities: Vec::new(),
        confidence: 0.95,
        provenance: "direct".to_string(),
    };

    match service.manager().store_extracted_fact(&extracted) {
        Ok(_) => {
            let _ = service.manager().update_user_profile(&extracted);
            Ok(format!("Got it. I'll remember: {}", extracted.summary))
        }
        Err(e) => Ok(format!("Couldn't store that: {e}")),
    }
}

pub async fn chat_handler(
    Json(request): Json<VercelUIRequest>,
) -> Result<AxumSseResponse, (StatusCode, String)> {
    let session_id = request.id.clone();

    // Extract last user message BEFORE consuming request
    let user_message: String = request
        .messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .and_then(|m| m.parts.first())
        .and_then(|p| p.text.clone())
        .unwrap_or_default();

    // Clear stale tool traces for this session
    TOOL_TRACES.remove(&session_id);

    // Format conversation history for extraction context
    let conversation_history: Vec<String> = request.messages.iter()
        .rev()
        .take(6)
        .rev()
        .map(|m| {
            let texts: Vec<&str> = m.parts.iter().filter_map(|p| p.text.as_deref()).collect();
            if texts.is_empty() { return String::new(); }
            format!("{}: {}", m.role, texts.join(" "))
        })
        .filter(|s| !s.is_empty())
        .collect();
    let conversation_history = conversation_history.join("\n");

    // Update SWM with user turn BEFORE building prompt
    {
        let mut swm = crate::ai::memory::session::SESSION_REGISTRY
            .entry(session_id.clone())
            .or_insert_with(|| crate::ai::memory::session::SessionWorkingMemory::new(&session_id));
        swm.add_turn("user", &user_message, Vec::new());
    }

    let entity_ctx = get_memory_service().get_entity_context(&user_message);
    let user_profile = get_memory_service().get_user_profile();

    // Load previous session context for new sessions
    let previous_session_context = crate::ai::memory::session::load_previous_session_context(&get_app_data_dir());

    // Level 5: Proactive memory — fetch relevant memories before building prompt
    let proactive_memories = crate::ai::memory::proactive::proactive_memory_agent(
        get_memory_service().manager(),
        &user_message,
        &session_id,
    ).await;

    SESSION_ID.scope(session_id.clone(), async move {
        let messages = request.into();

        // Fetch SWM context
        let swm_prompt = if let Some(swm) = crate::ai::memory::session::SESSION_REGISTRY.get(&session_id) {
            swm.to_prompt_string()
        } else {
            String::new()
        };

        let temp = temporal_context();
        let env = environment_block();
        let tools_desc = tools_block();
        let system_prompt = format!(
            "{}\n\n{}\n\n{}\n\n{}\n\n{}\n\n{}\n\n{}\n\n{}\n\n{}\n\nUse the tools available to you when you need information. \
             If the user's question involves anything personal — names, past conversations, preferences, relationships, \
             projects — search your memory first using search_context.",
            PERSONA_PROMPT, user_profile, previous_session_context, env, temp, entity_ctx, swm_prompt, proactive_memories, tools_desc
        );

        let response = LanguageModelRequest::builder()
            .model(Opencode::minimax_m2_5_free())
            .system(system_prompt)
            .messages(messages)
            .with_tool(search_context())
            .with_tool(fetch_url())
            .with_tool(web_search())
            .with_tool(store_memory())
            .stop_when(step_count_is(5))
            .build()
            .stream_text()
            .await
            .map_err(|e| {
                eprintln!("[chat_handler] stream_text error: {e}");
                (StatusCode::INTERNAL_SERVER_ERROR, format!("AI error: {e}"))
            })?;

        // Stream Tapper: capture assistant text while streaming to the UI
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();

        let options = aisdk::integrations::vercel_aisdk_ui::VercelUIStreamOptions {
            send_reasoning: true,
            send_start: true,
            send_finish: true,
            generate_message_id: None,
        };

        let ui_stream = response.into_vercel_ui_stream(options);
        let tapped_stream = ui_stream.inspect(move |result| {
            if let Ok(aisdk::integrations::vercel_aisdk_ui::VercelUIStream::TextDelta { delta, .. }) = result {
                let _ = tx.send(delta.clone());
            }
        });

        let mapped_stream = tapped_stream.map(|result| match result {
            Ok(chunk) => {
                let json = serde_json::to_string(&chunk).map_err(|e| {
                    aisdk::error::Error::Other(format!("JSON serialization error: {e}"))
                })?;
                Ok(axum::response::sse::Event::default().data(json))
            }
            Err(e) => Err(e),
        });

        let boxed_stream: std::pin::Pin<
            Box<dyn futures::Stream<Item = aisdk::error::Result<axum::response::sse::Event>> + Send + 'static>,
        > = Box::pin(mapped_stream);

        let sse = axum::response::Sse::new(boxed_stream)
            .keep_alive(axum::response::sse::KeepAlive::new());

        // Background memory extraction + session summary
        let sid = session_id.clone();
        let user_msg = user_message.clone();
        let entity_ctx_bg = entity_ctx.clone();
        let conv_hist_bg = conversation_history.clone();
        let app_dir = get_app_data_dir();
        tokio::spawn(async move {
            let mut full_text = String::new();
            while let Some(chunk) = rx.recv().await {
                full_text.push_str(&chunk);
            }
            if !full_text.is_empty() {
                // Update SWM with assistant turn
                {
                    let mut swm = crate::ai::memory::session::SESSION_REGISTRY
                        .entry(sid.clone())
                        .or_insert_with(|| crate::ai::memory::session::SessionWorkingMemory::new(&sid));
                    swm.add_turn("assistant", &full_text, Vec::new());
                }

                let service = get_memory_service();
                let tool_trace = TOOL_TRACES.remove(&sid).map(|(_, v)| v).unwrap_or_default();
                if let Err(e) = service.extract_and_store(&sid, &user_msg, &full_text, &tool_trace, &entity_ctx_bg, &conv_hist_bg).await {
                    eprintln!("[memory_extraction] Error: {e}");
                }

                // Save session summary after this turn
                {
                    if let Some(mut swm) = crate::ai::memory::session::SESSION_REGISTRY.get_mut(&sid) {
                        let turns = swm.recent_turns.clone();
                        let app_dir_clone = app_dir.clone();
                        // Generate summary if enough turns
                        if turns.len() >= 2 {
                            match crate::ai::memory::session::summarize_session(&turns).await {
                                Ok(summary) => {
                                    if !summary.is_empty() {
                                        swm.summary = summary;
                                        crate::ai::memory::session::save_session_context(&app_dir_clone, &swm);
                                        eprintln!("[session] Summary saved for {}", sid);
                                    }
                                }
                                Err(e) => eprintln!("[session] Summary generation failed: {e}"),
                            }
                        }
                    }
                }
            }
        });

        Ok(sse)
    }).await
}

const BANNED_TITLE_WORDS: &[&str] = &[
    "greeting", "hello", "hi", "hey", "chat", "discussion", "conversation",
    "introduction", "welcome", "question", "inquiry", "query", "request",
    "message", "new", "untitled", "general", "miscellaneous", "misc",
    "unknown", "undefined", "none", "no title", "placeholder", "talk",
    "dialogue", "exchange", "interaction", "session", "update",
];

fn is_title_banned(title: &str) -> bool {
    let lower = title.to_lowercase();
    BANNED_TITLE_WORDS.iter().any(|&w| lower.contains(w))
}

fn heuristic_title(user_message: &str) -> String {
    let stop_words: &[&str] = &[
        "the", "a", "an", "is", "are", "was", "were", "be", "been",
        "being", "have", "has", "had", "do", "does", "did", "will",
        "would", "could", "should", "may", "might", "must", "shall",
        "can", "need", "dare", "ought", "used", "to", "of", "in",
        "for", "on", "with", "at", "by", "from", "as", "into",
        "through", "during", "before", "after", "above", "below",
        "between", "under", "and", "but", "or", "yet", "so", "if",
        "because", "although", "though", "while", "where", "when",
        "that", "which", "who", "whom", "whose", "what", "this",
        "these", "those", "i", "you", "he", "she", "it", "we",
        "they", "me", "him", "her", "us", "them", "my", "your",
        "his", "its", "our", "their", "mine", "yours", "hers",
        "ours", "theirs", "myself", "yourself", "himself", "herself",
        "itself", "ourselves", "yourselves", "themselves", "am",
        "here", "there", "now", "then", "today", "tomorrow",
        "yesterday", "just", "only", "also", "even", "back", "still",
        "already", "yet", "too", "very", "really", "quite", "rather",
        "pretty", "enough", "almost", "nearly", "hardly", "simply",
        "completely", "absolutely", "definitely", "certainly",
        "probably", "possibly", "perhaps", "maybe", "surely",
        "actually", "basically", "literally", "seriously", "honestly",
        "frankly", "clearly", "obviously", "apparently", "presumably",
        "supposedly", "reportedly", "allegedly", "arguably",
        "admittedly", "conceivably", "understandably", "interestingly",
        "significantly", "importantly", "fortunately", "unfortunately",
        "surprisingly", "amazingly", "remarkably", "notably",
        "especially", "particularly", "specifically", "mainly",
        "mostly", "largely", "partly", "fully", "totally", "utterly",
        "entirely", "wholly", "completely", "thoroughly", "deeply",
        "greatly", "highly", "strongly", "widely", "closely",
        "directly", "indirectly", "exactly", "precisely", "correctly",
        "properly", "easily", "readily", "quickly", "slowly", "soon",
        "early", "late", "recently", "lately", "finally", "eventually",
        "initially", "originally", "previously", "formerly", "formerly",
        "meanwhile", "otherwise", "instead", "besides", "furthermore",
        "moreover", "nevertheless", "nonetheless", "however",
        "therefore", "thus", "hence", "consequently", "accordingly",
        "subsequently", "alternatively", "similarly", "likewise",
        "conversely", "regardless", "notwithstanding", "overall",
        "generally", "typically", "usually", "normally", "commonly",
        "frequently", "often", "sometimes", "occasionally", "rarely",
        "seldom", "never", "always", "constantly", "continuously",
        "repeatedly", "regularly", "periodically", "daily", "weekly",
        "monthly", "yearly", "annually", "once", "twice", "again",
        "about", "above", "across", "after", "against", "along",
        "among", "around", "before", "behind", "beneath", "beside",
        "beyond", "despite", "down", "except", "inside", "into",
        "near", "off", "onto", "opposite", "outside", "over", "past",
        "regarding", "round", "since", "toward", "towards", "until",
        "upon", "within", "without",
    ];

    let words: Vec<&str> = user_message
        .split_whitespace()
        .filter(|w| {
            let clean = w.trim_matches(|c: char| !c.is_alphanumeric());
            !clean.is_empty()
                && !stop_words.contains(&clean.to_lowercase().as_str())
                && clean.len() > 2
        })
        .take(4)
        .collect();

    if words.is_empty() {
        return "New Chat".to_string();
    }

    words
        .iter()
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => {
                    let rest: String = chars.collect();
                    format!("{}{}", first.to_uppercase(), rest.to_lowercase())
                }
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

async fn call_title_llm(user_message: &str, assistant_message: Option<&str>, strict: bool) -> Result<String, String> {
    let system_prompt = if strict {
        r#"You generate chat conversation titles. Your previous attempt was too generic. This time, be EXTREMELY specific and concrete.

# RULES
1. Use BOTH the user message and assistant response to determine the actual topic.
2. 2-5 words, Title Case, no trailing punctuation.
3. FORBIDDEN words (never use these or variants): Greeting, Hello, Hi, Hey, Chat, Discussion, Conversation, Introduction, Welcome, Question, Inquiry, Query, Request, Message, New, Untitled, General, Miscellaneous, Misc, Unknown, Undefined, None, No Title, Placeholder, Talk, Dialogue, Exchange, Interaction, Session, Update.
4. If the user only greets, the assistant's response reveals the domain — use that.
5. ALWAYS name specific people, projects, technologies, or concepts.
6. Examples of SPECIFIC titles:
   - "Orkestrate Memory Agent"
   - "Mia's Exam Stress"
   - "Rust Borrow Checker Debug"
   - "Tokyo Weather Forecast"
   - "React Component Refactor"

Output exactly: {"title": "The Title"}"#
    } else {
        r#"You generate chat conversation titles. Your output must capture the ACTUAL topic being discussed — never a generic label.

# INPUT
- user_message: the user's first message
- assistant_message: the assistant's first response (may be empty)

# RULES
1. Use BOTH messages to infer the real topic. The assistant's response often reveals what the user actually wants.
2. 2-5 words, Title Case, no trailing punctuation.
3. FORBIDDEN words (never use these or variants): Greeting, Hello, Hi, Hey, Chat, Discussion, Conversation, Introduction, Welcome, Question, Inquiry, Query, Request, Message, New, Untitled, General, Miscellaneous, Misc, Unknown, Undefined, None, No Title, Placeholder, Talk, Dialogue, Exchange, Interaction, Session, Update.
4. If the user only greets, the assistant's response reveals the domain — use that.
5. ALWAYS name specific people, projects, technologies, or concepts when they appear.
6. Bad → Good:
   - "Work Stress" → "Mia's Work Stress"
   - "Project" → "Orkestrate Memory Agent"
   - "Code Help" → "Rust Profile Refactor"
   - "Greeting" → "Orkestrate Introduction"

# EXAMPLES
User: "hey" | Assistant: "Hey! I'm Orkestrate, your personal AI. How can I help today?" → {"title": "Orkestrate Introduction"}
User: "My sister Mia is stressed about her exam" | Assistant: "" → {"title": "Mia's Exam Stress"}
User: "Can you help me debug this Rust code?" | Assistant: "Sure, let's look at the borrow checker error..." → {"title": "Rust Borrow Checker Debug"}
User: "What's the weather in Tokyo?" | Assistant: "Let me check that for you..." → {"title": "Tokyo Weather"}
User: "I'm building an app called Orkestrate" | Assistant: "That sounds interesting! What kind of app is it?" → {"title": "Orkestrate App Build"}

Output exactly: {"title": "The Title"}"#
    };

    let content = if let Some(am) = assistant_message {
        if am.trim().is_empty() {
            format!("User message:\n{}\n\nAssistant message:\n(none yet)", user_message)
        } else {
            format!("User message:\n{}\n\nAssistant message:\n{}", user_message, am)
        }
    } else {
        format!("User message:\n{}\n\nAssistant message:\n(none yet)", user_message)
    };

    let response = LanguageModelRequest::builder()
        .model(Opencode::minimax_m2_5_free())
        .system(system_prompt.to_string())
        .messages(vec![
            aisdk::core::Message::User(aisdk::core::UserMessage { content }),
        ])
        .build()
        .generate_text()
        .await
        .map_err(|e| format!("AI generation failed: {e}"))?;

    let text = response.text().ok_or("No response text found")?;

    let json_start = text.find('{').ok_or("No JSON found")?;
    let json_end = text.rfind('}').ok_or("No JSON found")? + 1;
    let json_str = &text[json_start..json_end];

    let chat_title: ChatTitle = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse title JSON: {e}"))?;

    Ok(chat_title.title)
}

#[tauri::command]
pub async fn generate_chat_title(
    user_message: String,
    assistant_message: Option<String>,
) -> Result<String, String> {
    // First attempt
    let title = call_title_llm(&user_message, assistant_message.as_deref(), false).await?;

    if !is_title_banned(&title) {
        eprintln!("[title] Generated: '{}'", title);
        return Ok(title);
    }

    eprintln!("[title] First attempt banned: '{}', retrying strict...", title);

    // Retry with stricter prompt
    let title = call_title_llm(&user_message, assistant_message.as_deref(), true).await?;

    if !is_title_banned(&title) {
        eprintln!("[title] Retry succeeded: '{}'", title);
        return Ok(title);
    }

    eprintln!("[title] Retry also banned: '{}', using heuristic", title);

    // Heuristic fallback
    let fallback = heuristic_title(&user_message);
    eprintln!("[title] Heuristic fallback: '{}'", fallback);
    Ok(fallback)
}
