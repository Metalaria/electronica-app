// Digital multimeters of the bench: the Brymen BM869s and the multimeter of the FNIRSI 2C53T.
//
// A meter is a set of measuring functions. Each function has ranges (full scale, resolution, display unit),
// an accuracy ± (% of reading + digits) — by frequency band for AC —, the electrical model it presents to the
// circuit (montaje.ts), and the way it turns the simulated signal into a number. The displayed value carries
// a fixed calibration error (random per meter, function and range, inside the specification), a little noise
// in the last digit, and the quantisation of the range: like a real instrument, it is not the exact value.
//
// Sources: book chapters 21 (2C53T) and 52 (BM869s, section 53.7); Brymen BM867s/BM869s user manual
// (specifications); FNIRSI 2C53T product data (multimeter ranges and accuracy). See README («Instrumentos»).

import type { ModeloDmm } from './montaje.ts';
import { azarFijo, frecuencia, media, extremos, rmsPonderado, type Serie } from './senal.ts';

// ------------------------------------------------------------------ ranges and accuracy

export interface Rango {
  /** Largest value displayed before OL (SI). */
  max: number;
  /** Resolution (SI). */
  res: number;
  /** Display unit and its scale: «mV», 1e-3. */
  unidad: string;
  escala: number;
  /** ± (% of reading, digits), or null when the manual leaves it unspecified. f in Hz (null: DC). */
  exactitud: (f: number | null) => [number, number] | null;
}

const fija =
  (pct: number, dig: number) =>
  (): [number, number] =>
    [pct, dig];

/** Accuracy by frequency band: [[fMax, pct, digits] …]; null above the last band or if pct is null. */
function bandas(tabla: [number, number | null, number][], fMin = 0): (f: number | null) => [number, number] | null {
  return (f) => {
    const x = f ?? 50;
    if (x < fMin) return null;
    for (const [hasta, pct, dig] of tabla) if (x <= hasta) return pct === null ? null : [pct, dig];
    return null;
  };
}

function rango(max: number, res: number, unidad: string, escala: number, ex: Rango['exactitud']): Rango {
  return { max, res, unidad, escala, exactitud: ex };
}

/** Decimals shown for a range. */
export function decimales(r: Rango, alta = false): number {
  return Math.max(0, Math.round(-Math.log10((alta ? r.res / 10 : r.res) / r.escala)));
}

// ------------------------------------------------------------------ what each function measures

export type Medida =
  | 'vdc'
  | 'vac'
  | 'vacdc'
  | 'vfd'
  | 'dbm'
  | 'hz'
  | 'hzlog'
  | 'ciclo'
  | 'ohm'
  | 'cont'
  | 'ns'
  | 'diodo'
  | 'cap'
  | 'idc'
  | 'iac'
  | 'iacdc'
  | 'lazo'
  | 'temp';

export interface Funcion {
  medida: Medida;
  /** Short name for the reader («V⎓», «Hz»…). */
  nombre: string;
  rangos: Rango[];
  /** Bandwidth weighting of the RMS converter (AC functions). */
  banda?: (f: number) => number;
  /** Electrical model for a range index (voltage, resistance, capacitance functions; currents use the jack). */
  modelo?: (r: number) => ModeloDmm;
  /** Frequency counter sensitivity (V or A RMS) and maximum frequency, by range of the primary function. */
  sensibilidad?: (r: number) => { min: number; fMax: number };
}

// ------------------------------------------------------------------ signal seen by a meter

export interface SenalDmm {
  /** Voltage between the leads (red − black): a constant (operating point) or a window of the transient. */
  v: number | Serie;
  /** Current entering the red lead. */
  i: number | Serie;
  /** Capacitance seen between the leads (from the bench's small-signal analysis), when measured. */
  c?: number | null;
  /** Thermocouple temperatures (°C), not simulated: set on the bench. */
  t1?: number;
  t2?: number;
}

