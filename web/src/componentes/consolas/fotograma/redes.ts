// Helpers for the adapters: a bus of numbered lines with the level of each bit, or a single line.

import type { GrupoSenal, RedActiva } from './tipos';

/** One RedActiva per line of a bus; line i carries bit i of `valor`. Empty names (lines not on the board) are skipped. */
export function bus(out: RedActiva[], nombres: string[], valor: number, grupo: GrupoSenal, desde?: string): void {
  for (let i = 0; i < nombres.length; i++) {
    const red = nombres[i];
    if (red) out.push({ red, grupo, nivel: (valor >> i) & 1 ? 1 : 0, desde });
  }
}

export function linea(out: RedActiva[], red: string, nivel: 0 | 1 | null, grupo: GrupoSenal, desde?: string): void {
  out.push({ red, grupo, nivel, desde });
}

/** Names «prefix0» … «prefix(n-1)». */
export function nombres(prefijo: string, n: number, sufijo = ''): string[] {
  return Array.from({ length: n }, (_, i) => `${prefijo}${i}${sufijo}`);
}
