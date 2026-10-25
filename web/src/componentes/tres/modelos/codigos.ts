// Markings computed from a part's value: E series, IEC 60062 colour bands (book 2.4), SMD resistor codes
// (three digits, four digits, R as decimal point, EIA-96; book 2.5), the «104» capacitor code and short
// value texts in the book's style («4,7 kΩ», «4k7», «100 µF»). Plain TypeScript, no three.js.

export const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
export const E24 = [
  1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1,
];
/** E96 (1 %): the EIA-96 code is the 1-based index in this table. */
export const E96 = [
  1.0, 1.02, 1.05, 1.07, 1.1, 1.13, 1.15, 1.18, 1.21, 1.24, 1.27, 1.3, 1.33, 1.37, 1.4, 1.43, 1.47, 1.5, 1.54, 1.58, 1.62,
  1.65, 1.69, 1.74, 1.78, 1.82, 1.87, 1.91, 1.96, 2.0, 2.05, 2.1, 2.15, 2.21, 2.26, 2.32, 2.37, 2.43, 2.49, 2.55, 2.61,
  2.67, 2.74, 2.8, 2.87, 2.94, 3.01, 3.09, 3.16, 3.24, 3.32, 3.4, 3.48, 3.57, 3.65, 3.74, 3.83, 3.92, 4.02, 4.12, 4.22,
  4.32, 4.42, 4.53, 4.64, 4.75, 4.87, 4.99, 5.11, 5.23, 5.36, 5.49, 5.62, 5.76, 5.9, 6.04, 6.19, 6.34, 6.49, 6.65, 6.81,
  6.98, 7.15, 7.32, 7.5, 7.68, 7.87, 8.06, 8.25, 8.45, 8.66, 8.87, 9.09, 9.31, 9.53, 9.76,
];

/** 1 % ranges are sold in E96 and E24 values (2,2 kΩ ±1 % exists): the union, for five bands and four digits. */
export const E96_E24 = [...new Set([...E96, ...E24])].sort((a, b) => a - b);

export type Serie = 'E12' | 'E24' | 'E96' | 'E96+E24';
const SERIES: Record<Serie, number[]> = { E12, E24, E96, 'E96+E24': E96_E24 };

/** Nearest value of an E series (log distance). */
export function normalizar(valor: number, serie: Serie = 'E24'): number {
  if (!(valor > 0) || !Number.isFinite(valor)) return 0;
  const dec = Math.floor(Math.log10(valor) + 1e-9);
  const m = valor / 10 ** dec;
  let mejor = 1;
  let d = Infinity;
  for (const e of [...SERIES[serie], 10]) {
    const x = Math.abs(Math.log(m / e));
    if (x < d) {
      d = x;
      mejor = e;
    }
  }
  return redondear(mejor * 10 ** dec);
}

/** Removes floating point noise (4.7 × 10³ = 4700.000000001). */
export function redondear(v: number): number {
  if (v === 0) return 0;
  const e = Math.floor(Math.log10(Math.abs(v)));
  const f = 10 ** (5 - e);
  return Math.round(v * f) / f;
}

// ------------------------------------------------------------------ IEC 60062 colours

export interface ColorBanda {
  nombre: string;
  /** sRGB of a printed band (slightly desaturated, as on real paint). */
  hex: string;
  digito?: number;
  /** Power of ten as multiplier. */
  mult?: number;
  /** Tolerance in %. */
  tol?: number;
  metal?: boolean;
}

export const COLORES: Record<string, ColorBanda> = {
  plata: { nombre: 'plateado', hex: '#b9bcc0', mult: -2, tol: 10, metal: true },
  oro: { nombre: 'dorado', hex: '#c9a23a', mult: -1, tol: 5, metal: true },
  negro: { nombre: 'negro', hex: '#151515', digito: 0, mult: 0 },
  marron: { nombre: 'marrón', hex: '#6e3b1f', digito: 1, mult: 1, tol: 1 },
  rojo: { nombre: 'rojo', hex: '#c0261f', digito: 2, mult: 2, tol: 2 },
  naranja: { nombre: 'naranja', hex: '#e8701c', digito: 3, mult: 3 },
  amarillo: { nombre: 'amarillo', hex: '#f2c81c', digito: 4, mult: 4 },
  verde: { nombre: 'verde', hex: '#2f8f3a', digito: 5, mult: 5, tol: 0.5 },
  azul: { nombre: 'azul', hex: '#2456b8', digito: 6, mult: 6, tol: 0.25 },
  violeta: { nombre: 'violeta', hex: '#7a3fa8', digito: 7, mult: 7, tol: 0.1 },
  gris: { nombre: 'gris', hex: '#8a8a8a', digito: 8, mult: 8, tol: 0.05 },
  blanco: { nombre: 'blanco', hex: '#f2f0ea', digito: 9, mult: 9 },
};

const POR_DIGITO = ['negro', 'marron', 'rojo', 'naranja', 'amarillo', 'verde', 'azul', 'violeta', 'gris', 'blanco'];

function colorMult(e: number): string {
  if (e === -1) return 'oro';
  if (e === -2) return 'plata';
  return POR_DIGITO[Math.max(0, Math.min(9, e))]!;
}

function colorTol(tol: number): string {
  const t = Object.entries(COLORES).find(([, c]) => c.tol === tol);
  return t ? t[0] : 'oro';
}

/**
 * Colour bands of a resistor value: 4 bands (two digits) or 5 bands (three digits); the value is snapped to
 * E24 (4 bands) or E96 (5 bands) first. Returns the colour keys of COLORES, first band first.
 */
