// Public API of the plot component (see ESQUEMA.md, «Componente de gráficas»).

/** One curve. x and y have the same length; x is usually increasing (time, frequency, sweep). */
export interface Series {
  /** Shown in the legend and the readout; also identifies the curve across updates (animation, trace). */
  name: string;
  /** SI unit of y without prefix: «V», «A», «dB», «°», «Ω», or '' for plain numbers. */
  unit: string;
  x: Float64Array;
  y: Float64Array;
  /** CSS colour; by default the palette slot of the series' position in the list. */
  color?: string;
  dashed?: boolean;
}

export type Scale = 'linear' | 'log';

export interface Axis {
  /** «Tiempo», «Frecuencia», «Tensión»… */
  label: string;
  /** SI unit without prefix; the axis picks the prefix («ms», «kHz»). */
  unit: string;
  scale: Scale;
  /** Fixed range (otherwise it follows the data). */
  min?: number;
  max?: number;
}

/**
 * State shared by plots drawn against the same x (Bode magnitude and phase, voltages and currents of one
 * transient): zoom/pan of x, the crosshair and the measurement cursors move together.
 */
export class PlotLink {
  /** Visible x range, or null to follow the data. */
  xRange = $state<[number, number] | null>(null);
  /** x of the crosshair, or null. */
  hoverX = $state<number | null>(null);
  cursorsOn = $state(false);
  /** x of cursors A and B (data units), or null to place them at 1/3 and 2/3 of the view. */
  cursors = $state<[number, number] | null>(null);
}
