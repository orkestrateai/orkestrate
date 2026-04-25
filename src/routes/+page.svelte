<script lang="ts">
	import Sidebar from "$lib/components/Sidebar.svelte";
	import ChatArea from "$lib/components/ChatArea.svelte";
	import MemoryPanelV2 from "$lib/components/MemoryPanelV2.svelte";
	import { chatStore } from "$lib/stores/chat.svelte";
	import { sidebarStore } from "$lib/stores/sidebar.svelte";
	import { viewStore } from "$lib/stores/view.svelte";
	import { onMount } from "svelte";

	async function handleSend(msg: string) {
		const model = "minimax-m2.5-free"; // Default model
		await chatStore.stream(msg, model);
	}

	onMount(() => {
		// If there's a current session, load its messages
		const sessionId = sidebarStore.currentSessionId;
		if (sessionId) {
			chatStore.loadMessages(sessionId);
		}
	});
</script>

<main class="h-screen w-screen flex bg-[var(--bg)] text-[var(--fg)] overflow-hidden">
	<Sidebar />
	{#if viewStore.currentView === "chat"}
		<ChatArea onsend={handleSend} />
	{:else}
		<div class="flex-1 h-full overflow-hidden">
			<MemoryPanelV2 />
		</div>
	{/if}
</main>