export interface Estadistica {
  dc: number;
  /** True RMS of the AC component through the meter's bandwidth. */
  ac: number;
  /** Total RMS (AC + DC). */
  acdc: number;
  max: number;
  min: number;
  f: number | null;
  ciclo: number | null;
}

/** DC, AC, peaks and frequency of a signal for a function (bandwidth and counter sensitivity). */
export function estadistica(x: number | Serie, banda?: (f: number) => number, sens?: { min: number; fMax: number }, umbralLogico?: number): Estadistica {
  if (typeof x === 'number') return { dc: x, ac: 0, acdc: Math.abs(x), max: x, min: x, f: null, ciclo: null };
  const dc = media(x);
  const { max, min } = extremos(x);
  const t0 = x.t[0]!;
  const t1 = x.t[x.t.length - 1]!;
  const H = banda ?? (() => 1);
  const ac = max - min > 1e-12 ? rmsPonderado(x, t0, t1, H, false) : 0;
  const acdc = Math.sqrt(ac * ac + dc * dc);
  let f: number | null = null;
  let ciclo: number | null = null;
  if (umbralLogico !== undefined) {
    const r = frecuencia(x, umbralLogico, 0.1);
    if (r) {
      f = r.f;
      ciclo = r.ciclo;
    }
  } else if (sens && ac >= sens.min * 0.98) {
    const r = frecuencia(x, dc, Math.max(sens.min * 0.5, (max - min) * 0.05));
    if (r && r.f <= sens.fMax * 1.2) {
      f = r.f;
      ciclo = r.ciclo;
    }
  }
  return { dc, ac, acdc, max, min, f, ciclo };
}

// ------------------------------------------------------------------ Brymen BM869s

const SENS_V = (r: number) =>
  [
    { min: 0.6, fMax: 100e3 },
    { min: 6, fMax: 100e3 },
    { min: 50, fMax: 100e3 },
    { min: 500, fMax: 10e3 },
  ][r] ?? { min: 0.6, fMax: 100e3 };

const pasaBajo1 = (fc: number) => (f: number) => 1 / Math.sqrt(1 + (f / fc) ** 2);
const butter4 = (fc: number) => (f: number) => 1 / Math.sqrt(1 + (f / fc) ** 8);

/** True RMS converter: about 5 % down at 350 kHz (lygte-info's measurement), one pole. */
const BANDA_BM = pasaBajo1(1.07e6);
/** VFD low-pass filter: 5 % down at 530 Hz; modelled as a fourth-order Butterworth at 700 Hz. */
const BANDA_VFD = butter4(700);

const voltimetro = (mv: boolean): ModeloDmm => ({ tipo: 'voltimetro', r: 10e6, c: mv ? 80e-12 : 60e-12, mv });

const OHM_MODELOS: ModeloDmm[] = [
  { tipo: 'ohmimetro', voc: 2.9, rs: 7.6e3 },
  { tipo: 'ohmimetro', voc: 1.15, rs: 3e3 },
  { tipo: 'ohmimetro', voc: 1.15, rs: 30e3 },
  { tipo: 'ohmimetro', voc: 1.15, rs: 300e3 },
  { tipo: 'ohmimetro', voc: 1.15, rs: 3e6 },
  { tipo: 'ohmimetro', voc: 1.15, rs: 30e6 },
];

const ACV_5_50: [number, number | null, number][] = [
  [45, 1.5, 40],
  [300, 0.4, 30],
  [5e3, 0.4, 40],
  [20e3, 0.7, 40],
  [100e3, 4.0, 40],
];

