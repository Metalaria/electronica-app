// Spaced-repetition scheduler for the glossary flashcards (SM-2 as refined by Anki).
// Pure functions without DOM or storage, so they can be tested and reasoned about alone.
//
// States: a card that was never seen has no state (it is «nueva»). Answering it enters
// «aprendiendo» (short steps in minutes); passing the last step graduates it to «repaso» with an
// interval in days that grows by its ease factor. Failing a card in review («Otra vez») is a lapse:
// the ease drops and the card goes to «reaprendiendo» (a 10-minute step) before returning.
//
// Days start at 04:00 local time (a late-night session still counts for the day it belongs to).

export type Calificacion = 1 | 2 | 3 | 4; // Otra vez, Difícil, Bien, Fácil

export interface EstadoTarjeta {
  /** 'a' aprendiendo, 'r' repaso, 'ra' reaprendiendo. */
  e: 'a' | 'r' | 'ra';
  /** Learning step index. */
  p: number;
  /** Ease factor (2,5 at start, never below 1,3). */
  f: number;
  /** Interval in days (review cards; for relearning, the interval it will return with). */
  i: number;
  /** Due time, ms since epoch. */
  v: number;
  /** Number of answers. */
  n: number;
  /** Lapses (review cards forgotten). */
  l: number;
  /** Last answer, ms since epoch. */
  u: number;
}

export const MINUTO = 60_000;
export const DIA = 86_400_000;
export const PASOS_APRENDIZAJE = [1, 10]; // minutes
export const PASOS_REAPRENDIZAJE = [10]; // minutes
export const INTERVALO_GRADUACION = 1; // days
export const INTERVALO_FACIL = 4; // days
export const FACILIDAD_INICIAL = 2.5;
export const FACILIDAD_MINIMA = 1.3;
export const BONO_FACIL = 1.3;
export const FACTOR_DIFICIL = 1.2;
export const INTERVALO_MAXIMO = 3650; // days
/** Learning cards due within this margin may be shown early when nothing else is left. */
export const ADELANTO = 20 * MINUTO;
export const HORA_CAMBIO_DIA = 4;

/** Start of the review day that contains t (04:00 local). */
export function inicioDia(t: number): number {
  const d = new Date(t);
  if (d.getHours() < HORA_CAMBIO_DIA) d.setDate(d.getDate() - 1);
  d.setHours(HORA_CAMBIO_DIA, 0, 0, 0);
  return d.getTime();
}

