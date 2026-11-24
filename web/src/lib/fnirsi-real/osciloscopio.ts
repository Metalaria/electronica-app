// The real FNIRSI 2C53T's oscilloscope: the link's record events (protocolo.ts, kinds 0xA0 and 0xA1) into traces
// in volts and seconds.
//
// A record is one acquisition of one channel, exactly as the instrument's own firmware has it after applying its
// calibration: 1024 samples of 8 bits. It travels as one header event and then data events:
//   0xA0  [1] sequence, [2] channel (0 = CH1, 1 = CH2), [3] 56, [4…7] tick, [8…63] 56 bytes of the firmware's
//         oscilloscope settings at the time of the acquisition
//   0xA1  [1] the same sequence, [2] channel, [3] bytes in this event (≤ 56), [4…7] offset in the record, [8…] samples
// The instrument acquires faster than USB can carry (about twice): the link drops whole records, never parts.
// With both channels on, each acquisition gives a CH1 record and a CH2 record one or two milliseconds apart.
//
// The settings bytes, established on a real unit (2026-11-23) with its own generator (1 kHz square wave, 3.01 V
// peak to peak by its own measurement) and a photograph of the screen at each capture:
//   [2], [3]    volts per division of CH1, CH2 as an index: 0 = 10 mV, then 1-2-5 steps up to 9 = 10 V (seen:
//               0, 2 and 5 against the screen's 10 mV, 50 mV and 500 mV)
//   [4], [5]    vertical position of CH1, CH2, signed: the zero-volt level is sample value 128 + position
//               (CH1 checked in three sessions; CH2 assumed to follow the same rule)
//   [6], [7]    probe setting of CH1, CH2: 0 = X1, 1 = X10 (CH1 checked both ways; CH2 assumed)
//   [20]        channels on: bit 0 CH1, bit 1 CH2
//   [28…29]     trigger level, signed 16 bits, in sample counts from the middle (128)
//   [45]        time per division as an index: 0 = 10 ns, then 1-2-5 steps (seen: 13 with the screen at 200 µs;
//               16 and 11 fit 2 ms and 50 µs; 8 and 9 with the screen at 5 µs and 10 µs on 2026-11-24)
// The scales: 25 sample counts are one vertical division and 25 samples are one horizontal division (the 1 kHz wave
// is 125 samples long at 200 µs per division and 12.5 at 2 ms). The first sample of every record is a filler byte
// of the instrument's acquisition and is dropped here.
//
// The same 25 samples per division hold at 10 µs per division: the frequency this decoder gets from the trace of
// the instrument's generator at 40 kHz is the one the instrument's own measurement gives (40.0 kHz against
// 40.00 kHz, 2026-11-24).
//
// Not established: the samples-per-division rule at any other time base outside 50 µs to 2 ms per division (5 µs
// and 20 µs among them; the fastest time bases cannot have 25 real samples per division), the coupling and the
// trigger edge. `tiempoComprobado` and the channel's `comprobado` say what a caller may rely on.

import { EVT_OSC_CABECERA, EVT_OSC_DATOS, u32 } from './protocolo.ts';

export const MUESTRAS_REGISTRO = 1024;
export const CABECERA_AJUSTES = 56;
/** Sample counts per vertical division and samples per horizontal division. */
export const CUENTAS_POR_DIVISION = 25;
export const MUESTRAS_POR_DIVISION = 25;
/** The instrument's screen: 12 horizontal divisions (300 samples) by 8 vertical ones. */
export const DIVISIONES_X = 12;
export const DIVISIONES_Y = 8;
/** The converter's rails as the records show them (a clipped wave sits exactly on them). */
const TOPE_BAJO = 5;
const TOPE_ALTO = 244;

const PASOS = [1, 2, 5] as const;

/** Volts per division of index `i` at the input (X1): 10 mV … 10 V; null outside the instrument's ten steps. */
export function voltiosPorDivision(i: number): number | null {
  if (!Number.isInteger(i) || i < 0 || i > 9) return null;
  return PASOS[i % 3]! * 10 ** Math.floor(i / 3) * 0.01;
}

/** Seconds per division of index `i`: 10 ns, 20 ns, 50 ns, …; null for a negative or absurd index. */
export function segundosPorDivision(i: number): number | null {
  if (!Number.isInteger(i) || i < 0 || i > 32) return null;
  return PASOS[i % 3]! * 10 ** Math.floor(i / 3) * 10e-9;
}

