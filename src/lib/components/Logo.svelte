<script lang="ts">
    interface Props {
        className?: string;
        withText?: boolean;
        size?: 'sm' | 'md' | 'lg' | 'xl';
    }

    let { 
        className = '', 
        withText = true, 
        size = 'md' 
    }: Props = $props();

    // Size mappings translated from the React version
    const containerSizes = {
        sm: 'w-6 h-6',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
        xl: 'w-16 h-16',
    };

    const textSizes = {
        sm: 'text-lg',
        md: 'text-2xl',
        lg: 'text-3xl',
        xl: 'text-4xl',
    };
</script>

<div class="flex items-center gap-3 md:gap-4 {className}">
    <!-- The Definitive Orkestrate Branding -->
    <img 
        src="/logo.png" 
        alt="Orkestrate" 
        class="flex-shrink-0 object-contain {containerSizes[size]}"
    />

    <!-- Brand Text -->
    {#if withText}
        <span class="font-sans font-light tracking-tight text-[var(--fg)] {textSizes[size]}">
            Orkestrate
        </span>
    {/if}
</div>
