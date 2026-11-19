// 1.3 (tactil13): the short vibrations of a placement drag — a tick when the snapped hole or node changes, a firmer one
// on landing — through the app's own cue (lib/aprendizaje/retroalimentacion.ts), so the «Sonido y vibración» setting
// of «Aa» switches them off. No sound: a drag ticks too often for one.
import { vibrar } from '../../lib/aprendizaje/retroalimentacion';
import { Pulsos } from './precision';

const pulsos = new Pulsos();

/** The snapped place changed (throttled). */
export function vibrarCambio(): void {
  if (pulsos.toca(performance.now())) vibrar('paso');
}

/** The thing landed where it was shown. */
export function vibrarAterrizaje(): void {
  vibrar('acierto');
}
