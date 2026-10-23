// Values with units as people type and read them: «4k7», «100n», «2,2 µ», «1,5 kΩ», «−6 dB», decimal comma,
// SI prefixes, narrow no-break space (U+202F) between number and unit, Spanish (Spain) style.

export const ESPACIO = ' ';
export const MENOS = '−';

/** Units that never take an SI prefix (same list as contenido/formulas_vars.py). */
const SIN_PREFIJO = new Set([
  '', '%', 'dB', 'dBm', 'dBc', 'dBi', 'dBV', 'dBµV', 'dB/déc', '°', '°C', 'K', 'ppm', 'ppm/°C', 'bit', 'V/V', 'A/A',
  'ciclos', 'vueltas', '°C/W', 'K/W', 'rad', 'dB/m', 'dB/100 m', 'h', 'años', 'espiras', 'LSB', 'Ω/sq', 'veces', 'm²',
  'Ω·m', 'V/µs', 'mm²', 'cm', 'mm', '1/°C', 'cm⁻³', 'ppm/°C', 'rpm', 'palabras', 'µε', '€', 'días',
]);

export function conPrefijo(unidad: string): boolean {
  return !SIN_PREFIJO.has(unidad);
}

const PREFIJOS: Record<string, number> = {
  f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, μ: 1e-6, m: 1e-3, c: 1e-2, k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12,
};