export const BM_FUNCIONES: Record<string, Funcion> = {
  vdc: {
    medida: 'vdc',
    nombre: 'V⎓',
    rangos: [
      rango(5, 1e-4, 'V', 1, fija(0.02, 2)),
      rango(50, 1e-3, 'V', 1, fija(0.03, 2)),
      rango(500, 1e-2, 'V', 1, fija(0.04, 2)),
      rango(1000, 0.1, 'V', 1, fija(0.15, 2)),
    ],
    modelo: () => voltimetro(false),
  },
  vac: {
    medida: 'vac',
    nombre: 'V∿',
    rangos: [
      rango(5, 1e-4, 'V', 1, bandas(ACV_5_50, 20)),
      rango(50, 1e-3, 'V', 1, bandas(ACV_5_50, 20)),
      rango(500, 1e-2, 'V', 1, bandas([[45, null, 0], [300, 0.5, 40], [5e3, 0.4, 40], [20e3, 0.5, 40]], 20)),
      rango(1000, 0.1, 'V', 1, bandas([[45, null, 0], [300, 0.5, 40], [1e3, 0.8, 40]], 20)),
    ],
    banda: BANDA_BM,
    modelo: () => voltimetro(false),
    sensibilidad: SENS_V,
  },
  vacdc: {
    medida: 'vacdc',
    nombre: 'V AC+DC',
    rangos: [
      rango(5, 1e-4, 'V', 1, bandas([[45, 1.5, 40], [300, 0.7, 80], [5e3, 0.8, 40], [20e3, 1.5, 40], [40e3, 4.0, 40]])),
      rango(50, 1e-3, 'V', 1, bandas([[45, 1.5, 40], [300, 0.7, 80], [5e3, 0.8, 40], [20e3, 1.5, 40], [40e3, 4.0, 40]])),
      rango(500, 1e-2, 'V', 1, bandas([[300, 0.7, 40], [5e3, 0.8, 40], [20e3, 1.5, 40]])),
      rango(1000, 0.1, 'V', 1, bandas([[300, 0.7, 40], [1e3, 1.0, 40]])),
    ],
    banda: BANDA_BM,
    modelo: () => voltimetro(false),
  },
  vfd: {
    medida: 'vfd',
    nombre: 'V∿ VFD',
    rangos: [5, 50, 500, 1000].map((m, i) =>
      rango(m, [1e-4, 1e-3, 1e-2, 0.1][i]!, 'V', 1, bandas([[20, 5.5, 80], [200, 2, 50], [440, 6, 80]], 10)),
    ),
    banda: BANDA_VFD,
    modelo: () => voltimetro(false),
    sensibilidad: (r) => ({ min: [0.5, 5, 50, 500][r] ?? 0.5, fMax: 440 }),
  },
  mvdc: {
    medida: 'vdc',
    nombre: 'mV⎓',
    rangos: [rango(0.5, 1e-5, 'mV', 1e-3, fija(0.02, 2))],
    modelo: () => voltimetro(true),
  },
  mvac: {
    medida: 'vac',
    nombre: 'mV∿',
    rangos: [rango(0.5, 1e-5, 'mV', 1e-3, bandas([[45, 1.5, 40], [300, 0.3, 20], [5e3, 0.4, 20], [20e3, 0.6, 40], [100e3, 4.0, 40]], 20))],
    banda: BANDA_BM,
    modelo: () => voltimetro(true),
    sensibilidad: () => ({ min: 0.1, fMax: 200e3 }),
  },
  mvacdc: {
    medida: 'vacdc',
    nombre: 'mV AC+DC',
    rangos: [rango(0.5, 1e-5, 'mV', 1e-3, bandas([[45, 1.5, 40], [300, 0.45, 40], [5e3, 0.8, 40], [20e3, 1.0, 40], [40e3, 3.5, 40]]))],
    banda: BANDA_BM,
    modelo: () => voltimetro(true),
  },
  dbm: {
    medida: 'dbm',
    nombre: 'dBm',
    rangos: [rango(99.99, 0.01, 'dBm', 1, () => null)],
    banda: BANDA_BM,
    modelo: () => voltimetro(false),
  },
  mdbm: {
    medida: 'dbm',
    nombre: 'dBm',
    rangos: [rango(99.99, 0.01, 'dBm', 1, () => null)],
    banda: BANDA_BM,
    modelo: () => voltimetro(true),
  },
  hz: {
    medida: 'hz',
    nombre: 'Hz',
    rangos: frecuenciaRangos(0.02, 4),
  },
  hzlog: {
    medida: 'hzlog',
    nombre: 'Hz (lógica)',
    rangos: frecuenciaRangos(0.002, 4),
    modelo: () => voltimetro(true),
  },
  ciclo: {
    medida: 'ciclo',
    nombre: 'D %',
    rangos: [rango(99.99, 0.01, '%', 1, fija(0, 2))],
    modelo: () => voltimetro(true),
  },
  ohm: {
    medida: 'ohm',
    nombre: 'Ω',
    rangos: [
      rango(500, 0.01, 'Ω', 1, fija(0.07, 10)),
      rango(5e3, 0.1, 'kΩ', 1e3, fija(0.07, 2)),
      rango(50e3, 1, 'kΩ', 1e3, fija(0.1, 2)),
      rango(500e3, 10, 'kΩ', 1e3, fija(0.1, 2)),
      rango(5e6, 100, 'MΩ', 1e6, fija(0.3, 6)),
      rango(50e6, 1e3, 'MΩ', 1e6, fija(2.0, 6)),
    ],
    modelo: (r) => OHM_MODELOS[r] ?? OHM_MODELOS[1]!,
  },
  cont: {
    medida: 'cont',
    nombre: 'Continuidad',
    rangos: [rango(500, 0.1, 'Ω', 1, fija(0.07, 10))],
    modelo: () => OHM_MODELOS[0]!,
  },
  ns: {
    medida: 'ns',
    nombre: 'nS',
    rangos: [rango(99.99e-9, 0.01e-9, 'nS', 1e-9, fija(2.0, 10))],
    modelo: () => ({ tipo: 'ohmimetro', voc: 1.15, rs: 1.05e6 }),
  },
  diodo: {
    medida: 'diodo',
    nombre: 'Diodo',
    rangos: [rango(2, 1e-4, 'V', 1, fija(1, 1))],
    modelo: () => ({ tipo: 'ohmimetro', voc: 2.94, rs: 7.7e3 }),
  },
  cap: {
    medida: 'cap',
    nombre: 'Capacidad',
    rangos: [
      rango(50e-9, 10e-12, 'nF', 1e-9, fija(0.8, 3)),
      rango(500e-9, 100e-12, 'nF', 1e-9, fija(0.8, 3)),
      rango(5e-6, 1e-9, 'µF', 1e-6, fija(1.5, 3)),
      rango(50e-6, 10e-9, 'µF', 1e-6, fija(2.5, 3)),
      rango(500e-6, 100e-9, 'µF', 1e-6, fija(3.5, 5)),
      rango(5e-3, 1e-6, 'mF', 1e-3, fija(5.0, 5)),
      rango(25e-3, 10e-6, 'mF', 1e-3, fija(6.5, 5)),
    ],
    modelo: (r) => ({ tipo: 'capacimetro', f: frecuenciaCap([50e-9, 500e-9, 5e-6, 50e-6, 500e-6, 5e-3, 25e-3][r] ?? 5e-6) }),
  },
  idc: { medida: 'idc', nombre: 'A⎓', rangos: [] },
  iac: { medida: 'iac', nombre: 'A∿', rangos: [], banda: pasaBajo1(300e3) },
  iacdc: { medida: 'iacdc', nombre: 'A AC+DC', rangos: [], banda: pasaBajo1(300e3) },
  lazo: { medida: 'lazo', nombre: '4–20 mA', rangos: [rango(999.99, 0.01, '%', 1, fija(0, 25))] },
  temp: { medida: 'temp', nombre: 'Temperatura', rangos: [rango(1000, 0.1, '°C', 1, fija(0.3, 15))] },
};

