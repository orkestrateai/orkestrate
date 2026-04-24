<script lang="ts">
	import Message from "./Message.svelte";
	import ChatInput from "./ChatInput.svelte";
	import EmptyState from "./EmptyState.svelte";
	import { chatStore } from "$lib/stores/chat.svelte";
	import { sidebarStore } from "$lib/stores/sidebar.svelte";
	import { onMount } from "svelte";
	import { listen } from "@tauri-apps/api/event";
	import { invoke } from "@tauri-apps/api/core";
	import { ArrowDown, Trash2 } from "lucide-svelte";
	import { fade } from "svelte/transition";

	let { onsend } = $props<{ onsend?: (msg: string) => void }>();

	let scrollContainer: HTMLElement | undefined = $state();
	let showScrollButton = $state(false);
	let chatInputRef: any = $state();

	function checkScroll() {
		if (!scrollContainer) return;
		const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
		showScrollButton = scrollTop + clientHeight < scrollHeight - 100;
	}

	function scrollToBottom() {
		if (scrollContainer) {
			scrollContainer.scrollTo({
				top: scrollContainer.scrollHeight,
				behavior: "smooth",
			});
		}
	}

	async function handleClearChat() {
		const sessionId = sidebarStore.currentSessionId;
		if (!sessionId) return;
		try {
			await invoke('clear_messages', { sessionId });
			chatStore.reset();
			chatStore.loadMessages(sessionId);
		} catch (e) {
			console.error('Failed to clear chat:', e);
		}
	}

	async function handleSend(msg: string) {
		if (!msg.trim()) return;
		await onsend?.(msg);
	}

	$effect(() => {
		if (chatStore.messages.length > 0) {
			scrollToBottom();
			showScrollButton = false;
		}
	});

	// Reactive primitive: length of the last message's content
	const lastMessageContentLen = $derived(
		chatStore.messages[chatStore.messages.length - 1]?.content?.length ?? 0
	);

	// Auto-scroll during streaming if user is near bottom
	$effect(() => {
		const len = lastMessageContentLen;
		if (scrollContainer && len > 0 && chatStore.isStreaming) {
			const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
			const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
			if (distanceFromBottom < 200) {
				scrollContainer.scrollTop = scrollHeight;
			}
		}
	});

	onMount(() => {
		const container = scrollContainer;
		if (container) {
			container.addEventListener("scroll", checkScroll);
		}

		const handleGlobalFocus = (e: KeyboardEvent) => {
			if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
				const active = document.activeElement;
				const isTyping =
					active?.tagName === "INPUT" ||
					active?.tagName === "TEXTAREA" ||
					active?.getAttribute("contenteditable") === "true";

				if (!isTyping && chatInputRef) {
					chatInputRef.focus();
				}
			}
		};

		window.addEventListener("keydown", handleGlobalFocus);

		const unlistenTheme = listen<{ theme: string }>("theme-changed", () => {
			// Theme is dark-only now
		});

		const unlistenReset = listen("chat-reset", () => {
			chatStore.reset();
		});

		return () => {
			window.removeEventListener("keydown", handleGlobalFocus);
			if (container) container.removeEventListener("scroll", checkScroll);
			unlistenTheme.then((u) => u());
			unlistenReset.then((u) => u());
		};
	});
</script>

<div class="flex-1 flex flex-col h-full overflow-hidden">
	<!-- Title Bar -->
	{#if chatStore.isConversationStarted}
		<div class="shrink-0 flex items-center justify-center px-4 py-2.5 border-b border-[var(--border)]">
			<div class="flex items-center gap-3">
				<span class="text-[13px] font-medium text-[var(--fg-secondary)] truncate max-w-[400px]">
					{chatStore.currentTitle}
				</span>
				{#if chatStore.isConversationStarted}
					<button
						onclick={handleClearChat}
						class="p-1 rounded-md text-[var(--fg-tertiary)] hover:text-red-400 hover:bg-[var(--hover-bg)] transition-colors"
						title="Clear chat"
					>
						<Trash2 size={14} strokeWidth={1.5} />
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Messages or Empty State -->
	{#if chatStore.isConversationStarted}
		<div
			bind:this={scrollContainer}
			class="flex-1 overflow-y-auto relative"
			onscroll={checkScroll}
		>
			<div class="max-w-[680px] mx-auto flex flex-col gap-8 px-4 py-8 pb-4">
				{#each chatStore.messages as msg (msg.id)}
					<Message message={msg} />
				{/each}
			</div>

			{#if showScrollButton}
				<button
					transition:fade={{ duration: 150 }}
					onclick={scrollToBottom}
					class="absolute bottom-20 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-[var(--bg)] border border-[var(--border)] shadow-lg text-[var(--fg-secondary)] hover:text-[var(--fg)] hover:bg-[var(--hover-bg)] transition-all duration-150 z-10"
					title="Scroll to bottom"
				>
					<ArrowDown size={18} strokeWidth={2} />
					{#if chatStore.isStreaming}
						<span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--accent)] animate-pulse"></span>
					{/if}
				</button>
			{/if}
		</div>

		<!-- Input at bottom when chatting -->
		<div class="shrink-0 px-4 pb-4 pt-2">
			<ChatInput
				bind:this={chatInputRef}
				placeholder={chatStore.isStreaming ? "Orkestrate is thinking..." : "Ask Orkestrate"}
				onsend={handleSend}
				compact
				disabled={chatStore.isStreaming}
			/>
		</div>
	{:else}
		<EmptyState onsend={handleSend} />
	{/if}
</div>
