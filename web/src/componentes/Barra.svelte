<script lang="ts">
  // The header, 2.1 (the mock-ups' system): the current group's parts as underline tabs (lib/navegacion GRUPOS), then
  // Buscar and «Aa», always. A group with one part (Inicio) or a page outside the groups shows its name instead.
  // While reading, the chapter's bar stays as it was — the index toggle (desktop), the breadcrumb «Capítulo 5 · Diodos
  // › 5.8 …» that opens the chapter's sections, previous/next section (Alt + ↑/↓) and the reading progress — sticky
  // under the group's tabs, which scroll away with the page.
  // Desktop: one bar (tabs on its bottom edge), or in the reader the tabs' row over the sticky reading bar.
  // Phone: a sticky bar (the group's or page's name, or the breadcrumb) with the tabs' row under it, scrolling away.
  import { app } from '../lib/estado.svelte';
  import { ruta } from '../lib/ruta.svelte';
  import { abrirBuscador } from '../lib/acciones';
  import { infoParte, rotuloParte } from '../lib/datos';
  import {
    ATAJO_BUSCAR,
    HERRAMIENTAS,
    INICIO,
    alternarIndice,
    corto,
    esActiva,
    grupoActual,
    hrefDe,
    indiceDesdeLibro,
    indiceOculto,
    parteActual,
    pasoVecino,
    type Herramienta,
  } from '../lib/navegacion.svelte';
  import Icono from './Icono.svelte';
  import Ajustes from './Ajustes.svelte';
  import MenuCapitulo from './MenuCapitulo.svelte';
  import { mostrarActual21 } from './sistema21/Pestanas21.svelte';
  import { tick } from 'svelte';

  const enLector = $derived(ruta.vista === 'parte' && app.cargado && !!infoParte(ruta.parte));
  /** The reader's layout (tabs' row over the reading bar), from the route alone: the same from the first frame. */
  const lectura = $derived(ruta.vista === 'parte');
  const info = $derived(enLector ? infoParte(ruta.parte) : undefined);
  // (from the route alone, not waiting for the book's data: the phone's tab row has its room from the first frame — a
  // row arriving with the data moved the page 45 px down, CLS on the tablet)
  const grupo = $derived(grupoActual());
  /** The group's parts as tabs (none for a group of one part). */
  const partes = $derived(grupo && grupo.partes.length > 1 ? grupo.partes : []);
  const actual = $derived(grupo ? parteActual() : null);
  /** The name shown when there are no tabs (desktop), and the phone bar's title outside the reader. */
  const nombre = $derived.by(() => {
    if (!app.cargado) return '';
    if (ruta.vista === 'inicio') return INICIO.etiqueta;
    if (ruta.vista === 'progreso' && ruta.ancla === 'dominio') return 'Dominio';
    if (ruta.vista === 'practicar') return 'Práctica inteligente';
    if (ruta.vista === 'problema') return 'Problema del día';
    if (ruta.vista === 'etapas') return 'Proyectos por etapas';
    if (ruta.vista === 'diagnostico') return 'Diagnóstico';
    if (ruta.vista === 'sincronizacion') return 'Sincronización';
    return HERRAMIENTAS.find(esActiva)?.etiqueta ?? '';
  });
  /** Phone: the bar names the group (its tabs say which part); outside the groups, the page. */
  const tituloMovil = $derived(grupo && partes.length ? grupo.etiqueta : nombre);
  const titulo = $derived(info ? corto(info.titulo) : nombre);
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

  // the phone's row keeps the current tab in view (the last ones do not fit at 360 px)
  let filaMovil: HTMLElement | undefined = $state();
  $effect(() => {
    void actual;
    const f = filaMovil;
    if (f) void tick().then(() => {
      const n = f.querySelector<HTMLElement>('nav');
      if (n) mostrarActual21(n);
    });
  });

  let botonAjustes: HTMLButtonElement | undefined = $state();
  let botonMiga: HTMLButtonElement | undefined = $state();
  let menu = $state(false);

  function nombrePaso(p: { num: string | null; titulo: string }): string {
    return p.num ? `${p.num} ${p.titulo}` : p.titulo;
  }

  /** «Índice» while reading: shows the book's index (the phone's drawer, the desktop's panel) instead of reloading. */
  function clicParte(h: Herramienta, ev: MouseEvent) {
    if (h.id !== 'indice' || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return;
    if (indiceDesdeLibro(false)) ev.preventDefault();
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

{#snippet pestanas(linea: boolean)}
  <nav class="pestanas21 grupo-pestanas" class:sin-linea={!linea} aria-label={`Partes de ${grupo?.etiqueta ?? ''}`} data-grupo-pestanas={grupo?.id}>
    {#each partes as h (h.id)}
      {@const n = h.cuenta?.() ?? 0}
      <a
        class="pestana21"
        href={hrefDe(h)}
        aria-current={h === actual ? 'page' : undefined}
        aria-label={n ? `${h.etiqueta} (${n})` : h.corta ? h.etiqueta : undefined}
        data-parte={h.id}
        onclick={(ev) => clicParte(h, ev)}
      >
        {h.corta ?? h.etiqueta}{#if n}<span class="cuenta21" aria-hidden="true">{n > 99 ? '99+' : n}</span>{/if}
      </a>
    {/each}
  </nav>
{/snippet}

{#snippet acciones()}
  <div class="acciones">
    <button
      class="boton-icono"
      type="button"
      aria-label="Buscar"
      aria-keyshortcuts="Control+K Meta+K /"
      title={`Buscar (${ATAJO_BUSCAR})`}
      data-herramienta="buscar"
      onclick={abrirBuscador}
    >
      <Icono nombre="buscar" tam={22} />
    </button>
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
{/snippet}

{#if !app.movil && lectura && partes.length}
  <!-- desktop reader: the group's tabs over the reading bar; they scroll away, the bar stays -->
  <div class="fila-grupo">{@render pestanas(false)}</div>
{/if}

<header class="barra" class:lector={lectura} class:movil={app.movil} class:con-pestanas={!app.movil && !lectura && partes.length > 0}>
  {#if !app.movil && lectura}
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
          <span class="parte" class:sola={!seccion}>
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
  {:else if lectura}
    <!-- the book's data still loading: the breadcrumb's room -->
    <div class="miga"></div>
  {:else if app.movil}
    <div class="donde"><span class="titulo">{tituloMovil}</span></div>
  {:else if partes.length}
    {@render pestanas(false)}
  {:else}
    <div class="donde"><span class="titulo">{nombre}</span></div>
  {/if}

  {@render acciones()}

  {#if ruta.vista === 'parte'}
    <div class="progreso" aria-hidden="true"><span style:transform={`scaleX(${app.progreso})`}></span></div>
  {/if}
</header>

{#if app.movil && partes.length}
  <!-- phone: the group's parts, a row that scrolls sideways (and away with the page) -->
  <div class="fila-grupo movil" bind:this={filaMovil}>{@render pestanas(true)}</div>
{/if}

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
    gap: 8px;
    height: calc(var(--alto-barra) + env(safe-area-inset-top));
    padding: env(safe-area-inset-top) 32px 0 40px;
    background: color-mix(in srgb, var(--fondo) 94%, transparent);
    border-bottom: 1px solid var(--v11-linea);
    -webkit-backdrop-filter: saturate(1.4) blur(12px);
    backdrop-filter: saturate(1.4) blur(12px);
    font-family: var(--sans);
  }
  @supports not (background: color-mix(in srgb, red 50%, blue)) {
    .barra {
      background: var(--fondo);
    }
  }
  /* the reading bar keeps its 1.x room: the index toggle at the left edge */
  .barra.lector:not(.movil) {
    gap: 4px;
    padding-left: 12px;
    padding-right: 32px;
  }
  /* the group's tabs sit on the bar's bottom edge, their underline over its line (the mock-ups' header) */
  .barra.con-pestanas {
    align-items: stretch;
  }
  .barra.con-pestanas .acciones {
    align-self: center;
  }
  .grupo-pestanas {
    flex: 1;
    gap: 28px;
    height: 100%;
    margin-bottom: -1px;
  }
  .fila-grupo {
    display: flex;
    height: 64px;
    padding: 0 40px;
    border-bottom: 1px solid var(--v11-linea);
    font-family: var(--sans);
  }
  .fila-grupo .grupo-pestanas {
    height: auto;
  }
  /* phone: under the bar, gutters of 16 px, the row's own line */
  .fila-grupo.movil {
    height: auto;
    padding: 0;
    border-bottom: 0;
  }
  /* the row scrolls edge to edge; its first and last tabs keep the 16 px gutter */
  .fila-grupo.movil .grupo-pestanas {
    gap: 20px;
    margin: 0;
    padding: 0 max(16px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left));
    scroll-padding: 0 16px;
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
    align-items: center;
    color: var(--v11-tinta-suave);
    font-size: 15px;
  }
  .donde .titulo {
    color: var(--v11-tinta-suave);
    font-weight: 400;
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
  /* (2.1) with no section on screen yet, the part's name may take the whole breadcrumb: «Capítulo 5 ·» lost «Diodos»
     at the top of a chapter (50 % of a button sized by its own content) */
  .parte.sola {
    max-width: none;
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
    gap: 8px;
    margin-left: auto;
  }
  .acciones .boton-icono {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    color: var(--v11-tinta-suave);
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
      padding-right: max(4px, env(safe-area-inset-right));
    }
    .barra.movil:not(.lector) {
      padding-left: max(20px, env(safe-area-inset-left));
    }
    .acciones {
      gap: 0;
    }
    .donde,
    .donde .titulo {
      color: var(--v11-tinta);
      font-size: 17px;
      font-weight: 600;
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
