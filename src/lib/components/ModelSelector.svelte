<script lang="ts">
    import { Search, X, Sparkles } from "lucide-svelte";
    import { fade, fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { modelService, type ModelInfo } from "$lib/services/models.svelte";
    import { onMount, tick } from "svelte";

    let searchQuery = $state("");
    let searchRef = $state<HTMLInputElement | undefined>(undefined);

    function filteredModels(): Map<string, ModelInfo[]> {
        const q = searchQuery.toLowerCase().trim();
        const grouped = new Map<string, ModelInfo[]>();

        for (const model of modelService.allModels) {
            if (q && !model.name.toLowerCase().includes(q) && !model.providerName.toLowerCase().includes(q)) {
                continue;
            }
            const list = grouped.get(model.providerName) || [];
            list.push(model);
            grouped.set(model.providerName, list);
        }
        return grouped;
    }

    function selectModel(model: ModelInfo) {
        modelService.selectModel(model);
        modelService.closeSelector();
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            modelService.closeSelector();
        }
    }

    onMount(() => {
        tick().then(() => searchRef?.focus());
    });

    $effect(() => {
        if (modelService.isSelectorOpen) {
            tick().then(() => searchRef?.focus());
        }
    });
</script>

{#if modelService.isSelectorOpen}
    <!-- Overlay -->
    <div
        class="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/40 backdrop-blur-sm"
        onclick={() => modelService.closeSelector()}
        transition:fade={{ duration: 150 }}
        role="presentation"
    >
        <!-- Modal -->
        <div
            class="w-full max-w-[480px] bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden"
            onclick={(e) => e.stopPropagation()}
            transition:fly={{ y: -12, duration: 200, easing: cubicOut }}
            role="dialog"
            aria-modal="true"
            aria-label="Select model"
            tabindex="-1"
            onkeydown={handleKeydown}
        >
            <!-- Header -->
            <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <span class="text-[14px] font-medium text-[var(--fg)]">Select model</span>
                <button
                    class="text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)] transition-colors"
                    onclick={() => modelService.closeSelector()}
                >
                    <span class="text-[12px]">esc</span>
                </button>
            </div>

            <!-- Search -->
            <div class="px-4 py-2.5 border-b border-[var(--border)]">
                <div class="flex items-center gap-2 bg-[var(--hover-bg)] rounded-lg px-3 py-2">
                    <Search size={14} strokeWidth={1.5} class="text-[var(--fg-tertiary)] shrink-0" />
                    <input
                        bind:this={searchRef}
                        bind:value={searchQuery}
                        placeholder="Search"
                        class="w-full bg-transparent text-[13px] text-[var(--fg)] placeholder:text-[var(--fg-tertiary)] outline-none"
                    />
                </div>
            </div>

            <!-- List -->
            <div class="max-h-[320px] overflow-y-auto py-1">
                {@render recentSection()}
                {@render groupedList(filteredModels())}
            </div>

            <!-- Footer -->
            <div class="flex items-center gap-4 px-4 py-2.5 border-t border-[var(--border)] text-[12px] text-[var(--fg-tertiary)]">
                <span class="font-medium text-[var(--fg-secondary)]">Connect provider</span>
                <span class="opacity-60">ctrl+a</span>
                <span class="ml-auto font-medium text-[var(--fg-secondary)]">Favorite</span>
                <span class="opacity-60">ctrl+f</span>
            </div>
        </div>
    </div>
{/if}

{#snippet recentSection()}
    {@const recents = modelService.recentModels}
    {#if recents.length > 0 && !searchQuery}
        <div class="px-4 pt-2 pb-1">
            <span class="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-tertiary)]">Recent</span>
        </div>
        {#each recents as model}
            {@render modelRow(model)}
        {/each}
        <div class="border-b border-[var(--border)] my-1"></div>
    {/if}
{/snippet}

{#snippet groupedList(grouped: Map<string, ModelInfo[]>)}
    {#each grouped.entries() as [providerName, models]}
        <div class="px-4 pt-2 pb-1">
            <span class="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-tertiary)]">{providerName}</span>
        </div>
        {#each models as model}
            {@render modelRow(model)}
        {/each}
    {/each}
{/snippet}

{#snippet modelRow(model: ModelInfo)}
    {@const isActive = modelService.activeModel.id === model.id}
    <button
        class="w-full flex items-center gap-3 px-4 py-2 hover:bg-[var(--hover-bg)] transition-colors text-left group"
        onclick={() => selectModel(model)}
    >
        <div class="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors"
            class:border-[var(--fg-secondary)]={isActive}
            class:border-[var(--border)]={!isActive}
        >
            {#if isActive}
                <div class="w-2 h-2 rounded-full bg-[var(--fg)]"></div>
            {/if}
        </div>
        <span class="text-[13px] text-[var(--fg)] font-normal flex-1">{model.name}</span>
        <span class="text-[11px] text-[var(--fg-tertiary)] opacity-70 flex items-center gap-1">
            {#if model.isFree}
                <Sparkles size={10} strokeWidth={1.5} />
            {/if}
            {model.providerName}
        </span>
    </button>
{/snippet}
