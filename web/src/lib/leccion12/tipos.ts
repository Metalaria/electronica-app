// 1.2 learning-by-doing step types of the hand-authored lessons (contenido/lecciones11/GUIA.md §10): the data each
// one adds to a card (Tarjeta.actividad, lib/leccion11/tipos.ts) and the reader's state of it while the card is on
// show (EstadoTarjeta.actividad, lib/leccion11/motor.ts). Written by the generator (lib/leccion12/generar12.ts) into
// libro/lecciones11/<parte>/<label>.json; the rules are lib/leccion12/motor12.ts; the cards, componentes/leccion12/.
// Types only.

import type { Eje, Rango, Texto } from '../leccion11/tipos';
import type { TipoAveria } from '../../componentes/practica/averias';
import type { ActividadDigital, EstadoActividadDigital } from './digital/tipos';

// (motor12c: «tocar» on a figure and «tabla» on a logic circuit; «averia», «diseno» and «dibujar» on a logic
// circuit give the digital activities of lib/leccion12/digital/tipos.ts)
export type TipoActividad = 'simular' | 'diseno' | 'averia' | 'ajuste' | 'banco' | 'dibujar' | 'sql' | 'tocar' | 'tabla';

export const TIPOS_ACTIVIDAD: readonly TipoActividad[] = ['simular', 'diseno', 'averia', 'ajuste', 'banco', 'dibujar', 'sql', 'tocar', 'tabla'];

/** A typical wrong estimate and its explanation: the value a misconception gives, or a ratio to the right value. */
export interface ErrorTipico {
  /** An expression of the model: what the reader gets with the misconception (forgot the load, peak for RMS). */
  expr?: string;
  /** Or the ratio estimate / right value it shows up as ([0.9e3, 1.1e3]: a prefix one thousand times too big). */
  razon?: { min?: number; max?: number };
  /** Relative tolerance around `expr` that still counts as this misconception (default: the card's). */
  tol?: number;
  texto: Texto;
}

/** «Prediga y simule»: a numeric estimate with units, then the simulation. */
export interface Simular {
  tipo: 'simular';
  /** The right value: an expression of the model with the card's values (the circuit the simulator runs). */
  objetivo: string;
  unidad: string;
  cifras: number;
  /** Relative error counted as right (0,05 = within 5 %). */
  tol: number;
  /** What is asked for, next to the field («Tensión de salida, V_{salida}»). */
  rotulo: Texto;
  /** The observable of the card's circuit widget that the app's ngspice reads after the estimate (esquema.observables). */
  medida?: string;
  errores: ErrorTipico[];
}

/** «Diseñe»: component values from E series, checked nominal and with the components' tolerances. */
export interface Diseno {
  tipo: 'diseno';
  /** Relative tolerance of each value of the model the design depends on (R_1: 0.05 = ± 5 %). */
  tolerancias: Record<string, number>;
  /** esquinas: every combination of the ends (2ⁿ); montecarlo: `muestras` random boards (uniform within each tolerance). */
  metodo: 'esquinas' | 'montecarlo';
  muestras: number;
  /** Seed of the Monte Carlo draw (from the card's id: the same boards every time). */
  semilla: number;
  /** What passes: the nominal values only, every corner / board, or at least this fraction of the boards. */
  exigir: 'nominal' | 'todas' | number;
  /** Said when the nominal design meets the spec but the tolerances take it out (the lesson of the card). */
  siTolerancias?: Texto;
}

export interface Fallo {
  id: string;
  /** The suspect it is (an id of `sospechosos`). */
  pieza: string;
  /** Kind of fault, named as the 1.0 «Encuentre la avería» names them (componentes/practica/averias.ts). */
  tipo: TipoAveria | 'valor';
  /** The model's values with the fault (an open resistor: 1e9 Ω; a short: 1e-3 Ω; a wrong value). */
  con: Record<string, number>;
  /** Why the measurements point to it (shown when found). */
  texto: Texto;
}

export interface Sonda {
  id: string;
  rotulo: Texto;
  /** Value or calculation of the model the virtual multimeter reads there (with the fault applied). */
  valor: string;
  /** On the oscilloscope: the waveform there, an expression of `x.id` and the model (with the fault applied). */
  curva?: { expr: string; x: Eje & { id: string }; y: Eje };
}

/** «Busque la avería»: a hidden fault, probes that cost one step each, then name the faulty part. */
export interface Averia {
  tipo: 'averia';
  fallos: Fallo[];
  sospechosos: { id: string; rotulo: Texto }[];
  sondas: Sonda[];
  /** Probes allowed. */
  pasos: number;
  /** fija: the faults in their order, one per round; azar: a random one per round. */
  eleccion: 'fija' | 'azar';
  /** Also ask what is wrong with it (open, short…), not only which part. */
  preguntarTipo: boolean;
  /** The healthy values of everything a fault changes, in the card's state (set by the generator). */
  sano: Record<string, number>;
}

