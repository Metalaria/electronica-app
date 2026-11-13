// 1.2 widgets «figura» and «logica» and the step types that use them (contenido/lecciones11/GUIA.md §11): the data
// the generator (lib/leccion12/digital/generar-digital.ts) writes into a lesson, and the reader's state of them while
// the card is on show. Types only.

import type { Mando, Texto } from '../../leccion11/tipos';
import type { CircuitoLogico, EstadoLogico, FalloLogico, Lectura, Nivel, Punto, TipoPuerta } from './logica';

// ------------------------------------------------------------------ figure with tappable zones

/** Where the picture comes from: a figure or photo of the book (web/public/libro/…) or a console photo (web/public/consolas/…). */
export interface FuenteFigura {
  /** (motor12e: «codigo», a listing drawn by the app: `src` is empty and `codigo` has its lines) */
  origen: 'libro' | 'consola' | 'codigo';
  /** Path under web/public/libro (origen libro: «fig/13.5.svg», «img/x.jpg») or under web/public («consolas/snes/foto-cara-a.jpg»). */
  src: string;
  /** The picture's own coordinates: an SVG figure's viewBox [x, y, w, h], a photo's pixels [0, 0, w, h]. */
  vista: [number, number, number, number];
  /** A book SVG figure (drawn on the figure plate and recoloured in the dark theme like the book's). */
  vectorial: boolean;
  /** «Figura 13.5: …» or the photo's title, for screen readers. */
  alt: string;
  /** The figure's printed number, if a book figure. */
  num?: string;
  /** Credit and licence of a photo (shown under it). */
  credito?: string;
  /**
   * 1.2 (motor12e): a read-only code listing (a book «codigo» block or the author's text), drawn in monospace; `vista`
   * is then [0, 0, CODIGO_COL·columns + 2·CODIGO_MARGEN, CODIGO_LINEA·lines + 2·CODIGO_MARGEN] and a zone covers whole lines.
   */
  codigo?: { lenguaje: string; lineas: string[]; resaltar: number[] };
}

/** A code listing's units (motor12e): one character is CODIGO_COL wide, one line CODIGO_LINEA high. */
export const CODIGO_COL = 6;
export const CODIGO_LINEA = 15;
export const CODIGO_MARGEN = 6;

export interface ZonaFigura {
  id: string;
  /** Name in the list of zones (keyboard, screen reader): neutral in a question («Unión de arriba a la izquierda»). */
  rotulo: Texto;
  /** What a tap shows on an explore card. */
  texto?: Texto;
  /** Rectangles [x, y, w, h] in the picture's coordinates (a console hotspot may have several boxes)… */
  rects: [number, number, number, number][];
  /** …or a polygon. */
  poligono?: [number, number][];
  /** The explorer's hotspot it reuses (console photos). */
  hotspot?: string;
  /** The lines of a code listing it covers, first and last (1-based; motor12e). */
  lineas?: [number, number];
}

export interface WidgetFigura {
  tipo: 'figura';
  fuente: FuenteFigura;
  zonas: ZonaFigura[];
  /** (No controls: the zones are what is touched.) */
  mandos: Mando[];
  ocultar: boolean;
}

// ------------------------------------------------------------------ logic circuit

export interface CronogramaLogica {
  /** Clock cycles shown (two slots each: clock low, then high). */
  ciclos: number;
  /** The inputs' levels per cycle (inputs left out keep their starting level). */
  estimulo: Record<string, Nivel[]>;
  /** Rows of the timing diagram, top to bottom (inputs, the clock, any signal or LED id). */
  senales: string[];
  /** 1.2 (motor12e): a name per cycle instead of 1…N on its axis (a UART frame: reposo, inicio, D0…, parada). */
  etiquetas?: string[];
}

export interface WidgetLogica {
  tipo: 'logica';
  circuito: CircuitoLogico;
  /** A timing diagram under the circuit: the reader moves a cursor along it and the circuit shows that moment. */
  cronograma?: CronogramaLogica;
  /** The circuit's truth table under it, with the row of the current inputs marked (combinational circuits). */
  tabla?: boolean;
  /** false: only the timing diagram (the circuit was drawn on an earlier card). */
  dibujo?: false;
  mandos: Mando[];
  /** The LEDs (and the levels on the wires) show «?» until the card is answered; the switches cannot be moved. */
  ocultar: boolean;
}

