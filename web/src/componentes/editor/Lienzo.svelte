<script lang="ts">
  // The editor's canvas: an SVG with grid, parts, wires, junction dots and loose ends, and every pointer
  // gesture (mouse, pen and touch through pointer events): place, select (tap, Shift, box), move (wires
  // stretch), draw wires (drag from a pin, or tap–tap with the wire tool), pan (empty space with a finger,
  // middle button, Space + drag, trackpad scroll) and zoom (wheel, Ctrl/⌘ + wheel, pinch). Long press = the
  // context menu (right click on a desktop). `touch-action: none` and preventDefault keep the browser from
  // zooming the page: only the drawing zooms.
  import { onMount, untrack } from 'svelte';
  import type { Editor } from './estado.svelte';
  import { clave } from './estado.svelte';
  import { cajaMundo, geometria, pinesMundo, S } from './geometria.ts';
  import { rotulo, ALTO, TAM } from './rotulos.ts';
  import { TIPO } from './catalogo.ts';
  import { limites } from './svg.ts';
  import { app } from '../../lib/estado.svelte';
  import type { Componente } from './tipos.ts';

  let {
    ed,
    alPropiedades,
    alMenu,
  }: {
    ed: Editor;
    /** Double click / double tap on a part: show its properties. */
    alPropiedades?: (id: string) => void;
    /** Context menu at a screen point (long press or right click), on a part/wire or on empty space. */
    alMenu?: (m: { x: number; y: number; id: string | null }) => void;
  } = $props();

  type P = [number, number];
  type Gesto =
    | { t: 'mover'; ids: string[]; ini: P; dx: number; dy: number; movido: boolean; puntos: Set<string>; desde: P }
    | { t: 'cable'; a: P; b: P; dir: 'h' | 'v' | null; movido: boolean; desde: P; enPin: boolean }
    | { t: 'caja'; a: P; b: P; sumar: boolean }
    | { t: 'pan'; desde: P; t0: P }
    | { t: 'colocar'; tipo: string; p: P };

  let caja: HTMLDivElement | undefined = $state();
  let ancho = $state(600);
  let alto = $state(400);
  /** Screen px per SVG unit, and the translation (screen px). */
  let z = $state(1.4);
  let tx = $state(40);
  let ty = $state(40);
  let gesto = $state<Gesto | null>(null);
  let hoverPin = $state<P | null>(null);
  /** Ghost of the part being placed (palette), world coordinates of its body centre. */
  let fantasma = $state<{ tipo: string; p: P } | null>(null);
  /** First point of a wire drawn tap by tap. */
  let pendiente = $state<P | null>(null);
  let cursor = $state<P | null>(null);
  let espacio = false;

  const unidad = $derived(z * S);
  const tactilFino = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

  // ---------------------------------------------------------------- coordinates

  function mundo(cx: number, cy: number): P {
    const r = caja!.getBoundingClientRect();
    return [(cx - r.left - tx) / unidad, (cy - r.top - ty) / unidad];
  }
  const rejilla = (p: P): P => [Math.round(p[0]), Math.round(p[1])];

  function radio(tipo: string): number {
    return (tipo === 'mouse' ? 10 : 20) / unidad;
  }

  // ---------------------------------------------------------------- hit testing

  function pinCerca(p: P, r: number, excluir?: Set<string>): { pt: P; dx: number; dy: number } | null {
    let mejor: { pt: P; dx: number; dy: number } | null = null;
    let d = r;
    for (const c of ed.doc.componentes) {
      if (excluir?.has(c.id)) continue;
      const b = cajaMundo(c);
      if (p[0] < b[0] - r || p[0] > b[2] + r || p[1] < b[1] - r || p[1] > b[3] + r) continue;
      for (const q of pinesMundo(c)) {
        const e = Math.hypot(q.x - p[0], q.y - p[1]);
        if (e < d) {
          d = e;
          mejor = { pt: [q.x, q.y], dx: q.dx, dy: q.dy };
        }
      }
    }
    return mejor;
  }

  function distSeg(p: P, w: [number, number, number, number]): { d: number; q: P } {
    const [x0, y0, x1, y1] = w;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - x0) * dx + (p[1] - y0) * dy) / L));
    const q: P = [x0 + dx * t, y0 + dy * t];
    return { d: Math.hypot(p[0] - q[0], p[1] - q[1]), q };
  }

  function cableEn(p: P, r: number): string | null {
    let mejor: string | null = null;
    let d = r;
    for (const w of ed.doc.cables) {
      const e = distSeg(p, w.p).d;
      if (e < d) {
        d = e;
        mejor = w.id;
      }
    }
    return mejor;
  }

  function componenteEn(p: P, m = 0.12): string | null {
    let mejor: string | null = null;
    let area = Infinity;
    for (const c of ed.doc.componentes) {
      const b = cajaMundo(c);
      if (p[0] >= b[0] - m && p[0] <= b[2] + m && p[1] >= b[1] - m && p[1] <= b[3] + m) {
        const a = (b[2] - b[0]) * (b[3] - b[1]);
        if (a < area) {
          area = a;
          mejor = c.id;
        }
      }
    }
    return mejor;
  }

  /** A wire end snaps to a pin, then to a wire end or onto a wire (T junction), then to the grid. */
  function enganche(p: P, r: number): { pt: P; conectado: boolean; dir?: 'h' | 'v' } {
    const pin = pinCerca(p, r);
    if (pin) return { pt: pin.pt, conectado: true, dir: pin.dx !== 0 ? 'h' : 'v' };
    let mejor: P | null = null;
    let d = r;
    for (const w of ed.doc.cables) {
      for (const q of [[w.p[0], w.p[1]], [w.p[2], w.p[3]]] as P[]) {
        const e = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (e < d) {
          d = e;
          mejor = q;
        }
      }
    }
    if (mejor) return { pt: mejor, conectado: true };
    for (const w of ed.doc.cables) {
      const s = distSeg(p, w.p);
      if (s.d < r * 0.8) {
        // Onto the wire, at the grid point along it.
        const g = rejilla(s.q);
        const h = Math.abs(w.p[1] - w.p[3]) < 1e-9;
        const v = Math.abs(w.p[0] - w.p[2]) < 1e-9;
        if (h) return { pt: [g[0], w.p[1]], conectado: true };
        if (v) return { pt: [w.p[0], g[1]], conectado: true };
      }
    }
    return { pt: rejilla(p), conectado: false };
  }

  function tramosL(a: P, b: P, dir: 'h' | 'v' | null): [number, number, number, number][] {
    const d = dir ?? (Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 'h' : 'v');
    if (a[0] === b[0] || a[1] === b[1]) return [[a[0], a[1], b[0], b[1]]];
    return d === 'h'
      ? [
          [a[0], a[1], b[0], a[1]],
          [b[0], a[1], b[0], b[1]],
        ]
      : [
          [a[0], a[1], a[0], b[1]],
          [a[0], b[1], b[0], b[1]],
        ];
  }

  // ---------------------------------------------------------------- pointer gestures

  const punteros = new Map<number, { x: number; y: number; tipo: string }>();
  let pinza: { d: number; z: number; c: P; t: P } | null = null;
  let pulsacion: ReturnType<typeof setTimeout> | null = null;
  let inicioToque: { x: number; y: number; id: number } | null = null;
  let ultimoToque = { t: 0, x: 0, y: 0 };

  function soltarPulsacion() {
    if (pulsacion) clearTimeout(pulsacion);
    pulsacion = null;
  }

  function rel(cx: number, cy: number): P {
    const r = caja!.getBoundingClientRect();
    return [cx - r.left, cy - r.top];
  }

  function abajo(ev: PointerEvent) {
    caja?.focus({ preventScroll: true });
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, tipo: ev.pointerType });
    try {
      (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    } catch {
      /* synthetic events */
    }
    if (punteros.size >= 2) {
      // Pinch: drop whatever one finger had started.
      soltarPulsacion();
      gesto = null;
      const [a, b] = [...punteros.values()];
      pinza = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1, z, c: rel((a!.x + b!.x) / 2, (a!.y + b!.y) / 2), t: [tx, ty] };
      return;
    }
    if (ev.pointerType === 'mouse' && ev.button === 2) return;
    const w = mundo(ev.clientX, ev.clientY);
    const r = radio(ev.pointerType);
    if ((ev.pointerType === 'mouse' && ev.button === 1) || espacio) {
      ev.preventDefault();
      gesto = { t: 'pan', desde: [ev.clientX, ev.clientY], t0: [tx, ty] };
      return;
    }
    const tocar = ev.pointerType !== 'mouse';
    inicioToque = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
    if (tocar) {
      pulsacion = setTimeout(() => {
        pulsacion = null;
        if (!inicioToque) return;
        const item = componenteEn(w) ?? cableEn(w, r);
        if (item) {
          gesto = null;
          if (!ed.sel.includes(item)) ed.sel = [item];
          alMenu?.({ x: inicioToque.x, y: inicioToque.y, id: item });
        } else {
          // Long press on empty space: box selection.
          gesto = { t: 'caja', a: w, b: w, sumar: false };
        }
      }, 480);
    }
    if (ed.herramienta === 'colocar' && ed.colocando) {
      gesto = { t: 'colocar', tipo: ed.colocando, p: w };
      fantasma = { tipo: ed.colocando, p: w };
      return;
    }
    if (ed.herramienta === 'cable') {
      const e = pendiente ? { pt: pendiente, conectado: true, dir: undefined } : enganche(w, r);
      gesto = { t: 'cable', a: e.pt, b: e.pt, dir: e.dir ?? null, movido: false, desde: [ev.clientX, ev.clientY], enPin: !!e.dir };
      return;
    }
    // Select tool: a pin starts a wire; a part or wire is selected and dragged; empty space pans (touch) or
    // draws a selection box (mouse).
    const pin = pinCerca(w, r);
    // The element under the pointer (a stroke or a label of a part) first, then the boxes.
    const comp = ((ev.target as Element | null)?.closest?.('[data-comp]') as SVGElement | null)?.dataset['comp'] ?? componenteEn(w);
    if (pin && !(comp && ed.sel.includes(comp) && Math.hypot(pin.pt[0] - w[0], pin.pt[1] - w[1]) > r * 0.6)) {
      gesto = { t: 'cable', a: pin.pt, b: pin.pt, dir: pin.dx !== 0 ? 'h' : 'v', movido: false, desde: [ev.clientX, ev.clientY], enPin: true };
      return;
    }
    const item = comp ?? cableEn(w, r);
    if (item) {
      if (ev.shiftKey || ev.ctrlKey || ev.metaKey) ed.sel = ed.sel.includes(item) ? ed.sel.filter((x) => x !== item) : [...ed.sel, item];
      else if (!ed.sel.includes(item)) ed.sel = [item];
      if (!ed.sel.includes(item)) return;
      const puntos = new Set<string>();
      const s = new Set(ed.sel);
      for (const c of ed.doc.componentes) if (s.has(c.id)) for (const p of pinesMundo(c)) puntos.add(clave(p.x, p.y));
      for (const x of ed.doc.cables)
        if (s.has(x.id)) {
          puntos.add(clave(x.p[0], x.p[1]));
          puntos.add(clave(x.p[2], x.p[3]));
        }
      gesto = { t: 'mover', ids: [...ed.sel], ini: w, dx: 0, dy: 0, movido: false, puntos, desde: [ev.clientX, ev.clientY] };
      return;
    }
    if (tocar) gesto = { t: 'pan', desde: [ev.clientX, ev.clientY], t0: [tx, ty] };
    else {
      const sumar = ev.shiftKey || ev.ctrlKey || ev.metaKey;
      if (!sumar) ed.sel = [];
      gesto = { t: 'caja', a: w, b: w, sumar };
    }
  }

  function mover(ev: PointerEvent) {
    const p = punteros.get(ev.pointerId);
    if (p) {
      p.x = ev.clientX;
      p.y = ev.clientY;
    }
    if (inicioToque && inicioToque.id === ev.pointerId && Math.hypot(ev.clientX - inicioToque.x, ev.clientY - inicioToque.y) > 8) soltarPulsacion();
    if (pinza && punteros.size >= 2) {
      const [a, b] = [...punteros.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1;
      const c = rel((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      const n = Math.min(6, Math.max(0.2, (pinza.z * d) / pinza.d));
      tx = c[0] - (pinza.c[0] - pinza.t[0]) * (n / pinza.z);
      ty = c[1] - (pinza.c[1] - pinza.t[1]) * (n / pinza.z);
      z = n;
      return;
    }
    const w = mundo(ev.clientX, ev.clientY);
    cursor = w;
    const g = gesto;
    if (!g) {
      if (ev.pointerType === 'mouse') {
        const pin = ed.herramienta !== 'colocar' ? pinCerca(w, radio('mouse')) : null;
        hoverPin = pin?.pt ?? (ed.herramienta === 'cable' ? enganche(w, radio('mouse')).pt : null);
        if (ed.herramienta === 'colocar' && ed.colocando) fantasma = { tipo: ed.colocando, p: w };
      }
      return;
    }
    switch (g.t) {
      case 'pan':
        tx = g.t0[0] + ev.clientX - g.desde[0];
        ty = g.t0[1] + ev.clientY - g.desde[1];
        break;
      case 'mover': {
        if (!g.movido && Math.hypot(ev.clientX - g.desde[0], ev.clientY - g.desde[1]) > 5) g.movido = true;
        if (!g.movido) break;
        const dx = Math.round(w[0] - g.ini[0]);
        const dy = Math.round(w[1] - g.ini[1]);
        if (dx !== g.dx || dy !== g.dy) {
          g.dx = dx;
          g.dy = dy;
        }
        break;
      }
      case 'cable': {
        if (!g.movido && Math.hypot(ev.clientX - g.desde[0], ev.clientY - g.desde[1]) > 6) g.movido = true;
        const e = enganche(w, radio(ev.pointerType));
        if (e.pt[0] !== g.b[0] || e.pt[1] !== g.b[1]) g.b = e.pt;
        if (!g.dir && Math.hypot(w[0] - g.a[0], w[1] - g.a[1]) > 0.6) g.dir = Math.abs(w[0] - g.a[0]) >= Math.abs(w[1] - g.a[1]) ? 'h' : 'v';
        hoverPin = e.conectado ? e.pt : null;
        break;
      }
      case 'caja':
        g.b = w;
        break;
      case 'colocar':
        g.p = w;
        fantasma = { tipo: g.tipo, p: w };
        break;
    }
  }

  function arriba(ev: PointerEvent) {
    const p = punteros.get(ev.pointerId);
    punteros.delete(ev.pointerId);
    soltarPulsacion();
    if (pinza) {
      if (punteros.size < 2) pinza = null;
      return;
    }
    const g = gesto;
    gesto = null;
    if (ev.type === 'pointercancel' || !g) return;
    const tocar = (p?.tipo ?? ev.pointerType) !== 'mouse';
    switch (g.t) {
      case 'mover':
        if (g.movido) ed.mover(g.ids, g.dx, g.dy);
        else dobleToque(ev, g.ids.length === 1 ? g.ids[0]! : null);
        break;
      case 'cable': {
        const r = radio(ev.pointerType);
        if (g.movido) {
          if (g.a[0] !== g.b[0] || g.a[1] !== g.b[1]) ed.anadirCables(tramosL(g.a, g.b, g.dir));
          pendiente = null;
        } else if (ed.herramienta === 'cable') {
          if (!pendiente) pendiente = g.a;
          else {
            const e = enganche(mundo(ev.clientX, ev.clientY), r);
            if (e.pt[0] !== pendiente[0] || e.pt[1] !== pendiente[1]) {
              ed.anadirCables(tramosL(pendiente, e.pt, null));
              pendiente = e.conectado ? null : e.pt;
            } else pendiente = null;
          }
        } else {
          // A tap on a pin with the select tool selects its part.
          const c = componenteEn(g.a, 0.3);
          if (c) ed.sel = [c];
          dobleToque(ev, c);
        }
        break;
      }
      case 'caja': {
        const ids = ed.enCaja(g.a[0], g.a[1], g.b[0], g.b[1]);
        if (Math.hypot(g.a[0] - g.b[0], g.a[1] - g.b[1]) * unidad < 4) {
          if (!g.sumar) ed.sel = [];
        } else ed.sel = g.sumar ? [...new Set([...ed.sel, ...ids])] : ids;
        break;
      }
      case 'pan':
        if (tocar && Math.hypot(ev.clientX - g.desde[0], ev.clientY - g.desde[1]) < 8) ed.sel = [];
        break;
      case 'colocar': {
        ed.colocar(g.tipo, g.p[0], g.p[1]);
        fantasma = null;
        if (!ev.shiftKey) {
          ed.herramienta = 'seleccionar';
          ed.colocando = null;
        }
        break;
      }
    }
  }

  function dobleToque(ev: PointerEvent, id: string | null) {
    const ahora = performance.now();
    const doble = ahora - ultimoToque.t < 380 && Math.hypot(ev.clientX - ultimoToque.x, ev.clientY - ultimoToque.y) < 24;
    ultimoToque = { t: doble ? 0 : ahora, x: ev.clientX, y: ev.clientY };
    if (doble && id) alPropiedades?.(id);
  }

  function menu(ev: MouseEvent) {
    ev.preventDefault();
    if (punteros.size) return;
    const w = mundo(ev.clientX, ev.clientY);
    const item = componenteEn(w) ?? cableEn(w, radio('mouse'));
    if (item && !ed.sel.includes(item)) ed.sel = [item];
    alMenu?.({ x: ev.clientX, y: ev.clientY, id: item });
  }

  function salir() {
    hoverPin = null;
    cursor = null;
    if (!gesto && fantasma && !arrastreDesdePaleta) fantasma = null;
  }

  // ---------------------------------------------------------------- wheel, keys, browser zoom

  function zoomEn(n: number, px = ancho / 2, py = alto / 2) {
    const z2 = Math.min(6, Math.max(0.2, n));
    tx = px - (px - tx) * (z2 / z);
    ty = py - (py - ty) * (z2 / z);
    z = z2;
  }

  // For the tests: the editor and the world → screen mapping.
  onMount(() => {
    const g = globalThis as unknown as { __epaEditor?: unknown };
    g.__epaEditor = {
      ed,
      pantalla: (x: number, y: number) => {
        const r = caja!.getBoundingClientRect();
        return [r.left + tx + x * unidad, r.top + ty + y * unidad];
      },
      zoom: () => z,
      ajustar: () => ajustar(),
      /** Screen point of the body centre of a part, by designator. */
      centroDe: (nombre: string) => {
        const c = ed.doc.componentes.find((x) => x.nombre === nombre);
        if (!c) return null;
        const b = geometria(c).cuerpo;
        const r = caja!.getBoundingClientRect();
        return [r.left + tx + (c.x + (b[0] + b[2]) / 2) * unidad, r.top + ty + (c.y + (b[1] + b[3]) / 2) * unidad];
      },
    };
    return () => {
      if ((g.__epaEditor as { ed?: unknown } | undefined)?.ed === ed) delete g.__epaEditor;
    };
  });

  onMount(() => {
    const el = caja!;
    // As in the 3D viewer: a plain wheel scrolls the page (the editor page is not full height, so the wheel is
    // never trapped); Ctrl/⌘ + wheel and the trackpad pinch (which arrives as ctrl+wheel) zoom the drawing;
    // Shift + wheel, and a sideways trackpad swipe (the page has no horizontal scroll), pan it horizontally.
    const rueda = (ev: WheelEvent) => {
      if (ev.ctrlKey || ev.metaKey) {
        ev.preventDefault();
        const [px, py] = rel(ev.clientX, ev.clientY);
        // Mouse wheel notches (lines, or large steps) zoom by a fixed ratio; a pinch by its own amount.
        const paso = ev.deltaMode !== 0 || Math.abs(ev.deltaY) >= 50;
        zoomEn(z * Math.exp(paso ? -Math.sign(ev.deltaY) * 0.18 : -ev.deltaY * 0.01), px, py);
      } else if (ev.shiftKey || Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) {
        ev.preventDefault();
        const d = (ev.deltaX || ev.deltaY) * (ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? ancho : 1);
        tx -= d;
      }
    };
    // Never let the browser pinch-zoom or scroll the page from inside the canvas (Android, iPadOS).
    const toque = (ev: TouchEvent) => {
      if (ev.cancelable) ev.preventDefault();
    };
    const gestoSafari = (ev: Event) => ev.preventDefault();
    el.addEventListener('wheel', rueda, { passive: false });
    el.addEventListener('touchstart', toque, { passive: false });
    el.addEventListener('touchmove', toque, { passive: false });
    el.addEventListener('gesturestart', gestoSafari);
    el.addEventListener('gesturechange', gestoSafari);
    const teclaAbajo = (ev: KeyboardEvent) => {
      if (ev.code === 'Space' && !(ev.target as HTMLElement).closest?.('input, textarea, select')) espacio = true;
    };
    const teclaArriba = (ev: KeyboardEvent) => {
      if (ev.code === 'Space') espacio = false;
    };
    window.addEventListener('keydown', teclaAbajo);
    window.addEventListener('keyup', teclaArriba);
    return () => {
      el.removeEventListener('wheel', rueda);
      el.removeEventListener('touchstart', toque);
      el.removeEventListener('touchmove', toque);
      el.removeEventListener('gesturestart', gestoSafari);
      el.removeEventListener('gesturechange', gestoSafari);
      window.removeEventListener('keydown', teclaAbajo);
      window.removeEventListener('keyup', teclaArriba);
    };
  });

  // ---------------------------------------------------------------- API for the page

  /** Fits the drawing in the view. */
  export function ajustar() {
    if (!ed.doc.componentes.length && !ed.doc.cables.length) {
      z = app.movil ? 1.1 : 1.4;
      tx = 2 * z * S;
      ty = 2 * z * S;
      return;
    }
    const [x0, y0, x1, y1] = limites(ed.doc);
    const w = (x1 - x0 + 2) * S;
    const h = (y1 - y0 + 2) * S;
    z = Math.min(2.4, Math.max(0.25, Math.min(ancho / w, alto / h)));
    tx = (ancho - (x1 - x0) * S * z) / 2 - x0 * S * z;
    ty = (alto - (y1 - y0) * S * z) / 2 - y0 * S * z;
  }

  export function zoom(f: number) {
    zoomEn(z * f);
  }

  export function nivelZoom(): number {
    return z;
  }

  /** Esc: drops the gesture in progress, the pending wire and the part being placed. */
  export function cancelar(): boolean {
    const habia = !!gesto || !!pendiente || !!fantasma || ed.herramienta === 'colocar';
    gesto = null;
    pendiente = null;
    fantasma = null;
    if (ed.herramienta === 'colocar') {
      ed.herramienta = 'seleccionar';
      ed.colocando = null;
    }
    return habia;
  }

  /** World point at the centre of the view (to place a part from the keyboard or the palette). */
  export function centro(): P {
    return [(ancho / 2 - tx) / unidad, (alto / 2 - ty) / unidad];
  }

  let arrastreDesdePaleta = false;
  /** A part dragged from the palette: ghost while over the canvas, placed when dropped on it. */
  export function arrastreExterno(tipo: string, cx: number, cy: number, fase: 'mover' | 'soltar' | 'cancelar'): boolean {
    const r = caja!.getBoundingClientRect();
    const dentro = cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
    arrastreDesdePaleta = fase === 'mover';
    if (fase === 'cancelar' || !dentro) {
      fantasma = null;
      return false;
    }
    const w = mundo(cx, cy);
    if (fase === 'mover') fantasma = { tipo, p: w };
    else {
      fantasma = null;
      ed.colocar(tipo, w[0], w[1]);
    }
    return true;
  }

  // First fit when the drawing arrives.
  let ajustado = false;
  $effect(() => {
    const listo = ancho > 0 && alto > 0;
    void ed.doc;
    if (listo && !ajustado) {
      ajustado = true;
      untrack(ajustar);
    }
  });
  export function reajustar() {
    ajustado = false;
    ajustar();
    ajustado = true;
  }

  // ---------------------------------------------------------------- what is drawn

  const seleccion = $derived(new Set(ed.sel));
  const moviendo = $derived(gesto?.t === 'mover' && gesto.movido ? gesto : null);
  const enMovimiento = $derived(moviendo ? new Set(moviendo.ids) : null);

  /** Wires being stretched by a move: their ends on moved pins follow (straightened on release). */
  const previa = $derived.by(() => {
    const m = new Map<string, [number, number, number, number]>();
    const g = moviendo;
    if (!g) return m;
    for (const w of ed.doc.cables) {
      if (enMovimiento!.has(w.id)) continue;
      const a = g.puntos.has(clave(w.p[0], w.p[1]));
      const b = g.puntos.has(clave(w.p[2], w.p[3]));
      if (a || b) m.set(w.id, [w.p[0] + (a ? g.dx : 0), w.p[1] + (a ? g.dy : 0), w.p[2] + (b ? g.dx : 0), w.p[3] + (b ? g.dy : 0)]);
    }
    return m;
  });

  const vistaMundo = $derived([-tx / unidad, -ty / unidad, ancho / unidad, alto / unidad] as const);
  const pasoRejilla = $derived(unidad < 9 ? 5 : 1);

  const cablePrevio = $derived.by(() => {
    const g = gesto;
    if (g?.t === 'cable' && (g.movido || ed.herramienta !== 'cable')) return g.movido ? tramosL(g.a, g.b, g.dir) : [];
    if (!g && pendiente && cursor) return tramosL(pendiente, enganche(cursor, radio('mouse')).pt, null);
    return [];
  });

  const compFantasma = $derived.by((): Componente | null => {
    const f = fantasma;
    if (!f) return null;
    const t = TIPO.get(f.tipo);
    if (!t) return null;
    const c: Componente = { id: 'fantasma', tipo: f.tipo, nombre: ed.nombreLibre(t.prefijo), x: 0, y: 0, o: t.o, campos: { ...t.inicial } };
    const g = geometria(c);
    c.x = Math.round(f.p[0] - (g.cuerpo[0] + g.cuerpo[2]) / 2);
    c.y = Math.round(f.p[1] - (g.cuerpo[1] + g.cuerpo[3]) / 2);
    return c;
  });

  const cajaSel = $derived(gesto?.t === 'caja' ? gesto : null);
  const n2 = (v: number) => Math.round(v * 100) / 100;
</script>

{#snippet simbolo(c: Componente)}
  {@const g = geometria(c)}
  <g transform={`translate(${n2(c.x * S)} ${n2(c.y * S)})`}>
    {#each g.trazos as t, i (i)}
      <path class="l" class:ft={t.relleno === 'tinta'} class:fb={t.relleno === 'fondo'} d={t.d} />
    {/each}
    {#each g.textos as t, i (i)}
      <text class="p" x={n2(t.x * S)} y={n2(t.y * S)} text-anchor={t.ancla} font-size={n2(t.tam * S)}>{t.s}</text>
    {/each}
  </g>
  {@const r = rotulo(c)}
  {#if r}
    {#each r.lineas as l, i (i)}
      <text class="t" class:red={c.tipo === 'ETQ'} x={n2(r.x * S)} y={n2((r.y + i * ALTO) * S)} text-anchor={r.ancla} font-size={n2(TAM * S)}
        >{l.base}{#if l.sub}<tspan font-size={n2(TAM * S * 0.72)} dy={n2(0.1 * S)}>{l.sub}</tspan>{/if}{#if l.resto}<tspan dy={l.sub ? n2(-0.1 * S) : undefined}
            >{l.resto}</tspan
          >{/if}</text
      >
    {/each}
  {/if}
{/snippet}

<div
  class="lienzo"
  class:cable={ed.herramienta === 'cable'}
  class:colocar={ed.herramienta === 'colocar'}
  bind:this={caja}
  bind:clientWidth={ancho}
  bind:clientHeight={alto}
  tabindex="-1"
  role="application"
  aria-label="Lienzo del esquema"
  data-zoom={z}
>
  <svg
    width={ancho}
    height={alto}
    onpointerdown={abajo}
    onpointermove={mover}
    onpointerup={arriba}
    onpointercancel={arriba}
    onpointerleave={salir}
    oncontextmenu={menu}
    role="presentation"
  >
    <defs>
      <pattern id="rejilla-ed" width={S * pasoRejilla} height={S * pasoRejilla} patternUnits="userSpaceOnUse">
        <circle cx="0" cy="0" r={Math.max(0.9, 1.2 / z)} class="punto-rejilla" />
        <circle cx={S * pasoRejilla} cy="0" r={Math.max(0.9, 1.2 / z)} class="punto-rejilla" />
        <circle cx="0" cy={S * pasoRejilla} r={Math.max(0.9, 1.2 / z)} class="punto-rejilla" />
        <circle cx={S * pasoRejilla} cy={S * pasoRejilla} r={Math.max(0.9, 1.2 / z)} class="punto-rejilla" />
      </pattern>
    </defs>
    <g transform={`translate(${tx} ${ty}) scale(${z})`}>
      <rect x={Math.floor(vistaMundo[0] - 1) * S} y={Math.floor(vistaMundo[1] - 1) * S} width={(vistaMundo[2] + 3) * S} height={(vistaMundo[3] + 3) * S} fill="url(#rejilla-ed)" />

      <!-- Wires -->
      {#each ed.doc.cables as w (w.id)}
        {@const p = previa.get(w.id) ?? w.p}
        {@const m = enMovimiento?.has(w.id) && moviendo ? moviendo : null}
        <line
          class="w"
          class:sel={seleccion.has(w.id)}
          data-cable={w.id}
          x1={(p[0] + (m?.dx ?? 0)) * S}
          y1={(p[1] + (m?.dy ?? 0)) * S}
          x2={(p[2] + (m?.dx ?? 0)) * S}
          y2={(p[3] + (m?.dy ?? 0)) * S}
        />
      {/each}

      <!-- Parts -->
      {#each ed.doc.componentes as c (c.id)}
        {@const m = enMovimiento?.has(c.id) && moviendo ? moviendo : null}
        <g class="comp" class:sel={seleccion.has(c.id)} data-comp={c.id} data-nombre={c.nombre} transform={m ? `translate(${m.dx * S} ${m.dy * S})` : undefined}>
          {@render simbolo(c)}
        </g>
      {/each}

      {#if !moviendo}
        {#each ed.con.uniones as u, i (i)}
          <circle class="ft union" cx={u[0] * S} cy={u[1] * S} r={0.1 * S} />
        {/each}
        {#each ed.con.sueltos as u, i (i)}
          <circle class="suelto" cx={u[0] * S} cy={u[1] * S} r={0.14 * S} />
        {/each}
      {/if}

      {#each cablePrevio as p, i (i)}
        <line class="w previo" x1={p[0] * S} y1={p[1] * S} x2={p[2] * S} y2={p[3] * S} />
      {/each}
      {#if pendiente}
        <circle class="pendiente" cx={pendiente[0] * S} cy={pendiente[1] * S} r={0.16 * S} />
      {/if}
      {#if hoverPin}
        <circle class="enganche" cx={hoverPin[0] * S} cy={hoverPin[1] * S} r={0.22 * S} />
      {/if}
      {#if compFantasma}
        <g class="comp fantasma">{@render simbolo(compFantasma)}</g>
      {/if}
      {#if cajaSel}
        <rect
          class="caja-sel"
          x={Math.min(cajaSel.a[0], cajaSel.b[0]) * S}
          y={Math.min(cajaSel.a[1], cajaSel.b[1]) * S}
          width={Math.abs(cajaSel.a[0] - cajaSel.b[0]) * S}
          height={Math.abs(cajaSel.a[1] - cajaSel.b[1]) * S}
        />
      {/if}
    </g>
  </svg>
  <p class="ayuda" aria-hidden="true">
    {#if tactilFino}Un dedo desplaza · dos dedos acercan · pulsación larga: menú{:else}Ctrl + rueda para acercar · Mayús + rueda desplaza · botón central o Espacio + arrastrar mueve la vista{/if}
  </p>
  {#if !ed.doc.componentes.length && !ed.doc.cables.length}
    <p class="vacio">
      {#if tactilFino}Toque un componente de la paleta y luego el lienzo para colocarlo; arrastre desde una patilla para dibujar un cable.{:else}Elija
        un componente en la paleta (o arrástrelo) y haga clic en el lienzo; arrastre desde una patilla para dibujar un cable.{/if}
    </p>
  {/if}
</div>

<style>
  .lienzo {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--superficie);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    outline: none;
    cursor: default;
  }
  .lienzo.cable,
  .lienzo.colocar {
    cursor: crosshair;
  }
  svg {
    display: block;
    touch-action: none;
  }
  .punto-rejilla {
    fill: var(--linea);
  }
  .l {
    fill: none;
    stroke: var(--titulos);
    stroke-width: 1.1;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ft {
    fill: var(--titulos);
  }
  .fb {
    fill: var(--superficie);
  }
  .p {
    fill: var(--tinta);
    font-family: var(--sans);
  }
  .t {
    fill: var(--tinta);
    font-family: var(--sans);
  }
  .t.red {
    fill: var(--acento);
    font-style: italic;
  }
  .w {
    stroke: var(--titulos);
    stroke-width: 1.1;
    stroke-linecap: square;
  }
  .w.sel {
    stroke: var(--c-importante);
    stroke-width: 2.2;
  }
  .comp.sel .l {
    stroke: var(--c-importante);
  }
  .comp.sel .ft {
    fill: var(--c-importante);
  }
  .comp.sel .t {
    fill: var(--c-importante);
  }
  .union {
    fill: var(--titulos);
  }
  .suelto {
    fill: none;
    stroke: var(--c-precaucion);
    stroke-width: 1;
    opacity: 0.8;
  }
  .previo {
    stroke: var(--acento);
    stroke-dasharray: 4 3;
  }
  .pendiente {
    fill: var(--acento);
  }
  .enganche {
    fill: none;
    stroke: var(--acento);
    stroke-width: 1.5;
  }
  .fantasma {
    opacity: 0.55;
    pointer-events: none;
  }
  .caja-sel {
    fill: color-mix(in srgb, var(--acento) 10%, transparent);
    stroke: var(--acento);
    stroke-width: 1;
    stroke-dasharray: 4 3;
  }
  .ayuda {
    position: absolute;
    left: 10px;
    bottom: 8px;
    max-width: calc(100% - 20px);
    margin: 0;
    padding: 2px 8px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--superficie) 80%, transparent);
    color: var(--tinta-tenue);
    font: 12px/1.35 var(--sans);
    pointer-events: none;
  }
  .vacio {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    max-width: min(420px, 86%);
    margin: 0;
    color: var(--tinta-tenue);
    font: 14.5px/1.45 var(--sans);
    text-align: center;
    pointer-events: none;
  }
</style>
