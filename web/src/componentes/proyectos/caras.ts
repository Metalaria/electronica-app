// The maps of the 3D board's faces as plain pixels (0.8): the colour map (pintarLado, «real» look) and the
// metal/roughness map, painted on a Canvas 2D context — a worker's OffscreenCanvas where the WebView has one,
// else bands of a software canvas on the page's thread — and read back as RGBA rows in GL order (bottom row
// first), ready for texSubImage2D without any conversion (no flip, no premultiplied alpha, no colour space).
// No three.js and no DOM here: this module also runs in caras.trabajador.ts.
//
// Why (0.7.0 measurements): WebKit (WKWebView on the MacBook Pro 2017) took 1,2–1,3 s to paint and upload the
// two 4096 px faces, Chromium on the phones 12–13 ms: WebKit rasterises a large 2D canvas with CoreGraphics on
// the CPU and its texImage2D(canvas) copies the pixels out of the canvas and converts them (unpremultiply, flip)
// on the page's thread; Chromium only records the drawing and leaves raster and upload to the GPU.

import type { DatosPlaca } from './datos';
import type { Geometria, Lado } from './geometria';
import { pintarLado, type Acabado } from './pintar';

export interface CapasCara {
  F: boolean;
  B: boolean;
  mascara: boolean;
  serigrafia: boolean;
}

/** What a face's maps depend on (besides the board). */
export interface PedidoCara {
  lado: Lado;
  capas: CapasCara;
  acabado: Acabado;
  /** Mask colour name (DatosPlaca.placa.mascara). */
  mascara: string;
}

export type TipoMapa = 'color' | 'pbr';

/** Pixel size of a face map and its scale (px per u): `lado` px on the board's long side. */
export function tamMapa(d: Pick<DatosPlaca, 'placa'>, lado: number): { w: number; h: number; s: number } {
  const s = lado / Math.max(d.placa.ancho, d.placa.alto);
  return { w: Math.max(1, Math.round(d.placa.ancho * s)), h: Math.max(1, Math.round(d.placa.alto * s)), s };
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Paints one map of a face. The context's transform must map board units (u) to the map's pixels (`s` px per
 * u; a band of the map is painted with a translated transform). Colour: the manufactured look with the drills
 * punched out (alpha 0). PBR: metal in blue, roughness in green (glossy mask, matt silkscreen, metallic pads).
 */
export function pintarMapa(ctx: Ctx, d: DatosPlaca, g: Geometria, p: PedidoCara, tipo: TipoMapa, s: number): void {
  const cap = p.capas;
  const k = ctx as CanvasRenderingContext2D;
  if (tipo === 'color') {
    pintarLado(k, d, g, {
      lado: p.lado,
      aspecto: 'real',
      acabado: p.acabado,
      visibles: { F: cap.F, B: cap.B, mascara: cap.mascara, serigrafia: cap.serigrafia, fab: false, areas: false },
      mascara: p.mascara,
      escala: s,
      textura: true,
    });
    return;
  }
  const lado = p.lado;
  k.save();
  k.clip(g.contorno);
  k.fillStyle = cap.mascara ? 'rgb(0,92,0)' : 'rgb(0,200,0)';
  k.fill(g.contorno);
  if (cap[lado]) {
    k.save();
    if (cap.mascara) k.clip(g.aberturas[lado], 'nonzero');
    k.fillStyle = 'rgb(0,80,255)';
    for (const m of [g.cobre[lado].pads, g.cobre[lado].vias, g.cobre[lado].zonas]) for (const c of m.values()) k.fill(c, 'evenodd');
    k.strokeStyle = 'rgb(0,80,255)';
    for (const [w, porRed] of g.cobre[lado].pistas) {
      k.lineWidth = w;
      for (const c of porRed.values()) k.stroke(c);
    }
    k.restore();
  }
  if (cap.serigrafia && g.serigrafia[lado]) {
    k.strokeStyle = 'rgb(0,225,0)';
    k.fillStyle = 'rgb(0,225,0)';
    for (const [w, c] of g.serigrafia[lado]!.trazos) {
      k.lineWidth = w;
      k.stroke(c);
    }
    k.fill(g.serigrafia[lado]!.rellenos);
  }
  k.restore();
}

/** Reverses the order of the rows of an RGBA buffer in place (canvas rows top-down → GL rows bottom-up). */
export function voltearFilas(px: Uint8Array | Uint8ClampedArray, w: number, h: number): void {
  const fila = 4 * w;
  const tmp = new Uint8Array(fila);
  for (let a = 0, b = h - 1; a < b; a++, b--) {
    const ia = a * fila;
    const ib = b * fila;
    tmp.set(px.subarray(ia, ia + fila));
    px.copyWithin(ia, ib, ib + fila);
    px.set(tmp, ib);
  }
}

/** Times of one map painted by the worker (ms): drawing calls, read back (raster flush + copy) and flip. */
export interface TiemposMapa {
  pintar: number;
  leer: number;
  voltear: number;
}

// ---------------------------------------------------------------- messages of the worker

export type MensajeTrabajador =
  | { tipo: 'placa'; datos: DatosPlaca }
  | { tipo: 'pintar'; n: number; pedido: PedidoCara; mapas: { tipo: TipoMapa; lado: number }[] };

export type RespuestaTrabajador =
  | { tipo: 'listo'; ok: boolean; motivo?: string }
  | { tipo: 'mapas'; n: number; mapas: { tipo: TipoMapa; w: number; h: number; px: ArrayBuffer; t: TiemposMapa }[]; geometria: number }
  | { tipo: 'error'; n: number; motivo: string };

/**
 * The board data the faces need (the worker rebuilds the geometry from it): no footprints or rule areas (the
 * 3D faces never show fabrication outlines or areas), so the copy sent to the worker stays small.
 */
export function datosParaCaras(d: DatosPlaca): DatosPlaca {
  const { version, id, placa, pads, pistas, vias, zonas, serigrafia } = d;
  return { version, id, placa, pads, pistas, vias, zonas, serigrafia, huellas: [], areas: [], redes: [] } as unknown as DatosPlaca;
}
