<script lang="ts">
  // 1.2 living circuit of a lesson card (CircuitoLeccion.svelte wraps its schematic drawing in it):
  //   - the current as particles along the drawing's current paths (`.flujo`: the current of their 0 V meter
  //     `data-medidor` in the solved netlist, else `data-i`, A, signed, else the widget's «corriente»), with the
  //     figuras-vivas engine (esquema/particulas.ts): constant density, speed on a log scale of the current (an absolute scale here: 0,1 A full speed, 10 µA the slowest), the
  //     direction the drawing gives a positive current; an AC source makes them swing back and forth;
  //   - the wires (`data-red="<netlist node>"`) coloured by their node's voltage (lib/leccion12/cc.ts solves the
  //     schematic's own netlist with the card's values; non-linear circuits: only the nodes known exactly), with a
  //     legend in volts and «Ver valores», which writes each node's voltage on the drawing (colour is never the only cue);
  //   - direct manipulation: every part (`data-pieza`) whose value a control of the card moves is a slider on the drawing
  //     (drag, or focus and arrows / Page Up/Down / Home / End; a tap opens − / + buttons), a switch toggles with a tap;
  //     the values are the control's own positions (lib/leccion12/manipular.ts), so the E series snap;
  //   - the particles go only along the wires (fix12): they are not drawn inside a part's body, on a label or a node
  //     dot, with a clear gap (zonasDelDibujo, particulas.ts ocultar) — they go in at one terminal, out at the other;
  //   - a prediction (`oculto`) shows neither speed nor voltages: the particles move at one neutral speed; an «averia»
  //     card whose fault is still hidden comes as `oculto` too (Leccion11.svelte, fix12);
  //   - «reducir movimiento»: no animation, still arrows along the paths;
  //   - performance: the loop runs only while the drawing is on screen and the page visible; it measures its frame
  //     interval and cost, and degrades (half the particles at 30 fps, then still arrows) on a slow device. The
  //     measures are on the element (data-vivo, data-vivo-nivel, data-vivo-fps, data-vivo-ms) for the tests.
  import { onMount, untrack, type Snippet } from 'svelte';
  import Minus from '@lucide/svelte/icons/minus';
  import Plus from '@lucide/svelte/icons/plus';
  import { distPolilinea, trayecto } from '../figuras-vivas/geometria';
  import type { Punto } from '../figuras-vivas/tipos';
  import type { Camino } from '../figuras-vivas/esquema/modelo.svelte';
  import { avanzarCon, dibujarCon, ocultar, posicionesVisibles, repartir, visibleCerca, type Zona } from '../figuras-vivas/esquema/particulas';
  import { movimiento, pagina } from '../figuras-vivas/carga.svelte';
  import { esLineal, nodosConocidos, puntosDeCamino, resolverCC } from '../../lib/leccion12/cc';
  import { colorTension, type Escala } from '../../lib/leccion12/identidad';
  import { extremoMando, pasoMando, pasosDeArrastre, pasosDeTecla, piezasManipulables } from '../../lib/leccion12/manipular';
  import { formatear, posicionMasCercana, type Valores } from '../../lib/leccion11/modelo';
  import { textoPlano } from '../../lib/leccion11/texto';
  import type { ContextoDibujo, DefinicionEsquema } from '../../lib/leccion11/esquemas/tipos';
  import type { Leccion11, Mando, WidgetCircuito } from '../../lib/leccion11/tipos';
  import { app } from '../../lib/estado.svelte';
  import { leerUnidades } from '../../lib/habla-matematicas';
  import { ariaNumero } from '../../lib/teoria-viva';

  let {
    leccion,
    widget,
    def,
    ctx,
    valores,
    oculto,
    manipular = true,
    alMover,
    children,
  }: {
    leccion: Leccion11;
    widget: WidgetCircuito;
    def: DefinicionEsquema;
    ctx: ContextoDibujo;
    valores: Valores;
    oculto: boolean;
    manipular?: boolean;
    alMover: (valor: string, x: number) => void;
    children: Snippet;
  } = $props();

  /** Current (A) of full particle speed; four decades below it is the slowest. */
  const IREF = 0.1;
  /** Seconds of one back-and-forth swing of an AC current (a slowed-down picture, not the real frequency). */
  const PERIODO_CA = 1.6;
  const DPR_MAX = 2;

  let caja: HTMLDivElement | undefined = $state();
  let lienzo: HTMLCanvasElement | undefined = $state();
  let svg: SVGSVGElement | null = null;
  let verValores = $state(false);
  let enPantalla = $state(true);
  /** 0 full, 1 lighter (half the particles, 30 fps), 2 still arrows. */
  let nivel = $state(0);
  let fps = $state(0);
  let costeMs = $state(0);

  const lineas = $derived.by(() => {
    try {
      return def.netlist(ctx, 'op');
    } catch {
      return [] as string[];
    }
  });
  /** An AC source (a sine): the current swings; the DC voltages mean nothing (not coloured). */
  /** The drawing shows an AC source (kit/FuenteCA.svelte marks itself `data-alterna`); read with the drawing. */
  let alternaDibujo = $state(false);
  const alterna = $derived(alternaDibujo || lineas.some((l) => /\bsin\s*\(/i.test(l)));
  /** A switching transient (a capacitor's or a coil's initial condition, a pulse): its DC point is not what is shown. */
  const conmutada = $derived(lineas.some((l) => /\b(pulse|pwl)\s*\(|\bic\s*=/i.test(l)));
  const solucion = $derived(!oculto && !alterna && !conmutada ? resolverCC(lineas) : null);
  const exacto = $derived(!!solucion);
  const tensiones = $derived.by((): Record<string, number> => {
    if (oculto || alterna || conmutada || !lineas.length) return {};
    return solucion ? solucion.nodos : nodosConocidos(lineas, {});
  });
  const refV = $derived(Math.max(1e-9, ...Object.values(tensiones).map((v) => Math.abs(v))));
  const vMin = $derived(Math.min(0, ...Object.values(tensiones)));
  const vMax = $derived(Math.max(0, ...Object.values(tensiones)));
  const hayColor = $derived(Object.keys(tensiones).length > 1 && refV > 1e-6);
  const corrienteWidget = $derived(widget.corriente ? (valores[widget.corriente] ?? 0) : 0);

  let escala = $state.raw<Escala>({ neg: '#2457d6', cero: '#7a8696', pos: '#b3261e' });
  function leerEscala() {
    if (!caja) return;
    const s = getComputedStyle(caja);
    const g = (n: string, d: string) => s.getPropertyValue(n).trim() || d;
    escala = { neg: g('--v11-tension-neg', escala.neg), cero: g('--v11-tension-cero', escala.cero), pos: g('--v11-tension-pos', escala.pos) };
  }
  const gradiente = $derived.by(() => {
    void app.tema;
    void tensiones;
    const n = 10;
    const paradas: string[] = [];
    for (let k = 0; k <= n; k++) {
      const v = vMin + ((vMax - vMin) * k) / n;
      paradas.push(`${colorTension(v, refV, escala)} ${(k * 10).toFixed(0)}%`);
    }
    return `linear-gradient(to right, ${paradas.join(', ')})`;
  });

  const fmtV = (v: number) => formatear({ unidad: 'V', cifras: 3, recortar: true } as Parameters<typeof formatear>[0], Math.abs(v) < 5e-10 ? 0 : v);

  // ---------------------------------------------------------------- the drawing's marks
  interface Etiqueta {
    nodo: string;
    x: number;
    y: number;
    texto: string;
  }
  interface Asa {
    pieza: string;
    mando: Mando;
    x: number;
    y: number;
    w: number;
    h: number;
  }
  let etiquetas = $state<Etiqueta[]>([]);
  let asas = $state<Asa[]>([]);
  let caminos: (Camino & { i: number | null; m: string | null })[] = [];
  let k = 1;
  let marco = { x: 0, y: 0, w: 0, h: 0 };
  let ctm: DOMMatrix | null = null;

  const manipulables = $derived(manipular && !!widget.mandos.length ? piezasManipulables(widget) : []);

  /** Reads the drawing again (after every change of values: Svelte has updated the SVG when effects run). */
  function leerDibujo() {
    if (!caja) return;
    svg = caja.querySelector('svg.e11');
    if (!svg) return;
    const ca = !!svg.querySelector('[data-alterna]');
    if (ca !== alternaDibujo) alternaDibujo = ca;
    const rc = caja.getBoundingClientRect();
    const rs = svg.getBoundingClientRect();
    marco = { x: rs.left - rc.left, y: rs.top - rc.top, w: rs.width, h: rs.height };
    const m = svg.getScreenCTM();
    ctm = m ? new DOMMatrix([m.a, m.b, m.c, m.d, m.e - rs.left, m.f - rs.top]) : null;
    k = m ? Math.hypot(m.a, m.b) || 1 : 1;
    // current paths
    const previos = new Map(caminos.map((c) => [c.clave.id, c.fase]));
    caminos = [];
    svg.querySelectorAll<SVGPathElement>('path.flujo').forEach((p, j) => {
      const d = p.getAttribute('d') ?? '';
      const pts = puntosDeCamino(d);
      if (pts.length < 2) return;
      const di = p.getAttribute('data-i');
      const dm = p.getAttribute('data-medidor');
      const id = `${j}:${d}`;
      caminos.push({ clave: { k: 'tramo', id }, tr: trayecto(pts), nodo: null, elemento: null, fase: previos.get(id) ?? -1, n: 0, paso: 0, i: di != null && di !== '' ? Number(di) : null, m: dm ? dm.toLowerCase() : null });
    });
    repartir(caminos, nivel >= 1 ? k / 2 : k);
    // fix12: the particles go only along the wires — not drawn inside a part's body, on a label or a node dot
    const f = firmaDibujo(svg, caminos);
    if (f !== firma) {
      firma = f;
      zonas = zonasDelDibujo(svg, caminos.map((c) => c.tr.pts));
    }
    for (const c of caminos) c.zonas = zonas;
    ocultar(caminos, k);
    // wires by voltage
    svg.querySelectorAll<SVGElement>('[data-red]').forEach((el) => {
      const nodo = (el.getAttribute('data-red') ?? '').toLowerCase();
      const v = tensiones[nodo];
      const c = hayColor && v != null ? colorTension(v, refV, escala) : '';
      if (el.tagName.toLowerCase() === 'circle') el.style.fill = c;
      else el.style.stroke = c;
      el.toggleAttribute('data-tension', !!c);
    });
    // the voltage labels: on the middle of each node's longest wire
    const mejores = new Map<string, { l: number; el: SVGGeometryElement }>();
    svg.querySelectorAll<SVGGeometryElement>('path[data-red]').forEach((el) => {
      const nodo = (el.getAttribute('data-red') ?? '').toLowerCase();
      if (!(nodo in tensiones) || !el.getTotalLength) return;
      const l = el.getTotalLength();
      if (l > (mejores.get(nodo)?.l ?? -1)) mejores.set(nodo, { l, el });
    });
    const et: Etiqueta[] = [];
    if (ctm && hayColor) {
      for (const [nodo, { l, el }] of mejores) {
        const p = el.getPointAtLength(l / 2);
        const q = ctm.transformPoint(new DOMPoint(p.x, p.y));
        let y = q.y + marco.y;
        for (const o of et) if (Math.abs(o.x - (q.x + marco.x)) < 46 && Math.abs(o.y - y) < 20) y += 20;
        et.push({ nodo, x: q.x + marco.x, y, texto: fmtV(tensiones[nodo]!) });
      }
    }
    etiquetas = et;
    // the touchable parts
    const as: Asa[] = [];
    if (ctm) {
      for (const { pieza, mando } of manipulables) {
        const el = svg.querySelector<SVGGraphicsElement>(`[data-pieza="${pieza}"]`);
        if (!el || !el.getBBox) continue;
        const b = el.getBBox();
        if (!(b.width + b.height > 0)) continue;
        const a = ctm.transformPoint(new DOMPoint(b.x, b.y));
        const z = ctm.transformPoint(new DOMPoint(b.x + b.width, b.y + b.height));
        let x = Math.min(a.x, z.x) + marco.x;
        let y = Math.min(a.y, z.y) + marco.y;
        let w = Math.abs(z.x - a.x);
        let h = Math.abs(z.y - a.y);
        // at least 44 × 44 CSS px (WCAG 2.5.8 asks 24; the app's own minimum is 44)
        if (w < 44) {
          x -= (44 - w) / 2;
          w = 44;
        }
        if (h < 44) {
          y -= (44 - h) / 2;
          h = 44;
        }
        as.push({ pieza, mando, x, y, w, h });
      }
    }
    asas = as;
    dimensionar();
    if (!animando()) pintarQuieto();
  }

  // ---------------------------------------------------------------- where particles are not drawn (fix12)
  /** The drawing's geometry the zones depend on (they are worked out again only when it changes). */
  let firma = '';
  let zonas: Zona[] = [];
  const GEOMETRIA = 'path, circle, rect, line, polyline, polygon, ellipse, text';
  const ATRIBUTOS = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'transform', 'class'];
  function firmaDibujo(s: SVGSVGElement, cs: readonly Camino[]): string {
    const partes: string[] = [s.getAttribute('viewBox') ?? '', s.style.getPropertyValue('--k'), String(cs.length)];
    s.querySelectorAll(GEOMETRIA).forEach((el) => {
      partes.push(el.tagName);
      for (const a of ATRIBUTOS) partes.push(el.getAttribute(a) ?? '');
      if (el.tagName.toLowerCase() === 'text') partes.push(el.textContent ?? '');
    });
    // (a transformed group: espejo's mirrored transistor)
    s.querySelectorAll('g[transform]').forEach((g) => partes.push(g.getAttribute('transform') ?? ''));
    s.querySelectorAll('[data-cuerpo]').forEach((g) => partes.push(g.getAttribute('data-cuerpo') ?? ''));
    return partes.join('|');
  }

  /**
   * The zones of a lesson schematic (SVG units): every body the kit declares (`data-cuerpo`); every label's box; every small closed shape's box (a node dot, a
   * terminal, a diode's triangle, a source's circle, a transistor's body); and the «ink» of every symbol — points of
   * its outline more than 1,2 units away from the wires that carry the current (a resistor's zigzag, a capacitor's or
   * a battery's plates, a coil's turns; its leads lie on those wires and stay free).
   */
  function zonasDelDibujo(s: SVGSVGElement, flujos: Punto[][]): Zona[] {
    const pantalla = s.getScreenCTM();
    if (!pantalla) return [];
    // (getScreenCTM gives an SVGMatrix, without transformPoint: as DOMMatrix)
    const inv = DOMMatrix.fromMatrix(pantalla).inverse();
    const out: Zona[] = [];
    const libre = (x: number, y: number) => flujos.some((f) => distPolilinea(x, y, f) <= 1.2);
    // the bodies the kit declares (data-cuerpo «x0 y0 x1 y1»: a resistor's zigzag, a coil's turns, a switch's blade…)
    s.querySelectorAll<SVGGraphicsElement>('[data-cuerpo]').forEach((el) => {
      const n = (el.getAttribute('data-cuerpo') ?? '').trim().split(/\s+/).map(Number);
      const m = el.getScreenCTM();
      if (n.length !== 4 || !n.every(Number.isFinite) || !m) return;
      const M = inv.multiply(DOMMatrix.fromMatrix(m));
      const a = M.transformPoint(new DOMPoint(n[0], n[1]));
      const b = M.transformPoint(new DOMPoint(n[2], n[3]));
      out.push([Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)]);
    });
    s.querySelectorAll<SVGGraphicsElement>(GEOMETRIA).forEach((el) => {
      if (el.matches('.flujo, .brillo')) return;
      const m = el.getScreenCTM();
      if (!m || !el.getBBox) return;
      const M = inv.multiply(DOMMatrix.fromMatrix(m));
      const b = el.getBBox();
      const esquinas = [
        M.transformPoint(new DOMPoint(b.x, b.y)),
        M.transformPoint(new DOMPoint(b.x + b.width, b.y + b.height)),
        M.transformPoint(new DOMPoint(b.x + b.width, b.y)),
        M.transformPoint(new DOMPoint(b.x, b.y + b.height)),
      ];
      const caja: Zona = [
        Math.min(...esquinas.map((p) => p.x)),
        Math.min(...esquinas.map((p) => p.y)),
        Math.max(...esquinas.map((p) => p.x)),
        Math.max(...esquinas.map((p) => p.y)),
      ];
      const etiqueta = el.tagName.toLowerCase() === 'text';
      if (etiqueta) {
        if (b.width > 0 && b.height > 0) out.push(caja);
        return;
      }
      const tag = el.tagName.toLowerCase();
      const cerrada = tag === 'circle' || tag === 'ellipse' || tag === 'rect' || tag === 'polygon' || (tag === 'path' && /z/i.test(el.getAttribute('d') ?? ''));
      // (a small closed shape is solid for the particles; a big frame — norton's dashed box — is only its outline)
      if (cerrada && Math.max(caja[2] - caja[0], caja[3] - caja[1]) <= 50) out.push(caja);
      if (!(el instanceof SVGGeometryElement)) return;
      const L = el.getTotalLength();
      if (!(L > 0)) return;
      const n = Math.min(600, Math.ceil(L / 1.5));
      for (let i = 0; i <= n; i++) {
        const p = M.transformPoint(el.getPointAtLength((L * i) / n));
        if (!libre(p.x, p.y)) out.push([p.x, p.y, p.x, p.y]);
      }
    });
    return out;
  }

  function dimensionar() {
    if (!lienzo) return;
    const dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1);
    lienzo.style.left = `${marco.x}px`;
    lienzo.style.top = `${marco.y}px`;
    lienzo.style.width = `${marco.w}px`;
    lienzo.style.height = `${marco.h}px`;
    const W = Math.max(1, Math.round(marco.w * dpr));
    const H = Math.max(1, Math.round(marco.h * dpr));
    if (lienzo.width !== W) lienzo.width = W;
    if (lienzo.height !== H) lienzo.height = H;
  }

  // ---------------------------------------------------------------- particles
  let tiempo = 0;
  /** A path's current: its 0 V meter in the solved netlist, else its own `data-i`, else the widget's «corriente». */
  function deCamino(c: Camino & { i: number | null; m: string | null }): number {
    const s = c.m ? solucion?.corrientes[c.m] : undefined;
    return s ?? c.i ?? corrienteWidget;
  }
  function corriente(c: Camino & { i: number | null; m: string | null }): number {
    const i = deCamino(c);
    if (oculto) return i ? Math.sign(i) * IREF * 1e-2 : 0;
    if (alterna) return Math.abs(i) * Math.cos((2 * Math.PI * tiempo) / PERIODO_CA);
    return i;
  }

  function preparar(g: CanvasRenderingContext2D): boolean {
    if (!lienzo || !ctm) return false;
    const dpr = lienzo.width / Math.max(1, marco.w);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, lienzo.width, lienzo.height);
    g.setTransform(dpr * ctm.a, dpr * ctm.b, dpr * ctm.c, dpr * ctm.d, dpr * ctm.e, dpr * ctm.f);
    return true;
  }

  /** Still picture: arrows along each path in the direction of its current (reduced motion, or a slow device). */
  function pintarQuieto() {
    const g = lienzo?.getContext('2d');
    if (!g || !preparar(g)) return;
    g.lineWidth = 2.6 / k;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = getComputedStyle(lienzo!).getPropertyValue('--v11-naranja').trim() || '#d9661c';
    for (const c of caminos) {
      const i = deCamino(c);
      if (!i && !oculto) continue;
      const s = alterna ? 1 : Math.sign(i || 1);
      // (fix12: an arrow that would fall on a part's body, a label or a node dot moves to the nearest free wire)
      for (const f of [1 / 6, 1 / 2, 5 / 6]) {
        // (8: the arrow's 7-unit length and its line's half width, either way: an AC arrow points both ways)
        const x = visibleCerca(c, f * c.tr.largo, 8);
        if (x != null) flecha(g, c, x, s, alterna);
      }
    }
  }

  function flecha(g: CanvasRenderingContext2D, c: Camino, s: number, sentido: number, doble: boolean) {
    const { pts, acum } = c.tr;
    let j = 1;
    while (j < pts.length - 1 && acum[j]! < s) j++;
    const a = pts[j - 1]!;
    const b = pts[j]!;
    const l = acum[j]! - acum[j - 1]! || 1;
    const u = (s - acum[j - 1]!) / l;
    const x = a[0] + (b[0] - a[0]) * u;
    const y = a[1] + (b[1] - a[1]) * u;
    const dx = ((b[0] - a[0]) / l) * sentido;
    const dy = ((b[1] - a[1]) / l) * sentido;
    const t = 7;
    const punta = (sx: number, sy: number) => {
      g.beginPath();
      g.moveTo(x - sx * t - sy * t * 0.7, y - sy * t + sx * t * 0.7);
      g.lineTo(x, y);
      g.lineTo(x - sx * t + sy * t * 0.7, y - sy * t - sx * t * 0.7);
      g.stroke();
    };
    punta(dx, dy);
    if (doble) punta(-dx, -dy);
  }

  const animando = () => !movimiento.reducido && nivel < 2 && enPantalla && pagina.visible && caminos.length > 0;

  let raf = 0;
  let previo = 0;
  let saltar = false;
  const intervalos: number[] = [];
  const costes: number[] = [];
  let lentos = 0;

  function cuadro(t: number) {
    raf = 0;
    if (!animando()) {
      pintarQuieto();
      return;
    }
    raf = requestAnimationFrame(cuadro);
    if (nivel >= 1 && (saltar = !saltar)) return;
    const dt = previo ? Math.min(0.1, (t - previo) / 1000) : 0;
    if (previo) intervalos.push(t - previo);
    previo = t;
    tiempo += dt;
    const t0 = performance.now();
    avanzarCon(caminos, corriente, IREF, 1, dt, k);
    const g = lienzo?.getContext('2d');
    if (g && preparar(g)) dibujarCon(g, caminos, corriente, IREF, k, null, false);
    costes.push(performance.now() - t0);
    if (intervalos.length >= 60) medir();
  }

  /** Every 60 frames: the mean interval and cost; two slow windows in a row lower the level. */
  function medir() {
    const media = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
    const coste = costes.reduce((a, b) => a + b, 0) / Math.max(1, costes.length);
    fps = Math.round(1000 / media);
    costeMs = Math.round(coste * 10) / 10;
    intervalos.length = 0;
    costes.length = 0;
    // slow: under ~30 fps (at level 1, which draws every other frame, under ~15), or the drawing itself over 12 ms
    const lento = (nivel === 0 ? media > 34 : media > 68) || coste > 12;
    lentos = lento ? lentos + 1 : 0;
    if (lentos >= 2 && nivel < 2) {
      nivel++;
      lentos = 0;
      if (nivel === 1) repartir(caminos, k / 2);
    }
  }

  function arrancar() {
    if (raf || !animando()) {
      if (!animando()) pintarQuieto();
      return;
    }
    previo = 0;
    raf = requestAnimationFrame(cuadro);
  }

  $effect(() => {
    // after every change of what the drawing shows (values, a prediction checked, the theme)
    void valores;
    void oculto;
    void app.tema;
    void manipulables;
    untrack(() => {
      leerEscala();
      leerDibujo();
      arrancar();
    });
  });

  $effect(() => {
    // the loop follows reduced motion, visibility and the level
    void movimiento.reducido;
    void pagina.visible;
    void enPantalla;
    void nivel;
    untrack(arrancar);
  });

  onMount(() => {
    // (for the tests: where the particles drawn now are, in the drawing's units)
    if (caja) Object.defineProperty(caja, '__epaParticulas', { configurable: true, value: () => posicionesVisibles(caminos) });
    // (and how many there are, the hidden ones included)
    if (caja) Object.defineProperty(caja, '__epaParticulasTodas', { configurable: true, value: () => caminos.reduce((s, c) => s + c.n, 0) });
    const ro = new ResizeObserver(() => leerDibujo());
    if (caja) ro.observe(caja);
    const io = new IntersectionObserver((es) => (enPantalla = es.some((e) => e.isIntersecting)));
    if (caja) io.observe(caja);
    return () => {
      ro.disconnect();
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
  });

  // ---------------------------------------------------------------- direct manipulation
  let abierta = $state<string | null>(null);
  let arrastre: { pieza: string; x: number; y: number; v0: number; movido: boolean } | null = null;
  let arrastrando = $state<string | null>(null);

  const mag = (id: string) => leccion.modelo.valores[id] ?? leccion.modelo.calculos[id];
  const nombre = (m: Mando) => textoPlano(m.rotulo ?? mag(m.valor)?.sim) || m.valor;
  const texto = (m: Mando) => formatear(mag(m.valor) ?? null, valores[m.valor]);
  /** What a screen reader says, as the control below says it (units in words; a named position first). */
  const hablado = (m: Mando) => {
    const t = leerUnidades(texto(m));
    const nom = m.nombres?.[posicionMasCercana(m.valores, valores[m.valor] ?? 0)];
    return nom ? `${nom} (${t})` : t;
  };

  function mover(m: Mando, x: number) {
    if (x !== valores[m.valor]) alMover(m.valor, x);
  }

  function alternar(m: Mando) {
    const v = valores[m.valor] ?? 0;
    if (m.tipo === 'conectar') mover(m, v === 0 ? 1 : 0);
    else mover(m, v !== 0 ? 0 : 1);
  }

  function abajo(ev: PointerEvent, a: Asa) {
    if (a.mando.tipo !== 'deslizador') return;
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    arrastre = { pieza: a.pieza, x: ev.clientX, y: ev.clientY, v0: valores[a.mando.valor] ?? 0, movido: false };
  }
  function moverPuntero(ev: PointerEvent, a: Asa) {
    if (!arrastre || arrastre.pieza !== a.pieza) return;
    const dx = ev.clientX - arrastre.x;
    const dy = ev.clientY - arrastre.y;
    if (!arrastre.movido && Math.hypot(dx, dy) < 6) return;
    arrastre.movido = true;
    arrastrando = a.pieza;
    abierta = null;
    ev.preventDefault();
    mover(a.mando, pasoMando(a.mando, arrastre.v0, pasosDeArrastre(a.mando, dx, dy)));
  }
  function arriba(_ev: PointerEvent, a: Asa) {
    if (!arrastre || arrastre.pieza !== a.pieza) return;
    const tap = !arrastre.movido;
    arrastre = null;
    arrastrando = null;
    if (tap) abierta = abierta === a.pieza ? null : a.pieza;
  }
  function tecla(ev: KeyboardEvent, a: Asa) {
    const m = a.mando;
    if (m.tipo !== 'deslizador') return;
    if (ev.key === 'Escape' && abierta) {
      abierta = null;
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    const p = pasosDeTecla(m, ev.key);
    if (p == null) return;
    ev.preventDefault();
    ev.stopPropagation();
    const v = valores[m.valor] ?? 0;
    mover(m, p === 'inicio' ? extremoMando(m, false) : p === 'fin' ? extremoMando(m, true) : pasoMando(m, v, p));
  }
  const colorDe = (pieza: string) => def.piezas[pieza]?.color ?? 'azul';
</script>

<div
  class="vivo"
  bind:this={caja}
  data-vivo={movimiento.reducido || nivel >= 2 ? 'quieto' : 'animado'}
  data-vivo-nivel={nivel}
  data-vivo-fps={fps || undefined}
  data-vivo-ms={costeMs || undefined}
  data-vivo-tensiones={hayColor ? (exacto ? 'exactas' : 'conocidas') : 'no'}
  data-vivo-lineal={esLineal(lineas) ? 'si' : 'no'}
>
  {@render children()}
  <canvas bind:this={lienzo} class="lienzo" aria-hidden="true"></canvas>
  {#if verValores && hayColor}
    {#each etiquetas as e (e.nodo)}
      <span class="tension" style:left={`${e.x}px`} style:top={`${e.y}px`} data-tension-nodo={e.nodo} aria-hidden="true">{e.texto}</span>
    {/each}
  {/if}
  {#each asas as a (a.pieza)}
    {@const m = a.mando}
    {#if m.tipo === 'deslizador'}
      <div
        class={`asa ${colorDe(a.pieza)}`}
        class:activa={arrastrando === a.pieza || abierta === a.pieza}
        style:left={`${a.x}px`}
        style:top={`${a.y}px`}
        style:width={`${a.w}px`}
        style:height={`${a.h}px`}
        role="slider"
        tabindex="0"
        aria-label={`${nombre(m)}, en el esquema`}
        aria-valuemin={ariaNumero(m.valores[0] ?? 0)}
        aria-valuemax={ariaNumero(m.valores[m.valores.length - 1] ?? 0)}
        aria-valuenow={ariaNumero(valores[m.valor] ?? 0)}
        aria-valuetext={hablado(m)}
        data-asa={a.pieza}
        onpointerdown={(ev) => abajo(ev, a)}
        onpointermove={(ev) => moverPuntero(ev, a)}
        onpointerup={(ev) => arriba(ev, a)}
        onpointercancel={() => {
          arrastre = null;
          arrastrando = null;
        }}
        onkeydown={(ev) => tecla(ev, a)}
      >
        {#if arrastrando === a.pieza}<span class="burbuja" aria-hidden="true">{texto(m)}</span>{/if}
      </div>
      {#if abierta === a.pieza}
        <div class="pasos" style:left={`${a.x + a.w / 2}px`} style:top={`${a.y + a.h}px`} data-pasos={a.pieza}>
          <button type="button" aria-label={`Bajar ${nombre(m)}`} onclick={() => mover(m, pasoMando(m, valores[m.valor] ?? 0, -1))}><Minus size={20} aria-hidden="true" /></button>
          <span class="valor" aria-live="polite">{texto(m)}</span>
          <button type="button" aria-label={`Subir ${nombre(m)}`} onclick={() => mover(m, pasoMando(m, valores[m.valor] ?? 0, 1))}><Plus size={20} aria-hidden="true" /></button>
        </div>
      {/if}
    {:else}
      <button
        type="button"
        class={`asa ${colorDe(a.pieza)}`}
        style:left={`${a.x}px`}
        style:top={`${a.y}px`}
        style:width={`${a.w}px`}
        style:height={`${a.h}px`}
        role="switch"
        aria-checked={(valores[m.valor] ?? 0) !== 0}
        aria-label={`${nombre(m)}, en el esquema`}
        data-asa={a.pieza}
        onclick={() => alternar(m)}
      ></button>
    {/if}
  {/each}
</div>
{#if hayColor}
  <div class="leyenda" data-leyenda-tension>
    <span class="tit">Tensión</span>
    <span class="ext">{fmtV(vMin)}</span>
    <span class="barra" style:background={gradiente} aria-hidden="true"></span>
    <span class="ext">{fmtV(vMax)}</span>
    <button type="button" class="ver" aria-pressed={verValores} onclick={() => (verValores = !verValores)} data-ver-tensiones>{verValores ? 'Ocultar valores' : 'Ver valores'}</button>
    {#if verValores}
      <ul class="solo-lector" aria-label="Tensión de cada nodo respecto a masa">
        {#each etiquetas as e (e.nodo)}<li>{e.texto}</li>{/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  .vivo {
    position: relative;
  }
  .lienzo {
    position: absolute;
    pointer-events: none;
  }
  /* the drawing's own dash animation gives way to the particles (its path stays: it is the geometry they follow) */
  .vivo :global(.e11 .flujo) {
    animation: none;
    opacity: 0;
  }
  .tension {
    position: absolute;
    transform: translate(-50%, -50%);
    padding: 1px 6px;
    border: 1.5px solid var(--v11-borde);
    border-radius: 8px;
    background: var(--v11-fondo);
    color: var(--v11-tinta);
    font: 600 12.5px/1.3 var(--v11-texto);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    pointer-events: none;
  }
  .asa {
    position: absolute;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border: 2px dashed transparent;
    border-radius: 12px;
    background: transparent;
    touch-action: none;
    cursor: grab;
  }
  .asa:hover,
  .asa.activa {
    border-color: currentColor;
  }
  .asa.azul {
    color: var(--v11-azul);
  }
  .asa.naranja {
    color: var(--v11-naranja);
  }
  .asa.verde {
    color: var(--v11-verde);
  }
  .asa:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
    border-color: currentColor;
  }
  .burbuja {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    padding: 3px 9px;
    border-radius: 8px;
    background: var(--v11-tinta);
    color: var(--v11-fondo);
    font: 700 14px var(--v11-texto);
    white-space: nowrap;
  }
  .pasos {
    position: absolute;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    transform: translate(-50%, 6px);
    border: 1.5px solid var(--v11-borde);
    border-radius: 14px;
    background: var(--v11-fondo);
    box-shadow: var(--v11-sombra);
  }
  .pasos button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 10px;
    background: var(--v11-panel);
    color: var(--v11-tinta);
    cursor: pointer;
  }
  .pasos button:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 1px;
  }
  .pasos .valor {
    min-width: 5.5em;
    color: var(--v11-tinta);
    font: 700 15px var(--v11-texto);
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
  .leyenda {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    font-size: 13px;
    color: var(--v11-tinta-suave);
  }
  .leyenda .tit {
    font-weight: 600;
  }
  .leyenda .ext {
    color: var(--v11-tinta);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .leyenda .barra {
    flex: 1 1 80px;
    min-width: 60px;
    height: 10px;
    border-radius: 5px;
  }
  .ver {
    min-height: 44px;
    padding: 0 12px;
    border: 1.5px solid var(--v11-borde);
    border-radius: 12px;
    background: var(--v11-fondo);
    color: var(--v11-tinta);
    font: 600 14px var(--v11-texto);
    cursor: pointer;
  }
  .ver:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
  .solo-lector {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
