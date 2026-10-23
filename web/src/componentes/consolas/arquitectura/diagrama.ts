// Block diagram description shared by both machines: blocks, wires and how each one lights up from the
// scenario's signals.

import type { Escenario, Nivel } from './modelo';
import type { IdMaquina } from '../datos';

export interface Actividad {
  /** Signal id of the scenario. */
  pista: string;
  /** For a bit: the active level (default 0, active low). Buses are active when driven (not null). */
  nivel?: Nivel;
}

export interface Bloque {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  titulo: string;
  sub: string;
  /** Hotspot of the photo that shows this block. */
  foto?: string;
  /** Schematic references (to jump to the schematic). */
  esquema?: string[];
  actividad?: Actividad[];
  /** Explanation for the side panel. */
  info: string;
  /** Cartridge or off-board part: drawn dashed. */
  externo?: boolean;
}

export interface Conexion {
  id: string;
  puntos: [number, number][];
  /** Width in bits (1 = single signal). */
  bits: number;
  etiqueta: string;
  /** Where the label goes (defaults to the middle of the longest segment). */
  pos?: [number, number];
  /** Activity source; for buses the current value is shown next to the label. */
  pista?: string;
  nivel?: Nivel;
  /** Kind of line: colour. */
  clase: 'bus' | 'dato' | 'control' | 'seleccion' | 'reloj' | 'interrupcion';
  /** Net to show in the schematic. */
  red?: string;
  /** Show the bus value next to the label. */
  valor?: boolean;
}

export interface Diagrama {
  ancho: number;
  alto: number;
  bloques: Bloque[];
  conexiones: Conexion[];
}

export interface Decodificacion {
  direccion: number;
  escritura: boolean;
  /** Region of the memory map. */
  zona: string;
  /** Chip select that goes low (net name), or null. */
  seleccion: string | null;
  /** Block that answers. */
  bloque: string | null;
  /** Canonical address when the region is mirrored. */
  espejo?: string;
  /** Explanation in Spanish. */
  texto: string;
  /** Truth-table style rows: label, value, active. */
  tabla: { etiqueta: string; valor: string; activa: boolean }[];
}

export interface Maquina {
  id: IdMaquina;
  diagrama: Diagrama;
  /** Second diagram drawn instead of the board one (Game Boy: inside the SoC), lit by the same scenarios. */
  interior?: { titulo: string; nota: string; diagrama: Diagrama };
  /** Address shown in the decoder when the tab opens (hex digits). */
  dirInicial?: string;
  /** Short note under the decoder (bank registers, mapper…). */
  notaDecodificador?: string;
  escenarios: { id: string; titulo: string; crear: (op: Opciones) => Escenario }[];
  decodificar: (dir: number, escritura: boolean, espacio?: string) => Decodificacion;
  /**
   * Machine-wide variants (Mega Drive: PAL / NTSC clocks); the first is the default. Every scenario gets the chosen
   * id as `op.norma`, and `diagramaDe` redraws the board diagram with its figures.
   */
  variantes?: { id: string; titulo: string; nota: string }[];
  diagramaDe?: (variante: string) => Diagrama;
  /** Address digits (4 for the 6502, 6 for the 68000). */
  digitos: number;
  /** Address spaces the decoder offers (Z80 memory / I/O ports, 68000 / Z80…); the first is the default. */
  espacios?: { id: string; titulo: string; digitos: number }[];
  ejemplos: { dir: number; escritura: boolean; texto: string; espacio?: string }[];
  /** Options shown by some scenarios. */
  opciones: OpcionDef[];
}

export interface OpcionDef {
  id: string;
  titulo: string;
  escenarios: string[];
  valores: { v: string; texto: string }[];
}

export type Opciones = Record<string, string> & { dir?: string; escritura?: string; espacio?: string; norma?: string };

export function activo(e: Escenario | null, muestra: { bits: Record<string, Nivel>; buses: Record<string, string | null> }, a: Actividad): boolean {
  if (!e) return false;
  if (a.pista in muestra.bits) return muestra.bits[a.pista] === (a.nivel ?? 0);
  if (a.pista in muestra.buses) return muestra.buses[a.pista] !== null;
  return false;
}