/** «Ajuste»: a control until a measured quantity enters a band, with live feedback. */
export interface Ajuste {
  tipo: 'ajuste';
  /**
   * The quantity and its band: closed (min and max), or open on one side (motor12e: only `max`, «fits in 3 000 mA·h»;
   * only `min`, «at least 10 years»).
   */
  banda: Rango;
  rotulo: Texto;
  /** The meter's scale (default: the band ± three times its width; an open band, the values its controls reach). */
  escala: { min: number; max: number };
  /** Live feedback below, above and inside the band (the open side's is empty: it is never shown). */
  bajo: Texto;
  alto: Texto;
  dentro: Texto;
}

/** «En el banco» (optional): the reader builds it at home, measures, and the app compares. */
export interface Banco {
  tipo: 'banco';
  piezas: Texto[];
  /** What to measure and how («La tensión entre A y masa, con el Brymen en V⎓»). */
  medir: Texto;
  /** Expected value: an expression of the model. */
  esperado: string;
  unidad: string;
  cifras: number;
  /** Relative deviation accepted (the components' tolerances and the meter's). */
  tol: number;
  /** Advice by the signed relative deviation (`desviacion` = medida/esperado − 1) or the measured value (`medida`). */
  consejos: { cuando?: Rango; texto: Texto }[];
  /** The sheet of the «Cuaderno de prácticas» it goes with. */
  ficha?: { n: number; titulo: string };
}

/** «Dibuje la forma de onda»: the reader draws a curve over the axes; compared with the model's. */
export interface Dibujar {
  tipo: 'dibujar';
  x: Eje & { id: string };
  y: Eje;
  /** The right curve: an expression of `x.id` and the model. */
  curva: string;
  /** Points of the drawing (evenly spaced along x). */
  puntos: number;
  /** Normalised error (RMS / height of the y axis) counted as right. */
  tol: number;
  /** Shift along x (fraction of the axis) and offset along y (fraction of its height) forgiven. */
  holgura: number;
  rotulo: Texto;
}

/** A result of SQL: columns and rows (numbers, text or null). */
export interface ResultadoSql {
  columnas: string[];
  filas: (number | string | null)[][];
}

/** «SQL»: queries against the sample measurements database of section 17.10. */
export interface Sql {
  tipo: 'sql';
  modo: 'consulta' | 'rellenar' | 'ordenar';
  /** The sample database (lib/leccion12/sql/muestra.ts). */
  base: 'mediciones';
  /** The reference query (the generator runs it: `esperado` is its result). */
  solucion: string;
  esperado: ResultadoSql;
  /** The row order counts (the solution sorts with ORDER BY). */
  ordenado: boolean;
  /** consulta: what the editor starts with. */
  inicial?: string;
  /** rellenar: the query with blanks «[[1]]», «[[2]]»…, and each blank's choices (free text without them). */
  plantilla?: string;
  huecos?: { opciones?: string[] }[];
  /** ordenar: the clauses in their right order, and the order they start in. */
  clausulas?: string[];
  inicio?: number[];
}

export type Actividad12 = Simular | Diseno | Averia | Ajuste | Banco | Dibujar | Sql | ActividadDigital;

// ------------------------------------------------------------------ the reader's state (in memory only)

export interface EstadoSimular {
  tipo: 'simular';
  texto: string;
  /** The estimate read from the field (SI units), or null if it is not a value. */
  valor: number | null;
}

export interface EstadoAveria {
  tipo: 'averia';
  /** Index of the hidden fault in `fallos`. */
  fallo: number;
  /** Rounds played (another board after one is solved). */
  ronda: number;
  /** Probes taken, in order (ids of `sondas`). */
  medidas: string[];
  sospechoso: string | null;
  tipoElegido: string | null;
  /** Suspects already named and wrong. */
  descartados: string[];
}

export interface EstadoBanco {
  tipo: 'banco';
  texto: string;
  valor: number | null;
  comparado: boolean;
}

export interface EstadoDibujar {
  tipo: 'dibujar';
  /** The drawing: one y per point (null while not drawn). */
  ys: (number | null)[];
  /** Point selected by the keyboard fallback. */
  punto: number;
}

export interface EstadoSql {
  tipo: 'sql';
  texto: string;
  huecos: string[];
  orden: number[];
  /** The last run: of which text, and its result or its error (explained in Spanish). */
  ejecutado: { texto: string; resultado?: ResultadoSql; total?: number; error?: string } | null;
}

/** «diseno» and «ajuste» keep nothing of their own: their values are the widget's controls. */
export type EstadoActividad12 = EstadoSimular | EstadoAveria | EstadoBanco | EstadoDibujar | EstadoSql | { tipo: 'diseno' | 'ajuste' } | EstadoActividadDigital;
