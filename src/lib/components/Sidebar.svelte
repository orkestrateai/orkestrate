<script lang="ts">
	import { sidebarStore } from "$lib/stores/sidebar.svelte";
	import { chatStore } from "$lib/stores/chat.svelte";
	import { learnStore } from "$lib/stores/learn.svelte";
	import { viewStore, showChat, showMemory } from "$lib/stores/view.svelte";
	import { Plus, Search, X, Gift, BookOpen, Brain } from "lucide-svelte";
	import { fly, fade } from "svelte/transition";
	import ProfilePopup from "./ProfilePopup.svelte";
	import SettingsModal from "./SettingsModal.svelte";

	let showPromo = $state(true);
	let showProfilePopup = $state(false);
	let showSettingsModal = $state(false);
	let profileButtonEl: HTMLElement | undefined = $state();

	function handleNewChat() {
		chatStore.reset();
		sidebarStore.newChat();
		showChat();
	}

	function handleSelectSession(id: string) {
		sidebarStore.switchSession(id);
		chatStore.loadMessages(id);
		showChat();
	}

	function handleMemory() {
		showMemory();
	}

	function toggleProfilePopup() {
		showProfilePopup = !showProfilePopup;
	}

	function openSettings() {
		showSettingsModal = true;
		showProfilePopup = false;
	}
</script>

<aside
	class="h-full w-[240px] flex flex-col bg-[var(--sidebar-bg)] border-r border-[rgba(255,255,255,0.03)] shrink-0 select-none"
	in:fly={{ x: -20, duration: 250, easing: (t) => t * (2 - t) }}
>
	<!-- Branding -->
	<div class="flex items-center gap-2.5 px-4 pt-4 pb-3">
		<!-- Orkestrate Logo (dark-adapted) -->
		<svg
			width="20"
			height="20"
			viewBox="0 0 48 48"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			class="text-[var(--fg)]"
		>
			<!-- Top Layer (Solid) -->
			<path d="M24 20L10 13L24 6L38 13Z" fill="currentColor" />
			<!-- Middle Layer (Stroke + subtle fill) -->
			<path
				d="M24 28L10 21L24 14L38 21Z"
				stroke="currentColor"
				stroke-width="2"
				stroke-linejoin="round"
			/>
			<path
				d="M24 28L10 21L24 14L38 21Z"
				fill="currentColor"
				fill-opacity="0.1"
			/>
			<!-- Bottom Layer (Thin stroke) -->
			<path
				d="M24 36L10 29L24 22L38 29Z"
				stroke="currentColor"
				stroke-opacity="0.4"
				stroke-width="1.5"
				stroke-linejoin="round"
			/>
		</svg>
		<span class="text-[15px] font-semibold tracking-tight text-[var(--fg)]"
			>Orkestrate</span
		>
	</div>

	<!-- Nav -->
	<nav class="flex flex-col gap-0.5 px-2">
		<button
			onclick={handleNewChat}
			class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-[var(--fg)] hover:bg-[var(--hover-bg)] transition-colors text-left"
		>
			<Plus
				size={16}
				strokeWidth={1.5}
				class="text-[var(--fg-secondary)]"
			/>
			New Chat
		</button>
		<button
			class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-[var(--fg-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--fg)] transition-colors text-left"
		>
			<Search size={16} strokeWidth={1.5} />
			Search
		</button>
		<button
			onclick={() => learnStore.toggle()}
			class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-[var(--fg-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--fg)] transition-colors text-left relative"
		>
			<BookOpen size={16} strokeWidth={1.5} />
			Learn
			{#if learnStore.pendingCount > 0}
				<span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-white font-medium">
					{learnStore.pendingCount}
				</span>
			{/if}
		</button>
		<button
			onclick={handleMemory}
			class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-left transition-colors"
			class:text-[var(--fg)]={viewStore.currentView === "memory"}
			class:bg-[var(--hover-bg)]={viewStore.currentView === "memory"}
			class:text-[var(--fg-secondary)]={viewStore.currentView !== "memory"}
			class:hover:bg-[var(--hover-bg)]={viewStore.currentView !== "memory"}
			class:hover:text-[var(--fg)]={viewStore.currentView !== "memory"}
		>
			<Brain size={16} strokeWidth={1.5} />
			Memory
		</button>
	</nav>

	<!-- Sessions / Recents -->
	<div class="flex-1 flex flex-col min-h-0 mt-4 overflow-hidden">
		<div class="px-4 mb-1.5 shrink-0">
			<span class="text-[11px] font-medium text-[var(--fg-tertiary)]"
				>Recents</span
			>
		</div>
		<div class="flex-1 overflow-y-auto min-h-0 px-2 scrollbar-thin">
			<div class="flex flex-col gap-0.5">
				{#each sidebarStore.sessions as session}
					<button
						onclick={() => handleSelectSession(session.id)}
						class="flex items-center px-3 py-2 rounded-lg text-[13px] text-left transition-colors truncate shrink-0"
						class:text-[var(--fg)]={sidebarStore.currentSessionId ===
							session.id}
						class:bg-[var(--hover-bg)]={sidebarStore.currentSessionId ===
							session.id}
						class:text-[var(--fg-secondary)]={sidebarStore.currentSessionId !==
							session.id}
						class:hover:bg-[var(--hover-bg)]={sidebarStore.currentSessionId !==
							session.id}
						class:hover:text-[var(--fg)]={sidebarStore.currentSessionId !==
							session.id}
					>
						<span class="truncate">{session.name}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Bottom Section -->
	<div class="flex flex-col gap-2 px-3 pb-4 mt-auto relative">
		{#if showPromo}
			<div
				class="relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[rgba(255,255,255,0.03)]"
				transition:fade={{ duration: 150 }}
			>
				<Gift
					size={16}
					strokeWidth={1.5}
					class="text-[var(--fg-secondary)] shrink-0"
				/>
				<span class="text-[12px] text-[var(--fg)] font-medium flex-1"
					>Get 2 Months Free</span
				>
				<button
					onclick={() => (showPromo = false)}
					class="p-0.5 rounded hover:bg-[var(--hover-bg)] text-[var(--fg-tertiary)] transition-colors"
				>
					<X size={12} strokeWidth={2} />
				</button>
			</div>
		{/if}

		<!-- Context Status -->
		<div class="flex items-center justify-between px-3 py-2 rounded-lg">
			<span class="text-[12px] text-[var(--fg-secondary)]"
				>Context enabled</span
			>
			<div class="w-2 h-2 rounded-full bg-green-500"></div>
		</div>

		<!-- Profile Popup -->
		<ProfilePopup
			bind:open={showProfilePopup}
			onSettings={openSettings}
			excludeElements={profileButtonEl ? [profileButtonEl] : []}
		/>

		<!-- User Row -->
		<button
			bind:this={profileButtonEl}
			onclick={toggleProfilePopup}
			class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--hover-bg)] transition-colors text-left w-full"
		>
			<div
				class="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-[12px] font-semibold shrink-0"
			>
				P
			</div>
			<div class="flex flex-col min-w-0">
				<span class="text-[13px] text-[var(--fg)] truncate font-medium"
					>Prabhakaran K</span
				>
				<span class="text-[11px] text-[var(--fg-tertiary)]">Basic</span>
			</div>
		</button>
	</div>
</aside>

<!-- Settings Modal -->
<SettingsModal bind:open={showSettingsModal} />
