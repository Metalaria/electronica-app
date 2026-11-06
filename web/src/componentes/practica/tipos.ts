// «Aprender haciendo» (0.10): the interactive items of the lessons, generated from the book's own data by
// web/scripts/practica10.mjs into web/public/libro/practica/<parte>.json (see ESQUEMA.md, «Práctica»).
// Plain types, shared by the generator (Node) and the app.

import type { Formula } from '../calculadoras/tipos.ts';

/** A fragment of the book that justifies an answer, and where it is. */
export interface Cita {
  /** Book HTML (a paragraph, a caption, a glossary definition, a list item…), unchanged. */
  html: string;
  /** Label of the place it comes from (section, subsection, figure, exercise…). */
  ref: string;
  /** «Sección 5.3», «Figura 21.5», «Ejercicio 5.1», «Glosario»… */
  donde: string;
}

/** Where the item comes from and how the lesson places it. */
export interface ItemBase {
  id: string;
  parte: string;
  /** Section (h2 label) it belongs to. */
  seccion: string;
  /** Top-level block index it follows (the lesson shows it after the step that contains that block). */
  bloque: number;
  /** The link «Ver …» of the explanation: label and its text («la figura 5.8»). */
  ref: string;
  verRef: string;
  /** Statement (generated sentence around book names and values; book HTML where marked). */
  enunciado: string;
  /** The book fragment(s) shown with the explanation. */
  citas: Cita[];
  /** The hint ladder: first the idea or formula from the book, then the set-up. Computed at run time for
   *  problems with changing values (numerico). */
  pistas: Pista[];
}

export interface Pista {
  titulo: string;
  html: string;
  /** Equation SVG of the book (path under libro/), with its size in pt. */
  ec?: { svg: string; w: number; h: number };
}

// ------------------------------------------------------------------ problems with changing values

/** How one input changes from attempt to attempt. */
export interface Variacion {
  /** Values to draw from (E12/E24 for R, C, L; typical supplies; 1-2-5-like series otherwise). */
  valores: number[];
  serie: 'E12' | 'E24' | 'alimentacion' | 'redondos' | 'ajustada';
}

export interface ItemNumerico extends ItemBase {
  tipo: 'numerico';
  formula: Formula;
  objetivo: string;
  /** Book values of the inputs (the example of the book or the exercise's statement). */
  libro: Record<string, number>;
  varia: Record<string, Variacion>;
  /** Relative tolerance of the answer. */
  tol: number;
  /**
   * From an exercise of the book: its statement with the varied quantities as «{{id}}» placeholders; `pide` = what the
   * field asks, with the same placeholders (never a book value of a quantity the variant changes); `solo` = the book's
   * exercise asks more than this one result (the variant asks only this).
   */
  ejercicio?: { label: string; num: string; html: string; pide: string; solo?: boolean };
  /**
   * The statement asks for a standard value: the answer is the value of this series nearest to the formula's result,
   * accepted exactly (variantes.ts pedidoDe / comprobarPedido).
   */
  normalizado?: 'E12';
  /** The paragraph that introduces the formula in the book (first hint and explanation). */
  intro?: Cita;
  /**
   * 1.0 (review 10e): expressions of the inputs that must be positive for a variant to be physically sensible (the
   * transistor in its active region, the regulator with headroom…); written by practica10.mjs from its AJUSTES.
   */
  condiciones?: string[];
}

// ------------------------------------------------------------------ circuits (predictions and sliders)

/** A circuit of the book that can be re-simulated: a simulable schematic of a figure or a book netlist. */
export type FuenteCircuito =
  | {
      k: 'figura';
      datos: string;
      esquema: number;
      figura: string;
      num: string;
      src: string;
      vista: [number, number, number, number];
      /** The schematic's own area when the picture holds more (another circuit, a plot). */
      recorte?: [number, number, number, number] | null;
      /**
       * QA 1.0 (challenges and fault cases): texts of the book to paint over with the plate's colour — cut by the
       * crop, notes, and readings that would give the answer away or show the healthy values (practica/encuadre.ts).
       */
      ocultar?: [number, number, number, number][];
    }
  | { k: 'netlist'; id: string; fichero: string; titulo: string };

/** What is changed: a schematic element value or a netlist parameter. */
export interface Cambio {
  /** Element id (figure) or parameter id (netlist). */
  id: string;
  /** HTML name: «R<sub>2</sub>», «la fuente de 12 V». */
  nombre: string;
  unidad: string;
  /** Book value. */
  de: number;
}

/** What is observed in the operating point. */
export interface Observable {
  k: 'nodo' | 'corriente' | 'tension';
  /** Node id (figure) or name (netlist); element id or instance name. */
  id: string;
  /** For netlists: the two nodes of a two-terminal element (tension) or its current vector. */
  nodos?: [string, string];
  vector?: string;
  /** «la tensión en V<sub>sal</sub>», «la corriente por el LED». */
  nombre: string;
  unidad: 'V' | 'A';
}

