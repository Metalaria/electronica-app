<script lang="ts">
  // 2.2: the guided steps on screen (RecorridoOferta, RecorridoPaso and TutorialBrymen of the 2.2 mock-ups): the offer
  // card, and a tour's card with the spotlight on the real element a step talks about. The card takes the focus (a
  // screen reader reads its title and text), Esc is «Salir», Tab stays in the card (and, in an action step, the lit
  // element); the dimmed page is inert and takes no taps. An action step («Gire el selector a V⎓») keeps «Siguiente»
  // disabled until it is done, then says so. Works on the phone, the tablet and the desktop, in the three themes, with
  // reduced motion. Everything lives in its own element at the end of <body>, outside the app's tree.
  import { tick, untrack } from 'svelte';
  import { RECORRIDOS, visibles, type PasoRecorrido, type Recorrido } from '../../lib/recorridos-pasos';
  import { recorridos, marcarOfrecido, marcarVisto, type IdRecorrido } from '../../lib/recorridos.svelte';
  import { ruta } from '../../lib/ruta.svelte';
  import { enfocarContenido } from '../../lib/foco-ruta';

  let { ir }: { ir: (href: string) => void } = $props();

  // ---------------------------------------------------------------- the host at the end of <body>
  function aCuerpo(nodo: HTMLElement) {
    document.body.append(nodo);
    return {
      destroy() {
        nodo.remove();
      },
    };
  }

  // ---------------------------------------------------------------- a tour asked for (Guía or offer)
  let preparando = $state(false);
  let errorInicio = $state('');

  $effect(() => {
    const id = recorridos.pedido;
    if (!id) return;
    untrack(() => void arrancar(id));
  });

  async function esperar(cond: () => boolean, ms: number): Promise<boolean> {
    const fin = performance.now() + ms;
    while (performance.now() < fin) {
      if (cond()) return true;
      await new Promise((r) => setTimeout(r, 120));
    }
    return cond();
  }

  async function arrancar(id: IdRecorrido) {
    const def = RECORRIDOS[id];
    preparando = true;
    errorInicio = '';
    recorridos.activo = null;
    if (def.enSitio && !def.enSitio() && def.inicio) ir(def.inicio);
    const primero = def.pasos[0]!;
    const listo = await esperar(() => recorridos.pedido === id && (!def.enSitio || def.enSitio()) && (!primero.objetivo || hayObjetivo(primero)), 30000);
    if (recorridos.pedido !== id) return;
    preparando = false;
    if (!listo) {
      errorInicio = 'No se ha podido abrir lo que enseña este tutorial. Inténtelo de nuevo en un momento.';
      return;
    }
    antesDelRecorrido = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    marcarOfrecido(id);
    recorridos.pedido = null;
    recorridos.paso = 0;
    recorridos.activo = id;
  }

  function hayObjetivo(p: PasoRecorrido): boolean {
    p.preparar?.();
    return !!p.objetivo && visibles(p.objetivo).length > 0;
  }

  // ---------------------------------------------------------------- the offer
  const oferta = $derived(recorridos.oferta ? RECORRIDOS[recorridos.oferta] : null);
  let antesDelRecorrido: HTMLElement | null = null;

  function aceptar() {
    const id = recorridos.oferta;
    if (!id) return;
    recorridos.oferta = null;
    recorridos.pedido = id;
  }

  function ahoraNo() {
    recorridos.oferta = null;
    enfocarContenido();
  }

  // ---------------------------------------------------------------- the tour
  const def = $derived<Recorrido | null>(recorridos.activo ? RECORRIDOS[recorridos.activo] : null);
  const paso = $derived(def ? def.pasos[recorridos.paso] : undefined);
  const total = $derived(def?.pasos.length ?? 0);
  const ultimo = $derived(recorridos.paso >= total - 1);
  const accion = $derived(!!paso && (!!paso.hecho || !!paso.pulsar));

  let hecho = $state(false);
  let inicioPaso: unknown = undefined;

  function salir() {
    recorridos.activo = null;
    recorridos.pedido = null;
    devolverFoco();
  }

  function terminar() {
    const id = recorridos.activo;
    if (id) marcarVisto(id);
    recorridos.activo = null;
    devolverFoco();
  }

  function devolverFoco() {
    const a = antesDelRecorrido;
    antesDelRecorrido = null;
    if (a?.isConnected) a.focus({ preventScroll: true });
    else enfocarContenido();
  }

  function siguiente() {
    if (accion && !hecho) return;
    if (ultimo) terminar();
    else recorridos.paso++;
  }

  function anterior() {
    if (recorridos.paso > 0) recorridos.paso--;
  }

  // A route change the tour did not ask for (a link of the page, the address bar): the tour no longer has its place.
  $effect(() => {
    void ruta.n;
    untrack(() => {
      if (def?.enSitio && !def.enSitio()) salir();
    });
  });

  // ---------------------------------------------------------------- geometry: the lit element and the card
  let rect = $state<{ x: number; y: number; w: number; h: number } | null>(null);
  let vw = $state(typeof window !== 'undefined' ? window.innerWidth : 1024);
  let vh = $state(typeof window !== 'undefined' ? window.innerHeight : 768);
  let tarjeta: HTMLElement | undefined = $state();
  let altoTarjeta = $state(0);
  let sonda: HTMLElement | undefined = $state();
  let margenes = $state({ arriba: 0, abajo: 0, izq: 0, der: 0 });
  const reducido = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function objetivos(): Element[] {
    return paso?.objetivo ? visibles(paso.objetivo) : [];
  }

  function medir() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    if (sonda) {
      const s = getComputedStyle(sonda);
      // 2.2 (cierre22): the app's own chrome is kept clear too, as the safe areas are: the header at the top, the
      // bottom bar (compact) and the rail on the left (medium and expanded). A lit element inside them is still lit; the
      // card goes beside it, never over them.
      const caja = (sel: string) => {
        const q = document.querySelector(sel)?.getBoundingClientRect();
        return q && q.width > 0 && q.height > 0 ? q : null;
      };
      const cab = caja('header.barra');
      const barra = caja('nav.pestanas[aria-label="Secciones de la aplicación"]');
      const carril = caja('nav.carril');
      const m = {
        arriba: Math.max(parseFloat(s.paddingTop) || 0, cab && cab.top <= 1 ? Math.max(0, cab.bottom) : 0),
        abajo: Math.max(parseFloat(s.paddingBottom) || 0, barra && barra.bottom >= vh - 1 ? vh - barra.top : 0),
        izq: Math.max(parseFloat(s.paddingLeft) || 0, carril && carril.left <= 1 ? Math.max(0, carril.right) : 0),
        der: parseFloat(s.paddingRight) || 0,
      };
      // (measured every frame: replaced only when it changes, so the card is not placed again for nothing)
      if (m.arriba !== margenes.arriba || m.abajo !== margenes.abajo || m.izq !== margenes.izq || m.der !== margenes.der) margenes = m;
    }
    const els = objetivos();
    if (!els.length) {
      rect = null;
      return;
    }
    let x1 = Infinity;
    let y1 = Infinity;
    let x2 = -Infinity;
    let y2 = -Infinity;
    for (const e of els) {
      const r = e.getBoundingClientRect();
      x1 = Math.min(x1, r.left);
      y1 = Math.min(y1, r.top);
      x2 = Math.max(x2, r.right);
      y2 = Math.max(y2, r.bottom);
    }
    // a little air around it, never past the window's edges
    const p = 6;
    x1 = Math.max(2, x1 - p);
    y1 = Math.max(2, y1 - p);
    x2 = Math.min(vw - 2, x2 + p);
    y2 = Math.min(vh - 2, y2 + p);
    // (cierre22) a page element that runs under the header, the bottom bar or the rail is lit only where it shows: the
    // ring stopped over the bottom bar on the phone, lighting part of it. Elements of the chrome itself are lit whole.
    if (!els.some((e) => e.closest('header.barra, nav.pestanas, nav.carril'))) {
      x1 = Math.max(x1, margenes.izq + 2);
      y1 = Math.max(y1, margenes.arriba + 2);
      y2 = Math.min(y2, vh - margenes.abajo - 2);
    }
    const n = { x: Math.round(x1), y: Math.round(y1), w: Math.round(Math.max(0, x2 - x1)), h: Math.round(Math.max(0, y2 - y1)) };
    if (!rect || n.x !== rect.x || n.y !== rect.y || n.w !== rect.w || n.h !== rect.h) rect = n.w > 0 && n.h > 0 ? n : null;
  }

  // follows the lit element while the page scrolls, reflows or the window turns
  $effect(() => {
    if (!def) return;
    let vivoBucle = true;
    const bucle = () => {
      if (!vivoBucle) return;
      medir();
      requestAnimationFrame(bucle);
    };
    requestAnimationFrame(bucle);
    return () => {
      vivoBucle = false;
    };
  });

  const compacto = $derived(vw < 600);
  const posicion = $derived.by(() => {
    const M = 16;
    const G = 14;
    const ancho = compacto ? vw - 2 * M - margenes.izq - margenes.der : Math.min(420, vw - 2 * M - margenes.izq - margenes.der);
    const h = altoTarjeta || 240;
    const arribaMin = M + margenes.arriba;
    const abajoMax = vh - M - margenes.abajo;
    const centroX = (r: NonNullable<typeof rect>) => Math.max(M + margenes.izq, Math.min(vw - M - margenes.der - ancho, r.x + r.w / 2 - ancho / 2));
    const r = rect;
    if (!r) return { left: Math.max(M + margenes.izq, (vw + margenes.izq - margenes.der - ancho) / 2), top: Math.max(arribaMin, (vh - h) / 2), ancho };
    const abajo = abajoMax - (r.y + r.h + G);
    const arriba = r.y - G - arribaMin;
    if (!compacto) {
      const der = vw - M - margenes.der - (r.x + r.w + G);
      const izq = r.x - G - M - margenes.izq;
      const topLado = Math.max(arribaMin, Math.min(abajoMax - h, r.y + r.h / 2 - h / 2));
      if (der >= ancho && r.h < vh * 0.7) return { left: r.x + r.w + G, top: topLado, ancho };
      if (izq >= ancho && r.h < vh * 0.7) return { left: r.x - G - ancho, top: topLado, ancho };
    }
    if (abajo >= h) return { left: centroX(r), top: r.y + r.h + G, ancho };
    if (arriba >= h) return { left: centroX(r), top: r.y - G - h, ancho };
    // no room on any side: over the edge of the page with more room (the lit element stays mostly visible)
    return { left: centroX(r), top: abajo >= arriba ? abajoMax - h : arribaMin, ancho };
  });

  // ---------------------------------------------------------------- each step
  $effect(() => {
    const p = paso;
    void recorridos.paso;
    if (!p) return;
    untrack(() => {
      hecho = false;
      p.preparar?.();
      inicioPaso = p.antes?.();
      void tick().then(() => {
        const els = objetivos();
        const e = els[0];
        if (e) {
          // into view: vertically when it is near an edge, sideways always (a tab of a row that scrolls)
          const r = e.getBoundingClientRect();
          const fuera = r.top < 60 || r.bottom > window.innerHeight - 60;
          e.scrollIntoView({ block: fuera ? 'center' : 'nearest', inline: 'nearest', behavior: reducido ? 'auto' : 'smooth' });
        }
        tarjeta?.focus({ preventScroll: true });
      });
    });
  });

  // done checks: polled, and a press of the lit element
  $effect(() => {
    const p = paso;
    if (!p || (!p.hecho && !p.pulsar)) return;
    const comprobar = () => {
      if (!hecho && p.hecho?.(inicioPaso)) hecho = true;
    };
    const t = setInterval(comprobar, 200);
    const pulsado = (ev: Event) => {
      if (!p.pulsar || hecho) return;
      if (ev instanceof KeyboardEvent && ev.key !== 'Enter' && ev.key !== ' ') return;
      const dentro = objetivos().some((e) => e.contains(ev.target as Node));
      if (dentro) hecho = true;
    };
    document.addEventListener('pointerup', pulsado, true);
    document.addEventListener('click', pulsado, true);
    document.addEventListener('keydown', pulsado, true);
    return () => {
      clearInterval(t);
      document.removeEventListener('pointerup', pulsado, true);
      document.removeEventListener('click', pulsado, true);
      document.removeEventListener('keydown', pulsado, true);
    };
  });

  // ---------------------------------------------------------------- the page under it: inert
  let host: HTMLElement | undefined = $state();
  const VIVOS_POR_SVELTE = '.principal, nav.pestanas, aside.lateral';

  $effect(() => {
    const abierto = !!oferta || !!def;
    if (!abierto || !host) return;
    void recorridos.paso;
    // (again once the lit element shows: a step's `preparar` may bring it on screen a moment after the step opens)
    void !!rect;
    const vivos = untrack(() => (oferta ? [] : accion ? objetivos() : []));
    const cambiados: HTMLElement[] = [];
    const poner = (e: Element) => {
      if (!(e instanceof HTMLElement) || e === host || e.inert || e.matches(VIVOS_POR_SVELTE)) return;
      if (vivos.some((v) => e.contains(v))) return;
      e.inert = true;
      cambiados.push(e);
    };
    if (!vivos.length) for (const e of document.body.children) poner(e);
    else {
      // every sibling of each ancestor of the lit element, up to <body>: only the lit element stays reachable
      const camino = new Set<Element>();
      for (const v of vivos) for (let a: Element | null = v; a && a !== document.body; a = a.parentElement) camino.add(a);
      for (const a of camino) for (const h of a.parentElement?.children ?? []) if (!camino.has(h)) poner(h);
    }
    return () => {
      for (const e of cambiados) e.inert = false;
    };
  });

  // Tab stays in the card (and the lit element of an action step); Esc is «Salir» / «Ahora no».
  function focusables(raiz: Element): HTMLElement[] {
    const sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';
    const lista = [...raiz.querySelectorAll<HTMLElement>(sel)];
    if (raiz instanceof HTMLElement || raiz instanceof SVGElement) {
      if ((raiz as HTMLElement).matches(sel)) lista.unshift(raiz as HTMLElement);
    }
    return lista.filter((e) => !e.closest('[inert]') && e.getClientRects().length > 0);
  }

  function teclas(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      if (oferta) ahoraNo();
      else salir();
      return;
    }
    if (ev.key !== 'Tab' || !tarjeta) return;
    const lista = [...focusables(tarjeta), ...(accion ? objetivos().flatMap((e) => focusables(e)) : [])];
    if (!lista.length) return;
    const i = lista.indexOf(document.activeElement as HTMLElement);
    ev.preventDefault();
    const n = ev.shiftKey ? (i <= 0 ? lista.length - 1 : i - 1) : i < 0 || i >= lista.length - 1 ? 0 : i + 1;
    lista[n]!.focus();
  }

  $effect(() => {
    if (!oferta && !def) return;
    document.addEventListener('keydown', teclas, true);
    return () => document.removeEventListener('keydown', teclas, true);
  });

  // the offer card takes the focus when it shows
  let cajaOferta: HTMLElement | undefined = $state();
  $effect(() => {
    if (!cajaOferta) return;
    const c = cajaOferta;
    void tick().then(() => c.focus({ preventScroll: true }));
  });

  const etiquetaPaso = $derived(def ? `${def.corto ? `${def.corto} · paso` : 'Paso'} ${recorridos.paso + 1} de ${total}` : '');
  // the four strips of veil around the lit element take the taps that miss it
  const tiras = $derived.by(() => {
    const r = rect;
    if (!r) return [{ left: 0, top: 0, width: vw, height: vh }];
    const l = [
      { left: 0, top: 0, width: vw, height: r.y },
      { left: 0, top: r.y + r.h, width: vw, height: Math.max(0, vh - r.y - r.h) },
      { left: 0, top: r.y, width: r.x, height: r.h },
      { left: r.x + r.w, top: r.y, width: Math.max(0, vw - r.x - r.w), height: r.h },
    ];
    // a step that is only read: the lit element takes no taps either
    if (!accion) l.push({ left: r.x, top: r.y, width: r.w, height: r.h });
    return l;
  });
