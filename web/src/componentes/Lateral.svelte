<script lang="ts">
  // The book index next to the icon rail (desktop and tablet landscape), or as a drawer opened from the «Libro»
  // tab (phone and tablet portrait). The tools live in the rail (Carril.svelte) or the tabs (Pestanas.svelte).
  import { app } from '../lib/estado.svelte';
  import { navegarDesdeCapa } from '../lib/ruta.svelte';
  import { cerrarLateral } from '../lib/acciones';
  import { indiceOculto } from '../lib/navegacion.svelte';
  import Icono from './Icono.svelte';
  import IndiceLibro from './IndiceLibro.svelte';

  const indice = $derived(app.indice!);
  const oculto = $derived(app.movil ? !app.lateral : indiceOculto());

  // Inside the drawer, links replace the drawer's history entry instead of stacking on it.
  function enlace(ev: MouseEvent) {
    const a = (ev.target as Element).closest('a');
    if (!a || !app.movil || !app.lateral) return;
    const href = a.getAttribute('href');
    if (!href?.startsWith('#')) return;
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return;
    ev.preventDefault();
    navegarDesdeCapa(href);
  }

  // Esc closes the drawer (the filter takes it first when it has text).
  function teclas(ev: KeyboardEvent) {
    if (ev.key === 'Escape' && app.movil && app.lateral) cerrarLateral();
  }
</script>

{#if app.movil && app.lateral}
  <button class="velo" aria-label="Cerrar el índice" tabindex="-1" onclick={cerrarLateral}></button>
{/if}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<aside
  class="lateral"
  class:movil={app.movil}
  class:abierto={app.movil ? app.lateral : !oculto}
  aria-label="Índice del libro"
  aria-hidden={oculto ? 'true' : undefined}
  inert={oculto}
  onclick={enlace}
  onkeydown={teclas}
>
  {#if app.movil}
    <div class="cabecera">
      <a class="marca" href="#/">
        <span class="logo" aria-hidden="true">
          <svg viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="230" fill="#1A3A5C" /><path d="M196 512H330M694 512H828" stroke="#F4F1EA" stroke-width="56" stroke-linecap="round" /><circle cx="176" cy="512" r="64" fill="#F4F1EA" /><circle cx="848" cy="512" r="64" fill="#F4F1EA" /><rect x="318" y="392" width="388" height="240" rx="64" fill="#F4F1EA" /><rect x="388" y="392" width="40" height="240" fill="#A6552B" /><rect x="458" y="392" width="40" height="240" fill="#8A1F3D" /><rect x="528" y="392" width="40" height="240" fill="#1F6F5C" /><rect x="606" y="392" width="28" height="240" fill="#C9A227" /></svg>
        </span>
        <span class="nombre">
          <strong>Electrónica Práctica Avanzada</strong>
          <small>Índice · edición {indice.edicion}</small>
        </span>
      </a>
      <button class="boton-icono cerrar" aria-label="Cerrar el índice" onclick={cerrarLateral}><Icono nombre="x" tam={22} /></button>
    </div>
  {:else}
    <div class="cabecera-panel">
      <span class="titulo-panel">Índice del libro</span>
      <span class="edicion">Ed. {indice.edicion}</span>
    </div>
  {/if}
  {#if !oculto || app.movil}
    <IndiceLibro visible={!oculto} />
  {/if}
</aside>

<style>
  .lateral {
    position: fixed;
    top: 0;
    bottom: 0;
    left: var(--ancho-carril);
    z-index: 30;
    display: none;
    flex-direction: column;
    width: var(--ancho-panel);
    background: var(--fondo-lateral);
    border-right: 1px solid var(--linea);
    font-family: var(--sans);
    overflow: hidden;
  }
  .lateral.abierto {
    display: flex;
  }
  .cabecera-panel {
    display: flex;
    flex: none;
    align-items: baseline;
    gap: 8px;
    height: var(--alto-barra);
    padding: 0 20px;
    padding-top: 21px;
  }
  .titulo-panel {
    color: var(--tinta-tenue);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .edicion {
    margin-left: auto;
    color: var(--tinta-tenue);
    font-size: 12px;
  }

  /* ---------------------------------------------------------------- phone drawer */
  .lateral.movil {
    display: flex;
    left: 0;
    width: min(88vw, 380px);
    transform: translateX(-102%);
    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1), visibility 0s linear 0.24s;
    visibility: hidden;
    box-shadow: var(--sombra-alta);
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
  }
  .lateral.movil.abierto {
    transform: none;
    visibility: visible;
    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .velo {
    position: fixed;
    inset: 0;
    z-index: 29;
    border: 0;
    background: var(--scrim);
    animation: aparecer 0.2s ease;
  }
  @keyframes aparecer {
    from {
      opacity: 0;
    }
  }
  .cabecera {
    display: flex;
    flex: none;
    align-items: center;
    gap: 6px;
    padding: 12px 8px 12px 16px;
  }
  .marca {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 11px;
    min-width: 0;
    color: var(--titulos);
    text-decoration: none;
  }
  .logo svg {
    display: block;
    width: 36px;
    height: 36px;
  }
  .nombre {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.15;
  }
  .nombre strong {
    font-size: 15.5px;
    font-weight: 700;
  }
  .nombre small {
    margin-top: 2px;
    color: var(--tinta-tenue);
    font-size: 12.5px;
  }
  .cerrar {
    width: 44px;
    height: 44px;
  }
</style>
