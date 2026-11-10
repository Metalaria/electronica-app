<script lang="ts">
  // 1.1: at the end of a chapter, its new exercises that the book does not have yet (ejercicios.json items with
  // `nuevo`), as one more «Ejercicios» block marked «Aún no en el libro». They are not in the part's blocks, so the
  // reader's anchors (#/cap25/ej-25.1: search, «Abrir en el capítulo») are resolved here once the data has loaded.
  import { onMount, tick } from 'svelte';
  import { cargarEjercicios, ejercicios, nuevosDeParte } from '../../lib/ejercicios.svelte';
  import { ruta } from '../../lib/ruta.svelte';
  import Ejercicios from '../Ejercicios.svelte';

  let { parte }: { parte: string } = $props();

  const bloque = $derived(ejercicios.datos ? nuevosDeParte(parte) : null);
  let caja: HTMLElement | undefined = $state();
  let ultimo = '';

  // go to an exercise of this block named by the route (once per anchor)
  $effect(() => {
    const ancla = ruta.ancla;
    const b = bloque;
    if (!ancla || !b || ancla === ultimo || !b.items.some((x) => x.label === ancla)) return;
    ultimo = ancla;
    void tick().then(() => {
      const el = caja?.querySelector<HTMLElement>(`[id="${CSS.escape(ancla)}"]`);
      if (!el) return;
      el.scrollIntoView({ block: 'start', behavior: 'instant' });
      // the chunks above may still settle their real heights: keep the exercise in place once more
      setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'instant' }), 400);
    });
  });

  onMount(() => void cargarEjercicios());
</script>

{#if bloque}
  <div class="nuevos-cap" bind:this={caja}>
    <Ejercicios {bloque} {parte} nuevos />
  </div>
{/if}
