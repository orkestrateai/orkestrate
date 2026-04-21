<script lang="ts">
    import ChatInput from "$lib/components/ChatInput.svelte";
     import Message from "$lib/components/Message.svelte";
    import ModelSelector from "$lib/components/ModelSelector.svelte";
    import Logo from "$lib/components/Logo.svelte";
    import { intentEngine } from "$lib/intent.svelte";
    import { llmService } from "$lib/services/llm.svelte";
    import { modelService } from "$lib/services/models.svelte";
    import { themeManager } from "$lib/theme.svelte";
    import { onMount } from "svelte";
    import { fade, fly } from "svelte/transition";
    import { getCurrentWindow } from "@tauri-apps/api/window";
    import { listen } from "@tauri-apps/api/event";
    import { ArrowDown } from "lucide-svelte";

    let inputVal = $state("");
    let chatInputRef = $state<any>();
    let scrollContainer: HTMLElement | undefined = $state();
    let showScrollButton = $state(false);

    function checkScroll() {
        if (!scrollContainer) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        showScrollButton = scrollTop + clientHeight < scrollHeight - 100;
    }

    async function handleSend(msg: string) {
        if (!msg.trim()) return;

        const action = intentEngine.handle(msg);
        if (action) {
            // Handle reset command
            if (action.content === "Chat reset") {
                llmService.reset();
                return;
            }
            
            // Show action feedback in chat
            llmService.showAction(action.content);
            return;
        }

        await llmService.stream(msg);
    }

    async function toggleExpand() {
        const win = getCurrentWindow();
        await win.toggleMaximize();
    }

    function scrollToBottom() {
        if (scrollContainer) {
            scrollContainer.scrollTo({
                top: scrollContainer.scrollHeight,
                behavior: "smooth",
            });
        }
    }

    $effect(() => {
        if (llmService.messages.length > 0) {
            scrollToBottom();
            showScrollButton = false;
        }
    });

    // Derive conversation title from first user message
    let firstUserMessage = $derived(llmService.messages.find(m => m.role === "user"));
    let conversationTitle = $derived(
        llmService.isConversationStarted && firstUserMessage
            ? firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? "..." : "")
            : "New Chat"
    );

    onMount(() => {
        // Scroll tracking
        const container = scrollContainer;
        if (container) {
            container.addEventListener("scroll", checkScroll);
        }

        const handleGlobalFocus = (e: KeyboardEvent) => {
            // Ctrl+M to open model selector
            if (e.ctrlKey && e.key.toLowerCase() === "m") {
                e.preventDefault();
                modelService.openSelector();
                return;
            }

            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const active = document.activeElement;
                const isTyping =
                    active?.tagName === "INPUT" ||
                    active?.tagName === "TEXTAREA" ||
                    active?.getAttribute("contenteditable") === "true";

                if (!isTyping && chatInputRef) {
                    chatInputRef.focus();
                }
            }
        };

        window.addEventListener("keydown", handleGlobalFocus);

        // Listen for tool effect events from backend
        const unlistenTheme = listen<{ theme: string }>("theme-changed", (event) => {
            themeManager.set(event.payload.theme as "light" | "dark");
        });

        const unlistenModel = listen<{ model: string }>("model-selected", (event) => {
            const matched = modelService.allModels.find(m => m.id === event.payload.model);
            if (matched) modelService.selectModel(matched);
        });

        const unlistenReset = listen("chat-reset", () => {
            llmService.reset();
        });

        return () => {
            window.removeEventListener("keydown", handleGlobalFocus);
            if (container) container.removeEventListener("scroll", checkScroll);
            unlistenTheme.then(u => u());
            unlistenModel.then(u => u());
            unlistenReset.then(u => u());
        };
    });
</script>

