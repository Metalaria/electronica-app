// Number formats of the kit page: Spanish decimal comma, «−», thin space before the unit.

import { FINO } from '../figuras-vivas/formato';

export { si } from '../figuras-vivas/formato';

/** Fixed decimals with a decimal comma and a true minus sign. */
export function fx(v: number, dec = 2): string {
  if (!Number.isFinite(v)) return '—';
  const t = Math.abs(v).toFixed(dec).replace('.', ',');
  return (v < 0 && Number(t.replace(',', '.')) !== 0 ? '−' : '') + t;
}

export const conUnidad = (v: number, dec: number, u: string) => `${fx(v, dec)}${FINO}${u}`;
export const mhz = (hz: number | null, dec = 1) => (hz == null ? '—' : conUnidad(hz / 1e6, dec, 'MHz'));
export const khz = (hz: number | null, dec = 2) => (hz == null ? '—' : conUnidad(hz / 1e3, dec, 'kHz'));
export const voltios = (v: number | null, dec = 2) => (v == null ? '—' : conUnidad(v, dec, 'V'));