/** Frequency of the small-signal test for a capacitance range (about 1 kΩ of reactance at full scale). */
function frecuenciaCap(cFs: number): number {
  return Math.max(0.005, Math.min(1000, 1 / (2 * Math.PI * 1000 * cFs)));
}

function frecuenciaRangos(pct: number, dig: number): Rango[] {
  return [
    rango(99.999, 1e-3, 'Hz', 1, fija(pct, dig)),
    rango(999.99, 1e-2, 'Hz', 1, fija(pct, dig)),
    rango(9999.9, 0.1, 'kHz', 1e3, fija(pct, dig)),
    rango(99999, 1, 'kHz', 1e3, fija(pct, dig)),
    rango(999990, 10, 'kHz', 1e3, fija(pct, dig)),
  ];
}

/** Current ranges by selector position and jack (burden from the manual: 0.15 mV/µA, 3.3 mV/mA, 45 mV/A). */
export function rangosCorriente(pos: 'ua' | 'amA', borne: Borne, ac: boolean): Rango[] {
  const acB = (base: [number, number]) =>
    ac ? bandas([[40, null, 0], [60, 0.5, 50], [1e3, 0.7, 50], [20e3, 2.0, 50], [100e3, 5.0, 50]]) : fija(base[0], base[1]);
  if (pos === 'ua')
    return [rango(500e-6, 1e-8, 'µA', 1e-6, acB([0.15, 20])), rango(5000e-6, 1e-7, 'µA', 1e-6, acB([0.1, 20]))];
  if (borne === 'A') return [rango(5, 1e-4, 'A', 1, acB([0.5, 20])), rango(10, 1e-3, 'A', 1, acB([0.5, 20]))];
  return [rango(50e-3, 1e-6, 'mA', 1e-3, acB([0.15, 20])), rango(500e-3, 1e-5, 'mA', 1e-3, acB([0.15, 30]))];
}

