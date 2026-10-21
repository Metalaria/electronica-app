// From ngspice plots (tran1, ac1, …) to the plot panels of the results view.

import type { Grafica, Vector } from './motor/nucleo.ts';
import type { Axis, Series } from '../componentes/grafica';

export type ClaseAnalisis = 'tran' | 'ac' | 'dc' | 'ruido' | 'op' | 'tf' | 'otro';

export function claseDe(g: Grafica): ClaseAnalisis {
  const a = g.analisis.toLowerCase();
  if (a.startsWith('transient')) return 'tran';
  if (a.startsWith('ac')) return 'ac';
  if (a.startsWith('dc')) return 'dc';
  if (a.includes('noise')) return 'ruido';
  if (a.startsWith('operating')) return 'op';
  if (a.includes('transfer function')) return 'tf';
  return 'otro';
}

const NOMBRE_CLASE: Record<ClaseAnalisis, string> = {
  tran: 'Transitorio',
  ac: 'Alterna (AC)',
  dc: 'Barrido de continua (DC)',
  ruido: 'Ruido',
  op: 'Punto de trabajo',
  tf: 'Función de transferencia',
  otro: 'Análisis',
};

/** «Transitorio · tran2» */
export function nombreGrafica(g: Grafica): string {
  const c = claseDe(g);
  const base = c === 'ruido' && /integrated/i.test(g.analisis) ? 'Ruido integrado' : NOMBRE_CLASE[c];
  return `${base} · ${g.id}`;
}

/** Unit of a vector from its ngspice type (and the analysis). */
export function unidadDe(v: Vector, g?: Grafica): string {
  const espectro = g && claseDe(g) === 'ruido' && !/integrated/i.test(g.analisis);
  switch (v.tipo) {
    case 'voltage':
      return espectro ? 'V/√Hz' : 'V';
    case 'current':
      return espectro ? 'A/√Hz' : 'A';
    case 'time':
      return 's';
    case 'frequency':
      return 'Hz';
    case 'temperature':
      return '°C';
    case 'impedance':
      return 'Ω';
    case 'admittance':
      return 'S';
    case 'power':
      return 'W';
    case 'decibel':
      return 'dB';
    default:
      return '';
  }
}

/** Horizontal axis of a plot from its scale vector. */
export function ejeX(g: Grafica): Axis {
  const s = g.vectores[0]!;
  const n = s.nombre.toLowerCase();
  const c = claseDe(g);
  if (s.tipo === 'time' || n === 'time') return { label: 'Tiempo', unit: 's', scale: 'linear' };
  if (s.tipo === 'frequency' || n === 'frequency') {
    const r = s.re;
    // Log axis for .ac/.noise sweeps by decade or octave (more than a decade of span).
    const log = r.length > 2 && r[0]! > 0 && r[r.length - 1]! / r[0]! > 20;
    return { label: 'Frecuencia', unit: 'Hz', scale: log && (c === 'ac' || c === 'ruido' || c === 'otro') ? 'log' : 'linear' };
  }
  if (/^temp/.test(n)) return { label: 'Temperatura', unit: '°C', scale: 'linear' };
  if (/^v-sweep/.test(n)) return { label: 'Tensión barrida', unit: 'V', scale: 'linear' };
  if (/^i-sweep/.test(n)) return { label: 'Corriente barrida', unit: 'A', scale: 'linear' };
  if (/^res-sweep/.test(n)) return { label: 'Resistencia barrida', unit: 'Ω', scale: 'linear' };
  return { label: s.nombre, unit: unidadDe(s, g), scale: 'linear' };
}

/** Vectors that can be drawn (not the scale, not the scalars of meas/let). */
export function vectoresDibujables(g: Grafica): Vector[] {
  return g.vectores.slice(1).filter((v) => !v.escalar);
}

