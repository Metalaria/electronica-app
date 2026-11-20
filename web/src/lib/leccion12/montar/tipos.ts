// 1.3 (motor13b) «Monte este circuito en la protoboard» inside a lesson (contenido/lecciones11/GUIA.md §13.14): a card
// `tipo: montar` whose circuit widget is the reference schematic; the reader builds it on the breadboard (the bench of
// componentes/protoboard/, with a tray of the schematic's own parts) and «Comprobar» checks the board — topologically
// (every node of the schematic one net of the board, no two joined, polarised parts the right way round, every leg in
// a hole) and then electrically (the board's operating point on the app's ngspice, node by node against the
// schematic's). The data the generator (generar-montar.ts) writes and the reader's state. Types only.

import type { Texto } from '../../leccion11/tipos';
import type { DocumentoProtoboard } from '../../../componentes/protoboard/tipos';

export interface Montar {
  tipo: 'montar';
  /** guiada: the guide of «Monta este circuito» (holes lit, step by step); libre: only the tray and the schematic. */
  ayuda: 'guiada' | 'libre';
  /**
   * The automatic placement of the schematic (componentes/protoboard/colocacion.ts), checked clean: the solution the
   * ladder loads and the plan of the guide. Its `original` is the schematic node of every pin («pieceId.pin» → node).
   */
  objetivo: DocumentoProtoboard;
  /** Neutral name of every schematic node of the board (the instrument's names; «Masa»): node → name. */
  redes: Record<string, string>;
  /** The schematic's netlist for its operating point (0 V meters folded in), with the card's values: the reference. */
  netlist: string;
  /** Optional: what the multimeter reads on the finished board, said with the verdict (checked with ngspice). */
  medir?: { entre: [string, string]; valor: string; unidad: string; tol: number; rotulo: Texto };
  /** The author's explanation of a node left split or joined to another, by node. */
  porque: Record<string, Texto>;
}

/** One thing wrong with the board, first the most basic (a part missing, then a leg out, then the nets). */
export interface ProblemaMontar {
  tipo: 'falta' | 'suelta' | 'doble' | 'reves' | 'partida' | 'unidas' | 'solapa' | 'tension';
  /** Spanish, neutral (the instrument's names of the nodes, the parts by their designator). */
  texto: string;
  /** The schematic node it concerns (for the author's `porque`). */
  red?: string;
  /** The board piece it concerns (the bench selects it). */
  pieza?: string;
}

/** What the card's bench last concluded about the board (componentes/leccion12/Montar.svelte keeps it up to date). */
export interface DiagnosticoMontar {
  /** Board version it belongs to. */
  version: number;
  /** Nothing put on the board yet (beyond the supply the card starts with). */
  vacia: boolean;
  problemas: ProblemaMontar[];
  /**
   * The electrical check (only once the topology is clean): «pendiente» while the app's ngspice runs, «si» with the
   * board's node voltages, «fallo» when the simulator could not run here (the topology then decides).
   */
  simulado: 'no' | 'pendiente' | 'si' | 'fallo';
  /** Board and schematic voltage of every node (simulado «si»). */
  tensiones?: Record<string, { placa: number; esquema: number }>;
  /** The reading of `medir` on the board (simulado «si»). */
  lectura?: number;
}

/** The reader's state of a «montar» card (in memory only): the board as it is, and its diagnosis. */
export interface EstadoMontar {
  tipo: 'montar';
  /** The board (null until the bench starts it from the card's supply). */
  doc: DocumentoProtoboard | null;
  diagnostico: DiagnosticoMontar | null;
  /** The ladder's solution was loaded (the automatic placement). */
  solucion?: boolean;
}