/** «2026-10-23»: the review day of t. */
export function claveDia(t: number): string {
  const d = new Date(inicioDia(t));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Start of the review day that is `dias` after the one containing t (DST-safe). */
export function diaMas(t: number, dias: number): number {
  const d = new Date(inicioDia(t));
  d.setDate(d.getDate() + dias);
  return d.getTime();
}

/** Small deterministic spread (±5 %) of long intervals, so cards learnt together do not stay together. */
function dispersar(intervalo: number, id: string, n: number): number {
  if (intervalo < 3) return intervalo;
  let h = 2166136261 ^ n;
  for (let k = 0; k < id.length; k++) h = Math.imul(h ^ id.charCodeAt(k), 16777619);
  const r = ((h >>> 0) % 1000) / 1000; // 0..1
  const margen = Math.max(1, Math.round(intervalo * 0.05));
  return intervalo + Math.round((r * 2 - 1) * margen);
}

function limitar(dias: number): number {
  return Math.min(INTERVALO_MAXIMO, Math.max(1, Math.round(dias)));
}

/** New state of a card after an answer. `previo` undefined = new card. */
export function responder(previo: EstadoTarjeta | undefined, c: Calificacion, ahora: number, id = ''): EstadoTarjeta {
  const s: EstadoTarjeta = previo
    ? { ...previo }
    : { e: 'a', p: 0, f: FACILIDAD_INICIAL, i: 0, v: ahora, n: 0, l: 0, u: ahora };
  s.n += 1;
  s.u = ahora;

  const graduar = (dias: number) => {
    s.e = 'r';
    s.p = 0;
    s.i = limitar(dias);
    s.v = diaMas(ahora, s.i);
  };

  if (s.e === 'a' || s.e === 'ra') {
    const pasos = s.e === 'a' ? PASOS_APRENDIZAJE : PASOS_REAPRENDIZAJE;
    if (c === 1) {
      s.p = 0;
      s.v = ahora + pasos[0]! * MINUTO;
    } else if (c === 2) {
      // Repeat the current step; on the first step, halfway to the next one.
      const actual = pasos[s.p] ?? pasos[pasos.length - 1]!;
      const siguiente = pasos[s.p + 1];
      const espera = s.p === 0 && siguiente != null ? (actual + siguiente) / 2 : actual;
      s.v = ahora + espera * MINUTO;
    } else if (c === 3) {
      s.p += 1;
      if (s.p >= pasos.length) graduar(s.e === 'a' ? INTERVALO_GRADUACION : Math.max(1, s.i));
      else s.v = ahora + pasos[s.p]! * MINUTO;
    } else {
      graduar(s.e === 'a' ? INTERVALO_FACIL : Math.max(1, s.i) + 1);
    }
    return s;
  }

  // Review card. Late answers count the extra days the card was remembered (Anki's delay bonus).
  const retraso = Math.max(0, Math.floor((inicioDia(ahora) - inicioDia(s.v)) / DIA));
  const i0 = Math.max(1, s.i);
  if (c === 1) {
    s.l += 1;
    s.f = Math.max(FACILIDAD_MINIMA, s.f - 0.2);
    s.e = 'ra';
    s.p = 0;
    s.i = 1; // returns with one day after relearning
    s.v = ahora + PASOS_REAPRENDIZAJE[0]! * MINUTO;
    return s;
  }
  // The three intervals are kept in order: Difícil < Bien < Fácil, whatever the spread.
  const dificil = limitar(Math.max(i0 + 1, (i0 + retraso / 4) * FACTOR_DIFICIL));
  const bien = limitar(Math.max(dificil + 1, dispersar(Math.round((i0 + retraso / 2) * s.f), id, s.n)));
  const facil = limitar(Math.max(bien + 1, dispersar(Math.round((i0 + retraso) * s.f * BONO_FACIL), id, s.n)));
  if (c === 2) s.f = Math.max(FACILIDAD_MINIMA, s.f - 0.15);
  if (c === 4) s.f += 0.15;
  s.i = c === 2 ? dificil : c === 3 ? bien : facil;
  s.v = diaMas(ahora, s.i);
  return s;
}

/** «<1 min», «10 min», «1 d», «3,5 meses»: what each answer button would do. */
export function textoEspera(ms: number): string {
  const min = ms / MINUTO;
  if (min < 1) return '<1 min';
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  if (h < 20) return `${Math.round(h)} h`;
  const d = ms / DIA;
  const fmt = (x: number) => (Math.round(x * 10) / 10).toLocaleString('es-ES');
  if (d < 30) return `${Math.max(1, Math.round(d))} d`;
  if (d < 365) return `${fmt(d / 30)} meses`;
  return `${fmt(d / 365)} años`;
}

/** Waiting time before the card comes back, for each answer. */
export function previsiones(previo: EstadoTarjeta | undefined, ahora: number, id = ''): Record<Calificacion, string> {
  const r = {} as Record<Calificacion, string>;
  for (const c of [1, 2, 3, 4] as Calificacion[]) {
    const s = responder(previo, c, ahora, id);
    // Day intervals are shown in days, not as «until 04:00».
    r[c] = s.e === 'r' ? textoEspera(s.i * DIA) : textoEspera(s.v - ahora);
  }
  return r;
}

/** A card is «aprendida» once it graduated to review (or is relearning after a lapse). */
export function aprendida(s: EstadoTarjeta | undefined): boolean {
  return !!s && (s.e === 'r' || s.e === 'ra');
}

/** Mature: interval of 21 days or more. */
export function madura(s: EstadoTarjeta | undefined): boolean {
  return !!s && s.e === 'r' && s.i >= 21;
}
