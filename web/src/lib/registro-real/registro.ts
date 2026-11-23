// The recorder of the real instruments (the Brymen BM869s through its cable, the FNIRSI 2C53T through its USB link):
// what each one's display shows, kept over time. Each instrument has its own series; a series is a list of samples
// (one per reading the connection handed over) and, apart, the running figures of its last «tramo»: the samples
// since the instrument last changed of magnitude (a trend of volts followed by ohms means nothing as one curve).
// Everything here is plain data and arithmetic (no instrument, no page): registrador.svelte.ts feeds it.
//
// Nothing is saved anywhere: the record lives while the page does, and leaves as a CSV file when the reader asks.

import type { PantallaReal } from '../brymen-real/protocolo.ts';
import { textoPantalla } from '../brymen-real/lectura.ts';

export type InstrumentoReal = 'brymen' | 'fnirsi';

export const NOMBRE_INSTRUMENTO: Record<InstrumentoReal, string> = { brymen: 'Brymen BM869s', fnirsi: 'FNIRSI 2C53T' };

/** Most samples kept per instrument: about 100 minutes of the FNIRSI (6 a second), over three hours of the Brymen. */
export const MAXIMO_MUESTRAS = 36_000;

export const ESCALA_PREFIJO: Record<PantallaReal['prefijo'], number> = { '': 1, n: 1e-9, µ: 1e-6, m: 1e-3, k: 1e3, M: 1e6 };

export interface Muestra {
  /** When the reading arrived (Date.now()). */
  t: number;
  /** In SI units; null: the display has no number that can be used (OL, a word, blank, or a reading not trusted). */
  valor: number | null;
  /** The display as the instrument shows it («9,201 V ⎓», «OL», «Auto»). */
  texto: string;
  /** What is being measured: the unit and its kind («V ⎓», «V ∿», «Ω»); '' when the display has no unit. */
  magnitud: string;
  unidad: PantallaReal['unidad'];
  prefijo: PantallaReal['prefijo'];
  decimales: number;
  /** Alternating, direct (only said for volts and amperes). */
  ac: boolean;
  dc: boolean;
}

/** The weight of the display's last digit, in SI units. */
export function resolucion(m: Pick<Muestra, 'prefijo' | 'decimales'>): number {
  return 10 ** -m.decimales * ESCALA_PREFIJO[m.prefijo];
}

/** What a display measures, as a short key that is also shown: «V ⎓», «V ∿», «V AC+DC», «Ω», «°C»; '' without unit. */
export function magnitudDe(p: PantallaReal): string {
  if (!p.unidad) return '';
  if (p.ac && p.dc) return `${p.unidad} AC+DC`;
  if (p.ac) return `${p.unidad} ∿`;
  if (p.dc && (p.unidad === 'V' || p.unidad === 'A')) return `${p.unidad} ⎓`;
  return p.unidad;
}

/**
 * A display as a sample. `fiable` false (the FNIRSI's readings the app does not trust yet, or around a change of
 * function) keeps the text but not the number. `texto` overrides what is shown («Auto»).
 */
export function muestraDe(p: PantallaReal, t: number, fiable = true, texto?: string): Muestra {
  const usable = fiable && !p.ol && p.valor !== null && Number.isFinite(p.valor);
  return {
    t,
    valor: usable ? p.valor : null,
    texto: texto ?? textoPantalla(p),
    magnitud: magnitudDe(p),
    unidad: p.unidad,
    prefijo: p.prefijo,
    decimales: p.decimales,
    ac: p.ac,
    dc: p.dc,
  };
}

export interface Estadisticas {
  /** Samples with a number, of the last «tramo». */
  n: number;
  min: number;
  max: number;
  media: number;
  /** Sample standard deviation (n − 1); 0 with a single sample. */
  desviacion: number;
  ultimo: number;
  /** First and last sample with a number. */
  desde: number;
  hasta: number;
  magnitud: string;
  unidad: PantallaReal['unidad'];
  /** The prefix and the decimals of the display at the last sample with a number (how the figures are written). */
  prefijo: PantallaReal['prefijo'];
  decimales: number;
}

/**
 * A figure of a series written as its instrument writes its readings: in the display's prefixed unit, with the
 * display's decimals plus `extra` (a mean has one more digit than the readings it comes from).
 */
