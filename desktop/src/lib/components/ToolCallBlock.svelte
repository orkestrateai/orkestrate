<script lang="ts">
	import { slide } from "svelte/transition";
	import { cubicOut } from "svelte/easing";
	import { ChevronDown, Search, Globe } from "lucide-svelte";
	import type { ToolStep } from "$lib/stores/chat.svelte";

	let { steps = [] } = $props<{ steps?: ToolStep[] }>();

	let isExpanded = $state(false);

	function toggle() {
		isExpanded = !isExpanded;
	}

	let stepCount = $derived(steps.length);
	let hasSteps = $derived(stepCount > 0);
</script>

{#if hasSteps}
	<div class="flex flex-col">
		<button
			onclick={toggle}
			class="flex items-center gap-1.5 text-[var(--fg-secondary)] hover:text-[var(--fg)] transition-colors w-fit mb-2"
		>
			<span class="text-[var(--font-size-sm)] font-semibold tracking-[-0.01em]">
				{stepCount} {stepCount === 1 ? "Step" : "Steps"}
			</span>
			<ChevronDown
				size={14}
				class="transition-transform duration-200 {isExpanded ? 'rotate-180' : ''}"
			/>
		</button>

		{#if isExpanded}
			<div
				in:slide={{ duration: 200, easing: cubicOut }}
				class="rounded-xl border border-[var(--border)] bg-[var(--thinking-bg)] px-4 py-3 space-y-4"
			>
				{#each steps as step}
					<div class="flex flex-col gap-2">
						<div class="flex items-center gap-2">
						{#if step.type === "context_search"}
							<Search size={13} strokeWidth={1.5} class="text-[var(--fg-tertiary)]" />
						{:else if step.type === "memory_search"}
							<Search size={13} strokeWidth={1.5} class="text-[var(--accent)]" />
						{:else if step.type === "web_search"}
							<Globe size={13} strokeWidth={1.5} class="text-blue-400" />
						{:else if step.type === "web_fetch"}
							<Globe size={13} strokeWidth={1.5} class="text-emerald-400" />
						{:else if step.type === "mcp_tool"}
							<div class="w-[13px] h-[13px] rounded-full bg-purple-400/20 border border-purple-400/40"></div>
						{:else}
							<div class="w-[13px] h-[13px] rounded-full border border-[var(--fg-tertiary)]"></div>
						{/if}
							<span class="text-[var(--font-size-sm)] font-semibold text-[var(--fg)] tracking-[-0.01em]">{step.label}</span>
						</div>

						{#if step.queries && step.queries.length > 0}
							<div class="flex flex-wrap gap-1.5 pl-5">
								{#each step.queries as query}
									<span
										class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--tag-bg)] border border-[var(--tag-border)] text-[var(--font-size-xs)] font-medium text-[var(--fg-secondary)] tracking-tight"
									>
										<Search size={10} strokeWidth={1.5} class="opacity-60" />
										{query}
									</span>
								{/each}
							</div>
						{/if}

						{#if step.type === "web_search" && step.query}
							<div class="text-[var(--font-size-xs)] text-blue-400/70 pl-5 tracking-tight">
								Query: {step.query}
							</div>
						{/if}

						{#if step.type === "web_fetch" && step.url}
							<div class="text-[var(--font-size-xs)] text-emerald-400/70 pl-5 tracking-tight truncate max-w-[300px]">
								{step.url}
							</div>
						{/if}

						{#if step.type === "mcp_tool" && step.server}
							<div class="text-[var(--font-size-xs)] text-purple-400/70 pl-5 tracking-tight">
								{step.server} → {step.tool}
							</div>
						{/if}

						{#if step.type === "generic" && step.detail}
							<div class="text-[var(--font-size-sm)] text-[var(--fg-secondary)] pl-5 tracking-tight">
								{step.detail}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
