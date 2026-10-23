<script lang="ts">
  // Read fraction of a whole volume (sections read / sections), as a thin bar with its percentage.
  import { onMount } from 'svelte';
  import { aprendizaje, cargarAprendizaje } from '../../lib/aprendizaje.svelte';
  import { infoParte } from '../../lib/datos';

  let { partes }: { partes: string[] } = $props();

  const f = $derived.by(() => {
    if (!aprendizaje.listo) return 0;
    let total = 0;
    let leidas = 0;
    for (const p of partes) {
      const secs = infoParte(p)?.secciones ?? [];
      total += secs.length;
      const l = aprendizaje.leidas[p];
      if (l) for (const s of secs) if (l[s.label]) leidas++;
    }
    return total ? leidas / total : 0;
  });

  onMount(() => {
    void cargarAprendizaje();
  });
</script>

{#if f > 0}
  <span class="progreso-tomo" title={`${Math.round(f * 100)} % del tomo leído`}>
    <span class="barra" aria-hidden="true"><span style:width={`${Math.max(2, f * 100)}%`}></span></span>
    <span class="pct">{Math.round(f * 100)} %</span>
  </span>
{/if}

<style>
  .progreso-tomo {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 5px;
  }
  .barra {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--linea);
    overflow: hidden;
  }
  .barra span {
    display: block;
    height: 100%;
    border-radius: 2px;
    background: var(--c-ejemplo);
  }
  .pct {
    color: var(--tinta-tenue);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
</style>
