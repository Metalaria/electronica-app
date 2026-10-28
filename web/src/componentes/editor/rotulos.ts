// Labels of placed parts (designator and value, in the book's style «R₁ 4,7 kΩ»), in world units.

import { partesRef } from '../esquema-auto/colocacion.ts';
import { textoValor } from './catalogo.ts';
import { geometria } from './geometria.ts';
import type { Componente } from './tipos.ts';

export const TAM = 0.42;
export const ALTO = 0.5;

export interface LineaRotulo {
  /** Designator split for the subscript (R + 1), or plain text. */
  base: string;
  sub: string;
  resto: string;
}

export interface Rotulo {
  lineas: LineaRotulo[];
  /** Anchor x and the baseline of the first line (world units). */
  x: number;
  y: number;
  ancla: 'start' | 'middle' | 'end';
}

/** Designator prefixes of several letters that read as a whole («LDR₁», «BZ₁», «RT₁», not «L_DR1»). */
const PREFIJOS_LARGOS = /^(LDR|BZ|LS|BR|RT)(\d{1,4})$/;

function linea(ref: string, resto: string): LineaRotulo {
  if (!ref) return { base: resto, sub: '', resto: '' };
  const m = PREFIJOS_LARGOS.exec(ref);
  const p = m ? { base: m[1]!, sub: m[2]! } : partesRef(ref);
  return { base: p.base, sub: p.sub, resto: resto ? ` ${resto}` : '' };
}

export function rotulo(c: Componente): Rotulo | null {
  const g = geometria(c);
  const v = textoValor(c);
  let lineas: LineaRotulo[];
  if (c.tipo === 'GND' || c.forma?.simbolo === 'PUENTE') return null;
  if (c.tipo === 'ETQ' || c.tipo === 'RIEL') {
    if (!v) return null;
    lineas = [{ base: v, sub: '', resto: '' }];
  } else if (c.tipo === 'SONDA') lineas = [linea(c.nombre, '')];
  else {
    const horizontal = g.etq.dy !== 0;
    lineas = horizontal || !v ? [linea(c.nombre, v)] : [linea(c.nombre, ''), { base: v, sub: '', resto: '' }];
  }
  const { x, y, dx, dy } = g.etq;
  const n = lineas.length;
  let ancla: Rotulo['ancla'] = 'middle';
  let tx = x;
  if (dx > 0) {
    ancla = 'start';
    tx = x + 0.1;
  } else if (dx < 0) {
    ancla = 'end';
    tx = x - 0.1;
  }
  let ty: number;
  if (dy < 0) ty = y - 0.12 - (n - 1) * ALTO;
  else if (dy > 0) ty = y + 0.12 + 0.36;
  else ty = y - ((n - 1) * ALTO) / 2 + 0.15;
  if (c.tipo === 'RIEL' && dy === 0) ty = y + 0.15;
  return { lineas, x: tx + c.x, y: ty + c.y, ancla };
}
