<script lang="ts">
  // The board drawn flat, seen from the top or the bottom, with per-layer toggles. Pan/zoom on demand: the
  // board is painted into a cached bitmap a bit larger than the window, so panning only blits it; a new
  // zoom repaints once the gesture stops. Tap/hover a pad, track, via, zone or part to select it.
  import { onMount, untrack } from 'svelte';
  import type { DatosPlaca } from './datos';
  import { formatoTension } from './datos';
  import { cajaHuella, cajaRed, impacto, type Geometria, type Impacto2D, type Lado } from './geometria';
  import { coloresTension, pintarLado, pintarRed, type Acabado, type Aspecto, type CapasVisibles } from './pintar';
  import { contornoPad } from './geometria';
  import type { Resuelta } from './seleccion';
  import { esquinasHuella } from './datos';

  let {
    datos,
    geo,
    res,
    oscuro,
    lado = $bindable('F'),
    aspecto = $bindable('real'),
    visibles = $bindable({ F: true, B: true, mascara: true, serigrafia: true, fab: false, areas: true }),
    tensiones = $bindable(false),
    acabado = 'hasl',
    enfocar = 0,
    alTocar,
  }: {
    datos: DatosPlaca;
    geo: Geometria;
    res: Resuelta;
    oscuro: boolean;
    lado?: Lado;
    aspecto?: Aspecto;
    visibles?: CapasVisibles;
    tensiones?: boolean;
    acabado?: Acabado;
    enfocar?: number;
    alTocar: (i: Impacto2D | null) => void;
  } = $props();

  let caja: HTMLDivElement | undefined = $state();
  let lienzo: HTMLCanvasElement | undefined = $state();
  let anchoCss = $state(0);
  let altoCss = $state(0);
  /** CSS px per u; offsets in CSS px of the board origin (top-left, or top-right when seen from below). */
  const v = { k: 0.05, ox: 0, oy: 0 };
  let raf = 0;
  let hover: Impacto2D | null = $state(null);
  /** Phone: look and layer buttons folded behind «Capas». */
  let abierta = $state(false);
  let punto = $state({ x: 0, y: 0 });

  // cached bitmap: board window [bx0, by0] at scale bk (CSS px per u), size in device px
  let base: HTMLCanvasElement | null = null;
  let bk = 0;
  let bx0 = 0;
  let by0 = 0;
  let bw = 0;
  let bh = 0;
  /** Board window of the cache, in u. */
  let bu = 0;
  let bv = 0;
  let sucia = true;
  let temporizador: ReturnType<typeof setTimeout> | null = null;

  const g = globalThis as unknown as { __epaPlaca2D?: { ms: number[]; base: number } };

  const colores = $derived(tensiones ? coloresTension(datos) : null);
  const tieneTensiones = $derived(datos.redes.some((r) => r.v));

  function espejo(): boolean {
    return lado === 'B';
  }

  /** Board u -> CSS px. */
  function aPantalla(x: number, y: number): [number, number] {
    return [v.ox + (espejo() ? geo.ancho - x : x) * v.k, v.oy + y * v.k];
  }

  function aPlaca(px: number, py: number): [number, number] {
    const x = (px - v.ox) / v.k;
    return [espejo() ? geo.ancho - x : x, (py - v.oy) / v.k];
  }

  export function pedir(repintar = false): void {
    if (repintar) sucia = true;
    if (!raf) raf = requestAnimationFrame(pintar);
  }

  function pintarBase(dpr: number): void {
    const t0 = performance.now();
    // window: the visible board area plus half a screen on each side
    const mx = anchoCss * 0.5;
    const my = altoCss * 0.5;
    const [ax, ay] = aPlaca(-mx, -my);
    const [cx, cy] = aPlaca(anchoCss + mx, altoCss + my);
    bx0 = Math.max(-200, Math.min(ax, cx));
    by0 = Math.max(-200, Math.min(ay, cy));
    const bx1 = Math.min(geo.ancho + 200, Math.max(ax, cx));
    const by1 = Math.min(geo.alto + 200, Math.max(ay, cy));
    bk = v.k;
    bu = bx1 - bx0;
    bv = by1 - by0;
    bw = Math.max(1, Math.ceil((bx1 - bx0) * bk * dpr));
    bh = Math.max(1, Math.ceil((by1 - by0) * bk * dpr));
    // keep the bitmap within a sane budget (about 3 screens)
    const tope = Math.max(4e6, anchoCss * altoCss * dpr * dpr * 3);
    if (bw * bh > tope) {
      const f = Math.sqrt(tope / (bw * bh));
      bw = Math.ceil(bw * f);
      bh = Math.ceil(bh * f);
    }
    base ??= document.createElement('canvas');
    if (base.width !== bw) base.width = bw;
    if (base.height !== bh) base.height = bh;
    const c = base.getContext('2d')!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, bw, bh);
    const sx = bw / (bx1 - bx0);
    const sy = bh / (by1 - by0);
    if (espejo()) c.setTransform(-sx, 0, 0, sy, bx1 * sx, -by0 * sy);
    else c.setTransform(sx, 0, 0, sy, -bx0 * sx, -by0 * sy);
    pintarLado(c, datos, geo, {
      lado,
      aspecto,
      acabado,
      visibles,
      mascara: datos.placa.mascara,
      red: res.red,
      colores,
      escala: sx,
      oscuro,
    });
    sucia = false;
    const st = (g.__epaPlaca2D ??= { ms: [], base: 0 });
    st.base = performance.now() - t0;
  }

  function pintar(): void {
    raf = 0;
    const cv = lienzo;
    if (!cv || anchoCss <= 0 || altoCss <= 0) return;
    const t0 = performance.now();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(anchoCss * dpr);
    const H = Math.round(altoCss * dpr);
    if (cv.width !== W) cv.width = W;
    if (cv.height !== H) cv.height = H;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    // repaint the cache when stale, when the zoom settled on a new scale or when the window left it
    const [ax, ay] = aPlaca(0, 0);
    const [cx2, cy2] = aPlaca(anchoCss, altoCss);
    const fuera =
      (Math.min(ax, cx2) < bx0 - 1 && bx0 > -199) ||
      (Math.max(ax, cx2) > bx0 + bu + 1 && bx0 + bu < geo.ancho + 199) ||
      (Math.min(ay, cy2) < by0 - 1 && by0 > -199) ||
      (Math.max(ay, cy2) > by0 + bv + 1 && by0 + bv < geo.alto + 199);
    if (sucia || !base || fuera) pintarBase(dpr);
    else if (Math.abs(bk - v.k) / v.k > 0.01) {
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        temporizador = null;
        pedir(true);
      }, 140);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = oscuro ? '#101418' : '#e9e6de';
    ctx.fillRect(0, 0, W, H);
    // blit the cache where its window lands now
    const [px0, py0] = aPantalla(espejo() ? bx0 + bu : bx0, by0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(base!, px0 * dpr, py0 * dpr, bu * v.k * dpr, bv * v.k * dpr);
    // hover net and selection, on top
    const s = v.k * dpr;
    if (espejo()) ctx.setTransform(-s, 0, 0, s, (v.ox + geo.ancho * v.k) * dpr, v.oy * dpr);
    else ctx.setTransform(s, 0, 0, s, v.ox * dpr, v.oy * dpr);
    const rojo = hover && 'red' in hover ? hover.red : null;
    if (rojo !== null && rojo >= 0 && rojo !== res.red) pintarRed(ctx, geo, rojo, { lado, aspecto, visibles }, 'rgba(255,176,46,0.55)');
    const linea = 1.6 / v.k;
    if (res.huella !== null) {
      const e = esquinasHuella(datos.huellas[res.huella]!);
      const m = 4 / v.k;
      ctx.save();
      ctx.strokeStyle = oscuro ? '#7fd0ff' : '#0b6bcb';
      ctx.lineWidth = linea * 1.4;
      ctx.setLineDash([7 / v.k, 4 / v.k]);
      const xs = e.map((p) => p[0]);
      const ys = e.map((p) => p[1]);
      // rotated body box, grown a little
      const cx = xs.reduce((a, b) => a + b) / 4;
      const cy = ys.reduce((a, b) => a + b) / 4;
      ctx.beginPath();
      e.forEach(([x, y], i) => {
        const dx = x - cx;
        const dy = y - cy;
        const l = Math.hypot(dx, dy) || 1;
        const X = x + (dx / l) * m;
        const Y = y + (dy / l) * m;
        if (i) ctx.lineTo(X, Y);
        else ctx.moveTo(X, Y);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    if (res.pad !== null) {
      const pts = contornoPad(datos.pads[res.pad]!, 3 / v.k);
      ctx.strokeStyle = oscuro ? '#ffffff' : '#111111';
      ctx.lineWidth = linea * 1.3;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
    }
    const st = (g.__epaPlaca2D ??= { ms: [], base: 0 });
    st.ms.push(performance.now() - t0);
    if (st.ms.length > 200) st.ms.splice(0, 100);
    (globalThis as unknown as { __epaPlacaVista?: unknown }).__epaPlacaVista = { ...v, lado, ancho: geo.ancho };
  }

  function limites(): void {
    const kmin = Math.min(anchoCss / geo.ancho, altoCss / geo.alto) * 0.4;
    v.k = Math.max(kmin, Math.min(1.2, v.k));
    const w = geo.ancho * v.k;
    const h = geo.alto * v.k;
    v.ox = Math.min(anchoCss * 0.85, Math.max(anchoCss * 0.15 - w, v.ox));
    v.oy = Math.min(altoCss * 0.85, Math.max(altoCss * 0.15 - h, v.oy));
  }

  export function ajustar(b?: [number, number, number, number] | null, kmax = 0.4): void {
    if (anchoCss <= 0) return;
    const [x0, y0, x1, y1] = b ?? [0, 0, geo.ancho, geo.alto];
    const m = b ? 600 : 300;
    const w = x1 - x0 + 2 * m;
    const h = y1 - y0 + 2 * m;
    v.k = Math.min(anchoCss / w, altoCss / h) * 0.96;
    if (b) v.k = Math.min(v.k, kmax);
    const cx = (x0 + x1) / 2;
    v.ox = anchoCss / 2 - (espejo() ? geo.ancho - cx : cx) * v.k;
    v.oy = altoCss / 2 - ((y0 + y1) / 2) * v.k;
    limites();
    pedir(true);
  }

  export function zoom(f: number, cx = anchoCss / 2, cy = altoCss / 2): void {
    const k0 = v.k;
    v.k *= f;
    limites();
    const r = v.k / k0;
    v.ox = cx - (cx - v.ox) * r;
    v.oy = cy - (cy - v.oy) * r;
    limites();
    pedir();
  }

  // ------------------------------------------------------------------ pointer

  const punteros = new Map<number, { x: number; y: number }>();
  let arrastre: { x: number; y: number; ox: number; oy: number; movido: boolean; tipo: string } | null = null;
  let pellizco: { d: number; cx: number; cy: number; k: number; ox: number; oy: number } | null = null;
  let ultimoToque = 0;

  function pos(ev: PointerEvent | WheelEvent | MouseEvent): { x: number; y: number } {
    const r = lienzo!.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function tocar(px: number, py: number, tol: number): Impacto2D | null {
    const [x, y] = aPlaca(px, py);
    return impacto(datos, geo, x, y, tol / v.k, lado, { F: visibles.F, B: visibles.B });
  }

  function abajo(ev: PointerEvent): void {
    lienzo?.setPointerCapture(ev.pointerId);
    const p = pos(ev);
    punteros.set(ev.pointerId, p);
    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()] as [{ x: number; y: number }, { x: number; y: number }];
      pellizco = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, k: v.k, ox: v.ox, oy: v.oy };
      arrastre = null;
    } else if (punteros.size === 1) {
      arrastre = { x: p.x, y: p.y, ox: v.ox, oy: v.oy, movido: false, tipo: ev.pointerType };
    }
  }

  function mover(ev: PointerEvent): void {
    const p = pos(ev);
    if (punteros.has(ev.pointerId)) punteros.set(ev.pointerId, p);
    if (pellizco && punteros.size === 2) {
      const [a, b] = [...punteros.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      v.k = pellizco.k * (d / Math.max(1, pellizco.d));
      limites();
      const r = v.k / pellizco.k;
      v.ox = cx - (pellizco.cx - pellizco.ox) * r;
      v.oy = cy - (pellizco.cy - pellizco.oy) * r;
      limites();
      pedir();
      return;
    }
    if (arrastre && punteros.has(ev.pointerId)) {
      const dx = p.x - arrastre.x;
      const dy = p.y - arrastre.y;
      if (!arrastre.movido && Math.hypot(dx, dy) > (arrastre.tipo === 'mouse' ? 3 : 8)) arrastre.movido = true;
      if (arrastre.movido) {
        v.ox = arrastre.ox + dx;
        v.oy = arrastre.oy + dy;
        limites();
        pedir();
      }
      return;
    }
    if (ev.pointerType === 'mouse') {
      const h = tocar(p.x, p.y, 4);
      const cambia = JSON.stringify(h) !== JSON.stringify(hover);
      hover = h;
      punto = p;
      if (cambia) pedir();
    }
  }

  function arriba(ev: PointerEvent): void {
    const p = pos(ev);
    const era = arrastre;
    punteros.delete(ev.pointerId);
    if (punteros.size < 2) pellizco = null;
    if (punteros.size === 0) arrastre = null;
    if (ev.type === 'pointercancel') return;
    if (era && !era.movido) {
      const ahora = performance.now();
      if (ev.pointerType !== 'mouse' && ahora - ultimoToque < 300) {
        zoom(2, p.x, p.y);
        ultimoToque = 0;
        return;
      }
      ultimoToque = ahora;
      alTocar(tocar(p.x, p.y, ev.pointerType === 'mouse' ? 4 : 12));
    }
  }

  function salir(): void {
    if (hover) {
      hover = null;
      pedir();
    }
  }

  function rueda(ev: WheelEvent): void {
    ev.preventDefault();
    const p = pos(ev);
    const unidad = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1;
    const dx = ev.deltaX * unidad;
    const dy = ev.deltaY * unidad;
    const trackpad = !ev.ctrlKey && ev.deltaMode === 0 && (dx !== 0 || Math.abs(dy) < 50) && !Number.isInteger(dy / 100);
    if (trackpad && !ev.shiftKey) {
      v.ox -= dx;
      v.oy -= dy;
      limites();
      pedir();
      return;
    }
    zoom(Math.exp(-dy * (ev.ctrlKey ? 0.012 : 0.0018)), p.x, p.y);
  }

  function teclas(ev: KeyboardEvent): void {
    const paso = 60;
    if (ev.key === '+' || ev.key === '=') zoom(1.4);
    else if (ev.key === '-') zoom(1 / 1.4);
    else if (ev.key === '0') ajustar();
    else if (ev.key === 'ArrowLeft') v.ox += paso;
    else if (ev.key === 'ArrowRight') v.ox -= paso;
    else if (ev.key === 'ArrowUp') v.oy += paso;
    else if (ev.key === 'ArrowDown') v.oy -= paso;
    else return;
    ev.preventDefault();
    limites();
    pedir();
  }

  // repaint the cache when what it shows changes
  $effect(() => {
    void datos;
    void lado;
    void aspecto;
    void acabado;
    void visibles.F;
    void visibles.B;
    void visibles.mascara;
    void visibles.serigrafia;
    void visibles.fab;
    void visibles.areas;
    void colores;
    void res.red;
    void oscuro;
    untrack(() => pedir(true));
  });
  $effect(() => {
    void res.huella;
    void res.pad;
    void anchoCss;
    void altoCss;
    untrack(() => pedir());
  });

  // new board or side: fit; new selection from outside: frame it
  let ladoPrevio: Lado | null = null;
  $effect(() => {
    void enfocar;
    void datos;
    const l = lado;
    const listo = anchoCss > 0;
    untrack(() => {
      if (!listo) return;
      if (ladoPrevio !== null && ladoPrevio !== l) {
        // keep the same board point in the centre when flipping the board
        const [cx, cy] = aPlaca(anchoCss / 2, altoCss / 2);
        ladoPrevio = l;
        void cy;
        v.ox = anchoCss / 2 - (l === 'B' ? geo.ancho - cx : cx) * v.k;
        pedir(true);
        return;
      }
      ladoPrevio = l;
      if (res.huella !== null && enfocar > 0) ajustar(cajaHuella(datos, res.huella), 0.25);
      else if (res.red !== null && enfocar > 0) ajustar(cajaRed(datos, res.red), 0.2);
      else ajustar();
    });
  });

  onMount(() => {
    const ro = new ResizeObserver((e) => {
      const r = e[0]?.contentRect;
      if (!r) return;
      const w0 = anchoCss;
      const h0 = altoCss;
      anchoCss = r.width;
      altoCss = r.height;
      if (w0 > 0 && r.width > 0) {
        v.ox += (r.width - w0) / 2;
        v.oy += (r.height - h0) / 2;
        limites();
      }
      pedir(true);
    });
    if (caja) ro.observe(caja);
    lienzo?.addEventListener('wheel', rueda, { passive: false });
    return () => {
      ro.disconnect();
      lienzo?.removeEventListener('wheel', rueda);
      if (raf) cancelAnimationFrame(raf);
      if (temporizador) clearTimeout(temporizador);
      raf = 0;
      if (base) {
        base.width = 0;
        base.height = 0;
        base = null;
      }
    };
  });

  function rotulo(h: Impacto2D): string {
    if (h.tipo === 'huella') {
      const x = datos.huellas[h.huella]!;
      return `${x.r} · ${x.v}`;
    }
    if (h.tipo === 'pad') {
      const p = datos.pads[h.pad]!;
      const x = datos.huellas[p[0]]!;
      const r = p[12] >= 0 ? datos.redes[p[12]]! : null;
      return `${x.r}.${p[1]}${p[13] ? ` (${p[13]})` : ''}${r ? ` · ${r.n}` : ''}${r?.v ? ` · ${formatoTension(r.v.v)}` : ''}`;
    }
    const r = h.red >= 0 ? datos.redes[h.red] : null;
    const que = h.tipo === 'via' ? 'Vía' : h.tipo === 'zona' ? 'Plano' : 'Pista';
    return `${que} · ${r ? r.n : 'sin red'}${r?.v ? ` · ${formatoTension(r.v.v)}` : ''}`;
  }
</script>

<div class="placa2d">
  <div class="barra" role="toolbar" aria-label="Opciones de la vista 2D">
    <div class="grupo" role="group" aria-label="Cara">
      <button type="button" aria-pressed={lado === 'F'} onclick={() => (lado = 'F')}>Cara superior</button>
      <button type="button" aria-pressed={lado === 'B'} onclick={() => (lado = 'B')}>Cara inferior</button>
    </div>
    <button type="button" class="mas" aria-expanded={abierta} onclick={() => (abierta = !abierta)}>{abierta ? 'Menos opciones' : 'Capas'}</button>
    <div class="grupo extra" class:abierta role="group" aria-label="Aspecto">
      <button type="button" aria-pressed={aspecto === 'real'} onclick={() => (aspecto = 'real')}>Real</button>
      <button type="button" aria-pressed={aspecto === 'capas'} onclick={() => (aspecto = 'capas')}>Capas</button>
    </div>
    <div class="grupo capas extra" class:abierta role="group" aria-label="Capas visibles">
      <button type="button" aria-pressed={visibles.F} onclick={() => (visibles.F = !visibles.F)}><i class="m cf"></i>Cobre sup.</button>
      <button type="button" aria-pressed={visibles.B} onclick={() => (visibles.B = !visibles.B)}><i class="m cb"></i>Cobre inf.</button>
      {#if aspecto === 'real'}
        <button type="button" aria-pressed={visibles.mascara} onclick={() => (visibles.mascara = !visibles.mascara)}><i class="m mk"></i>Máscara</button>
      {/if}
      <button type="button" aria-pressed={visibles.serigrafia} onclick={() => (visibles.serigrafia = !visibles.serigrafia)}><i class="m sk"></i>Serigrafía</button>
      <button type="button" aria-pressed={visibles.fab} onclick={() => (visibles.fab = !visibles.fab)}><i class="m fb"></i>Contornos</button>
      {#if geo.areas.length}
        <button type="button" aria-pressed={visibles.areas} onclick={() => (visibles.areas = !visibles.areas)}><i class="m ar"></i>Zonas sin cobre</button>
      {/if}
      {#if tieneTensiones}
        <button type="button" aria-pressed={tensiones} onclick={() => (tensiones = !tensiones)}><i class="m vt"></i>Tensiones</button>
      {/if}
    </div>
    <div class="grupo zoom" role="group" aria-label="Zoom">
      <button type="button" aria-label="Alejar" onclick={() => zoom(1 / 1.5)}>−</button>
      <button type="button" aria-label="Ajustar la placa" onclick={() => ajustar()}>Ajustar</button>
      <button type="button" aria-label="Acercar" onclick={() => zoom(1.5)}>+</button>
    </div>
  </div>
  <div class="marco" bind:this={caja}>
    <canvas
      bind:this={lienzo}
      tabindex="0"
      data-lado={lado}
      aria-label="Placa en 2D: arrastra para desplazar, rueda o pellizco para ampliar, toca un pad, una pista o un componente para seleccionarlo"
      onpointerdown={abajo}
      onpointermove={mover}
      onpointerup={arriba}
      onpointercancel={arriba}
      onpointerleave={salir}
      ondblclick={(ev) => zoom(ev.shiftKey ? 0.5 : 2, pos(ev).x, pos(ev).y)}
      onkeydown={teclas}
    ></canvas>
    {#if hover}
      <div class="globo" style:left={`${punto.x + 14}px`} style:top={`${punto.y + 14}px`}>{rotulo(hover)}</div>
    {/if}
    <div class="lado-marca" aria-hidden="true">{lado === 'F' ? 'Vista desde arriba' : 'Vista desde abajo (espejada)'}</div>
    {#if tensiones}
      <div class="leyenda-v" aria-label="Escala de tensiones">
        <span>−35 V</span><i></i><span>0</span><i class="p"></i><span>+35 V</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .placa2d {
    display: grid;
    grid-template-rows: auto 1fr;
    min-height: 0;
    height: 100%;
  }
  .barra {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    padding: 6px 0 8px;
  }
  .mas {
    display: none;
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--acento);
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  @media (max-width: 699px) {
    .mas {
      display: inline-flex;
      align-items: center;
    }
    .extra:not(.abierta) {
      display: none;
    }
  }
  .grupo {
    max-width: 100%;
    display: inline-flex;
    flex-wrap: wrap;
    gap: 2px;
    padding: 2px;
    border-radius: 10px;
    background: var(--superficie-2);
  }
  .grupo button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--tinta-suave);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .grupo button[aria-pressed='true'] {
    background: var(--superficie);
    color: var(--tinta);
    box-shadow: var(--sombra);
  }
  .capas button[aria-pressed='false'] .m {
    opacity: 0.25;
  }
  .m {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }
  .cf {
    background: #d23c3c;
  }
  .cb {
    background: #4a82d6;
  }
  .mk {
    background: #1d5a32;
  }
  .sk {
    background: #f3f3ec;
    box-shadow: inset 0 0 0 1px #999;
  }
  .fb {
    background: #a8a8a8;
  }
  .ar {
    background: repeating-linear-gradient(45deg, #888 0 2px, transparent 2px 5px);
  }
  .vt {
    background: linear-gradient(90deg, #3168c4, #969696, #d63027);
  }
  @media (pointer: coarse) {
    .grupo button {
      min-height: 44px;
    }
  }
  .marco {
    position: relative;
    min-height: 260px;
    overflow: hidden;
    border-radius: 12px;
    background: var(--superficie-2);
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: crosshair;
    outline: none;
  }
  canvas:focus-visible {
    box-shadow: inset 0 0 0 2px var(--acento);
  }
  .globo {
    position: absolute;
    z-index: 2;
    max-width: 320px;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(20, 22, 26, 0.92);
    color: #fff;
    font-size: 13px;
    pointer-events: none;
    white-space: nowrap;
  }
  .lado-marca {
    position: absolute;
    left: 10px;
    bottom: 8px;
    padding: 2px 8px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.45);
    color: #fff;
    font-size: 12px;
    pointer-events: none;
  }
  .leyenda-v {
    position: absolute;
    right: 10px;
    bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 12px;
    pointer-events: none;
  }
  .leyenda-v i {
    display: inline-block;
    width: 40px;
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(90deg, #3168c4, #969696);
  }
  .leyenda-v i.p {
    background: linear-gradient(90deg, #969696, #d63027);
  }
</style>
