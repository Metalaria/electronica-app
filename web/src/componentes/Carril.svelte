<script lang="ts">
  // The icon rail (desktop and tablet landscape): the app's sections from the HERRAMIENTAS registry, each with
  // its icon and a short label always visible, the full name in a tooltip, the current one marked. Entries
  // that do not fit the window's height go, least used first, into «Más».
  import { ruta } from '../lib/ruta.svelte';
  import { HERRAMIENTAS, activar, esActiva, indiceOculto, type Herramienta } from '../lib/navegacion.svelte';
  import Icono from './Icono.svelte';
  import MenuHerramientas from './MenuHerramientas.svelte';

  /** Height of one entry (keep in sync with `.item` in the CSS). */
  const ALTO_ITEM = 54;

  let alto = $state(0);
  let botonMas: HTMLButtonElement | undefined = $state();
  let mas = $state(false);

  const cabe = $derived(alto > 0 ? Math.max(2, Math.floor(alto / ALTO_ITEM)) : HERRAMIENTAS.length);
  const visibles = $derived(cabe >= HERRAMIENTAS.length ? HERRAMIENTAS : HERRAMIENTAS.slice(0, cabe - 1));
  const resto = $derived(HERRAMIENTAS.slice(visibles.length));
  const masActivo = $derived(resto.some(esActiva));

  /** Tooltip text: the full name, or what «Libro» will do. */
  function tip(h: Herramienta): string {
    if (h.id !== 'libro') return h.etiqueta;
    if (ruta.vista !== 'parte') return 'Libro: volver a la lectura';
    return indiceOculto() ? 'Libro: mostrar el índice' : 'Libro: ocultar el índice';
  }

</script>

