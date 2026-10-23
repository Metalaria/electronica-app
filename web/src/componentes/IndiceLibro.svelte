<script lang="ts">
  // The book index: volumes → chapters → sections, with reading progress, the current section highlighted
  // and kept in view, a filter by text or number, and keyboard navigation. Used by the desktop panel and
  // by the phone drawer. Only the expanded chapters render their sections.
  import { tick, untrack } from 'svelte';
  import { app } from '../lib/estado.svelte';
  import { ruta } from '../lib/ruta.svelte';
  import { usuario } from '../lib/usuario.svelte';
  import { ordenLectura, rotuloParte } from '../lib/datos';
  import { colorBloque } from '../lib/color';
  import { aprendizaje } from '../lib/aprendizaje.svelte';
  import { abrirBuscador } from '../lib/acciones';
  import { corto, filtrarIndice, hrefParte, hrefSeccion, resaltar, tomoActual } from '../lib/navegacion.svelte';
  import Icono from './Icono.svelte';
  import Insignia from './Insignia.svelte';
  import AnilloLectura from './aprender/AnilloLectura.svelte';
  import ProgresoTomo from './aprender/ProgresoTomo.svelte';

  let { visible = true }: { visible?: boolean } = $props();

  const indice = $derived(app.indice!);
  const MAX_SECCIONES = 250;

  // ------------------------------------------------------------------ structure

  /** Parts that are not in any volume go to a final group. */
  const sueltas = $derived.by(() => {
    const enTomos = new Set(indice.tomos.flatMap((t) => t.partes));
    return ordenLectura().filter((p) => !enTomos.has(p));
  });

  /** Colour stripe of a volume: the colours of its chapters, in proportion. */
  function franja(partes: string[]): string {
    const colores = partes.map((p) => indice.partes[p]).filter((p) => p && p.num != null).map((p) => colorBloque(p!.color));
    if (!colores.length) return 'var(--linea)';
    const paso = 100 / colores.length;
    return `linear-gradient(to bottom, ${colores.map((c, k) => `${c} ${k * paso}% ${(k + 1) * paso}%`).join(', ')})`;
  }

  const parteActual = $derived(ruta.vista === 'parte' || ruta.vista === 'glosario' ? ruta.parte : '');
  const seccionActual = $derived(app.seccion && app.seccion.parte === parteActual ? app.seccion.label : '');

  let tomosAbiertos = $state<Record<string, boolean>>({});
  let partesAbiertas = $state<Record<string, boolean>>({});

  function abiertoTomo(id: string): boolean {
    return tomosAbiertos[id] ?? id === tomoActual();
  }

  function abiertaParte(id: string): boolean {
    return partesAbiertas[id] ?? id === parteActual;
  }

  // ------------------------------------------------------------------ filter

  let consulta = $state('');
  let campo: HTMLInputElement | undefined = $state();
  const resultado = $derived(filtrarIndice(consulta));

  /** Filter results grouped by volume, with at most MAX_SECCIONES sections drawn. */
  const grupos = $derived.by(() => {
    if (!resultado) return [];
    const porTomo = new Map<string, typeof resultado.lista>();
    for (const c of resultado.lista) {
      const t = indice.partes[c.parte]?.tomo ?? '';
      if (!porTomo.has(t)) porTomo.set(t, []);
      porTomo.get(t)!.push(c);
    }
    let quedan = MAX_SECCIONES;
    return [...porTomo].map(([t, lista]) => ({
      tomo: indice.tomos.find((x) => x.id === t),
      lista: lista.map((c) => {
        const secciones = c.secciones.slice(0, Math.max(0, quedan));
        quedan -= secciones.length;
        return { ...c, secciones };
      }),
    }));
  });
  const ocultas = $derived(resultado ? Math.max(0, resultado.secciones - MAX_SECCIONES) : 0);

  function teclasCampo(ev: KeyboardEvent) {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      filas()[0]?.focus();
    } else if (ev.key === 'Enter') {
      // the first result: its first section for number searches, else the first row
      const primera =
        (resultado?.numero ? lista?.querySelector<HTMLAnchorElement>('.secciones a') : null) ??
        lista?.querySelector<HTMLAnchorElement>('a[data-fila]');
      if (primera) {
        ev.preventDefault();
        primera.click();
      }
    } else if (ev.key === 'Escape' && consulta) {
      ev.stopPropagation();
      consulta = '';
    }
  }

  /** The filter only looks at titles: hand the words over to the full-text search. */
  function buscarEnTexto() {
    app.buscarTexto = consulta.trim();
    abrirBuscador();
  }

  // ------------------------------------------------------------------ current section in view

  let lista: HTMLElement | undefined = $state();
  /** Last time the reader scrolled or touched the list: the automatic scroll keeps out of the way. */
  let ultimaInteraccion = -Infinity;
  const RESPETO_MS = 6000;
  /** Where the current row is when it is not visible (shows «Ir a la sección actual»). */
  let fuera = $state<'arriba' | 'abajo' | 'oculta' | null>(null);

  function interaccion() {
    ultimaInteraccion = performance.now();
  }

  function filaActual(): HTMLElement | null {
    return (
      lista?.querySelector<HTMLElement>('.secciones a[aria-current="location"]') ??
      lista?.querySelector<HTMLElement>('a.capitulo[aria-current="page"]') ??
      null
    );
  }

  /** Scrolls the list (never the page) so the current row is visible, about a third from the top. */
  function centrar(suave: boolean, siempre = false) {
    const el = filaActual();
    if (!el || !lista) return;
    const r = el.getBoundingClientRect();
    const c = lista.getBoundingClientRect();
    const margen = 48;
    if (!siempre && r.top >= c.top + margen && r.bottom <= c.bottom - margen) return;
    const destino = lista.scrollTop + (r.top - c.top) - lista.clientHeight * 0.32;
    lista.scrollTo({ top: Math.max(0, destino), behavior: suave ? 'smooth' : 'instant' });
  }

  // The reading moves on (another section or part): keep its row in view unless the reader is using the list.
  let primera = true;
  $effect(() => {
    void parteActual;
    void seccionActual;
    if (!visible || consulta) return;
    untrack(() => {
      void tick().then(() => {
        if (performance.now() - ultimaInteraccion < RESPETO_MS) return;
        centrar(!primera);
        primera = false;
      });
    });
  });

  // Whether the current row is on screen (the floating «Sección actual» button).
  $effect(() => {
    void parteActual;
    void seccionActual;
    void consulta;
    void visible;
    void tomosAbiertos;
    void partesAbiertas;
    if (!lista || !parteActual) {
      fuera = null;
      return;
    }
    let io: IntersectionObserver | null = null;
    const raiz = lista;
    void tick().then(() => {
      const el = filaActual();
      const esSeccion = !!el?.closest('.secciones');
      // the section is hidden (chapter or volume collapsed, or filtered out)
      if (!el || (seccionActual && !esSeccion)) {
        fuera = 'oculta';
        if (!el) return;
      }
      io = new IntersectionObserver(
        ([e]) => {
          if (!e) return;
          if (seccionActual && !esSeccion) return;
          if (e.isIntersecting) fuera = null;
          else fuera = e.boundingClientRect.top < (e.rootBounds?.top ?? 0) ? 'arriba' : 'abajo';
        },
        { root: raiz, threshold: 0.6 },
      );
      io.observe(el);
    });
    return () => io?.disconnect();
  });

  /** «Ir a la sección actual»: clears the filter, opens its volume and chapter and brings it to view. */
  export async function irActual() {
    if (!parteActual) return;
    consulta = '';
    const t = tomoActual();
    if (t) tomosAbiertos[t] = true;
    partesAbiertas[parteActual] = true;
    ultimaInteraccion = -Infinity;
    await tick();
    centrar(true, true);
    filaActual()?.focus({ preventScroll: true });
  }

  /** Puts the keyboard focus on the filter (Ctrl/⌘ F style access from the panel). */
  export function enfocarFiltro() {
    campo?.focus();
  }

  // ------------------------------------------------------------------ keyboard

  function filas(): HTMLElement[] {
    return lista ? Array.from(lista.querySelectorAll<HTMLElement>('[data-fila]')) : [];
  }

  function teclas(ev: KeyboardEvent) {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-fila]');
    if (!el || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const todas = filas();
    const k = todas.indexOf(el);
    const tipo = el.dataset.fila;
    const id = el.dataset.id ?? '';
    const mover = (n: number) => {
      ev.preventDefault();
      interaccion();
      const destino = todas[Math.max(0, Math.min(todas.length - 1, n))];
      destino?.focus();
      destino?.scrollIntoView({ block: 'nearest' });
    };
    switch (ev.key) {
      case 'ArrowDown':
        return mover(k + 1);
      case 'ArrowUp':
        if (k === 0 && campo) {
          ev.preventDefault();
          campo.focus();
          return;
        }
        return mover(k - 1);
      case 'Home':
        return mover(0);
      case 'End':
        return mover(todas.length - 1);
      case 'ArrowRight':
        if (tipo === 'tomo' && !abiertoTomo(id)) {
          ev.preventDefault();
          tomosAbiertos[id] = true;
        } else if (tipo === 'cap' && !consulta && (indice.partes[id]?.secciones?.length ?? 0) > 0 && !abiertaParte(id)) {
          ev.preventDefault();
          partesAbiertas[id] = true;
        } else mover(k + 1);
        return;
      case 'ArrowLeft':
        if (tipo === 'tomo' && abiertoTomo(id)) {
          ev.preventDefault();
          tomosAbiertos[id] = false;
        } else if (tipo === 'cap' && !consulta && abiertaParte(id) && (indice.partes[id]?.secciones?.length ?? 0) > 0) {
          ev.preventDefault();
          partesAbiertas[id] = false;
        } else if (tipo === 'sec') {
          ev.preventDefault();
          lista?.querySelector<HTMLElement>(`a.capitulo[data-id="${CSS.escape(id)}"]`)?.focus();
        } else if (tipo === 'cap') {
          const t = indice.partes[id]?.tomo;
          if (t) {
            ev.preventDefault();
            lista?.querySelector<HTMLElement>(`[data-fila="tomo"][data-id="${CSS.escape(t)}"]`)?.focus();
          }
        }
        return;
    }
  }

  const leidas = $derived(aprendizaje.leidas);
