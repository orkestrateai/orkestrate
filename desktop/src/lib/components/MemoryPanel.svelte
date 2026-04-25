<script lang="ts">
	import { invoke } from "@tauri-apps/api/core";
	import { RefreshCw, Trash2, CheckCircle, ChevronDown, ChevronUp, Brain, AlertTriangle, GitBranch, Eye, FileText } from "lucide-svelte";

	interface Episode {
		id: string;
		content: string;
		type_: string;
		confidence: number;
		importance: number;
		compression_level: string;
		schema_section: string | null;
		created_at: string;
	}

	interface Contradiction {
		id: string;
		existing_episode_id: string;
		existing_content: string;
		new_evidence_content: string;
		status: string;
		pressure_score: number;
		created_at: string;
	}

	interface Event {
		id: string;
		turn_index: number;
		session_id: string;
		semantic_shift_detected: boolean;
		created_at: string;
	}

	interface Summary {
		id: string;
		name: string;
		content: string;
		is_global: boolean;
		updated_at: string | null;
	}

	interface MemoryState {
		profile: string;
		episodes: Episode[];
		contradictions: Contradiction[];
		events: Event[];
		gaps: Episode[];
		summaries: Summary[];
	}

	let state: MemoryState | null = null;
	let loading = false;
	let activeSection: "profile" | "episodes" | "contradictions" | "events" | "gaps" | "summaries" = "profile";
	let expandedProfile = true;
	let error = "";

	async function load() {
		loading = true;
		error = "";
		try {
			state = await invoke<MemoryState>("get_memory_state");
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
			state = state; // trigger reactivity
		}
	}

	async function resolveContradiction(id: string) {
		try {
			await invoke("resolve_contradiction", { id });
			await load();
		} catch (e) {
			console.error("Failed to resolve contradiction:", e);
		}
	}

	async function deleteEpisode(id: string) {
		try {
			await invoke("delete_episode", { id });
			if (state) {
				state.episodes = state.episodes.filter((e: Episode) => e.id !== id);
				state.gaps = state.gaps.filter((e: Episode) => e.id !== id);
				state = state;
			}
		} catch (e) {
			console.error("Failed to delete episode:", e);
		}
	}

	function formatDate(iso: string) {
		const d = new Date(iso);
		return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
		if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? "" : "s"} ago`;
		return `${Math.floor(days / 30)} mo ago`;
	}

	function compressionColor(level: string) {
		switch (level) {
			case "rule": return "bg-amber-500/15 text-amber-400 border-amber-500/20";
			case "semantic": return "bg-blue-500/15 text-blue-400 border-blue-500/20";
			case "episodic": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
			case "ephemeral": return "bg-slate-500/15 text-slate-400 border-slate-500/20";
			default: return "bg-slate-500/15 text-slate-400 border-slate-500/20";
		}
	}

	function typeColor(type: string) {
		switch (type) {
			case "fact": return "text-emerald-400";
			case "preference": return "text-blue-400";
			case "goal": return "text-amber-400";
			case "relationship": return "text-rose-400";
			case "inference": return "text-slate-400";
			case "gap": return "text-orange-400";
			default: return "text-slate-400";
		}
	}

	// Auto-load on mount
	load();
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="flex items-center justify-between mb-4">
		<div class="flex items-center gap-2">
			<Brain size={16} class="text-[var(--accent)]" />
			<h3 class="text-[15px] font-semibold text-[var(--fg)]">Memory State</h3>
		</div>
		<button
			onclick={load}
			disabled={loading}
			class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-[var(--fg-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--fg)] transition-colors disabled:opacity-50"
		>
			<RefreshCw size={13} class={loading ? "animate-spin" : ""} />
			Refresh
		</button>
	</div>

	{#if error}
		<div class="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-[12px] mb-3">{error}</div>
	{/if}

	<!-- Tabs -->
	<div class="flex gap-1 mb-3 border-b border-[rgba(255,255,255,0.04)] pb-1">
		{#each [{id: "profile", label: "Profile"}, {id: "episodes", label: "Episodes"}, {id: "contradictions", label: "Contradictions"}, {id: "events", label: "Events"}, {id: "gaps", label: "Gaps"}, {id: "summaries", label: "Summaries"}] as tab}
			<button
				onclick={() => activeSection = tab.id as any}
				class="px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors"
				class:text-[var(--fg)]={activeSection === tab.id}
				class:bg-[var(--hover-bg)]={activeSection === tab.id}
				class:text-[var(--fg-secondary)]={activeSection !== tab.id}
				class:hover:text-[var(--fg)]={activeSection !== tab.id}
			>
				{tab.label}
				{#if state && tab.id === "episodes" && state.episodes.length}
					<span class="ml-1 text-[10px] text-[var(--fg-tertiary)]">{state.episodes.length}</span>
				{/if}
				{#if state && tab.id === "contradictions" && state.contradictions.length}
					<span class="ml-1 text-[10px] text-[var(--fg-tertiary)]">{state.contradictions.length}</span>
				{/if}
				{#if state && tab.id === "gaps" && state.gaps.length}
					<span class="ml-1 text-[10px] text-[var(--fg-tertiary)]">{state.gaps.length}</span>
				{/if}
				{#if state && tab.id === "summaries" && state.summaries.length}
					<span class="ml-1 text-[10px] text-[var(--fg-tertiary)]">{state.summaries.length}</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto pr-1">
		{#if !state && loading}
			<div class="flex items-center justify-center h-32 text-[var(--fg-tertiary)] text-[13px]">Loading...</div>
		{:else if !state}
			<div class="flex items-center justify-center h-32 text-[var(--fg-tertiary)] text-[13px]">No memory state available</div>
		{:else if activeSection === "profile"}
			<div class="flex flex-col gap-2">
				<button
					onclick={() => expandedProfile = !expandedProfile}
					class="flex items-center gap-2 text-[12px] font-medium text-[var(--fg-secondary)] hover:text-[var(--fg)] transition-colors"
				>
					{#if expandedProfile}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}
					Compiled user.md
				</button>
				{#if expandedProfile}
					<pre class="text-[12px] text-[var(--fg-secondary)] bg-[rgba(255,255,255,0.02)] rounded-lg p-3 whitespace-pre-wrap leading-relaxed font-mono">{state.profile || "(empty — no compilation yet)"}</pre>
				{/if}
			</div>
		{:else if activeSection === "episodes"}
			<div class="flex flex-col gap-2">
				{#each state.episodes as ep}
					<div class="flex flex-col gap-1.5 p-2.5 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]">
						<div class="flex items-start justify-between gap-2">
							<div class="flex items-center gap-2 flex-wrap">
								<span class="text-[11px] font-medium {typeColor(ep.type_)}">{ep.type_}</span>
								<span class="text-[10px] px-1.5 py-0.5 rounded border {compressionColor(ep.compression_level)}">{ep.compression_level}</span>
								{#if ep.schema_section}
									<span class="text-[10px] text-[var(--fg-tertiary)]">{ep.schema_section}</span>
								{/if}
							</div>
							<button
								onclick={() => deleteEpisode(ep.id)}
								class="p-1 rounded text-[var(--fg-tertiary)] hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
								title="Delete episode"
							>
								<Trash2 size={12} />
							</button>
						</div>
						<p class="text-[12px] text-[var(--fg)] leading-relaxed">{ep.content}</p>
						<div class="flex items-center gap-3 text-[10px] text-[var(--fg-tertiary)]">
							<span>c={ep.confidence.toFixed(2)}</span>
							<span>i={ep.importance.toFixed(2)}</span>
							<span class="ml-auto">{relativeTime(ep.created_at)} · {formatDate(ep.created_at)}</span>
						</div>
					</div>
				{:else}
					<div class="text-[12px] text-[var(--fg-tertiary)] py-4 text-center">No episodes yet</div>
				{/each}
			</div>
		{:else if activeSection === "contradictions"}
			<div class="flex flex-col gap-2">
				{#each state.contradictions as c}
					<div class="flex flex-col gap-2 p-2.5 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<AlertTriangle size={12} class="text-amber-400" />
								<span class="text-[11px] font-medium" class:text-amber-400={c.status === "contested"} class:text-emerald-400={c.status === "resolved"}>
									{c.status}
								</span>
								<span class="text-[10px] text-[var(--fg-tertiary)]">pressure={c.pressure_score}</span>
							</div>
							{#if c.status === "contested"}
								<button
									onclick={() => resolveContradiction(c.id)}
									class="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors"
								>
									<CheckCircle size={11} />
									Resolve
								</button>
							{/if}
						</div>
						<div class="flex flex-col gap-1">
							<div class="text-[11px] text-[var(--fg-secondary)]">
								<span class="text-[var(--fg-tertiary)]">Existing:</span> {c.existing_content}
							</div>
							<div class="text-[11px] text-[var(--fg-secondary)]">
								<span class="text-[var(--fg-tertiary)]">New:</span> {c.new_evidence_content}
							</div>
						</div>
						<div class="text-[10px] text-[var(--fg-tertiary)]">{relativeTime(c.created_at)} · {formatDate(c.created_at)}</div>
					</div>
				{:else}
					<div class="text-[12px] text-[var(--fg-tertiary)] py-4 text-center">No contradictions</div>
				{/each}
			</div>
		{:else if activeSection === "events"}
			<div class="flex flex-col gap-2">
				{#each state.events as ev}
					<div class="flex items-center gap-2.5 p-2.5 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]">
						<div class="shrink-0">
							{#if ev.semantic_shift_detected}
								<GitBranch size={14} class="text-purple-400" />
							{:else}
								<Eye size={14} class="text-[var(--fg-tertiary)]" />
							{/if}
						</div>
						<div class="flex flex-col gap-0.5 min-w-0">
							<div class="text-[11px] text-[var(--fg)] truncate">
								Turn #{ev.turn_index}
								{#if ev.semantic_shift_detected}
									<span class="text-purple-400 font-medium">· semantic shift</span>
								{/if}
							</div>
							<div class="text-[10px] text-[var(--fg-tertiary)]">{relativeTime(ev.created_at)} · {formatDate(ev.created_at)}</div>
						</div>
					</div>
				{:else}
					<div class="text-[12px] text-[var(--fg-tertiary)] py-4 text-center">No events</div>
				{/each}
			</div>
		{:else if activeSection === "gaps"}
			<div class="flex flex-col gap-2">
				{#each state.gaps as gap}
					<div class="flex flex-col gap-1.5 p-2.5 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]">
						<div class="flex items-center justify-between">
							<span class="text-[11px] font-medium text-orange-400">Gap</span>
							<button
								onclick={() => deleteEpisode(gap.id)}
								class="p-1 rounded text-[var(--fg-tertiary)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
								title="Delete gap"
							>
								<Trash2 size={12} />
							</button>
						</div>
						<p class="text-[12px] text-[var(--fg)] leading-relaxed">{gap.content}</p>
						<div class="flex items-center gap-3 text-[10px] text-[var(--fg-tertiary)]">
							<span>severity={gap.confidence.toFixed(2)}</span>
							<span class="ml-auto">{relativeTime(gap.created_at)} · {formatDate(gap.created_at)}</span>
						</div>
					</div>
				{:else}
					<div class="text-[12px] text-[var(--fg-tertiary)] py-4 text-center">No gaps detected yet</div>
				{/each}
			</div>
		{:else if activeSection === "summaries"}
			<div class="flex flex-col gap-3">
				{#each state.summaries as summary}
					<div class="flex flex-col gap-2 p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]">
						<div class="flex items-center gap-2">
							<FileText size={13} class={summary.is_global ? "text-amber-400" : "text-[var(--accent)]"} />
							<div class="flex items-center gap-2 min-w-0">
								<span class="text-[12px] font-medium text-[var(--fg)] truncate">{summary.name}</span>
								{#if summary.is_global}
									<span class="text-[10px] px-1.5 py-0.5 rounded border bg-amber-500/15 text-amber-400 border-amber-500/20">global</span>
								{:else}
									<span class="text-[10px] px-1.5 py-0.5 rounded border bg-blue-500/15 text-blue-400 border-blue-500/20">session</span>
								{/if}
							</div>
						</div>
						<p class="text-[12px] text-[var(--fg-secondary)] leading-relaxed whitespace-pre-wrap">{summary.content}</p>
						{#if summary.updated_at}
							<div class="text-[10px] text-[var(--fg-tertiary)]">{relativeTime(summary.updated_at)} · {formatDate(summary.updated_at)}</div>
						{/if}
					</div>
				{:else}
					<div class="text-[12px] text-[var(--fg-tertiary)] py-4 text-center">No summaries yet. They compile every 3 turns (session) and 5 turns (global).</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
