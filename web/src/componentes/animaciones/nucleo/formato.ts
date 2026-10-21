// Numbers for the animations in Spanish (Spain) style: decimal comma, true minus sign, SI prefixes and a
// non-breaking space between value and unit («4,7 kΩ», «−0,65 V», «12,0 mA»).

export const MENOS = '−';
const NBSP = ' ';

const PREFIJOS: [number, string][] = [
  [1e12, 'T'],
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
  [1e-15, 'f'],
];

/** Units that never take an SI prefix. */
const SIN_PREFIJO = new Set(['', '%', '°', '°C', 'dB', 'eV', 'nm', 'K', 'ppm/°C', '×', 'lx', 'rpm']);

/** Turns «-1.5» into «−1,5». */
export function es(txt: string): string {
  return txt.replace('-', MENOS).replace('.', ',');
}

/** A number with a fixed number of decimals, Spanish style. */
export function num(v: number, dec = 2): string {
  if (!Number.isFinite(v)) return Number.isNaN(v) ? '—' : v > 0 ? '∞' : `${MENOS}∞`;
  const t = v.toFixed(dec);
  // Avoid «−0,00».
  return es(/^-0(\.0+)?$/.test(t) ? t.slice(1) : t);
}

function significativas(v: number, cifras: number): string {
  if (v === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(v)));
  const dec = Math.max(0, Math.min(12, cifras - 1 - e));
  return v.toFixed(dec);
}

/** A value with its unit and SI prefix, with `cifras` significant digits: si(0.0047, 'F') → «4,70 mF». */
export function si(v: number, unidad = '', cifras = 3): string {
  if (Number.isNaN(v)) return '—';
  if (!Number.isFinite(v)) return (v > 0 ? '∞' : `${MENOS}∞`) + (unidad ? NBSP + unidad : '');
  if (SIN_PREFIJO.has(unidad)) {
    const t = Math.abs(v) >= 10 ** cifras ? v.toFixed(0) : significativas(v, cifras);
    return es(t) + (unidad ? (unidad === '×' ? unidad : NBSP + unidad) : '');
  }
  const a = Math.abs(v);
  let m = 1;
  let p = '';
  if (a > 0) {
    const elegido = PREFIJOS.find(([k]) => a >= k * 0.9995) ?? PREFIJOS[PREFIJOS.length - 1]!;
    m = elegido[0];
    p = elegido[1];
  }
  let t = significativas(v / m, cifras);
  // 999,7 rounded to «1000»: move to the next prefix.
  if (Math.abs(Number(t)) >= 1000 && m < 1e12) {
    const i = PREFIJOS.findIndex(([k]) => k === m);
    const sig = PREFIJOS[i - 1];
    if (sig) {
      m = sig[0];
      p = sig[1];
      t = significativas(v / m, cifras);
    }
  }
  return es(t) + NBSP + p + unidad;
}

/** Like si() but without trailing zeros after the comma: «1 kΩ», «2,5 mV». */
export function siCorto(v: number, unidad = '', cifras = 3): string {
  return si(v, unidad, cifras).replace(/,(\d*?)0+(?= |$)/, (_m, d: string) => (d ? `,${d}` : ''));
}

/** 1,23×10⁻⁵ */
export function cientifica(v: number, cifras = 3): string {
  if (v === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(v)));
  const m = v / 10 ** e;
  return `${es(m.toFixed(Math.max(0, cifras - 1)))}×10${superindice(e)}`;
}

const SUPER: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

export function superindice(n: number): string {
  return String(n).replace(/[-0-9]/g, (c) => SUPER[c] ?? c);
}

/** Percentage with comma: pct(0.632) → «63,2 %». */
export function pct(f: number, dec = 1): string {
  return num(f * 100, dec) + NBSP + '%';
}