</script>

<div class="indice-libro">
  <div class="filtro" role="search">
    <span class="lupa" aria-hidden="true"><Icono nombre="filtrar" tam={17} /></span>
    <input
      bind:this={campo}
      bind:value={consulta}
      type="search"
      enterkeyhint="go"
      autocomplete="off"
      spellcheck="false"
      placeholder="Filtrar: «zener», «5.8», «cap 33»"
      aria-label="Filtrar capítulos y secciones"
      onkeydown={teclasCampo}
    />
    {#if consulta}
      <button class="borrar" type="button" aria-label="Borrar el filtro" onclick={() => ((consulta = ''), campo?.focus())}>
        <Icono nombre="x" tam={16} />
      </button>
    {/if}
  </div>

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <nav
    class="lista"
    aria-label="Capítulos"
    bind:this={lista}
    onkeydown={teclas}
    onwheel={interaccion}
    ontouchstart={interaccion}
    onpointerdown={interaccion}
  >
    {#if resultado}
      {#if !resultado.lista.length}
        <p class="vacio">Nada coincide con «{consulta.trim()}».<br /><span>Pruebe con otra palabra, un número de sección («5.8») o de capítulo («cap 33»).</span></p>
      {:else}
        <p class="resumen" aria-live="polite">
          {resultado.lista.length}
          {resultado.lista.length === 1 ? 'capítulo' : 'capítulos'}{resultado.secciones
            ? ` · ${resultado.secciones} ${resultado.secciones === 1 ? 'sección' : 'secciones'}`
            : ''}
        </p>
        {#each grupos as g (g.tomo?.id ?? '')}
          <section class="tomo filtrado">
            {#if g.tomo}<div class="tomo-rotulo">Tomo {g.tomo.id} · {g.tomo.titulo}</div>{/if}
            <ul>
              {#each g.lista as c (c.parte)}
                {@render parte(c.parte, c.secciones, resultado.palabras)}
              {/each}
            </ul>
          </section>
        {/each}
        {#if ocultas}<p class="vacio">Y {ocultas} secciones más: afine el filtro.</p>{/if}
      {/if}
      {#if !resultado.numero}
        <button type="button" class="en-texto" onclick={buscarEnTexto}>
          <Icono nombre="buscar" tam={16} /> Buscar «{consulta.trim()}» en el texto del libro
        </button>
      {/if}
    {:else}
      {#each indice.tomos as tomo (tomo.id)}
        {@const abierto = abiertoTomo(tomo.id)}
        <section class="tomo" class:abierto class:actual={tomo.id === tomoActual()}>
          <button
            type="button"
            class="tomo-cab"
            data-fila="tomo"
            data-id={tomo.id}
            aria-expanded={abierto}
            onclick={() => (tomosAbiertos[tomo.id] = !abierto)}
          >
            <span class="franja" style:background={franja(tomo.partes)} aria-hidden="true"></span>
            <span class="tomo-num">Tomo {tomo.id}</span>
            <span class="tomo-tit">{tomo.titulo}</span>
            <span class="chev" class:girado={abierto}><Icono nombre="chevron" tam={16} /></span>
            <ProgresoTomo partes={tomo.partes} />
          </button>
          {#if abierto}
            <ul>
              {#each tomo.partes.filter((p) => indice.partes[p]) as id (id)}
                {@render parte(id, null, [])}
              {/each}
            </ul>
          {/if}
        </section>
      {/each}
      {#if sueltas.length}
        <section class="tomo abierto">
          <div class="tomo-rotulo">Material de consulta</div>
          <ul>
            {#each sueltas as id (id)}
              {@render parte(id, null, [])}
            {/each}
          </ul>
        </section>
      {/if}
    {/if}
  </nav>

  {#if fuera && !resultado}
    <button class="ir-actual" type="button" onclick={irActual}>
      <Icono nombre={fuera === 'arriba' ? 'chevron-arriba' : fuera === 'abajo' ? 'chevron-abajo' : 'localizar'} tam={16} />
      Ir a la sección actual
    </button>
  {/if}
</div>

{#snippet texto(t: string, palabras: string[])}
  {#each resaltar(t, palabras) as trozo, k (k)}{#if trozo.m}<mark>{trozo.t}</mark>{:else}{trozo.t}{/if}{/each}
{/snippet}

{#snippet parte(id: string, filtradas: string[] | null, palabras: string[])}
  {@const p = indice.partes[id]!}
  {@const secs = p.secciones ?? []}
  {@const actual = parteActual === id}
  {@const abierta = filtradas ? filtradas.length > 0 : secs.length > 0 && abiertaParte(id)}
  {@const visibles = filtradas ? secs.filter((s) => filtradas.includes(s.label)) : secs}
  <li class="parte" class:actual class:abierta style:--c={colorBloque(p.color)}>
    <div class="fila-cap">
      <a
        class="capitulo"
        href={hrefParte(id)}
        data-fila="cap"
        data-id={id}
        aria-current={actual ? 'page' : undefined}
        title={p.titulo}
      >
        <Insignia parte={id} />
        <span class="texto">
          {#if p.num == null && p.tipo !== 'glosario'}<span class="solo-lector">{rotuloParte(id)}: </span>{/if}{@render texto(corto(p.titulo), palabras)}
        </span>
        <AnilloLectura parte={id} />
      </a>
      {#if secs.length && !filtradas}
        <button
          type="button"
          class="desplegar"
          tabindex="-1"
          aria-label={abierta ? `Ocultar las secciones de ${rotuloParte(id)}` : `Mostrar las secciones de ${rotuloParte(id)}`}
          aria-expanded={abierta}
          onclick={() => (partesAbiertas[id] = !abierta)}
        >
          <span class="chev" class:girado={abierta}><Icono nombre="chevron" tam={15} /></span>
        </button>
      {/if}
    </div>
    {#if abierta}
      <ul class="secciones">
        {#each visibles as s (s.label)}
          {@const activa = actual && seccionActual === s.label}
          <li>
            <a
              href={hrefSeccion(id, s.label)}
              data-fila="sec"
              data-id={id}
              class:activa
              class:leida={!!leidas[id]?.[s.label]}
              aria-current={activa ? 'location' : undefined}
            >
              <span class="sn">{s.num ?? ''}</span>
              <span class="st">{@render texto(s.titulo, palabras)}</span>
              {#if usuario.marcadores[s.label]}<span class="pin" title="Marcador"><Icono nombre="marcador-lleno" tam={12} /></span>{/if}
              {#if leidas[id]?.[s.label]}<span class="pin hecha" title="Leída"><Icono nombre="hecho" tam={14} grosor={2.4} /><span class="solo-lector">(leída)</span></span>{/if}
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </li>
{/snippet}

<style>
  .indice-libro {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    font-family: var(--sans);
  }

  /* ---------------------------------------------------------------- filter */
  .filtro {
    position: relative;
    flex: none;
    display: flex;
    align-items: center;
    margin: 0 12px 8px;
  }
  .lupa {
    position: absolute;
    left: 11px;
    display: inline-grid;
    color: var(--tinta-tenue);
    pointer-events: none;
  }
  .filtro input {
    width: 100%;
    height: 38px;
    padding: 0 36px 0 36px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font-size: 15px;
    transition: border-color 0.15s, box-shadow 0.15s;
    -webkit-appearance: none;
    appearance: none;
  }
  .filtro input::placeholder {
    color: var(--tinta-tenue);
  }
  .filtro input::-webkit-search-cancel-button {
    display: none;
  }
  .filtro input:focus {
    border-color: var(--acento-borde);
    outline: none;
    box-shadow: 0 0 0 3px var(--acento-tinte);
  }
  .borrar {
    position: absolute;
    right: 3px;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--tinta-tenue);
  }
  .borrar:hover {
    background: var(--hover);
    color: var(--tinta);
  }

  /* ---------------------------------------------------------------- list */
  .lista {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 2px 8px 72px;
    scrollbar-width: thin;
    scrollbar-color: var(--linea) transparent;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .resumen,
  .vacio {
    margin: 6px 8px 10px;
    color: var(--tinta-tenue);
    font-size: 13px;
  }
  .vacio {
    margin-top: 14px;
    color: var(--tinta-suave);
    font-size: 14.5px;
    line-height: 1.4;
  }
  .vacio span {
    color: var(--tinta-tenue);
    font-size: 13.5px;
  }

  /* volumes */
  .tomo + .tomo {
    margin-top: 2px;
  }
  .tomo-cab {
    position: relative;
    display: grid;
    grid-template-columns: 1fr auto;
    column-gap: 6px;
    width: 100%;
    min-height: 44px;
    padding: 8px 8px 8px 16px;
    border: 0;
    border-radius: 8px;
    background: none;
    text-align: left;
  }
  .tomo-cab:hover {
    background: var(--hover);
  }
  .franja {
    position: absolute;
    top: 9px;
    bottom: 9px;
    left: 5px;
    width: 4px;
    border-radius: 2px;
  }
  .tomo-num {
    grid-column: 1;
    color: var(--tinta-tenue);
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }
  .tomo.actual .tomo-num {
    color: var(--tinta-suave);
  }
  .tomo-tit {
    grid-column: 1;
    margin-top: 1px;
    color: var(--tinta);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.28;
  }
  .tomo-cab .chev {
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: center;
    color: var(--tinta-tenue);
  }
  .tomo-cab :global(.progreso-tomo) {
    grid-column: 1;
  }
  .tomo.abierto {
    margin-bottom: 6px;
  }
  .tomo-rotulo {
    padding: 12px 8px 4px;
    color: var(--tinta-tenue);
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .filtrado .tomo-rotulo {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chev {
    display: inline-grid;
    transition: transform 0.18s;
  }
  .chev.girado {
    transform: rotate(90deg);
  }

  /* chapters */
  .fila-cap {
    display: flex;
    align-items: center;
  }
  /* an open chapter keeps its row on top while its sections scroll */
  .parte.abierta > .fila-cap {
    position: sticky;
    top: -2px;
    z-index: 1;
    padding-top: 2px;
    background: var(--fondo-lateral);
  }
  .capitulo {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 10px;
    min-width: 0;
    min-height: 40px;
    padding: 5px 6px 5px 8px;
    border-radius: 8px;
    color: var(--tinta);
    font-size: 14.5px;
    line-height: 1.25;
    text-decoration: none;
  }
  .capitulo:hover {
    background: var(--hover);
  }
  .capitulo[aria-current='page'] {
    background: var(--superficie);
    box-shadow: var(--sombra);
    font-weight: 600;
  }
  .texto {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .desplegar {
    display: grid;
    flex: none;
    place-items: center;
    width: 36px;
    height: 40px;
    margin-left: 2px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--tinta-tenue);
  }
  .desplegar:hover {
    background: var(--hover);
    color: var(--tinta);
  }

  /* sections */
  .secciones {
    margin: 3px 0 8px 21px;
    padding-left: 9px;
    border-left: 1.5px solid var(--linea);
  }
  .secciones a {
    position: relative;
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-height: 34px;
    padding: 6px 8px;
    border-radius: 7px;
    color: var(--tinta-suave);
    font-size: 13.8px;
    line-height: 1.3;
    text-decoration: none;
  }
  .secciones a:hover {
    background: var(--hover);
    color: var(--tinta);
  }
  .secciones a.activa {
    background: var(--acento-tinte);
    color: var(--tinta);
    font-weight: 600;
  }
  .secciones a.activa::before {
    content: '';
    position: absolute;
    left: -11px;
    top: 5px;
    bottom: 5px;
    width: 3.5px;
    border-radius: 2px;
    background: var(--c);
  }
  :global(:root[data-tema='oscuro']) .secciones a.activa::before {
    background: var(--acento);
  }
  .sn {
    flex: none;
    min-width: 2.5em;
    color: var(--tinta-tenue);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .actual .sn {
    color: var(--acento);
  }
  .st {
    flex: 1;
  }
  .pin {
    flex: none;
    align-self: center;
    display: inline-grid;
    color: var(--acento);
  }
  .pin.hecha {
    color: var(--c-ejemplo);
  }
  mark {
    padding: 0;
    border-radius: 2px;
    background: var(--marca);
  }

  .en-texto {
    display: flex;
    align-items: center;
    gap: 8px;
    width: calc(100% - 8px);
    min-height: 40px;
    margin: 10px 4px 0;
    padding: 0 12px;
    border: 1px dashed var(--linea);
    border-radius: 10px;
    background: none;
    color: var(--tinta-suave);
    font-size: 14px;
    text-align: left;
  }
  .en-texto:hover {
    border-color: var(--acento-borde);
    color: var(--tinta);
  }

  /* «Ir a la sección actual» */
  .ir-actual {
    position: absolute;
    bottom: 14px;
    left: 50%;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 16px 0 12px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta);
    box-shadow: var(--sombra);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    transform: translateX(-50%);
    animation: asomar 0.18s ease-out;
  }
  .ir-actual :global(svg) {
    color: var(--acento);
  }
  .ir-actual:hover {
    border-color: var(--acento-borde);
  }
  @keyframes asomar {
    from {
      opacity: 0;
      transform: translate(-50%, 6px);
    }
  }

  /* touch screens: rows of at least 44 px */
  @media (pointer: coarse) {
    .capitulo,
    .desplegar {
      min-height: 46px;
    }
    .desplegar {
      width: 44px;
      height: 46px;
    }
    .secciones a {
      min-height: 44px;
      padding-top: 11px;
      padding-bottom: 9px;
    }
    .filtro input {
      height: 44px;
    }
    .borrar {
      width: 40px;
      height: 40px;
    }
    .ir-actual {
      min-height: 44px;
    }
  }
</style>
