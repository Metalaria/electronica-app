// Document model of the schematic editor (plain data: stored as JSON, kept in the undo history).
// Coordinates are drawing units of the automatic schematics (esquema-auto: 24 SVG px per unit at the book's
// scale), y DOWN, pins on the integer grid.

/** What the netlist does with an imported line that is not one of the palette's kinds. */
export interface LineaImportada {
  /** Element letter (upper case): R C L V I D Q M J X E G F H B S W T K… */
  letra: string;
  /** Node tokens of the original line, in order (lower case; ground «0»). */
  nodos: string[];
  /** Drawn pin → index of its node on the line. */
  pines: Record<string, number>;
  /** Everything after the nodes, verbatim (value, model, parameters). */
  resto: string;
  /**
   * The whole line with «{k}» where its k-th node goes, for lines whose nodes are not simply listed after the
   * name (XSPICE «A» devices: «A1 [{0} {1}] {2} nand8»). The breadboard reads them this way.
   */
  plantilla?: string;
}

/** Symbol of an imported part (what esquema-auto's simbolos.ts needs to draw it). */
export interface FormaImportada {
  simbolo: string;
  pines: { nombre: string; rotulo?: string }[];
  titulo?: string;
  /** Transformer: the coil keys, primary first. */
  bobinas?: string[];
  /** Diode bridge: its diodes and the corners of anode and cathode. */
  diodos?: { nombre: string; anodo: 'a' | 'b' | 'n'; catodo: 'a' | 'b' | 'p' }[];
}

export interface Componente {
  id: string;
  /** Palette kind (catalogo.ts), or 'GEN' for an imported part kept as its SPICE line. */
  tipo: string;
  /** Designator («R1»). */
  nombre: string;
  x: number;
  y: number;
  /** Orientation 0–7 (esquema-auto `girar`: bit 2 mirrors, then quarter turns clockwise). */
  o: number;
  /** Symbol variant (op-amp with + on top = 1). */
  v?: number;
  /** Editable fields, as typed (Spanish number format: «4,7k», «100n»). */
  campos: Record<string, string>;
  /** Imported parts: the SPICE line's parts that the drawing does not hold. */
  spice?: LineaImportada;
  /** Imported parts of kind GEN: their symbol. */
  forma?: FormaImportada;
  /** Several lines for one symbol (transformer coils and couplings, bridge diodes), imported verbatim. */
  lineas?: { nombre: string; letra: string; nodos: string[]; pines: Record<string, number>; resto: string }[];
}

export interface Cable {
  id: string;
  /** Straight segment [x0, y0, x1, y1]. */
  p: [number, number, number, number];
  /** Net name to keep when nothing else names the net (imported netlists keep their node names). */
  red?: string;
}

export type TipoAnalisis = 'op' | 'tran' | 'ac' | 'dc';

export interface Analisis {
  op: boolean;
  tran: { activo: boolean; paso: string; fin: string; inicio: string; uic: boolean };
  ac: { activo: boolean; tipo: 'dec' | 'oct' | 'lin'; puntos: string; fini: string; ffin: string };
  dc: { activo: boolean; fuente: string; ini: string; fin: string; paso: string };
}

export interface DocumentoEsquema {
  version: 1;
  titulo: string;
  componentes: Componente[];
  cables: Cable[];
  analisis: Analisis;
  /** Extra netlist text, verbatim: .model, .subckt, .param, .options, .meas, .control… */
  directivas: string;
  /** Imported from a book netlist (its id) or from a netlist text. */
  origen?: { tipo: 'libro' | 'texto'; id?: string };
}

export function analisisPorDefecto(): Analisis {
  return {
    op: true,
    tran: { activo: false, paso: '10µ', fin: '5m', inicio: '0', uic: false },
    ac: { activo: false, tipo: 'dec', puntos: '50', fini: '10', ffin: '1M' },
    dc: { activo: false, fuente: '', ini: '0', fin: '10', paso: '0,1' },
  };
}

export function documentoVacio(titulo = 'Circuito nuevo'): DocumentoEsquema {
  return { version: 1, titulo, componentes: [], cables: [], analisis: analisisPorDefecto(), directivas: '' };
}

/** A circuit saved on the device (store key «editor-circuitos», see circuitos.svelte.ts). */
export interface CircuitoGuardado {
  id: string;
  nombre: string;
  creado: number;
  actualizado: number;
  /** Soft delete (ms): kept as a tombstone so a sync never brings it back. */
  borrado?: number;
  doc: DocumentoEsquema;
}
