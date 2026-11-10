<script lang="ts">
  // «Practicar» next to the book sections of the twelve practices (printed chapter 21): opens the guided
  // practice on the instruments' test bench; 1.1: «Laboratorio» opens it as a guided lab (the reader does every step on
  // the instruments and each one is checked). The map is static and tiny (no lazy load needed).
  import Gauge from '@lucide/svelte/icons/gauge';
  import FlaskConical from '@lucide/svelte/icons/flask-conical';
  import { PRACTICA_DE_SECCION } from './practicas/mapa';
  import { prepararSalto } from '../../lib/ruta.svelte';
  import { app } from '../../lib/estado.svelte';

  let { label, compacto = false }: { label: string; compacto?: boolean } = $props();

  const n = $derived(PRACTICA_DE_SECCION[label]);

  function salto(): void {
    const r = app.refs[label];
    prepararSalto({ texto: r ? `Volver a ${r.num}` : 'Volver al libro' });
  }
</script>

{#if n}
  <a class="practicar" class:compacto href={`#/instrumentos/practica/${n}`} onclick={salto} title={`Práctica ${n} en el banco de instrumentos`}>
    <Gauge size={16} strokeWidth={2.2} />Practicar
  </a>
  <a class="practicar-lab" class:compacto href={`#/instrumentos/laboratorio/${n}`} onclick={salto} title={`Práctica ${n} como laboratorio guiado`} data-laboratorio-enlace>
    <FlaskConical size={16} strokeWidth={2.2} />Laboratorio
  </a>
{/if}

<style>
  /* 1.1: the lab link looks the same (its own class: «a.practicar» stays the practice's) */
  .practicar,
  .practicar-lab {
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
  .practicar:hover,
  .practicar-lab:hover {
    background: var(--acento-tinte);
  }
  .practicar.compacto,
  .practicar-lab.compacto {
    min-height: 28px;
    padding: 0 9px;
    font-size: 12.5px;
  }
</style>
