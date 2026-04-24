<script lang="ts">
	import {
		Settings,
		Zap,
		Smartphone,
		MessageCircle,
		HelpCircle,
		Clock,
		LogOut,
	} from "lucide-svelte";
	import { fade, fly } from "svelte/transition";
	import { clickOutside } from "$lib/actions/clickOutside";

	let {
		open = $bindable(false),
		onSettings,
		excludeElements = [],
	} = $props<{
		open?: boolean;
		onSettings?: () => void;
		excludeElements?: HTMLElement[];
	}>();

	const menuItems = [
		{
			icon: Settings,
			label: "Settings",
			action: () => {
				onSettings?.();
				open = false;
			},
		},
		{ icon: Zap, label: "Upgrade Plan", action: () => {} },
		{ icon: Smartphone, label: "Download Mobile App", action: () => {} },
	];

	const secondaryItems = [
		{ icon: MessageCircle, label: "Give Feedback", action: () => {} },
		{ icon: HelpCircle, label: "Help Center", action: () => {} },
		{ icon: Clock, label: "Changelog", action: () => {} },
	];

	const bottomItem = { icon: LogOut, label: "Logout", action: () => {} };
</script>

{#if open}
	<div
		class="absolute bottom-[72px] left-3 right-3 z-50 flex flex-col gap-0.5 p-1.5 rounded-xl bg-[#232329] border border-[rgba(255,255,255,0.04)] shadow-2xl"
		transition:fly={{ y: 8, duration: 150, easing: (t) => t * (2 - t) }}
		use:clickOutside={{
			callback: () => (open = false),
			exclude: excludeElements,
		}}
	>
		<!-- Email header -->
		<div class="px-3 py-2">
			<span class="text-[12px] text-[var(--fg-tertiary)]"
				>prabhakaran.code@gmail.com</span
			>
		</div>

		<!-- Primary items -->
		<div class="flex flex-col gap-0.5">
			{#each menuItems as item}
				<button
					onclick={item.action}
					class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-[var(--fg)] hover:bg-[var(--hover-bg)] transition-colors text-left"
				>
					<item.icon
						size={16}
						strokeWidth={1.5}
						class="text-[var(--fg-secondary)]"
					/>
					<span>{item.label}</span>
				</button>
			{/each}
		</div>

		<!-- Divider -->
		<div class="my-1 border-t border-[var(--border)]"></div>

		<!-- Secondary items -->
		<div class="flex flex-col gap-0.5">
			{#each secondaryItems as item}
				<button
					onclick={item.action}
					class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-[var(--fg)] hover:bg-[var(--hover-bg)] transition-colors text-left"
				>
					<item.icon
						size={16}
						strokeWidth={1.5}
						class="text-[var(--fg-secondary)]"
					/>
					<span>{item.label}</span>
				</button>
			{/each}
		</div>

		<!-- Divider -->
		<div class="my-1 border-t border-[var(--border)]"></div>

		<!-- Logout -->
		<button
			onclick={bottomItem.action}
			class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-[var(--fg)] hover:bg-[var(--hover-bg)] transition-colors text-left"
		>
			<LogOut
				size={16}
				strokeWidth={1.5}
				class="text-[var(--fg-secondary)]"
			/>
			<span>{bottomItem.label}</span>
		</button>
	</div>
{/if}
