// Reading and checking the reader's numeric answers: «4,7 kΩ», «4k7», «2,2 µF», «1,2e-3», «−6 dB»,
// decimal comma, SI prefixes, optional unit. The same rules as contenido/ejercicios.py (units in SI base).

export interface Esperado {
  /** Value in the bare unit (440 for 440 Ω, 0.02 for 20 mA). */
  valor: number;
  /** Bare unit: 'Ω', 'A', 'dB', '%', '' … */
  unidad: string;
  /** Relative tolerance (0.02 = 2 %). */
  tol?: number;
  /** Absolute tolerance in the bare unit (used instead of `tol`). */
  tol_abs?: number;
  /** Display text as in the book. */
  texto: string;
  nota?: string;
}

export interface Lectura {
  /** Value in the expected bare unit. */
  valor: number;
  /** The reader typed a unit (or a prefix). */
  conUnidad: boolean;
}

export type Veredicto =
  | { tipo: 'vacio' }
  | { tipo: 'ilegible'; mensaje: string }
  | { tipo: 'unidad'; mensaje: string }
  | { tipo: 'bien'; nota?: string; texto: string }
  | { tipo: 'cerca'; mensaje: string }
  | { tipo: 'mal'; mensaje: string };

const PREFIJOS: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  µ: 1e-6,
  u: 1e-6,
  m: 1e-3,
  c: 1e-2,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
};

/** Units that take SI prefixes. */
const PREFIJABLES = new Set([
  'Ω', 'V', 'A', 'W', 'F', 'H', 'Hz', 's', 'J', 'C', 'S', 'Wb', 'T', 'VA', 'var', 'Wh', 'Ah', 'm', 'g', 'bit/s',
  'b/s', 'B', 'bit', 'Bd', 'baud', 'Pa', 'N', 'VAr', 'lm', 'lx', 'cd', 'Sa/s', 'S/s', 'FLOPS', 'V/s', 'A/s', 'V/V', 'rad/s',
]);

/** Spellings the reader may use for a unit. */
const ALIAS: Record<string, string> = {
  ohm: 'Ω',
  ohms: 'Ω',
  ohmio: 'Ω',
  ohmios: 'Ω',
  r: 'Ω',
  R: 'Ω',
  '\u2126': 'Ω',
  mm2: 'mm²',
  m2: 'm²',
  grados: '°',
  grado: '°',
  º: '°',
  ºC: '°C',
  hz: 'Hz',
  HZ: 'Hz',
  hercios: 'Hz',
  v: 'V',
  voltios: 'V',
  a: 'A',
  amperios: 'A',
  w: 'W',
  vatios: 'W',
  f: 'F',
  faradios: 'F',
  henrios: 'H',
  seg: 's',
  segundos: 's',
  horas: 'h',
  db: 'dB',
  DB: 'dB',
  dbm: 'dBm',
  dBM: 'dBm',
  'V·A': 'VA',
  va: 'VA',
  ppm: 'ppm',
  'ppm/ºC': 'ppm/°C',
  'ºC/W': '°C/W',
};

const SUPERINDICES: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+',
};

function normalizarUnidad(u: string): string {
  const t = u.trim().replace(/μ/g, 'µ').replace(/\s+/g, '');
  return ALIAS[t] ?? t;
}

/** Reads a written number (decimal comma or point, thousands with spaces, exponent). Returns [value, rest]. */
function leerNumero(texto: string): [number, string] | null {
  let t = texto
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/[    ]/g, ' ')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]/g, (c) => SUPERINDICES[c] ?? c);
  // thousands separated by spaces: «2 200 000»
  t = t.replace(/(\d) (?=\d{3}(?!\d))/g, '$1');
  // a leading «×» or «x» (factors: «×200»)
  t = t.replace(/^[×x*]\s*(?=[\d.,+-])/, '');
  const m = /^([+-]?)(\d+(?:[.,]\d*)?|[.,]\d+)(?:\s*(?:[eE]([+-]?\d+)|[×x·*]\s*10\s*(?:\^\s*\(?\s*([+-]?\d+)\s*\)?|([+-]?\d+))))?/.exec(t);
  if (!m) return null;
  let cifras = m[2]!;
  // «2.200» with a dot and exactly three digits after it, and a non-zero integer part: Spanish thousands
  if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(cifras)) cifras = cifras.replace(/\./g, '');
  let v = Number(cifras.replace(',', '.'));
  const exp = m[3] ?? m[4] ?? m[5];
  if (exp != null) v *= 10 ** Number(exp);
  if (m[1] === '-') v = -v;
  if (!Number.isFinite(v)) return null;
  return [v, t.slice(m[0].length)];
}

/**
 * Reads an answer for an expected unit. «4k7» (RKM code) and «2R2» are accepted; a bare prefix
 * («4,7 k») applies to the expected unit.
 */
