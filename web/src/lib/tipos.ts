// Types of the generated content (see ESQUEMA.md, the contract with the pipeline).

/** Trusted HTML fragment produced by the pipeline (strong em sub sup code br a span img). */
export type Html = string;

export interface Seccion {
  num: string | null;
  label: string;
  titulo: string;
}

export type TipoParte = 'capitulo' | 'apendice' | 'glosario' | 'anexo';

export interface InfoParte {
  tipo: TipoParte | string;
  num?: string | null;
  label?: string | null;
  titulo: string;
  color?: string | null;
  tomo?: string | null;
  secciones?: Seccion[];
}

export interface Tomo {
  id: string;
  titulo: string;
  partes: string[];
}

export interface BloqueColor {
  color: string;
  nombre: string;
}

export interface Indice {
  edicion: string;
  tomos: Tomo[];
  partes: Record<string, InfoParte>;
  bloques?: BloqueColor[];
}

export interface Ref {
  num: string;
  parte: string;
  tipo: string;
  /** Not in the schema today; honoured if the pipeline ever adds the canonical label. */
  label?: string;
}

export type Refs = Record<string, Ref>;

interface ConLabel {
  label?: string | null;
}

export interface BH2 extends ConLabel { t: 'h2'; num?: string | null; html: Html }
export interface BH3 extends ConLabel { t: 'h3'; num?: string | null; html: Html }
export interface BH4 extends ConLabel { t: 'h4'; html: Html }
export interface BP extends ConLabel { t: 'p'; html: Html }
export interface BLista extends ConLabel {
  t: 'lista';
  ordenada: boolean;
  items: Html[];
  /** First number of an ordered list that continues an earlier one. */
  inicio?: number | null;
  /** Nesting level (0 or absent: top level). */
  nivel?: number | null;
}
export type TipoCaja = 'nota' | 'importante' | 'precaucion' | 'ejemplo' | 'comprobacion';
export interface BCaja extends ConLabel { t: 'caja'; tipo: TipoCaja | string; bloques: Bloque[] }
export interface BDeduccion extends ConLabel { t: 'deduccion'; titulo: Html; bloques: Bloque[] }
export interface BTarjeta extends ConLabel { t: 'tarjeta'; bloques: Bloque[] }
export interface BEc extends ConLabel {
  t: 'ec';
  svg: string;
  /** Width and height in typographic points, at the book's 10.5 pt text size. */
  w: number;
  h: number;
  fuente: string;
  etiqueta?: Html | null;
}
export interface BFigura extends ConLabel {
  t: 'figura';
  src: string;
  num?: string | null;
  ancho?: number | null;
  pie?: Html | null;
  credito?: Html | null;
}
export interface BTabla extends ConLabel {
  t: 'tabla';
  num?: string | null;
  pie?: Html | null;
  cols: number;
  align?: string[];
  cabecera?: boolean;
  filas: Html[][];
}
export interface BCodigo extends ConLabel { t: 'codigo'; lenguaje?: string; texto: string }
export interface BCentrado extends ConLabel { t: 'centrado'; html: Html }
export interface Ejercicio {
  label?: string | null;
  num: string;
  bloques: Bloque[];
  solucion?: Bloque[] | null;
}
export interface BEjercicios extends ConLabel { t: 'ejercicios'; items: Ejercicio[] }
export interface EntradaGlosario {
  /** DOM id given by the pipeline (e.g. «glos-1-wire»); derived from the term when absent. */
  id?: string;
  termino: Html;
  html: Html;
  ver: string[];
}
export interface BGlosario extends ConLabel { t: 'glosario'; entradas: EntradaGlosario[] }

export type Bloque =
  | BH2 | BH3 | BH4 | BP | BLista | BCaja | BDeduccion | BTarjeta | BEc
  | BFigura | BTabla | BCodigo | BCentrado | BEjercicios | BGlosario;

export interface Parte {
  id: string;
  titulo: string;
  num?: string | null;
  label?: string | null;
  color?: string | null;
  bloques: Bloque[];
}

export interface DocBusqueda {
  id: string;
  parte: string;
  titulo: string;
  texto: string;
}