export interface AjustesCanal {
  activo: boolean;
  /** Volts per division as the screen says it (the probe setting applied). */
  voltiosDiv: number;
  sonda: 1 | 10;
  /** Sample value of zero volts. */
  cero: number;
  /** The byte layout of this channel was checked on the real unit (CH1: yes; CH2: partly, see above). */
  comprobado: boolean;
}

export interface AjustesOsciloscopio {
  canales: [AjustesCanal, AjustesCanal];
  /** Seconds per horizontal division, and per sample. */
  tiempoDiv: number;
  periodoMuestra: number;
  /** The time base is one of those checked on the real unit (10 µs, and 50 µs to 2 ms per division). */
  tiempoComprobado: boolean;
  /** Trigger level as a sample value. */
  nivelDisparo: number;
}

function i8(x: number): number {
  return x > 127 ? x - 256 : x;
}

/** The settings bytes of a record decoded; null when they hold an index the instrument cannot have. */
export function leerAjustes(c: ArrayLike<number>): AjustesOsciloscopio | null {
  const t = segundosPorDivision(c[45] ?? -1);
  const v0 = voltiosPorDivision(c[2] ?? -1);
  const v1 = voltiosPorDivision(c[3] ?? -1);
  if (t === null || v0 === null || v1 === null) return null;
  const mascara = c[20] ?? 0;
  const canal = (k: 0 | 1, v: number): AjustesCanal => {
    const sonda = (c[6 + k] ?? 0) === 1 ? 10 : 1;
    return { activo: (mascara & (1 << k)) !== 0, voltiosDiv: v * sonda, sonda, cero: 128 + i8(c[4 + k] ?? 0), comprobado: k === 0 };
  };
  const nivel = (c[28] ?? 0) | ((c[29] ?? 0) << 8);
  const indice = c[45] ?? 0;
  return {
    canales: [canal(0, v0), canal(1, v1)],
    tiempoDiv: t,
    periodoMuestra: t / MUESTRAS_POR_DIVISION,
    tiempoComprobado: indice === 9 || (indice >= 11 && indice <= 16),
    nivelDisparo: 128 + (nivel > 32767 ? nivel - 65536 : nivel),
  };
}

export interface Traza {
  canal: 0 | 1;
  secuencia: number;
  /** Milliseconds since the instrument started. */
  tick: number;
  ajustes: AjustesOsciloscopio;
  /** The samples, without the filler one (1023). */
  muestras: Uint8Array;
  /** The wave touches the converter's rails: its real size is larger than what is seen. */
  saturada: boolean;
}

interface Parcial {
  secuencia: number;
  tick: number;
  cabecera: Uint8Array;
  datos: Uint8Array;
  recibidos: number;
}

/** Rebuilds records from the link's events; an incomplete one is dropped and the next header awaited. */
export class EnsambladorOsciloscopio {
  private parcial: [Parcial | null, Parcial | null] = [null, null];
  /** Records dropped for a missing or misplaced report (diagnostics). */
  rotos = 0;

  /** One event in; a finished trace out, or null. */
  recibir(informe: ArrayLike<number>): Traza | null {
    const tipo = informe[0];
    const canal = informe[2];
    if ((tipo !== EVT_OSC_CABECERA && tipo !== EVT_OSC_DATOS) || (canal !== 0 && canal !== 1)) return null;
    const secuencia = informe[1] ?? 0;
    const n = informe[3] ?? 0;
    if (tipo === EVT_OSC_CABECERA) {
      if (this.parcial[canal]) this.rotos++;
      const cabecera = new Uint8Array(CABECERA_AJUSTES);
      for (let k = 0; k < Math.min(n, CABECERA_AJUSTES); k++) cabecera[k] = informe[8 + k] ?? 0;
      this.parcial[canal] = { secuencia, tick: u32(informe, 4), cabecera, datos: new Uint8Array(MUESTRAS_REGISTRO), recibidos: 0 };
      return null;
    }
    const p = this.parcial[canal];
    if (!p) return null;
    const desplazamiento = u32(informe, 4);
    if (p.secuencia !== secuencia || desplazamiento !== p.recibidos || n === 0 || n > 56 || desplazamiento + n > MUESTRAS_REGISTRO) {
      this.parcial[canal] = null;
      this.rotos++;
      return null;
    }
    for (let k = 0; k < n; k++) p.datos[desplazamiento + k] = informe[8 + k] ?? 0;
    p.recibidos += n;
    if (p.recibidos < MUESTRAS_REGISTRO) return null;
    this.parcial[canal] = null;
    const ajustes = leerAjustes(p.cabecera);
    if (!ajustes) {
      this.rotos++;
      return null;
    }
    const muestras = p.datos.subarray(1);
    let min = 255;
    let max = 0;
    for (const m of muestras) {
      if (m < min) min = m;
      if (m > max) max = m;
    }
    return { canal, secuencia: p.secuencia, tick: p.tick, ajustes, muestras, saturada: min <= TOPE_BAJO || max >= TOPE_ALTO };
  }

