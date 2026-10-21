// Numbers for people, in Spanish (Spain) format: decimal comma, true minus sign, SI prefixes.
//   formatoSI(0.0015915, 'V')  → «1,592 mV»      formatoSI(-45.0, '°') → «−45,00 °»
//   formatoSI(1591.55, 'Hz')   → «1,592 kHz»     formatoSI(12, '')     → «12,00»

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
const SIN_PREFIJO = new Set(['dB', '°', '°C', '%', 'dBm', 'dBV', 'º', '']);

export const MENOS = '−';

/** Decimal comma and minus sign of a number already rounded to text. */
export function aEspanol(s: string): string {
  return s.replace('-', MENOS).replace('.', ',');
}

/** The prefix (and its multiplier) that suits a magnitude. */
export function prefijo(a: number): [number, string] {
  const v = Math.abs(a);
  if (!Number.isFinite(v) || v === 0) return [1, ''];
  return PREFIJOS.find(([m]) => v >= m * 0.99995) ?? PREFIJOS[PREFIJOS.length - 1]!;
}

function significativas(v: number, cifras: number): string {
  if (v === 0) return '0';
  // Round to the significant digits first (999.99999 → 1000), then pick the decimals from the result.
  const r = Number(v.toPrecision(cifras));
  const e = Math.floor(Math.log10(Math.abs(r)));
  const dec = Math.max(0, cifras - 1 - e);
  return r.toFixed(Math.min(dec, 12));
}

/** A value with its unit, SI prefix and `cifras` significant digits. */
export function formatoSI(v: number, unidad = '', cifras = 4): string {
  if (Number.isNaN(v)) return '—';
  if (!Number.isFinite(v)) return v > 0 ? '∞' : `${MENOS}∞`;
  if (SIN_PREFIJO.has(unidad)) {
    const a = Math.abs(v);
    // Unitless numbers that are very large or very small: scientific notation.
    if (unidad === '' && a !== 0 && (a >= 1e6 || a < 1e-3)) return cientifica(v, cifras);
    const txt = a >= 10 ** cifras ? v.toFixed(0) : significativas(v, cifras);
    return aEspanol(txt) + (unidad ? (unidad === '%' ? ' %' : ` ${unidad}`) : '');
  }
  const r = Number(v.toPrecision(cifras));
  const [m, p] = prefijo(r);
  return `${aEspanol(significativas(r / m, cifras))} ${p}${unidad}`;
}

/** Like formatoSI with 3 significant digits, without trailing zeros: «1 kHz», «2,5 mV», «20 dB». */
export function formatoCorto(v: number, unidad = ''): string {
  return formatoSI(v, unidad, 3).replace(/,(\d*?)0+(?=\s|$|×)/, (_m, d: string) => (d ? `,${d}` : ''));
}

const SUPER: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

/** 1,23×10⁻⁵ */
export function cientifica(v: number, cifras = 3): string {
  if (v === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(v)));
  const m = v / 10 ** e;
  return `${aEspanol(m.toFixed(Math.max(0, cifras - 1)))}×10${String(e).replace(/[-0-9]/g, (c) => SUPER[c] ?? c)}`;
}

/**
 * Labels for the ticks of an axis: one prefix for the whole axis (taken from the largest tick), as many
 * decimals as the step needs. Returns the labels and the unit to show in the axis title («ms», «kHz»).
 */
export function formatoEje(ticks: number[], unidad: string, log = false): { textos: string[]; unidad: string } {
  if (!ticks.length) return { textos: [], unidad };
  if (log) {
    // Each decade carries its own prefix: 10 Hz, 100 Hz, 1 kHz…
    return { textos: ticks.map((t) => formatoCorto(t, unidad)), unidad: '' };
  }
  const max = Math.max(...ticks.map(Math.abs));
  const [m, p] = SIN_PREFIJO.has(unidad) ? [1, ''] : prefijo(max);
  const paso = ticks.length > 1 ? Math.abs(ticks[1]! - ticks[0]!) / m : max / m;
  const dec = paso > 0 ? Math.max(0, Math.min(9, -Math.floor(Math.log10(paso) + 1e-9))) : 0;
  const textos = ticks.map((t) => {
    const v = t / m;
    const s = Math.abs(v) < paso * 1e-6 ? '0' : v.toFixed(dec);
    return aEspanol(s);
  });
  if (unidad === '' && (max >= 1e5 || (max > 0 && max < 1e-2))) {
    // Unitless axis with extreme values: a common power of ten in the title.
    const e = Math.floor(Math.log10(max));
    const d = Math.max(0, Math.min(9, -Math.floor(Math.log10(paso / 10 ** e) + 1e-9)));
    return { textos: ticks.map((t) => aEspanol((t / 10 ** e).toFixed(d))), unidad: cientifica(10 ** e, 1).replace(/^1,?0?×/, '×') };
  }
  return { textos, unidad: p + unidad };
}
