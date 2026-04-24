<!-- SuggestionChip.svelte -->
<script lang="ts">
	import type { Component } from "svelte";

	let {
		text,
		icon: Icon,
		onclick,
	} = $props<{
		text: string;
		icon?: Component;
		onclick?: () => void;
	}>();
</script>

<button
	{onclick}
	class="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/[0.10] bg-transparent text-[13.5px] font-normal text-[#b0b0b0] tracking-[-0.01em] leading-none hover:bg-white/[0.05] hover:text-[#e0e0e0] hover:border-white/[0.16] transition-all duration-150 cursor-pointer"
>
	{#if Icon}
		<Icon size={14} strokeWidth={1.5} class="opacity-60" />
	{/if}
	<span>{text}</span>
</button>
