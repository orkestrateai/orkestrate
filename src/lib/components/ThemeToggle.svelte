<script lang="ts">
    import { themeManager, type Theme } from "$lib/theme.svelte";
    import { Sun, Moon, Monitor } from "lucide-svelte";
    import { fade, scale } from "svelte/transition";
    import * as Button from "$lib/components/ui/button";

    function nextTheme() {
        const order: Theme[] = ["light", "dark", "system"];
        const next = order[(order.indexOf(themeManager.current) + 1) % order.length];
        themeManager.set(next);
    }
</script>

<Button.Root
    variant="ghost"
    size="icon"
    onclick={nextTheme}
    class="rounded-full opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
    aria-label="Toggle Theme"
>
    <div class="relative w-[18px] h-[18px] flex items-center justify-center">
        {#if themeManager.current === 'light'}
            <div class="absolute flex items-center justify-center" in:scale={{ duration: 200, start: 0.8 }} out:fade={{ duration: 100 }}>
                <Sun size={18} strokeWidth={1.5} />
            </div>
        {:else if themeManager.current === 'dark'}
            <div class="absolute flex items-center justify-center" in:scale={{ duration: 200, start: 0.8 }} out:fade={{ duration: 100 }}>
                <Moon size={18} strokeWidth={1.5} />
            </div>
        {:else}
            <div class="absolute flex items-center justify-center" in:scale={{ duration: 200, start: 0.8 }} out:fade={{ duration: 100 }}>
                <Monitor size={18} strokeWidth={1.5} />
            </div>
        {/if}
    </div>
</Button.Root>
