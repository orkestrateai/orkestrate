import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { modelService } from "./models.svelte";

export interface ToolCall {
    id: string;
    tool: string;
    args: Record<string, any>;
    status: "pending" | "done";
    result?: string;
}

export interface Message {
    id: string;
    role: "user" | "assistant" | "action";
    content: string;
    reasoning?: string;
    toolCalls?: ToolCall[];
}

class LLMService {
    messages = $state<Message[]>([]);
    isStreaming = $state(false);
    isConversationStarted = $state(false);

    /**
     * Adds an action feedback message (e.g., "Applied Dark Theme").
     */
    showAction(content: string) {
        this.messages.push({
            id: crypto.randomUUID(),
            role: "action",
            content
        });
        this.isConversationStarted = true;
    }

    /**
     * Sends a new prompt to the brain, maintaining history context.
     * Non-blocking to allow concurrent prompts.
     */
    async stream(prompt: string) {
        const requestId = crypto.randomUUID();
        this.isStreaming = true;
        this.isConversationStarted = true;
        
        // Add user message to local state
        this.messages.push({
            id: crypto.randomUUID(),
            role: "user",
            content: prompt
        });

        // Add placeholder assistant message
        const assistantMsg: Message = {
            id: requestId,
            role: "assistant",
            content: "",
            toolCalls: []
        };
        this.messages.push(assistantMsg);
        
        this.isStreaming = true;

        // Persistent listeners for chunks
        const unlistenChat = await listen<{ requestId: string; content: string }>("chat-chunk", (event) => {
            if (event.payload.requestId === requestId) {
                const msg = this.messages.find(m => m.id === requestId);
                if (msg) {
                    msg.content += event.payload.content;
                }
            }
        });

        const unlistenReasoning = await listen<{ requestId: string; content: string }>("reasoning-chunk", (event) => {
            if (event.payload.requestId === requestId) {
                const msg = this.messages.find(m => m.id === requestId);
                if (msg) {
                    msg.reasoning = (msg.reasoning || "") + event.payload.content;
                }
            }
        });

        // Tool call listeners
        const unlistenToolCall = await listen<{ request_id: string; tool: string; args: Record<string, any>; id: string }>("tool-call", (event) => {
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

        const unlistenToolResult = await listen<{ request_id: string; tool: string; result: string; id: string }>("tool-result", (event) => {
            if (event.payload.request_id === requestId) {
                const msg = this.messages.find(m => m.id === requestId);
                if (msg && msg.toolCalls) {
                    const tc = msg.toolCalls.find(t => t.id === event.payload.id);
                    if (tc) {
                        tc.status = "done";
                        tc.result = event.payload.result;
                    }
                }
            }
        });

        const history = this.messages
            .filter(m => m.role !== "action")
            .map(m => ({
                role: m.role,
                content: m.content
            }))
            .filter(m => m.content !== "");

        try {
            await invoke("chat_opencode", {
                requestId: requestId,
                history,
                model: modelService.activeModel.id,
            });
        } catch (err) {
            console.error("LLM Stream Error:", err);
            const msg = this.messages.find(m => m.id === requestId);
            if (msg) msg.content = "Error connecting to brain.";
        } finally {
            unlistenChat();
            unlistenReasoning();
            unlistenToolCall();
            unlistenToolResult();
            // Only stop streaming if this was the last active request
            if (!this.messages.some(m => m.role === 'assistant' && m.content === "")) {
                this.isStreaming = false;
            }
        }
    }

    reset() {
        this.messages = [];
        this.isStreaming = false;
        this.isConversationStarted = false;
    }
}

export const llmService = new LLMService();
