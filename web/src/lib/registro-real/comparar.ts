// The real FNIRSI 2C53T next to the real Brymen BM869s, both measuring the same thing: how far the FNIRSI is from
// the Brymen (the reference: far more accurate on every range) and whether that distance fits in what the two may be
// off by their makers' own figures — the Brymen's from its manual (lib/brymen-real/comparar.ts) and the FNIRSI's
// from the same table its simulated twin uses (componentes/instrumentos/motor/dmm.ts, FN_FUNCIONES).
//
// Only settled readings are compared (registro.ts, estable), and only when the reader says the two are measuring
// the same: nothing here can know where the probes are. Resistance and capacitance cannot be measured by two
// instruments at once on the same part (each one's test current upsets the other): those are held from one
// instrument and then measured with the other.

import { FN_FUNCIONES, rangosCorrienteFn, type Rango } from '../../componentes/instrumentos/motor/dmm.ts';
import { formatoCorto, formatoSI, MENOS } from '../../componentes/grafica/formato.ts';
import { incertidumbre as incertidumbreBrymen } from '../brymen-real/comparar.ts';
import type { LecturaReal } from '../brymen-real/protocolo.ts';
import type { LecturaFnirsi } from '../fnirsi-real/multimetro.ts';
import { csv, horaLocal, numeroCsv, resolucion, type InstrumentoReal, type Muestra } from './registro.ts';

/** A settled reading of one instrument, with what the instrument itself may be off on that range. */
export interface Medida {
  instrumento: InstrumentoReal;
  /** With a number (`valor` is never null here). */
  muestra: Muestra;
  /** ± in SI units, from the maker's accuracy for the range; null when the app does not have it. */
  incertidumbre: number | null;
  /** The range by its full scale («20 V», «20 kΩ»), or the unit alone when the range is not recognised. */
  escala: string;
  /** Held by the reader (not the live reading). */
  retenida: boolean;
}

function rangosFnirsi(l: LecturaFnirsi): Rango[] {
  const f = FN_FUNCIONES;
  const p = l.pantalla;
  switch (p.unidad) {
    case 'V':
      if (l.funcion === 'diodo') return f.diodo!.rangos;
      return p.ac ? f.vac!.rangos : f.vdc!.rangos;
    case 'A':
      return [...rangosCorrienteFn('mA', p.ac), ...rangosCorrienteFn('A', p.ac)];
    case 'Ω':
      return l.continuidad ? f.cont!.rangos : f.ohm!.rangos;
    case 'F':
      return f.cap!.rangos;
    default:
      return [];
  }
}

/**
 * The FNIRSI's range for a reading —the one whose resolution is the display's last digit— and what the maker says
 * it may be off there (± (% of reading + digits)). The range is null when the display fits none of the table's.
 */
export function exactitudFnirsi(l: LecturaFnirsi): { incertidumbre: number | null; escala: string } {
  const p = l.pantalla;
  const sinEscala = { incertidumbre: null, escala: `${p.prefijo}${p.unidad}` };
  if (p.valor === null) return sinEscala;
  const res = resolucion(p);
  const r = rangosFnirsi(l).find((x) => Math.abs(x.res - res) <= res * 1e-6 && Math.abs(p.valor!) <= x.max * 1.0001);
  if (!r) return sinEscala;
  const ex = r.exactitud(null);
  return {
    incertidumbre: ex ? (ex[0] / 100) * Math.abs(p.valor) + ex[1] * res : null,
    escala: formatoCorto(Number(r.max.toPrecision(2)), p.unidad),
  };
}

export function medidaFnirsi(l: LecturaFnirsi, muestra: Muestra, retenida = false): Medida {
  return { instrumento: 'fnirsi', muestra, ...exactitudFnirsi(l), retenida };
}

export function medidaBrymen(l: LecturaReal, muestra: Muestra, retenida = false): Medida {
  const p = l.principal;
  return { instrumento: 'brymen', muestra, incertidumbre: incertidumbreBrymen(p, l), escala: `${p.prefijo}${p.unidad}`, retenida };
}

/** Two instruments at once on the same part give a wrong reading in this unit (each injects its own test current). */
export function seFalseanJuntos(unidad: string): boolean {
  return unidad === 'Ω' || unidad === 'F';
}

export type Veredicto = 'dentro' | 'fuera' | 'sin-exactitud';

export interface Comparacion {
  /** FNIRSI − Brymen, in SI units. */
  diferencia: number;
  /** Over the Brymen's reading; null when that is zero. */
  relativa: number | null;
  /** What the two may be off together; null when the FNIRSI's accuracy for the range is not known. */
  margen: number | null;
  veredicto: Veredicto;
  /** The comparison in words (Spanish, «usted»). */
  texto: string;
}

