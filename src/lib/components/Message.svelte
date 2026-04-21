<script lang="ts">
    import { slide, fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import {
        Copy,
        ThumbsUp,
        ThumbsDown,
        ChevronDown,
        Star,
        Check,
        Wrench,
    } from "lucide-svelte";
    import SquareDots from "./SquareDots.svelte";
    import type { Message } from "$lib/services/llm.svelte";

    let { message } = $props<{ message: Message }>();

    let isStepsExpanded = $state(false);
    let copied = $state(false);
    let feedback = $state<"up" | "down" | null>(null);

    function toggleSteps() {
        isStepsExpanded = !isStepsExpanded;
    }

    async function copyToClipboard() {
        await navigator.clipboard.writeText(message.content);
        copied = true;
        setTimeout(() => (copied = false), 2000);
    }

    function handleFeedback(type: "up" | "down") {
        feedback = feedback === type ? null : type;
    }

    let stepCount = $derived(
        (message.reasoning ? 1 : 0) + (message.toolCalls?.length ?? 0),
    );
    let hasSteps = $derived(stepCount > 0);

    function formatContent(content: string): string {
        let html = content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
        html = html.replace(/`(.+?)`/g, "<code>$1</code>");
        html = html.replace(
            /(https?:\/\/[^\s<]+)/g,
            '<a href="$1" target="_blank" rel="noopener" style="color:var(--link);text-decoration:none;">$1</a>',
        );
        const paragraphs = html.split(/\n\n+/);
        return paragraphs
            .map(
                (p) =>
                    `<p style="margin:0 0 0.75em 0;">${p.replace(/\n/g, "<br>")}</p>`,
            )
            .join("");
    }
</script>

{#if message.role === "user"}
    <div
        in:fly={{ y: 4, duration: 200, easing: cubicOut }}
        class="flex justify-end"
    >
        <div
            class="max-w-[75%] bg-[var(--user-bubble)] text-[var(--fg)] rounded-2xl rounded-br-[4px] px-4 py-2.5 text-[15px] leading-[1.5]"
        >
            {message.content}
        </div>
    </div>
{:else if message.role === "action"}
    <div
        in:fly={{ y: 4, duration: 200, easing: cubicOut }}
        class="flex justify-center"
    >
        <div
            class="flex items-center gap-2 text-[13px] text-[var(--fg-tertiary)] py-1"
        >
            <Check size={14} strokeWidth={1.5} class="text-green-600" />
            <span>{message.content}</span>
        </div>
    </div>
{:else if message.role === "assistant"}
    <div
        in:fly={{ y: 4, duration: 200, easing: cubicOut }}
        class="flex flex-col gap-4 group/message"
    >
        <!-- Steps Container — reasoning + tool calls unified -->
        {#if hasSteps}
            <div class="flex flex-col">
                <button
                    onclick={toggleSteps}
                    class="flex items-center gap-1.5 text-[var(--fg-secondary)] hover:text-[var(--fg)] transition-colors w-fit mb-2"
                >
                    <span class="text-[13px] font-medium">
                        {stepCount}
                        {stepCount === 1 ? "Step" : "Steps"}
                    </span>
                    <ChevronDown
                        size={14}
                        class="transition-transform duration-200 {isStepsExpanded
                            ? 'rotate-180'
                            : ''}"
                    />
                </button>

                {#if isStepsExpanded}
                    <div
                        in:slide={{ duration: 200, easing: cubicOut }}
                        class="rounded-xl border border-[var(--border)] bg-[var(--thinking-bg)] px-4 py-3 space-y-4"
                    >
                        <!-- Reasoning Step -->
                        {#if message.reasoning}
                            <div class="flex flex-col gap-2">
                                <div class="flex items-center gap-2">
                                    <Star
                                        size={13}
                                        strokeWidth={1.5}
                                        class="text-[var(--fg-tertiary)]"
                                    />
                                    <span
                                        class="text-[13px] font-medium text-[var(--fg)]"
                                        >Reasoning</span
                                    >
                                </div>
                                <div
                                    class="text-[13px] text-[var(--fg-secondary)] leading-relaxed whitespace-pre-wrap pl-5 border-l border-[var(--border)] ml-1.5"
                                >
                                    {message.reasoning}
                                </div>
                            </div>
                        {/if}

                        <!-- Tool Call Steps -->
                        {#each message.toolCalls ?? [] as tc}
                            <div class="flex flex-col gap-2">
                                <div class="flex items-center gap-2">
                                    <Wrench
                                        size={13}
                                        strokeWidth={1.5}
                                        class="text-[var(--fg-tertiary)]"
                                    />
                                    <span
                                        class="text-[13px] font-medium text-[var(--fg)]"
                                        >{tc.tool}</span
                                    >
                                </div>

                                {#if tc.args && Object.keys(tc.args).length > 0}
                                    <div class="flex flex-wrap gap-1.5 pl-5">
                                        {#each Object.entries(tc.args) as [key, val]}
                                            <span
                                                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--hover-bg)] border border-[var(--border)] text-[11px] text-[var(--fg-secondary)]"
                                            >
                                                <span class="opacity-60"
                                                    >{key}</span
                                                >
                                                <span class="text-[var(--fg)]"
                                                    >{String(val)}</span
                                                >
                                            </span>
                                        {/each}
                                    </div>
                                {/if}

                                <div class="flex items-center gap-2 pl-5">
                                    {#if tc.status === "pending"}
                                        <div
                                            class="w-3.5 h-3.5 rounded-full border-2 border-[var(--fg-tertiary)] border-t-transparent animate-spin"
                                        ></div>
                                        <span
                                            class="text-[12px] text-[var(--fg-secondary)] animate-pulse"
                                            >Running...</span
                                        >
                                    {:else}
                                        <Check
                                            size={14}
                                            strokeWidth={2}
                                            class="text-green-600"
                                        />
                                        <span
                                            class="text-[12px] text-[var(--fg-secondary)]"
                                            >{tc.result}</span
                                        >
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Main Content -->
        {#if message.content}
            <div class="text-[15px] leading-[1.6] text-[var(--fg)] font-normal">
                {@html formatContent(message.content)}
            </div>

            <div
                class="flex items-center gap-1 -mt-1 opacity-0 group-hover/message:opacity-100 transition-opacity duration-150"
            >
                <button
                    onclick={copyToClipboard}
                    class="p-1.5 rounded-md text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)] transition-colors duration-150"
                    title="Copy"
                >
                    {#if copied}
                        <Check
                            size={15}
                            strokeWidth={1.5}
                            class="text-green-600"
                        />
                    {:else}
                        <Copy size={15} strokeWidth={1.5} />
                    {/if}
                </button>
                <button
                    onclick={() => handleFeedback("up")}
                    class="p-1.5 rounded-md transition-colors duration-150 {feedback ===
                    'up'
                        ? 'text-[var(--fg)]'
                        : 'text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)]'}"
                    title="Helpful"
                >
                    <ThumbsUp size={15} strokeWidth={1.5} />
                </button>
                <button
                    onclick={() => handleFeedback("down")}
                    class="p-1.5 rounded-md transition-colors duration-150 {feedback ===
                    'down'
                        ? 'text-[var(--fg)]'
                        : 'text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)]'}"
                    title="Not helpful"
                >
                    <ThumbsDown size={15} strokeWidth={1.5} />
                </button>
            </div>
        {:else if !hasSteps}
            <div class="flex items-center gap-3 py-2">
                <SquareDots />
                <span class="text-[13px] text-[var(--fg-tertiary)]"
                    >Thinking...</span
                >
            </div>
        {/if}
    </div>
{/if}
