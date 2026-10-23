// Types of formulas.json (written by contenido/formulas.py; see ESQUEMA.md, «Calculadoras»).

export interface VarFormula {
  id: string;
  /** Spanish name, as the book calls it in that section. */
  nombre: string;
  /** Symbol as trusted HTML (sub/sup). */
  sim: string;
  /** Unit of the value (SI, without prefix; non-prefixable units such as «%», «dB», «°C» as is). */
  unidad: string;
  /** Typical range of the book (warnings, plots, numeric solving). */
  min: number;
  max: number;
  defecto: number;
  escala: 'log' | 'lineal';
  entero?: boolean;
}

export interface EjemploFormula {
  /** The book's worked example: input values (in the variables' units)… */
  valores: Record<string, number>;
  /** …the result computed with them, and the result printed in the book. */
  resultado: number;
  libro: number;
  /** Where the example is, when it is not in the formula's own section. */
  origen?: string;
  /** What is wrong in the book's example, when something is. */
  errata?: string;
}

export interface Formula {
  id: string;
  nombre: string;
  parte: string;
  cap: string | null;
  seccion: { label: string; num: string; titulo: string };
  sub?: string;
  fuente: string;
  svg: string;
  w: number;
  h: number;
  /** «tau = R*C»: the result variable on the left. */
  ecuacion: string;
  resultado: string;
  expr: string;
  vars: VarFormula[];
  /** Solved form for each other variable: an expression, or null (numeric, bracketed). Absent: cannot be solved. */
  despejes: Record<string, string | null>;
  ejemplo?: EjemploFormula;
  nota?: string;
  claves?: string;
  /** Family of the gallery (FamiliaFormulas.id). */
  familia?: string;
  /** Illustration: a schematic template and/or a plot, with the formula's quantities in their roles. */
  figura?: FiguraFormula;
  /** «Qué significa»: the book's own explanation, with quotes checked against section `ref`. */
  explicacion?: ExplicacionFormula;
  /** Exercises and problems of the chapter that use the formula (refs.json labels). */
  ejercicios?: string[];
  /** Simulator netlists of the section («cap03/rc_filtro»). */
  /** Netlists of the simulator for the section: key and title. */
  simulador?: { k: string; t: string }[];
}

/** Role of a template → a variable id, an expression of the formula's variables, a number or «#text». */
export type Huecos = Record<string, string>;

export interface FiguraFormula {
  esquema?: { p: string; s: Huecos };
  grafico?: { p: string; s: Huecos };
}

export interface ExplicacionFormula {
  ref: string;
  ref_num: string;
  partes: { k: 'significa' | 'aplica' | 'valores' | 'error'; html: string }[];
}

export interface FamiliaFormulas {
  id: string;
  nombre: string;
  resumen: string;
  miniatura: { tipo: 'esq' | 'graf'; p: string };
  total: number;
}

export interface TarjetaFormulas {
  parte: string;
  indice: number;
  seccion: string;
  formulas: string[];
}

export interface CatalogoFormulas {
  version: number;
  total: number;
  con_ejemplo: number;
  formulas: Formula[];
  tarjetas: TarjetaFormulas[];
  familias?: FamiliaFormulas[];
  cobertura?: Record<string, number>;
}
