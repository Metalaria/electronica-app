// 1.1 lessons: the ticks of a graph's axes and which of their labels are drawn (GraficaLeccion.svelte). A log axis of
// many decades has one tick per decade, and with units each label is long («100 MHz», «10¹⁰ cm⁻³»): drawn all at once
// they overlap. So every tick keeps its grid line, but only the labels that fit are drawn: on a log axis the decades
// first, every s-th decade (s = 1, 2, 3…, the smallest that fits; exponents multiple of s, so 10⁰, 10³, 10⁶…), and the
// 2 and 5 within them only if all the decades fit and they do too; on a linear axis every s-th tick. Widths are an
// estimate of the 12 px label font in viewBox units (the SVG scales as a whole, so they hold at any screen width).
import { formatoValor } from '../../componentes/calculadoras/unidades';
import type { Eje } from './tipos';

/**
 * Font size of the tick labels (px of the viewBox) on a wide screen, as in GraficaLeccion.svelte `.marca`. On a narrow
 * one the drawing scales down, so the component asks for a bigger size (review 11c: at 360 px the 12 px labels were
 * drawn at about 9 px; `tamMarca` keeps them at 11 px or more) and everything below is laid out for that size.
 */
export const TAM_MARCA = 12;

/** Label size (viewBox px) that renders at least 11 px when the drawing is `anchoPx` screen pixels wide. */
export function tamMarca(anchoPx: number, W: number = LIENZO.W): number {
  if (!(anchoPx > 0)) return TAM_MARCA;
  return Math.min(16, Math.max(TAM_MARCA, Math.ceil(((11.2 * W) / anchoPx) * 2) / 2));
}
/** Minimum free space between two labels. */
const HUECO = 6;

/** Ticks of an axis: 1, 2 or 5 × 10ⁿ; on a log axis the decades (and 2 and 5 within them if there are few). */
export function marcasEje(e: Pick<Eje, 'min' | 'max' | 'escala'>): number[] {
  const { min, max } = e;
  if (e.escala === 'log') {
    const out: number[] = [];
    const d0 = Math.floor(Math.log10(min));
    const d1 = Math.ceil(Math.log10(max));
    const pasos = d1 - d0 <= 2 ? [1, 2, 5] : [1];
    for (let d = d0; d <= d1; d++) for (const k of pasos) {
      const v = Number((k * 10 ** d).toPrecision(12));
      if (v >= min * (1 - 1e-9) && v <= max * (1 + 1e-9)) out.push(v);
    }
    return out;
  }
  const bruto = (max - min) / 5;
  const p = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 5, 10].map((k) => k * p).find((k) => k >= bruto) ?? 10 * p;
  const out: number[] = [];
  for (let v = Math.ceil(min / paso) * paso; v <= max + paso * 1e-9; v += paso) out.push(Number(v.toPrecision(12)));
  return out;
}

/** Label of a tick: the value with its unit; on a log axis a bare power of ten («10¹⁰», not «1 × 10¹⁰»). */
export function etiquetaMarca(v: number, e: Pick<Eje, 'unidad' | 'escala'>): string {
  if (v === 0) return '0';
  // (review 11c: «1 veces» on the axis of cap04/sec-4.9)
  if (e.unidad === 'veces' && Math.abs(v - 1) < 1e-12) return '1 vez';
  const t = formatoValor(v, e.unidad, 2, true);
  return e.escala === 'log' ? t.replace(/^1\s×\s10(?=[⁰¹²³⁴⁵⁶⁷⁸⁹⁻])/u, '10') : t;
}

/** Estimated width of a label in the tick font (Inter 500, `tam` px): narrow punctuation, superscripts, wide capitals. */
export function anchoEtiqueta(t: string, tam: number = TAM_MARCA): number {
  let w = 0;
  for (const c of t) {
    if (/[\s,.·]/u.test(c)) w += 0.3;
    else if (/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/u.test(c)) w += 0.42;
    else if (/[MWmΩHGw×]/u.test(c)) w += 0.85;
    else if (/[ilIj1|/]/u.test(c)) w += 0.4;
    else w += 0.62;
  }
  return w * tam;
}

export interface EtiquetaEje {
  v: number;
  texto: string;
  /** Drawn or not (the tick's grid line is always drawn). */
  visible: boolean;
  /** Text anchor of an x label: the first and last move inwards if they would leave the drawing. */
  ancla: 'start' | 'middle' | 'end';
}

const esDecada = (v: number) => {
  const m = Math.abs(v) / 10 ** Math.floor(Math.log10(Math.abs(v)));
  return Math.abs(m - 1) < 1e-9 || Math.abs(m - 10) < 1e-9;
};

/**
 * The labels of an axis and which are drawn. `pos(v)` is the tick's position in viewBox units along the axis (x grows
 * to the right, y downwards); `vertical` is the y axis (labels stacked: their height is what must not overlap). For
 * an x axis, `limites` is the drawing's horizontal extent the labels must stay inside.
 */