export function porcentaje(x: number): string {
  const t = Math.abs(x * 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${x < 0 ? MENOS : x > 0 ? '+' : ''}${t} %`;
}

/** Why two settled readings cannot be compared, or '' when they can. */
export function noComparables(fn: Medida, br: Medida): string {
  if (fn.muestra.magnitud === br.muestra.magnitud) return '';
  return `El FNIRSI mide en ${fn.muestra.magnitud} y el Brymen, en ${br.muestra.magnitud}: ponga los dos en la misma función para compararlos.`;
}

/** The FNIRSI against the Brymen; both must measure the same (noComparables() === ''). */
export function comparar(fn: Medida, br: Medida): Comparacion {
  const a = fn.muestra.valor!;
  const b = br.muestra.valor!;
  const d = a - b;
  const u = fn.muestra.unidad;
  const f = (v: number) => formatoSI(v, u, 4);
  // (an accuracy is a bound, not a measurement: two digits say all it has to say)
  const g = (v: number) => formatoSI(v, u, 2);
  const relativa = b !== 0 ? d / Math.abs(b) : null;
  let texto = `El FNIRSI marca ${fn.muestra.texto} y el Brymen, ${br.muestra.texto}: `;
  texto += d === 0 ? 'coinciden.' : `${f(Math.abs(d))} ${d > 0 ? 'más' : 'menos'}${relativa !== null ? ` (${porcentaje(relativa)})` : ''}.`;
  if (fn.incertidumbre === null)
    return {
      diferencia: d,
      relativa,
      margen: null,
      veredicto: 'sin-exactitud',
      texto: `${texto} La aplicación no tiene la exactitud del FNIRSI para esta escala: no puede decir si esa diferencia es la normal.`,
    };
  const margen = fn.incertidumbre + (br.incertidumbre ?? 0);
  const partes = `FNIRSI ± ${g(fn.incertidumbre)}; Brymen ${br.incertidumbre === null ? 'sin dato de exactitud en esta escala' : `± ${g(br.incertidumbre)}`}`;
  // (the margin is a sum of two rounded figures: a hair over it is still inside)
  if (Math.abs(d) <= margen * (1 + 1e-9))
    return { diferencia: d, relativa, margen, veredicto: 'dentro', texto: `${texto} Cabe en lo que los dos pueden equivocarse en estas escalas según sus fabricantes (${partes}).` };
  return {
    diferencia: d,
    relativa,
    margen,
    veredicto: 'fuera',
    texto: `${texto} Es más de lo que los dos pueden equivocarse en estas escalas según sus fabricantes (${partes}). Compruebe que miden el mismo punto y que la lectura está quieta; si se repite, el FNIRSI se desvía en esta escala.`,
  };
}

/** A comparison the reader wrote down. */
export interface FilaComparacion {
  t: number;
  magnitud: string;
  unidad: string;
  /** The FNIRSI's range. */
  escala: string;
  fnirsi: number;
  brymen: number;
  textoFnirsi: string;
  textoBrymen: string;
  diferencia: number;
  relativa: number | null;
  margen: number | null;
  veredicto: Veredicto;
}

export function filaDe(fn: Medida, br: Medida, c: Comparacion, t: number): FilaComparacion {
  return {
    t,
    magnitud: fn.muestra.magnitud,
    unidad: fn.muestra.unidad,
    escala: fn.escala,
    fnirsi: fn.muestra.valor!,
    brymen: br.muestra.valor!,
    textoFnirsi: fn.muestra.texto,
    textoBrymen: br.muestra.texto,
    diferencia: c.diferencia,
    relativa: c.relativa,
    margen: c.margen,
    veredicto: c.veredicto,
  };
}

export const TEXTO_VEREDICTO: Record<Veredicto, string> = { dentro: 'Dentro', fuera: 'Fuera', 'sin-exactitud': 'Sin dato' };

/** The table as a file (values in base units, the difference also in per cent of the Brymen's reading). */
export function csvComparaciones(filas: readonly FilaComparacion[]): string {
  return csv(
    ['hora', 'magnitud', 'escala del FNIRSI', 'FNIRSI', 'Brymen', 'unidad', 'diferencia', 'diferencia %', 'margen ±', 'resultado'],
    filas.map((x) => [
      horaLocal(x.t),
      x.magnitud,
      x.escala,
      numeroCsv(x.fnirsi),
      numeroCsv(x.brymen),
      x.unidad,
      numeroCsv(x.diferencia),
      x.relativa === null ? '' : numeroCsv(x.relativa * 100),
      x.margen === null ? '' : numeroCsv(x.margen),
      TEXTO_VEREDICTO[x.veredicto],
    ]),
  );
}
