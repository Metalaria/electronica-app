// Component values as the reader types them (Spanish style: «4,7k», «100n», «1µ», «2,2 MΩ», «4k7», «1meg»)
// and as SPICE needs them («4.7k», «100n», «1u», «2.2meg»). Expressions in braces ({rl*2}) pass through.

import { leer } from '../../lib/magnitudes.ts';
import { numeroSpice, textoSpice } from '../../simulador/motor/netlist.ts';

export type Lectura = { ok: true; v: number | null; spice: string } | { ok: false; error: string };

const PREF: [number, string][] = [
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

/** 4700 → «4,7k», 1e6 → «1M», 1.5915e-5 → «15,915µ», 0.5 → «500m», 12 → «12» (up to 6 significant digits). */
export function formatoValor(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return '0';
  const a = Math.abs(v);
  const [m, p] = PREF.find(([x]) => a >= x * 0.9999995) ?? PREF[PREF.length - 1]!;
  const n = Number((v / m).toPrecision(6));
  return `${String(n).replace('.', ',').replace('-', '−')}${p}`;
}

/** A SPICE token as the reader would write it: «4.7k» → «4,7k», «1meg» → «1M»; other text unchanged. */
export function deSpice(tok: string): string {
  const n = numeroSpice(tok);
  return n == null ? tok : formatoValor(n);
}

/** Reads a typed value for a quantity in `unidad` (Ω, F, H, V, A, Hz, s, '' …). */
export function leerValor(texto: string, unidad: string, opciones: { vacio?: boolean } = {}): Lectura {
  const t = texto.trim().replace(/μ/g, 'µ');
  if (!t) return opciones.vacio ? { ok: true, v: null, spice: '' } : { ok: false, error: 'Falta el valor.' };
  if (/^\{.*\}$/.test(t)) return { ok: true, v: null, spice: t };
  // «1meg», «2,2meg» (SPICE mega) and a bare «1e3».
  const meg = /^([+\-−]?\d+(?:[.,]\d+)?)\s*meg\s*(.*)$/i.exec(t);
  if (meg) {
    const resto = meg[2]!.trim();
    if (resto && resto !== unidad && unidad) return { ok: false, error: `«${resto}» no es una unidad de ${nombreUnidad(unidad)}.` };
    const v = Number(meg[1]!.replace(',', '.').replace('−', '-')) * 1e6;
    return { ok: true, v, spice: textoSpice(v, 12) };
  }
  // Unitless quantities (gains) still take prefixes: «1k».
  const l = leer(t.replace('−', '-'), unidad || 'V/V');
  if ('error' in l) {
    if (l.error === 'unidad')
      return { ok: false, error: unidad ? `«${l.dada}» no es una unidad de ${nombreUnidad(unidad)}; escriba por ejemplo 4,7k o 100n.` : 'Escriba solo el número.' };
    return { ok: false, error: 'No es un número: escriba por ejemplo 4,7k, 4k7, 100n o 2,2M.' };
  }
  return { ok: true, v: l.valor, spice: textoSpice(l.valor, 12) };
}

function nombreUnidad(u: string): string {
  return (
    { Ω: 'resistencia (Ω)', F: 'capacidad (F)', H: 'inductancia (H)', V: 'tensión (V)', A: 'corriente (A)', Hz: 'frecuencia (Hz)', s: 'tiempo (s)', S: 'transconductancia (S)', '%': 'porcentaje' }[u] ?? u
  );
}
