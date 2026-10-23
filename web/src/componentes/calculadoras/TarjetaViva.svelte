<script lang="ts">
  // Makes a formula card of the book «live»: every catalogued formula of the card computes with shared
  // variables (set R and C once; τ, f_c… follow). The panel is loaded only when opened.
  import { onMount } from 'svelte';
  import Calculator from '@lucide/svelte/icons/calculator';
  import type { Bloque } from '../../lib/tipos';
  import { calc, pedirMapa } from './datos.svelte';

  let { bloques }: { bloques: Bloque[] } = $props();

  onMount(pedirMapa);

  function svgs(bs: Bloque[], out: string[] = []): string[] {
    for (const b of bs) {
      if (b.t === 'ec') out.push(b.svg);
      if ('bloques' in b && Array.isArray(b.bloques)) svgs(b.bloques as Bloque[], out);
    }
    return out;
  }

  const ids = $derived([...new Set(svgs(bloques).flatMap((s) => calc.porSvg[s] ?? []))]);
  let abierta = $state(false);
</script>

{#if ids.length}
  <div class="viva">
    <button class="abrir" aria-expanded={abierta} onclick={() => (abierta = !abierta)}>
      <Calculator size={16} aria-hidden="true" />
      {abierta ? 'Cerrar la tarjeta viva' : `Calcular con la tarjeta (${ids.length} ${ids.length === 1 ? 'fórmula' : 'fórmulas'})`}
    </button>
    {#if abierta}
      {#await import('./TarjetaPanel.svelte')}
        <p class="espera">Abriendo…</p>
      {:then m}
        <m.default {ids} />
      {/await}
    {/if}
  </div>
{/if}

<style>
  .viva {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed color-mix(in srgb, var(--c-tarjeta) 45%, transparent);
    font-family: var(--sans);
  }
  .abrir {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid color-mix(in srgb, var(--c-tarjeta) 55%, transparent);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--c-tarjeta-texto);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .abrir:hover,
  .abrir[aria-expanded='true'] {
    background: color-mix(in srgb, var(--c-tarjeta) 12%, var(--superficie));
  }
  .espera {
    color: var(--tinta-suave);
    font-size: 14px;
  }
</style>
