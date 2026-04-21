use async_openai::{
    config::OpenAIConfig,
    types::chat::{
        ChatCompletionRequestMessage, ChatCompletionRequestSystemMessage,
        ChatCompletionRequestUserMessage, ChatCompletionRequestUserMessageContent,
        ChatCompletionRequestAssistantMessage, ChatCompletionRequestToolMessage,
        ChatCompletionTool, CreateChatCompletionRequest, ChatCompletionResponseStream,
        ChatCompletionMessageToolCall,
    },
    Client,
};

/// Wraps async-openai client configured for OpenCode Zen.
pub struct LlmClient {
    client: Client<OpenAIConfig>,
}

impl LlmClient {
    pub fn new(api_key: String) -> Self {
        let config = OpenAIConfig::new()
            .with_api_key(api_key)
            .with_api_base("https://opencode.ai/zen/v1".to_string());

        Self {
            client: Client::with_config(config),
        }
    }

    /// Stream a chat completion with optional tools.
    pub async fn stream_chat(
        &self,
        model: String,
        messages: Vec<ChatCompletionRequestMessage>,
        tools: Vec<ChatCompletionTool>,
    ) -> Result<ChatCompletionResponseStream, async_openai::error::OpenAIError> {
        let request = CreateChatCompletionRequest {
            model,
            messages,
            tools: if tools.is_empty() { None } else { Some(tools) },
            stream: Some(true),
            ..Default::default()
        };

        self.client.chat().create_stream(request).await
    }
}

/// Convert our simple history format to async-openai messages.
pub fn history_to_openai_messages(
    history: Vec<crate::HistoryMessage>,
) -> Vec<ChatCompletionRequestMessage> {
    let mut messages = vec![system_message()];

    for msg in history {
        let m = match msg.role.as_str() {
            "user" => ChatCompletionRequestMessage::User(ChatCompletionRequestUserMessage {
                content: ChatCompletionRequestUserMessageContent::Text(msg.content),
                ..Default::default()
            }),
            "assistant" => ChatCompletionRequestMessage::Assistant(ChatCompletionRequestAssistantMessage {
                content: Some(msg.content),
                ..Default::default()
            }),
            _ => continue,
        };
        messages.push(m);
    }

    messages
}

fn system_message() -> ChatCompletionRequestMessage {
    ChatCompletionRequestMessage::System(ChatCompletionRequestSystemMessage {
        content: "You are Orkestrate, a helpful AI assistant. You have access to tools that let you control the application. When the user asks to change the theme, switch models, or reset the chat, use the appropriate tool.".to_string(),
        ..Default::default()
    })
}

/// Append an assistant tool-call message to the history.
pub fn append_assistant_tool_call(
    messages: &mut Vec<ChatCompletionRequestMessage>,
    tool_calls: Vec<ChatCompletionMessageToolCall>,
) {
    messages.push(ChatCompletionRequestMessage::Assistant(
        ChatCompletionRequestAssistantMessage {
            content: None,
            tool_calls: Some(tool_calls),
            ..Default::default()
        },
    ));
}

/// Append a tool result message to the history.
pub fn append_tool_result(
    messages: &mut Vec<ChatCompletionRequestMessage>,
    tool_call_id: String,
    result: String,
) {
    messages.push(ChatCompletionRequestMessage::Tool(
        ChatCompletionRequestToolMessage {
            content: result,
            tool_call_id,
        },
    ));
}
