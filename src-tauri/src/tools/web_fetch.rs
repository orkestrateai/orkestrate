use async_trait::async_trait;
use serde_json::{json, Value};

use crate::timer::Timer;

use super::Tool;

const MAX_RESPONSE_SIZE: usize = 5 * 1024 * 1024; // 5MB
const DEFAULT_TIMEOUT_SECS: u64 = 30;
const MAX_TIMEOUT_SECS: u64 = 120;
const MAX_OUTPUT_CHARS: usize = 50000;

/// Native web fetch tool — fetches any URL and converts to readable text.
pub struct WebFetchTool;

#[async_trait]
impl Tool for WebFetchTool {
    fn name(&self) -> &'static str {
        "web_fetch"
    }

    fn description(&self) -> &'static str {
        "Fetch content from a specific URL. Converts HTML pages to clean markdown and extracts text from PDFs. \
Use this when the user references a URL, or when web_search results point to a page \
worth reading in full. Supports text, markdown, and HTML output formats. \
Can also extract and analyze text from PDF documents."
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The URL to fetch content from. Must start with http:// or https://"
                },
                "format": {
                    "type": "string",
                    "enum": ["text", "markdown", "html"],
                    "default": "markdown",
                    "description": "Output format: markdown (clean, default), text (plain), or html (raw)."
                },
                "timeout": {
                    "type": "number",
                    "description": "Timeout in seconds (max 120). Defaults to 30."
                }
            },
            "required": ["url"]
        })
    }

    async fn execute(&self, args: Value) -> Result<String, String> {
        let _timer = Timer::new("tool::web_fetch");
        let url = args["url"].as_str().ok_or("Missing 'url' parameter")?;
        let format = args["format"].as_str().unwrap_or("markdown");
        let timeout_secs = args["timeout"]
            .as_u64()
            .unwrap_or(DEFAULT_TIMEOUT_SECS)
            .clamp(1, MAX_TIMEOUT_SECS);

        if !url.starts_with("http://") && !url.starts_with("https://") {
            return Err("URL must start with http:// or https://".to_string());
        }

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(timeout_secs))
            .build()
            .map_err(|e| format!("HTTP client build failed: {}", e))?;

        // Build Accept header based on format
        let accept = match format {
            "markdown" => "text/markdown;q=1.0, text/plain;q=0.8, text/html;q=0.7, application/pdf;q=0.5, */*;q=0.1",
            "text" => "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, application/pdf;q=0.5, */*;q=0.1",
            "html" => "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, application/pdf;q=0.5, */*;q=0.1",
            _ => "*/*",
        };

        let response = client
            .get(url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            .header("Accept", accept)
            .header("Accept-Language", "en-US,en;q=0.9")
            .send()
            .await
            .map_err(|e| format!("Fetch failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            return Err(format!("HTTP {} when fetching {}", status, url));
        }

        // Check content length
        if let Some(cl) = response.content_length() {
            if cl as usize > MAX_RESPONSE_SIZE {
                return Err(format!("Response too large: {} bytes (max 5MB)", cl));
            }
        }

        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_lowercase();

        let bytes = response.bytes().await.map_err(|e| format!("Read body: {}", e))?;
        if bytes.len() > MAX_RESPONSE_SIZE {
            return Err(format!("Response too large: {} bytes (max 5MB)", bytes.len()));
        }

        let mime = content_type.split(';').next().unwrap_or("").trim();

        // Handle PDF files
        if mime == "application/pdf" || url.ends_with(".pdf") {
            return extract_pdf_text(&bytes, url);
        }

        // Handle images
        if mime.starts_with("image/") && !mime.contains("svg") {
            return Ok(format!("[Image content from {} — {} bytes, type: {}]", url, bytes.len(), mime));
        }

        // Handle other binary types
        if is_binary_mime(mime) {
            return Ok(format!(
                "[Binary file from {} — {} bytes, type: {}]\n\n\
                This appears to be a binary file that can't be read as text. \
                Try a different URL or format.",
                url, bytes.len(), mime
            ));
        }

        let content = String::from_utf8_lossy(&bytes);

        // Convert based on format
        let output = match format {
            "markdown" => {
                if content_type.contains("html") || content.contains("<html") || content.contains("<body") {
                    convert_html_to_markdown(&content)
                } else {
                    content.to_string()
                }
            }
            "text" => {
                if content_type.contains("html") || content.contains("<html") || content.contains("<body") {
                    extract_text_from_html(&content)
                } else {
                    content.to_string()
                }
            }
            "html" => content.to_string(),
            _ => content.to_string(),
        };

        Ok(truncate_output(&output, url))
    }
}