</script>

<div class="recorrido-host" use:aCuerpo bind:this={host} data-recorrido-capa={def ? 'paso' : oferta ? 'oferta' : 'preparando'}>
  <div class="sonda" bind:this={sonda} aria-hidden="true"></div>

  {#if oferta}
    <div class="velo-oferta" aria-hidden="true"></div>
    <div
      class="tarjeta oferta"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recorrido-oferta-titulo"
      aria-describedby="recorrido-oferta-texto"
      tabindex="-1"
      bind:this={cajaOferta}
      data-recorrido-oferta={oferta.id}
    >
      <p class="etiqueta21">{oferta.oferta.antetitulo}</p>
      <h2 id="recorrido-oferta-titulo" class="titulo">{oferta.oferta.titulo}</h2>
      <p id="recorrido-oferta-texto" class="texto">{oferta.oferta.texto}{#if oferta.id !== 'app'} Puede repetirlo desde la Guía de uso.{/if}</p>
      <div class="botones-oferta">
        <button type="button" class="boton primario" onclick={aceptar}>{oferta.oferta.empezar}</button>
        <button type="button" class="boton fantasma" onclick={ahoraNo}>Ahora no</button>
      </div>
    </div>
  {:else if def && paso}
    {#each tiras as t, i (i)}
      <div class="tira" style:left="{t.left}px" style:top="{t.top}px" style:width="{t.width}px" style:height="{t.height}px" aria-hidden="true"></div>
    {/each}
    {#if rect}
      <div class="foco" class:suave={!reducido} style:left="{rect.x}px" style:top="{rect.y}px" style:width="{rect.w}px" style:height="{rect.h}px" aria-hidden="true" data-recorrido-foco></div>
    {:else}
      <div class="velo-oferta" aria-hidden="true"></div>
    {/if}
    <div
      class="tarjeta paso"
      class:suave={!reducido}
      role="dialog"
      aria-modal={accion ? 'false' : 'true'}
      aria-labelledby="recorrido-paso-titulo"
      aria-describedby="recorrido-paso-texto"
      tabindex="-1"
      bind:this={tarjeta}
      bind:clientHeight={altoTarjeta}
      style:left="{posicion.left}px"
      style:top="{posicion.top}px"
      style:width="{posicion.ancho}px"
      data-recorrido-tarjeta={def.id}
      data-paso={recorridos.paso + 1}
    >
      <div class="cabeza">
        <p class="etiqueta21 cuenta">{etiquetaPaso}</p>
        <button type="button" class="salir" onclick={salir}>Salir</button>
      </div>
      <h2 id="recorrido-paso-titulo" class="titulo">{paso.titulo}</h2>
      <p id="recorrido-paso-texto" class="texto">{paso.texto}</p>
      <p class="logrado" role="status">{#if accion && hecho}<span class="aviso21 bien">{paso.logrado ?? 'Hecho.'}</span>{/if}</p>
      <div class="puntos" aria-hidden="true">
        {#each def.pasos as _, i (i)}<span class:hecho={i < recorridos.paso} class:actual={i === recorridos.paso}></span>{/each}
      </div>
      <div class="botones">
        {#if recorridos.paso > 0}<button type="button" class="boton" onclick={anterior}>Anterior</button>{/if}
        <button type="button" class="boton primario" onclick={siguiente} disabled={accion && !hecho} aria-describedby={accion && !hecho ? 'recorrido-pendiente' : undefined}
          >{ultimo ? 'Terminar' : 'Siguiente'}</button
        >
        {#if accion && !hecho}<span id="recorrido-pendiente" class="solo-lector">Se activa al hacer lo que dice el paso.</span>{/if}
      </div>
    </div>
  {:else if preparando || errorInicio}
    <div class="velo-oferta" aria-hidden="true"></div>
    <div class="tarjeta espera" role="status">
      {#if errorInicio}
        <p class="texto">{errorInicio}</p>
        <div class="botones"><button type="button" class="boton" onclick={() => ((errorInicio = ''), salir())}>Cerrar</button></div>
      {:else}
        <p class="texto">Preparando el tutorial…</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .recorrido-host {
    --recorrido-velo: rgba(20, 24, 32, 0.55);
    position: fixed;
    inset: 0;
    z-index: 80;
    pointer-events: none;
    font-family: var(--sans);
    color: var(--v11-tinta);
  }
  :global(:root[data-tema='oscuro']) .recorrido-host {
    --recorrido-velo: rgba(8, 10, 14, 0.72);
  }
  :global(:root[data-tema='sepia']) .recorrido-host {
    --recorrido-velo: rgba(40, 30, 18, 0.5);
  }
  /* the safe areas, read by the script (env() is CSS only) */
  .sonda {
    position: fixed;
    visibility: hidden;
    padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
  }
  .velo-oferta {
    position: fixed;
    inset: 0;
    background: var(--recorrido-velo);
    pointer-events: auto;
  }
  .tira {
    position: fixed;
    pointer-events: auto;
  }
  .foco {
    position: fixed;
    border-radius: 16px;
    box-shadow:
      0 0 0 3px var(--a21),
      0 0 0 200vmax var(--recorrido-velo);
    pointer-events: none;
  }
  @media (prefers-reduced-motion: no-preference) {
    .foco.suave {
      transition:
        left 0.22s ease,
        top 0.22s ease,
        width 0.22s ease,
        height 0.22s ease;
    }
    .tarjeta.suave,
    .tarjeta.oferta {
      animation: entrar 0.18s ease-out;
    }
  }
  @keyframes entrar {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  .tarjeta {
    position: fixed;
    box-sizing: border-box;
    /* (cierre22: the reader's global .tarjeta, estilos/lectura.css, gave it a 1.6em margin, which moved the card 24 px
       off the place worked out for it, over the lit element and the bottom bar) */
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    padding: 20px;
    border: 1px solid var(--v11-linea);
    border-radius: 20px;
    background: var(--v11-fondo);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
    pointer-events: auto;
  }
  :global(:root[data-tema='oscuro']) .tarjeta {
    background: var(--v11-panel);
  }
  .tarjeta:focus {
    outline: none;
  }
  .tarjeta:focus-visible {
    outline: 2px solid var(--v11-foco);
    outline-offset: 2px;
  }
  .oferta,
  .espera {
    left: 50%;
    bottom: calc(24px + var(--hueco-inferior, 0px));
    width: min(440px, calc(100vw - 32px));
    transform: translateX(-50%);
    padding: 24px;
    border-radius: 24px;
    gap: 14px;
  }
  @media (max-width: 599px) {
    .oferta,
    .espera {
      left: calc(16px + env(safe-area-inset-left, 0px));
      right: calc(16px + env(safe-area-inset-right, 0px));
      width: auto;
      transform: none;
    }
  }
  .etiqueta21 {
    margin: 0;
  }
  .cabeza {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: -8px 0 -8px;
  }
  .cuenta {
    flex-grow: 1;
  }
  .salir {
    min-width: 48px;
    min-height: 48px;
    margin-right: -8px;
    padding: 0 8px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--v11-tinta-suave);
    font: 500 15px var(--sans);
    cursor: pointer;
  }
  .salir:hover {
    color: var(--v11-tinta);
  }
  .salir:focus-visible {
    outline: 2px solid var(--v11-foco);
  }
  .titulo {
    margin: 0;
    font-family: var(--v11-titular, 'Space Grotesk', sans-serif);
    font-size: 22px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--v11-tinta);
  }
  .oferta .titulo {
    font-size: 24px;
  }
  .texto {
    margin: 0;
    color: var(--v11-tinta-suave);
    font-size: 15px;
    line-height: 1.5;
  }
  .logrado {
    margin: 0;
  }
  .logrado:empty {
    display: none;
  }
  .logrado .aviso21 {
    display: block;
    margin: 0;
  }
  .puntos {
    display: flex;
    gap: 6px;
  }
  .puntos span {
    width: 8px;
    height: 8px;
    border-radius: 4px;
    background: var(--v11-linea);
  }
  .puntos span.hecho {
    background: var(--a21);
  }
  .puntos span.actual {
    width: 20px;
    background: var(--a21);
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }
  .botones .boton {
    min-height: 48px;
  }
  .botones-oferta {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }
  .botones-oferta .boton {
    width: 100%;
    min-height: 48px;
    justify-content: center;
  }
  @media (min-width: 600px) {
    .botones-oferta {
      flex-direction: row-reverse;
      justify-content: flex-start;
    }
    .botones-oferta .boton {
      width: auto;
    }
  }
</style>
