<script lang="ts">
	import { fly } from "svelte/transition";
	import { cubicOut } from "svelte/easing";
	import { Copy, ThumbsUp, ThumbsDown, Check } from "lucide-svelte";
	import ToolCallBlock from "./ToolCallBlock.svelte";
	import type { Message } from "$lib/stores/chat.svelte";

	let { message } = $props<{ message: Message }>();

	let copied = $state(false);
	let feedback = $state<"up" | "down" | null>(null);

	async function copyToClipboard() {
		await navigator.clipboard.writeText(message.content);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function handleFeedback(type: "up" | "down") {
		feedback = feedback === type ? null : type;
	}

	function formatContent(content: string): string {
		let html = content
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");

		html = html.replace(
			/\*\*(.+?)\*\*/g,
			'<strong style="display:block; font-weight:700; margin-top:1.25rem; margin-bottom:0.5rem; color:var(--fg);">$1</strong>',
		);
		html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
		html = html.replace(/`(.+?)`/g, "<code>$1</code>");
		html = html.replace(
			/(https?:\/\/[^\s<]+)/g,
			'<a href="$1" target="_blank" rel="noopener">$1</a>',
		);

		const paragraphs = html.split(/\n\n+/);
		return paragraphs
			.map(
				(p) =>
					`<p style="margin:0 0 1em 0;">${p.replace(/\n/g, "<br>")}</p>`,
			)
			.join("");
	}
</script>

{#if message.role === "user"}
	<div
		in:fly={{ y: 4, duration: 200, easing: cubicOut }}
		class="flex justify-end"
	>
		<div
			class="max-w-[80%] bg-[var(--user-bubble)] text-[var(--fg)] rounded-[10px] px-4 py-2.5 text-[var(--font-size-md)] leading-[1.5] tracking-[-0.01em] shadow-sm"
		>
			{message.content}
		</div>
	</div>
{:else if message.role === "action"}
	<div
		in:fly={{ y: 4, duration: 200, easing: cubicOut }}
		class="flex justify-center"
	>
		<div
			class="flex items-center gap-2 text-[var(--font-size-xs)] font-medium tracking-tight text-[var(--fg-tertiary)] py-1"
		>
			<Check size={14} strokeWidth={1.5} class="text-green-500" />
			<span>{message.content}</span>
		</div>
	</div>
{:else if message.role === "tool"}
	<div
		in:fly={{ y: 4, duration: 200, easing: cubicOut }}
		class="flex"
	>
		<div
			class="max-w-[90%] bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--font-size-xs)] text-[var(--fg-tertiary)] leading-[1.4]"
		>
			<span class="font-medium text-[var(--fg-secondary)]">Tool result</span>
			<span class="mx-1">·</span>
			<span class="truncate max-w-[300px] inline-block align-bottom">{message.content.slice(0, 120)}{message.content.length > 120 ? "..." : ""}</span>
		</div>
	</div>
{:else if message.role === "assistant"}
	<div
		in:fly={{ y: 4, duration: 200, easing: cubicOut }}
		class="flex flex-col gap-3 group/message"
	>
		<!-- Tool Steps -->
		{#if message.toolSteps && message.toolSteps.length > 0}
			<ToolCallBlock steps={message.toolSteps} />
		{:else if message.toolCalls && message.toolCalls.length > 0}
			<!-- Legacy tool calls fallback -->
			{@const legacySteps = message.toolCalls.map(
				(tc: import("$lib/stores/chat.svelte").ToolCall) => ({
					type: "generic" as const,
					label: tc.tool,
					detail: Object.entries(tc.args)
						.map(([k, v]) => `${k}: ${v}`)
						.join(", "),
				}),
			)}
			<ToolCallBlock steps={legacySteps} />
		{/if}

		<!-- Main Content -->
		{#if message.content}
			<div
				class="text-[var(--font-size-base)] leading-[1.6] text-[var(--fg)] font-normal tracking-[-0.005em]"
			>
				{@html formatContent(message.content)}
			</div>

			<div
				class="flex items-center gap-1.5 -mt-1 opacity-0 group-hover/message:opacity-100 transition-opacity duration-150"
			>
				<button
					onclick={() => handleFeedback("up")}
					class="p-1.5 rounded-md transition-colors duration-150 {feedback ===
					'up'
						? 'text-[var(--fg)]'
						: 'text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)]'}"
					title="Helpful"
				>
					<ThumbsUp size={14} strokeWidth={1.5} />
				</button>
				<button
					onclick={() => handleFeedback("down")}
					class="p-1.5 rounded-md transition-colors duration-150 {feedback ===
					'down'
						? 'text-[var(--fg)]'
						: 'text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)]'}"
					title="Not helpful"
				>
					<ThumbsDown size={14} strokeWidth={1.5} />
				</button>
				<button
					onclick={copyToClipboard}
					class="p-1.5 rounded-md text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)] transition-colors duration-150"
					title="Copy"
				>
					{#if copied}
						<Check
							size={14}
							strokeWidth={1.5}
							class="text-green-500"
						/>
					{:else}
						<Copy size={14} strokeWidth={1.5} />
					{/if}
				</button>
			</div>
		{:else if !message.toolSteps?.length && !message.toolCalls?.length}
			<div class="flex items-center gap-3 py-2">
				<div class="flex items-center gap-1.5">
					<div
						class="w-1.5 h-1.5 rounded-full bg-[var(--fg-tertiary)] animate-pulse"
					></div>
					<div
						class="w-1.5 h-1.5 rounded-full bg-[var(--fg-tertiary)] animate-pulse"
						style="animation-delay: 0.15s"
					></div>
					<div
						class="w-1.5 h-1.5 rounded-full bg-[var(--fg-tertiary)] animate-pulse"
						style="animation-delay: 0.3s"
					></div>
				</div>
				<span
					class="text-[var(--font-size-sm)] font-medium text-[var(--fg-tertiary)] tracking-tight"
					>Thinking...</span
				>
			</div>
		{/if}
	</div>
{/if}