export interface ItemPrediccion extends ItemBase {
  tipo: 'prediccion';
  fuente: FuenteCircuito;
  cambio: Cambio;
  /** New value (×2 or ×½ of the book's, kept at that exact ratio). */
  a: number;
  observa: Observable;
  /** What the build-time simulation gave (the app simulates again and grades with its own result). */
  esperado: { antes: number; despues: number; respuesta: Sentido };
}

export type Sentido = 'sube' | 'baja' | 'igual';

export interface ItemDeslizador extends ItemBase {
  tipo: 'deslizador';
  fuente: FuenteCircuito;
  cambio: Cambio;
  /** Slider positions (E12 values of ×0,1…×10 of the book value). */
  valores: number[];
  observa: Observable;
  /** Target (rounded to 2 significant figures) and its relative tolerance. */
  objetivo: number;
  tol: number;
  /** Values that reached the target in the build-time simulation; the book value gives `antes`. */
  aciertan: number[];
  antes: number;
}

// ------------------------------------------------------------------ figures, lists, glossary, breadboard

export interface FiguraItem {
  label: string;
  num: string;
  src: string;
  vista: [number, number, number, number];
  datos: string;
  esquema: number;
  pie: string;
}

export interface ItemToque extends ItemBase {
  tipo: 'toque';
  figura: FiguraItem;
  pide: { k: 'elemento' | 'nodo'; id: string; nombre: string; rol?: string; simbolo?: string };
}

export interface ItemOrdenar extends ItemBase {
  tipo: 'ordenar';
  /** The book's items in the book's order (the app shuffles them deterministically). */
  pasos: string[];
}

export interface ItemParejas extends ItemBase {
  tipo: 'parejas';
  modo: 'definicion' | 'simbolo';
  /** Left: term (html) or symbol key; right: definition (first sentence) or term. */
  pares: { a: string; b: string; simbolo?: string; glosario: string }[];
}

export interface ItemProtoboard extends ItemBase {
  tipo: 'protoboard';
  figura: FiguraItem & { titulo: string; recorte?: [number, number, number, number] | null };
  /** What is taken out of the auto-placed board: one jumper wire (by index) or one part (by id). */
  quitar: { k: 'cable'; i: number } | { k: 'pieza'; id: string; nombre: string };
}

// ------------------------------------------------------------------ 1.0: challenges (web/scripts/retos10.mjs)

/** A value the reader moves in a «reto» (an element of the figure's schematic). */
export interface Mando {
  /** Element id in the schematic. */
  id: string;
  /** HTML name: «R<sub>2</sub>», «la fuente de tensión». */
  nombre: string;
  unidad: string;
  /** The book's value. */
  de: number;
  /** Where the challenge starts (the book's value ×2, ×½, ×3 or ×⅓, on the slider). */
  inicio: number;
  /** Slider positions: E96 values ×0,1…×10 of the book's (and the book's own) for R; even steps for sources. */
  valores: number[];
}

/**
 * «Reto manipulando la figura» (1.0): move one or two values of a live figure until a quantity meets the book's
 * value within a tolerance. Checked by simulating with the app's ngspice; any combination that meets it is right.
 */
export interface ItemReto extends ItemBase {
  tipo: 'reto';
  fuente: Extract<FuenteCircuito, { k: 'figura' }>;
  mandos: Mando[];
  observa: Observable;
  objetivo: number;
  tol: number;
  /** Where the target comes from: written in the book's text (the first quote), or the book's own simulation. */
  origen: 'texto' | 'simulacion';
  /** How the observed quantity moves when each knob goes up (build-time simulation, monotonic over the range). */
  efecto: Record<string, 'sube' | 'baja'>;
  /** The build-time proof that the target is reachable: these knob values (the book's) gave this reading. */
  solucion: { valores: Record<string, number>; lectura: number };
  /** The reading at the start (outside the tolerance). */
  inicioLectura: number;
  /** The development shown afterwards (book values and readings; sentences around book names and values). */
  desarrollo: string[];
}

