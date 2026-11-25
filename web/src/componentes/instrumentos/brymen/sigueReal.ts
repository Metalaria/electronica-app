// 2.1 (owner's request of 25-11): with the real Brymen BM869s connected, the drawn meter's rotary selector follows the
// real one. The BU-86X frame carries no selector position, so the position and the sub-function (SELECT) are inferred
// from what the real display shows: the main display's unit, prefix and AC/DC marks, the secondary display's unit, and
// the diode («diod») and continuity flags (lib/brymen-real/protocolo.ts). Read-only: nothing is ever sent to the meter.
//
// Positions and sub-functions are those of motor/dmm.ts (BM_POSICIONES). What the frame cannot tell apart:
//   - VFD V∿ and V∿: the protocol has no VFD annunciator, so both send «V, AC» (and «Hz» with «V, AC» under it);
//     the plain V∿ is chosen.
//   - dBm at V∿ and at mV∿: both send «dBm» on the main display; the plain V∿ is chosen.
// No reading (OFF, cable silent) or a display with no unit: null, and the drawn selector stays where it was.

import { BM_POSICIONES } from '../motor/dmm.ts';
import type { LecturaReal } from '../../../lib/brymen-real/protocolo.ts';

export interface PosicionInferida {
  /** Index into BM_POSICIONES. */
  pos: number;
  /** Sub-function index into BM_POSICIONES[pos].subs. */
  sub: number;
  /** When the frame cannot tell this position from another one: a short line for the reader (Spanish). */
  dudosa: string | null;
}

const DUDA_VFD = 'VFD V∿ y V∿ envían lo mismo: el dibujo se queda en V∿.';
const DUDA_DBM = 'Los dBm de V∿ y de mV∿ envían lo mismo: el dibujo se queda en V∿.';

function indice(id: string): number {
  return BM_POSICIONES.findIndex((p) => p.id === id);
}

function en(id: string, sub: number, dudosa: string | null = null): PosicionInferida {
  return { pos: indice(id), sub, dudosa };
}

/** The selector position and sub-function the real meter's reading comes from; null: nothing to infer. */
export function inferirPosicion(l: LecturaReal | null): PosicionInferida | null {
  if (!l) return null;
  const p = l.principal;
  const s = l.secundaria;
  // flags first: they name the function outright
  if (l.diodo) return en('cap', 1);
  if (l.continuidad) return en('ohm', 1);
  const mili = p.prefijo === 'm';
  const secV = !!s && s.unidad === 'V';
  const secVac = secV && s!.ac;
  switch (p.unidad) {
    case 'Ω':
      return en('ohm', 0);
    case 'S':
      return en('ohm', 2);
    case 'F':
      return en('cap', 0);
    case '°C':
    case '°F':
      return en('temp', 0);
    case 'dBm':
      return en('vac', 1, DUDA_DBM);
    case '%':
      // duty cycle on the main display (mV⎓ + SELECT); the 4–20 mA loop shows a current with it
      return s && s.unidad === 'A' ? en('amA', 4) : en('mvdc', 4);
    case 'Hz':
      if (secV) return s!.prefijo === 'm' ? en('mvac', 2) : en('vac', 2, DUDA_VFD);
      if (s && s.unidad !== '') return null;
      // frequency alone: the line-level counter of mV⎓
      return en('mvdc', 3);
    case 'V':
      if (p.ac && p.dc) return en(mili ? 'mvdc' : 'vdc', 2);
      if (p.dc) return en(mili ? 'mvdc' : 'vdc', secVac ? 1 : 0);
      if (p.ac) return mili ? en('mvac', 0) : en('vac', 0, DUDA_VFD);
      return null;
    case 'A': {
      if (s && s.unidad === '%') return en('amA', 4);
      const pos = p.prefijo === 'µ' ? 'ua' : 'amA';
      if (p.ac && p.dc) return en(pos, 2);
      if (p.dc) return en(pos, s && s.unidad === 'A' && s.ac ? 1 : 0);
      if (p.ac) return en(pos, 3);
      return null;
    }
    default:
      // the loop's percentage on the secondary display with a blank main unit
      if (s && s.unidad === '%') return en('amA', 4);
      return null;
  }
}

/** A key that changes only when the inferred function changes (to follow changes, not to fight a hand on the dial). */
export function claveInferida(x: PosicionInferida | null): string {
  return x ? `${x.pos}:${x.sub}` : '';
}