<nav class="carril" aria-label="Secciones de la aplicación">
  <a class="logo" href="#/" aria-label="Inicio" aria-current={ruta.vista === 'inicio' ? 'page' : undefined}>
    <svg viewBox="0 0 1024 1024" aria-hidden="true"><rect width="1024" height="1024" rx="230" fill="#1A3A5C" /><path d="M196 512H330M694 512H828" stroke="#F4F1EA" stroke-width="56" stroke-linecap="round" /><circle cx="176" cy="512" r="64" fill="#F4F1EA" /><circle cx="848" cy="512" r="64" fill="#F4F1EA" /><rect x="318" y="392" width="388" height="240" rx="64" fill="#F4F1EA" /><rect x="388" y="392" width="40" height="240" fill="#A6552B" /><rect x="458" y="392" width="40" height="240" fill="#8A1F3D" /><rect x="528" y="392" width="40" height="240" fill="#1F6F5C" /><rect x="606" y="392" width="28" height="240" fill="#C9A227" /></svg>
    <span class="tip" aria-hidden="true">Inicio</span>
  </a>

  <div class="items" bind:clientHeight={alto}>
    {#each visibles as h (h.id)}
      {@render item(h)}
    {/each}
    {#if resto.length}
      <button
        class="item"
        class:activo={masActivo}
        bind:this={botonMas}
        aria-haspopup="menu"
        aria-expanded={mas}
        aria-label={`Más: ${resto.map((h) => h.etiqueta).join(', ')}`}
        onclick={() => (mas = !mas)}
      >
        <span class="icono"><Icono nombre="mas" tam={22} /></span>
        <span class="etiqueta">Más</span>
      </button>
    {/if}
  </div>
</nav>

{#if mas && botonMas}
  <MenuHerramientas items={resto} ancla={botonMas} modo="lateral" onCerrar={() => (mas = false)} />
{/if}

{#snippet item(h: Herramienta)}
  {@const activo = esActiva(h)}
  {@const n = h.cuenta?.() ?? 0}
  {@const libroAbierto = h.id === 'libro' && activo && !indiceOculto()}
  {#if h.ruta}
    <a
      class="item"
      class:activo
      href={h.ruta}
      aria-label={h.etiqueta + (n ? ` (${n})` : '')}
      aria-current={activo ? 'page' : undefined}
      data-herramienta={h.id}
    >
      {@render contenido(h, n)}
    </a>
  {:else}
    <button
      class="item"
      class:activo
      type="button"
      aria-label={h.etiqueta}
      aria-pressed={h.id === 'libro' ? libroAbierto : undefined}
      aria-keyshortcuts={h.id === 'buscar' ? 'Control+K Meta+K /' : undefined}
      data-herramienta={h.id}
      onclick={() => activar(h)}
    >
      {@render contenido(h, n)}
    </button>
  {/if}
{/snippet}

{#snippet contenido(h: Herramienta, n: number)}
  <span class="icono"><Icono nombre={h.icono} tam={22} />{#if n}<span class="cuenta">{n > 99 ? '99+' : n}</span>{/if}</span>
  <span class="etiqueta">{h.corta ?? h.etiqueta}</span>
  <span class="tip" aria-hidden="true">{tip(h)}{#if h.atajo}<kbd>{h.atajo}</kbd>{/if}</span>
{/snippet}

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
    padding: calc(8px + env(safe-area-inset-top)) 0 calc(8px + env(safe-area-inset-bottom));
    padding-left: env(safe-area-inset-left);
    background: var(--fondo-carril);
    border-right: 1px solid var(--linea);
    font-family: var(--sans);
  }

  .logo {
    position: relative;
    display: grid;
    flex: none;
    place-items: center;
    width: 52px;
    height: 48px;
    margin-bottom: 8px;
    border-radius: 12px;
  }
  .logo svg {
    display: block;
    width: 36px;
    height: 36px;
    transition: transform 0.15s;
  }
  .logo:hover svg {
    transform: scale(1.06);
  }
  .logo[aria-current='page']::after {
    content: '';
    position: absolute;
    bottom: -3px;
    width: 18px;
    height: 3px;
    border-radius: 2px;
    background: var(--titulos);
  }

  .items {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    width: 100%;
    min-height: 0;
  }

  .item {
    position: relative;
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    width: calc(var(--ancho-carril) - 8px);
    height: 54px;
    padding: 0;
    border: 0;
    border-radius: 12px;
    background: none;
    color: var(--tinta-suave);
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
  }
  .icono {
    position: relative;
    display: grid;
    place-items: center;
    width: 54px;
    height: 28px;
    border-radius: 14px;
    transition: background 0.15s, color 0.15s;
  }
  .etiqueta {
    max-width: 100%;
    overflow: hidden;
    padding: 0 2px;
    font-size: 11.5px;
    font-weight: 500;
    letter-spacing: -0.01em;
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .item:hover .icono {
    background: var(--hover);
    color: var(--tinta);
  }
  .item:hover .etiqueta {
    color: var(--tinta);
  }
  .item.activo .icono {
    background: var(--acento-suave);
    color: var(--acento);
  }
  .item.activo .etiqueta {
    color: var(--tinta);
    font-weight: 700;
  }
  .item:focus-visible {
    outline: none;
  }
  .item:focus-visible .icono {
    outline: 2px solid var(--acento);
    outline-offset: 1px;
  }
  .cuenta {
    position: absolute;
    top: -2px;
    right: 6px;
    min-width: 17px;
    height: 17px;
    padding: 0 4px;
    border-radius: 9px;
    background: var(--tinta-suave);
    color: var(--fondo);
    font-size: 10.5px;
    font-weight: 700;
    line-height: 17px;
    text-align: center;
  }

  /* tooltip: hover (after a short wait) and keyboard focus; never needed to understand the entry */
  .tip {
    position: absolute;
    top: 50%;
    left: calc(100% + 6px);
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 8px;
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
  .logo .tip {
    left: calc(100% + 10px);
  }
  .tip kbd {
    padding: 0 5px;
    border: 1px solid color-mix(in srgb, var(--fondo) 40%, transparent);
    border-radius: 4px;
    font-family: var(--sans);
    font-size: 11.5px;
    font-weight: 500;
    opacity: 0.85;
  }
  @media (hover: hover) {
    .item:hover .tip,
    .logo:hover .tip {
      opacity: 1;
      transform: translate(0, -50%);
      visibility: visible;
      transition-delay: 0.45s;
    }
  }
  .item:focus-visible .tip,
  .logo:focus-visible .tip {
    opacity: 1;
    transform: translate(0, -50%);
    visibility: visible;
  }
</style>