/** What a built circuit must do (measured in its simulated operating point; any topology that does it is right). */
export type Condicion =
  /** A DC voltage source of this value feeds it (the board's supply). */
  | { k: 'fuente'; valor: number }
  /** Some node (not ground nor a source's terminal) at this voltage, within tol (relative). */
  | { k: 'nodo'; valor: number; tol: number; nombre: string }
  /** One LED (only one) with this forward current, within tol, carrying all the supply's current. */
  | { k: 'led'; corriente: number; tol: number }
  /** A Zener diode conducting in reverse with at least this current (and at most `max` when given). */
  | { k: 'zener'; min: number; max?: number }
  /**
   * The load of a Zener regulator: everything fed from the Zener's cathode node other than the Zener (the current that
   * leaves that node through it), this current within tol.
   */
  | { k: 'carga'; corriente: number; tol: number }
  /**
   * A divider as the exercise has it: exactly n resistors, one from the + to the output and n − 1 from the output to
   * the − (2.8: the lower one and the load); `arriba` = value of the upper one, `valor` = of all of them, when fixed.
   */
  | { k: 'divisor'; n: number; arriba?: number; valor?: number }
  /** Nothing more: no part straight across the supply, with both legs on one node or with a leg in the air. */
  | { k: 'sobrantes' }
  /** A resistor of this value is used. */
  | { k: 'resistencia'; valor: number }
  /** Every resistor is a value of the E12 series. */
  | { k: 'e12' }
  /** No resistor dissipates more than this (W). */
  | { k: 'potencia'; max: number }
  /** At least n resistors of this value. */
  | { k: 'resistencias'; valor: number; n: number }
  /**
   * A balanced bridge: two midpoints at the same voltage (within tol of the supply), each fed by a current-carrying
   * resistor from above and draining through one below, on two different branches (no path of current-carrying
   * resistors between them other than through the supply).
   */
  | { k: 'puente'; tol: number; valor?: number }
  /**
   * An NPN transistor in its active region with this collector current, within tol (and V(C) − V(E) = vce ± tol);
   * `divisor`: biased as in the exercise (R1 + → base, R2 base → −, RC + → collector, RE emitter → −).
   */
  | { k: 'transistor'; ic: number; tol: number; vce?: number; divisor?: boolean };

/**
 * «Reto de montar el circuito» (1.0): build on the breadboard a circuit that meets a design exercise of the book;
 * checked by simulating it and measuring what the exercise asks, never by comparing with a given layout.
 */
export interface ItemConstruye extends ItemBase {
  tipo: 'construye';
  /** The book's exercise the specification comes from (its statement, as the book writes it). */
  ejercicio: { label: string; num: string; html: string };
  /** Voltage of the board's bench supply at the start. */
  alimentacion: number;
  /** Keys of the tray cards offered (componentes/protoboard/bandeja.ts, plus «DZ51» for the Zener). */
  cartas: string[];
  condiciones: Condicion[];
  /** The build-time proof: a circuit that meets every condition (simulated) and what it measured. */
  referencia: { descripcion: string; netlist: string; lecturas: string[] };
}

/**
 * «Encuentre la avería» (1.0): a live schematic of the book with one faulty part. The reader measures with a virtual
 * multimeter (values from ngspice on the faulty netlist, `averias.ts netlistAveria`) and names the part and the fault.
 */
export interface ItemAveria extends ItemBase {
  tipo: 'averia';
  fuente: Extract<FuenteCircuito, { k: 'figura' }>;
  averia: { elemento: string; tipo: 'abierta' | 'corto' | 'alto' | 'bajo' | 'reves' | 'base-abierta' };
  /** The parts that can be named, each with the faults it can have. */
  piezas: { id: string; nombre: string; tipos: ItemAveria['averia']['tipo'][] }[];
  /** Measurement points (nodes) with their names and where they are drawn (SVG units of the figure). */
  puntos: { nodo: string; nombre: string; xy: [number, number]; masa?: boolean }[];
  /** Parts whose current can be measured (the multimeter in series). */
  ramas: { id: string; nombre: string }[];
  /** The point (against ground) whose reading reveals the fault most clearly (build-time check; the hint). */
  clave: string;
}

export type ItemPractica = ItemNumerico | ItemPrediccion | ItemDeslizador | ItemToque | ItemOrdenar | ItemParejas | ItemProtoboard | ItemReto | ItemConstruye | ItemAveria;
export type TipoItem = ItemPractica['tipo'];

/** Key ideas of a section for the end-of-lesson screen. */
export type Idea =
  | { k: 'caja'; tipo: string; html: string; ref: string }
  | { k: 'formula'; nombre: string; svg: string; w: number; h: number; ref: string; calc: string }
  | { k: 'definicion'; termino: string; html: string; glosario: string }
  | { k: 'tarjeta'; svgs: { svg: string; w: number; h: number }[]; ref: string };

export interface SeccionPractica {
  items: string[];
  ideas: Idea[];
}

export interface PracticaParte {
  version: 1;
  parte: string;
  items: ItemPractica[];
  secciones: Record<string, SeccionPractica>;
}

export interface IndicePractica {
  version: 1;
  /** Parts with a file. */
  partes: string[];
  /** Items per part (all of them: Repaso's «Practicar» shows every one). */
  porParte: Record<string, number>;
  /** Items per type, and sections with at least one item of each type. */
  items: Record<TipoItem, number>;
  secciones: Record<TipoItem | 'ideas' | 'alguno', number>;
  /** Exercises of ejercicios.json reproduced by a formula (problems with changing values in «Ejercicios»). */
  ejercicios: Record<string, string>;
  /** What could not be derived, counted by reason (for the record). */
  descartes: Record<string, number>;
}
