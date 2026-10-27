// «Un fotograma» (0.9): a guided, step-by-step explanation of how one pixel of one frame comes to exist on each
// console. No emulation: every machine has a data file (maquinas/<maquina>.ts) with numbered steps; each step
// lights blocks and wires of the console's «Arquitectura» diagram, names the values on the buses and advances a
// small example screen. The values are illustrative but consistent: the same tile, palette and pixel are followed
// through the whole frame.

import type { Conexion } from '../arquitectura/diagrama';
import type { IdMaquina } from '../datos';

/**
 * How far the example frame has got. Each stage keeps what the previous ones showed:
 * - cuadro-anterior: the screen still shows the previous frame (CPU work, vertical blank);
 * - vram: the tile's pattern is in video memory (or in the cartridge's graphics ROM);
 * - mapa: the map places the tile on the screen;
 * - patron: the bytes of the followed row have been read;
 * - mezcla: the planes (or nibbles) are combined into one colour index per pixel;
 * - prioridad: sprites and layers have been weighed for the followed pixel;
 * - paleta: the index has become a colour;
 * - punto: the followed pixel leaves for the screen;
 * - cuadro: the whole frame is done.
 */
export type Etapa = 'cuadro-anterior' | 'vram' | 'mapa' | 'patron' | 'mezcla' | 'prioridad' | 'paleta' | 'punto' | 'cuadro';

export const ETAPAS: Etapa[] = ['cuadro-anterior', 'vram', 'mapa', 'patron', 'mezcla', 'prioridad', 'paleta', 'punto', 'cuadro'];

/** A wire of the diagram that takes part in a step. */
export interface Senal {
  /** Connection id of the «Arquitectura» diagram, or of the machine's `extra` wires. */
  id: string;
  /** Direction of the pulse: 1 from the first point of the connection to the last, -1 the other way. */
  sentido: 1 | -1;
  /** Value on the wire («$C0F0», «0»), shown on its label and in the step's list. */
  valor?: string;
  /** Name shown with the value instead of the connection's own label (taps have none). */
  nombre?: string;
  /** Label position in diagram units, when the default one is crowded. */
  pos?: [number, number];
}

export interface Paso {
  /** Short label above the title («Bus de la CPU», «Borrado vertical»). */
  fase: string;
  titulo: string;
  /** One to three sentences in Spanish: what happens and why. */
  texto: string;
  /** Diagram layer: the board (default) or the inside of the chip, where the machine has one. */
  capa?: 'placa' | 'interior';
  /** Blocks of the diagram that take part. */
  bloques: string[];
  /** Blocks of the board diagram to mark on the photo when they are not `bloques` (steps drawn inside the chip). */
  placa?: string[];
  /** Wires lit, in the direction of the signal. */
  senales: Senal[];
  /** Values that do not travel on a drawn wire (registers, internal buses, strobes not drawn): [name, value]. */
  internos?: [string, string][];
  pantalla: Etapa;
  /** Line under the screen panel (otherwise one derived from the stage). */
  nota?: string;
}

/** The example followed through the frame. */
export interface Ejemplo {
  /** Visible picture in pixels. */
  ancho: number;
  alto: number;
  /** Size of the followed tile or sprite tile (8 or 16 pixels). */
  tesela: number;
  /** Top-left pixel of the tile on screen. */
  x: number;
  y: number;
  /** Colour index of every pixel of the tile (rows of `tesela` values). */
  indices: number[][];
  /** The followed pixel inside the tile. */
  fila: number;
  columna: number;
  /** CSS colour of each index the tile uses (index 0 is transparent: the backdrop shows). */
  colores: Record<number, string>;
  /** Backdrop colour (CSS). */
  fondo: string;
  /** Bits per pixel. */
  bpp: 2 | 4;
  /** How a row is stored: bit planes (one byte per plane, leftmost pixel in bit 7) or packed nibbles. */
  formato: 'planos' | 'nibbles';
  /** Planar bytes of this machine are not stored leftmost-pixel-in-bit-7 (Neo Geo): show the bits only. */
  sinHex?: boolean;
  /** Columns of the followed row read in one fetch (Neo Geo: the left half of a 16-pixel sprite line). */
  ventana?: [number, number];
  /** Tile number as the texts write it («$24»). */
  numero: string;
  /** Colour value of the followed pixel as the texts write it («$16»). */
  color: string;
  /** Name of the screen in the panel («Pantalla», «LCD»). */
  pantalla?: string;
}

export interface FuenteFotograma {
  titulo: string;
  url: string;
  /** What was checked there. */
  nota?: string;
}

export interface FotogramaMaquina {
  maquina: IdMaquina;
  /** One or two sentences under the step bar: what is followed. */
  entrada: string;
  ejemplo: Ejemplo;
  pasos: Paso[];
  /** Wires drawn only in this tab (strobes the «Arquitectura» diagram leaves out). */
  extra?: Conexion[];
  fuentes: FuenteFotograma[];
}
