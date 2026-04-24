use async_trait::async_trait;
use serde_json::{json, Value};

use crate::timer::Timer;

use super::Tool;

const EXA_API_BASE: &str = "https://api.exa.ai/search";
const MCP_EXA_URL: &str = "https://mcp.exa.ai/mcp";

/// Native web search tool — calls Exa AI directly via REST API or MCP.
pub struct WebSearchTool;

#[async_trait]
impl Tool for WebSearchTool {
    fn name(&self) -> &'static str {
        "web_search"
    }

    fn description(&self) -> &'static str {
        "Search the web for current information, news, facts, and recent data. \
Use this when the user asks about current events, recent developments, \
or facts you don't already know. Always include the current year in time-sensitive queries. \
Returns a summary of the top search results with titles, snippets, and sources."
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query. For recent/current topics, include the year (e.g., 'AI news 2026')."
                },
                "numResults": {
                    "type": "number",
                    "default": 8,
                    "description": "Number of results to return (1-20)."
                },
                "type": {
                    "type": "string",
                    "enum": ["auto", "fast", "deep"],
                    "default": "auto",
                    "description": "Search depth: auto (balanced), fast (quick), deep (comprehensive)."
                },
                "livecrawl": {
                    "type": "string",
                    "enum": ["fallback", "preferred"],
                    "default": "fallback",
                    "description": "Live crawl mode: fallback (use cache if available) or preferred (always fetch fresh)."
                }
            },
            "required": ["query"]
        })
    }

    async fn execute(&self, args: Value) -> Result<String, String> {
        let _timer = Timer::new("tool::web_search");
        let query = args["query"].as_str().ok_or("Missing 'query' parameter")?;
        let num_results = args["numResults"].as_u64().unwrap_or(8).clamp(1, 20) as usize;
        let search_type = args["type"].as_str().unwrap_or("auto");
        let livecrawl = args["livecrawl"].as_str().unwrap_or("fallback");

        // Try MCP first, then fall back to direct REST API
        match search_via_mcp(query, num_results, search_type, livecrawl).await {
            Ok(result) => Ok(result),
            Err(mcp_err) => {
                println!(
                    "[WebSearch] MCP failed ({}), trying direct Exa API...",
                    mcp_err
                );
                search_via_rest(query, num_results, search_type, livecrawl).await
            }
        }
    }
}

async fn search_via_mcp(
    query: &str,
    num_results: usize,
    search_type: &str,
    livecrawl: &str,
) -> Result<String, String> {
    let api_key = std::env::var("EXA_API_KEY").map_err(|_| "No EXA_API_KEY set")?;

    let mut client = crate::mcp::McpClient::connect(
        "exa",
        &crate::mcp::types::ServerConfig::Http {
            url: MCP_EXA_URL.to_string(),
            headers: {
                let mut h = std::collections::HashMap::new();
                h.insert("Authorization".to_string(), format!("Bearer {}", api_key));
                Some(h)
            },
        },
    )
    .await?;

    let result = client
        .call_tool(
            "web_search_exa",
            json!({
                "query": query,
                "type": search_type,
                "numResults": num_results,
                "livecrawl": livecrawl,
            }),
        )
        .await?;

    client.disconnect().await;
    Ok(format_search_results(query, &result))
}

async fn search_via_rest(
    query: &str,
    num_results: usize,
    _search_type: &str,
    _livecrawl: &str,
) -> Result<String, String> {
    let api_key = std::env::var("EXA_API_KEY").map_err(|_| "No EXA_API_KEY set")?;

    let client = reqwest::Client::new();
    let request = json!({
        "query": query,
        "numResults": num_results,
        "contents": {
            "text": true,
            "highlights": true
        },
        "useAutoprompt": true
    });

    let response = client
        .post(EXA_API_BASE)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Exa API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Exa API Error {}: {}", status, body));
    }

    let data: Value = response
        .json()
        .await
        .map_err(|e| format!("JSON parse: {}", e))?;
    let empty_vec = vec![];
    let results = data["results"].as_array().unwrap_or(&empty_vec);

    let mut output = format!("Search results for \"{}\":\n\n", query);
    for (i, result) in results.iter().enumerate() {
        let title = result["title"].as_str().unwrap_or("(no title)");
        let url = result["url"].as_str().unwrap_or("");
        let text = result["text"].as_str().unwrap_or("");
        let published = result["publishedDate"].as_str().unwrap_or("");

        output.push_str(&format!(
            "{}. {}\n   URL: {}\n   Date: {}\n   Summary: {}\n\n",
            i + 1,
            title,
            url,
            if published.is_empty() {
                "unknown"
            } else {
                published
            },
            if text.len() > 300 { &text[..300] } else { text }
        ));
    }

    if results.is_empty() {
        output.push_str("No results found.");
    }

    Ok(output)
}

fn format_search_results(query: &str, raw: &str) -> String {
    // MCP results are already formatted by Exa, but we can clean them up
    format!("Search results for \"{}\":\n\n{}", query, raw)
}
