// Values for the readouts, in Spanish (Spain) format: decimal comma, «−», SI prefixes and a narrow
// no-break space (the typographic thin space) between number and unit.

import { formatoSI } from '../grafica/formato';
import type { EjeDatos } from './tipos';

/** U+202F: thin space that never breaks the line between a number and its unit. */
export const FINO = ' ';

/** Units shown as written, never with an SI prefix. */
const SIN_PREFIJO = new Set(['dB', 'dBm', 'dBV', 'dBc', 'dBi', '°', '°C', 'º', '%', 'min', 'h', 'LSB', 'K', 'V/V', 'A/A', '']);

/** formatoSI with a thin space before the unit. */
export function si(v: number, unidad = '', cifras = 4): string {
  if (!Number.isFinite(v)) return formatoSI(v, unidad, cifras);
  if (SIN_PREFIJO.has(unidad) && unidad) {
    const t = formatoSI(v, '', cifras);
    return `${t}${unidad === '°' ? '' : FINO}${unidad}`;
  }
  return formatoSI(v, unidad, cifras).replace(/ (?=\S*$)/, FINO);
}

/** Whether an axis carries numbers a reader can read (tick labels with values). */
export function ejeNumerico(e: EjeDatos | undefined): boolean {
  if (!e || e.categorias) return false;
  const marcas = (e.ticks ?? []).filter((t) => !t.menor);
  return marcas.length >= 2 || (e.ticks ?? []).length >= 2;
}

/** A value in the units of an axis (data are stored in the axis unit, as plotted). */
export function valorEje(v: number, e: EjeDatos, cifras = 4): string {
  if (!Number.isFinite(v)) return '—';
  if (e.factor_si != null && e.unidad_si != null) return si(v * e.factor_si, e.unidad_si, cifras);
  const t = formatoSI(v, '', cifras);
  return e.unidad ? `${t}${FINO}${e.unidad}` : t;
}

/** Name of an axis quantity for the readout («tensión», «f»…), or ''. */
export function nombreEje(e: EjeDatos | undefined): string {
  return (e?.magnitud ?? '').replace(/\s*\(.*\)\s*$/, '').trim();
}
