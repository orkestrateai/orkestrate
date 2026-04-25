<script lang="ts">
	import { invoke } from "@tauri-apps/api/core";
	import { showChat } from "$lib/stores/view.svelte";
	import { RefreshCw, Database, Network, History, Sparkles, ArrowLeft, Trash2 } from "lucide-svelte";
	import ConceptGraph from "./ConceptGraph.svelte";
	import MemoryPanel from "./MemoryPanel.svelte";

	interface Trace {
		id: string;
		session_id: string;
		content: string;
		role: string;
		timestamp: string;
	}

	let activeTab: "traces" | "graph" | "legacy" | "dream" = "traces";
	let traces: Trace[] = [];
	let loading = false;
	let error = "";
	let dreamLoading = false;
	let dreamResult: { drift_count: number; causal_links: number; pruned: number } | null = null;

	async function loadTraces() {
		loading = true;
		error = "";
		try {
			traces = await invoke<Trace[]>("pscm_get_traces", { limit: 50 });
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	async function runDreamState() {
		dreamLoading = true;
		dreamResult = null;
		try {
			dreamResult = await invoke("pscm_run_dream_state");
		} catch (e) {
			console.error("Dream state failed:", e);
		} finally {
			dreamLoading = false;
		}
	}

	async function clearMemories() {
		if (!confirm("This will delete ALL memories (old and new). Are you sure?")) return;
		try {
			await invoke("clear_old_memories");
			traces = [];
			alert("All memories cleared. Restart the app to start fresh.");
		} catch (e) {
			console.error("Failed to clear memories:", e);
		}
	}

	function relativeTime(iso: string) {
		const d = new Date(iso);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const mins = Math.floor(diffMs / 60000);
		const hours = Math.floor(diffMs / 3600000);
		const days = Math.floor(diffMs / 86400000);

		if (mins < 1) return "just now";
		if (mins < 60) return `${mins} min ago`;
		if (hours < 24) return `${hours} hr ago`;
		if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
		return `${Math.floor(days / 7)} wk ago`;
	}

	function roleColor(role: string) {
		return role === "user" ? "text-blue-400" : "text-emerald-400";
	}

	$: if (activeTab === "traces") loadTraces();
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="flex items-center justify-between mb-4">
		<div class="flex items-center gap-2">
			<button
				onclick={showChat}
				class="p-1.5 rounded-lg text-[var(--fg-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--fg)] transition-colors"
				title="Back to Chat"
			>
				<ArrowLeft size={16} />
			</button>
			<Database size={16} class="text-[var(--accent)]" />
			<h3 class="text-[15px] font-semibold text-[var(--fg)]">Memory V2</h3>
		</div>
		<button
			onclick={clearMemories}
			class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[12px] font-medium text-red-400 hover:bg-red-500/10 transition-colors"
			title="Clear all memories"
		>
			<Trash2 size={13} />
			Clear
		</button>
	</div>

	<!-- Tabs -->
	<div class="flex gap-1 mb-3 border-b border-[rgba(255,255,255,0.04)] pb-1">
		{#each [
			{id: "traces", label: "Traces", icon: History},
			{id: "graph", label: "Concept Graph", icon: Network},
			{id: "dream", label: "Dream State", icon: Sparkles},
			{id: "legacy", label: "Legacy", icon: Database}
		] as tab}
			<button
				onclick={() => activeTab = tab.id as any}
				class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors"
				class:text-[var(--fg)]={activeTab === tab.id}
				class:bg-[var(--hover-bg)]={activeTab === tab.id}
				class:text-[var(--fg-secondary)]={activeTab !== tab.id}
				class:hover:text-[var(--fg)]={activeTab !== tab.id}
			>
				<svelte:component this={tab.icon} size={13} />
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto pr-1 min-h-0">
		{#if activeTab === "traces"}
			{#if error}
				<div class="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-[12px] mb-3">{error}</div>
			{/if}
			{#if loading}
				<div class="flex items-center justify-center h-32 text-[var(--fg-tertiary)] text-[13px]">
					<RefreshCw size={16} class="animate-spin mr-2" />
					Loading traces...
				</div>
			{:else if traces.length === 0}
				<div class="flex flex-col items-center justify-center h-32 text-[var(--fg-tertiary)] text-[13px]">
					<History size={24} class="mb-2 opacity-50" />
					<p>No traces yet. Start chatting to build memory.</p>
				</div>
			{:else}
				<div class="flex flex-col gap-2">
					{#each traces as trace}
						<div class="flex flex-col gap-1 p-2.5 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]">
							<div class="flex items-center justify-between">
								<span class="text-[11px] font-medium {roleColor(trace.role)}">{trace.role}</span>
								<span class="text-[10px] text-[var(--fg-tertiary)]">{relativeTime(trace.timestamp)}</span>
							</div>
							<p class="text-[12px] text-[var(--fg)] leading-relaxed">{trace.content}</p>
						</div>
					{/each}
				</div>
			{/if}
		{:else if activeTab === "graph"}
			<ConceptGraph />
		{:else if activeTab === "dream"}
			<div class="flex flex-col gap-3">
				<div class="flex items-center justify-between p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]">
					<div>
						<h4 class="text-[13px] font-medium text-[var(--fg)]">Dream State</h4>
						<p class="text-[11px] text-[var(--fg-secondary)] mt-0.5">Run background consolidation: concept drift, causal weaving, episodic pruning.</p>
					</div>
					<button
						onclick={runDreamState}
						disabled={dreamLoading}
						class="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
					>
						{#if dreamLoading}
							<RefreshCw size={13} class="animate-spin" />
							Running...
						{:else}
							<Sparkles size={13} />
							Run Now
						{/if}
					</button>
				</div>

				{#if dreamResult}
					<div class="grid grid-cols-3 gap-2">
						<div class="p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)] text-center">
							<div class="text-[20px] font-bold text-amber-400">{dreamResult.drift_count}</div>
							<div class="text-[10px] text-[var(--fg-secondary)] mt-0.5">Drifts Detected</div>
						</div>
						<div class="p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)] text-center">
							<div class="text-[20px] font-bold text-emerald-400">{dreamResult.causal_links}</div>
							<div class="text-[10px] text-[var(--fg-secondary)] mt-0.5">Causal Links</div>
						</div>
						<div class="p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)] text-center">
							<div class="text-[20px] font-bold text-red-400">{dreamResult.pruned}</div>
							<div class="text-[10px] text-[var(--fg-secondary)] mt-0.5">Traces Pruned</div>
						</div>
					</div>
				{/if}
			</div>
		{:else if activeTab === "legacy"}
			<MemoryPanel />
		{/if}
	</div>
</div>
