// 1.1 «Laboratorio guiado»: each practice of printed chapter 21 (cap22) as a lab done with the simulated instruments.
// A step asks the reader to DO something on the bench (place a probe, turn the dial, set the time base, ×10, the
// trigger, AUTO, cursors, FFT…) and, when it has a reading, to type what the instrument shows. «Comprobar» reads the
// instrument state and the live reading (`evaluarPaso`): the first unmet requirement gives its hint (the typical
// mistakes the book names are requirements of their own, placed before the generic ones, so the hint names the
// mistake); the typed value is compared with what the simulated instrument shows, within a tolerance justified by
// that instrument's resolution. Pure: the steps only read the bench (the tests run them in Node on a real Banco).
// The labs themselves are in laboratorios.ts; the panel is PanelLaboratorio.svelte; progress in lib/laboratorio.

import type { Banco } from '../banco.svelte.ts';
import type { Ajustes, Practica } from './tipos';
import { aplicar, cargarVariante } from './aplicar';
import type { GuiaBrymen, GuiaFnirsi } from '../guia';
import { leer } from '../../../lib/magnitudes';
import { formatoSI } from '../../grafica/formato.ts';

/** One condition of a step on the bench, with the hint shown when it does not hold. */
export interface Requisito {
  ok: (b: Banco) => boolean;
  /** Spanish, «usted»; HTML (strong, em, sub, sup). */
  pista: string;
}

/** A reading the reader types, compared with what the simulated instrument shows. */
export interface LecturaLab {
  /** What is read (HTML). */
  que: string;
  /** Bare SI unit of the value ('V', 'A', 'Hz', 's', 'Ω', 'F', 'dB', '%', '°' or ''). */
  unidad: string;
  /** What the instrument shows now (null when it shows nothing usable). */
  medir: (b: Banco) => number | null;
  /** Typed value against the instrument's: relative and/or absolute (the larger applies). */
  tol: { rel?: number; abs?: number };
  /** Why that tolerance: the instrument's resolution (shown with a wrong value). */
  porqueTol: string;
  /** Id of the practice's check (practicas.ts `comprobaciones`) whose book value the summary compares with. */
  libro?: string;
}

/** A typical mistake: what reproduces it on top of the step's right settings, and the hint it must get. */
export interface ErrorTipico {
  nombre: string;
  /** Settings, or a direct change of the instruments (a probe switch alone, which no Ajustes expresses). */
  hacer: Ajustes | ((b: Banco) => void);
  /** A fragment of the hint the step must answer with. */
  pista: string;
}

export interface PasoLab {
  /** Stable id within its lab (progress and XP use it: never rename). */
  id: string;
  titulo: string;
  /** What to do, short (HTML). */
  texto: string;
  /** Applied when the step is first shown: the book's change of set-up (a variant, the supply), never the reader's job. */
  preparar?: Ajustes;
  requisitos: Requisito[];
  lectura?: LecturaLab;
  /** What the instruments light up with «Mostrar dónde», and the instrument the step is about. */
  guia?: { bm?: GuiaBrymen; fn?: GuiaFnirsi; instrumento?: 'brymen' | 'fnirsi' };
  /** «Hágalo por mí»: the settings the step asks for (the typed reading stays the reader's); a function when they
   * depend on the trace (cursors on a crossing). */
  hazlo: Ajustes | ((b: Banco) => Ajustes);
  /** The step uses the oscilloscope's cursors: the panel shows their keyboard control. */
  cursores?: boolean;
  /** The step uses the practice's table of noted points («Anotar punto»). */
  tabla?: boolean;
  /** Typical mistakes (the unit tests make each one and expect its hint). */
  errores?: ErrorTipico[];
}

export interface Laboratorio {
  /** Practice number (practicas.ts). */
  n: number;
  /** The bench at the start: the circuit built, the instruments not set up yet. */
  inicial: Ajustes;
  pasos: PasoLab[];
}

export type Veredicto =
  | { estado: 'bien'; lectura: number | null }
  | { estado: 'mal'; pista: string; lectura: number | null }
  /** The bench is simulating again: nothing can be judged yet. */
  | { estado: 'espera'; pista: string; lectura: null };

const PREFIJOS = [1e-12, 1e-9, 1e-6, 1e-3, 1e3, 1e6];

function dentro(x: number, v: number, tol: LecturaLab['tol']): boolean {
  const t = Math.max(tol.abs ?? 0, Math.abs(v) * (tol.rel ?? 0));
  return Math.abs(x - v) <= t + 1e-15;
}

/** The tolerance as text («± 0,5 %», «± 10 mV»). */
export function textoTolerancia(l: LecturaLab): string {
  const partes: string[] = [];
  if (l.tol.rel !== undefined) partes.push(`${String(Math.round(l.tol.rel * 1000) / 10).replace('.', ',')} %`);
  if (l.tol.abs !== undefined) partes.push(formatoSI(l.tol.abs, l.unidad, 2));
  return `± ${partes.join(' o ')}`;
}