export function etiquetasEje(
  e: Pick<Eje, 'min' | 'max' | 'unidad' | 'escala'>,
  pos: (v: number) => number,
  vertical: boolean,
  limites: [number, number] = [-Infinity, Infinity],
  tam: number = TAM_MARCA,
): EtiquetaEje[] {
  const vs = marcasEje(e);
  const out: EtiquetaEje[] = vs.map((v) => ({ v, texto: etiquetaMarca(v, e), visible: false, ancla: 'middle' }));
  const tramo = out.map((et): [number, number] => {
    const p = pos(et.v);
    if (vertical) return [p - tam / 2, p + tam / 2];
    const w = anchoEtiqueta(et.texto, tam);
    if (p - w / 2 < limites[0]) {
      et.ancla = 'start';
      return [p, p + w];
    }
    if (p + w / 2 > limites[1]) {
      et.ancla = 'end';
      return [p - w, p];
    }
    return [p - w / 2, p + w / 2];
  });
  const cabe = (sel: number[]) => {
    const t = sel.map((k) => tramo[k]!).sort((a, b) => a[0] - b[0]);
    for (let k = 1; k < t.length; k++) if (t[k]![0] < t[k - 1]![1] + HUECO) return false;
    return true;
  };
  const indices = out.map((_, k) => k);
  const log = e.escala === 'log';
  const decadas = log ? indices.filter((k) => esDecada(out[k]!.v)) : [];
  const base = decadas.length ? decadas : indices;
  const resto = decadas.length ? indices.filter((k) => !decadas.includes(k)) : [];
  // a log axis counts the stride by the exponent, a linear one by the tick's index from the zero tick (if there is one)
  const cero = Math.max(0, vs.indexOf(0));
  const orden = (k: number) => (log ? Math.round(Math.log10(out[k]!.v)) : k - cero);
  let elegidos: number[] = [];
  for (let s = 1; s <= Math.max(1, base.length); s++) {
    const sel = base.filter((k) => ((orden(k) % s) + s) % s === 0);
    if (sel.length && cabe(sel)) {
      elegidos = sel;
      if (s === 1) for (const k of resto) if (cabe([...elegidos, k])) elegidos.push(k);
      break;
    }
  }
  // nothing fits at any stride (a single huge label): draw the first one only
  if (!elegidos.length && base.length) elegidos = [base[0]!];
  for (const k of elegidos) out[k]!.visible = true;
  return out;
}

/** The plot's drawing (viewBox units) as GraficaLeccion.svelte draws it (`aba` with 12 px labels: see `abajo`). */
export const LIENZO = { W: 380, H: 230, der: 10, arr: 12, aba: 34, izqMin: 52, izqMax: 120 } as const;

/** Bottom margin for labels of `tam` px: the x labels and, under them, the axis's name (34 at 12 px). */
const abajo = (tam: number) => Math.round(2.2 * tam + 7.6);
/** Baseline of the x labels below the plot, and the vertical shift of a y label's baseline from its tick. */
export const baseX = (tam: number) => 4 + tam;
export const bajaY = (tam: number) => Math.round(tam / 3);

/** Position 0–1 of a value along an axis (linear or logarithmic). */
export const fraccionEje = (e: Pick<Eje, 'min' | 'max' | 'escala'>, v: number) =>
  e.escala === 'log' ? Math.log(v / e.min) / Math.log(e.max / e.min) : (v - e.min) / (e.max - e.min);

/**
 * Margins, scales and tick labels of a plot. The left margin grows with the widest drawn y label (up to `izqMax`), so a
 * long unit («10²⁰ cm⁻³») is not cut by the drawing's edge; the x labels are thinned with the resulting width.
 */
export function geometriaGrafica(x: Pick<Eje, 'min' | 'max' | 'unidad' | 'escala'>, y: Pick<Eje, 'min' | 'max' | 'unidad' | 'escala'>, tam: number = TAM_MARCA) {
  const { W, H, der, arr, izqMin, izqMax } = LIENZO;
  const aba = abajo(tam);
  const alto = H - arr - aba;
  const sy = (v: number) => arr + (1 - fraccionEje(y, v)) * alto;
  const etqY = etiquetasEje(y, sy, true, undefined, tam);
  const anchoY = Math.max(0, ...etqY.filter((e) => e.visible).map((e) => Math.ceil(anchoEtiqueta(e.texto, tam))));
  // (the widest margin grows with the labels' size: «100 000 000 veces» at a phone's 14,5 px; a label that would
  // still not fit is not drawn rather than cut by the drawing's edge)
  const izq = Math.min(Math.round((izqMax * tam) / TAM_MARCA), Math.max(izqMin, anchoY + 10));
  for (const e of etqY) if (e.visible && anchoEtiqueta(e.texto, tam) > izq - 6) e.visible = false;
  const ancho = W - izq - der;
  const sx = (v: number) => izq + fraccionEje(x, v) * ancho;
  // Review 11c: at the origin's corner the lowest y label («0», «1 µA») and the first x label («−200 V», centred on the
  // y axis) ran into each other. When a y label is drawn down there, no x label may reach left of the y axis: the first
  // one is anchored at the axis instead (or thinned out if it then meets the second).
  const yAbajo = etqY.some((e) => e.visible && sy(e.v) > H - aba - tam);
  const etqX = etiquetasEje(x, sx, false, [yAbajo ? izq - 2 : 0, W], tam);
  return { W, H, M: { izq, der, arr, aba }, ancho, alto, sx, sy, etqX, etqY, tam };
}
