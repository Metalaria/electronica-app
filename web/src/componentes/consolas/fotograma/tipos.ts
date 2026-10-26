// «Un fotograma»: types shared by the player and the per-console adapters (maquinas/<maquina>.ts).
// The trace format («EPAF» v1) is written by contenido/fotograma/traza.mjs; see ESQUEMA.md, «Un fotograma».

import type { IdMaquina } from '../datos';

export type TipoArray = 'u8' | 'u16' | 'u32' | 'i32';

export interface DefArray {
  tipo: TipoArray;
  n: number;
  cod: 'crudo' | 'vlq' | 'vlqd';
  offset: number;
  bytes: number;
}

export interface ChipBus {
  id: string;
  titulo: string;
}

export interface BusTraza {
  id: string;
  titulo: string;
  anchoDir: number;
  anchoDato: number;
  /** Names of the arrays: time, address, data, flags, chip index, kind index (optional). */
  t: string;
  a: string;
  d: string;
  f: string;
  c: string;
  k?: string;
  chips: ChipBus[];
  tipos?: ChipBus[];
  /** Units every access lasts (default: unidadesPorCiclo for the CPU bus and «dma», 2 for the others). */
  duracion?: number;
  /** Units per access kind (index of `tipos`), when it varies. */
  duraciones?: number[];
}

export interface SegmentoTraza {
  id: string;
  titulo: string;
  descripcion: string;
  t0: number;
  t1: number;
  pixel0: number;
  pixel1: number;
}

export interface ManifiestoTraza {
  formato: 'EPAF';
  version: 1;
  maquina: IdMaquina;
  /** Program id (the file name without .bin). */
  idPrograma: string;
  titulo: string;
  tipo: 'demo' | 'juego';
  generador: { emulador: string; detalle: string };
  reloj: { hz: number; nombre: string };
  cpus: { id: string; tipo: '6502' | 'sm83' | 'z80' | '68000'; titulo: string; hz: number; unidadesPorCiclo: number; registros: string[] }[];
  buses: BusTraza[];
  instrucciones: { cpu: string; t: string; pc: string; ciclo: string; k?: string; r: string[] }[];
  video: {
    ancho: number;
    alto: number;
    puntosPorLinea: number;
    lineas: number;
    primeraVisible: number;
    formato: 'indice' | 'rgb555';
    paleta?: number[];
    t0Cuadro?: number;
    /** Time units per dot (1 when the unit is the dot). */
    unidadesPorPunto?: number;
    /** Arrays with the start time (dot 0) and number of every recorded video line. */
    lineasT?: string;
    lineasN?: string;
  };
  fases: { tipos: { id: string; titulo: string }[]; t: string; k: string; linea: string };
  senales: { tipos: { id: string; titulo: string; activaBaja?: boolean }[]; t: string; k: string; v: string };
  pixeles: { t: string; c: string };
  fb?: string;
  segmentos: SegmentoTraza[];
  memoria: { nombre: string; array: string; base: number }[];
  programa: {
    fuente: string;
    licencia: string;
    autor: string;
    url?: string;
    etiquetas: Record<string, string>;
    explicaciones: Record<string, string>;
    lineas?: Record<string, [number, string]>;
  };
  compresion?: { tipo: 'lz'; bytes: number };
  arrays: Record<string, DefArray>;
}

export type ArrayNum = Uint8Array | Uint16Array | Uint32Array | Int32Array;

/** One bus access as the adapters see it. */
export interface AccesoBus {
  t: number;
  a: number;
  d: number;
  f: number;
  /** Chip id (BusTraza.chips[c].id). */
  c: string;
  /** Kind id (BusTraza.tipos[k].id), when the bus has kinds. */
  k?: string;
  /** Units elapsed since the access started (0 = its first unit). */
  fase: number;
}

/** Colour group of a net (the same in the schematic, the board, the photo, the timeline and the legend). */
export type GrupoSenal = 'direccion' | 'datos' | 'control' | 'seleccion' | 'reloj' | 'video' | 'interrupcion' | 'dma';

export interface RedActiva {
  /** Net name of the console's schematic (DatosMaquina.redes[].n). */
  red: string;
  grupo: GrupoSenal;
  /** Logic level at that instant (null = not known or not logic). */
  nivel: 0 | 1 | null;
  /** Reference of the part that drives the net: the pulses travel away from its pins. */
  desde?: string;
}

export interface InstruccionDesensamblada {
  texto: string;
  bytes: number;
  /** Generic Spanish explanation of the instruction (the demo's own explanations take precedence). */
  explicacion: string;
}

export interface Desensamblador {
  instruccion(leer: (dir: number) => number, pc: number, etiquetas?: Record<string, string>): InstruccionDesensamblada;
}

/** What the player knows at an instant, passed to `narrar`. */
export interface EstadoReproductor {
  t: number;
  linea: number;
  punto: number;
  fase: string;
  acceso: Record<string, AccesoBus | null>;
}

export interface Adaptador {
  maquina: IdMaquina;
  /** Disassembler of every CPU of the trace (key = cpus[].id). */
  cpus: Record<string, Desensamblador>;
  /** Nets moved by one access of a bus at the given phase of the access. */
  redesAcceso(bus: string, ev: AccesoBus, out: RedActiva[]): void;
  /** Nets of a signal of the trace (senales.tipos[].id) at a level. */
  redesSenal(senal: string, nivel: number, out: RedActiva[]): void;
  /** Nets of the video output while a pixel goes out (colour value of the trace). */
  redesPixel?(color: number, out: RedActiva[]): void;
  /** Clocks: always running, drawn faintly. */
  relojes: RedActiva[];
  /** Parts that answer for each chip id of the buses (to frame them on the schematic and the board). */
  chips: Record<string, string[]>;
  /** Spanish text of what is happening (optional). */
  narrar?(e: EstadoReproductor): string;
  /** Notice about the board views (e.g. which board or photo is shown and why). */
  avisoPlaca?: string;
  /** Explanation of each video phase (fases.tipos[].id → text). */
  fases?: Record<string, string>;
  /** Memory map for the panel. */
  mapa: { desde: number; hasta: number; chip: string; titulo: string; cpu?: string }[];
  /** Sheet of the schematic to show first (index of DatosMaquina.hojas). */
  hojaInicial?: number;
  /** Fidelity notes: what is exact and what is illustrative (Spanish). */
  fidelidad: string;
  /** Sources of the timing (title, url) for «Fuentes». */
  fuentes: { titulo: string; url: string; uso: string }[];
}

export interface IndicePrograma {
  id: string;
  titulo: string;
  tipo: 'demo' | 'juego';
  archivo: string;
  bytes: number;
  resumen: string;
  /** For a homebrew game: credits and licence (file next to the trace). */
  juego?: { nombre: string; autor: string; licencia: string; url: string; commit: string; licenciaTexto: string };
  /** Video standard of the program, when a machine has one trace per standard (Mega Drive). */
  norma?: 'pal' | 'ntsc';
}
