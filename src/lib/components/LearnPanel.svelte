<script lang="ts">
	import { learnStore } from "$lib/stores/learn.svelte";
	import { chatStore } from "$lib/stores/chat.svelte";
	import { sidebarStore } from "$lib/stores/sidebar.svelte";
	import { X, BookOpen, ArrowRight, XCircle, Clock } from "lucide-svelte";
	import { fly, fade } from "svelte/transition";

	let inputValue = $state("");
	let inputRef: HTMLInputElement | undefined = $state();
	let showHistory = $state(false);

	function handleSubmit() {
		if (!inputValue.trim() || learnStore.isStreaming || learnStore.isQueueEmpty) return;
		learnStore.sendAnswer(inputValue.trim());
		inputValue = "";
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}

	function startNewChat() {
		learnStore.close();
		chatStore.reset();
		sidebarStore.newChat();
	}

	function handleDismiss() {
		const id = learnStore.currentItemId;
		if (id) learnStore.dismissItem(id);
	}

	function handleSnooze() {
		const id = learnStore.currentItemId;
		if (id) learnStore.snoozeItem(id);
	}

	// Auto-focus input when panel opens and question is ready
	$effect(() => {
		if (learnStore.isOpen && !learnStore.isQueueEmpty && !learnStore.isStreaming && inputRef) {
			setTimeout(() => inputRef?.focus(), 100);
		}
	});

	// Current prompt = latest assistant message from history
	let currentPrompt = $derived(
		learnStore.messages.length > 0
			? [...learnStore.messages].reverse().find((m) => m.role === "assistant")
			: null
	);

	// Last user answer for faded context
	let lastUserAnswer = $derived(
		learnStore.messages.length > 1
			? [...learnStore.messages].reverse().find((m) => m.role === "user")
			: null
	);

	// Raw queue item for the current question
	let currentQueueItem = $derived(learnStore.queue[0] ?? null);
</script>

{#if learnStore.isOpen}
	<div
		class="fixed inset-y-0 right-0 w-[380px] bg-[var(--bg)] border-l border-[rgba(255,255,255,0.04)] flex flex-col z-50 shadow-2xl"
		in:fly={{ x: 380, duration: 300, easing: (t) => t * (2 - t) }}
		out:fly={{ x: 380, duration: 200 }}
	>
		<!-- Header -->
		<div class="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.04)]">
			<div class="flex items-center gap-2.5">
				<BookOpen size={18} class="text-[var(--accent)]" />
				<h2 class="text-[15px] font-semibold text-[var(--fg)]">Learn</h2>
				{#if learnStore.pendingCount > 0}
					<span class="text-[11px] px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-white font-medium">
						{learnStore.pendingCount}
					</span>
				{/if}
			</div>
			<button
				onclick={() => learnStore.close()}
				class="p-1.5 rounded-lg text-[var(--fg-tertiary)] hover:text-[var(--fg)] hover:bg-[var(--hover-bg)] transition-colors"
			>
				<X size={16} />
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1 flex flex-col min-h-0 px-5 py-5 gap-5 overflow-y-auto">
			{#if learnStore.isQueueEmpty && !learnStore.isStreaming}
				<!-- Empty State -->
				<div class="flex flex-col items-center justify-center flex-1 gap-4 text-center" in:fade>
					<div class="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.03)] flex items-center justify-center">
						<BookOpen size={24} class="text-[var(--fg-tertiary)]" />
					</div>
					<div class="flex flex-col gap-1.5">
						<p class="text-[14px] text-[var(--fg-secondary)]">
							You're all caught up.
						</p>
						<p class="text-[13px] text-[var(--fg-tertiary)]">
							I'll reach out if I have questions.
						</p>
					</div>
					<button
						onclick={startNewChat}
						class="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
					>
						Start New Chat
						<ArrowRight size={14} />
					</button>
				</div>
			{:else}
				<!-- Queue metadata -->
				{#if currentQueueItem}
					<div class="flex items-center gap-2 text-[11px] text-[var(--fg-tertiary)]">
						<span class="px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.04)] uppercase tracking-wider">{currentQueueItem.type_}</span>
						<span>{learnStore.pendingCount} remaining</span>
					</div>
				{/if}

				<!-- Current Prompt Card -->
				{#if currentPrompt}
					<div class="flex flex-col gap-3" in:fade>
						<div class="p-4 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
							<p class="text-[14px] text-[var(--fg)] leading-relaxed">{currentPrompt.content}</p>
						</div>

						<!-- Dismiss / Snooze -->
						{#if currentQueueItem}
							<div class="flex items-center gap-2">
								<button
									onclick={handleDismiss}
									class="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
								>
									<XCircle size={12} />
									Dismiss
								</button>
								<button
									onclick={handleSnooze}
									class="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
								>
									<Clock size={12} />
									Snooze
								</button>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Last User Answer (faded) -->
				{#if lastUserAnswer}
					<div class="flex flex-col gap-1.5">
						<button
							onclick={() => (showHistory = !showHistory)}
							class="text-[11px] text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)] transition-colors text-left"
						>
							{showHistory ? "Hide" : "Show"} your last answer
						</button>
						{#if showHistory}
							<div class="p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]" in:fade>
								<p class="text-[13px] text-[var(--fg-secondary)] leading-relaxed">{lastUserAnswer.content}</p>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Streaming indicator -->
				{#if learnStore.isStreaming}
					<div class="flex items-center gap-2 text-[12px] text-[var(--fg-tertiary)]">
						<div class="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse"></div>
						Thinking...
					</div>
				{/if}
			{/if}
		</div>

		<!-- Input Area -->
		<div class="px-5 py-4 border-t border-[rgba(255,255,255,0.04)]">
			<div class="relative">
				<input
					bind:this={inputRef}
					bind:value={inputValue}
					onkeydown={handleKeyDown}
					disabled={learnStore.isQueueEmpty || learnStore.isStreaming}
					placeholder={learnStore.isQueueEmpty ? "Nothing to clarify right now" : "Tell me..."}
					class="w-full px-4 py-3 pr-12 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] text-[14px] text-[var(--fg)] placeholder:text-[var(--fg-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
				/>
				{#if !learnStore.isQueueEmpty}
					<button
						onclick={handleSubmit}
						disabled={!inputValue.trim() || learnStore.isStreaming}
						class="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-30"
					>
						<ArrowRight size={16} />
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