export function cifra(v: number, e: Pick<Estadisticas, 'unidad' | 'prefijo' | 'decimales'>, extra = 0): string {
  let t = (v / ESCALA_PREFIJO[e.prefijo]).toFixed(Math.min(12, e.decimales + extra));
  if (Number(t) === 0) t = t.replace('-', '');
  return `${t.replace('-', '−').replace('.', ',')} ${e.prefijo}${e.unidad}`;
}

export interface Punto {
  t: number;
  v: number;
}

/** One instrument's samples and the running figures of its last «tramo». */
export class Serie {
  readonly muestras: Muestra[] = [];
  /** Index of the first sample of the last «tramo». */
  private inicio = 0;
  private magnitud = '';
  private unidad: PantallaReal['unidad'] = '';
  private prefijo: PantallaReal['prefijo'] = '';
  private decimales = 0;
  private n = 0;
  private media = 0;
  /** Sum of squared distances to the mean (Welford: no large sums to cancel). */
  private s2 = 0;
  private min = Infinity;
  private max = -Infinity;
  private ultimo = 0;
  private desde = 0;
  private hasta = 0;
  private cortes = new Set<number>();

  get llena(): boolean {
    return this.muestras.length >= MAXIMO_MUESTRAS;
  }

  /** Adds a sample; false when the series is full (nothing is dropped to make room: the reader is told instead). */
  anadir(m: Muestra): boolean {
    if (this.llena) return false;
    // a new magnitude starts a new «tramo»; a display without unit (blank, «Auto») belongs to the one under way
    if (m.magnitud && m.magnitud !== this.magnitud) {
      this.inicio = this.muestras.length;
      this.magnitud = m.magnitud;
      this.unidad = m.unidad;
      this.n = 0;
      this.media = 0;
      this.s2 = 0;
      this.min = Infinity;
      this.max = -Infinity;
    }
    this.muestras.push(m);
    if (m.valor !== null && m.magnitud) {
      const d = m.valor - this.media;
      this.n++;
      this.media += d / this.n;
      this.s2 += d * (m.valor - this.media);
      if (m.valor < this.min) this.min = m.valor;
      if (m.valor > this.max) this.max = m.valor;
      this.ultimo = m.valor;
      this.prefijo = m.prefijo;
      this.decimales = m.decimales;
      if (this.n === 1) this.desde = m.t;
      this.hasta = m.t;
    }
    return true;
  }

  /** The figures of the last «tramo»; null while it has no number. */
  estadisticas(): Estadisticas | null {
    if (!this.n) return null;
    return {
      n: this.n,
      min: this.min,
      max: this.max,
      media: this.media,
      desviacion: this.n > 1 ? Math.sqrt(Math.max(0, this.s2) / (this.n - 1)) : 0,
      ultimo: this.ultimo,
      desde: this.desde,
      hasta: this.hasta,
      magnitud: this.magnitud,
      unidad: this.unidad,
      prefijo: this.prefijo,
      decimales: this.decimales,
    };
  }

  /** The record was paused here: the line is not drawn across the pause. */
  cortar(): void {
    this.cortes.add(this.muestras.length);
  }

  /**
   * The last «tramo» to draw: runs of consecutive numbers (a sample without number —OL, blank— or a pause cuts the
   * line), with at most about `maximo` points in all. A long record is thinned by keeping the lowest and the highest
   * of each stretch, so a spike is never lost to the thinning.
   */
  trazos(maximo = 600): Punto[][] {
    const total = this.muestras.length - this.inicio;
    const paso = Math.max(1, Math.ceil(total / Math.max(2, Math.floor(maximo / 2))));
    const v: Punto[][] = [];
    let actual: Punto[] = [];
    let bajo: Punto | null = null;
    let alto: Punto | null = null;
    let enTramo = 0;
    const volcar = () => {
      if (bajo && alto) {
        if (bajo.t === alto.t) actual.push(bajo);
        else if (bajo.t < alto.t) actual.push(bajo, alto);
        else actual.push(alto, bajo);
      }
      bajo = alto = null;
      enTramo = 0;
    };
    const cerrar = () => {
      volcar();
      if (actual.length) v.push(actual);
      actual = [];
    };
    for (let j = this.inicio; j < this.muestras.length; j++) {
      if (this.cortes.has(j)) cerrar();
      const m = this.muestras[j]!;
      if (m.valor === null) {
        cerrar();
        continue;
      }
      if (!bajo || m.valor < bajo.v) bajo = { t: m.t, v: m.valor };
      if (!alto || m.valor > alto.v) alto = { t: m.t, v: m.valor };
      if (++enTramo >= paso) volcar();
    }
    cerrar();
    return v;
  }