const ESCALA: [number, string][] = [
  [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f'],
];

/** Unit spellings people type for each unit (besides the unit itself). */
const ALIAS: Record<string, string[]> = {
  'Ω': ['ohm', 'ohms', 'ohmios', 'ohmio', 'R'],
  'µ': ['u'],
  '°C': ['ºC', 'C', '°'],
  '°': ['º', 'grados'],
  '%': [' %'],
};

/**
 * Parses a typed value into the variable's unit. Accepts «4k7», «2u2», «4R7» (Ω), «100n», «100 nF», «2,2 µ»,
 * «1.5e-3», «1 000», «−5», «10 %». Returns NaN when the text is not a value.
 */
export function leerValor(texto: string, unidad: string): number {
  let t = texto
    .trim()
    .replace(/[−‒–]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/μ/g, 'µ');
  if (!t) return NaN;
  // Strip the unit (or one of its aliases) at the end, before reading a prefix: «5 mm» with unit m.
  const quitar = [unidad, ...(ALIAS[unidad] ?? [])].filter((u) => u).sort((a, b) => b.length - a.length);
  for (const u of quitar) {
    if (t.toLowerCase().endsWith(u.toLowerCase()) && t.length > u.length) {
      const resto = t.slice(0, t.length - u.length);
      if (/[\d.,\s]$/.test(resto) || /[fpnuµmckKMGT]$/.test(resto) || (u === 'R' && /\d$/.test(resto))) {
        t = resto.trimEnd();
        break;
      }
    }
  }
  // Resistor-style codes: 4k7, 2u2, 4R7 (R as the decimal point of ohms).
  let m = /^([-+]?\d+)([fpnuµmkKMGTR])(\d+)$/.exec(t);
  if (m) {
    const p = m[2] === 'R' ? 1 : PREFIJOS[m[2] as string];
    if (p === undefined) return NaN;
    return Number(`${m[1]}.${m[3]}`) * p;
  }
  m = /^([-+]?(?:\d{1,3}(?: \d{3})+|\d*)(?:[.,]\d+)?(?:[eE][-+]?\d+)?)\s*([fpnuµmckKMGT]?)$/.exec(t);
  if (!m || !m[1] || m[1] === '-' || m[1] === '+') return NaN;
  const num = Number((m[1] as string).replace(/ /g, '').replace(',', '.'));
  const p = m[2] ? PREFIJOS[m[2]] : 1;
  if (p === undefined || !Number.isFinite(num)) return NaN;
  if (m[2] && !conPrefijo(unidad) && unidad !== '' && unidad !== 'V/V') return NaN;
  return num * p;
}

function redondear(v: number, cifras: number): number {
  return Number(v.toPrecision(cifras));
}

/** Digits of a number already scaled, with `cifras` significant digits and no trailing zeros (optional). */
function digitos(v: number, cifras: number, recortar: boolean): string {
  if (v === 0) return '0';
  const r = redondear(v, cifras);
  const e = Math.floor(Math.log10(Math.abs(r)));
  const dec = Math.max(0, cifras - 1 - e);
  let s = r.toFixed(Math.min(dec, 12));
  if (recortar && s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

/** Thousands with a narrow no-break space (from 10 000 on, as in the book: «1 930», «25 600»). */
function miles(entero: string): string {
  const neg = entero.startsWith('-');
  const d = neg ? entero.slice(1) : entero;
  if (d.length < 5) return entero;
  return (neg ? '-' : '') + d.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACIO);
}

function espanol(s: string): string {
  const [ent = '', dec] = s.split('.');
  return (miles(ent) + (dec !== undefined ? ',' + dec : '')).replace('-', MENOS);
}

const SUPER: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

export function cientifica(v: number, cifras: number, recortar = false): string {
  if (v === 0) return '0';
  let e = Math.floor(Math.log10(Math.abs(v)));
  let m = redondear(v / 10 ** e, cifras);
  if (Math.abs(m) >= 10) {
    m /= 10;
    e += 1;
  }
  return `${espanol(digitos(m, cifras, recortar))}${ESPACIO}×${ESPACIO}10${String(e).replace(/[-0-9]/g, (c) => SUPER[c] ?? c)}`;
}

export interface Partes {
  /** Number with its SI prefix glued to the unit: «4,700» and «kΩ». */
  numero: string;
  prefijo: string;
  unidad: string;
}

/** Number, prefix and unit of a value (for a result display or an input field). */
export function partesValor(v: number, unidad: string, cifras = 4, recortar = false): Partes {
  if (Number.isNaN(v)) return { numero: '—', prefijo: '', unidad };
  if (!Number.isFinite(v)) return { numero: v > 0 ? '∞' : `${MENOS}∞`, prefijo: '', unidad };
  if (!conPrefijo(unidad)) {
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e9 || a < 1e-4)) return { numero: cientifica(v, cifras, recortar), prefijo: '', unidad };
    const r = redondear(v, cifras);
    const txt = Math.abs(r) >= 10 ** cifras ? r.toFixed(0) : digitos(r, cifras, recortar);
    return { numero: espanol(txt), prefijo: '', unidad };
  }
  const r = redondear(v, cifras);
  const a = Math.abs(r);
  if (a !== 0 && (a >= 1e15 || a < 1e-15)) return { numero: cientifica(v, cifras, recortar), prefijo: '', unidad };
  const [mult, p] = a === 0 ? [1, ''] : (ESCALA.find(([k]) => a >= k * 0.99995) ?? ESCALA[ESCALA.length - 1]!);
  return { numero: espanol(digitos(r / mult, cifras, recortar)), prefijo: p, unidad };
}

/** «4,700 kΩ», «−6,02 dB», «2,50 %», «1,23 × 10⁻⁵». */
export function formatoValor(v: number, unidad: string, cifras = 4, recortar = false): string {
  const p = partesValor(v, unidad, cifras, recortar);
  const u = p.prefijo + p.unidad;
  return u ? `${p.numero}${ESPACIO}${u}` : p.numero;
}

/** The text an input field shows for a value: prefix included, unit apart, trailing zeros trimmed. */
export function textoCampo(v: number, unidad: string): string {
  if (!Number.isFinite(v)) return '';
  const p = partesValor(v, unidad, 6, true);
  return p.prefijo ? `${p.numero}${ESPACIO}${p.prefijo}` : p.numero;
}

/** Unit as the plot component wants it: SI units with prefix as is, the rest as plain numbers. */
export function unidadGrafica(unidad: string): string {
  if (['dB', '%', '°', '°C', 'dBm'].includes(unidad)) return unidad;
  return conPrefijo(unidad) ? unidad : '';
}
