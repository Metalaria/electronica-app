// Document model of the virtual breadboard (plain data: stored as JSON, kept in the undo history).
// Geometry in placa.ts (one pitch = 1, y down, holes on integer coordinates).

import type { Analisis, Componente } from '../editor/tipos.ts';
import type { Atadura } from './logica.ts';
import type { Pt } from './placa.ts';

export type { Pt };

/**
 * A part on the board (or a piece of equipment off it). Its electrical identity is an editor part
 * (`comp`: kind, designator, fields, imported SPICE line), so the editor's netlist writer, palette and
 * properties panel work on it unchanged; where it sits is the position of each of its legs.
 */
export interface Pieza {
  id: string;
  comp: Componente;
  /** Package (encapsulados.ts): axial, led, to92, dip, modulo, alimentacion… */
  enc: string;
  /** Position of every leg (or, for equipment off the board, of every terminal). */
  pos: Pt[];
  /** Electrical pin of each leg (editor pin name), null for a leg connected to nothing inside (NC). */
  patas: (string | null)[];
  /** Polarised parts whose polarity is only physical (electrolytic capacitor): index of the + leg. */
  polo?: number;
  /**
   * A 74HC logic chip (logica.ts): `comp` is the chip itself (kind CHIP, its part number in campos.modelo,
   * not in the netlist) and the gates or flip-flops inside are editor parts of their own, written to the
   * netlist as before. Its legs (`patas`) then say «gateId|pin».
   */
  chip?: ChipPieza;
}

export interface ChipPieza {
  /** Parts written to the netlist that the chip holds (a T flip-flop belongs to its 74HC74, not to its XOR). */
  comps: Componente[];
  /** Role of each leg: vcc, gnd, in, out, nc. */
  roles: string[];
  /**
   * Legs the auto-placement tied with a wire, not in the netlist: supply and spare inputs to a rail, a leg to
   * another leg's net, and the two board-only nodes of a T flip-flop (logica.ts `Atadura`).
   */
  ataduras: Record<number, Atadura>;
}

/** «pieceId.pin» of a leg's pin (a chip leg names its gate: «gateId|pin» → «gateId.pin»). */
export function clavePin(p: Pieza, pin: string): string {
  const i = pin.indexOf('|');
  return i >= 0 ? `${pin.slice(0, i)}.${pin.slice(i + 1)}` : `${p.id}.${pin}`;
}

/** The editor parts of a piece that go to the netlist. */
export function compsDe(p: Pieza): Componente[] {
  return p.chip ? p.chip.comps : [p.comp];
}

/** A jumper wire (or an equipment lead) between two points: holes, or terminals of equipment. */
export interface CableProto {
  id: string;
  a: Pt;
  b: Pt;
  /** Insulation colour (CSS colour of the palette in colores.ts). */
  color: string;
}

export type OrigenProtoboard =
  | { tipo: 'libro'; id: string }
  | { tipo: 'figura'; id: string }
  | { tipo: 'texto' }
  | { tipo: 'editor' }
  | { tipo: 'propio' };

export interface DocumentoProtoboard {
  version: 1;
  titulo: string;
  /** Boards stacked downwards and columns per board (30 or 63). */
  placas: number;
  columnas: number;
  piezas: Pieza[];
  cables: CableProto[];
  analisis: Analisis;
  /** Extra netlist text, verbatim (.model, .subckt, .param, .meas, .control…). */
  directivas: string;
  /**
   * The schematic the board was made from: the net of every pin («pieceId.pin» → net name). It names the
   * nets of the board (so the directives' v(out) still work) and tells what was changed.
   */
  original?: Record<string, string>;
  /** Book labels of the circuit (the live schematic shows the book's figure while the circuit matches it). */
  refs?: string[];
  origen?: OrigenProtoboard;
}

/** A circuit saved on the device (store key «protoboard-circuitos», see circuitos.svelte.ts). */
export interface MontajeGuardado {
  id: string;
  nombre: string;
  creado: number;
  actualizado: number;
  /** Soft delete (ms): kept as a tombstone so a sync never brings it back. */
  borrado?: number;
  doc: DocumentoProtoboard;
}

/**
 * The circuit behind a schematic, as the auto-placement takes it: editor parts (no connection symbols),
 * the net of every pin, the directives and analyses, and where each part was on the schematic (the order
 * left to right is the board's order).
 */
export interface CircuitoFuente {
  titulo: string;
  componentes: Componente[];
  /** «compId.pin» → net name (ground «0»). */
  redes: Record<string, string>;
  directivas: string;
  analisis: Analisis;
  /** Schematic position of each part (any units, y down). */
  posiciones: Record<string, Pt>;
  refs?: string[];
  origen: OrigenProtoboard;
}
