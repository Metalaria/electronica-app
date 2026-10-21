<script lang="ts">
  // Interactive plot (canvas): crosshair with a readout of every series, zoom (wheel, pinch, box) and pan,
  // double click / double tap to reset, legend toggles, linear/log axes, two measurement cursors, linked
  // plots, smooth transitions between results and a faint trace of a previous result. API in ESQUEMA.md.
  import { onMount, untrack } from 'svelte';
  import { PlotLink, type Axis, type Scale, type Series } from './tipos.svelte';
  import {
    aDato,
    aPixel,
    ampliar,
    desplazar,
    extension,
    interpolar,
    marcasLineales,
    marcasLog,
    mezclarRango,
    monotona,
    rangoBonito,
    type Escala,
  } from './escalas';
  import { dibujarBase, dibujarCapa, preparar, type Marco, type Tema, type TrazoSerie } from './dibujo';
  import { formatoEje, formatoSI } from './formato';

  interface Props {
    series: Series[];
    xAxis: Axis;
    yAxis: Axis;
    /** Faint curves of a previous result, matched to `series` by name. */
    trace?: Series[];
    /** Shared x zoom, crosshair and cursors with other plots. */
    link?: PlotLink;
    /** Height of the plot area in CSS px. */
    height?: number;
    title?: string;
    /** Animate from the previous data when `series` changes (off with prefers-reduced-motion). */
    animate?: boolean;
    /** Accessible description of the plot. */
    ariaLabel?: string;
    /** Show the one-line gesture help under the plot. */
    help?: boolean;
  }

  let {
    series,
    xAxis,
    yAxis,
    trace = [],
    link,
    height = 260,
    title = '',
    animate = true,
    ariaLabel = '',
    help = true,
  }: Props = $props();

  const propio = new PlotLink();
  const v = $derived(link ?? propio);

  // ------------------------------------------------------------------ view state
  let escalaX = $state<Scale | null>(null);
  let escalaY = $state<Scale | null>(null);
  const tipoX = $derived<Scale>(escalaX ?? xAxis.scale);
  const tipoY = $derived<Scale>(escalaY ?? yAxis.scale);
  let rangoY = $state<[number, number] | null>(null);
  let ocultas = $state<Record<string, boolean>>({});
  let tabla = $state(false);
  let ancho = $state(0);
  let enfocada = $state(false);
  let aviso = $state('');
  /** Pointer over this plot (px within the canvas), for the readout box. */
  let puntero = $state<{ px: number; py: number } | null>(null);
  let caja = $state<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  let cursorArrastrado = $state<0 | 1 | null>(null);
  /** Increments after each base drawing, so pixel positions derived from the scales refresh. */
  let version = $state(0);

  let raiz: HTMLElement | undefined = $state();
  let lienzo: HTMLCanvasElement | undefined = $state();
  let capa: HTMLCanvasElement | undefined = $state();
  let zona: HTMLDivElement | undefined = $state();

  const visibles = $derived(series.filter((s) => !ocultas[s.name]));
  const ordenes = new WeakMap<Float64Array, 1 | -1 | 0>();
  function orden(x: Float64Array): 1 | -1 | 0 {
    let o = ordenes.get(x);
    if (o === undefined) {
      o = monotona(x);
      ordenes.set(x, o);
    }
    return o;
  }
  const indice = $derived(new Map(series.map((s, i) => [s.name, i])));

  // ------------------------------------------------------------------ geometry of the last drawing
  let sx: Escala = { tipo: 'linear', min: 0, max: 1, a: 0, b: 1 };
  let sy: Escala = { tipo: 'linear', min: 0, max: 1, a: 1, b: 0 };
  let marco: Marco = { w: 1, h: 1, izq: 40, der: 14, arr: 24, aba: 40 };
  let tema: Tema = { tinta: '#222', tenue: '#666', rejilla: '#ddd', eje: '#999', fondo: '#fff', fuente: 'sans-serif' };
  let ultimoX: [number, number] | null = null;
  let ultimoY: [number, number] | null = null;

  // ------------------------------------------------------------------ animation between results
  interface Animacion {
    t0: number;
    desde: Map<string, Float64Array>;
    xDesde: [number, number] | null;
    yDesde: [number, number] | null;
  }
  const DURACION = 420;
  let anim: Animacion | null = null;
  let previas = new Map<string, { x: Float64Array; y: Float64Array }>();
  const buffers = new Map<string, Float64Array>();
  const sinMovimiento = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  $effect(() => {
    const nuevas = series;
    untrack(() => {
      const total = nuevas.reduce((s, x) => s + x.y.length, 0);
      if (animate && !sinMovimiento && previas.size && total < 400_000) {
        const desde = new Map<string, Float64Array>();
        for (const s of nuevas) {
          const p = previas.get(s.name);
          if (!p || (p.x === s.x && p.y === s.y)) continue;
          const o = orden(p.x);
          const d = new Float64Array(s.y.length);
          for (let i = 0; i < d.length; i++) {
            const val = interpolar(p.x, p.y, s.x[i]!, o, tipoX === 'log');
            d[i] = Number.isFinite(val) ? val : s.y[i]!;
          }
          desde.set(s.name, d);
        }
        anim = desde.size ? { t0: performance.now(), desde, xDesde: ultimoX, yDesde: ultimoY } : null;
      }
      previas = new Map(nuevas.map((s) => [s.name, { x: s.x, y: s.y }]));
      pedir();
    });
  });

  const suave = (u: number) => 1 - (1 - u) ** 3;

  /** y of a series as drawn now (mid-animation or final). */
  function yActual(s: Series, e: number): Float64Array {
    const d = anim?.desde.get(s.name);
    if (!d || e >= 1 || d.length !== s.y.length) return s.y;
    let b = buffers.get(s.name);
    if (!b || b.length !== d.length) {
      b = new Float64Array(d.length);
      buffers.set(s.name, b);
    }
    for (let i = 0; i < d.length; i++) b[i] = d[i]! + (s.y[i]! - d[i]!) * e;
    return b;
  }

  // ------------------------------------------------------------------ ranges

  function rangoXAuto(): [number, number] {
    if (xAxis.min != null && xAxis.max != null) return [xAxis.min, xAxis.max];
    const pares = [...series, ...trace].map((s) => ({ x: s.x, y: s.y, orden: orden(s.x) }));
    const ext = extension(pares, 'x', tipoX === 'log');
    const r = rangoBonito(ext, tipoX === 'log', 0);
    // A linear range that starts just after zero (a transient with UIC begins at its first step) starts at 0.
    if (tipoX === 'linear' && r[0] > 0 && r[0] < (r[1] - r[0]) * 0.01) r[0] = 0;
    return [xAxis.min ?? r[0], xAxis.max ?? r[1]];
  }

  function rangoYAuto(xr: [number, number], ys: { x: Float64Array; y: Float64Array; orden: 1 | -1 | 0 }[]): [number, number] {
    if (yAxis.min != null && yAxis.max != null) return [yAxis.min, yAxis.max];
    const ext = extension(ys, 'y', tipoY === 'log', xr);
    const r = rangoBonito(ext, tipoY === 'log', 0.06);
    return [yAxis.min ?? r[0], yAxis.max ?? r[1]];
  }

  // ------------------------------------------------------------------ drawing

  let pedido = 0;
  function pedir() {
    if (!pedido) pedido = requestAnimationFrame(dibujar);
  }

  function leerTema(): { tema: Tema; paleta: string[] } {
    const cs = getComputedStyle(raiz!);
    const g = (k: string, d: string) => cs.getPropertyValue(k).trim() || d;
    return {
      tema: {
        tinta: g('--g-tinta', '#222'),
        tenue: g('--g-tenue', '#666'),
        rejilla: g('--g-rejilla', '#e5e5e5'),
        eje: g('--g-eje', '#999'),
        fondo: g('--g-fondo', '#fff'),
        fuente: cs.fontFamily || 'sans-serif',
      },
      paleta: Array.from({ length: 8 }, (_, i) => g(`--g-${i + 1}`, '#2a78d6')),
    };
  }

  // Palette read from CSS (theme dependent); state, because the legend and the readout use it too.
  let paleta = $state<string[]>([]);
  function colorDe(s: Series): string {
    return s.color ?? paleta[(indice.get(s.name) ?? 0) % paleta.length] ?? '#2a78d6';
  }

  function dibujar() {
    pedido = 0;
    if (!lienzo || !capa || !raiz || ancho < 10) return;
    const t = leerTema();
    tema = t.tema;
    if (t.paleta.join() !== paleta.join()) paleta = t.paleta;
    const e = anim ? suave(Math.min(1, (performance.now() - anim.t0) / DURACION)) : 1;

    const xAuto = rangoXAuto();
    let xr = v.xRange ?? xAuto;
    if (!v.xRange && anim?.xDesde && e < 1) xr = mezclarRango(tipoX, anim.xDesde, xAuto, e);
    const actuales = visibles.map((s) => ({ s, y: yActual(s, e) }));
    const yObjetivo = rangoYAuto(
      xr,
      [...visibles, ...trace.filter((s) => !ocultas[s.name])].map((s) => ({ x: s.x, y: s.y, orden: orden(s.x) })),
    );
    let yr = rangoY ?? yObjetivo;
    if (!rangoY && anim?.yDesde && e < 1) yr = mezclarRango(tipoY, anim.yDesde, yObjetivo, e);

    // Ticks and margins.
    const h = height;
    const ctx = preparar(lienzo, ancho, h, devicePixelRatio || 1);
    if (!ctx) return;
    ctx.font = `12px ${tema.fuente}`;
    const largoY = h - 24 - 40;
    let marcasY: number[];
    let menoresY: number[] = [];
    if (tipoY === 'log') ({ mayores: marcasY, menores: menoresY } = marcasLog(yr[0], yr[1], largoY));
    else marcasY = marcasLineales(yr[0], yr[1], largoY, 46);
    const fy = formatoEje(marcasY, yAxis.unit, tipoY === 'log');
    const izq = Math.max(38, Math.ceil(Math.max(0, ...fy.textos.map((s) => ctx.measureText(s).width))) + 12);
    marco = { w: ancho, h, izq, der: 14, arr: 24, aba: 40 };
    const largoX = ancho - izq - 14;
    let marcasX: number[];
    let menoresX: number[] = [];
    if (tipoX === 'log') ({ mayores: marcasX, menores: menoresX } = marcasLog(xr[0], xr[1], largoX));
    else marcasX = marcasLineales(xr[0], xr[1], largoX, 84);
    const fx = formatoEje(marcasX, xAxis.unit, tipoX === 'log');

    sx = { tipo: tipoX, min: xr[0], max: xr[1], a: izq, b: ancho - 14 };
    sy = { tipo: tipoY, min: yr[0], max: yr[1], a: h - 40, b: 24 };
    const titulo = (a: Axis, u: string) => (u ? `${a.label} (${u})` : a.label);

    const trazos: TrazoSerie[] = [];
    for (const s of trace) {
      if (ocultas[s.name]) continue;
      const ref = series.find((x) => x.name === s.name);
      trazos.push({
        x: s.x,
        y: s.y,
        color: ref ? colorDe(ref) : colorDe(s),
        ancho: 1.5,
        alfa: 0.32,
        discontinua: true,
        orden: orden(s.x),
        marcas: false,
      });
    }
    for (const { s, y } of actuales) {
      trazos.push({
        x: s.x,
        y,
        color: colorDe(s),
        ancho: 2,
        alfa: 1,
        discontinua: !!s.dashed,
        orden: orden(s.x),
        marcas: s.x.length <= 40,
      });
    }
    dibujarBase(
      ctx,
      marco,
      sx,
      sy,
      {
        marcasX,
        menoresX,
        textosX: fx.textos,
        marcasY,
        menoresY,
        textosY: fy.textos,
        tituloX: titulo(xAxis, fx.unidad),
        tituloY: titulo(yAxis, fy.unidad),
      },
      tema,
      trazos,
    );
    ultimoX = xr;
    ultimoY = yr;
    if (anim && e >= 1) anim = null;
    if (anim) pedir();
    version++;
    dibujarEncima();
  }

  // ------------------------------------------------------------------ overlay, readout, cursors

  const cursoresX = $derived.by((): [number, number] | null => {
    void version;
    if (!v.cursorsOn) return null;
    if (v.cursors) return v.cursors;
    return [aDato(sx, sx.a + (sx.b - sx.a) / 3), aDato(sx, sx.a + ((sx.b - sx.a) * 2) / 3)];
  });

  function dibujarEncima() {
    if (!capa) return;
    const ctx = preparar(capa, ancho, height, devicePixelRatio || 1);
    if (!ctx) return;
    const hx = v.hoverX;
    const dentro = hx != null && hx >= Math.min(sx.min, sx.max) && hx <= Math.max(sx.min, sx.max);
    dibujarCapa(ctx, marco, tema, {
      cruz: dentro ? aPixel(sx, hx) : null,
      puntos: dentro
        ? lectura.flatMap((l) =>
            Number.isFinite(l.y) && (tipoY !== 'log' || l.y > 0)
              ? [{ px: aPixel(sx, hx), py: Math.min(Math.max(aPixel(sy, l.y), sy.b), sy.a), color: l.color }]
              : [],
          )
        : [],
      cursores: (cursoresX ?? []).map((c, i) => ({
        px: aPixel(sx, c),
        etiqueta: i === 0 ? 'A' : 'B',
        activo: cursorArrastrado === i,
      })),
      caja,
    });
  }

  /** Values of every visible series at the crosshair. */
  const lectura = $derived.by(() => {
    const hx = v.hoverX;
    if (hx == null) return [];
    return visibles.map((s) => {
      const y = interpolar(s.x, s.y, hx, orden(s.x), tipoX === 'log');
      const t = trace.find((x) => x.name === s.name);
      const antes = t ? interpolar(t.x, t.y, hx, orden(t.x), tipoX === 'log') : NaN;
      return { name: s.name, unit: s.unit, color: colorDe(s), y, antes };
    });
  });

  $effect(() => {
    void v.hoverX;
    void lectura;
    void cursoresX;
    void caja;
    void cursorArrastrado;
    untrack(dibujarEncima);
  });

  /** Readout box placement (follows the pointer; the other plots of a link show it at the top). */
  const cajaLectura = $derived.by(() => {
    void version;
    const hx = v.hoverX;
    if (hx == null || !lectura.length || hx < Math.min(sx.min, sx.max) || hx > Math.max(sx.min, sx.max)) return null;
    const px = aPixel(sx, hx);
    const izquierda = px > ancho * 0.55;
    return { px, py: puntero?.py ?? marco.arr + 6, izquierda };
  });

  const medidasCursores = $derived.by(() => {
    const c = cursoresX;
    if (!c) return null;
    const [a, b] = c;
    const dx = b - a;
    const inv = dx !== 0 ? 1 / Math.abs(dx) : NaN;
    const unidadInv = xAxis.unit === 's' ? 'Hz' : xAxis.unit === 'Hz' ? 's' : xAxis.unit ? `1/${xAxis.unit}` : '';
    return {
      a,
      b,
      dx,
      inv,
      unidadInv,
      filas: visibles.map((s) => {
        const ya = interpolar(s.x, s.y, a, orden(s.x), tipoX === 'log');
        const yb = interpolar(s.x, s.y, b, orden(s.x), tipoX === 'log');
        return { name: s.name, unit: s.unit, color: colorDe(s), ya, yb, dy: yb - ya };
      }),
    };
  });

  const ampliada = $derived(!!v.xRange || !!rangoY);

  // Redraw on any change of data, view or size.
  $effect(() => {
    void series;
    void trace;
    void visibles;
    void v.xRange;
    void rangoY;
    void tipoX;
    void tipoY;
    void ancho;
    void height;
    void xAxis;
    void yAxis;
    untrack(pedir);
  });

  // ------------------------------------------------------------------ interaction

  function restablecer() {
    v.xRange = null;
    rangoY = null;
    if (link) link.cursors = null;
    else propio.cursors = null;
  }

  function enArea(px: number, py: number): boolean {
    return px >= marco.izq && px <= ancho - marco.der && py >= marco.arr - 8 && py <= height - marco.aba + 8;
  }

  function cursorCerca(px: number, tolerancia: number): 0 | 1 | null {
    const c = cursoresX;
    if (!c) return null;
    let mejor: 0 | 1 | null = null;
    let d = tolerancia;
    c.forEach((x, i) => {
      const e = Math.abs(aPixel(sx, x) - px);
      if (e <= d) {
        d = e;
        mejor = i as 0 | 1;
      }
    });
    return mejor;
  }

  interface Arrastre {
    modo: 'caja' | 'mover' | 'cursor' | 'leer';
    x0: number;
    y0: number;
    escX: Escala;
    escY: Escala;
  }
  let arrastre: Arrastre | null = null;
  const toques = new Map<number, { x: number; y: number }>();
  let pellizco: { d0: number; cx: number; esc: Escala; dx: number } | null = null;
  let ultimoToque = { t: 0, x: 0, y: 0 };

  function local(ev: PointerEvent | WheelEvent | MouseEvent): { px: number; py: number } {
    const r = zona!.getBoundingClientRect();
    return { px: ev.clientX - r.left, py: ev.clientY - r.top };
  }

  function fijarHover(px: number, py: number | null) {
    const dentro = px >= marco.izq && px <= ancho - marco.der;
    v.hoverX = dentro ? aDato(sx, px) : null;
    puntero = dentro && py != null ? { px, py } : null;
  }

  function moverCursor(i: 0 | 1, px: number) {
    const c = cursoresX;
    if (!c) return;
    const x = aDato(sx, Math.min(Math.max(px, marco.izq), ancho - marco.der));
    const n: [number, number] = [c[0], c[1]];
    n[i] = x;
    v.cursors = n;
  }

  function abajo(ev: PointerEvent) {
    const { px, py } = local(ev);
    toques.set(ev.pointerId, { x: px, y: py });
    zona!.setPointerCapture(ev.pointerId);
    if (toques.size === 2) {
      // Two fingers: pinch to zoom x, move to pan.
      const [a, b] = [...toques.values()];
      arrastre = null;
      caja = null;
      pellizco = { d0: Math.abs(a!.x - b!.x) || 1, cx: (a!.x + b!.x) / 2, esc: { ...sx }, dx: 0 };
      return;
    }
    const tactil = ev.pointerType !== 'mouse';
    const c = cursorCerca(px, tactil ? 18 : 7);
    if (c != null) {
      cursorArrastrado = c;
      arrastre = { modo: 'cursor', x0: px, y0: py, escX: { ...sx }, escY: { ...sy } };
      return;
    }
    if (!enArea(px, py)) return;
    if (tactil) {
      // One finger reads values (vertical swipes still scroll the page: touch-action: pan-y).
      arrastre = { modo: 'leer', x0: px, y0: py, escX: { ...sx }, escY: { ...sy } };
      fijarHover(px, py);
      return;
    }
    if (ev.button === 1 || (ev.button === 0 && ev.shiftKey)) {
      arrastre = { modo: 'mover', x0: px, y0: py, escX: { ...sx }, escY: { ...sy } };
    } else if (ev.button === 0) {
      arrastre = { modo: 'caja', x0: px, y0: py, escX: { ...sx }, escY: { ...sy } };
    }
  }

  function mover(ev: PointerEvent) {
    const { px, py } = local(ev);
    if (toques.has(ev.pointerId)) toques.set(ev.pointerId, { x: px, y: py });
    if (pellizco && toques.size >= 2) {
      const [a, b] = [...toques.values()];
      const d = Math.abs(a!.x - b!.x) || 1;
      const cx = (a!.x + b!.x) / 2;
      const p = pellizco;
      const centro = aDato(p.esc, p.cx);
      let r = ampliar(tipoX, [p.esc.min, p.esc.max], centro, p.d0 / d);
      const tmp: Escala = { ...p.esc, min: r[0], max: r[1] };
      r = desplazar(tmp, cx - p.cx);
      v.xRange = r;
      return;
    }
    if (!arrastre) {
      if (ev.pointerType === 'mouse') fijarHover(px, py);
      return;
    }
    const a = arrastre;
    if (a.modo === 'leer') fijarHover(px, py);
    else if (a.modo === 'cursor' && cursorArrastrado != null) moverCursor(cursorArrastrado, px);
    else if (a.modo === 'mover') {
      v.xRange = desplazar(a.escX, px - a.x0);
      rangoY = desplazar({ ...a.escY }, py - a.y0);
    } else if (a.modo === 'caja') {
      caja = { x0: a.x0, y0: a.y0, x1: Math.min(Math.max(px, marco.izq), ancho - marco.der), y1: Math.min(Math.max(py, marco.arr), height - marco.aba) };
      fijarHover(px, py);
    }
  }

  function arriba(ev: PointerEvent) {
    const { px, py } = local(ev);
    toques.delete(ev.pointerId);
    if (pellizco) {
      if (toques.size < 2) pellizco = null;
      return;
    }
    const a = arrastre;
    arrastre = null;
    cursorArrastrado = null;
    if (a?.modo === 'caja' && caja) {
      const w = Math.abs(caja.x1 - caja.x0);
      const h = Math.abs(caja.y1 - caja.y0);
      if (w > 6) {
        const xs = [aDato(sx, caja.x0), aDato(sx, caja.x1)].sort((p, q) => p - q) as [number, number];
        v.xRange = xs;
        if (h > 6) rangoY = [aDato(sy, caja.y0), aDato(sy, caja.y1)].sort((p, q) => p - q) as [number, number];
      }
      caja = null;
    }
    if (ev.pointerType !== 'mouse') {
      // Double tap resets the view.
      const ahora = performance.now();
      if (a?.modo === 'leer' && ahora - ultimoToque.t < 320 && Math.hypot(px - ultimoToque.x, py - ultimoToque.y) < 24) {
        restablecer();
        ultimoToque = { t: 0, x: 0, y: 0 };
      } else ultimoToque = { t: ahora, x: px, y: py };
    }
  }

  function cancelar(ev: PointerEvent) {
    toques.delete(ev.pointerId);
    pellizco = null;
    arrastre = null;
    caja = null;
    cursorArrastrado = null;
  }

  function salir(ev: PointerEvent) {
    if (ev.pointerType === 'mouse' && !arrastre) {
      v.hoverX = null;
      puntero = null;
    }
  }

  let temporizadorAviso: ReturnType<typeof setTimeout> | null = null;
  function rueda(ev: WheelEvent) {
    const { px, py } = local(ev);
    if (!enArea(px, py)) return;
    if (!(ev.ctrlKey || ev.metaKey || enfocada)) {
      aviso = 'Haga clic en la gráfica (o mantenga Ctrl) para ampliar con la rueda';
      if (temporizadorAviso) clearTimeout(temporizadorAviso);
      temporizadorAviso = setTimeout(() => (aviso = ''), 1800);
      return;
    }
    ev.preventDefault();
    const f = Math.exp(Math.max(-1, Math.min(1, ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.0022))));
    if (ev.shiftKey || ev.altKey) {
      rangoY = ampliar(tipoY, [sy.min, sy.max], aDato(sy, py), f);
    } else {
      v.xRange = ampliar(tipoX, [sx.min, sx.max], aDato(sx, px), f);
    }
  }

  function teclas(ev: KeyboardEvent) {
    const paso = (sx.b - sx.a) / 100;
    const actual = v.hoverX != null ? aPixel(sx, v.hoverX) : (sx.a + sx.b) / 2;
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      ev.preventDefault();
      fijarHover(Math.min(Math.max(actual + (ev.key === 'ArrowLeft' ? -paso : paso) * (ev.shiftKey ? 10 : 1), sx.a), sx.b), null);
    } else if (ev.key === '+' || ev.key === '=' || ev.key === '-') {
      ev.preventDefault();
      v.xRange = ampliar(tipoX, [sx.min, sx.max], aDato(sx, actual), ev.key === '-' ? 1.25 : 0.8);
    } else if (ev.key === '0' || ev.key === 'Escape') {
      if (ampliada) {
        ev.preventDefault();
        restablecer();
      }
    } else if (ev.key.toLowerCase() === 'c') {
      v.cursorsOn = !v.cursorsOn;
    }
  }

  // ------------------------------------------------------------------ data table

  const filasTabla = $derived.by(() => {
    if (!tabla || !visibles.length) return [];
    const base = visibles[0]!;
    const xs: number[] = [];
    const [lo, hi] = [Math.min(sx.min, sx.max), Math.max(sx.min, sx.max)];
    void version;
    for (let i = 0; i < base.x.length; i++) if (base.x[i]! >= lo && base.x[i]! <= hi) xs.push(base.x[i]!);
    const paso = Math.max(1, Math.ceil(xs.length / 120));
    return xs
      .filter((_, i) => i % paso === 0)
      .map((x) => ({ x, ys: visibles.map((s) => interpolar(s.x, s.y, x, orden(s.x), tipoX === 'log')) }));
  });

  // ------------------------------------------------------------------ lifecycle

  onMount(() => {
    const z = zona!;
    z.addEventListener('wheel', rueda, { passive: false });
    // Theme changes (data-tema, class, OS scheme) recolour the canvas.
    const obs = new MutationObserver(() => pedir());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema', 'class', 'style'] });
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', pedir);
    return () => {
      z.removeEventListener('wheel', rueda);
      obs.disconnect();
      mq.removeEventListener('change', pedir);
      if (pedido) cancelAnimationFrame(pedido);
      if (temporizadorAviso) clearTimeout(temporizadorAviso);
    };
  });

  const tactil = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