/** Checks a step on the bench as it is now, with the reading the reader typed (if the step has one). */
export function evaluarPaso(p: PasoLab, b: Banco, escrito = ''): Veredicto {
  for (const r of p.requisitos) if (!r.ok(b)) return { estado: 'mal', pista: r.pista, lectura: null };
  const l = p.lectura;
  if (!l) return { estado: 'bien', lectura: null };
  if (!b.vigente) return { estado: 'espera', pista: 'El banco se está simulando con los cambios: espere a que la lectura se actualice y compruebe otra vez.', lectura: null };
  const v = l.medir(b);
  if (v === null || !Number.isFinite(v))
    return { estado: 'mal', pista: 'El instrumento todavía no muestra esa medida: revise que esté conectado y ajustado como dice el paso.', lectura: null };
  const t = escrito.trim();
  if (!t) return { estado: 'mal', pista: `Escriba el valor que lee en el instrumento (${l.que.replace(/<[^>]+>/g, '')}).`, lectura: v };
  const x = leer(t, l.unidad);
  if ('error' in x)
    return {
      estado: 'mal',
      pista: x.error === 'unidad' ? `La unidad no corresponde: esta medida va en ${l.unidad || 'un número sin unidad'}.` : `No se entiende «${t}»: escriba un número, por ejemplo «2,88» o «2,88 ${l.unidad || ''}».`.replace(' »', '»'),
      lectura: v,
    };
  if (dentro(x.valor, v, l.tol)) return { estado: 'bien', lectura: v };
  if (!x.conUnidad && l.unidad && PREFIJOS.some((f) => dentro(x.valor * f, v, l.tol)))
    return { estado: 'mal', pista: `Escriba también la unidad con su prefijo, como en la pantalla (por ejemplo «${formatoSI(v, l.unidad, 3)}»).`, lectura: v };
  // (review 11c: «100,5 F» for 100,5 µF — the unit written without its prefix, or with another — and a dB value with
  // the sign changed had only been told «el instrumento marca otra cosa»)
  if (x.conUnidad && l.unidad && PREFIJOS.concat([1e9, 1e12]).some((f) => dentro(x.valor * f, v, l.tol)))
    return { estado: 'mal', pista: `El número es el de la pantalla, pero falta o sobra el prefijo de la unidad (µ, m, k…): escríbalo como lo muestra el instrumento, en ${l.unidad} con su prefijo.`, lectura: v };
  if (v !== 0 && dentro(-x.valor, v, l.tol))
    return {
      estado: 'mal',
      pista: `Revise el signo: el instrumento marca un valor ${v < 0 ? 'negativo' : 'positivo'}.${l.unidad === 'dB' && v < 0 ? ' La salida es menor que la entrada: una atenuación son decibelios negativos.' : ''}`,
      lectura: v,
    };
  if (dentro(x.valor / 10, v, l.tol) || dentro(x.valor * 10, v, l.tol))
    return { estado: 'mal', pista: 'Su valor está diez veces desviado: ¿ha mirado otra escala o el factor de la sonda?', lectura: v };
  return { estado: 'mal', pista: `El instrumento marca otra cosa: léalo de nuevo (se admite ${textoTolerancia(l)}: ${l.porqueTol}).`, lectura: v };
}

/** The first step not done (the lab resumes there), or the number of steps when every one is. */
export function pasoPendiente(lab: Laboratorio, hechos: readonly string[]): number {
  const i = lab.pasos.findIndex((p) => !hechos.includes(p.id));
  return i < 0 ? lab.pasos.length : i;
}

/** XP / mastery item id of a step (`pr:<id>` once, like a lesson card). Stable. */
export function idPaso(n: number, paso: string): string {
  return `cap22-lab${n}-${paso}`;
}

// ------------------------------------------------------------------ the bench of a lab

/** The bench at the start of a lab: the practice's circuit built, the instruments as the lab says (not set up). */
export function iniciarLaboratorio(b: Banco, p: Practica, lab: Laboratorio): void {
  b.anotaciones = [];
  cargarVariante(b, p, lab.inicial.variante ?? p.variantes[0]!.id);
  b.bm = { rojo: null, negro: null, serie: null };
  b.fn = { rojo: null, negro: null, serie: null };
  b.sondas = { ch1: null, ch2: null, masa: '0' };
  b.alimentado = true;
  b.avisoFusible = '';
  b.brymen.crest = null;
  aplicar(b, p, { ...lab.inicial, variante: undefined });
  b.fnirsi.activo = 0;
}

/** The book's change of set-up when a step is first shown (a variant, the supply). */
export function prepararPaso(b: Banco, p: Practica, paso: PasoLab): void {
  if (paso.preparar) aplicar(b, p, paso.preparar);
}

/** «Hágalo por mí»: the step's settings on the bench. */
export function hacerPaso(b: Banco, p: Practica, paso: PasoLab): void {
  aplicar(b, p, typeof paso.hazlo === 'function' ? paso.hazlo(b) : paso.hazlo);
}
