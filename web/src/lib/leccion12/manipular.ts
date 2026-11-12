// 1.2 direct manipulation: which parts of a lesson schematic the reader can change by touching them, and how a drag
// or a key moves a control. Pure (the unit tests run it in Node). The drawing marks each part with
// `data-pieza="<piece>"` (lib/leccion11/esquemas/<nombre>/Dibujo.svelte and the kit); a piece is touchable on a card
// when `widget.piezas[piece]` is the value of one of the card's controls (a slider, a switch or a «conectar»).
// The values stay those of the control: a slider's positions (`m.valores`, the E12/E24 series already resolved by the
// generator), so a drag snaps to the series. motor12's «ajuste» and «diseño» cards get it by rendering
// CircuitoLeccion with their controls: nothing else to call.

import type { Mando, WidgetCircuito } from '../leccion11/tipos';
import { posicionMasCercana } from '../leccion11/modelo';

/** The control a piece of the drawing moves on this card, or null. */
export function mandoDePieza(widget: WidgetCircuito, pieza: string): Mando | null {
  const id = widget.piezas[pieza];
  if (!id) return null;
  return widget.mandos.find((m) => m.valor === id) ?? null;
}

/** Every touchable piece of the widget with its control (in the order of the controls). */
export function piezasManipulables(widget: WidgetCircuito): { pieza: string; mando: Mando }[] {
  const out: { pieza: string; mando: Mando }[] = [];
  for (const m of widget.mandos) {
    for (const [pieza, id] of Object.entries(widget.piezas)) if (id === m.valor) out.push({ pieza, mando: m });
  }
  return out;
}

/** The value `delta` positions away from `actual` along the control's positions (clamped to its ends). */
export function pasoMando(m: Mando, actual: number, delta: number): number {
  if (!m.valores.length) return actual;
  const k = posicionMasCercana(m.valores, actual);
  const j = Math.max(0, Math.min(m.valores.length - 1, k + Math.round(delta)));
  return m.valores[j]!;
}

/** The value at the first (`inicio`) or last position of a control. */
export function extremoMando(m: Mando, fin: boolean): number {
  return m.valores[fin ? m.valores.length - 1 : 0] ?? 0;
}

/** Pixels of drag per position: a long list moves faster, never under 6 px (a whole E24 decade in about a thumb's sweep). */
export function pxPorPaso(m: Mando): number {
  return Math.max(6, Math.min(22, 220 / Math.max(1, m.valores.length - 1)));
}

/**
 * Positions moved by a drag of (dx, dy) CSS px: right and up increase, left and down decrease (the larger of the two
 * movements wins, so a vertical part dragged up and a horizontal one dragged right both go up).
 */
export function pasosDeArrastre(m: Mando, dx: number, dy: number): number {
  const d = Math.abs(dx) >= Math.abs(dy) ? dx : -dy;
  return Math.trunc(d / pxPorPaso(m));
}

/** The positions a key moves: arrows one, Page Up/Down a tenth of the list (at least one); null for other keys. */
export function pasosDeTecla(m: Mando, tecla: string): number | 'inicio' | 'fin' | null {
  const decimo = Math.max(1, Math.round(m.valores.length / 10));
  switch (tecla) {
    case 'ArrowRight':
    case 'ArrowUp':
      return 1;
    case 'ArrowLeft':
    case 'ArrowDown':
      return -1;
    case 'PageUp':
      return decimo;
    case 'PageDown':
      return -decimo;
    case 'Home':
      return 'inicio';
    case 'End':
      return 'fin';
    default:
      return null;
  }
}
