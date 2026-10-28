<script lang="ts">
  // Top bar. While reading: the index toggle (desktop), a breadcrumb «Capítulo 5 · Diodos › 5.8 …» that opens
  // the chapter's sections as a menu, previous/next section buttons (Alt + ↑/↓) and the reading progress.
  // In the tools: their name. Always: the «Aa» settings.
  import { app } from '../lib/estado.svelte';
  import { ruta } from '../lib/ruta.svelte';
  import { infoParte, rotuloParte } from '../lib/datos';
  import { HERRAMIENTAS, INICIO, alternarIndice, corto, esActiva, indiceOculto, pasoVecino } from '../lib/navegacion.svelte';
  import Icono from './Icono.svelte';
  import Ajustes from './Ajustes.svelte';
  import MenuCapitulo from './MenuCapitulo.svelte';

  const enLector = $derived(ruta.vista === 'parte' && app.cargado && !!infoParte(ruta.parte));
  const info = $derived(enLector ? infoParte(ruta.parte) : undefined);
  const titulo = $derived.by(() => {
    if (!app.cargado) return '';
    if (ruta.vista === 'inicio') return INICIO.etiqueta;
    if (info) return corto(info.titulo);
    return HERRAMIENTAS.find(esActiva)?.etiqueta ?? '';
  });
  const rotulo = $derived(info ? rotuloParte(ruta.parte) : '');
  const conNumero = $derived(info?.num != null);
  const seccion = $derived(enLector && app.seccion?.parte === ruta.parte ? app.seccion : null);
  /** Where the reader is: the section on screen, or (while the page is still settling) the one the route asked for. */
  const aqui = $derived.by(() => {
    if (seccion) return seccion.label;
    return info?.secciones?.some((s) => s.label === ruta.ancla) ? ruta.ancla : null;
  });
  const anterior = $derived(enLector ? pasoVecino(ruta.parte, aqui, -1) : null);
  const siguiente = $derived(enLector ? pasoVecino(ruta.parte, aqui, 1) : null);
  const oculto = $derived(indiceOculto());

  let botonAjustes: HTMLButtonElement | undefined = $state();
  let botonMiga: HTMLButtonElement | undefined = $state();
  let menu = $state(false);

  function nombrePaso(p: { num: string | null; titulo: string }): string {
    return p.num ? `${p.num} ${p.titulo}` : p.titulo;
  }

  // Alt + ↑ / ↓: previous / next section.
  function teclas(ev: KeyboardEvent) {
    if (!enLector || !ev.altKey || ev.ctrlKey || ev.metaKey) return;
    if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
    if ((ev.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    const p = ev.key === 'ArrowUp' ? anterior : siguiente;
    if (!p) return;
    ev.preventDefault();
    location.hash = p.href;
  }
</script>

<svelte:window onkeydown={teclas} />

<header class="barra" class:lector={enLector}>
  {#if !app.movil && app.cargado}
    <button
      class="boton-icono panel"
      aria-label={oculto ? 'Mostrar el índice' : 'Ocultar el índice'}
      aria-expanded={!oculto}
      title={oculto ? 'Mostrar el índice' : 'Ocultar el índice'}
      onclick={alternarIndice}
    >
      <Icono nombre={oculto ? 'panel-abrir' : 'panel-cerrar'} tam={20} />
    </button>
  {/if}

  {#if enLector}
    <div class="miga">
      <button
        class="miga-boton"
        bind:this={botonMiga}
        aria-haspopup="dialog"
        aria-expanded={menu}
        aria-label={`${rotulo}${conNumero ? ` · ${titulo}` : ''}${seccion ? `, sección ${seccion.num} ${seccion.titulo}` : ''}. Ver las secciones`}
        onclick={() => (menu = !menu)}
      >
        {#if app.movil}
          <span class="linea1">{conNumero ? rotulo : 'Libro'}{#if seccion && conNumero}<span class="sep" aria-hidden="true">{' · '}</span>{titulo}{/if}</span>
          <span class="linea2">{#if seccion}<b>{seccion.num}</b> {seccion.titulo}{:else}{titulo}{/if}</span>
        {:else}
          <span class="parte">
            {#if conNumero}<span class="rotulo">{rotulo}</span><span class="sep" aria-hidden="true">·</span>{/if}
            <span class="titulo">{titulo}</span>
          </span>
          {#if seccion}
            <span class="sep flecha" aria-hidden="true"><Icono nombre="chevron" tam={14} /></span>
            <span class="seccion"><b>{seccion.num}</b> {seccion.titulo}</span>
          {/if}
        {/if}
        <span class="abrir" aria-hidden="true"><Icono nombre="chevron-abajo" tam={16} /></span>
      </button>
    </div>
    <div class="pasos" role="group" aria-label="Secciones contiguas">
      {#if anterior}
        <a class="boton-icono" href={anterior.href} aria-label={`Sección anterior: ${nombrePaso(anterior)}`} title={`Anterior: ${nombrePaso(anterior)} (Alt ↑)`}>
          <Icono nombre="chevron-arriba" tam={20} />
        </a>
      {:else}
        <span class="boton-icono apagado" aria-hidden="true"><Icono nombre="chevron-arriba" tam={20} /></span>
      {/if}
      {#if siguiente}
        <a class="boton-icono" href={siguiente.href} aria-label={`Sección siguiente: ${nombrePaso(siguiente)}`} title={`Siguiente: ${nombrePaso(siguiente)} (Alt ↓)`}>
          <Icono nombre="chevron-abajo" tam={20} />
        </a>
      {:else}
        <span class="boton-icono apagado" aria-hidden="true"><Icono nombre="chevron-abajo" tam={20} /></span>
      {/if}
    </div>
  {:else}
    <div class="donde"><span class="titulo">{titulo}</span></div>
  {/if}

  <div class="acciones">
    <button
      class="boton-icono"
      aria-label="Tema y tamaño de letra"
      aria-expanded={app.ajustes}
      aria-haspopup="dialog"
      bind:this={botonAjustes}
      onclick={() => (app.ajustes = !app.ajustes)}
    >
      <span class="aa" aria-hidden="true">Aa</span>
    </button>
  </div>

  {#if ruta.vista === 'parte'}
    <div class="progreso" aria-hidden="true"><span style:transform={`scaleX(${app.progreso})`}></span></div>
  {/if}
</header>

{#if app.ajustes}
  <Ajustes ancla={botonAjustes} />
{/if}
{#if menu && enLector && botonMiga}
  {#key ruta.parte}
    <MenuCapitulo parte={ruta.parte} ancla={botonMiga} onCerrar={() => (menu = false)} />
  {/key}
{/if}

<style>
  .barra {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 4px;
    height: calc(var(--alto-barra) + env(safe-area-inset-top));
    padding: env(safe-area-inset-top) 10px 0 10px;
    background: color-mix(in srgb, var(--fondo) 94%, transparent);
    border-bottom: 1px solid var(--linea-suave);
    -webkit-backdrop-filter: saturate(1.4) blur(12px);
    backdrop-filter: saturate(1.4) blur(12px);
    font-family: var(--sans);
  }
  @supports not (background: color-mix(in srgb, red 50%, blue)) {
    .barra {
      background: var(--fondo);
    }
  }
  .panel {
    flex: none;
  }

  /* breadcrumb */
  .miga,
  .donde {
    display: flex;
    flex: 1;
    min-width: 0;
  }
  .donde {
    padding-left: 8px;
    font-size: 15px;
  }
  .miga-boton {
    display: flex;
    align-items: center;
    gap: 7px;
    max-width: 100%;
    min-width: 0;
    min-height: 40px;
    padding: 0 8px 0 10px;
    border: 0;
    border-radius: 10px;
    background: none;
    font-size: 15px;
    text-align: left;
    white-space: nowrap;
    transition: background 0.15s;
  }
  .miga-boton:hover,
  .miga-boton[aria-expanded='true'] {
    background: var(--hover);
  }
  .parte {
    display: flex;
    flex: none;
    align-items: center;
    gap: 7px;
    max-width: 50%;
    min-width: 0;
  }
  .rotulo {
    flex: none;
    color: var(--acento);
    font-weight: 700;
  }
  .titulo {
    overflow: hidden;
    color: var(--tinta);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sep {
    flex: none;
    color: var(--tinta-tenue);
  }
  .flecha {
    display: inline-grid;
  }
  .seccion {
    min-width: 0;
    overflow: hidden;
    color: var(--tinta-suave);
    text-overflow: ellipsis;
  }
  .seccion b {
    color: var(--acento);
    font-weight: 600;
  }
  .abrir {
    display: inline-grid;
    flex: none;
    color: var(--tinta-tenue);
    transition: transform 0.15s;
  }
  .miga-boton[aria-expanded='true'] .abrir {
    transform: rotate(180deg);
  }

  /* previous / next section */
  .pasos {
    display: flex;
    flex: none;
    margin: 0 6px 0 8px;
    border: 1px solid var(--linea);
    border-radius: 11px;
    background: var(--superficie);
    overflow: hidden;
  }
  .pasos .boton-icono {
    width: 40px;
    height: 36px;
    border-radius: 0;
  }
  .pasos > * + * {
    border-left: 1px solid var(--linea);
  }
  .apagado {
    color: var(--tinta-tenue);
    opacity: 0.45;
  }

  .acciones {
    display: flex;
    flex: none;
    align-items: center;
    gap: 4px;
  }
  .aa {
    font-family: var(--serif);
    font-size: 19px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .progreso {
    position: absolute;
    right: 0;
    bottom: -1px;
    left: 0;
    height: 2px;
    overflow: hidden;
  }
  .progreso span {
    display: block;
    height: 100%;
    background: var(--acento);
    transform-origin: left;
    transition: transform 0.12s linear;
  }

  /* phone and tablet portrait: two-line breadcrumb («Capítulo 5 · Diodos» over the section) */
  @media (max-width: 1023px) {
    .barra {
      gap: 0;
      padding-left: max(6px, env(safe-area-inset-left));
      padding-right: max(6px, env(safe-area-inset-right));
    }
    .donde {
      padding-left: 10px;
      font-size: 16px;
    }
    .miga-boton {
      display: inline-grid;
      grid-template-columns: minmax(0, max-content) auto;
      grid-template-rows: auto auto;
      column-gap: 4px;
      row-gap: 1px;
      min-height: 46px;
      padding: 2px 6px 2px 10px;
    }
    .linea1,
    .linea2 {
      grid-column: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .linea1 {
      grid-row: 1;
      color: var(--acento);
      font-size: 12.5px;
      font-weight: 700;
      line-height: 1.2;
    }
    .linea2 {
      grid-row: 2;
      color: var(--tinta);
      font-size: 15.5px;
      font-weight: 600;
      line-height: 1.2;
    }
    .linea2 b {
      color: var(--acento);
      font-weight: 700;
    }
    .abrir {
      grid-column: 2;
      grid-row: 1 / span 2;
    }
    .pasos {
      margin: 0 4px;
    }
    .pasos .boton-icono {
      width: 42px;
      height: 42px;
    }
  }
</style>