  reiniciar(): void {
    this.parcial = [null, null];
  }
}

/** Volts (at the probe tip, the probe setting applied) of sample value `m` of a trace's channel. */
export function voltios(t: Traza, m: number): number {
  const c = t.ajustes.canales[t.canal];
  return ((m - c.cero) / CUENTAS_POR_DIVISION) * c.voltiosDiv;
}

export interface MedidasTraza {
  /** Volts. */
  minimo: number;
  maximo: number;
  picoPico: number;
  /** Hertz, from the rising crossings of the middle level; null when fewer than two whole periods are in the record. */
  frecuencia: number | null;
}

/** Positions (in samples, fractional) where the trace rises through `nivel`, with hysteresis `h` against noise. */
function subidas(m: Uint8Array, nivel: number, h: number): number[] {
  const v: number[] = [];
  let abajo = false;
  for (let k = 0; k < m.length; k++) {
    const x = m[k]!;
    if (x <= nivel - h) abajo = true;
    else if (abajo && x >= nivel + h) {
      abajo = false;
      // (the crossing itself: back to the last sample under the level, then a straight line to the next one)
      let j = k;
      while (j > 0 && m[j - 1]! >= nivel) j--;
      const a = j > 0 ? m[j - 1]! : x;
      const b = m[j]!;
      v.push(j > 0 && b !== a ? j - 1 + (nivel - a) / (b - a) : j);
    }
  }
  return v;
}

/** The measurements the instrument itself shows (peak to peak, frequency), from the trace. */
export function medirTraza(t: Traza): MedidasTraza {
  let min = 255;
  let max = 0;
  for (const m of t.muestras) {
    if (m < min) min = m;
    if (m > max) max = m;
  }
  const amplitud = max - min;
  let frecuencia: number | null = null;
  // (under a third of a division the crossings are noise)
  if (amplitud >= 8) {
    const s = subidas(t.muestras, (max + min) / 2, Math.max(2, amplitud / 8));
    if (s.length >= 3) {
      const periodo = (s[s.length - 1]! - s[0]!) / (s.length - 1);
      if (periodo > 0) frecuencia = 1 / (periodo * t.ajustes.periodoMuestra);
    }
  }
  const minimo = voltios(t, min);
  const maximo = voltios(t, max);
  return { minimo, maximo, picoPico: maximo - minimo, frecuencia };
}

/**
 * The part of the record the instrument would draw: `n` samples (the screen is 300 wide) placed so that the first
 * rising crossing of `nivel` (the trigger level; the wave's middle when it never crosses it) that leaves room on
 * both sides falls in the middle; the start of the record when there is none. The records are not aligned to the
 * trigger: the instrument aligns them when it draws, and so must whoever shows them.
 */
export function ventana(t: Traza, n = DIVISIONES_X * MUESTRAS_POR_DIVISION, nivel = t.ajustes.nivelDisparo): { inicio: number; muestras: Uint8Array } {
  const m = t.muestras;
  const ancho = Math.min(n, m.length);
  let min = 255;
  let max = 0;
  for (const x of m) {
    if (x < min) min = x;
    if (x > max) max = x;
  }
  const dentro = nivel > min + 1 && nivel < max - 1 ? nivel : (max + min) / 2;
  const medio = Math.floor(ancho / 2);
  const cruce = subidas(m, dentro, Math.max(1, (max - min) / 8)).find((p) => p >= medio && p <= m.length - (ancho - medio));
  const inicio = cruce === undefined ? 0 : Math.max(0, Math.min(m.length - ancho, Math.round(cruce) - medio));
  return { inicio, muestras: m.subarray(inicio, inicio + ancho) };
}
