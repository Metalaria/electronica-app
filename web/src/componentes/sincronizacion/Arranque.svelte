<script lang="ts">
  // Mounted once by App.svelte: when the reader is up and the browser idle, loads the synchronisation and
  // update-check chunk (Avisos.svelte). Nothing is requested from GitHub without a token.
  import { app } from '../../lib/estado.svelte';
  import { usuario } from '../../lib/usuario.svelte';

  let listo = $state(false);

  $effect(() => {
    if (listo || !app.cargado || !usuario.listo) return;
    const ir = () => (listo = true);
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(ir, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(ir, 1500);
    return () => clearTimeout(t);
  });
</script>

{#if listo}
  {#await import('./Avisos.svelte') then m}
    <m.default />
  {/await}
{/if}
