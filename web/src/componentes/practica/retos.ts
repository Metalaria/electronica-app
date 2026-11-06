// 1.0 «Reto manipulando la figura»: the slider positions of a knob and the checker of a reading against the target.
// Pure (no runtime imports beyond plain modules): the generator (web/scripts/retos10.mjs), the app (Reto.svelte) and
// the tests use the same rules.

import { formatoValor } from '../calculadoras/unidades.ts';

/** The E96 series (1 % resistors), one decade. */
export const E96 = [
  1.0, 1.02, 1.05, 1.07, 1.1, 1.13, 1.15, 1.18, 1.21, 1.24, 1.27, 1.3, 1.33, 1.37, 1.4, 1.43, 1.47, 1.5, 1.54, 1.58, 1.62, 1.65, 1.69, 1.74,
  1.78, 1.82, 1.87, 1.91, 1.96, 2.0, 2.05, 2.1, 2.15, 2.21, 2.26, 2.32, 2.37, 2.43, 2.49, 2.55, 2.61, 2.67, 2.74, 2.8, 2.87, 2.94, 3.01,
  3.09, 3.16, 3.24, 3.32, 3.4, 3.48, 3.57, 3.65, 3.74, 3.83, 3.92, 4.02, 4.12, 4.22, 4.32, 4.42, 4.53, 4.64, 4.75, 4.87, 4.99, 5.11, 5.23,
  5.36, 5.49, 5.62, 5.76, 5.9, 6.04, 6.19, 6.34, 6.49, 6.65, 6.81, 6.98, 7.15, 7.32, 7.5, 7.68, 7.87, 8.06, 8.25, 8.45, 8.66, 8.87, 9.09,
  9.31, 9.53, 9.76,
];

/** E96 values in [a, b], 3 significant figures. */
export function serieE96(a: number, b: number): number[] {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const r: number[] = [];
  for (let d = Math.floor(Math.log10(lo)) - 1; d <= Math.ceil(Math.log10(hi)); d++) {
    for (const m of E96) {
      const v = Number((m * 10 ** d).toPrecision(3));
      if (v >= lo * 0.999 && v <= hi * 1.001) r.push(v);
    }
  }
  return r;
}

/** A «round» step near x: 1, 2 or 5 × 10^n. */
export function pasoRedondo(x: number): number {
  const e = 10 ** Math.floor(Math.log10(x));
  const m = x / e;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : 5) * e;
}

/**
 * Slider positions of a knob: resistors (Ω) over E96 ×0,1…×10 of the book's value; sources (V, A) in even steps of
 * about 1 % of the book's value from ×¼ to ×2,5. The book's own value is always a position.
 */
export function posicionesMando(unidad: string, de: number): number[] {
  const a = Math.abs(de);
  const s = de < 0 ? -1 : 1;
  let v: number[];
  if (unidad === 'Ω') v = serieE96(a / 10, a * 10);
  else {
    const paso = pasoRedondo(a / 100);
    const n0 = Math.ceil(a / 4 / paso);
    const n1 = Math.floor((a * 2.5) / paso);
    v = [];
    for (let n = n0; n <= n1; n++) v.push(Number((n * paso).toPrecision(6)));
  }
  if (!v.some((x) => Math.abs(x - a) <= a * 1e-9)) v.push(a);
  return v.sort((x, y) => x - y).map((x) => s * x);
}

/** Index of the position nearest to a value (log distance). */
export function posicionDe(valores: number[], v: number): number {
  let k = 0;
  for (let i = 0; i < valores.length; i++) {
    if (Math.abs(Math.log(Math.abs(valores[i]!) / Math.abs(v))) < Math.abs(Math.log(Math.abs(valores[k]!) / Math.abs(v)))) k = i;
  }
  return k;
}

export function textoValor(v: number, unidad: string): string {
  return formatoValor(v, unidad, 3, true);
}

export interface EvaluacionReto {
  bien: boolean;
  /** Signed relative difference to the target (lectura − objetivo) / |objetivo|. */
  rel: number;
  /** 0 (far, ≥ 100 % off) … 1 (on target): for the closeness meter. */
  cercania: number;
  /** «Le faltan 1,9 V para llegar a 6 V (−32 %).», plain text. */
  mensaje: string;
}

/**
 * A reading against the target. Magnitudes compare by absolute value (a current read with the opposite sign
 * convention is the same current); right when |lectura − objetivo| ≤ tol · |objetivo|.
 */
export function evaluarReto(lectura: number | null, objetivo: number, tol: number, unidad: string, nombre: string): EvaluacionReto {
  if (lectura == null || !Number.isFinite(lectura)) return { bien: false, rel: Number.NaN, cercania: 0, mensaje: 'No se pudo simular el circuito con estos valores.' };
  const a = Math.abs(lectura);
  const o = Math.abs(objetivo);
  const rel = (a - o) / o;
  const bien = Math.abs(a - o) <= tol * o + 1e-15;
  const cercania = Math.max(0, Math.min(1, 1 - Math.abs(rel)));
  const pct = Math.round(rel * 100);
  const pctTxt = pct === 0 ? (rel < 0 ? '−1 %' : '+1 %') : `${pct > 0 ? '+' : '−'}${Math.abs(pct)} %`;
  const dif = textoValor(Math.abs(a - o), unidad);
  let mensaje: string;
  if (bien) mensaje = `${mayuscula(nombre)} es ${textoValor(a, unidad)}: dentro de ${textoValor(o, unidad)} ± ${Math.round(tol * 100)} %.`;
  else if (rel < 0) mensaje = `${mayuscula(nombre)} es ${textoValor(a, unidad)}: le faltan ${dif} para llegar a ${textoValor(o, unidad)} (${pctTxt}).`;
  else mensaje = `${mayuscula(nombre)} es ${textoValor(a, unidad)}: le sobran ${dif} sobre ${textoValor(o, unidad)} (${pctTxt}).`;
  return { bien, rel, cercania, mensaje };
}

/** «Para que suba, R2 tiene que aumentar»: what to do with a knob given where the reading is (plain text). */
export function consejoMando(rel: number, efecto: 'sube' | 'baja', nombreMando: string, nombreObs: string): string {
  const subir = rel < 0;
  const aumentar = subir === (efecto === 'sube');
  return `Para que ${nombreObs} ${subir ? 'suba' : 'baje'}, ${nombreMando} tiene que ${aumentar ? 'aumentar' : 'disminuir'}.`;
}

function mayuscula(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/** HTML → plain text for the messages. */
export function plano(h: string): string {
  return h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