export function bandas(valor: number, n: 4 | 5 = 4, tol?: number): { claves: string[]; valor: number; tol: number } {
  const t = tol ?? (n === 5 ? 1 : 5);
  const v = normalizar(Math.max(0.01, valor), n === 5 ? 'E96+E24' : 'E24');
  const cifras = n === 5 ? 3 : 2;
  // value = digits × 10^e with `cifras` digits.
  let e = Math.floor(Math.log10(v) + 1e-9) - (cifras - 1);
  let dig = Math.round(v / 10 ** e);
  if (dig >= 10 ** cifras) {
    dig = Math.round(dig / 10);
    e++;
  }
  e = Math.max(-2, Math.min(9, e));
  const ds = String(dig).padStart(cifras, '0').split('').map(Number);
  return { claves: [...ds.map((d) => POR_DIGITO[d]!), colorMult(e), colorTol(t)], valor: redondear(dig * 10 ** e), tol: t };
}

// ------------------------------------------------------------------ SMD resistor codes (book 2.5)

const LETRAS_EIA96: [string, number][] = [
  ['Z', -3],
  ['Y', -2],
  ['R', -2],
  ['X', -1],
  ['S', -1],
  ['A', 0],
  ['B', 1],
  ['H', 1],
  ['C', 2],
  ['D', 3],
  ['E', 4],
  ['F', 5],
];

/**
 * Marking of an SMD resistor: 'tres' («472», «4R7», «R22», «0»), 'cuatro' («4702») or 'eia96' («01A», «68C»;
 * the value is snapped to E96).
 */
export function codigoSmd(valor: number, sistema: 'tres' | 'cuatro' | 'eia96' = 'tres'): string {
  if (!(valor > 0)) return sistema === 'tres' ? '0' : '000';
  if (sistema === 'eia96') {
    const v = normalizar(valor, 'E96');
    const dec = Math.floor(Math.log10(v) + 1e-9);
    const m = v / 10 ** dec;
    const i = E96.findIndex((e) => Math.abs(e - m) < 1e-6);
    // code value = E96 × 100 × 10^k  →  k = dec − 2
    const k = dec - 2;
    const letra = LETRAS_EIA96.find(([, p]) => p === k)?.[0] ?? '?';
    return `${String(i + 1).padStart(2, '0')}${letra}`;
  }
  const cifras = sistema === 'cuatro' ? 3 : 2;
  const v = normalizar(valor, sistema === 'cuatro' ? 'E96+E24' : 'E24');
  if (v < 10 ** (cifras - 1) * 1) {
    // Below 10 Ω (three digits) or 100 Ω (four digits): R as the decimal point.
    const txt = redondear(v).toString();
    if (v < 1) return 'R' + txt.replace(/^0\./, '').padEnd(cifras - 1, '0').slice(0, cifras);
    return txt.replace('.', 'R').padEnd(cifras + 1, '0').slice(0, cifras + 1);
  }
  const e = Math.floor(Math.log10(v) + 1e-9) - (cifras - 1);
  const dig = Math.round(v / 10 ** e);
  return `${dig}${e}`;
}

/** Capacitor code: «104» = 10 × 10⁴ pF = 100 nF; values below 10 pF as «4p7». */
export function codigoCondensador(faradios: number): string {
  const pf = redondear(faradios * 1e12);
  if (pf < 10) return String(pf).replace('.', 'p');
  const e = Math.floor(Math.log10(pf) + 1e-9) - 1;
  const dig = Math.round(pf / 10 ** e);
  return `${dig}${e}`;
}

// ------------------------------------------------------------------ value texts

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

/** «4,7 kΩ», «100 µF», «10 mH» (Spanish decimal comma, up to three significant digits). */
export function textoValor(v: number, unidad: string): string {
  if (!(v > 0)) return `0 ${unidad}`;
  const [k, p] = PREF.find(([m]) => v >= m * 0.9995) ?? PREF[PREF.length - 1]!;
  const x = redondear(v / k);
  const s = Number(x.toPrecision(3)).toString().replace('.', ',');
  return `${s} ${p}${unidad}`;
}

/** RKM code as printed on parts and schematics: «4k7», «100R», «2M2», «4µ7». */
export function rkm(v: number, unidad: 'Ω' | 'F' | 'H' = 'Ω'): string {
  if (!(v > 0)) return '0';
  const tabla = unidad === 'Ω' ? PREF.filter(([m]) => m >= 1) : PREF;
  const [k, p] = tabla.find(([m]) => v >= m * 0.9995) ?? tabla[tabla.length - 1]!;
  const x = Number(redondear(v / k).toPrecision(3));
  const letra = p || (unidad === 'Ω' ? 'R' : '');
  const [ent, dec] = String(x).split('.');
  return dec ? `${ent}${letra}${dec}` : `${ent}${letra}`;
}

/** Reads a value written like the book: «4,7k», «4k7», «100n», «2,2 MΩ», «10µ», «47». */
export function leerValor(txt: string | number | boolean | undefined, porDefecto: number): number {
  if (typeof txt === 'number') return Number.isFinite(txt) ? txt : porDefecto;
  if (typeof txt !== 'string') return porDefecto;
  const t = txt.trim().replace(/\s+/g, '').replace(',', '.').replace(/[ΩFHVfh]$/u, '').replace('u', 'µ');
  const m = /^(\d*\.?\d*)([pnµmkMGR]?)(\d*)$/u.exec(t);
  if (!m || (!m[1] && !m[3])) return porDefecto;
  const mult: Record<string, number> = { p: 1e-12, n: 1e-9, µ: 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9, R: 1, '': 1 };
  const base = m[3] ? Number(`${m[1] || '0'}.${m[3]}`) : Number(m[1]);
  const v = base * (mult[m[2] ?? ''] ?? 1);
  return Number.isFinite(v) && v > 0 ? redondear(v) : porDefecto;
}
