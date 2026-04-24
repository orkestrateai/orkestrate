<script lang="ts">
	import { invoke } from "@tauri-apps/api/core";
	import { X, Settings as SettingsIcon, Monitor, Palette, Shield, Database, Calendar, MessageSquare, Link, Keyboard, CreditCard, LifeBuoy, SlidersHorizontal, Brain, Plug } from "lucide-svelte";
	import { fade, fly } from "svelte/transition";
	import { onMount } from "svelte";
	import { clickOutside } from "$lib/actions/clickOutside";
	import MemoryPanel from "./MemoryPanel.svelte";

	let { open = $bindable(false) } = $props<{
		open?: boolean;
	}>();

	let activeTab = $state("general");
	let continuityMode = $state("session");
	let mcpConfigText = $state("{}");
	let mcpTools: Array<{ server: string; name: string; description: string }> = $state([]);
	let mcpLoading = $state(false);

	async function loadContinuityMode() {
		try {
			continuityMode = await invoke<string>("get_memory_continuity_mode");
		} catch (e) {
			console.error("Failed to load continuity mode:", e);
		}
	}

	async function setContinuityMode(mode: string) {
		continuityMode = mode;
		try {
			await invoke("set_memory_continuity_mode", { mode });
		} catch (e) {
			console.error("Failed to set continuity mode:", e);
		}
	}

	async function loadMcpConfig() {
		try {
			const config = await invoke<any>("get_mcp_config");
			mcpConfigText = JSON.stringify(config, null, 2);
		} catch (e) {
			console.error("Failed to load MCP config:", e);
			mcpConfigText = "{}";
		}
	}

	async function saveMcpConfig() {
		try {
			const config = JSON.parse(mcpConfigText);
			await invoke("set_mcp_config", { config });
		} catch (e) {
			console.error("Failed to save MCP config:", e);
			alert("Invalid JSON: " + String(e));
		}
	}

	async function discoverMcpTools() {
		mcpLoading = true;
		try {
			const tools = await invoke<Array<{ server: string; name: string; description: string }>>("discover_mcp_tools");
			mcpTools = tools;
		} catch (e) {
			console.error("Failed to discover MCP tools:", e);
		}
		mcpLoading = false;
	}

	$effect(() => {
		if (open && activeTab === "memory") {
			loadContinuityMode();
		}
		if (open && activeTab === "mcp") {
			loadMcpConfig();
		}
	});

	const tabs = [
		{ id: "general", label: "General", icon: SlidersHorizontal },
		{ id: "system", label: "System", icon: Monitor },
		{ id: "appearance", label: "Appearance", icon: Palette },
		{ id: "memory", label: "Memory", icon: Brain },
		{ id: "privacy", label: "Privacy Controls", icon: Shield },
		{ id: "data", label: "Data Controls", icon: Database },
		{ id: "meetings", label: "Meetings", icon: Calendar },
		{ id: "chat", label: "Chat", icon: MessageSquare },
		{ id: "integrations", label: "Integrations", icon: Link },
		{ id: "mcp", label: "MCP Servers", icon: Plug },
		{ id: "shortcuts", label: "Keyboard Shortcuts", icon: Keyboard },
		{ id: "subscription", label: "Subscription", icon: CreditCard },
		{ id: "support", label: "Support", icon: LifeBuoy },
	];

	function close() {
		open = false;
	}

	function openMemoryTab() {
		open = true;
		activeTab = "memory";
	}

	// Keyboard shortcut: Ctrl+Shift+M opens Memory tab
	onMount(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "m") {
				e.preventDefault();
				openMemoryTab();
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	});
</script>

