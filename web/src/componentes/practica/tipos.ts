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
  serie: 'E12' | 'E24' | 'alimentacion' | 'redondos';
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
  /** From an exercise of the book: its statement with the varied quantities as «{{id}}» placeholders. */
  ejercicio?: { label: string; num: string; html: string; pide: string };
  /** The paragraph that introduces the formula in the book (first hint and explanation). */
  intro?: Cita;
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

export type ItemPractica = ItemNumerico | ItemPrediccion | ItemDeslizador | ItemToque | ItemOrdenar | ItemParejas | ItemProtoboard;
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
