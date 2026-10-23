<script lang="ts">
  // «Practicar» next to the book sections of the twelve practices (printed chapter 21): opens the guided
  // practice on the instruments' test bench. The map is static and tiny (no lazy load needed).
  import Gauge from '@lucide/svelte/icons/gauge';
  import { prepararSalto } from '../../lib/ruta.svelte';
  import { app } from '../../lib/estado.svelte';

  let { label, compacto = false }: { label: string; compacto?: boolean } = $props();

  const PRACTICA: Record<string, number> = {
    'sec-22.1': 1,
    'sec-22.2': 2,
    'sec-22.3': 3,
    'sec-22.4': 4,
    'sec-22.5': 5,
    'sec-22.6': 6,
    'sec-22.7': 7,
    'sec-22.8': 8,
    'sec-22.9': 9,
    'sec-22.11': 10,
    'sec-22.12': 11,
    'sec-22.13': 12,
  };
  const n = $derived(PRACTICA[label]);

  function salto(): void {
    const r = app.refs[label];
    prepararSalto({ texto: r ? `Volver a ${r.num}` : 'Volver al libro' });
  }
</script>

{#if n}
  <a class="practicar" class:compacto href={`#/instrumentos/practica/${n}`} onclick={salto} title={`Práctica ${n} en el banco de instrumentos`}>
    <Gauge size={16} strokeWidth={2.2} />Practicar
  </a>
{/if}

<style>
  .practicar {
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
    font-size: 13.5px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    vertical-align: middle;
  }
  .practicar:hover {
    background: var(--acento-tinte);
  }
  .practicar.compacto {
    min-height: 28px;
    padding: 0 9px;
    font-size: 12.5px;
  }
</style>
