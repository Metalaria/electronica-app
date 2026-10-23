// Interaction state of the plots of one figure, shared by the reader and the full-screen view: A/B cursors
// per plot region and the pinned readout.

export class EstadoGraficas {
  /** A/B cursors shown on every readable plot of the figure. */
  cursores = $state(false);
  /** x of cursors A and B (data units) per group (key: main Axes index). */
  posiciones = $state<Record<number, [number, number]>>({});
  /** Readout pinned by a click or tap: group and SVG point. */
  fijada = $state<{ grupo: number; X: number; Y: number } | null>(null);
}