// ------------------------------------------------------------------ selector of the BM869s

export type Borne = 'V' | 'mA' | 'A';

export interface Posicion {
  id: string;
  /** Label printed around the selector. */
  rotulo: string;
  /** Sub-functions that SELECT cycles through: [primary, secondary] function ids. */
  subs: [string, string | null][];
  corriente?: 'ua' | 'amA';
}

export const BM_POSICIONES: Posicion[] = [
  { id: 'off', rotulo: 'OFF', subs: [] },
  { id: 'vfd', rotulo: 'VFD V∿', subs: [['vfd', 'hz'], ['hz', 'vfd']] },
  { id: 'vac', rotulo: 'V∿', subs: [['vac', 'hz'], ['dbm', 'hz'], ['hz', 'vac']] },
  { id: 'vdc', rotulo: 'V⎓', subs: [['vdc', null], ['vdc', 'vac'], ['vacdc', 'vac']] },
  { id: 'mvdc', rotulo: 'mV⎓', subs: [['mvdc', null], ['mvdc', 'mvac'], ['mvacdc', 'mvac'], ['hzlog', null], ['ciclo', null]] },
  { id: 'mvac', rotulo: 'mV∿', subs: [['mvac', 'hz'], ['mdbm', 'hz'], ['hz', 'mvac']] },
  { id: 'temp', rotulo: 'T1 T2', subs: [['temp', null]] },
  { id: 'cap', rotulo: '⊣⊢ ⏵', subs: [['cap', null], ['diodo', null]] },
  { id: 'ohm', rotulo: 'Ω ·)))', subs: [['ohm', null], ['cont', null], ['ns', null]] },
  { id: 'amA', rotulo: 'A mA', subs: [['idc', null], ['idc', 'iac'], ['iacdc', 'iac'], ['iac', 'hz'], ['lazo', 'idc']], corriente: 'amA' },
  { id: 'ua', rotulo: 'µA', subs: [['idc', null], ['idc', 'iac'], ['iacdc', 'iac'], ['iac', 'hz']], corriente: 'ua' },
];

