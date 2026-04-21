<script lang="ts">
  import "../app.css";
  import { themeManager } from "$lib/theme.svelte";
  let { children } = $props();

  // The singleton is initialized on import, but we can ensure it's ready.
</script>

{@render children()}