  borrar(): void {
    this.muestras.length = 0;
    this.cortes.clear();
    this.inicio = 0;
    this.magnitud = '';
    this.unidad = '';
    this.n = 0;
    this.media = 0;
    this.s2 = 0;
    this.min = Infinity;
    this.max = -Infinity;
  }
}

// ------------------------------------------------------------------ stability

/** Readings that must agree before one is taken as «the» measurement. */
export const LECTURAS_ESTABLES = 3;

/**
 * The reading the instrument has settled on: the last of its `LECTURAS_ESTABLES` most recent samples when all have a
 * number, measure the same on the same range, and differ by no more than 0,2 % of the reading plus four counts
 * (a probe being put on, a range still changing or a moving signal do not pass). Null otherwise.
 */
export function estable(recientes: readonly Muestra[]): Muestra | null {
  if (recientes.length < LECTURAS_ESTABLES) return null;
  const v = recientes.slice(-LECTURAS_ESTABLES);
  const u = v[v.length - 1]!;
  let min = Infinity;
  let max = -Infinity;
  for (const m of v) {
    if (m.valor === null || !m.magnitud || m.magnitud !== u.magnitud || m.prefijo !== u.prefijo || m.decimales !== u.decimales) return null;
    if (m.valor < min) min = m.valor;
    if (m.valor > max) max = m.valor;
  }
  const margen = 0.002 * Math.abs(u.valor!) + 4 * resolucion(u);
  return max - min <= margen * (1 + 1e-9) ? u : null;
}

// ------------------------------------------------------------------ CSV

const dos = (n: number) => String(n).padStart(2, '0');

/** Local date and time as a spreadsheet reads it: «2026-11-23 13:57:02». */
export function horaLocal(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
}

/** A number for the file: nine significant digits at most (no binary noise), decimal comma. */
export function numeroCsv(v: number): string {
  return String(Number(v.toPrecision(9))).replace('.', ',');
}

/** A field, quoted when it needs to be. */
export function campoCsv(s: string): string {
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Rows as a CSV file the way a Spanish spreadsheet opens it by itself: «;» between fields, decimal comma, CRLF line
 * ends and the UTF-8 mark at the start (without it Excel reads «Ω» and «µ» wrong).
 */
export function csv(cabecera: string[], filas: string[][]): string {
  return `﻿${[cabecera, ...filas].map((f) => f.map(campoCsv).join(';')).join('\r\n')}\r\n`;
}

function tipoDe(m: Muestra): string {
  if (m.ac && m.dc) return 'CA+CC';
  if (m.ac) return 'CA';
  return m.dc && (m.unidad === 'V' || m.unidad === 'A') ? 'CC' : '';
}

/**
 * The record as a file: one row per sample, the instruments interleaved by time. The value is in the base unit
 * (volts, ohms, amperes: no prefix), so a column can be plotted or averaged as it is; «lectura» is what the display
 * showed; «usable» says whether the row has a number («no»: OL, blank, «Auto», or a reading the app does not trust).
 */
export function csvRegistro(series: Partial<Record<InstrumentoReal, readonly Muestra[]>>, inicio: number): string {
  const filas: { t: number; f: string[] }[] = [];
  for (const i of ['brymen', 'fnirsi'] as const)
    for (const m of series[i] ?? [])
      filas.push({
        t: m.t,
        f: [
          NOMBRE_INSTRUMENTO[i],
          horaLocal(m.t),
          numeroCsv(Math.round(m.t - inicio) / 1000),
          m.valor === null ? '' : numeroCsv(m.valor),
          m.unidad,
          tipoDe(m),
          m.texto,
          m.valor === null ? 'no' : 'sí',
        ],
      });
  filas.sort((a, b) => a.t - b.t);
  return csv(['instrumento', 'hora', 'segundos', 'valor', 'unidad', 'tipo', 'lectura', 'usable'], filas.map((x) => x.f));
}

/** «3 min 05 s», «42 s». */
export function duracion(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${dos(s % 60)} s`;
  return `${Math.floor(m / 60)} h ${dos(m % 60)} min`;
}
