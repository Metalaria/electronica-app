// Options of the 3D board view, kept while switching views and boards.

import type { Acabado } from './pintar';

export const opciones3d = $state({
  /** Layers shown. */
  capas: { F: true, B: true, mascara: true, serigrafia: true, componentes: true },
  acabado: 'hasl' as Acabado,
  /** 0 = assembled board, 1 = layers fully apart. */
  explosion: 0,
  /** See-through board: copper of both faces through a translucent laminate, no mask, no parts. */
  rayosX: false,
  /** Board nets coloured by their DC voltage. */
  tensiones: false,
});

export type Opciones3D = typeof opciones3d;
