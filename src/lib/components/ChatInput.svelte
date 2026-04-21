<script lang="ts">
    import { fade } from "svelte/transition";
    import { Plus, Mic, ArrowUp, Wand2, Paperclip, ChevronDown } from "lucide-svelte";
    import { intentEngine } from "$lib/intent.svelte";
    import { modelService } from "$lib/services/models.svelte";

    let {
        value = $bindable(""),
        placeholder = "Ask anything...",
        onsend,
    } = $props();

    let element: HTMLDivElement;
    let isCommandLikely = $derived(intentEngine.isCommandLikely(value));

    function createChipElement(fullMatch: string) {
        const label = fullMatch.startsWith(":") ? fullMatch.slice(1) : fullMatch;
        const span = document.createElement("span");
        span.contentEditable = "false";
        span.className = "inline-flex items-center bg-[var(--tag-bg)] text-[var(--fg)] px-1.5 py-0.5 rounded font-medium text-[13px] border border-[var(--tag-border)] mx-0.5 select-none";
        span.innerHTML = `<span style="display:none">:</span>${label}`;
        return span;
    }

    function handleInput() {
        if (!element) return;
        element.normalize();
        value = element.textContent || "";

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const COMMAND_REGEX = /:([a-zA-Z]+)(?=[\s.,!?;])/g;

        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    if (node.parentElement?.closest('[contenteditable="false"]')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                },
            },
        );

        let node;
        while ((node = walker.nextNode())) {
            const text = node.nodeValue || "";
            const matches = [...text.matchAll(COMMAND_REGEX)];

            if (matches.length > 0) {
                const match = matches[0];
                const fullMatch = match[0];
                const index = match.index!;
                const matchEnd = index + fullMatch.length;

                const isCaretAtEnd = selection.anchorNode === node && selection.anchorOffset === matchEnd;
                if (isCaretAtEnd) continue;

                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, matchEnd);

                const chip = createChipElement(fullMatch);

                range.deleteContents();
                range.insertNode(chip);

                const newRange = document.createRange();
                newRange.setStartAfter(chip);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);

                value = element.textContent || "";
                return;
            }
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) {
                onsend?.(value);
                value = "";
                if (element) element.innerHTML = "";
            }
        }
    }

    $effect(() => {
        if (value === "" && element) {
            element.innerHTML = "";
        }
    });

    export function focus() {
        element?.focus();
    }
</script>

<div class="w-full max-w-[680px] mx-auto px-4 pb-6">
    <div
        class="relative flex flex-col bg-[var(--chat-input-bg)] rounded-xl border transition-all duration-200"
        style="border-color: {isCommandLikely ? 'var(--fg-secondary)' : 'var(--chat-input-border)'};"
    >
        <!-- Text area with placeholder -->
        <div class="relative w-full">
            {#if !value}
                <div class="absolute inset-0 px-4 pt-3.5 pb-0 text-[15px] leading-[1.5] text-[var(--fg-secondary)] opacity-50 pointer-events-none select-none z-0">
                    {placeholder}
                </div>
            {/if}

            <div
                bind:this={element}
                contenteditable="true"
                role="textbox"
                tabindex="0"
                aria-multiline="true"
                oninput={handleInput}
                onkeydown={handleKeydown}
                spellcheck="false"
                class="relative z-10 w-full min-h-[48px] max-h-[200px] px-4 pt-3.5 pb-0 bg-transparent border-none outline-none text-[var(--fg)] text-[15px] leading-[1.5] resize-none overflow-y-auto selection:bg-zinc-300/30"
            ></div>
        </div>

        <!-- Bottom toolbar -->
        <div class="flex justify-between items-center px-3 pb-2 pt-1">
            <!-- Left tools -->
            <div class="flex items-center gap-0.5">
                <button
                    class="p-2 rounded-lg text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)] hover:bg-[var(--hover-bg)] transition-colors duration-150"
                    title="Attach"
                >
                    <Plus size={18} strokeWidth={1.5} />
                </button>
                <button
                    class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)] hover:bg-[var(--hover-bg)] transition-colors duration-150 max-w-[140px]"
                    title="Select model"
                    onclick={() => modelService.openSelector()}
                >
                    <span class="text-[12px] truncate">{modelService.activeModel.name}</span>
                    <ChevronDown size={12} strokeWidth={1.5} />
                </button>
            </div>

            <!-- Right: Mic + Send -->
            <div class="flex items-center gap-1">
                <button
                    class="p-2 rounded-lg text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)] hover:bg-[var(--hover-bg)] transition-colors duration-150"
                    title="Voice"
                >
                    <Mic size={18} strokeWidth={1.5} />
                </button>

                {#if value.trim()}
                    <div transition:fade={{ duration: 100 }}>
                        <button
                            class="ml-1 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--fg)] text-[var(--bg)] hover:opacity-90 transition-opacity duration-150"
                            onclick={() => {
                                onsend?.(value);
                                value = "";
                                if (element) element.innerHTML = "";
                            }}
                        >
                            <ArrowUp size={16} strokeWidth={2} />
                        </button>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>