</script>

<figure class="grafica" bind:this={raiz} aria-label={ariaLabel || title || undefined}>
  <div class="cabecera">
    {#if title}<div class="titulo">{title}</div>{/if}
    <div class="leyenda" role="group" aria-label="Series">
      {#each series as s (s.name)}
        <button
          type="button"
          class="serie"
          aria-pressed={!ocultas[s.name]}
          title={ocultas[s.name] ? 'Mostrar' : 'Ocultar'}
          onclick={() => (ocultas[s.name] = !ocultas[s.name])}
        >
          <svg width="18" height="10" aria-hidden="true"
            ><line x1="1" y1="5" x2="17" y2="5" stroke={colorDe(s)} stroke-width="2.5" stroke-linecap="round" stroke-dasharray={s.dashed ? '4 3' : undefined} /></svg
          >
          <span class="nombre">{s.name}</span>
        </button>
      {/each}
    </div>
    <div class="herramientas">
      <button type="button" class="h" aria-pressed={v.cursorsOn} title="Cursores de medida A y B (tecla C)" onclick={() => (v.cursorsOn = !v.cursorsOn)}>Cursores</button>
      <button type="button" class="h" aria-pressed={tipoX === 'log'} title="Escala logarítmica en el eje horizontal" onclick={() => (escalaX = tipoX === 'log' ? 'linear' : 'log')}>X log</button>
      <button type="button" class="h" aria-pressed={tipoY === 'log'} title="Escala logarítmica en el eje vertical" onclick={() => { escalaY = tipoY === 'log' ? 'linear' : 'log'; rangoY = null; }}>Y log</button>
      <button type="button" class="h" aria-pressed={tabla} title="Ver los datos en una tabla" onclick={() => (tabla = !tabla)}>Tabla</button>
      {#if ampliada}
        <button type="button" class="h fuerte" title="Volver a ver todos los datos (doble clic, tecla 0)" onclick={restablecer}>Restablecer</button>
      {/if}
    </div>
  </div>

  <!-- A canvas widget with its own keyboard handling (arrows, +, −, 0, C): focusable on purpose. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="zona"
    bind:this={zona}
    bind:clientWidth={ancho}
    style:height={`${height}px`}
    role="application"
    aria-roledescription="gráfica"
    aria-label={`${ariaLabel || title || 'Gráfica'}. Flechas: leer valores; más y menos: ampliar; 0: restablecer; C: cursores.`}
    tabindex="0"
    onpointerdown={abajo}
    onpointermove={mover}
    onpointerup={arriba}
    onpointercancel={cancelar}
    onpointerleave={salir}
    ondblclick={restablecer}
    onfocus={() => (enfocada = true)}
    onblur={() => (enfocada = false)}
    onkeydown={teclas}
  >
    <canvas bind:this={lienzo} style:width={`${ancho}px`} style:height={`${height}px`}></canvas>
    <canvas class="encima" bind:this={capa} style:width={`${ancho}px`} style:height={`${height}px`}></canvas>
    {#if cajaLectura}
      <div
        class="lectura"
        class:izquierda={cajaLectura.izquierda}
        style:left={`${cajaLectura.px}px`}
        style:top={`${Math.min(Math.max(cajaLectura.py - 20, 4), height - 40)}px`}
        aria-hidden="true"
      >
        <div class="lx">{formatoSI(v.hoverX ?? 0, xAxis.unit)}</div>
        {#each lectura as l (l.name)}
          <div class="ly">
            <svg width="12" height="8"><line x1="1" y1="4" x2="11" y2="4" stroke={l.color} stroke-width="2.5" stroke-linecap="round" /></svg>
            <strong>{formatoSI(l.y, l.unit)}</strong>
            <span>{l.name}</span>
            {#if Number.isFinite(l.antes)}<em>antes {formatoSI(l.antes, l.unit)}</em>{/if}
          </div>
        {/each}
      </div>
    {/if}
    {#if aviso}<div class="aviso" role="status">{aviso}</div>{/if}
  </div>
  {#if help}<p class="ayuda">
    {#if tactil}
      Deslice el dedo para leer valores · pellizque para ampliar · doble toque para restablecer
    {:else}
      Arrastre para ampliar una zona · Mayús + arrastre para desplazar · rueda con la gráfica activa · doble clic
      para restablecer
    {/if}
  </p>{/if}

  {#if medidasCursores}
    {@const m = medidasCursores}
    <div class="tabla-desliza">
      <table class="cursores">
        <thead>
          <tr><th></th><th>A</th><th>B</th><th>B − A</th></tr>
        </thead>
        <tbody>
          <tr class="x">
            <th scope="row">{xAxis.label}</th>
            <td>{formatoSI(m.a, xAxis.unit)}</td>
            <td>{formatoSI(m.b, xAxis.unit)}</td>
            <td>{formatoSI(m.dx, xAxis.unit)}<span class="inv">1/Δ = {formatoSI(m.inv, m.unidadInv)}</span></td>
          </tr>
          {#each m.filas as f (f.name)}
            <tr>
              <th scope="row"><svg width="12" height="8" aria-hidden="true"><line x1="1" y1="4" x2="11" y2="4" stroke={f.color} stroke-width="2.5" stroke-linecap="round" /></svg> {f.name}</th>
              <td>{formatoSI(f.ya, f.unit)}</td>
              <td>{formatoSI(f.yb, f.unit)}</td>
              <td>{formatoSI(f.dy, f.unit)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if tabla}
    <div class="tabla-desliza datos">
      <table>
        <thead>
          <tr>
            <th>{xAxis.label}</th>
            {#each visibles as s (s.name)}<th>{s.name}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each filasTabla as f, k (k)}
            <tr>
              <td>{formatoSI(f.x, xAxis.unit)}</td>
              {#each f.ys as y, j (j)}<td>{formatoSI(y, visibles[j]?.unit ?? '')}</td>{/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</figure>

<style>
  .grafica {
    /* Validated categorical palette (light), fixed order; dark steps below. */
    --g-1: #2a78d6;
    --g-2: #eb6834;
    --g-3: #1baf7a;
    --g-4: #eda100;
    --g-5: #e87ba4;
    --g-6: #008300;
    --g-7: #6250d6;
    --g-8: #e34948;
    --g-tinta: var(--tinta, #262626);
    --g-tenue: var(--tinta-suave, #5d6d7e);
    --g-rejilla: var(--linea-suave, #ece9e3);
    --g-eje: var(--tinta-tenue, #8a96a3);
    --g-fondo: var(--superficie, #fff);
    margin: 0;
    font-family: var(--sans, system-ui, sans-serif);
    color: var(--g-tinta);
    min-width: 0;
  }
  :global(:root[data-tema='oscuro']) .grafica {
    --g-1: #3987e5;
    --g-2: #d95926;
    --g-3: #199e70;
    --g-4: #c98500;
    --g-5: #d55181;
    --g-6: #008300;
    --g-7: #9085e9;
    --g-8: #e66767;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-tema])) .grafica {
      --g-1: #3987e5;
      --g-2: #d95926;
      --g-3: #199e70;
      --g-4: #c98500;
      --g-5: #d55181;
      --g-6: #008300;
      --g-7: #9085e9;
      --g-8: #e66767;
      --g-tinta: #e6e6e6;
      --g-tenue: #b0b0b0;
      --g-rejilla: #2c3036;
      --g-eje: #7a828c;
      --g-fondo: #1a1a19;
    }
  }
  .cabecera {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    margin-bottom: 4px;
  }
  .titulo {
    flex-basis: 100%;
    font-weight: 700;
    font-size: 14.5px;
    color: var(--titulos, inherit);
  }
  .leyenda {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 4px;
    flex: 1 1 auto;
    min-width: 0;
  }
  .serie {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 30px;
    padding: 2px 8px;
    border: 1px solid transparent;
    border-radius: 999px;
    background: transparent;
    font-size: 13px;
    color: var(--g-tinta);
    max-width: 100%;
  }
  .serie:hover {
    background: var(--hover, rgba(0, 0, 0, 0.05));
  }
  .serie[aria-pressed='false'] {
    color: var(--g-eje);
    text-decoration: line-through;
  }
  .serie[aria-pressed='false'] svg {
    opacity: 0.35;
  }
  .nombre {
    font-family: var(--mono, monospace);
    font-size: 12.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .herramientas {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-left: auto;
  }
  .h {
    min-height: 30px;
    padding: 0 9px;
    border: 1px solid var(--linea, #ddd);
    border-radius: 8px;
    background: var(--superficie, #fff);
    color: var(--g-tenue);
    font-size: 12.5px;
    font-weight: 600;
  }
  .h:hover {
    color: var(--g-tinta);
    border-color: var(--acento-borde, #9ab8d4);
  }
  .h[aria-pressed='true'] {
    background: var(--acento-tinte, #edf2f7);
    border-color: var(--acento-borde, #9ab8d4);
    color: var(--acento, #2e6ea6);
  }
  .h.fuerte {
    color: var(--acento, #2e6ea6);
  }
  .zona {
    position: relative;
    width: 100%;
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;
    cursor: crosshair;
    border-radius: 6px;
  }
  .zona:focus-visible {
    outline: 2px solid var(--acento, #2e6ea6);
    outline-offset: 2px;
  }
  canvas {
    position: absolute;
    inset: 0;
    display: block;
  }
  .lectura {
    position: absolute;
    z-index: 2;
    transform: translateX(12px);
    pointer-events: none;
    min-width: 7em;
    max-width: min(18em, 70vw);
    padding: 6px 9px;
    border: 1px solid var(--linea, #ddd);
    border-radius: 8px;
    background: color-mix(in srgb, var(--superficie, #fff) 94%, transparent);
    box-shadow: var(--sombra, 0 2px 10px rgba(0, 0, 0, 0.12));
    font-size: 12.5px;
    line-height: 1.35;
    font-variant-numeric: tabular-nums;
  }
  .lectura.izquierda {
    transform: translateX(calc(-100% - 12px));
  }
  .lx {
    color: var(--g-tenue);
    font-weight: 600;
    margin-bottom: 2px;
  }
  .ly {
    display: flex;
    align-items: baseline;
    gap: 5px;
    white-space: nowrap;
  }
  .ly strong {
    color: var(--g-tinta);
  }
  .ly span {
    color: var(--g-tenue);
    font-family: var(--mono, monospace);
    font-size: 11.5px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ly em {
    color: var(--g-eje);
    font-style: normal;
    font-size: 11.5px;
  }
  .aviso {
    position: absolute;
    left: 50%;
    bottom: 48px;
    transform: translateX(-50%);
    padding: 5px 10px;
    border-radius: 8px;
    background: var(--g-tinta);
    color: var(--g-fondo);
    font-size: 12.5px;
    pointer-events: none;
    white-space: nowrap;
  }
  .ayuda {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--g-eje);
  }
  .tabla-desliza {
    overflow-x: auto;
    margin-top: 8px;
  }
  .tabla-desliza.datos {
    max-height: 260px;
    overflow-y: auto;
    border: 1px solid var(--linea-suave, #eee);
    border-radius: 8px;
  }
  table {
    border-collapse: collapse;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    width: 100%;
  }
  th,
  td {
    padding: 4px 8px;
    text-align: right;
    white-space: nowrap;
    border-bottom: 1px solid var(--linea-suave, #eee);
  }
  th[scope='row'],
  thead th:first-child {
    text-align: left;
    font-weight: 600;
    color: var(--g-tenue);
  }
  thead th {
    position: sticky;
    top: 0;
    background: var(--superficie, #fff);
    color: var(--g-tenue);
    font-weight: 600;
  }
  .cursores tr.x td {
    font-weight: 600;
  }
  .inv {
    display: block;
    font-weight: 400;
    font-size: 11.5px;
    color: var(--g-tenue);
  }
</style>
