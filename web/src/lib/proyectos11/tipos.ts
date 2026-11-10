// 1.1 «Proyectos por etapas»: the four detailed projects of the book (printed chapters 48–51, files cap49–cap52) built
// stage by stage in the schematic editor. Each stage is a circuit of the editor (a saved circuit of «Mis circuitos»,
// made from the stage's netlist the first time it is opened) whose design values the reader chooses; «Comprobar»
// simulates the editor's own netlist with the stage's analyses and measurements (the app's ngspice) and checks each
// condition of the book's specification, with a hint per failed condition. Types only (data in etapas.ts, checker in
// comprobar.ts, progress in registro.ts).

/** A value the reader chooses: a part of the drawing (its designator) or a `.param` of the directives. */
export interface ComponenteEtapa {
  /** The part's designator in the drawing («RPU», «C1»), or the name of the `.param` («vsec»). */
  id: string;
  tipo: 'pieza' | 'param';
  /** HTML label («R<sub>PU</sub>», «V<sub>sec</sub> (eficaz)»). */
  nombre: string;
  unidad: 'Ω' | 'F' | 'H' | 'V';
  /** Standard series it must belong to (any of them), or [] for a free value (a trimmer, a voltage). */
  series: ('E12' | 'E24' | 'E96')[];
  min: number;
  max: number;
  /** What it does, one short sentence (shown under the field). */
  papel: string;
  /** The design that meets the specification: its value as text (the book's, when `delLibro`). */
  referencia: string;
  /** Whether `referencia` is the book's own value (else: a design that meets what the book asks). */
  delLibro: boolean;
}

export interface MedidaEtapa {
  /** Name of the vector the `.control` block prints («tsub»), or of a derived value (`derivadas`). */
  id: string;
  /** HTML («tiempo de subida»). */
  nombre: string;
  unidad: string;
  /** Shown as measured but not checked (an observation that helps to understand the result). */
  informativa?: boolean;
}

export interface CondicionEtapa {
  medida: string;
  min?: number;
  max?: number;
  /** The requirement in words, HTML («300 ns como máximo»). */
  texto: string;
  /** What to change when the measurement is below / above it (HTML). */
  siBaja?: string;
  siAlta?: string;
}

export interface Etapa {
  /** Stable id, stored («cap50-1»). */
  id: string;
  /** 1-based position in its project. */
  n: number;
  titulo: string;
  /** One idea, ≤ 40 words: what this stage builds (HTML). */
  objetivo: string;
  /** The book's specification for this stage, one line each (HTML). */
  especificacion: string[];
  /** Book sections that teach it (labels; the first one is «la teoría»). */
  secciones: string[];
  /** A 1.1 lesson of «Fundamentos» behind it («cap05/sec-5.6»), if any. */
  leccion?: string;
  /** What the drawing models and which values are the app's (not the book's), HTML. */
  modelo: string;
  /** The starting circuit: a netlist without analyses (the editor opens it as a drawing). */
  netlist: string;
  /** Lines of the `.control` block that measure it (analyses, `let`, `meas`, `print`, `alter`…). */
  control: string;
  componentes: ComponenteEtapa[];
  medidas: MedidaEtapa[];
  /** Values computed from the printed ones and the design values (a regulation from two analyses, I²R…). */
  derivadas?: (m: Readonly<Record<string, number>>, valores: Readonly<Record<string, number>>) => Record<string, number>;
  condiciones: CondicionEtapa[];
}

export interface Proyecto {
  /** File id of the chapter («cap50»). */
  parte: string;
  titulo: string;
  /** Short name for lists («Fuente de laboratorio»). */
  corto: string;
  /** One sentence: what is built (HTML). */
  resumen: string;
  /** KiCad board of the project (componentes/proyectos), for «Ver la placa». */
  placa?: string;
  etapas: Etapa[];
}
