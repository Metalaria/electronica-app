// Types of web/public/libro/datos/NAME.json («Datos de figuras» in ESQUEMA.md): the data behind the book's
// plots and schematics, used by the interaction layer drawn over the figure SVG.

/** [x, y, w, h] in SVG user units (the figure's viewBox). */
export type Caja = [number, number, number, number];
export type Punto = [number, number];

export interface Afin {
  sx: number;
  tx: number;
  sy: number;
  ty: number;
}

export interface Marca {
  v: number;
  t: string;
  menor?: boolean;
}

export interface EjeDatos {
  lim: [number, number];
  escala: 'linear' | 'log' | 'symlog' | string;
  visible?: boolean;
  lado?: string;
  etiqueta?: string | null;
  etiqueta_html?: string | null;
  magnitud?: string | null;
  unidad?: string | null;
  factor_si?: number | null;
  unidad_si?: string | null;
  ticks?: Marca[];
  formato?: { clase?: string; desplazamiento?: string; unidad?: string; decimales?: number };
  categorias?: Record<string, number>;
  linthresh?: number;
}

interface SerieBase {
  etiqueta?: string | null;
  etiqueta_html?: string | null;
  color?: string | null;
  alfa?: number | null;
  estilo?: string | null;
  grosor?: number | null;
  marcador?: string | null;
  z?: number | null;
}

export type Num = number | null;

export interface SerieLinea extends SerieBase {
  tipo: 'linea' | 'escalon';
  x: Num[];
  y: Num[];
  n?: number;
  trazado?: string;
  submuestreo?: string;
  coordenadas?: string;
}
export interface SerieDispersion extends SerieBase {
  tipo: 'dispersion' | 'tallos' | 'errores';
  x: Num[];
  y: Num[];
  n?: number;
}
export interface SerieBarras extends SerieBase {
  tipo: 'barras';
  orientacion: 'v' | 'h';
  barras: { x: number; y: number; ancho: number; alto: number; valor?: number | null; color?: string | null }[];
}
export interface SerieHline extends SerieBase {
  tipo: 'hline';
  y: number;
  ejes_x?: [number, number];
}
export interface SerieVline extends SerieBase {
  tipo: 'vline';
  x: number;
  ejes_y?: [number, number];
}
export interface SerieOtra extends SerieBase {
  tipo: 'relleno' | 'region' | 'franja_x' | 'franja_y' | 'imagen' | 'vector' | 'segmentos';
}
export type Serie = SerieLinea | SerieDispersion | SerieBarras | SerieHline | SerieVline | SerieOtra;

export interface Ejes {
  id: number;
  clase: 'datos' | 'cualitativa' | 'esquema' | 'lienzo';
  proyeccion: string;
  pos_fig: [number, number, number, number];
  pos_svg: Caja;
  x?: EjeDatos;
  y?: EjeDatos;
  titulo?: string | null;
  series?: Serie[];
  leyenda?: { etiqueta: string; html?: string; serie: number }[];
  gemelo_de?: number;
  comparte?: 'x' | 'y';
  padre?: number;
}

// ------------------------------------------------------------------ schematics

export interface Elemento {
  id: string;
  clase: string;
  rol: string;
  designador?: string | null;
  etiquetas?: string[];
  etiquetas_html?: string[];
  valor?: number | null;
  unidad?: string | null;
  valor_texto?: string | null;
  origen_valor?: string | null;
  valores?: Record<string, number> | null;
  modificador?: string | null;
  referencia?: string | null;
  anclas: Record<string, Punto>;
  caja?: [number, number, number, number];
  terminales?: Record<string, string>;
  puntos_terminal?: Record<string, string>;
  polaridad?: Record<string, string>;
  invertido?: boolean;
  discontinuo?: boolean;
  color?: string | null;
  estado?: string | null;
  carga_corriente?: number | null;
}

export interface Nodo {
  id: string;
  tierra: boolean;
  puntos: string[];
  terminales: string[];
  etiquetas?: string[];
}

export interface Tramo {
  id: string;
  elemento: string | null;
  origen: string;
  nodo: string;
  de: string;
  a: string;
  puntos: Punto[];
  longitud: number | null;
}

export interface ResultadoElemento<T> {
  terminales?: Record<string, T>;
  corriente?: T;
  tension?: T;
  potencia?: number | null;
  nota?: string;
}

export interface ResultadoOp {
  nodos: Record<string, Num>;
  tramos: Record<string, Num>;
  elementos: Record<string, ResultadoElemento<Num>>;
}

export interface ResultadoTran {
  t: number[];
  periodo: number;
  nodos: Record<string, Num[] | null>;
  tramos: Record<string, Num[] | null>;
  elementos: Record<string, ResultadoElemento<Num[] | null>>;
}

export interface Simulacion {
  simulable: boolean;
  motivos: string[];
  advertencias?: string[];
  supuestos?: string[];
  masa?: string;
  modelos?: Record<string, string>;
  excluidos?: string[];
  netlist?: string;
  op?: ResultadoOp;
  tran?: ResultadoTran;
  tran_error?: string;
}

export interface Esquema {
  eje: number;
  tolerancia: number;
  dibujo_a_svg: Afin;
  puntos: { id: string; xy: Punto; nodo: string }[];
  elementos: Elemento[];
  nodos: Nodo[];
  tramos: Tramo[];
  simulacion?: Simulacion;
}

export interface DatosFigura {
  version: number;
  nombre: string;
  tipo: 'grafica' | 'esquema';
  contiene?: string[];
  lienzo: { svg: { ancho: number; alto: number; fig_a_svg: Afin } };
  ejes: Ejes[];
  esquemas?: Esquema[];
}

// ------------------------------------------------------------------ shared drawing interface
//
// What the live-schematic overlay needs, whatever drew the schematic: a book figure (datos/NAME.json + its
// fig/NAME.svg) or the automatic schematic generator (componentes/esquema-auto/). Both produce the same
// topology format («Datos de figuras», `esquemas[]`).

/**
 * A drawing the live layer can animate. `svg` is the picture (a URL, or inline markup starting with «<svg»);
 * `vista` is its viewBox [x, y, w, h], the space of every SVG coordinate; each `esquemas[i].dibujo_a_svg`
 * maps its drawing units into it. `ejes` (optional) are the figure's plot Axes; `esquemas[i].eje` may be -1
 * when there is no Axes.
 */
export interface DibujoVivo {
  origen: 'libro' | 'auto';
  svg: string;
  vista: Caja;
  esquemas: Esquema[];
  ejes?: Ejes[];
  /** Book figure label («fig-22.3») when origen is 'libro'. */
  figura?: string;
}

/**
 * How a schematic's topology maps onto a SPICE netlist, so that a netlist's own simulation (the simulator
 * page) can drive the overlay. Names are lower case as ngspice prints them; ground is «0».
 */
export interface Correspondencia {
  /** Topology node id («N3») → netlist node name («out», «0»). */
  nodos: Record<string, string>;
  /** Topology element id («E5») → netlist element (instance) name and, per terminal, its pin index (0-based)
   *  on the netlist line («start» → 0, «end» → 1; BJT collector/base/emitter → 0/1/2…). */
  elementos: Record<string, { nombre: string; pines: Record<string, number> }>;
}

/** A drawing with its netlist mapping (what the automatic generator returns). */
export interface DibujoConNetlist extends DibujoVivo {
  correspondencia: Correspondencia[];
}
