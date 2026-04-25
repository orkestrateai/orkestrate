import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { sidebarStore } from "./sidebar.svelte";

export interface ToolCall {
	id: string;
	tool: string;
	args: Record<string, any>;
	status: "pending" | "done";
	result?: string;
}

	export type ToolStep =
	| { type: "context_search"; label: string; queries: string[] }
	| { type: "memory_search"; label: string; queries: string[] }
	| { type: "web_search"; label: string; query: string }
	| { type: "web_fetch"; label: string; url: string }
	| { type: "mcp_tool"; label: string; server: string; tool: string }
	| { type: "generic"; label: string; detail?: string };

export interface Message {
	id: string;
	role: "user" | "assistant" | "action" | "tool";
	content: string;
	reasoning?: string;
	tool_call_id?: string;
	toolCalls?: ToolCall[];
	toolSteps?: ToolStep[];
}

export interface StoredMessage {
	id: string;
	session_id: string;
	role: string;
	content: string;
	timestamp: string;
	tool_call_id?: string;
	tool_calls?: string;
}

class ChatStore {
	messages = $state<Message[]>([]);
	isStreaming = $state(false);
	isConversationStarted = $state(false);
	currentTitle = $state("New Chat");

	async loadMessages(sessionId: string) {
		try {
			const stored = await invoke<StoredMessage[]>('get_messages', {
				sessionId,
				limit: 50
			});

			this.messages = stored.map(m => {
				if (m.role === "assistant" && m.tool_calls) {
					const toolCalls = JSON.parse(m.tool_calls).map((tc: any) => ({
						id: tc.id,
						tool: tc.function.name,
						args: JSON.parse(tc.function.arguments),
						status: "done" as const
					}));
					return {
						id: m.id,
						role: m.role as "assistant",
						content: m.content,
						toolCalls
					};
				}
				if (m.role === "tool") {
					return {
						id: m.id,
						role: m.role as "tool",
						content: m.content,
						tool_call_id: m.tool_call_id
					};
				}
				return {
					id: m.id,
					role: m.role as "user" | "assistant",
					content: m.content
				};
			});

			this.isConversationStarted = this.messages.length > 0;
			this.updateTitle();
		} catch (e) {
			console.error('Failed to load messages:', e);
			this.messages = [];
			this.isConversationStarted = false;
		}
	}

	showAction(content: string) {
		this.messages.push({
			id: crypto.randomUUID(),
			role: "action",
			content
		});
		this.isConversationStarted = true;
	}

