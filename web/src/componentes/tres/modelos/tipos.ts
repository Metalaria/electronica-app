// Types of the procedural 3D component library (no three.js imports here: the catalogue and the reader use
// these types without pulling the 3D chunk).
//
// Conventions shared by every model (and relied on by the KiCad board views):
//   - units are millimetres;
//   - origin at the centre of the part's footprint, on the board surface (z = 0), +Z up;
//   - the orientation follows the KiCad standard footprint of the package with KiCad's y axis flipped
//     (KiCad y points down, ours up): two-terminal parts lie along X with pin 1 at −X; DIP/SOIC rows run
//     along Y with pin 1 at the top-left (−X, +Y); SOT-23 has pins 1 and 2 at −X and pin 3 at +X; TO-92 and
//     TO-220 have their pins along X (pin 1 at −X) and the marked face towards −Y.

export type ValorParametro = string | number | boolean;
export type Parametros = Record<string, ValorParametro>;

/** How a through-hole part is shown: leads bent/cut through a board, or straight as delivered. */
export type Montaje = 'placa' | 'suelto';

export interface OpcionesModelo {
  /** Shared resource cache (materials, textures, geometries). Without it each model owns its resources. */
  recursos?: unknown;
  /** 'bajo': fewer segments (boards with hundreds of parts). */
  detalle?: 'alto' | 'bajo';
  /** Default 'placa' (leads through a board of `grosorPlaca` mm, 1 mm protruding below). */
  montaje?: Montaje;
  /** Board thickness in mm (default 1,6). */
  grosorPlaca?: number;
}

export interface Pad {
  /** Pin number as in KiCad ("1", "2", …). */
  n: string;
  x: number;
  y: number;
  forma: 'circulo' | 'rect' | 'ovalo';
  w: number;
  h: number;
  /** Drill diameter for through-hole pads. */
  taladro?: number;
}

export interface Huella {
  pads: Pad[];
  /** Body footprint (courtyard-like box) in mm. */
  ancho: number;
  fondo: number;
  /** Height above the board in mm. */
  alto: number;
  /** Position of the KiCad footprint origin in model coordinates (pad 1 for most THT footprints). */
  origenKicad: [number, number];
  /** Nominal KiCad footprint name this geometry matches. */
  kicad?: string;
}

/** Metadata of one part of a model (Object3D.userData). */
export interface DatosParte {
  parte?: string;
  /** Label shown by the viewer: book term, optional book reference and anchor point (local, mm). */
  etiqueta?: { texto: string; ref?: string; punto?: [number, number, number] };
  /** Offset at full explosion, in mm (model axes). */
  explosion?: [number, number, number];
  /** Only meaningful when the inside is shown (cutaway or explosion): its label is hidden otherwise. */
  interior?: boolean;
  /** Never clipped by the cutaway plane (dies, bond wires: they stay whole behind the cut). */
  entero?: boolean;
  /** Colour of the cut face (default: the material colour, darkened). */
  colorCorte?: string;
}

/** Cutaway plane of a model: the plane's normal and the travel of its offset, in mm along the normal. */
export interface Corte {
  /** Name shown when a model offers several cuts («Longitudinal», «Transversal», «Desde arriba»). */
  nombre?: string;
  normal: [number, number, number];
  min: number;
  max: number;
  /** Starting position when the cut is switched on. */
  inicial: number;
}

/** Model-level metadata (root Group.userData). */
export interface DatosModelo {
  tipo: string;
  parametros: Parametros;
  huella: Huella;
  /** Cutaway planes (the first is the default); none: no cutaway. */
  cortes?: Corte[];
  /** The model has parts with an explosion offset. */
  explosionable?: boolean;
  /** How it was built (THT leads through a board or loose). */
  montaje?: Montaje;
  /** Short text for the marking actually printed (for tests and the UI). */
  marcado?: string;
  /** Number of triangles (approximate, instancing included). */
  triangulos?: number;
}