/// Extract text from a PDF document.
fn extract_pdf_text(bytes: &[u8], url: &str) -> Result<String, String> {
    match pdf_extract::extract_text_from_mem(bytes) {
        Ok(text) => {
            let cleaned = text.trim().to_string();
            if cleaned.is_empty() {
                Ok(format!(
                    "[PDF from {} — {} bytes]\n\n\
                    The PDF appears to be scanned or image-based with no extractable text. \
                    Try the HTML abstract page if available.",
                    url, bytes.len()
                ))
            } else {
                let output = format!("PDF from {}:\n\n{}", url, cleaned);
                Ok(truncate_output_string(output))
            }
        }
        Err(e) => Ok(format!(
            "[PDF from {} — {} bytes]\n\n\
            Could not extract text from PDF: {}\n\
            Try the HTML abstract page if available.",
            url, bytes.len(), e
        )),
    }
}

/// Check if a MIME type represents binary content we can't parse.
fn is_binary_mime(mime: &str) -> bool {
    matches!(mime,
        "application/octet-stream"
        | "application/zip"
        | "application/gzip"
        | "application/x-tar"
        | "application/x-rar-compressed"
        | "application/x-7z-compressed"
        | "application/msword"
        | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        | "application/vnd.ms-excel"
        | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        | "application/vnd.ms-powerpoint"
        | "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )
}

/// Safely truncate output to MAX_OUTPUT_CHARS without panicking on multi-byte UTF-8 chars.
fn truncate_output(output: &str, url: &str) -> String {
    if output.chars().count() <= MAX_OUTPUT_CHARS {
        format!("Fetched from {}:\n\n{}", url, output)
    } else {
        // Find the byte position at which we've seen MAX_OUTPUT_CHARS characters
        let mut char_count = 0;
        let mut byte_pos = 0;
        for (pos, _) in output.char_indices() {
            if char_count >= MAX_OUTPUT_CHARS {
                byte_pos = pos;
                break;
            }
            char_count += 1;
            byte_pos = pos + 1; // in case we don't hit the limit
        }
        
        format!(
            "{}\n\n[Content truncated — fetched {} chars total from {}]",
            &output[..byte_pos],
            output.chars().count(),
            url
        )
    }
}

/// Truncate an already-formatted string.
fn truncate_output_string(output: String) -> String {
    if output.chars().count() <= MAX_OUTPUT_CHARS {
        output
    } else {
        let mut char_count = 0;
        let mut byte_pos = 0;
        for (pos, _) in output.char_indices() {
            if char_count >= MAX_OUTPUT_CHARS {
                byte_pos = pos;
                break;
            }
            char_count += 1;
            byte_pos = pos + 1;
        }
        
        format!(
            "{}\n\n[Content truncated — {} chars total]",
            &output[..byte_pos],
            output.chars().count()
        )
    }
}

fn convert_html_to_markdown(html: &str) -> String {
    html2md::parse_html(html)
}

fn extract_text_from_html(html: &str) -> String {
    // Simple HTML tag stripping
    let mut text = String::new();
    let mut in_tag = false;
    let mut in_script = false;

    for c in html.chars() {
        if c == '<' {
            in_tag = true;
            // Check if it's a script/style tag
            let rest: String = html[c.to_string().len()..].chars().take(10).collect();
            let lower = rest.to_lowercase();
            if lower.starts_with("script") || lower.starts_with("style") {
                in_script = true;
            }
        } else if c == '>' {
            in_tag = false;
            in_script = false;
        } else if !in_tag && !in_script {
            text.push(c);
        }
    }

    // Collapse whitespace
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}
