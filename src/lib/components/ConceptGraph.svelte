<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { invoke } from "@tauri-apps/api/core";
	import * as d3 from "d3";
	import { Network, Trash2, Plus, RefreshCw } from "lucide-svelte";

	interface GraphNode {
		id: string;
		name: string;
		type: string;
	}

	interface GraphEdge {
		source: string;
		target: string;
		source_name: string;
		target_name: string;
		type: string;
		weight: number;
		confidence: number;
	}

	interface GraphData {
		nodes: GraphNode[];
		edges: GraphEdge[];
	}

	let svgEl: SVGSVGElement;
	let containerEl: HTMLDivElement;
	let graphData: GraphData = { nodes: [], edges: [] };
	let loading = false;
	let error = "";
	let selectedEdge: GraphEdge | null = null;
	let showAliasModal = false;
	let aliasTarget = "";
	let aliasName = "";
	let aliasType = "sense";

	async function loadGraph() {
		loading = true;
		error = "";
		try {
			graphData = await invoke<GraphData>("pscm_get_concept_graph");
			renderGraph();
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	async function deleteEdge(edge: GraphEdge) {
		try {
			await invoke("pscm_delete_concept_edge", {
				fromId: edge.source,
				toId: edge.target,
				edgeType: edge.type
			});
			selectedEdge = null;
			await loadGraph();
		} catch (e) {
			console.error("Failed to delete edge:", e);
		}
	}

	async function addAlias() {
		if (!aliasTarget || !aliasName) return;
		try {
			await invoke("pscm_add_concept_alias", {
				canonicalName: aliasTarget,
				alias: aliasName,
				nodeType: aliasType
			});
			showAliasModal = false;
			aliasName = "";
			aliasTarget = "";
			await loadGraph();
		} catch (e) {
			console.error("Failed to add alias:", e);
		}
	}

	function renderGraph() {
		if (!svgEl || !graphData.nodes.length) return;

		const width = containerEl.clientWidth;
		const height = containerEl.clientHeight || 400;

		d3.select(svgEl).selectAll("*").remove();

		const svg = d3.select(svgEl)
			.attr("width", width)
			.attr("height", height);

		// Arrow markers for directed edges
		const defs = svg.append("defs");
		["ALIASES", "SLANG_FOR", "STATE_OF", "CAUSED_BY", "FOLLOWS", "ENABLES"].forEach((type, i) => {
			defs.append("marker")
				.attr("id", `arrow-${type}`)
				.attr("viewBox", "0 -5 10 10")
				.attr("refX", 22)
				.attr("refY", 0)
				.attr("markerWidth", 6)
				.attr("markerHeight", 6)
				.attr("orient", "auto")
				.append("path")
				.attr("d", "M0,-5L10,0L0,5")
				.attr("fill", edgeColor(type));
		});

		const g = svg.append("g");

		// Zoom behavior
		const zoom = d3.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.1, 4])
			.on("zoom", (event) => {
				g.attr("transform", event.transform);
			});
		svg.call(zoom);

		// Prepare data for D3
		const nodes = graphData.nodes.map(n => ({ ...n }));
		const links = graphData.edges.map(e => ({ ...e }));

		const simulation = d3.forceSimulation(nodes as any)
			.force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
			.force("charge", d3.forceManyBody().strength(-300))
			.force("center", d3.forceCenter(width / 2, height / 2))
			.force("collision", d3.forceCollide().radius(30));

		// Links
		const link = g.append("g")
			.selectAll("line")
			.data(links)
			.enter().append("line")
			.attr("stroke", (d: any) => edgeColor(d.type))
			.attr("stroke-width", (d: any) => Math.max(1, d.weight * 2))
			.attr("marker-end", (d: any) => `url(#arrow-${d.type})`)
			.attr("opacity", 0.6)
			.style("cursor", "pointer")
			.on("click", (_event, d: any) => {
				selectedEdge = d;
			});

		// Link labels
		const linkLabel = g.append("g")
			.selectAll("text")
			.data(links)
			.enter().append("text")
			.attr("font-size", "9px")
			.attr("fill", "var(--fg-tertiary)")
			.attr("text-anchor", "middle")
			.text((d: any) => d.type);

		// Nodes
		const node = g.append("g")
			.selectAll("g")
			.data(nodes)
			.enter().append("g")
			.call(d3.drag<any, any>()
				.on("start", (event, d: any) => {
					if (!event.active) simulation.alphaTarget(0.3).restart();
					d.fx = d.x;
					d.fy = d.y;
				})
				.on("drag", (event, d: any) => {
					d.fx = event.x;
					d.fy = event.y;
				})
				.on("end", (event, d: any) => {
					if (!event.active) simulation.alphaTarget(0);
					d.fx = null;
					d.fy = null;
				})
			);

		node.append("circle")
			.attr("r", (d: any) => d.type === "entity" ? 12 : 8)
			.attr("fill", (d: any) => d.type === "entity" ? "var(--accent)" : "#8b5cf6")
			.attr("stroke", "var(--bg)")
			.attr("stroke-width", 2);

		node.append("text")
			.attr("dy", 20)
			.attr("text-anchor", "middle")
			.attr("font-size", "10px")
			.attr("fill", "var(--fg)")
			.text((d: any) => d.name);

		simulation.on("tick", () => {
			link
				.attr("x1", (d: any) => d.source.x)
				.attr("y1", (d: any) => d.source.y)
				.attr("x2", (d: any) => d.target.x)
				.attr("y2", (d: any) => d.target.y);

			linkLabel
				.attr("x", (d: any) => (d.source.x + d.target.x) / 2)
				.attr("y", (d: any) => (d.source.y + d.target.y) / 2);

			node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
		});
	}

	function edgeColor(type: string): string {
		switch (type) {
			case "ALIASES": return "#22c55e";
			case "SLANG_FOR": return "#8b5cf6";
			case "STATE_OF": return "#3b82f6";
			case "CAUSED_BY": return "#ef4444";
			case "FOLLOWS": return "#f59e0b";
			case "ENABLES": return "#10b981";
			default: return "#94a3b8";
		}
	}

	onMount(() => {
		loadGraph();
		window.addEventListener("resize", renderGraph);
	});

	onDestroy(() => {
		window.removeEventListener("resize", renderGraph);
	});
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="flex items-center justify-between mb-3">
		<div class="flex items-center gap-2">
			<Network size={16} class="text-[var(--accent)]" />
			<h3 class="text-[15px] font-semibold text-[var(--fg)]">Concept Graph</h3>
		</div>
		<div class="flex items-center gap-1.5">
			<button
				onclick={() => showAliasModal = true}
				class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[12px] font-medium text-[var(--fg-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--fg)] transition-colors"
			>
				<Plus size={13} />
				Alias
			</button>
			<button
				onclick={loadGraph}
				disabled={loading}
				class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[12px] font-medium text-[var(--fg-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--fg)] transition-colors disabled:opacity-50"
			>
				<RefreshCw size={13} class={loading ? "animate-spin" : ""} />
				Refresh
			</button>
		</div>
	</div>

	{#if error}
		<div class="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-[12px] mb-3">{error}</div>
	{/if}

	<!-- Legend -->
	<div class="flex flex-wrap gap-2 mb-2 text-[10px]">
		<div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-[var(--accent)]"></span> Entity</div>
		<div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-[#8b5cf6]"></span> Sense</div>
		<div class="flex items-center gap-1"><span class="w-3 h-0.5 bg-[#22c55e]"></span> Aliases</div>
		<div class="flex items-center gap-1"><span class="w-3 h-0.5 bg-[#ef4444]"></span> Caused By</div>
		<div class="flex items-center gap-1"><span class="w-3 h-0.5 bg-[#f59e0b]"></span> Follows</div>
	</div>

	<!-- Graph -->
	<div bind:this={containerEl} class="flex-1 relative min-h-[300px] rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)] overflow-hidden">
		<svg bind:this={svgEl} class="w-full h-full"></svg>
	</div>

	<!-- Selected Edge Panel -->
	{#if selectedEdge}
		<div class="mt-2 p-2.5 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]">
			<div class="flex items-center justify-between">
				<div class="text-[12px] text-[var(--fg)]">
					<span class="font-medium">{selectedEdge.source_name}</span>
					<span class="text-[var(--fg-tertiary)] mx-1">→</span>
					<span class="text-[10px] px-1.5 py-0.5 rounded border" style="border-color: {edgeColor(selectedEdge.type)}30; color: {edgeColor(selectedEdge.type)};">{selectedEdge.type}</span>
					<span class="text-[var(--fg-tertiary)] mx-1">→</span>
					<span class="font-medium">{selectedEdge.target_name}</span>
				</div>
				<button
					onclick={() => deleteEdge(selectedEdge!)}
					class="p-1 rounded text-[var(--fg-tertiary)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
					title="Delete edge"
				>
					<Trash2 size={13} />
				</button>
			</div>
		</div>
	{/if}

	<!-- Add Alias Modal -->
	{#if showAliasModal}
		<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={() => showAliasModal = false}>
			<div class="bg-[var(--bg)] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 w-80" onclick={(e) => e.stopPropagation()}>
				<h4 class="text-[14px] font-semibold text-[var(--fg)] mb-3">Add Concept Alias</h4>
				<div class="flex flex-col gap-2.5">
					<div>
						<label class="text-[11px] text-[var(--fg-secondary)] mb-1 block">Canonical Name</label>
						<input
							type="text"
							bind:value={aliasTarget}
							placeholder="e.g. Karan"
							class="w-full px-2.5 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[12px] text-[var(--fg)] placeholder:text-[var(--fg-tertiary)] focus:outline-none focus:border-[var(--accent)]"
						/>
					</div>
					<div>
						<label class="text-[11px] text-[var(--fg-secondary)] mb-1 block">Alias</label>
						<input
							type="text"
							bind:value={aliasName}
							placeholder="e.g. him, that guy"
							class="w-full px-2.5 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[12px] text-[var(--fg)] placeholder:text-[var(--fg-tertiary)] focus:outline-none focus:border-[var(--accent)]"
						/>
					</div>
					<div>
						<label class="text-[11px] text-[var(--fg-secondary)] mb-1 block">Type</label>
						<select
							bind:value={aliasType}
							class="w-full px-2.5 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[12px] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
						>
							<option value="sense">Sense (slang/alias)</option>
							<option value="entity">Entity</option>
						</select>
					</div>
					<div class="flex gap-2 mt-1">
						<button
							onclick={() => showAliasModal = false}
							class="flex-1 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[var(--fg-secondary)] hover:bg-[var(--hover-bg)] transition-colors"
						>
							Cancel
						</button>
						<button
							onclick={addAlias}
							class="flex-1 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
						>
							Add
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
