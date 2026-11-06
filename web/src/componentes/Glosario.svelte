<script lang="ts" module>
  // The filter survives leaving the glossary, so «Volver al glosario» finds it as it was.
  let filtroGuardado = '';
</script>

<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import type { EntradaGlosario, Parte } from '../lib/tipos';
  import ErrorCarga from './ErrorCarga.svelte';
  import { app } from '../lib/estado.svelte';
  import { ruta, prepararSalto, recordarScroll, volver } from '../lib/ruta.svelte';
  import {
    cargarBusqueda,
    cargarGlosario,
    cargarParte,
    idGlosario,
    infoParte,
    leerJSON,
    letraDe,
    normalizar,
    prepararHtml,
    rutaDeRef,
    textoPlano,
  } from '../lib/datos';
  import { colorBloque } from '../lib/color';
  import { fuentesDeLectura } from '../lib/mapas-lectura';
  import Icono from './Icono.svelte';
  import type { ImagenTermino } from './glosario/imagenes';

  interface Entrada extends EntradaGlosario {
    id: string;
    letra: string;
    plano: string;
    buscable: string;
  }

  let entradas = $state<Entrada[]>([]);
  let intro = $state('');
  let error = $state('');
  let filtro = $state(filtroGuardado);
  $effect(() => {
    filtroGuardado = filtro;
  });
  let barra: HTMLElement | undefined = $state();

  // ------------------------------------------------------------------ pictures (symbol, 3D thumbnail)
  // A lazy chunk (glosario/imagenes.ts) with the mapping and the symbols; three.js only when a term with a
  // model comes into view. Thumbnails are cached per theme for the session.

  type ModuloImagenes = typeof import('./glosario/imagenes');
  let modImagenes: ModuloImagenes | null = null;
  let imagenes = $state<Map<string, ImagenTermino> | null>(null);
  /**
   * Which terms will have a symbol or a 3D picture (glosario-imagenes.json alone, a few kB): their places are kept
   * at their final size until the pictures' chunk arrives, so nothing moves when it does (0.11 QA: the list jumped
   * by a quarter of the screen when the chunk came 3 s late on a slow device).
   */
  let huecos = $state<Map<string, { s: boolean; m: boolean }> | null>(null);
  let minis = $state<Record<string, string>>({});
  let io: IntersectionObserver | null = null;
  const pendientes = new Set<HTMLElement>();

  function pedirMiniatura(id: string): void {
    const m = imagenes?.get(id)?.modelo;
    if (!m || !modImagenes?.hayWebGL2()) return;
    const tema = app.tema;
    const clave = modImagenes.claveMiniatura(m, tema);
    if (minis[clave]) return;
    modImagenes
      .miniaturaDe(m, tema)
      .then((u) => (minis[clave] = u))
      .catch(() => {});
  }

  function observador(): IntersectionObserver {
    io ??= new IntersectionObserver(
      (entradas) => {
        for (const en of entradas) {
          if (!en.isIntersecting) continue;
          const el = en.target as HTMLElement;
          io?.unobserve(el);
          pedirMiniatura(el.dataset.id ?? '');
        }
      },
      { rootMargin: '200px 0px' },
    );
    return io;
  }

  /** Action: the thumbnail is asked for when its term is about to come into view. */
  function perezosa(nodo: HTMLElement) {
    pendientes.add(nodo);
    observador().observe(nodo);
    return {
      destroy() {
        pendientes.delete(nodo);
        io?.unobserve(nodo);
      },
    };
  }

  function miniaturaVisible(im: ImagenTermino): string {
    return im.modelo && modImagenes ? (minis[modImagenes.claveMiniatura(im.modelo, app.tema)] ?? '') : '';
  }

  // A change of theme asks again for the thumbnails on screen (each theme has its own studio background).
  $effect(() => {
    void app.tema;
    untrack(() => {
      if (!io) return;
      for (const n of pendientes) {
        io.unobserve(n);
        io.observe(n);
      }
    });
  });

  const titulo = $derived(infoParte('glosario')?.titulo ?? 'Glosario');
  const color = $derived(infoParte('glosario')?.color ?? '8A1F3D');

  const filtradas = $derived.by(() => {
    const palabras = normalizar(filtro).split(/\s+/).filter(Boolean);
    if (!palabras.length) return entradas;
    return entradas.filter((e) => palabras.every((p) => e.buscable.includes(p)));
  });

  const grupos = $derived.by(() => {
    const g: { letra: string; entradas: Entrada[] }[] = [];
    for (const e of filtradas) {
      const ultimo = g[g.length - 1];
      if (ultimo && ultimo.letra === e.letra) ultimo.entradas.push(e);
      else g.push({ letra: e.letra, entradas: [e] });
    }
    return g;
  });

  const ALFABETO = ['#', ...'ABCDEFGHIJKLMN'.split(''), 'Ñ', ...'OPQRSTUVWXYZ'.split('')];
  const presentes = $derived(new Set(grupos.map((g) => g.letra)));

  function ir(letra: string) {
    const el = document.getElementById(`letra-${letra}`);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - desfase();
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  function desfase(): number {
    const b = (document.querySelector('header.barra') as HTMLElement | null)?.offsetHeight ?? 56;
    return b + (barra?.offsetHeight ?? 0) + 6;
  }

  function nombreRef(clave: string): { texto: string; titulo: string; color: string } {
    const r = app.refs[clave];
    if (!r) return { texto: clave.replace(/^[a-z]+-/, ''), titulo: '', color: '1A3A5C' };
    const p = infoParte(r.parte);
    const s = p?.secciones?.find((x) => x.num === r.num);
    return {
      texto: r.num,
      titulo: s ? `${s.num} ${s.titulo}` : (p?.titulo ?? ''),
      color: p?.color ?? '1A3A5C',
    };
  }

  function clicRef() {
    prepararSalto({ texto: 'Volver al glosario' });
  }

  async function posicionar() {
    await tick();
    // the text's fonts change the height of 900 entries when they arrive: place the term once they are in, or it
    // ends some 30 px off (0.11 QA, on the tablet)
    await document.fonts?.ready;
    if (ruta.y != null) {
      window.scrollTo({ top: ruta.y, behavior: 'instant' });
      return;
    }
    if (ruta.ancla) {
      let el = document.getElementById(ruta.ancla);
      if (!el) {
        // A search document id that is not the app's own id: match it by title.
        const docs = await cargarBusqueda().catch(() => []);
        const d = docs.find((x) => x.id === ruta.ancla);
        if (d) {
          const t = normalizar(d.titulo);
          const e = entradas.find((x) => normalizar(x.plano) === t);
          if (e) el = document.getElementById(e.id);
        }
      }
      if (el) {
        filtro = '';
        await tick();
        const y = el.getBoundingClientRect().top + window.scrollY - desfase();
        window.scrollTo({ top: y, behavior: 'instant' });
        el.classList.add('destello');
        setTimeout(() => el?.classList.remove('destello'), 2600);
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /** The terms, the glossary's introduction and the terms' pictures (again after «Reintentar»). */
  function cargar() {
    error = '';
    const conImagenes = import('./glosario/imagenes')
      .then(async (m) => {
        modImagenes = m;
        return await m.cargarImagenes();
      })
      .catch(() => null);
    const mapa = leerJSON<{ terminos?: Record<string, { s?: string; m?: string }> }>('glosario-imagenes.json')
      .then((f) => new Map(Object.entries(f.terminos ?? {}).filter(([, x]) => x.s || x.m).map(([id, x]) => [id, { s: !!x.s, m: !!x.m }])))
      .catch(() => null);
    void mapa.then((m) => (huecos = m));
    Promise.all([cargarGlosario(), cargarParte('glosario').catch(() => null as Parte | null), mapa, fuentesDeLectura()])
      // once the terms are in, up to 1 s more for their pictures (counted from here: the list itself can take a
      // second or two to arrive on a slow device)
      .then(async ([g, parte]) => [g, parte, await Promise.race([conImagenes, new Promise<null>((r) => setTimeout(() => r(null), 1000))])] as const)
      .then(([g, parte, im]) => {
        if (im) imagenes = im;
        const usados = new Map<string, number>();
        entradas = g.map((e) => {
          let id = e.id || idGlosario(e.termino);
          const n = usados.get(id) ?? 0;
          usados.set(id, n + 1);
          if (n) id += `-${n + 1}`;
          const plano = textoPlano(e.termino);
          return { ...e, id, letra: letraDe(e.termino), plano, buscable: normalizar(plano + ' ' + textoPlano(e.html)) };
        });
        const p = parte?.bloques.find((b) => b.t === 'p');
        intro = p && p.t === 'p' ? p.html : '';
      })
      .catch((e: unknown) => (error = e instanceof Error ? e.message : String(e)));
    void conImagenes.then((im) => {
      if (im && !imagenes) imagenes = im;
    });
  }

  onMount(() => {
    app.seccion = null;
    // The symbols and 3D pictures of the terms (glosario-imagenes.json) change the height of their entries: the list
    // waits for them (at most 1.5 s) so an entry opened from a link does not jump away once it is on screen
    // (0.11 QA: the term moved some 200 px down a second after opening it on the tablet).
    cargar();
    const desplazar = () => recordarScroll();
    window.addEventListener('scroll', desplazar, { passive: true });
    return () => {
      window.removeEventListener('scroll', desplazar);
      io?.disconnect();
      io = null;
    };
  });

  $effect(() => {
    if (!entradas.length) return;
    void ruta.n;
    untrack(() => {
      if (ruta.vista === 'glosario') void posicionar();
    });
  });
</script>

<svelte:head><title>{titulo} · Electrónica Práctica Avanzada</title></svelte:head>

<div class="glosario" style:--banda={colorBloque(color)}>
  <header class="cab">
    <h1>{titulo}</h1>
    {#if intro}<p>{@html prepararHtml(intro)}</p>{/if}
  </header>

  <div class="herramientas" bind:this={barra}>
    <label class="filtro">
      <Icono nombre="buscar" tam={18} />
      <input
        type="search"
        placeholder="Filtrar términos…"
        bind:value={filtro}
        aria-label="Filtrar los términos del glosario"
        autocomplete="off"
        spellcheck="false"
      />
      <span class="cuenta">{filtradas.length} {filtradas.length === 1 ? 'término' : 'términos'}</span>
    </label>
    <nav class="letras" aria-label="Letras">
      {#each ALFABETO as l (l)}
        <button disabled={!presentes.has(l)} onclick={() => ir(l)} aria-label={l === '#' ? 'Números y símbolos' : `Letra ${l}`}>{l}</button>
      {/each}
    </nav>
  </div>

  {#if error}
    <ErrorCarga titulo="No se pudo cargar el glosario." {error} reintentar={cargar} />
  {:else if entradas.length && !filtradas.length}
    <p class="vacio">Ningún término coincide con «{filtro}».</p>
  {/if}

  <div class="lista texto-libro">
    {#each grupos as g (g.letra)}
      <section id={`letra-${g.letra}`} class="grupo">
        <h2 class="letra">{g.letra}</h2>
        <dl>
          {#each g.entradas as e (e.id)}
            {@const im = imagenes?.get(e.id)}
            {@const hueco = im ? undefined : huecos?.get(e.id)}
            <div class="entrada" class:con-imagen={!!im || !!hueco} id={e.id}>
              <dt>{@html prepararHtml(e.termino_html || e.termino)}</dt>
              <dd>
                {@html prepararHtml(e.html)}
                {#if e.ver.length}
                  <span class="ver">
                    {#each e.ver as clave (clave)}
                      {@const r = nombreRef(clave)}
                      {@const href = rutaDeRef(clave)}
                      {#if href}
                        <a class="chip" {href} title={r.titulo} style:--c={colorBloque(r.color)} onclick={clicRef}
                          >→ {r.texto}</a
                        >
                      {:else}
                        <span class="chip muerto">→ {r.texto}</span>
                      {/if}
                    {/each}
                  </span>
                {/if}
              </dd>
              {#if im}
                <dd class="imagen">
                  {#if im.simbolo}
                    <span class="simbolo" role="img" aria-label={`Símbolo: ${im.simbolo.nombre}`} title={`Símbolo: ${im.simbolo.nombre}`}
                      >{@html im.simbolo.svg}</span
                    >
                  {/if}
                  {#if im.modelo}
                    {@const src = miniaturaVisible(im)}
                    <a class="mini3d" href={im.modelo.href} data-id={e.id} use:perezosa title={im.modelo.nombre} aria-label={`Ver en 3D: ${im.modelo.nombre}`}>
                      <span class="foto3d">
                        {#if src}<img {src} alt="" width="120" height="90" decoding="async" draggable="false" />{:else}<Icono nombre="componentes" tam={22} />{/if}
                      </span>
                      <span class="ver3d">Ver en 3D</span>
                    </a>
                  {/if}
                </dd>
              {:else if hueco}
                <dd class="imagen" aria-hidden="true">
                  {#if hueco.s}<span class="simbolo"></span>{/if}
                  {#if hueco.m}<span class="mini3d"></span>{/if}
                </dd>
              {/if}
            </div>
          {/each}
        </dl>
      </section>
    {/each}
  </div>
</div>

{#if ruta.desde}
  <button class="volver" onclick={volver}><Icono nombre="volver" tam={18} /> {ruta.desde.texto}</button>
{/if}

<style>
  .glosario {
    --fondo-3d: #eeece6;
    --pad: clamp(16px, 4vw, 40px);
    max-width: calc(46em + 2 * var(--pad));
    margin: 0 auto;
    padding: 0 var(--pad) 64px;
    font-size: var(--tam);
  }
  :global(:root[data-tema='sepia']) .glosario {
    --fondo-3d: #ece2cc;
  }
  :global(:root[data-tema='oscuro']) .glosario {
    --fondo-3d: #23272e;
  }
  .cab {
    margin: 0 calc(-1 * var(--pad));
    padding: clamp(28px, 6vw, 44px) var(--pad) 26px;
    background: var(--banda);
    color: #fff;
    font-family: var(--sans);
  }
  @media (min-width: 760px) {
    .cab {
      margin: 28px 0 0;
      border-radius: 14px;
    }
  }
  h1 {
    margin: 0;
    font-size: clamp(27px, 4.4vw, 38px);
    font-weight: 700;
    line-height: 1.12;
    letter-spacing: -0.01em;
  }
  .cab p {
    max-width: 40em;
    margin: 10px 0 0;
    color: rgba(255, 255, 255, 0.86);
    font-size: 16px;
    line-height: 1.45;
  }

  .herramientas {
    position: sticky;
    top: calc(var(--alto-barra) + env(safe-area-inset-top));
    z-index: 5;
    margin: 0 calc(-1 * var(--pad));
    padding: 12px var(--pad) 8px;
    background: var(--fondo);
    border-bottom: 1px solid var(--linea-suave);
    font-family: var(--sans);
  }
  .filtro {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 14px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta-tenue);
  }
  .filtro:focus-within {
    border-color: var(--acento);
    /* the app's focus ring (WCAG 2.4.7 / 2.4.11; QA 1.0: a border colour alone was not enough) */
    outline: 2px solid var(--acento);
    outline-offset: 2px;
  }
  .filtro input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: none;
    color: var(--tinta);
    font-size: 16px;
  }
  .cuenta {
    flex: none;
    font-size: 13px;
  }
  .letras {
    display: flex;
    gap: 2px;
    margin-top: 8px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .letras::-webkit-scrollbar {
    display: none;
  }
  .letras button {
    flex: 1 0 auto;
    min-width: 26px;
    height: 32px;
    padding: 0 4px;
    border: 0;
    border-radius: 7px;
    background: none;
    color: var(--acento);
    font-size: 14.5px;
    font-weight: 700;
  }
  .letras button:hover:not(:disabled) {
    background: var(--acento-tinte);
  }
  .letras button:disabled {
    color: var(--linea);
    cursor: default;
  }
  /* Touch screens: two rows of 14, each letter 44 px tall and as wide as the row allows (44 px on a tablet, about
     25 px on a phone), instead of one tight scrolling row (owner's decision on the 0.11 QA). */
  @media (pointer: coarse) {
    .letras {
      display: grid;
      grid-template-columns: repeat(14, minmax(0, 44px));
      justify-content: center;
      gap: 2px;
      overflow: visible;
    }
    .letras button {
      min-width: 0;
      height: 44px;
      padding: 0;
    }
  }
  /* 1.0 accessibility pass: on a phone two rows of 14 left 21.6 px per letter at 360 px (WCAG 2.5.8 asks for 24 px):
     three rows of 10 there, each letter at least 30 px wide */
  @media (pointer: coarse) and (max-width: 440px) {
    .letras {
      grid-template-columns: repeat(10, minmax(0, 44px));
    }
  }

  .vacio {
    margin: 32px 0;
    color: var(--tinta-suave);
    font-family: var(--sans);
    text-align: center;
  }
  .grupo {
    margin-top: 24px;
  }
  .letra {
    margin: 0 0 4px;
    padding-bottom: 4px;
    border-bottom: 1.5px solid var(--acento);
    color: var(--acento);
    font-family: var(--sans);
    font-size: 1.5em;
    font-weight: 700;
  }
  dl {
    margin: 0;
  }
  .entrada {
    padding: 12px 8px 12px;
    border-bottom: 1px solid var(--linea-suave);
    border-radius: 6px;
  }
  dt {
    margin: 0 0 3px;
    color: var(--titulos);
    font-family: var(--sans);
    font-size: 1.02em;
    font-weight: 700;
  }
  dd {
    margin: 0;
    line-height: 1.55;
  }
  .entrada.con-imagen {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: auto 1fr;
    column-gap: 18px;
  }
  .entrada.con-imagen > :global(*) {
    grid-column: 1;
  }
  .entrada.con-imagen > .imagen {
    grid-column: 2;
    grid-row: 1 / span 2;
  }
  .imagen {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 2px 0 0;
    font-family: var(--sans);
  }
  .simbolo,
  .mini3d {
    width: 108px;
    height: 76px;
    border-radius: 8px;
  }
  .simbolo {
    display: grid;
    place-items: center;
    padding: 6px;
    border: 1px solid var(--linea-suave);
    background: var(--superficie);
    color: var(--titulos);
    --simbolo-fondo: var(--superficie);
  }
  .simbolo :global(svg) {
    max-width: 100%;
    max-height: 100%;
    height: auto;
    overflow: visible;
  }
  .simbolo :global(svg text) {
    fill: currentColor;
    stroke: none;
    font-family: var(--sans);
  }
  .simbolo :global(svg .t) {
    fill: currentColor;
  }
  .simbolo :global(svg .f) {
    fill: var(--simbolo-fondo);
  }
  .mini3d {
    position: relative;
    display: block;
    overflow: hidden;
    background: var(--fondo-3d);
    color: var(--acento);
    text-decoration: none;
  }
  .foto3d {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    color: var(--tinta-tenue);
  }
  .foto3d img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .ver3d {
    position: absolute;
    right: 5px;
    bottom: 5px;
    padding: 1px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--superficie) 88%, transparent);
    font-size: 11.5px;
    font-weight: 700;
    line-height: 17px;
    /* toned towards the text: the glossary's accent was 4.4:1 here on the dark theme (0.11 QA) */
    color: color-mix(in srgb, currentColor 64%, var(--tinta));
  }
  .mini3d:hover,
  .mini3d:focus-visible {
    box-shadow: 0 0 0 2px var(--acento-borde);
  }
  @media (max-width: 559px) {
    .entrada.con-imagen {
      grid-template-columns: minmax(0, 1fr);
    }
    .entrada.con-imagen > .imagen {
      grid-column: 1;
      grid-row: auto;
      margin-top: 8px;
    }
    .simbolo,
    .mini3d {
      width: 96px;
      height: 64px;
    }
  }
  .ver {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-left: 6px;
    vertical-align: 1px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    min-height: 26px;
    padding: 0 9px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--c);
    font-family: var(--sans);
    font-size: 0.78em;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
  }
  :global(:root[data-tema='oscuro']) .chip {
    color: var(--acento);
  }
  .chip:hover {
    border-color: var(--c);
  }
  .chip.muerto {
    color: var(--tinta-tenue);
  }

  .volver {
    position: fixed;
    left: 50%;
    bottom: calc(18px + var(--hueco-inferior));
    z-index: 25;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 18px 0 14px;
    border: 0;
    border-radius: 999px;
    background: var(--titulos);
    color: var(--fondo);
    box-shadow: var(--sombra-alta);
    font-family: var(--sans);
    font-size: 15px;
    font-weight: 600;
    transform: translateX(-50%);
  }
  :global(.app:not(.movil)) .volver {
    left: calc(50% + var(--ancho-lateral) / 2);
  }
</style>
