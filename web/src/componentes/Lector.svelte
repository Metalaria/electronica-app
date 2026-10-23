<script lang="ts">
  // Reading view of one part (chapter, appendix or back matter).
  import { onMount, tick, untrack } from 'svelte';
  import type { Parte } from '../lib/tipos';
  import { app } from '../lib/estado.svelte';
  import { ruta, prepararSalto, recordarScroll, registrarAncla, volver, type AnclaLectura } from '../lib/ruta.svelte';
  import { usuario, guardarPosicion } from '../lib/usuario.svelte';
  import {
    candidatosDeRef,
    cargarParte,
    infoParte,
    obtenerIndice,
    ordenLectura,
    rotuloParte,
    tomoDe,
  } from '../lib/datos';
  import { colorBloque } from '../lib/color';
  import { anchoColumna, trozoDe, trozosDe } from '../lib/trozos';
  import { alInactivo, precargar, refsCitadas } from '../lib/precarga';
  import { seguirLectura } from '../lib/lectura';
  import Bloques from './Bloques.svelte';
  import Icono from './Icono.svelte';
  import BotonTest from './repaso/BotonTest.svelte';

  let { parte }: { parte: string } = $props();

  let datos = $state<Parte | null>(null);
  let error = $state('');
  let cuerpo: HTMLElement | undefined = $state();
  let articulo: HTMLElement | undefined = $state();

  const info = $derived(infoParte(parte));
  const secciones = $derived(info?.secciones ?? []);
  const titulo = $derived(datos?.titulo ?? info?.titulo ?? '');
  const tituloPrincipal = $derived(titulo.split(' — ')[0] ?? titulo);
  const subtitulo = $derived(titulo.includes(' — ') ? titulo.split(' — ').slice(1).join(' — ') : '');
  const numero = $derived(datos?.num ?? info?.num ?? null);
  const rotuloTipo = $derived(info?.tipo === 'apendice' ? 'APÉNDICE' : info?.tipo === 'capitulo' ? 'CAPÍTULO' : '');
  const tomo = $derived.by(() => {
    const t = tomoDe(parte);
    return t ? obtenerIndice().tomos.find((x) => x.id === t) : undefined;
  });
  const orden = $derived(ordenLectura());
  const anterior = $derived(orden[orden.indexOf(parte) - 1]);
  const siguiente = $derived(orden[orden.indexOf(parte) + 1]);

  function hrefParte(id: string): string {
    return id === 'glosario' ? '#/glosario' : `#/${id}`;
  }

  // ------------------------------------------------------------------ chunks

  // Chunks are computed once per part (estimates use the size at load time; real sizes win later).
  // The prefetcher may already have computed them in idle time (same cache).
  const trozos = $derived.by(() => {
    if (!datos) return [];
    const tam = untrack(() => usuario.prefs.tam);
    return trozosDe(datos.bloques, anchoColumna(tam, untrack(() => app.movil)), tam);
  });

  // ------------------------------------------------------------------ progressive rendering
  //
  // Rendering a whole chapter at once costs seconds on a slow phone (and every inline equation it creates
  // loads and restyles the page). The chunk the reader is going to see is rendered first, with its
  // neighbours; the others follow in idle time, nearest first. A chunk not rendered yet keeps its estimated
  // height, and chunks off screen are skipped by `content-visibility`, so filling them does not move the page.

  let listos = $state<boolean[]>([]);
  let cancelarRelleno: (() => void) | null = null;

  /** Chunk that the current route will show. */
  function trozoObjetivo(): number {
    if (ruta.vista !== 'parte' || ruta.parte !== parte) return 0;
    if (ruta.pos) return trozoDe(trozos, { b: ruta.pos.b }) ?? 0;
    if (ruta.y != null) {
      let y = 0;
      for (let k = 0; k < trozos.length; k++) {
        y += trozos[k]!.estimado;
        if (y > ruta.y) return k;
      }
      return Math.max(0, trozos.length - 1);
    }
    if (ruta.ancla) return trozoDe(trozos, { ids: candidatosDeRef(ruta.ancla) }) ?? 0;
    const g = usuario.posiciones[parte];
    return g && g.b > 0 ? (trozoDe(trozos, { b: g.b }) ?? 0) : 0;
  }

  /** Renders chunk k now (its neighbours follow in idle time); resolves when it is in the DOM. */
  async function asegurar(k: number): Promise<void> {
    if (k < 0 || k >= trozos.length || listos[k]) return;
    listos[k] = true;
    await tick();
  }

  /** Index of the chunk on screen (or the target while nothing is laid out yet). */
  function trozoVisible(): number {
    const t = trozoActual(barra + 8);
    const k = t ? elTrozos().indexOf(t) : -1;
    return k >= 0 ? k : trozoObjetivo();
  }

  function rellenar() {
    cancelarRelleno?.();
    cancelarRelleno = alInactivo(async (quedan) => {
      cancelarRelleno = null;
      const centro = trozoVisible();
      let n = 0;
      // Nearest pending chunks first; several per slice while there is idle time left.
      for (let d = 0; d < trozos.length && quedan() > 3; d++) {
        for (const k of [centro + d, centro - d]) {
          if (k >= 0 && k < trozos.length && !listos[k]) {
            listos[k] = true;
            n++;
          }
        }
        if (n >= 2) break;
      }
      if (n) await tick();
      if (listos.length && listos.some((x) => !x)) rellenar();
    }, 300);
  }

  $effect(() => {
    const ts = trozos;
    untrack(() => {
      const k = ts.length ? trozoObjetivo() : 0;
      listos = ts.map((_, i) => i === k);
      if (ts.length) rellenar();
    });
    return () => {
      cancelarRelleno?.();
      cancelarRelleno = null;
    };
  });

  // ------------------------------------------------------------------ prefetch

  let ultimaPrecarga = '';

  /** Prepares the parts referenced around the reading position (and the next part) for an instant jump. */
  function programarPrecarga() {
    const k = trozoVisible();
    const clave = `${k}`;
    if (clave === ultimaPrecarga) return;
    ultimaPrecarga = clave;
    const bloques = [...(trozos[k]?.bloques ?? []), ...(trozos[k + 1]?.bloques ?? [])];
    precargar(refsCitadas(bloques), siguiente ?? null, parte, usuario.prefs.tam, app.movil);
  }

  // ------------------------------------------------------------------ geometry helpers

  let barra = 56;

  function medirBarra() {
    barra = (document.querySelector('header.barra') as HTMLElement | null)?.offsetHeight ?? 56;
  }

  function elTrozos(): HTMLElement[] {
    return cuerpo ? Array.from(cuerpo.children as HTMLCollectionOf<HTMLElement>).filter((e) => e.classList.contains('trozo')) : [];
  }

  function bloque(n: number): HTMLElement | null {
    return cuerpo?.querySelector<HTMLElement>(`.trozo > [data-b="${n}"]`) ?? null;
  }

  /** Index of the first element of a list whose bottom is below a line (binary search). */
  function primeroBajo(lista: HTMLElement[], lim: number): number {
    let lo = 0;
    let hi = lista.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (lista[mid]!.getBoundingClientRect().bottom <= lim) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** The chunk under the reading line. */
  function trozoActual(lim: number): HTMLElement | null {
    const lista = elTrozos();
    return lista.length ? lista[primeroBajo(lista, lim)]! : null;
  }

  /** The top-level block at the top of the screen and how much of it is scrolled past. */
  function anclaActual(): AnclaLectura | null {
    const lim = barra + 8;
    const t = trozoActual(lim);
    if (!t) return null;
    const lista = Array.from(t.children as HTMLCollectionOf<HTMLElement>).filter((e) => e.dataset.b != null);
    if (!lista.length) return null;
    const el = lista[primeroBajo(lista, lim)]!;
    return { b: Number(el.dataset.b), off: Math.round(lim - el.getBoundingClientRect().top) };
  }

  // ------------------------------------------------------------------ positioning

  let fijado: { el: HTMLElement; off: number; hasta: number } | null = null;
  let observador: ResizeObserver | null = null;

  function soltar() {
    fijado = null;
  }

  /** Scroll position the app itself asked for (to tell it apart from the reader's scrolling). */
  let esperado = -1;

  function colocar(el: HTMLElement, off: number) {
    const y = el.getBoundingClientRect().top + window.scrollY - (barra + 8) + off;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    esperado = Math.round(Math.max(0, Math.min(max, y)));
    window.scrollTo({ top: esperado, behavior: 'instant' });
  }

  /** Scrolls to an element and keeps it there while the layout around it settles. */
  function irA(el: HTMLElement, off = 0, ms = 4000) {
    colocar(el, off);
    fijado = { el, off, hasta: performance.now() + ms };
  }

  function destacar(el: HTMLElement) {
    const objetivo = el.matches('h2') ? (el.closest('.seccion-cab') as HTMLElement) ?? el : el;
    objetivo.classList.remove('destello');
    void objetivo.offsetWidth;
    objetivo.classList.add('destello');
    setTimeout(() => objetivo.classList.remove('destello'), 2600);
  }

  function buscarDestino(ancla: string): HTMLElement | null {
    for (const id of candidatosDeRef(ancla)) {
      const el = document.getElementById(id);
      if (el && articulo?.contains(el)) return el;
    }
    return null;
  }

  async function posicionar() {
    if (!cuerpo) return;
    soltar();
    medirBarra();
    await asegurar(trozoObjetivo());
    if (!cuerpo) return;
    if (ruta.pos) {
      const el = bloque(ruta.pos.b);
      if (el) return irA(el, ruta.pos.off);
    }
    if (ruta.y != null) {
      window.scrollTo({ top: ruta.y, behavior: 'instant' });
      return;
    }
    if (ruta.ancla) {
      const el = buscarDestino(ruta.ancla);
      if (el) {
        irA(el);
        if (el !== articulo) destacar(el);
        return;
      }
      // An anchor that is not in this part (e.g. a search document of the whole part): the start.
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    const guardada = usuario.posiciones[parte];
    if (guardada && guardada.b > 0) {
      const el = bloque(guardada.b);
      if (el) return irA(el);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ------------------------------------------------------------------ scroll tracking

  let encuadre = 0;
  let ultimoGuardado = 0;

  function actualizar() {
    encuadre = 0;
    if (!cuerpo) return;
    const raiz = document.documentElement;
    const alto = raiz.scrollHeight - window.innerHeight;
    app.progreso = alto > 0 ? Math.min(1, Math.max(0, window.scrollY / alto)) : 0;

    // Section being read: the one of the chunk under the reading line (chunks start at sections).
    let t = trozoActual(barra + 90);
    let linea = barra + 90;
    // At the end of the page a short last section never reaches the reading line: take the last section
    // that starts in the upper half of the screen.
    if (alto > 0 && window.scrollY >= alto - 4) {
      const mitad = window.innerHeight / 2;
      linea = Math.max(linea, mitad);
      for (const x of elTrozos()) {
        if (x.dataset.seccion && x.getBoundingClientRect().top < mitad) t = x;
      }
    }
    const label = t?.dataset.seccion ?? '';
    if (label && t && t.getBoundingClientRect().top <= linea) {
      if (app.seccion?.label !== label || app.seccion.parte !== parte) {
        const s = secciones.find((x) => x.label === label);
        const h = document.getElementById(label);
        app.seccion = {
          parte,
          label,
          num: s?.num ?? h?.querySelector('.num')?.textContent ?? '',
          titulo: s?.titulo ?? h?.textContent ?? '',
        };
      }
    } else if (app.seccion) {
      app.seccion = null;
    }

    const ahora = performance.now();
    if (listos.length) programarPrecarga();
    if (ahora - ultimoGuardado > 700) {
      ultimoGuardado = ahora;
      const a = anclaActual();
      if (a) guardarPosicion(parte, { b: a.b, sec: app.seccion?.label, f: Math.round(app.progreso * 1000) / 1000 });
    }
    recordarScroll();
  }

  function alDesplazar() {
    // Any scroll that the app did not ask for (scroll bar, find in page…) releases the anchor.
    if (fijado && Math.abs(window.scrollY - esperado) > 3) soltar();
    if (!encuadre) encuadre = requestAnimationFrame(actualizar);
  }

  function interaccion() {
    soltar();
  }

  // ------------------------------------------------------------------ references

  function clic(ev: MouseEvent) {
    const a = (ev.target as Element).closest<HTMLAnchorElement>('a.ref');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return;
    if (href === location.hash) {
      // Same route: no new history entry, just go there again.
      ev.preventDefault();
      void asegurar(trozoObjetivo()).then(() => {
        const el = buscarDestino(ruta.ancla);
        if (el) {
          irA(el);
          destacar(el);
        }
      });
      return;
    }
    const s = app.seccion?.parte === parte ? app.seccion : null;
    prepararSalto({ texto: s ? `Volver a ${s.num}` : 'Volver' });
  }

  // ------------------------------------------------------------------ lifecycle

  function cargar() {
    error = '';
    cargarParte(parte)
      .then((p) => {
        datos = p;
      })
      .catch((e: unknown) => {
        error = e instanceof Error ? e.message : String(e);
      });
  }

  onMount(() => {
    app.seccion = null;
    app.progreso = 0;
    cargar();

    registrarAncla(anclaActual);
    medirBarra();
    const redimensionar = () => {
      medirBarra();
      alDesplazar();
    };
    window.addEventListener('scroll', alDesplazar, { passive: true });
    window.addEventListener('resize', redimensionar, { passive: true });
    const opciones = { passive: true, capture: true } as const;
    window.addEventListener('wheel', interaccion, opciones);
    window.addEventListener('touchstart', interaccion, opciones);
    window.addEventListener('keydown', interaccion, opciones);
    window.addEventListener('pointerdown', interaccion, opciones);

    return () => {
      registrarAncla(null);
      observador?.disconnect();
      window.removeEventListener('scroll', alDesplazar);
      window.removeEventListener('resize', redimensionar);
      window.removeEventListener('wheel', interaccion, opciones);
      window.removeEventListener('touchstart', interaccion, opciones);
      window.removeEventListener('keydown', interaccion, opciones);
      window.removeEventListener('pointerdown', interaccion, opciones);
      if (encuadre) cancelAnimationFrame(encuadre);
    };
  });

  // Keep the anchored element in place while the layout settles (images, fonts, chunks rendered
  // for the first time). Engines without native scroll anchoring (WebKit) also get the reading
  // position compensated when a chunk above the screen changes height.
  const anclajeNativo = typeof CSS !== 'undefined' && CSS.supports('overflow-anchor', 'auto');
  const alturas = new WeakMap<Element, number>();

  $effect(() => {
    if (!cuerpo) return;
    void trozos;
    observador?.disconnect();
    observador = new ResizeObserver((entradas) => {
      if (fijado) {
        if (performance.now() > fijado.hasta || !fijado.el.isConnected) soltar();
        else colocar(fijado.el, fijado.off);
      } else if (!anclajeNativo) {
        let delta = 0;
        for (const e of entradas) {
          const h = e.borderBoxSize?.[0]?.blockSize ?? (e.target as HTMLElement).offsetHeight;
          const antes = alturas.get(e.target);
          alturas.set(e.target, h);
          if (antes == null || e.target === cuerpo) continue;
          if (e.target.getBoundingClientRect().bottom <= barra) delta += h - antes;
        }
        if (delta) window.scrollBy(0, delta);
      }
      alDesplazar();
    });
    observador.observe(cuerpo);
    for (const t of elTrozos()) observador.observe(t);
  });

  // Sections read (aprender): one IntersectionObserver over the chunks, nothing on scroll.
  $effect(() => {
    if (!cuerpo || !trozos.length) return;
    const c = cuerpo;
    return untrack(() => seguirLectura(c, parte, barra));
  });

  // Every navigation that lands on this part positions the view.
  $effect(() => {
    if (!datos || !cuerpo) return;
    void ruta.n;
    untrack(() => {
      if (ruta.vista !== 'parte' || ruta.parte !== parte) return;
      tick()
        .then(posicionar)
        .then(() => {
          actualizar();
          programarPrecarga();
        });
    });
  });

  // A change of text size moves everything: keep the reader at the same block.
  $effect(() => {
    void usuario.prefs.tam;
    untrack(() => {
      if (!cuerpo || !datos) return;
      const a = anclaActual();
      if (!a) return;
      tick().then(() => {
        const el = bloque(a.b);
        if (el) colocar(el, a.off);
      });
    });
  });
</script>

<svelte:head>
  <title>{titulo ? `${rotuloParte(parte)} · ${tituloPrincipal}` : 'Electrónica Práctica Avanzada'}</title>
</svelte:head>

<article class="lectura" id={parte} aria-busy={!datos} bind:this={articulo}>
  <header class="apertura" class:sin-numero={numero == null} id={info?.label ?? datos?.label ?? undefined}>
    <div class="banda">
      {#if numero != null && rotuloTipo}
        <div class="rotulo"><span>{rotuloTipo}</span><span class="numero">{numero}</span></div>
      {/if}
      <h1>{tituloPrincipal}</h1>
      {#if subtitulo}<p class="subtitulo">{subtitulo}</p>{/if}
    </div>
    {#if tomo}<p class="tomo">Tomo {tomo.id} · {tomo.titulo}</p>{/if}
  </header>

  {#if secciones.length}
    <nav class="en-este" aria-label="Secciones">
      <div class="en-este-tit">
        {info?.tipo === 'apendice' ? 'EN ESTE APÉNDICE' : info?.tipo === 'capitulo' ? 'EN ESTE CAPÍTULO' : 'CONTENIDO'}
      </div>
      <ol class:dos={secciones.length > 6}>
        {#each secciones as s (s.label)}
          <li>
            <a href={`#/${parte}/${s.label}`}>
              {#if s.num}<span class="n">{s.num}</span>{/if}
              <span class="t">{s.titulo}</span>
              {#if usuario.marcadores[s.label]}<span class="m" title="Marcador"><Icono nombre="marcador-lleno" tam={13} /></span>{/if}
              {#if usuario.notas[s.label]}<span class="m" title="Nota"><Icono nombre="nota" tam={13} /></span>{/if}
            </a>
          </li>
        {/each}
      </ol>
    </nav>
  {/if}

  {#if error}
    <div class="fallo">
      <p>No se pudo cargar esta parte del libro.</p>
      <p class="detalle">{error}</p>
      <button class="boton" onclick={cargar}>Reintentar</button>
    </div>
  {:else if !datos}
    <div class="esqueleto" aria-hidden="true">
      {#each [92, 100, 96, 84, 100, 70] as w, k (k)}<span style:width={`${w}%`}></span>{/each}
    </div>
  {:else}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="cuerpo texto-libro" bind:this={cuerpo} onclick={clic}>
      {#each trozos as t, k (t.inicio)}
        <div
          class="trozo"
          data-seccion={t.seccion ?? undefined}
          style:contain-intrinsic-size={`auto ${t.estimado}px`}
          style:min-height={listos[k] ? undefined : `${t.estimado}px`}
        >
          {#if listos[k]}
            <Bloques bloques={t.bloques} {parte} raiz desde={t.inicio} />
          {/if}
        </div>
      {/each}
    </div>

    <BotonTest {parte} />
    <nav class="contiguos" aria-label="Partes contiguas">
      {#if anterior}
        <a class="prev" href={hrefParte(anterior)}>
          <span class="dir"><Icono nombre="chevron-izq" tam={16} /> Anterior</span>
          <span class="nom">{rotuloParte(anterior)}{infoParte(anterior)?.num != null ? ` · ${(infoParte(anterior)?.titulo ?? '').split(' — ')[0]}` : ''}</span>
        </a>
      {:else}<span></span>{/if}
      {#if siguiente}
        <a class="next" href={hrefParte(siguiente)} style:--c={colorBloque(infoParte(siguiente)?.color)}>
          <span class="dir">Siguiente <Icono nombre="chevron" tam={16} /></span>
          <span class="nom">{rotuloParte(siguiente)}{infoParte(siguiente)?.num != null ? ` · ${(infoParte(siguiente)?.titulo ?? '').split(' — ')[0]}` : ''}</span>
        </a>
      {/if}
    </nav>
  {/if}
</article>

{#if ruta.desde}
  <button class="volver" onclick={volver}>
    <Icono nombre="volver" tam={18} />
    {ruta.desde.texto}
  </button>
{/if}

<style>
  .apertura {
    margin: 0 calc(-1 * var(--pad)) 0;
    padding: 0;
    font-family: var(--sans);
  }
  .banda {
    padding: clamp(28px, 6vw, 46px) var(--pad) clamp(24px, 4vw, 34px);
    background: var(--banda);
    color: #fff;
  }
  .rotulo {
    display: flex;
    align-items: baseline;
    gap: 12px;
    color: rgba(255, 255, 255, 0.78);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.16em;
  }
  .numero {
    color: #fff;
    font-size: clamp(52px, 9vw, 74px);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 0.9;
  }
  h1 {
    margin: 10px 0 0;
    font-size: clamp(27px, 4.4vw, 38px);
    font-weight: 700;
    line-height: 1.12;
    letter-spacing: -0.012em;
    text-wrap: balance;
  }
  .sin-numero h1 {
    margin-top: 0;
  }
  .subtitulo {
    margin: 8px 0 0;
    color: rgba(255, 255, 255, 0.86);
    font-size: clamp(17px, 2.2vw, 20px);
    line-height: 1.3;
    text-wrap: balance;
  }
  .tomo {
    margin: 0;
    padding: 9px var(--pad);
    border-bottom: 1px solid var(--linea-suave);
    color: var(--tinta-tenue);
    font-size: 13.5px;
  }
  @media (min-width: 760px) {
    .apertura {
      margin: 28px 0 0;
    }
    .banda {
      border-radius: 14px 14px 0 0;
    }
    .tomo {
      padding-left: var(--pad);
      border: 1px solid var(--linea-suave);
      border-top: 0;
      border-radius: 0 0 14px 14px;
      background: var(--superficie);
    }
    .apertura.sin-numero .banda:only-child {
      border-radius: 14px;
    }
  }

  .en-este {
    margin: 24px 0 8px;
    padding: 14px 16px 10px;
    border: 1px solid var(--acento-borde);
    border-radius: 12px;
    background: var(--acento-tinte);
    font-family: var(--sans);
  }
  .en-este-tit {
    margin-bottom: 6px;
    color: var(--acento);
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.1em;
  }
  .en-este ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  @media (min-width: 720px) {
    .en-este ol.dos {
      columns: 2;
      column-gap: 22px;
    }
  }
  .en-este li {
    break-inside: avoid;
  }
  .en-este a {
    display: flex;
    gap: 9px;
    padding: 5px 6px;
    border-radius: 6px;
    color: var(--tinta);
    font-size: 15px;
    line-height: 1.3;
    text-decoration: none;
  }
  .en-este a:hover {
    background: var(--hover);
  }
  .en-este .n {
    flex: none;
    min-width: 2.3em;
    color: var(--acento);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .en-este .t {
    flex: 1;
  }
  .en-este .m {
    flex: none;
    color: var(--acento);
  }

  .cuerpo {
    padding-top: 6px;
  }
  .trozo {
    content-visibility: auto;
  }
  .cuerpo > .trozo:first-child > :global(p:first-child) {
    margin-top: 1.4em;
  }

  .fallo {
    margin: 40px 0;
    padding: 18px 20px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    font-family: var(--sans);
  }
  .fallo p {
    margin: 0 0 6px;
    color: var(--tinta);
    font-weight: 600;
  }
  .fallo .detalle {
    margin-bottom: 14px;
    color: var(--tinta-tenue);
    font-size: 14px;
    font-weight: 400;
  }
  .esqueleto {
    display: grid;
    gap: 14px;
    margin-top: 36px;
  }
  .esqueleto span {
    height: 14px;
    border-radius: 7px;
    background: var(--linea-suave);
    animation: brillo 1.2s ease-in-out infinite alternate;
  }
  @keyframes brillo {
    to {
      opacity: 0.45;
    }
  }

  .contiguos {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 56px 0 24px;
    font-family: var(--sans);
  }
  .contiguos a {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta);
    text-decoration: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .contiguos a:hover {
    border-color: var(--acento-borde);
    box-shadow: var(--sombra);
  }
  .contiguos .next {
    grid-column: 2;
    align-items: flex-end;
    text-align: right;
  }
  .dir {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--tinta-tenue);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .nom {
    font-size: 15.5px;
    font-weight: 600;
    line-height: 1.3;
  }
  @media (max-width: 520px) {
    .contiguos {
      grid-template-columns: 1fr;
    }
    .contiguos .next {
      grid-column: 1;
    }
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
    animation: subir 0.2s ease-out;
  }
  :global(.app:not(.movil)) .volver {
    left: calc(50% + var(--ancho-lateral) / 2);
  }
  @keyframes subir {
    from {
      opacity: 0;
      transform: translate(-50%, 8px);
    }
  }
</style>
