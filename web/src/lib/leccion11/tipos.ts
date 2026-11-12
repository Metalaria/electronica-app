// 1.1 hand-authored lessons («lecciones 1.1»): the data the app loads, as web/scripts/lecciones11.mjs writes it to
// web/public/libro/lecciones11/<parte>/<label>.json from the sources in contenido/lecciones11/<parte>/<label>.yaml
// (format: contenido/lecciones11/GUIA.md and ESQUEMA.md «Lecciones 1.1»). Types only.

import type { Actividad12, TipoActividad } from '../leccion12/tipos';
import type { WidgetFigura, WidgetLogica } from '../leccion12/digital/tipos';

/** A run of a short text: plain, subscript, superscript, bold, or the live value of a quantity of the model. */
export type Trozo =
  | { t: 'txt'; s: string }
  | { t: 'sub'; s: string }
  | { t: 'sup'; s: string }
  | { t: 'b'; s: string }
  | { t: 'val'; id: string };

/** A short text without HTML (rendered run by run: nothing is ever injected as markup). */
export type Texto = Trozo[];

export interface Magnitud {
  /** Symbol as shown («R₁», «V_{salida}» → runs). */
  sim: Texto;
  /** Name for screen readers and the validator's messages («resistencia de arriba»). */
  nombre: string;
  /** SI unit without prefix (Ω, V, A, s, Hz, °, %, or ''). */
  unidad: string;
  /** Significant figures shown (default 3). */
  cifras: number;
  /** Trailing zeros dropped («10 kΩ» instead of «10,0 kΩ»); default true for the model's values and for Ω, F, H. */
  recortar: boolean;
}

export interface ValorModelo extends Magnitud {
  /** Starting value (SI units); a switch is 0 (open) or 1 (closed). */
  valor: number;
  tipo: 'numero' | 'interruptor';
}

export interface CalculoModelo extends Magnitud {
  /** Expression of the calculators' language (componentes/calculadoras/expresion.ts). */
  expr?: string;
  /** Or: a switch of the model chooses between two expressions. */
  si?: string;
  entonces?: string;
  sino?: string;
}

export interface Modelo {
  valores: Record<string, ValorModelo>;
  calculos: Record<string, CalculoModelo>;
  /** The calculations in an order where each one only uses the ones before it (checked by the generator). */
  orden: string[];
}

/** A control of a widget: which value it moves and through which positions. */
export interface Mando {
  valor: string;
  /** deslizador (a list of values), interruptor (on/off), conectar (a button that closes a switch once). */
  tipo: 'deslizador' | 'interruptor' | 'conectar';
  /** The positions (SI units), ascending; [0, 1] for a switch. */
  valores: number[];
  /** E series the positions come from, for the label («R₂ (E24)»). */
  serie?: 'E12' | 'E24';
  /** Label of the control (default: the value's symbol). */
  rotulo?: Texto;
  /** A name for each position of a «lista» control, in the order of `valores` (the control reads «rojo (2)»). */
  nombres?: string[];
  /** Text of a «conectar» button. */
  boton?: Texto;
}

export type Color = 'azul' | 'naranja' | 'verde';

export interface Lectura {
  valor: string;
  rotulo: Texto;
}

export interface Barra {
  valor: string;
  rotulo: Texto;
  color: Color;
}

export interface WidgetCircuito {
  tipo: 'circuito';
  /** Schematic: a folder of lib/leccion11/esquemas/ (its definition esquema.ts and its drawing Dibujo.svelte). */
  esquema: string;
  /** Role in the drawing → value or calculation of the model (the schematic's pieces: fuente, arriba, abajo…). */
  piezas: Record<string, string>;
  /** The circuit's curves against time or frequency, under the drawing (computed by the model, checked by ngspice). */
  grafica?: Grafica;
  /** false: only the graph and the controls (the circuit was drawn on an earlier card). Absent: drawn. */
  dibujo?: false;
  lectura?: Lectura;
  barras?: Barra[];
  /** Other live readings under the drawing (chips). */
  datos?: Lectura[];
  /** Quantity (A) that sets the speed of the animated current. */
  corriente?: string;
  mandos: Mando[];
  /** The readings are hidden («¿? V») until the card is checked (a prediction). */
  ocultar: boolean;
}

export interface Curva {
  /** Expression of x (the axis' id) and the model. */
  expr: string;
  color: Color | 'tinta';
  rotulo: Texto;
  discontinua: boolean;
  /** In a circuit's graph: the schematic's observable this curve is (checked against ngspice). Generator only. */
  mide?: string;
}

/** A fixed point of a graph (τ on a charge curve, the cut-off frequency): a dot, a label, guide lines to the axes. */
export interface Marca {
  x: string;
  y: string;
  rotulo: Texto;
  guias: boolean;
}

/** A point of the graph the reader drags: dragging moves `mueve` to the position that brings the point closest. */
export interface Asa {
  mueve: string;
  x: string;
  y: string;
  rotulo: Texto;
}

export interface Eje {
  id?: string;
  min: number;
  max: number;
  unidad: string;
  rotulo: Texto;
  /** Logarithmic axis (frequency, impedance): absent means linear. */
  escala?: 'log';
}

/** The plot itself: axes, curves, handles and marks (a `grafica` widget, or a circuit's graph). */
export interface Grafica {
  x: Eje & { id: string };
  y: Eje;
  curvas: Curva[];
  asas: Asa[];
  /** Absent when there are none. */
  marcas?: Marca[];
}