{#if open}
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="w-[800px] h-[600px] flex rounded-2xl bg-[#18181B] border border-[rgba(255,255,255,0.04)] shadow-2xl overflow-hidden"
			transition:fly={{ y: 20, duration: 200, easing: (t) => t * (2 - t) }}
			use:clickOutside={close}
		>
			<!-- Left Sidebar -->
			<div class="w-[220px] flex flex-col bg-[#141418] border-r border-[rgba(255,255,255,0.04)]">
				<div class="px-4 pt-5 pb-3">
					<span class="text-[11px] font-medium text-[var(--fg-tertiary)] uppercase tracking-wider">Settings</span>
				</div>
				<div class="flex-1 flex flex-col gap-0.5 px-2 overflow-y-auto">
					{#each tabs as tab}
						<button
							onclick={() => (activeTab = tab.id)}
							class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-left transition-colors"
							class:text-[var(--fg)]={activeTab === tab.id}
							class:bg-[var(--hover-bg)]={activeTab === tab.id}
							class:text-[var(--fg-secondary)]={activeTab !== tab.id}
							class:hover:bg-[var(--hover-bg)]={activeTab !== tab.id}
							class:hover:text-[var(--fg)]={activeTab !== tab.id}
						>
							<tab.icon size={15} strokeWidth={1.5} />
							<span>{tab.label}</span>
						</button>
					{/each}
				</div>
				<div class="px-4 py-3 border-t border-[var(--border)]">
					<span class="text-[11px] text-[var(--fg-tertiary)]">Orkestrate v0.1.0</span>
				</div>
			</div>

			<!-- Right Content -->
			<div class="flex-1 flex flex-col overflow-hidden">
				<!-- Header -->
				<div class="flex items-center justify-end px-4 py-3">
					<button
						onclick={close}
						class="p-1.5 rounded-lg text-[var(--fg-tertiary)] hover:text-[var(--fg)] hover:bg-[var(--hover-bg)] transition-colors"
					>
						<X size={18} strokeWidth={1.5} />
					</button>
				</div>

				<!-- Content -->
				<div class="flex-1 overflow-y-auto px-8 pb-8">
					{#if activeTab === "general"}
						<div class="flex flex-col gap-6">
							<h2 class="text-[20px] font-semibold text-[var(--fg)]">General</h2>

							<div class="flex flex-col gap-2">
								<label for="display-name" class="text-[13px] font-medium text-[var(--fg)]">What should Orkestrate call you?</label>
								<input
									id="display-name"
									type="text"
									value="Prabhakaran K"
									class="w-full px-3 py-2.5 rounded-lg bg-[#232329] border border-[rgba(255,255,255,0.06)] text-[14px] text-[var(--fg)] placeholder:text-[var(--fg-tertiary)] outline-none focus:border-[var(--fg-tertiary)] transition-colors"
								/>
							</div>

							<div class="flex flex-col gap-2">
								<label for="aliases" class="text-[13px] font-medium text-[var(--fg)]">Aliases</label>
								<input
									id="aliases"
									type="text"
									value="pracurser, prabha, prabhakaran.code"
									class="w-full px-3 py-2.5 rounded-lg bg-[#232329] border border-[rgba(255,255,255,0.06)] text-[14px] text-[var(--fg)] placeholder:text-[var(--fg-tertiary)] outline-none focus:border-[var(--fg-tertiary)] transition-colors"
								/>
								<span class="text-[12px] text-[var(--fg-tertiary)]">
									Include your nicknames, online handles, and other identifiers, separated by commas
								</span>
							</div>

							<div class="flex flex-col gap-2">
								<span class="text-[13px] font-medium text-[var(--fg)]">Email</span>
								<div class="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#232329] border border-[rgba(255,255,255,0.06)]">
									<span class="text-[14px] text-[var(--fg-secondary)]">prabhakaran.code@gmail.com</span>
									<button aria-label="Edit email" class="p-1 rounded text-[var(--fg-tertiary)] hover:text-[var(--fg)] hover:bg-[var(--hover-bg)] transition-colors">
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
										</svg>
									</button>
								</div>
							</div>

							<div class="flex flex-col gap-2 pt-2">
								<span class="text-[13px] font-semibold text-[var(--fg)]">Orkestrate v0.1.0 (Stable)</span>
								<span class="text-[12px] text-[var(--fg-tertiary)]">You are on the latest version</span>
								<span class="text-[12px] text-[var(--fg-tertiary)]">Channel: Stable</span>
							</div>

							<button
								class="w-fit px-4 py-2 rounded-lg bg-[var(--hover-bg)] text-[13px] font-medium text-[var(--fg)] hover:bg-[var(--fg-tertiary)] hover:text-[var(--bg)] transition-colors"
							>
								Sign Out
							</button>
						</div>
					{:else if activeTab === "memory"}
						<div class="flex flex-col h-full gap-4">
							<div class="flex flex-col gap-3">
								<h2 class="text-[20px] font-semibold text-[var(--fg)]">Memory</h2>

								<div class="flex flex-col gap-2">
									<span class="text-[13px] font-medium text-[var(--fg)]">Cross-session continuity</span>
									<div class="flex gap-2">
										{#each [{id: "session", label: "Previous session"}, {id: "global", label: "All sessions"}, {id: "off", label: "Off"}] as opt}
											<button
												onclick={() => setContinuityMode(opt.id)}
												class="px-3 py-2 rounded-lg text-[12px] font-medium transition-colors border"
												class:text-[var(--fg)]={continuityMode === opt.id}
												class:bg-[var(--hover-bg)]={continuityMode === opt.id}
												class:border-[var(--fg-tertiary)]={continuityMode === opt.id}
												class:text-[var(--fg-secondary)]={continuityMode !== opt.id}
												class:border-[rgba(255,255,255,0.06)]={continuityMode !== opt.id}
												class:hover:border-[var(--fg-tertiary)]={continuityMode !== opt.id}
											>
												{opt.label}
											</button>
										{/each}
									</div>
									<span class="text-[11px] text-[var(--fg-tertiary)]">
										Previous session: inject summary + messages from your last chat. All sessions: global rolling summary. Off: rely on search_memory tool only.
									</span>
								</div>
							</div>
							<div class="flex-1 min-h-0">
								<MemoryPanel />
							</div>
						</div>
					{:else if activeTab === "mcp"}
						<div class="flex flex-col h-full gap-4">
							<h2 class="text-[20px] font-semibold text-[var(--fg)]">MCP Servers</h2>
							<p class="text-[12px] text-[var(--fg-tertiary)]">
								Configure Model Context Protocol servers. Orkestrate will discover and use tools from these servers automatically.
							</p>

							<div class="flex flex-col gap-2">
								<span class="text-[13px] font-medium text-[var(--fg)]">Config (JSON)</span>
								<textarea
									bind:value={mcpConfigText}
									rows={12}
									class="w-full px-3 py-2.5 rounded-lg bg-[#232329] border border-[rgba(255,255,255,0.06)] text-[13px] text-[var(--fg)] font-mono placeholder:text-[var(--fg-tertiary)] outline-none focus:border-[var(--fg-tertiary)] transition-colors resize-none"
									placeholder={'{\n  "servers": {\n    "exa": {\n      "transport": "http",\n      "url": "https://mcp.exa.ai/mcp",\n      "headers": { "Authorization": "Bearer ..." }\n    }\n  }\n}'}
								></textarea>
								<div class="flex gap-2">
									<button
										onclick={saveMcpConfig}
										class="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
									>
										Save Config
									</button>
									<button
										onclick={discoverMcpTools}
										disabled={mcpLoading}
										class="px-4 py-2 rounded-lg bg-[var(--hover-bg)] text-[var(--fg)] text-[13px] font-medium hover:bg-[var(--fg-tertiary)] hover:text-[var(--bg)] transition-colors disabled:opacity-50"
									>
										{mcpLoading ? "Discovering..." : "Discover Tools"}
									</button>
								</div>
							</div>

							{#if mcpTools.length > 0}
								<div class="flex flex-col gap-2 mt-2">
									<span class="text-[13px] font-medium text-[var(--fg)]">Discovered Tools ({mcpTools.length})</span>
									<div class="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
										{#each mcpTools as tool}
											<div class="p-2.5 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)]">
												<div class="flex items-center gap-2">
													<span class="text-[11px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 font-medium">{tool.server}</span>
													<span class="text-[13px] font-medium text-[var(--fg)]">{tool.name}</span>
												</div>
												<p class="text-[12px] text-[var(--fg-secondary)] mt-1">{tool.description}</p>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{:else}
						<div class="flex flex-col items-center justify-center h-full gap-3">
							<span class="text-[14px] text-[var(--fg-secondary)]">This section is coming soon.</span>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
