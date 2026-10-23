<script lang="ts">
  // The calculator opened from the reader: an inline panel under the equation on tablets and computers
  // (it pushes the text down, so the page does not jump), a bottom sheet on phones (moved to <body>, closed
  // by «Atrás», the scrim, the handle or Esc).
  import { onMount } from 'svelte';
  import type { Formula } from './tipos';
  import { formulasPorId } from './datos.svelte';
  import { abrirCapa, cerrarCapa, navegarDesdeCapa } from '../../lib/ruta.svelte';
  import Calculadora from './Calculadora.svelte';
  import Icono from '../Icono.svelte';

  let { ids, oncerrar }: { ids: string[]; oncerrar: () => void } = $props();

  const hoja = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
  const CAPA = 'calculadora';
  let formulas = $state<Formula[] | null>(null);
  let raiz: HTMLElement | undefined = $state();
  let cerrada = false;

  onMount(() => {
    void formulasPorId(ids).then((fs) => (formulas = fs));
    if (hoja) abrirCapa(CAPA, () => salir(false));
    // Bring the panel into view without moving the equation off screen.
    requestAnimationFrame(() => raiz?.focus({ preventScroll: true }));
    return () => {
      if (hoja && !cerrada) cerrarCapa(CAPA);
    };
  });

  function salir(desdeUi = true) {
    if (cerrada) return;
    cerrada = true;
    if (hoja && desdeUi) cerrarCapa(CAPA);
    oncerrar();
  }

  function teclas(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      salir();
    }
  }

  /** Links inside the sheet replace its history entry, so «Atrás» returns to the reading, not to the sheet. */
  function enlaces(ev: MouseEvent) {
    if (!hoja) return;
    const a = (ev.target as Element | null)?.closest?.('a[href^="#/"]');
    if (!a) return;
    ev.preventDefault();
    cerrada = true;
    navegarDesdeCapa(a.getAttribute('href') as string);
    oncerrar();
  }

  /** Moves the sheet to <body>, out of any transformed or contained ancestor of the reader. */
  function aCuerpo(nodo: HTMLElement) {
    if (!hoja) return;
    document.body.appendChild(nodo);
    return {
      destroy() {
        nodo.remove();
      },
    };
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="emergente" class:hoja use:aCuerpo onkeydown={teclas} onclickcapture={enlaces} role="dialog" aria-modal={hoja ? 'true' : undefined}
  aria-label="Calculadora" tabindex="-1" bind:this={raiz}>
  {#if hoja}<button class="velo" aria-label="Cerrar la calculadora" onclick={() => salir()}></button>{/if}
  <div class="panel">
    {#if hoja}<button class="asa" aria-label="Cerrar la calculadora" onclick={() => salir()}><span></span></button>{/if}
    <button class="cerrar" aria-label="Cerrar la calculadora" title="Cerrar (Esc)" onclick={() => salir()}><Icono nombre="x" tam={18} /></button>
    {#if formulas === null}
      <p class="espera">Cargando las fórmulas…</p>
    {:else if !formulas.length}
      <p class="espera">No se encontraron las fórmulas de esta ecuación.</p>
    {:else}
      <Calculadora {formulas} modo="emergente" />
    {/if}
  </div>
</div>

<style>
  .emergente {
    position: relative;
    margin: 8px 0 14px;
    outline: none;
  }
  .emergente:not(.hoja) .panel {
    position: relative;
    padding: 14px 16px 16px;
    border: 1px solid var(--acento-borde);
    border-radius: 12px;
    background: var(--superficie);
    box-shadow: var(--sombra);
    text-align: left;
  }
  /* The little arrow pointing at the «Calcular» button. */
  .emergente:not(.hoja) .panel::before {
    content: '';
    position: absolute;
    top: -7px;
    right: 40px;
    width: 12px;
    height: 12px;
    border-left: 1px solid var(--acento-borde);
    border-top: 1px solid var(--acento-borde);
    background: var(--superficie);
    transform: rotate(45deg);
  }
  .cerrar {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--tinta-suave);
    cursor: pointer;
  }
  .cerrar:hover {
    background: var(--hover);
  }
  .emergente :global(.calculadora header) {
    padding-right: 44px;
  }
  .espera {
    margin: 4px 0;
    color: var(--tinta-suave);
    font-family: var(--sans);
  }
  /* ---------------------------------------------------------------- bottom sheet (phones) */
  .hoja {
    position: fixed;
    inset: 0;
    z-index: 60;
    margin: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .velo {
    position: absolute;
    inset: 0;
    border: 0;
    background: var(--scrim);
    cursor: pointer;
  }
  .hoja .panel {
    position: relative;
    max-height: 88dvh;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 6px 16px calc(18px + env(safe-area-inset-bottom));
    border-radius: 16px 16px 0 0;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
    animation: subir 0.22s ease-out;
  }
  .asa {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 28px;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .asa span {
    width: 44px;
    height: 5px;
    border-radius: 3px;
    background: var(--linea);
  }
  .hoja .cerrar {
    top: 26px;
  }
  @keyframes subir {
    from {
      transform: translateY(40%);
      opacity: 0.4;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .hoja .panel {
      animation: none;
    }
  }
</style>
