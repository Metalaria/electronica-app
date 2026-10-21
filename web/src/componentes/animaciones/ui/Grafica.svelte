<script lang="ts" module>
  // Minimal live plot for the animations (canvas, theme-aware, linear or log axes with SI prefixes).
  // Its inputs mirror the app's plot component (componentes/grafica) closely enough to swap it later.
  export interface SerieG {
    x: ArrayLike<number>;
    y: ArrayLike<number>;
    color?: string;
    ancho?: number;
    discontinua?: boolean;
    nombre?: string;
    alfa?: number;
  }
  export interface EjeG {
    etiqueta: string;
    unidad: string;
    min: number;
    max: number;
    log?: boolean;
  }
  export interface PuntoG {
    x: number;
    y: number;
    color?: string;
    etiqueta?: string;
    r?: number;
  }
  export interface LineaG {
    x?: number;
    y?: number;
    color?: string;
    etiqueta?: string;
    discontinua?: boolean;
  }
  export interface ZonaG {
    x0: number;
    x1: number;
    y0?: number;
    y1?: number;
    color: string;
    etiqueta?: string;
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '../../../lib/estado.svelte';
  import { paleta, alfa } from '../nucleo/paleta';
  import { es, siCorto } from '../nucleo/formato';
  import { FAMILIA } from '../nucleo/dibujo';
  import { analizar } from '../nucleo/rico';

  let {
    x,
    y,
    series,
    puntos = [],
    lineas = [],
    zonas = [],
    titulo,
    alto = 210,
    version = 0,
  }: {
    x: EjeG;
    y: EjeG;
    series: SerieG[];
    puntos?: PuntoG[];
    lineas?: LineaG[];
    zonas?: ZonaG[];
    titulo?: string;
    alto?: number;
    version?: number;
  } = $props();

  let caja: HTMLDivElement | undefined = $state();
  let lienzo: HTMLCanvasElement | undefined = $state();
  let ancho = $state(0);
  const pal = $derived(paleta(app.tema));

  const SIN_PREFIJO = new Set(['', '%', '°', '°C', 'dB', 'eV', 'nm', 'K', '×', 'lx']);
  const PREF: [number, string][] = [
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
    [1, ''],
    [1e-3, 'm'],
    [1e-6, 'µ'],
    [1e-9, 'n'],
    [1e-12, 'p'],
  ];

  function marcas(min: number, max: number, n: number): { v: number[]; paso: number } {
    const bruto = (max - min) / Math.max(1, n);
    const p = 10 ** Math.floor(Math.log10(bruto || 1));
    const f = bruto / p;
    const paso = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
    const v: number[] = [];
    for (let k = Math.ceil(min / paso - 1e-9); k * paso <= max + paso * 1e-9; k++) {
      v.push(Math.abs(k * paso) < paso * 1e-9 ? 0 : k * paso);
      if (v.length > 50) break;
    }
    return { v, paso };
  }

  function prefijoEje(e: EjeG): [number, string] {
    if (SIN_PREFIJO.has(e.unidad)) return [1, ''];
    const a = Math.max(Math.abs(e.min), Math.abs(e.max));
    return PREF.find(([m]) => a >= m * 0.999) ?? [1e-12, 'p'];
  }

  function texto(ctx: CanvasRenderingContext2D, s: string, px: number, py: number, tam: number, peso = 600): void {
    // Small inline sub/superscripts for axis titles («I_C (mA)»).
    const trozos = analizar(s);
    let w = 0;
    for (const t of trozos) {
      ctx.font = `${peso} ${t.sub || t.sup ? tam * 0.75 : tam}px ${FAMILIA}`;
      w += ctx.measureText(t.t).width;
    }
    const al = ctx.textAlign;
    let cx = al === 'center' ? px - w / 2 : al === 'right' ? px - w : px;
    const guardado = ctx.textAlign;
    ctx.textAlign = 'left';
    for (const t of trozos) {
      ctx.font = `${peso} ${t.sub || t.sup ? tam * 0.75 : tam}px ${FAMILIA}`;
      ctx.fillText(t.t, cx, py + (t.sub ? tam * 0.28 : t.sup ? -tam * 0.35 : 0));
      cx += ctx.measureText(t.t).width;
    }
    ctx.textAlign = guardado;
  }

  function dibujar(): void {
    const c = lienzo;
    if (!c || ancho <= 0) return;
    void version;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(ancho * dpr);
    const H = Math.round(alto * dpr);
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ancho, alto);
    const P = pal;
    const tam = 12;
    const izq = 50;
    const der = 14;
    const arr = titulo ? 40 : 24;
    const aba = 38;
    const x0 = izq;
    const x1 = ancho - der;
    const y0 = arr;
    const y1 = alto - aba;
    if (x1 - x0 < 40 || y1 - y0 < 30) return;

    const tx = (v: number) =>
      x.log
        ? x0 + ((Math.log10(Math.max(v, 1e-300)) - Math.log10(x.min)) / (Math.log10(x.max) - Math.log10(x.min))) * (x1 - x0)
        : x0 + ((v - x.min) / (x.max - x.min || 1)) * (x1 - x0);
    const ty = (v: number) =>
      y.log
        ? y1 - ((Math.log10(Math.max(v, 1e-300)) - Math.log10(y.min)) / (Math.log10(y.max) - Math.log10(y.min))) * (y1 - y0)
        : y1 - ((v - y.min) / (y.max - y.min || 1)) * (y1 - y0);

    // Panel.
    ctx.fillStyle = P.panel;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    // Zones (regions of operation).
    for (const z of zonas) {
      const a = tx(Math.max(z.x0, x.min));
      const b = tx(Math.min(z.x1, x.max));
      const ya = z.y1 !== undefined ? ty(Math.min(z.y1, y.max)) : y0;
      const yb = z.y0 !== undefined ? ty(Math.max(z.y0, y.min)) : y1;
      ctx.fillStyle = alfa(z.color, P.oscuro ? 0.16 : 0.1);
      ctx.fillRect(Math.min(a, b), Math.min(ya, yb), Math.abs(b - a), Math.abs(yb - ya));
      if (z.etiqueta) {
        ctx.fillStyle = z.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        texto(ctx, z.etiqueta, (a + b) / 2, Math.min(ya, yb) + 5, 11, 700);
      }
    }

    // Grid and tick labels.
    ctx.lineWidth = 1;
    ctx.textBaseline = 'middle';
    const [mx, px] = prefijoEje(x);
    const [my, py] = prefijoEje(y);
    const nX = Math.max(2, Math.round((x1 - x0) / 80));
    const nY = Math.max(2, Math.round((y1 - y0) / 40));
    const etiquetasX: [number, string][] = [];
    const etiquetasY: [number, string][] = [];
    const rejillaX: number[] = [];
    const rejillaY: number[] = [];
    if (x.log) {
      for (let d = Math.ceil(Math.log10(x.min) - 1e-9); d <= Math.log10(x.max) + 1e-9; d++) {
        etiquetasX.push([10 ** d, siCorto(10 ** d, x.unidad)]);
        for (let k = 2; k < 10; k++) if (10 ** d * k < x.max && (x1 - x0) / Math.log10(x.max / x.min) > 50) rejillaX.push(10 ** d * k);
      }
    } else {
      const { v, paso } = marcas(x.min / mx, x.max / mx, nX);
      const dec = Math.max(0, -Math.floor(Math.log10(paso) + 1e-9));
      for (const t of v) etiquetasX.push([t * mx, es(t.toFixed(dec))]);
    }
    if (y.log) {
      const pxDec = (y1 - y0) / Math.max(1e-9, Math.log10(y.max / y.min));
      const saltoY = Math.max(1, Math.ceil(17 / pxDec));
      for (let d = Math.ceil(Math.log10(y.min) - 1e-9); d <= Math.log10(y.max) + 1e-9; d++) {
        if (d % saltoY === 0) etiquetasY.push([10 ** d, siCorto(10 ** d, y.unidad)]);
        else rejillaY.push(10 ** d);
        if (pxDec > 40) for (let k = 2; k < 10; k++) if (10 ** d * k < y.max) rejillaY.push(10 ** d * k);
      }
    } else {
      const { v, paso } = marcas(y.min / my, y.max / my, nY);
      const dec = Math.max(0, -Math.floor(Math.log10(paso) + 1e-9));
      for (const t of v) etiquetasY.push([t * my, es(t.toFixed(dec))]);
    }
    ctx.strokeStyle = P.rejilla;
    ctx.beginPath();
    for (const g of rejillaX) {
      const p = Math.round(tx(g)) + 0.5;
      ctx.moveTo(p, y0);
      ctx.lineTo(p, y1);
    }
    for (const g of rejillaY) {
      const p = Math.round(ty(g)) + 0.5;
      ctx.moveTo(x0, p);
      ctx.lineTo(x1, p);
    }
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    for (const [g] of etiquetasX) {
      const p = Math.round(tx(g)) + 0.5;
      ctx.moveTo(p, y0);
      ctx.lineTo(p, y1);
    }
    for (const [g] of etiquetasY) {
      const p = Math.round(ty(g)) + 0.5;
      ctx.moveTo(x0, p);
      ctx.lineTo(x1, p);
    }
    ctx.stroke();

    ctx.fillStyle = P.suave;
    ctx.font = `500 ${tam}px ${FAMILIA}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let ultimoX = -1e9;
    for (const [g, s] of etiquetasX) {
      const p = tx(g);
      const w = ctx.measureText(s).width;
      if (p - w / 2 < ultimoX + 6) continue;
      ctx.fillText(s, p, y1 + 5);
      ultimoX = p + w / 2;
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const [g, s] of etiquetasY) ctx.fillText(s, x0 - 6, ty(g));

    // Zero lines.
    ctx.strokeStyle = P.linea;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (!y.log && y.min < 0 && y.max > 0) {
      const p = Math.round(ty(0)) + 0.5;
      ctx.moveTo(x0, p);
      ctx.lineTo(x1, p);
    }
    if (!x.log && x.min < 0 && x.max > 0) {
      const p = Math.round(tx(0)) + 0.5;
      ctx.moveTo(p, y0);
      ctx.lineTo(p, y1);
    }
    ctx.stroke();

    // Axis titles.
    ctx.fillStyle = P.suave;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const ux = x.log || !x.unidad ? '' : ` (${px}${x.unidad})`;
    const uy = y.log || !y.unidad ? '' : ` (${py}${y.unidad})`;
    texto(ctx, x.etiqueta + ux, (x0 + x1) / 2, alto - 6, tam, 600);
    ctx.textAlign = 'left';
    texto(ctx, y.etiqueta + uy, 6, arr - 9, tam, 600);
    if (titulo) {
      ctx.fillStyle = P.tinta;
      texto(ctx, titulo, 6, 14, 13, 700);
    }

    // Series (clipped to the plot area).
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0 - 1, x1 - x0, y1 - y0 + 2);
    ctx.clip();
    for (const l of lineas) {
      ctx.strokeStyle = l.color ?? P.suave;
      ctx.lineWidth = 1.3;
      ctx.setLineDash(l.discontinua === false ? [] : [5, 4]);
      ctx.beginPath();
      if (l.x !== undefined) {
        const p = tx(l.x);
        ctx.moveTo(p, y0);
        ctx.lineTo(p, y1);
      }
      if (l.y !== undefined) {
        const p = ty(l.y);
        ctx.moveTo(x0, p);
        ctx.lineTo(x1, p);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    series.forEach((s, i) => {
      const n = Math.min(s.x.length, s.y.length);
      if (n < 2) return;
      ctx.strokeStyle = s.color ?? P.serie[i % P.serie.length]!;
      ctx.lineWidth = s.ancho ?? 2.2;
      ctx.globalAlpha = s.alfa ?? 1;
      ctx.lineJoin = 'round';
      ctx.setLineDash(s.discontinua ? [6, 4] : []);
      ctx.beginPath();
      let pendiente = true;
      for (let k = 0; k < n; k++) {
        const vx = s.x[k]!;
        const vy = s.y[k]!;
        if (!Number.isFinite(vx) || !Number.isFinite(vy) || (y.log && vy <= 0) || (x.log && vx <= 0)) {
          pendiente = true;
          continue;
        }
        const X = tx(vx);
        const Y = Math.max(-1e4, Math.min(1e4, ty(vy)));
        if (pendiente) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
        pendiente = false;
      }
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.restore();

    // Line labels.
    ctx.font = `600 11px ${FAMILIA}`;
    for (const l of lineas) {
      if (!l.etiqueta) continue;
      ctx.fillStyle = l.color ?? P.suave;
      if (l.x !== undefined) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        texto(ctx, l.etiqueta, tx(l.x) + 4, y0 + 4, 11, 700);
      } else if (l.y !== undefined) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        texto(ctx, l.etiqueta, x1 - 4, ty(l.y) - 3, 11, 700);
      }
    }

    // Operating points.
    for (const p of puntos) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const X = tx(p.x);
      const Y = ty(p.y);
      if (X < x0 - 2 || X > x1 + 2 || Y < y0 - 2 || Y > y1 + 2) continue;
      const col = p.color ?? P.acento;
      ctx.fillStyle = alfa(col, 0.22);
      ctx.beginPath();
      ctx.arc(X, Y, (p.r ?? 5) * 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.strokeStyle = P.panel;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X, Y, p.r ?? 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (p.etiqueta) {
        ctx.fillStyle = col;
        const derecha = X < (x0 + x1) / 2;
        ctx.textAlign = derecha ? 'left' : 'right';
        ctx.textBaseline = 'bottom';
        texto(ctx, p.etiqueta, X + (derecha ? 9 : -9), Y - 6, 12, 700);
      }
    }

    // Legend.
    const nombradas = series.filter((s) => s.nombre);
    if (nombradas.length) {
      let lx = x1;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      for (let i = nombradas.length - 1; i >= 0; i--) {
        const s = nombradas[i]!;
        const idx = series.indexOf(s);
        ctx.font = `600 11px ${FAMILIA}`;
        const w = ctx.measureText(s.nombre!).width;
        ctx.fillStyle = alfa(P.panel, 0.85);
        ctx.fillStyle = P.suave;
        texto(ctx, s.nombre!, lx, y0 - 10, 11, 600);
        ctx.strokeStyle = s.color ?? P.serie[idx % P.serie.length]!;
        ctx.lineWidth = 2.4;
        ctx.setLineDash(s.discontinua ? [4, 3] : []);
        ctx.beginPath();
        ctx.moveTo(lx - w - 18, y0 - 10);
        ctx.lineTo(lx - w - 5, y0 - 10);
        ctx.stroke();
        ctx.setLineDash([]);
        lx -= w + 30;
      }
    }

    // Frame.
    ctx.strokeStyle = P.linea;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
  }

  $effect(() => {
    dibujar();
  });

  onMount(() => {
    const ro = new ResizeObserver((e) => {
      const w = e[0]?.contentRect.width ?? 0;
      if (Math.abs(w - ancho) > 0.5) ancho = w;
    });
    if (caja) ro.observe(caja);
    return () => ro.disconnect();
  });
</script>

<div class="grafica" bind:this={caja} style:height={`${alto}px`}>
  <canvas bind:this={lienzo} style:width={`${ancho}px`} style:height={`${alto}px`} aria-hidden="true"></canvas>
</div>

<style>
  .grafica {
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    background: var(--superficie);
    box-shadow: 0 0 0 1px var(--linea);
  }
  canvas {
    display: block;
  }
</style>
