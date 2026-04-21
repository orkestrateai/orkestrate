<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { Brain, X, User, Clock, Target, Sparkles, GitMerge } from 'lucide-svelte';

  let isOpen = $state(false);
  let memories = $state<any>(null);
  let loading = $state(false);
  let consolidating = $state(false);

  // Listen for open event from intent engine
  $effect(() => {
    const handler = () => openBrowser();
    const consolidateHandler = () => runConsolidation();
    window.addEventListener('memory-browser-open', handler);
    window.addEventListener('memory-consolidate', consolidateHandler);
    return () => {
      window.removeEventListener('memory-browser-open', handler);
      window.removeEventListener('memory-consolidate', consolidateHandler);
    };
  });

  async function openBrowser() {
    isOpen = true;
    loading = true;
    try {
      memories = await invoke('get_memories');
    } catch (e) {
      console.error('Failed to load memories:', e);
    }
    loading = false;
  }

  async function runConsolidation() {
    consolidating = true;
    try {
      const result = await invoke('consolidate_memories');
      console.log('Consolidation result:', result);
      // Refresh memories after consolidation
      memories = await invoke('get_memories');
    } catch (e) {
      console.error('Consolidation failed:', e);
    }
    consolidating = false;
  }

  function close() {
    isOpen = false;
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onclick={close}>
    <div class="bg-surface-0 border border-surface-2 rounded-2xl w-[800px] max-w-[90vw] max-h-[80vh] flex flex-col shadow-2xl" onclick={(e) => e.stopPropagation()}>
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-surface-2">
        <div class="flex items-center gap-3">
          <Brain class="w-5 h-5 text-accent" />
          <h2 class="text-lg font-semibold text-primary">Memory Browser</h2>
        </div>
        <div class="flex items-center gap-2">
          <button
            onclick={runConsolidation}
            disabled={consolidating}
            class="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
          >
            <GitMerge class="w-4 h-4" />
            {consolidating ? 'Consolidating...' : 'Consolidate'}
          </button>
          <button onclick={close} class="p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
            <X class="w-5 h-5 text-tertiary" />
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        {#if loading}
          <div class="flex items-center justify-center py-12 text-tertiary">
            <div class="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full mr-3"></div>
            Loading memories...
          </div>
        {:else if !memories}
          <div class="text-center py-12 text-tertiary">
            No memories loaded yet.
          </div>
        {:else}
          <!-- Entities -->
          {#if memories.entities?.length > 0}
            <section>
              <h3 class="flex items-center gap-2 text-sm font-medium text-secondary mb-3">
                <User class="w-4 h-4" />
                Entities ({memories.entities.length})
              </h3>
              <div class="space-y-2">
                {#each memories.entities as entity}
                  <div class="p-3 rounded-xl bg-surface-1 border border-surface-2">
                    <div class="flex items-center justify-between">
                      <span class="font-medium text-primary">{entity.name}</span>
                      <span class="text-xs text-tertiary">{entity.mentions} mentions</span>
                    </div>
                    <p class="text-sm text-secondary mt-1">{entity.profile}</p>
                  </div>
                {/each}
              </div>
            </section>
          {/if}

          <!-- History -->
          {#if memories.history?.length > 0}
            <section>
              <h3 class="flex items-center gap-2 text-sm font-medium text-secondary mb-3">
                <Clock class="w-4 h-4" />
                Recent History ({memories.history.length})
              </h3>
              <div class="space-y-2">
                {#each memories.history as event}
                  <div class="p-3 rounded-xl bg-surface-1 border border-surface-2">
                    <p class="text-sm text-primary">{event.description}</p>
                    <p class="text-xs text-tertiary mt-1">{event.timestamp}</p>
                  </div>
                {/each}
              </div>
            </section>
          {/if}

          <!-- Goals -->
          {#if memories.goals?.length > 0}
            <section>
              <h3 class="flex items-center gap-2 text-sm font-medium text-secondary mb-3">
                <Target class="w-4 h-4" />
                Active Goals ({memories.goals.length})
              </h3>
              <div class="space-y-2">
                {#each memories.goals as goal}
                  <div class="p-3 rounded-xl bg-surface-1 border border-surface-2">
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-primary">{goal.description}</span>
                      <span class="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">P{goal.priority}</span>
                    </div>
                  </div>
                {/each}
              </div>
            </section>
          {/if}

          <!-- Patterns -->
          {#if memories.patterns?.length > 0}
            <section>
              <h3 class="flex items-center gap-2 text-sm font-medium text-secondary mb-3">
                <Sparkles class="w-4 h-4" />
                Patterns ({memories.patterns.length})
              </h3>
              <div class="space-y-2">
                {#each memories.patterns as pattern}
                  <div class="p-3 rounded-xl bg-surface-1 border border-surface-2">
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-primary">{pattern.description}</span>
                      <span class="text-xs text-tertiary">{Math.round(pattern.confidence * 100)}% confidence</span>
                    </div>
                  </div>
                {/each}
              </div>
            </section>
          {/if}

          {#if memories.entities?.length === 0 && memories.history?.length === 0 && memories.goals?.length === 0 && memories.patterns?.length === 0}
            <div class="text-center py-12 text-tertiary">
              <Brain class="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No memories stored yet.</p>
              <p class="text-sm mt-1">Have a conversation — memories will appear here automatically.</p>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}