export function leer(texto: string, unidad: string): Lectura | { error: 'ilegible' | 'unidad'; dada?: string } {
  const t = texto.trim();
  if (!t) return { error: 'ilegible' };
  // RKM code: 4k7, 2R2, 4µ7, 1M5 (optionally followed by the unit)
  const rkm = /^([+-]?\d+)([pnuµμmkKMGR])(\d+)\s*(.*)$/.exec(t);
  if (rkm) {
    const letra = rkm[2] === 'μ' ? 'µ' : rkm[2]!;
    const f = letra === 'R' ? 1 : (PREFIJOS[letra] ?? 1);
    const v = Number(`${rkm[1]}.${rkm[3]}`) * f;
    const resto = normalizarUnidad(rkm[4] ?? '');
    if (resto && resto !== unidad) return { error: 'unidad', dada: resto };
    return { valor: v, conUnidad: true };
  }
  const n = leerNumero(t);
  if (!n) return { error: 'ilegible' };
  const [v, restoBruto] = n;
  const resto = normalizarUnidad(restoBruto);
  if (!resto) return { valor: v, conUnidad: false };
  if (resto === unidad) return { valor: v, conUnidad: true };
  // a case-insensitive match with the expected unit (hz, mv → mV handled below)
  if (resto.toLowerCase() === unidad.toLowerCase() && !PREFIJOS[resto[0]!]) return { valor: v, conUnidad: true };
  // prefix + unit, or prefix alone
  const p = resto[0]!;
  const base = normalizarUnidad(resto.slice(1));
  if (PREFIJOS[p] != null && PREFIJABLES.has(unidad)) {
    if (!base || base === unidad || base.toLowerCase() === unidad.toLowerCase()) {
      return { valor: v * PREFIJOS[p], conUnidad: true };
    }
  }
  // «%» for a ratio expected as '' or the reverse are not mixed
  return { error: 'unidad', dada: resto };
}

function dentro(v: number, e: Esperado): boolean {
  if (e.tol_abs != null) return Math.abs(v - e.valor) <= e.tol_abs * (1 + 1e-9);
  const tol = e.tol ?? 0.02;
  if (e.valor === 0) return Math.abs(v) <= 1e-12;
  return Math.abs(v - e.valor) <= Math.abs(e.valor) * tol * (1 + 1e-9);
}

function relativo(v: number, e: number): number {
  return e === 0 ? Math.abs(v) : Math.abs(v - e) / Math.abs(e);
}

/** Spanish percentage with a decimal comma. */
function pct(x: number): string {
  const r = x * 100;
  return (r >= 10 ? Math.round(r).toString() : r.toFixed(1)).replace('.', ',') + ' %';
}

/** Checks one field against its expected value and alternatives. */
export function comprobar(texto: string, principal: Esperado, alternativas: Esperado[] = []): Veredicto {
  if (!texto.trim()) return { tipo: 'vacio' };
  const unidad = principal.unidad;
  const l = leer(texto, unidad);
  if ('error' in l) {
    if (l.error === 'unidad') {
      return {
        tipo: 'unidad',
        mensaje: unidad
          ? `«${l.dada}» no es una unidad de esta magnitud: se pide en ${unidad}.`
          : `Esta magnitud no lleva unidad; escriba solo el número.`,
      };
    }
    return { tipo: 'ilegible', mensaje: 'Escriba un número, por ejemplo 4,7 k, 4k7, 2,2 µ o 1,5e-3.' };
  }
  const todos = [principal, ...alternativas];
  for (const e of todos) {
    if (dentro(l.valor, e)) return { tipo: 'bien', nota: e.nota, texto: e.texto };
  }
  // close: right digits with a wrong power of ten (prefix), wrong sign, or within 10 %
  for (const e of todos) {
    if (e.valor === 0) continue;
    const r = l.valor / e.valor;
    if (r < 0 && dentro(-l.valor, e)) return { tipo: 'cerca', mensaje: 'El valor es correcto, pero el signo no.' };
    const decadas = Math.log10(Math.abs(r));
    const k = Math.round(decadas);
    if (k !== 0 && Math.abs(decadas - k) < 0.009 && dentro(l.valor / 10 ** k, e)) {
      const prefijo = k % 3 === 0 && PREFIJABLES.has(unidad);
      return {
        tipo: 'cerca',
        mensaje: prefijo
          ? `Las cifras están bien, pero sobra o falta un prefijo (el valor está multiplicado por 10${superindice(k)}).`
          : `Las cifras están bien, pero la coma está desplazada (×10${superindice(k)}).`,
      };
    }
  }
  const mejor = todos.reduce((a, e) => Math.min(a, relativo(l.valor, e.valor)), Infinity);
  if (mejor <= 0.1) {
    return {
      tipo: 'cerca',
      mensaje: `Cerca: a un ${pct(mejor)} del resultado. Revise los redondeos o algún paso intermedio.`,
    };
  }
  return { tipo: 'mal', mensaje: mejor < 1 ? 'No es correcto.' : 'No es correcto: ni siquiera el orden de magnitud.' };
}

function superindice(k: number): string {
  const s: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return String(k)
    .split('')
    .map((c) => s[c] ?? c)
    .join('');
}