export interface WidgetGrafica extends Grafica {
  tipo: 'grafica';
  mandos: Mando[];
  lectura?: Lectura;
  /** Other live readings under the graph. */
  datos?: Lectura[];
  ocultar: boolean;
}

/** 1.2: a book figure or photo with tappable zones, and a logic circuit (lib/leccion12/digital/tipos.ts). */
export type Widget = WidgetCircuito | WidgetGrafica | WidgetFigura | WidgetLogica;

/** v ∈ [min, max] (either may be missing). */
export interface Rango {
  valor: string;
  min?: number;
  max?: number;
}

export interface Condicion extends Rango {
  /** Live chip: «Salida: {{V_out}} (3,3 V ± 2 %)». */
  rotulo: Texto;
}

export interface Pista {
  /** When it applies (on an estimate, `valor` may be «estimacion»: the reader's estimate). */
  cuando?: Rango;
  texto: Texto;
}

export interface Opcion {
  texto: Texto;
  bien: boolean;
  /** Why it is right, or why not: shown after checking, for EVERY option. */
  porque: Texto;
}

export interface Estimar {
  /** The value to estimate: an expression of the model (with the card's fixed values). */
  objetivo: string;
  unidad: string;
  min: number;
  max: number;
  paso: number;
  inicio: number;
  /** Relative tolerance counted as right (0,05 = within 5 %). */
  tol: number;
  rotulo: Texto;
  cifras: number;
}

export interface Ordenar {
  /** The items in their right order. */
  elementos: Texto[];
  /** The order they start in (a fixed, never-right permutation chosen by the generator). */
  inicio: number[];
}

export interface Emparejar {
  /** [left, right] in their right pairing. */
  parejas: [Texto, Texto][];
  /** The order the right-hand items are offered in. */
  inicio: number[];
}

export interface Ecuacion {
  /** Key of the book block («cap01#82») and the equation's drawing and Typst source (spoken by habla-matematicas). */
  libro: string;
  svg: string;
  fuente: string;
  w: number;
  h: number;
}

export interface Idea {
  titulo: Texto;
  texto: Texto;
}

/** 1.2: the learning-by-doing step types (lib/leccion12/tipos.ts) are card types too. */
export type TipoTarjeta = 'explorar' | 'predecir' | 'pregunta' | 'formula' | 'reto' | 'sorpresa' | 'porque' | 'resumen' | TipoActividad;

export interface Tarjeta {
  /** Stable id inside the lesson (answers are recorded under it). */
  id: string;
  tipo: TipoTarjeta;
  /** The step's label («Explorar», «Predecir»…). */
  fase: string;
  titulo: Texto;
  texto: Texto;
  nota?: Texto;
  /** Book blocks it comes from (keys of Leccion11.libro). */
  libro: string[];
  /** Values held on this card (overlay; the reader's own values come back on the next card). */
  fijar: Record<string, number>;
  /** Values set when the card is first shown (a challenge that must not start solved). */
  inicio: Record<string, number>;
  widget?: Widget;
  /** Gating of «Continuar» on an explore/surprise card: values to move, switches to close, how many. */
  requiere?: { mover: string[]; minimo: number; conectar: string[] };
  opciones?: Opcion[];
  estimar?: Estimar;
  ordenar?: Ordenar;
  emparejar?: Emparejar;
  condiciones?: Condicion[];
  /** Shown when right (challenge, estimate, order, match). */
  exito?: Texto;
  /** Shown when wrong: the first whose `cuando` holds (one without `cuando` always does). */
  pistas?: Pista[];
  /** One more step of the hint ladder after two failed checks. */
  ayuda?: Texto;
  ec?: Ecuacion;
  /** The formula with the current values: «{{V_in}} · {{R_2}} / ({{R_1}} + {{R_2}}) = {{V_out}}». */
  sustitucion?: Texto;
  ideas?: Idea[];
  /** 1.2: the hint ladder the reader opens one step at a time (pista 1, pista 2), then the solution. */
  escalera?: Texto[];
  solucion?: Texto;
  /** 1.2: the data of a learning-by-doing step (simular, diseno, averia, ajuste, banco, dibujar, sql). */
  actividad?: Actividad12;
}

export interface CitaLibro {
  parte: string;
  bloque: number;
  /** Verbatim words of that block (checked by the generator, which also finds the block by them when an expansion
   * moved it: `bloque` is the block's current index, whatever index the source wrote). */
  cita: string;
}

export interface Leccion11 {
  version: 1;
  /** «cap01/sec-1.4» (the same key as the 1.0 lesson's progress). */
  id: string;
  parte: string;
  seccion: string;
  num: string;
  titulo: string;
  libro: Record<string, CitaLibro>;
  modelo: Modelo;
  tarjetas: Tarjeta[];
}

export interface IndiceLecciones11 {
  version: 1;
  total: number;
  /** «parte/label» → its entry, in the book's order. */
  lecciones: Record<string, EntradaIndice11>;
}

export interface EntradaIndice11 {
  /** Number of cards. */
  tarjetas: number;
  /**
   * The cards «Práctica inteligente» can ask on their own (lib/leccion11/motor.ts esPracticable), in lesson order.
   * Missing in an index written before the motor fixes of 1.1: the lesson then offers nothing to practise.
   */
  preguntas?: { id: string; tipo: TipoTarjeta }[];
}
