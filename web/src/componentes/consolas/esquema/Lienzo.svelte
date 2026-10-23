<script lang="ts">
  // Pan/zoom canvas of one schematic sheet. Draws on demand (no animation loop): the KiCad drawing (tiles in
  // view, text strokes only when legible), the highlighted net and the selected symbol. Mouse: drag to pan,
  // wheel (or pinch on a trackpad) to zoom, double click to zoom in. Touch: one finger pans, two fingers pinch.
  import { onMount, untrack } from 'svelte';
  import type { CapaHoja } from '../datos';
  import { colores, dibujar, type Dibujo, type VistaEsquema } from './dibujo';
  import { cajaRed, cajaSimbolo, dibujarCaja, dibujarRed, impacto, type Impacto } from './capa';

  let {
    dibujo,
    capa,
    oscuro,
    acento,
    red = null,
    rojo = null,
    simbolo = null,
    enfocar = 0,
    alTocar,
    alPasar,
  }: {
    dibujo: Dibujo;
    capa: CapaHoja;
    oscuro: boolean;
    acento: string;
    /** Net highlighted (index). */
    red?: number | null;
    /** Net under the pointer (lighter highlight). */
    rojo?: number | null;
    simbolo?: string | null;
    /** Incremented by the parent to frame the selection again. */
    enfocar?: number;
    alTocar: (i: Impacto | null) => void;
    alPasar: (i: Impacto | null, x: number, y: number) => void;
  } = $props();

  let caja: HTMLDivElement | undefined = $state();
  let lienzo: HTMLCanvasElement | undefined = $state();
  let anchoCss = $state(0);
  let altoCss = $state(0);
  const v: VistaEsquema = { k: 0.01, ox: 0, oy: 0 };
  let raf = 0;
  let ajustado = false;
  void ajustado;

  const g = globalThis as unknown as { __epaEsquema?: { ms: number[]; teselas: number } };

  export function pedir(): void {
    if (!raf) raf = requestAnimationFrame(pintar);
  }

  function pintar(): void {
    raf = 0;
    const c = lienzo;
    if (!c || anchoCss <= 0 || altoCss <= 0) return;
    const t0 = performance.now();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(anchoCss * dpr);
    const H = Math.round(altoCss * dpr);
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const col = colores(oscuro, acento);
    const n = dibujar(ctx, dibujo, v, dpr, anchoCss, altoCss, col, red !== null);
    const s = v.k * dpr;
    ctx.setTransform(s, 0, 0, s, v.ox * dpr, v.oy * dpr);
    if (rojo !== null && rojo !== red) dibujarRed(ctx, capa, rojo, v.k, col.realce, col.realceSuave, false);
    if (red !== null) dibujarRed(ctx, capa, red, v.k, col.realce, col.realceSuave, true);
    if (simbolo) {
      const b = cajaSimbolo(capa, simbolo);
      if (b) dibujarCaja(ctx, b, v.k, col.seleccion);
    }
    // names of the child sheets (the KiCad text is too small on the root sheet when zoomed out)
    if (capa.subhojas.length && v.k * 127 < 9) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = '700 12px "Source Sans 3", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const sh of capa.subhojas) {
        const x = v.ox + (sh[2] + sh[4] / 2) * v.k;
        const y = v.oy + (sh[3] + sh[5] / 2) * v.k;
        const w = ctx.measureText(sh[1]).width + 12;
        ctx.fillStyle = col.papel;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(x - w / 2, y - 10, w, 20);
        ctx.globalAlpha = 1;
        ctx.fillStyle = col.roles[8]!;
        ctx.fillText(sh[1], x, y + 0.5);
      }
    }
    const st = (g.__epaEsquema ??= { ms: [], teselas: 0 });
    st.ms.push(performance.now() - t0);
    if (st.ms.length > 200) st.ms.splice(0, 100);
    st.teselas = n;
    // view for the end-to-end tests (tests/consolas.spec.ts): sheet units -> CSS pixels of the canvas
    (globalThis as unknown as { __epaEsquemaVista?: VistaEsquema }).__epaEsquemaVista = { ...v };
  }

  function limites(): void {
    const kmin = Math.min(anchoCss / dibujo.ancho, altoCss / dibujo.alto) * 0.5;
    const kmax = 0.6; // 60 CSS px per mm
    v.k = Math.max(kmin, Math.min(kmax, v.k));
    // keep part of the sheet on screen
    const w = dibujo.ancho * v.k;
    const h = dibujo.alto * v.k;
    v.ox = Math.min(anchoCss * 0.8, Math.max(anchoCss * 0.2 - w, v.ox));
    v.oy = Math.min(altoCss * 0.8, Math.max(altoCss * 0.2 - h, v.oy));
  }

  export function ajustar(b?: [number, number, number, number] | null, kmax = 0.12): void {
    if (anchoCss <= 0) return;
    const [x0, y0, x1, y1] = b ?? [0, 0, dibujo.ancho, dibujo.alto];
    const m = b ? 400 : 0;
    const w = x1 - x0 + 2 * m;
    const h = y1 - y0 + 2 * m;
    v.k = Math.min(anchoCss / w, altoCss / h) * 0.94;
    if (b) v.k = Math.min(v.k, kmax);
    v.ox = anchoCss / 2 - ((x0 + x1) / 2) * v.k;
    v.oy = altoCss / 2 - ((y0 + y1) / 2) * v.k;
    limites();
    pedir();
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

  function aHoja(x: number, y: number): [number, number] {
    return [(x - v.ox) / v.k, (y - v.oy) / v.k];
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
      const f = d / Math.max(1, pellizco.d);
      v.k = pellizco.k * f;
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
      const [x, y] = aHoja(p.x, p.y);
      alPasar(impacto(capa, x, y, 7 / v.k), p.x, p.y);
    }
  }

  function arriba(ev: PointerEvent): void {
    const p = pos(ev);
    const eraArrastre = arrastre;
    punteros.delete(ev.pointerId);
    if (punteros.size < 2) pellizco = null;
    if (punteros.size === 0) arrastre = null;
    if (ev.type === 'pointercancel') return;
    if (eraArrastre && !eraArrastre.movido) {
      const ahora = performance.now();
      if (ev.pointerType !== 'mouse' && ahora - ultimoToque < 300) {
        zoom(2, p.x, p.y);
        ultimoToque = 0;
        return;
      }
      ultimoToque = ahora;
      const [x, y] = aHoja(p.x, p.y);
      const tol = (ev.pointerType === 'mouse' ? 7 : 16) / v.k;
      alTocar(impacto(capa, x, y, tol));
    }
  }

  function salir(): void {
    alPasar(null, 0, 0);
  }

  function rueda(ev: WheelEvent): void {
    ev.preventDefault();
    const p = pos(ev);
    const unidad = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1;
    const dx = ev.deltaX * unidad;
    const dy = ev.deltaY * unidad;
    // Trackpad pinch arrives as ctrl+wheel; two-finger scroll (fractional or horizontal deltas) pans;
    // a mouse wheel (big integer steps) zooms.
    const trackpad = !ev.ctrlKey && ev.deltaMode === 0 && (dx !== 0 || Math.abs(dy) < 50) && !Number.isInteger(dy / 100);
    if (trackpad && !ev.shiftKey) {
      v.ox -= dx;
      v.oy -= dy;
      limites();
      pedir();
      return;
    }
    const f = Math.exp(-dy * (ev.ctrlKey ? 0.012 : 0.0018));
    zoom(f, p.x, p.y);
  }

  function dobleClic(ev: MouseEvent): void {
    const p = pos(ev);
    zoom(ev.shiftKey ? 0.5 : 2, p.x, p.y);
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

  // Redraw whenever an input changes.
  $effect(() => {
    void dibujo;
    void capa;
    void oscuro;
    void acento;
    void red;
    void rojo;
    void simbolo;
    void anchoCss;
    void altoCss;
    pedir();
  });

  // New sheet: fit it; new selection: frame it.
  $effect(() => {
    void enfocar;
    void dibujo;
    const listo = anchoCss > 0;
    untrack(() => {
      if (!listo) return;
      ajustado = true;
      if (simbolo) ajustar(cajaSimbolo(capa, simbolo), 0.1);
      else if (red !== null) ajustar(cajaRed(capa, red), 0.08);
      else ajustar();
    });
  });

  onMount(() => {
    const ro = new ResizeObserver((e) => {
      const r = e[0]?.contentRect;
      if (!r) return;
      const w0 = anchoCss;
      anchoCss = r.width;
      altoCss = r.height;
      if (w0 > 0 && r.width > 0) {
        // keep the centre when the box changes size
        v.ox += (r.width - w0) / 2;
        limites();
      }
    });
    if (caja) ro.observe(caja);
    lienzo?.addEventListener('wheel', rueda, { passive: false });
    return () => {
      ro.disconnect();
      lienzo?.removeEventListener('wheel', rueda);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
  });
</script>

<div class="lienzo" bind:this={caja}>
  <canvas
    bind:this={lienzo}
    tabindex="0"
    aria-label="Esquema: arrastra para desplazar, rueda o pellizco para ampliar, toca un hilo, un pin o una etiqueta para resaltar su red"
    onpointerdown={abajo}
    onpointermove={mover}
    onpointerup={arriba}
    onpointercancel={arriba}
    onpointerleave={salir}
    ondblclick={dobleClic}
    onkeydown={teclas}
  ></canvas>
</div>

<style>
  .lienzo {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: crosshair;
    outline: none;
  }
  canvas:focus-visible {
    box-shadow: inset 0 0 0 2px var(--acento);
  }
</style>
