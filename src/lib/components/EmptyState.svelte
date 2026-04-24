<script lang="ts">
	import ChatInput from "./ChatInput.svelte";
	import SuggestionChip from "./SuggestionChip.svelte";
	import { Library } from "lucide-svelte";
	import { invoke } from "@tauri-apps/api/core";
	import { onMount } from "svelte";

	let { onsend } = $props<{ onsend?: (msg: string) => void }>();

	let suggestions = $state<string[]>([]);
	let loading = $state(true);

	const fallbackSuggestions = [
		"What are you working on?",
		"Tell me something interesting",
		"What did we discuss last?",
		"Search my memory",
	];

	onMount(async () => {
		try {
			const result = await invoke<string[]>("get_suggestions");
			suggestions = result.length > 0 ? result : fallbackSuggestions;
		} catch (e) {
			console.error("Failed to load suggestions:", e);
			suggestions = fallbackSuggestions;
		} finally {
			loading = false;
		}
	});
</script>

<div
	class="flex-1 flex flex-col items-center justify-center gap-10 px-6 pb-16 antialiased"
>
	<!-- Headline -->
	<h1
		class="text-[32px] font-bold tracking-[-0.02em] text-white text-center leading-tight"
	>
		What's on your mind today?
	</h1>

	<!-- Input -->
	<div class="w-full max-w-[720px]">
		<ChatInput placeholder="Ask Orkestrate" {onsend} />
	</div>

	<!-- Suggestion Chips -->
	<div class="flex flex-wrap justify-center gap-3 max-w-[760px]">
		{#if loading}
			{#each fallbackSuggestions as text}
				<button
					class="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/[0.06] bg-transparent text-[13.5px] font-normal text-[#666] tracking-[-0.01em] leading-none animate-pulse cursor-default"
				>
					<span>{text}</span>
				</button>
			{/each}
		{:else}
			{#each suggestions as text}
				<button
					onclick={() => onsend?.(text)}
					class="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/[0.10] bg-transparent text-[13.5px] font-normal text-[#b0b0b0] tracking-[-0.01em] leading-none hover:bg-white/[0.05] hover:text-[#e0e0e0] hover:border-white/[0.16] transition-all duration-150 cursor-pointer"
				>
					<span>{text}</span>
				</button>
			{/each}
		{/if}
	</div>
</div>
