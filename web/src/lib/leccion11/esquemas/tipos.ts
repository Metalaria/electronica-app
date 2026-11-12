// 1.1 lessons: what a circuit schematic («esquema») of the `circuito` widget is. Each schematic is self-contained in
// its own folder, lib/leccion11/esquemas/<nombre>/: `esquema.ts` (this definition: its pieces, what it measures, its
// netlist for the app's ngspice, the non-linear approximations it allows and the screen-reader description) and
// `Dibujo.svelte` (the drawing). Nothing lists them by hand: the app collects the folders with import.meta.glob
// (dibujos.ts, definiciones.ts) and Node (web/scripts/esquemas11.mjs) reads the folder, so two authors adding two
// schematics never touch the same file. Types only.

import type { Color, Texto } from '../tipos';

/** The ngspice analysis an observable is read from. */
export type Analisis = 'op' | 'tran' | 'ac';

/** What the drawing measures, as ngspice reads it. */
export interface Observable {
  /**
   * Vectors of the simulation, added or subtracted: «v(salida)», «v(a)-v(b)», «i(vmed)», «-i(vf)». Currents are read
   * through 0 V sources placed where the drawing shows the current, in the direction it shows it.
   */
  medida: string;
  /** op: a DC value; tran: a curve against time; ac: a phasor (a reading at the piece «f», or a curve against frequency). */
  analisis: Analisis;
  /** On AC: the amplitude (peak, in the unit), the phase (degrees, from the source) or the amplitude in dB. */
  ac?: 'mag' | 'fase' | 'db';
  /** V, A, °, dB. */
  unidad: string;
  /** For the guide and the generator's messages («tensión del nodo de salida»). */
  descripcion: string;
  /** Pieces the widget must have for this measure to exist (a load's current needs the load). */
  requiere?: readonly string[];
}

export interface Pieza {
  descripcion: string;
  obligatoria?: boolean;
  /** The piece is a switch of the model (0 open, 1 closed). */
  interruptor?: boolean;
  /** Colour of its control (default blue). */
  color?: Color;
  /** Its control is shown only while this switch piece is closed (a load that appears when connected). */
  seVeCon?: string;
}

/**
 * A piece in the book's constant-drop approximation (a diode's 0,7 V, a LED's 2,0 V, a Zener's VZ, a transistor's
 * 0,7 V and 0,2 V). The simulator uses a real exponential device instead (comun.ts), so the model and ngspice differ
 * by as much as the approximation does. lib/leccion11/spice.ts allows for it in two ways:
 *   - a DC reading, when the definition says where the device's real drop is (`medida`): the simulator's drop is read,
 *     the model's reading is corrected by its sensitivity to the piece (from the author's own model) times the
 *     difference, and then compared at 0,1 %; the difference itself must stay within `desviacion` — so a model that
 *     does not describe the drawn circuit is still caught, as with a resistor;
 *   - a curve (or a reading without `medida`): the reading is allowed `desviacion` times that sensitivity.
 */
export interface NoLineal {
  pieza: string;
  /** Volts: how far the real device may be from the constant drop over the currents the book uses it at. */
  desviacion: number;
  /** Why that deviation (documented in contenido/lecciones11/GUIA.md §5). */
  porque: string;
  /** The device's real drop in the simulation (a measure, see Observable.medida; coefficients allowed: «v(s)-7*i(vz)»). */
  medida?(c: ContextoNetlist): string;
}

/** What a netlist is built from: the model's values of the pieces in the current state. */
export interface ContextoNetlist {
  /** Value (SI) of a piece; 0 when the widget does not have it. */
  p(pieza: string): number;
  tiene(pieza: string): boolean;
  /** A switch piece that is closed (a piece the widget does not have counts as closed). */
  cerrado(pieza: string): boolean;
}

/** What a drawing and a description are built from. */
export interface ContextoDibujo extends ContextoNetlist {
  /** Plain symbol of a piece's quantity («R₁», «RL»): for descriptions. */
  sim(pieza: string): string;
  /** The symbol as runs, subscripts kept («R_{L}»): for the drawing's labels (kit/Et.svelte). */
  simT(pieza: string): Texto;
  /** Symbol and value as runs («R_{L} 45 Ω»): a piece's usual label. */
  rot(pieza: string): Texto;
  /** A piece's value, formatted («10 kΩ»). */
  val(pieza: string): string;
  /** Any quantity of the model, formatted (hidden as «¿?» in a prediction). */
  ver(id: string): string;
  /** The model's id of a piece. */
  id(pieza: string): string | undefined;
  /** Raw value (SI) of any quantity of the model in this state. */
  n(id: string): number;
  /** Unit of any quantity of the model. */
  unidad(id: string): string;
  /** Whether the readings are hidden (a prediction not checked yet). */
  oculto: boolean;
}

export interface DefinicionEsquema {
  /** Its folder's name (the YAML's `esquema:`). */
  nombre: string;
  /** «Divisor de tensión». */
  titulo: string;
  /** One line for the catalogue. */
  resumen: string;
  piezas: Record<string, Pieza>;
  observables: Record<string, Observable>;
  /** Extra rules of the pieces (one of two modes, a piece that needs another): the error messages. */
  validar?(tiene: (pieza: string) => boolean): string[];
  /** The pieces in the book's constant-drop approximation, with the pieces this widget has. */
  noLineal?(tiene: (pieza: string) => boolean): NoLineal[];
  /**
   * Element lines of the netlist (no title, analysis card or .end: the generator adds them). The same circuit for
   * every analysis; the sources say what each one needs («DC 12», «AC 5 0», «SIN(0 5 50)», «PULSE(…)»).
   */
  netlist(c: ContextoNetlist, analisis: Analisis): string[];
  /**
   * Transient: the simulator always starts from the elements' initial conditions («IC=» on the capacitor and coil
   * lines, «uic»): the state at t = 0 of a switching, or the steady state of a sine source. When that state is only
   * reached after a while (a rectifier's capacitor), `periodos` whole periods of the piece «f» are simulated before the
   * axis starts, and the model is compared with them shifted.
   */
  tran?: {
    periodos?(c: ContextoNetlist): number;
    /**
     * 1.2 (esquemas12): a switching circuit (a comparator, a 555, a sample-and-hold) has edges the model draws as
     * jumps; the simulator's edge lands within a time step or two of it, and so close to an edge the curve is compared
     * with the model anywhere within ± this fraction of the axis' width (lib/leccion11/spice.ts). Elsewhere, 1 %.
     */
    bordes?(c: ContextoNetlist): number;
  };
  /** The circuit for screen readers («Divisor de tensión: fuente de 12 V, R₁ de 10 kΩ arriba…»), without the reading. */
  describir(c: ContextoDibujo): string;
}
