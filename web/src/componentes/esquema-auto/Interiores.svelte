<script lang="ts">
  // The subcircuits a netlist defines, drawn on request: the circuit shows them as boxes (or op-amp
  // triangles); this opens the schematic of one of their bodies.
  import { subcircuitosDe } from './modelo';
  import EsquemaAuto from './EsquemaAuto.svelte';

  let { texto, alElegir }: { texto: string; alElegir?: (nombre: string) => void } = $props();

  // Only the names matter: recomputed when the text changes, cheap (no layout).
  const subckts = $derived.by(() => {
    try {
      return subcircuitosDe(texto);
    } catch {
      return [];
    }
  });
  let abierto = $state<string | null>(null);
  $effect(() => {
    if (abierto && !subckts.some((s) => s.nombre === abierto)) abierto = null;
  });
</script>

{#if subckts.length}
  {#if abierto}
    <EsquemaAuto {texto} subckt={abierto} titulo={`Subcircuito ${abierto}`} {alElegir} alVolver={() => (abierto = null)} />
  {:else}
    <div class="interiores" role="group" aria-label="Subcircuitos">
      <span>Subcircuitos de la netlist:</span>
      {#each subckts as s (s.nombre)}
        <button class="boton" onclick={() => (abierto = s.nombre)} title={`Puertos: ${s.puertos.join(', ')}`}>Ver el interior de {s.nombre}</button>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .interiores {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    margin: -8px 0 16px;
    font-family: var(--sans);
    font-size: 13px;
    color: var(--tinta-suave);
  }
  .boton {
    min-height: 44px;
  }
</style>