	async stream(prompt: string, model: string) {
		// Lazy session creation: ensure we have a session
		let sessionId = sidebarStore.currentSessionId;
		let sessionName = sidebarStore.currentSessionName;

		if (!sessionId) {
			// Create session named after first message
			const name = prompt.slice(0, 50) + (prompt.length > 50 ? "..." : "");
			sessionId = await invoke<string>('create_session', { name });
			await sidebarStore.loadSessions();
			sidebarStore.switchSession(sessionId);
			// Update session name on backend
			await invoke('update_session_name', { sessionId, name });
			sessionName = name;
		}

		const requestId = crypto.randomUUID();
		this.isStreaming = true;
		this.isConversationStarted = true;

		// Add user message
		this.messages.push({
			id: crypto.randomUUID(),
			role: "user",
			content: prompt
		});

		// Save user message
		try {
			await invoke('save_message', {
				sessionId,
				role: 'user',
				content: prompt,
				toolCallId: null,
				toolCalls: null
			});
		} catch (e) {
			console.error('Failed to save user message:', e);
		}

		// Add placeholder assistant message
		const assistantMsg: Message = {
			id: requestId,
			role: "assistant",
			content: "",
			toolCalls: [],
			toolSteps: []
		};
		this.messages.push(assistantMsg);

		// Listeners
		const unlistenChat = await listen<{
			requestId: string;
			content: string;
		}>("chat-chunk", (event) => {
			if (event.payload.requestId === requestId) {
				const msg = this.messages.find(m => m.id === requestId);
				if (msg) msg.content += event.payload.content;
			}
		});

		const unlistenReasoning = await listen<{
			requestId: string;
			content: string;
		}>("reasoning-chunk", (event) => {
			if (event.payload.requestId === requestId) {
				const msg = this.messages.find(m => m.id === requestId);
				if (msg) msg.reasoning = (msg.reasoning || "") + event.payload.content;
			}
		});

		const unlistenToolCall = await listen<{
			request_id: string;
			tool: string;
			args: Record<string, any>;
			id: string;
		}>("tool-call", (event) => {
			if (event.payload.request_id === requestId) {
				const msg = this.messages.find(m => m.id === requestId);
				if (msg && msg.toolCalls) {
					msg.toolCalls = [...msg.toolCalls, {
						id: event.payload.id,
						tool: event.payload.tool,
						args: event.payload.args,
						status: "pending"
					}];
				}
			}
		});

		const unlistenToolResult = await listen<{
			request_id: string;
			tool: string;
			result: string;
			id: string;
		}>("tool-result", (event) => {
			if (event.payload.request_id === requestId) {
				const msg = this.messages.find(m => m.id === requestId);
				if (msg && msg.toolCalls) {
					const tc = msg.toolCalls.find(t => t.id === event.payload.id);
					if (tc) {
						tc.status = "done";
						tc.result = event.payload.result;
					}
				}
				// Create a persistent tool message for context retention
				this.messages.push({
					id: crypto.randomUUID(),
					role: "tool",
					content: event.payload.result,
					tool_call_id: event.payload.id
				});
			}
		});

		const unlistenMemorySearch = await listen<{
			requestId: string;
			queries: string[];
			resultCount: number;
		}>("memory-search-step", (event) => {
			if (event.payload.requestId === requestId) {
				const msg = this.messages.find(m => m.id === requestId);
				if (msg) {
					msg.toolSteps = [...(msg.toolSteps || []), {
						type: "memory_search",
						label: "Looked through your context",
						queries: event.payload.queries
					}];
				}
			}
		});

		const unlistenWebSearch = await listen<{
			requestId: string;
			query: string;
		}>("web-search-step", (event) => {
			if (event.payload.requestId === requestId) {
				const msg = this.messages.find(m => m.id === requestId);
				if (msg) {
					msg.toolSteps = [...(msg.toolSteps || []), {
						type: "web_search",
						label: `Searching web for "${event.payload.query}"`,
						query: event.payload.query
					}];
				}
			}
		});

		const unlistenWebFetch = await listen<{
			requestId: string;
			url: string;
		}>("web-fetch-step", (event) => {
			if (event.payload.requestId === requestId) {
				const msg = this.messages.find(m => m.id === requestId);
				if (msg) {
					msg.toolSteps = [...(msg.toolSteps || []), {
						type: "web_fetch",
						label: `Fetching ${new URL(event.payload.url).hostname}`,
						url: event.payload.url
					}];
				}
			}
		});

		const history = this.messages
			.filter(m => m.role !== "action")
			.filter(m => m.content !== "" || m.role === "tool" || (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0))
			.map(m => {
				const base: any = { role: m.role, content: m.content };
				if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
					base.tool_calls = JSON.stringify(m.toolCalls.map(tc => ({
						id: tc.id,
						type: "function",
						function: {
							name: tc.tool,
							arguments: JSON.stringify(tc.args)
						}
					})));
				}
				if (m.role === "tool") {
					base.tool_call_id = m.tool_call_id;
				}
				return base;
			});

		try {
			await invoke("chat_opencode", {
				requestId,
				sessionId,
				sessionName,
				history,
				model,
			});

			// Backend now saves all assistant and tool messages automatically.
			// Generate a proper session name after the first exchange (non-blocking)
			const msg = this.messages.find(m => m.id === requestId);
			if (msg && msg.content) {
				const userCount = this.messages.filter(m => m.role === "user").length;
				if (userCount === 1) {
					invoke('generate_session_name', {
						sessionId,
						userMessage: prompt,
						assistantMessage: msg.content
					}).then((name) => {
						const s = sidebarStore.sessions.find(s => s.id === sessionId);
						if (s) s.name = name as string;
					}).catch((e) => {
						console.error("Failed to generate session name:", e);
					});
				}
			}

			this.updateTitle();
		} catch (err) {
			console.error("LLM Stream Error:", err);
			const msg = this.messages.find(m => m.id === requestId);
			if (msg) msg.content = "Error connecting to brain.";
		} finally {
			unlistenChat();
			unlistenReasoning();
			unlistenToolCall();
			unlistenToolResult();
			unlistenMemorySearch();
			unlistenWebSearch();
			unlistenWebFetch();
			this.isStreaming = false;
		}
	}

	reset() {
		this.messages = [];
		this.isStreaming = false;
		this.isConversationStarted = false;
		this.currentTitle = "New Chat";
	}

	private updateTitle() {
		const firstUser = this.messages.find(m => m.role === "user");
		if (firstUser) {
			this.currentTitle =
				firstUser.content.slice(0, 50) +
				(firstUser.content.length > 50 ? "..." : "");
		} else {
			this.currentTitle = "New Chat";
		}
	}
}

export const chatStore = new ChatStore();