/** Shunt of each jack (Ω) and fuse rating (A). */
export const BM_BORNES: Record<Exclude<Borne, 'V'>, { r: (pos: string) => number; fusible: number }> = {
  mA: { r: (pos) => (pos === 'ua' ? 150 : 3.3), fusible: 0.44 },
  A: { r: () => 0.045, fusible: 11 },
};

// ------------------------------------------------------------------ the 2C53T's multimeter

/** Assumed bandwidth of the 2C53T's RMS converter (not published): one pole at 3 kHz. */
const BANDA_FN = pasaBajo1(3e3);

const OHM_FN: ModeloDmm[] = [0.3e3, 3e3, 30e3, 300e3, 3e6, 30e6].map((rs) => ({ tipo: 'ohmimetro', voc: 1.0, rs }));

export const FN_FUNCIONES: Record<string, Funcion> = {
  vdc: {
    medida: 'vdc',
    nombre: 'DCV',
    rangos: [2, 20, 200, 1000].map((m, i) => rango(m * (i < 3 ? 0.99995 : 1), [1e-4, 1e-3, 1e-2, 1][i]!, 'V', 1, fija(0.5, 3))),
    modelo: () => ({ tipo: 'voltimetro', r: 10e6, c: 100e-12, mv: false }),
  },
  vac: {
    medida: 'vac',
    nombre: 'ACV',
    rangos: [2, 20, 200, 750].map((m, i) => rango(m * (i < 3 ? 0.99995 : 1), [1e-4, 1e-3, 1e-2, 0.1][i]!, 'V', 1, fija(1, 3))),
    banda: BANDA_FN,
    modelo: () => ({ tipo: 'voltimetro', r: 10e6, c: 100e-12, mv: false }),
    sensibilidad: () => ({ min: 0.1, fMax: 10e3 }),
  },
  ohm: {
    medida: 'ohm',
    nombre: 'Ω',
    rangos: [
      rango(199.99, 0.01, 'Ω', 1, fija(2, 3)),
      rango(1999.9, 0.1, 'kΩ', 1e3, fija(2, 3)),
      rango(19999, 1, 'kΩ', 1e3, fija(0.5, 3)),
      rango(199990, 10, 'kΩ', 1e3, fija(0.5, 3)),
      rango(1.9999e6, 100, 'MΩ', 1e6, fija(0.5, 3)),
      rango(19.999e6, 1e3, 'MΩ', 1e6, fija(0.5, 3)),
    ],
    modelo: (r) => OHM_FN[r] ?? OHM_FN[1]!,
  },
  cont: { medida: 'cont', nombre: 'Continuidad', rangos: [rango(199.99, 0.01, 'Ω', 1, fija(2, 3))], modelo: () => OHM_FN[0]! },
  diodo: {
    medida: 'diodo',
    nombre: 'Diodo',
    rangos: [rango(1.9999, 1e-4, 'V', 1, fija(1, 3))],
    modelo: () => ({ tipo: 'ohmimetro', voc: 2.8, rs: 2.5e3 }),
  },
  cap: {
    medida: 'cap',
    nombre: 'Capacidad',
    rangos: [
      rango(9.999e-9, 1e-12, 'nF', 1e-9, fija(2, 5)),
      rango(99.99e-9, 10e-12, 'nF', 1e-9, fija(2, 5)),
      rango(999.9e-9, 100e-12, 'nF', 1e-9, fija(2, 5)),
      rango(9.999e-6, 1e-9, 'µF', 1e-6, fija(2, 5)),
      rango(99.99e-6, 10e-9, 'µF', 1e-6, fija(2, 5)),
      rango(999.9e-6, 100e-9, 'µF', 1e-6, fija(2, 5)),
      rango(9.999e-3, 1e-6, 'mF', 1e-3, fija(5, 20)),
      rango(99.99e-3, 10e-6, 'mF', 1e-3, fija(5, 20)),
    ],
    modelo: (r) => ({ tipo: 'capacimetro', f: frecuenciaCap([10e-9, 100e-9, 1e-6, 10e-6, 100e-6, 1e-3, 10e-3, 100e-3][r] ?? 1e-6) }),
  },
  idc: { medida: 'idc', nombre: 'DCA', rangos: [] },
  iac: { medida: 'iac', nombre: 'ACA', rangos: [], banda: BANDA_FN },
};

