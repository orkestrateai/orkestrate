import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface LearnQueueItem {
	id: string;
	type_: string;
	question: string;
	context: string | null;
	status: string;
	created_at: string;
}

export interface LearnMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
}

class LearnStore {
	messages = $state<LearnMessage[]>([]);
	queue = $state<LearnQueueItem[]>([]);
	isStreaming = $state(false);
	pendingCount = $state(0);
	isOpen = $state(false);
	isQueueEmpty = $derived(this.pendingCount === 0);
	currentItemId = $derived(this.queue[0]?.id ?? null);

	constructor() {
		this.loadPendingCount();
		this.loadHistory();
		this.loadQueue();
	}

	async loadPendingCount() {
		try {
			const count = await invoke<number>("count_pending_learn_items");
			this.pendingCount = count;
		} catch (e) {
			console.error("Failed to load learn count:", e);
		}
	}

	async loadQueue() {
		try {
			const items = await invoke<LearnQueueItem[]>("get_learn_queue");
			this.queue = items;
		} catch (e) {
			console.error("Failed to load learn queue:", e);
			this.queue = [];
		}
	}

	async loadHistory() {
		try {
			const stored = await invoke<Array<{ role: string; content: string }>>("get_messages", {
				sessionId: "__learn__",
				limit: 50
			});
			this.messages = stored.map((m, i) => ({
				id: `learn-${i}`,
				role: m.role as "user" | "assistant",
				content: m.content
			}));
		} catch (e) {
			console.error("Failed to load learn history:", e);
			this.messages = [];
		}
	}

	/// Shared streaming logic for both starting a conversation and answering.
	private async runConversation(history: Array<{ role: string; content: string }>) {
		if (this.isStreaming) return;
		this.isStreaming = true;

		const requestId = crypto.randomUUID();

		const unlistenChunk = await listen<{
			requestId: string;
			content: string;
		}>("learn-chunk", (event) => {
			if (event.payload.requestId === requestId) {
				const last = this.messages[this.messages.length - 1];
				if (last && last.role === "assistant") {
					last.content += event.payload.content;
				} else {
					this.messages.push({
						id: requestId,
						role: "assistant",
						content: event.payload.content
					});
				}
			}
		});

		const unlistenDone = await listen<{
			requestId: string;
		}>("learn-done", (event) => {
			if (event.payload.requestId === requestId) {
				this.isStreaming = false;
			}
		});

		try {
			await invoke("run_learn", { requestId, history });
		} catch (err) {
			console.error("Learn agent error:", err);
			this.isStreaming = false;
			this.messages.push({
				id: crypto.randomUUID(),
				role: "assistant",
				content: "Sorry, something went wrong. Try again?"
			});
		} finally {
			setTimeout(() => {
				unlistenChunk();
				unlistenDone();
			}, 5000);
		}
	}

	/// Send a user answer and get the next response.
	async sendAnswer(content: string) {
		// Add user message locally and persist
		this.messages.push({
			id: crypto.randomUUID(),
			role: "user",
			content
		});

		try {
			await invoke("save_message", {
				sessionId: "__learn__",
				role: "user",
				content,
				toolCallId: null,
				toolCalls: null
			});
		} catch (e) {
			console.error("Failed to save learn message:", e);
		}

		const history = this.messages.map((m) => ({
			role: m.role,
			content: m.content
		}));

		await this.runConversation(history);

		// After the agent responds, process the answer in background
		this.processAnswer(this.currentItemId);
	}

	async processAnswer(targetItemId: string | null) {
		try {
			const history = this.messages.map((m) => ({
				role: m.role,
				content: m.content
			}));
			await invoke("process_learn_answer", { history, targetItemId });
			// Refresh queue and count after processing
			await this.loadQueue();
			await this.loadPendingCount();
		} catch (e) {
			console.error("Failed to process learn answer:", e);
		}
	}

	async toggle() {
		this.isOpen = !this.isOpen;
		if (!this.isOpen) return;

		await this.loadPendingCount();
		await this.loadHistory();
		await this.loadQueue();
	}

	close() {
		this.isOpen = false;
	}

	async dismissItem(id: string) {
		try {
			await invoke("dismiss_learn_item", { id });
			await this.loadQueue();
			await this.loadPendingCount();
		} catch (e) {
			console.error("Failed to dismiss learn item:", e);
		}
	}

	async snoozeItem(id: string) {
		try {
			await invoke("snooze_learn_item", { id });
			await this.loadQueue();
			await this.loadPendingCount();
		} catch (e) {
			console.error("Failed to snooze learn item:", e);
		}
	}
}

export const learnStore = new LearnStore();