<main class="h-screen w-screen flex flex-col bg-[var(--bg)] text-[var(--fg)]">
    <!-- Dark Header Bar — Littlebird style -->
    <header class="w-full flex items-center justify-between px-4 py-3 bg-[var(--header-bg)] text-[var(--header-fg)] shrink-0 border-b border-[var(--border)]">
        <div class="flex items-center gap-2.5">
            <Logo size="sm" withText={false} />
            <span class="text-[14px] font-medium tracking-tight">Orkestrate</span>
        </div>

        {#if llmService.isConversationStarted}
            <span class="absolute left-1/2 -translate-x-1/2 text-[13px] font-normal text-[var(--header-fg-secondary)] truncate max-w-[50%]">
                {conversationTitle}
            </span>
        {/if}

        <div class="flex items-center gap-2 text-[var(--header-fg-secondary)]">
            <!-- Minimal header icons -->
            <button 
                class="p-1.5 hover:text-[var(--header-fg)] transition-colors" 
                title="Expand"
                onclick={toggleExpand}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                </svg>
            </button>
        </div>
    </header>

    <!-- Chat Area -->
    <div class="flex-1 flex flex-col overflow-hidden">
        {#if llmService.isConversationStarted}
            <!-- Messages -->
            <div
                bind:this={scrollContainer}
                class="flex-1 overflow-y-auto relative"
                in:fade={{ duration: 300, delay: 100 }}
            >
                <div class="max-w-[680px] mx-auto flex flex-col gap-8 px-4 py-8">
                    {#each llmService.messages as msg (msg.id)}
                        <Message message={msg} />
                    {/each}
                </div>

                <!-- Scroll to bottom button -->
                {#if showScrollButton}
                    <button
                        transition:fade={{ duration: 150 }}
                        onclick={scrollToBottom}
                        class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg)] border border-[var(--border)] shadow-md text-[var(--fg-secondary)] hover:text-[var(--fg)] hover:bg-[var(--hover-bg)] transition-all duration-150 z-10"
                    >
                        <ArrowDown size={14} strokeWidth={1.5} />
                        <span class="text-[12px] font-medium">Scroll to bottom</span>
                    </button>
                {/if}
            </div>
        {:else}
            <!-- Landing State -->
            <div
                class="flex-1 flex flex-col items-center justify-center gap-10 px-4"
                in:fly={{ y: 10, duration: 400 }}
                out:fade={{ duration: 150 }}
            >
                <div class="flex flex-col items-center gap-4 text-center">
                    <h1 class="text-[32px] font-normal tracking-tight text-[var(--fg)]">
                        What's on your mind?
                    </h1>
                </div>

                <!-- Shortcuts & Tips -->
                <div class="flex flex-col items-start gap-4 w-full max-w-sm text-[var(--fg-secondary)]">
                    <div class="flex items-center gap-3 w-full">
                        <span class="text-[13px] font-medium text-[var(--fg)] w-20 shrink-0">Model</span>
                        <span class="text-[13px]">Click the pill in the input bar or press</span>
                        <kbd class="px-1.5 py-0.5 rounded bg-[var(--hover-bg)] border border-[var(--border)] text-[11px] font-mono text-[var(--fg-secondary)] shrink-0">Ctrl+M</kbd>
                    </div>
                    <div class="flex items-center gap-3 w-full">
                        <span class="text-[13px] font-medium text-[var(--fg)] w-20 shrink-0">Commands</span>
                        <span class="text-[13px]">Type</span>
                        <code class="px-1.5 py-0.5 rounded bg-[var(--hover-bg)] border border-[var(--border)] text-[11px] font-mono text-[var(--fg-secondary)]">:model</code>
                        <span class="text-[13px]">or</span>
                        <code class="px-1.5 py-0.5 rounded bg-[var(--hover-bg)] border border-[var(--border)] text-[11px] font-mono text-[var(--fg-secondary)]">:theme</code>
                        <span class="text-[13px]">in chat</span>
                    </div>
                    <div class="flex items-center gap-3 w-full">
                        <span class="text-[13px] font-medium text-[var(--fg)] w-20 shrink-0">Thinking</span>
                        <span class="text-[13px]">Click</span>
                        <span class="text-[13px] text-[var(--fg)] italic">"Thinking..."</span>
                        <span class="text-[13px]">to expand reasoning</span>
                    </div>
                </div>
            </div>
        {/if}
    </div>

    <!-- Input -->
    <footer class="shrink-0">
        <ChatInput
            bind:this={chatInputRef}
            bind:value={inputVal}
            placeholder="Ask anything..."
            onsend={handleSend}
        />
    </footer>

    <ModelSelector />
</main>
