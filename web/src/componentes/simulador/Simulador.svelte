<script lang="ts">
  // Simulator view (loaded on demand: the reader does not pay for it at start-up).
  import { onMount, tick } from 'svelte';
  import { ruta, recordarScroll } from '../../lib/ruta.svelte';
  import { cargarIndiceSpice } from '../../simulador/datos.svelte';
  import Indice from './Indice.svelte';
  import Pagina from './Pagina.svelte';

  // Back/forward return to the same place of the list; a new page starts at the top.
  $effect(() => {
    void ruta.n;
    const y = ruta.y;
    void cargarIndiceSpice()
      .then(() => tick())
      .then(() => requestAnimationFrame(() => window.scrollTo({ top: y ?? 0, behavior: 'instant' })));
  });

  onMount(() => {
    const alDesplazar = () => recordarScroll();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    return () => window.removeEventListener('scroll', alDesplazar);
  });
</script>

<svelte:head>
  <title>Simulador · Electrónica Práctica Avanzada</title>
</svelte:head>

{#if ruta.sim}
  {#key ruta.sim}
    <Pagina id={ruta.sim} />
  {/key}
{:else}
  <Indice />
{/if}
