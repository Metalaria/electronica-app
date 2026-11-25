<script lang="ts">
  // The icon rail (desktop and tablet landscape), 2.1: the logo (→ Inicio) and the five groups of lib/navegacion
  // (GRUPOS), each an icon over its label with a pill behind the current one. A group's parts are the header's tabs
  // (Barra.svelte). While reading, «Libro» shows or hides the book's index panel, as an activity bar.
  import { ruta } from '../lib/ruta.svelte';
  import { GRUPOS, grupoActual, hrefGrupo, indiceDesdeLibro, indiceOculto, type Grupo } from '../lib/navegacion.svelte';
  import Icono from './Icono.svelte';

  const actual = $derived(grupoActual()?.id ?? null);

  /** Tooltip: the group's parts, or what «Libro» does while reading. */
  function tip(g: Grupo): string {
    if (g.id === 'libro' && ruta.vista === 'parte') return indiceOculto() ? 'Libro: mostrar el índice' : 'Libro: ocultar el índice';
    if (g.partes.length < 2) return g.etiqueta;
    return g.partes.map((p) => p.corta ?? p.etiqueta).join(' · ');
  }

  function clic(g: Grupo, ev: MouseEvent) {
    if (g.id !== 'libro' || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return;
    if (indiceDesdeLibro(true)) ev.preventDefault();
  }
</script>

<nav class="carril" aria-label="Secciones de la aplicación">
  <!-- The logo also leads home; «Inicio» is the first entry, so the logo stays out of the tab order. -->
  <a class="logo" href="#/" tabindex="-1" aria-hidden="true">
    <svg viewBox="0 0 1024 1024" aria-hidden="true"><rect width="1024" height="1024" rx="230" fill="#1A3A5C" /><path d="M196 512H330M694 512H828" stroke="#F4F1EA" stroke-width="56" stroke-linecap="round" /><circle cx="176" cy="512" r="64" fill="#F4F1EA" /><circle cx="848" cy="512" r="64" fill="#F4F1EA" /><rect x="318" y="392" width="388" height="240" rx="64" fill="#F4F1EA" /><rect x="388" y="392" width="40" height="240" fill="#A6552B" /><rect x="458" y="392" width="40" height="240" fill="#8A1F3D" /><rect x="528" y="392" width="40" height="240" fill="#1F6F5C" /><rect x="606" y="392" width="28" height="240" fill="#C9A227" /></svg>
  </a>

  <div class="items">
    {#each GRUPOS as g (g.id)}
      {@const activo = g.id === actual}
      <a
        class="item"
        class:activo
        href={hrefGrupo(g)}
        aria-current={activo ? 'page' : undefined}
        aria-expanded={g.id === 'libro' && ruta.vista === 'parte' ? !indiceOculto() : undefined}
        data-grupo={g.id}
        data-herramienta={g.id}
        onclick={(ev) => clic(g, ev)}
      >
        <span class="icono"><Icono nombre={g.icono} tam={22} /></span>
        <span class="etiqueta">{g.etiqueta}</span>
        <span class="tip" aria-hidden="true">{tip(g)}</span>
      </a>
    {/each}
  </div>
</nav>

<style>
  .carril {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 31;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: var(--ancho-carril);
    padding: calc(20px + env(safe-area-inset-top)) 0 calc(8px + env(safe-area-inset-bottom));
    padding-left: env(safe-area-inset-left);
    background: var(--fondo-carril);
    font-family: var(--sans);
  }

  .logo {
    display: grid;
    flex: none;
    place-items: center;
    width: 44px;
    height: 44px;
    margin-bottom: 28px;
    border-radius: 12px;
  }
  .logo svg {
    display: block;
    width: 44px;
    height: 44px;
    transition: transform 0.15s;
  }
  .logo:hover svg {
    transform: scale(1.05);
  }

  .items {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  /* 2.1: the whole entry is the pill (72 × 57, 14 px corners), as in the mock-up */
  .item {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: 72px;
    min-height: 57px;
    padding: 8px 0;
    border-radius: 14px;
    color: var(--v11-tinta-suave);
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
    -webkit-tap-highlight-color: transparent;
  }
  .icono {
    display: grid;
    place-items: center;
    height: 24px;
  }
  .etiqueta {
    max-width: 72px;
    overflow: hidden;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .item:hover {
    background: var(--hover);
    color: var(--v11-tinta);
  }
  .item.activo {
    background: var(--v11-azul-tinte);
    color: var(--v11-tinta);
  }
  .item.activo .icono {
    color: var(--v11-azul);
  }
  .item.activo .etiqueta {
    font-weight: 600;
  }
  .item:focus-visible {
    outline: 2px solid var(--v11-foco);
    outline-offset: 1px;
    border-radius: 14px;
  }

  /* tooltip: hover (after a short wait) and keyboard focus; never needed to understand the entry */
  .tip {
    position: absolute;
    top: 50%;
    left: calc(100% + 10px);
    z-index: 2;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--titulos);
    color: var(--fondo);
    box-shadow: var(--sombra);
    font-size: 13.5px;
    font-weight: 600;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transform: translate(-4px, -50%);
    transition: opacity 0.12s, transform 0.12s;
    visibility: hidden;
  }
  @media (hover: hover) {
    .item:hover .tip {
      opacity: 1;
      transform: translate(0, -50%);
      visibility: visible;
      transition-delay: 0.45s;
    }
  }
  .item:focus-visible .tip {
    opacity: 1;
    transform: translate(0, -50%);
    visibility: visible;
  }
</style>
