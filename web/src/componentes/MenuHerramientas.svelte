<script lang="ts">
  // The sections that are not on screen: next to the rail's «Más» button (desktop, `lateral`) or as a sheet
  // above the phone's tab bar (`hoja`). An overlay of the history, so «Atrás» closes it.
  import { onMount } from 'svelte';
  import { abrirCapa, cerrarCapa, navegarDesdeCapa } from '../lib/ruta.svelte';
  import { activar, esActiva, type Herramienta } from '../lib/navegacion.svelte';
  import Icono from './Icono.svelte';

  let {
    items,
    ancla,
    modo,
    onCerrar,
  }: { items: Herramienta[]; ancla: HTMLElement; modo: 'lateral' | 'hoja'; onCerrar: () => void } = $props();

  let panel: HTMLElement | undefined = $state();
  let cerrada = false;
  let pos = $state({ bottom: 0 });

  function cerrar() {
    if (!cerrada) cerrarCapa('mas');
  }

  function elegir(h: Herramienta, ev: MouseEvent) {
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return;
    ev.preventDefault();
    if (h.ruta) {
      navegarDesdeCapa(h.ruta);
    } else {
      cerrar();
      // the overlay's history entry goes first, then the action may open its own overlay
      setTimeout(() => activar(h), 80);
    }
  }

  function teclas(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      cerrar();
      ancla.focus();
      return;
    }
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp' && ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    const lista = Array.from(panel?.querySelectorAll<HTMLElement>('.opcion') ?? []);
    const k = lista.indexOf(document.activeElement as HTMLElement);
    const paso = ev.key === 'ArrowDown' || ev.key === 'ArrowRight' ? 1 : -1;
    ev.preventDefault();
    lista[(k + paso + lista.length) % lista.length]?.focus();
  }

  onMount(() => {
    abrirCapa('mas', () => {
      cerrada = true;
      onCerrar();
    });
    if (modo === 'lateral') {
      const r = ancla.getBoundingClientRect();
      pos = { bottom: Math.max(8, window.innerHeight - r.bottom) };
    }
    const fuera = (ev: PointerEvent) => {
      const t = ev.target as Node;
      if (panel?.contains(t) || ancla.contains(t)) return;
      cerrar();
    };
    document.addEventListener('pointerdown', fuera, true);
    panel?.querySelector<HTMLElement>('.opcion')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('pointerdown', fuera, true);
      // closed by its button (not by «Atrás» or a choice): drop the history entry too
      if (!cerrada) {
        cerrada = true;
        cerrarCapa('mas');
      }
    };
  });
</script>

{#if modo === 'hoja'}
  <button class="velo" aria-label="Cerrar" tabindex="-1" onclick={cerrar}></button>
{/if}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="menu {modo}"
  role="menu"
  tabindex="-1"
  aria-label="Más secciones"
  bind:this={panel}
  style:bottom={modo === 'lateral' ? `${pos.bottom}px` : undefined}
  onkeydown={teclas}
>
  {#if modo === 'hoja'}<div class="asa" aria-hidden="true"></div>{/if}
  {#each items as h (h.id)}
    {@const n = h.cuenta?.() ?? 0}
    <a
      class="opcion"
      class:activa={esActiva(h)}
      role="menuitem"
      href={h.ruta ?? '#'}
      data-herramienta={h.id}
      onclick={(ev) => elegir(h, ev)}
    >
      <span class="icono"><Icono nombre={h.icono} tam={modo === 'hoja' ? 24 : 20} /></span>
      <span class="nombre">{h.etiqueta}</span>
      {#if n}<span class="cuenta">{n}</span>{/if}
    </a>
  {/each}
</div>

<style>
  .menu {
    position: fixed;
    z-index: 45;
    font-family: var(--sans);
    animation: entrar 0.14s ease-out;
  }
  @keyframes entrar {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  .menu:focus {
    outline: none;
  }

  /* next to the rail */
  .menu.lateral {
    left: calc(var(--ancho-carril) + 6px);
    display: grid;
    min-width: 230px;
    padding: 6px;
    border: 1px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
  }
  .lateral .opcion {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 9px;
    color: var(--tinta);
    font-size: 15px;
    text-decoration: none;
  }
  .lateral .opcion .icono {
    display: inline-grid;
    color: var(--tinta-suave);
  }

  /* phone: a sheet above the tab bar */
  .velo {
    position: fixed;
    inset: 0;
    z-index: 44;
    border: 0;
    background: var(--scrim);
    animation: aparecer 0.18s ease;
  }
  @keyframes aparecer {
    from {
      opacity: 0;
    }
  }
  .menu.hoja {
    right: 0;
    bottom: 0;
    left: 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    max-height: 80vh;
    overflow-y: auto;
    padding: 8px 12px calc(14px + env(safe-area-inset-bottom));
    border-radius: 20px 20px 0 0;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
  }
  .asa {
    grid-column: 1 / -1;
    justify-self: center;
    width: 36px;
    height: 4px;
    margin: 0 0 8px;
    border-radius: 2px;
    background: var(--linea);
  }
  .hoja .opcion {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    min-height: 88px;
    padding: 14px 4px 10px;
    border-radius: 14px;
    color: var(--tinta);
    font-size: 13.5px;
    line-height: 1.2;
    text-align: center;
    text-decoration: none;
  }
  .hoja .icono {
    display: grid;
    place-items: center;
    width: 48px;
    height: 36px;
    border-radius: 18px;
    color: var(--tinta-suave);
  }
  .hoja .cuenta {
    position: absolute;
    top: 8px;
    right: calc(50% - 30px);
  }
  @media (min-width: 600px) {
    .menu.hoja {
      grid-template-columns: repeat(5, 1fr);
      padding-left: max(12px, calc(50% - 300px));
      padding-right: max(12px, calc(50% - 300px));
    }
  }

  .opcion:hover,
  .opcion:focus-visible {
    background: var(--hover);
  }
  .opcion.activa {
    font-weight: 700;
  }
  .opcion.activa .icono {
    color: var(--acento);
  }
  .hoja .opcion.activa .icono {
    background: var(--acento-suave);
  }
  .cuenta {
    min-width: 20px;
    margin-left: auto;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--linea);
    color: var(--tinta-suave);
    font-size: 12px;
    font-weight: 700;
    line-height: 20px;
    text-align: center;
  }
</style>
