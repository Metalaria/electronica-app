// The real FNIRSI 2C53T's oscilloscope: the average of several acquisitions, computed here in the application.
// The instrument sends each record as it captured it; averaging them takes the noise that is different in each one
// out and leaves the wave, which is the same in all. It is the application's own arithmetic: the instrument is not
// asked for anything and does not average.
//
// Records are not aligned to the trigger (osciloscopio.ts), so each one is first placed with the same rising
// crossing in the middle, to a fraction of a sample, and what is averaged is ANCHO_PROMEDIO samples around it.
// A record with a wave but without a crossing that leaves that room on both sides cannot be placed and is left
// out; a record with no wave to speak of (a flat line with its noise) needs no placing.
import { subidas, type AjustesOsciloscopio, type Traza } from './osciloscopio';

/** Samples of an average: 24 divisions, the crossing it was aligned on in the middle. */
export const ANCHO_PROMEDIO = 600;

export interface TrazaPromediada {
  canal: 0 | 1;
  /** Of the newest record in the average. */
  ajustes: AjustesOsciloscopio;
  /** Sample values, no longer whole numbers. */
  muestras: Float64Array;
  /** Records in it. */
  adquisiciones: number;
}

/** What has to stay the same for two records to be averaged together. */
function clave(t: Traza): string {
  const a = t.ajustes;
  const c = a.canales[t.canal];
  return [t.canal, c.voltiosDiv, c.sonda, c.cero, c.acoplamiento, a.tiempoDiv, a.nivelDisparo].join('|');
}

/** The record's samples around its aligning crossing, or null when it has a wave and no crossing to align on. */
export function alinear(t: Traza, ancho = ANCHO_PROMEDIO): Float64Array | null {
  const m = t.muestras;
  if (m.length < ancho + 1) return null;
  let min = 255;
  let max = 0;
  for (const x of m) {
    if (x < min) min = x;
    if (x > max) max = x;
  }
  const v = new Float64Array(ancho);
  // (under a third of a division there is no wave: the same rule as the measurements)
  if (max - min < 8) {
    for (let k = 0; k < ancho; k++) v[k] = m[k]!;
    return v;
  }
  // the level the panel draws the trace on: the trigger level when the wave crosses it, else its middle
  const nivel = t.ajustes.nivelDisparo;
  const dentro = nivel > min + 1 && nivel < max - 1 ? nivel : (max + min) / 2;
  const medio = ancho / 2;
  const cruce = subidas(m, dentro, Math.max(1, (max - min) / 8)).find((p) => p >= medio && p <= m.length - 1 - medio);
  if (cruce === undefined) return null;
  for (let k = 0; k < ancho; k++) {
    const x = cruce - medio + k;
    const i = Math.min(m.length - 2, Math.max(0, Math.floor(x)));
    const f = x - i;
    v[k] = m[i]! * (1 - f) + m[i + 1]! * f;
  }
  return v;
}

/** The running average of the last `maximo` records of one channel. */
export class Promediador {
  private cola: Float64Array[] = [];
  private ultima: Traza | null = null;
  private huella = '';

  constructor(private maximo: number) {}

  /** How many records are averaged; fewer keeps the newest ones. */
  fijar(maximo: number): void {
    this.maximo = Math.max(1, Math.floor(maximo));
    while (this.cola.length > this.maximo) this.cola.shift();
  }

  vaciar(): void {
    this.cola = [];
    this.ultima = null;
    this.huella = '';
  }

  /**
   * Takes a record in. A change of scale, of time base, of position or of trigger level starts the average again:
   * records taken with different settings are not the same wave on the screen. False when the record could not be
   * aligned and was left out.
   */
  anadir(t: Traza): boolean {
    const h = clave(t);
    if (h !== this.huella) {
      this.cola = [];
      this.huella = h;
    }
    const v = alinear(t);
    if (!v) return false;
    this.cola.push(v);
    this.ultima = t;
    while (this.cola.length > this.maximo) this.cola.shift();
    return true;
  }

  /** The average so far; null before the first record that could be aligned. */
  resultado(): TrazaPromediada | null {
    if (!this.cola.length || !this.ultima) return null;
    const muestras = new Float64Array(ANCHO_PROMEDIO);
    for (const v of this.cola) for (let k = 0; k < muestras.length; k++) muestras[k] = muestras[k]! + v[k]!;
    for (let k = 0; k < muestras.length; k++) muestras[k] = muestras[k]! / this.cola.length;
    return { canal: this.ultima.canal, ajustes: this.ultima.ajustes, muestras, adquisiciones: this.cola.length };
  }
}