/** 2C53T current ranges: mA jack (10 Ω shunt: 50 mA cost 500 mV, figure 21.31) and 10A jack. */
export function rangosCorrienteFn(borne: Borne, ac: boolean): Rango[] {
  const ex = fija(ac ? 1.5 : 1.2, 3);
  if (borne === 'A') return [rango(1.9999, 1e-4, 'A', 1, ex), rango(9.999, 1e-3, 'A', 1, ex)];
  return [rango(19.999e-3, 1e-6, 'mA', 1e-3, ex), rango(199.99e-3, 1e-5, 'mA', 1e-3, ex)];
}

export const FN_BORNES: Record<Exclude<Borne, 'V'>, { r: number; fusible: number }> = {
  mA: { r: 10, fusible: 1 },
  A: { r: 0.01, fusible: 11 },
};

// ------------------------------------------------------------------ one reading

export interface Lectura {
  /** Digits as shown («2.8751», «−0.0123», «OL», «-----»), with a point as decimal separator (LCD). */
  texto: string;
  /** Shown value in SI, or null (OL, nothing to show). */
  valor: number | null;
  unidad: string;
  ol: boolean;
  /** Uncertainty of the shown value according to the specification (SI), or null if unspecified. */
  incertidumbre: number | null;
  rango: Rango;
  /** Fraction of full scale for the bargraph (−1 … 1). */
  barra: number;
}

/** Exact value of a function from the signal, in SI, or null when there is nothing to show. */
export function valorExacto(
  fn: Funcion,
  s: SenalDmm,
  opciones: { rangoPrimario: number; dbmRef: number; modoTemp: number },
): { x: number | null; f: number | null } {
  switch (fn.medida) {
    case 'vdc':
      return { x: estadistica(s.v).dc, f: null };
    case 'vac':
    case 'vfd': {
      const e = estadistica(s.v, fn.banda, fn.sensibilidad?.(opciones.rangoPrimario));
      return { x: e.ac, f: e.f };
    }
    case 'vacdc': {
      const e = estadistica(s.v, fn.banda);
      return { x: e.acdc, f: null };
    }
    case 'dbm': {
      const e = estadistica(s.v, fn.banda, { min: 0.1, fMax: 100e3 });
      const p = (e.ac * e.ac) / opciones.dbmRef / 1e-3;
      return { x: p > 0 ? 10 * Math.log10(p) : null, f: e.f };
    }
    case 'hz': {
      const fuente = typeof s.v === 'number' && typeof s.i !== 'number' ? s.i : s.v;
      const e = estadistica(fuente, undefined, fn.sensibilidad?.(opciones.rangoPrimario) ?? SENS_V(opciones.rangoPrimario));
      return { x: e.f ?? 0, f: e.f };
    }
    case 'hzlog': {
      const e = estadistica(s.v, undefined, undefined, 1.5);
      return { x: e.f ?? 0, f: e.f };
    }
    case 'ciclo': {
      const e = estadistica(s.v, undefined, undefined, 1.5);
      return { x: e.ciclo, f: e.f };
    }
    case 'ohm':
    case 'cont': {
      const v = estadistica(s.v).dc;
      const i = -estadistica(s.i).dc;
      if (i <= 1e-15) return { x: Infinity, f: null };
      return { x: v / i, f: null };
    }
    case 'ns': {
      const v = estadistica(s.v).dc;
      const i = -estadistica(s.i).dc;
      return { x: v > 0 ? i / v : 0, f: null };
    }
    case 'diodo':
      return { x: estadistica(s.v).dc, f: null };
    case 'cap':
      return { x: s.c ?? null, f: null };
    case 'idc':
      return { x: estadistica(s.i).dc, f: null };
    case 'iac': {
      const e = estadistica(s.i, fn.banda, { min: 0, fMax: 10e3 });
      return { x: e.ac, f: e.f };
    }
    case 'iacdc':
      return { x: estadistica(s.i, fn.banda).acdc, f: null };
    case 'lazo':
      return { x: ((estadistica(s.i).dc - 4e-3) / 16e-3) * 100, f: null };
    case 'temp': {
      const t1 = s.t1 ?? 22;
      const t2 = s.t2 ?? 22;
      const x = [t1, t2, t1, t1 - t2][opciones.modoTemp] ?? t1;
      return { x, f: null };
    }
  }
}