/** The reader's state of a card's figure or logic widget (in memory only; EstadoTarjeta.widget12). */
export interface EstadoWidget12 {
  /** Figure: the zone last touched (an explore card shows its text). */
  zona: string | null;
  /** Logic: the levels of the switches. */
  niveles: Record<string, Nivel>;
  /** Logic, sequential circuits: the simulation's state (flip-flops, counters), null until the first action. */
  logica: EstadoLogico | null;
  /** Clock pulses given. */
  pulsos: number;
  /** Timing diagram: the slot the cursor is on. */
  tramo: number;
}

// ------------------------------------------------------------------ step types

/** «Toque»: touch the zone(s) of the figure that answer (the defect, the part). */
export interface Tocar {
  tipo: 'tocar';
  /** The right zones. */
  bien: string[];
  /** Every right zone must be touched (several at once); else one touch answers. */
  todas: boolean;
  /** Why each other zone is not it (every zone that is not right has one). */
  porque: Record<string, Texto>;
}

/** «Tabla de verdad»: fill the outputs' column of every row; checked against the circuit. */
export interface TablaPaso {
  tipo: 'tabla';
  entradas: string[];
  /** The columns the reader fills (LED ids or signals), with their labels. */
  salidas: { id: string; rotulo: Texto }[];
  /** Right values, row by row (binary order of the inputs), one per column. */
  esperado: Nivel[][];
}

export type TipoFalloLogico = 'atascada-0' | 'atascada-1' | 'sin-conexion';

export interface FalloLogicoPaso {
  id: string;
  /** The suspect it is (a piece of the circuit). */
  pieza: string;
  tipo: TipoFalloLogico;
  fallo: FalloLogico;
  texto: Texto;
}

export interface PuntoSonda {
  id: string;
  rotulo: Texto;
  punto: Punto;
}

/** «Busque la avería» on a logic circuit: set the switches, probe points with the logic probe, name the piece. */
export interface AveriaLogica {
  tipo: 'averia-logica';
  fallos: FalloLogicoPaso[];
  sospechosos: { id: string; rotulo: Texto }[];
  /** Points the probe can touch (every wire and every input pin by default). */
  puntos: PuntoSonda[];
  /** Probe readings allowed (null: as many as wanted). */
  pasos: number | null;
  eleccion: 'fija' | 'azar';
  preguntarTipo: boolean;
}

/** «Diseñe» a combinational function with gates: checked against its truth table and the fewest gates. */
export interface DisenoLogico {
  tipo: 'diseno-logico';
  /** The LED the design drives. */
  salida: string;
  /** Its right column, row by row (binary order of the inputs). */
  objetivo: Nivel[];
  permitidas: TipoPuerta[];
  /** The fewest gates that do it (checked by the generator). */
  minimo: number;
  /** Right only with `minimo` gates; otherwise a working design passes and is told that fewer will do. */
  exigirMinimo: boolean;
  /** Gates the reader may place. */
  maxPuertas: number;
}

/** «Dibuje» in digital mode: the level of one signal in every slot of the timing diagram (snapped to clock edges). */
export interface DibujarDigital {
  tipo: 'dibujar-digital';
  senal: string;
  rotulo: Texto;
  /** The right levels, slot by slot. */
  esperado: Nivel[];
}

export type ActividadDigital = Tocar | TablaPaso | AveriaLogica | DisenoLogico | DibujarDigital;

export interface EstadoTocar {
  tipo: 'tocar';
  elegidas: string[];
  /** Zones touched and wrong (marked, cannot be chosen again). */
  descartadas: string[];
}

export interface EstadoTabla {
  tipo: 'tabla';
  celdas: (Nivel | null)[][];
  /** Rows marked wrong by the last check. */
  mal: number[];
}

export interface MedidaLogica {
  /** The switches when it was taken. */
  niveles: Record<string, Nivel>;
  punto: string;
  lectura: Lectura;
}

export interface EstadoAveriaLogica {
  tipo: 'averia-logica';
  fallo: number;
  ronda: number;
  medidas: MedidaLogica[];
  sospechoso: string | null;
  tipoElegido: string | null;
  descartados: string[];
}

export interface PuertaDiseno {
  tipo: TipoPuerta;
  entradas: string[];
}

export interface EstadoDisenoLogico {
  tipo: 'diseno-logico';
  puertas: PuertaDiseno[];
  /** The signal the LED shows (an input or «p1», «p2»…), null while not connected. */
  salida: string | null;
}

export interface EstadoDibujarDigital {
  tipo: 'dibujar-digital';
  niveles: (Nivel | null)[];
  mal: number[];
}

export type EstadoActividadDigital = EstadoTocar | EstadoTabla | EstadoAveriaLogica | EstadoDisenoLogico | EstadoDibujarDigital;
