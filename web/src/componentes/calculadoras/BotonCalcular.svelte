<script lang="ts">
  // «Calcular» under an equation of the book that is in the formula catalogue. The calculator itself
  // (and the plot component it uses) is loaded only when the button is pressed.
  import { onMount } from 'svelte';
  import Calculator from '@lucide/svelte/icons/calculator';
  import { calc, pedirMapa } from './datos.svelte';

  let { svg }: { svg: string } = $props();

  onMount(pedirMapa);

  const ids = $derived(calc.porSvg[svg] ?? []);
  let abierto = $state(false);
  let boton: HTMLButtonElement | undefined = $state();
  const panelId = `calc-${Math.random().toString(36).slice(2, 9)}`;

  function cerrar() {
    abierto = false;
    boton?.focus();
  }
</script>

{#if ids.length}
  <div class="fila-calcular">
    <button bind:this={boton} class="calcular" aria-expanded={abierto} aria-controls={panelId} onclick={() => (abierto = !abierto)}
      title={ids.length > 1 ? `${ids.length} fórmulas de esta ecuación` : 'Calculadora de esta fórmula'}>
      <Calculator size={15} aria-hidden="true" /> Calcular{#if ids.length > 1}<span class="n">{ids.length}</span>{/if}
    </button>
  </div>
  {#if abierto}
    <div id={panelId}>
      {#await import('./Emergente.svelte')}
        <div class="cargando">Abriendo la calculadora…</div>
      {:then m}
        <m.default {ids} oncerrar={cerrar} />
      {:catch}
        <div class="cargando">No se pudo abrir la calculadora.</div>
      {/await}
    </div>
  {/if}
{/if}

<style>
  .fila-calcular {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
  }
  .calcular {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 32px;
    padding: 0 11px;
    border: 1px solid var(--acento-borde);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--acento);
    font-family: var(--sans);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  /* The visible pill is 32 px; the touch target reaches 44 px. */
  .calcular::before {
    content: '';
    position: absolute;
    inset: -6px -2px;
  }
  .calcular:hover,
  .calcular[aria-expanded='true'] {
    background: var(--acento-tinte);
  }
  .n {
    min-width: 1.4em;
    padding: 0 4px;
    border-radius: 999px;
    background: var(--acento-suave);
    font-size: 11.5px;
    text-align: center;
  }
  .cargando {
    padding: 10px 0;
    color: var(--tinta-suave);
    font-family: var(--sans);
    font-size: 14px;
  }
</style>