/** Range an auto-ranging meter settles on for a value (with hysteresis around the current one). */
export function autoRango(rangos: Rango[], x: number | null, actual: number): number {
  if (x === null || !Number.isFinite(x)) return rangos.length - 1;
  const a = Math.abs(x);
  const cabe = (r: number) => a <= rangos[r]!.max;
  if (actual >= 0 && actual < rangos.length && cabe(actual) && (actual === 0 || a >= rangos[actual - 1]!.max * 0.9)) return actual;
  for (let r = 0; r < rangos.length; r++) if (cabe(r)) return r;
  return rangos.length - 1;
}

/**
 * The value a meter shows: exact value + fixed calibration error inside the specification + noise of a digit,
 * quantised to the resolution of the range.
 */
export function mostrar(
  clave: string,
  rango: Rango,
  x: number | null,
  f: number | null,
  opciones: { alta?: boolean; ruido?: boolean; sinSigno?: boolean } = {},
): Lectura {
  const vacia: Lectura = { texto: '-----', valor: null, unidad: rango.unidad, ol: false, incertidumbre: null, rango, barra: 0 };
  if (x === null || Number.isNaN(x)) return vacia;
  const res = opciones.alta ? rango.res / 10 : rango.res;
  const dec = decimales(rango, opciones.alta);
  const fmtOL = (): Lectura => ({ ...vacia, texto: 'OL', ol: true, barra: 1 });
  if (!Number.isFinite(x) || Math.abs(x) > rango.max * 1.0001) return fmtOL();
  const spec = rango.exactitud(f);
  let y = x;
  let inc: number | null = null;
  if (spec) {
    const [pct, dig] = spec;
    // Below 20 % of range the manual adds digits on AC (approximated for every function as 0 here).
    inc = (Math.abs(x) * pct) / 100 + dig * rango.res;
    // The fixed error of this meter is a third of the specification (a meter in calibration is usually better).
    const e1 = azarFijo(clave + ':g') * 0.33;
    const e2 = azarFijo(clave + ':o') * 0.33;
    y = x + (e1 * pct * x) / 100 + e2 * dig * rango.res;
  }
  if (opciones.ruido !== false) {
    const r = Math.random();
    const salto = opciones.alta ? Math.round((Math.random() - 0.5) * 6) : r < 0.12 ? 1 : r > 0.88 ? -1 : 0;
    y += salto * res;
  }
  let cuentas = Math.round(y / res);
  if (opciones.sinSigno && cuentas < 0) cuentas = 0;
  const valor = cuentas * res;
  if (Math.abs(valor) > rango.max * 1.0001) return fmtOL();
  const texto = (valor / rango.escala).toFixed(dec).replace('-', '−');
  return {
    texto: /^−0\.?0*$/.test(texto) ? texto.slice(1) : texto,
    valor,
    unidad: rango.unidad,
    ol: false,
    incertidumbre: inc,
    rango,
    barra: Math.max(-1, Math.min(1, valor / rango.max)),
  };
}