/** Default selection: computed vectors (let) and node voltages, internal subcircuit nodes last; four at most. */
export function seleccionInicial(g: Grafica): string[] {
  const vs = vectoresDibujables(g);
  const interno = (v: Vector) => /[.#:]/.test(v.nombre.replace(/^[vi]\((.*)\)$/, '$1'));
  const rango = (v: Vector) =>
    (v.tipo === 'notype' ? 0 : v.tipo === 'voltage' ? 1 : 2) + (interno(v) ? 3 : 0) + (/^v\((in|vin|e|entrada)\)$/i.test(v.nombre) ? 0.5 : 0);
  const orden = vs.map((v, i) => ({ v, i })).sort((a, b) => rango(a.v) - rango(b.v) || a.i - b.i);
  // Voltages (and computed vectors) when there are any; currents only otherwise.
  const tope = orden.some((x) => rango(x.v) < 2) ? 2 : 3;
  const elegidos = orden.filter((x) => rango(x.v) < tope).slice(0, 4);
  return (elegidos.length ? elegidos : orden.slice(0, 2)).map((x) => x.v.nombre);
}

export interface Panel {
  clave: string;
  titulo: string;
  xAxis: Axis;
  yAxis: Axis;
  series: Series[];
}

const ETIQUETA_UNIDAD: Record<string, string> = {
  V: 'Tensión',
  A: 'Corriente',
  dB: 'Magnitud',
  '°': 'Fase',
  'V/√Hz': 'Densidad de ruido',
  'A/√Hz': 'Densidad de ruido',
  W: 'Potencia',
  Ω: 'Impedancia',
  '': 'Valor',
};

function db(re: Float64Array, im: Float64Array | null): Float64Array {
  const o = new Float64Array(re.length);
  for (let i = 0; i < re.length; i++) o[i] = 20 * Math.log10(Math.hypot(re[i]!, im ? im[i]! : 0));
  return o;
}

function modulo(re: Float64Array, im: Float64Array | null): Float64Array {
  const o = new Float64Array(re.length);
  for (let i = 0; i < re.length; i++) o[i] = Math.hypot(re[i]!, im ? im[i]! : 0);
  return o;
}

/** Phase in degrees, unwrapped (no ±180° jumps), as Bode plots are read. */
function fase(re: Float64Array, im: Float64Array | null): Float64Array {
  const o = new Float64Array(re.length);
  let antes = NaN;
  let giro = 0;
  for (let i = 0; i < re.length; i++) {
    const p = (Math.atan2(im ? im[i]! : 0, re[i]!) * 180) / Math.PI;
    if (!Number.isNaN(antes)) {
      const d = p + giro - antes;
      if (d > 180) giro -= 360;
      else if (d < -180) giro += 360;
    }
    o[i] = p + giro;
    antes = o[i]!;
  }
  return o;
}

export interface OpcionesPaneles {
  /** Magnitude in dB (AC); otherwise linear magnitude. */
  db: boolean;
  /** Same vectors from every plot of the same class (alter / foreach loops). */
  superponer: boolean;
}

/**
 * Panels for a plot (or, superposed, for all plots of its class): AC → magnitude and phase; otherwise one
 * panel per unit (volts, amperes, others), all against the same x and linked by the caller.
 */
export function paneles(graficas: Grafica[], g: Grafica, seleccion: string[], op: OpcionesPaneles): Panel[] {
  const clase = claseDe(g);
  const grupo = op.superponer ? graficas.filter((x) => claseDe(x) === clase && x.puntos > 1) : [g];
  const x = ejeX(g);
  const nombre = (v: string, gr: Grafica) => (grupo.length > 1 ? `${v} · ${gr.id}` : v);
  if (g.complejo) {
    const mag: Series[] = [];
    const fas: Series[] = [];
    let uMag = '';
    for (const gr of grupo) {
      const xs = gr.vectores[0]!.re;
      for (const n of seleccion) {
        const v = gr.vectores.find((w) => w.nombre === n);
        if (!v || v.escalar) continue;
        const u = unidadDe(v, gr);
        uMag = op.db ? 'dB' : u;
        mag.push({ name: nombre(n, gr), unit: uMag, x: xs, y: op.db ? db(v.re, v.im) : modulo(v.re, v.im) });
        fas.push({ name: nombre(n, gr), unit: '°', x: xs, y: fase(v.re, v.im) });
      }
    }
    return [
      { clave: 'mag', titulo: '', xAxis: x, yAxis: { label: op.db ? 'Magnitud' : ETIQUETA_UNIDAD[uMag] ?? 'Magnitud', unit: uMag, scale: 'linear' }, series: mag.slice(0, 8) },
      { clave: 'fase', titulo: '', xAxis: x, yAxis: { label: 'Fase', unit: '°', scale: 'linear' }, series: fas.slice(0, 8) },
    ];
  }
  const porUnidad = new Map<string, Series[]>();
  for (const gr of grupo) {
    const xs = gr.vectores[0]!.re;
    for (const n of seleccion) {
      const v = gr.vectores.find((w) => w.nombre === n);
      if (!v || v.escalar) continue;
      const u = unidadDe(v, gr);
      const lista = porUnidad.get(u) ?? [];
      lista.push({ name: nombre(n, gr), unit: u, x: xs, y: v.re });
      porUnidad.set(u, lista);
    }
  }
  const ruido = clase === 'ruido' && !/integrated/i.test(g.analisis);
  return [...porUnidad.entries()].map(([u, series]) => ({
    clave: `u:${u}`,
    titulo: '',
    xAxis: x,
    yAxis: { label: ETIQUETA_UNIDAD[u] ?? 'Valor', unit: u, scale: ruido ? 'log' : 'linear' },
    series: series.slice(0, 8),
  }));
}
