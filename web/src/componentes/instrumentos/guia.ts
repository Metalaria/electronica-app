// What a tutor (componentes/protoboard/tutor.svelte.ts, 0.10) lights up on an instrument: the dial position
// to turn to, the jack for the red lead, a button to press. Only a highlight: the user does it.

import type { Borne } from './motor/dmm.ts';

export interface GuiaBrymen {
  /** Id of a selector position (motor/dmm.ts BM_POSICIONES). */
  posicion?: string | null;
  borne?: Borne | null;
}

export interface GuiaFnirsi {
  /** Id of a button of Fnirsi.svelte (auto, ch1, menu, power, trigger…). */
  boton?: string | null;
}
