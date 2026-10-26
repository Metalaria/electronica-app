// Textures of the 3D board's faces from plain pixels (0.8; see caras.ts for the why). Three ways in:
//  - pintarDirecto(): a whole map painted on a software canvas of the page (the quick quarter-resolution pass,
//    the selection overlays, the exploded layers): one getImageData, one upload, no canvas → WebGL conversion;
//  - the worker (caras.trabajador.ts): the full-resolution maps painted off the page's thread;
//  - bands painted on the page's thread when the WebView has no OffscreenCanvas in workers (one band per task).
// Full-resolution maps are uploaded into an allocated texture in horizontal strips of about 2 MB, a few per task,
// with the mipmaps generated after the last one, so no task of the page lasts long; the previous texture stays
// on the material until the new one is complete.

import { Box2, DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat, SRGBColorSpace, UnsignedByteType, Vector2, type WebGLRenderer } from 'three';
import { pintarMapa, tamMapa, voltearFilas, type PedidoCara, type TipoMapa } from './caras';
import type { DatosPlaca } from './datos';
import type { Geometria } from './geometria';

/** Strip height so that one strip is about 2 MB of pixels (512 KB at least 64 rows). */
function filasPorFranja(w: number): number {
  return Math.max(64, Math.floor((2 * 1024 * 1024) / (4 * w)));
}

/** Longest a slice of uploads may last before the page gets its thread back (ms). */
const PORCION = 6;

/** A pause between slices: scheduler.yield() where it exists (keeps the task's priority), else a macrotask. */
export function ceder(): Promise<void> {
  const sch = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sch?.yield) return sch.yield();
  return new Promise((r) => setTimeout(r, 0));
}

function configurar(t: DataTexture, srgb: boolean, anisotropia: number): void {
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.flipY = false;
  t.premultiplyAlpha = false;
  t.unpackAlignment = 4;
  t.anisotropy = anisotropia;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = true;
}

/** A texture from RGBA pixels in GL row order, uploaded now (small maps). */
export function texturaDePixeles(r: WebGLRenderer, px: Uint8Array, w: number, h: number, srgb: boolean, anisotropia: number): DataTexture {
  const t = new DataTexture(px, w, h, RGBAFormat, UnsignedByteType);
  configurar(t, srgb, anisotropia);
  t.needsUpdate = true;
  r.initTexture(t);
  // The pixels are on the GPU: the texture keeps only its size.
  t.image = { data: null as unknown as Uint8Array, width: w, height: h };
  return t;
}

/** A map painted whole on a software canvas of the page, read back and flipped (ms of each step). */
export function pintarDirecto(
  pintar: (ctx: CanvasRenderingContext2D, s: number) => void,
  d: Pick<DatosPlaca, 'placa'>,
  lado: number,
): { px: Uint8Array; w: number; h: number; t: { pintar: number; leer: number } } {
  const { w, h, s } = tamMapa(d, lado);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  // Read back at once: a software canvas (WebKit's accelerated canvas would be copied out of the GPU).
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const t0 = performance.now();
  ctx.setTransform(s, 0, 0, s, 0, 0);
  pintar(ctx, s);
  const t1 = performance.now();
  const img = ctx.getImageData(0, 0, w, h);
  const px = new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength);
  voltearFilas(px, w, h);
  c.width = c.height = 0;
  return { px, w, h, t: { pintar: t1 - t0, leer: performance.now() - t1 } };
}

/** Main-thread time of a progressive upload: total, longest slice, strips; `gpu`: ms spent waiting (without
 *  blocking the page) for the GPU to take the previous slice. */
export interface Subida {
  ms: number;
  max: number;
  franjas: number;
  gpu: number;
  /** Fence after the last upload, waited for by the next one. */
  valla?: WebGLSync | null;
}

/**
 * A fence after a slice of uploads. Before the next slice the page polls it between tasks and waits until the
 * GPU process has taken the previous pixels: a texSubImage2D issued while it is still busy (a software GPU, a
 * long frame) would block the page's thread until there is room again for its data (17 s seen in Chromium with
 * SwiftShader).
 */
function valla(r: WebGLRenderer): WebGLSync | null {
  const gl = r.getContext() as WebGL2RenderingContext;
  const v = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  return v;
}

async function esperarValla(r: WebGLRenderer, v: WebGLSync | null, vivo: () => boolean, en: Subida): Promise<void> {
  if (!v) return;
  const gl = r.getContext() as WebGL2RenderingContext;
  const t0 = performance.now();
  // At most about a minute (then it goes on anyway).
  for (let i = 0; i < 4000 && vivo() && !gl.isContextLost(); i++) {
    if (gl.getSyncParameter(v, gl.SYNC_STATUS) === gl.SIGNALED) break;
    await new Promise((res) => setTimeout(res, 15));
  }
  gl.deleteSync(v);
  en.gpu += performance.now() - t0;
}

/** An allocated, empty full-size texture (all its mip levels) for a progressive upload. */
export function texturaVacia(r: WebGLRenderer, w: number, h: number, srgb: boolean, anisotropia: number): DataTexture {
  const t = new DataTexture(null, w, h, RGBAFormat, UnsignedByteType);
  configurar(t, srgb, anisotropia);
  // Allocate only (texStorage2D of every level, no pixels).
  t.source.dataReady = false;
  t.needsUpdate = true;
  r.initTexture(t);
  t.generateMipmaps = false;
  return t;
}

/**
 * Uploads `px` (RGBA, GL rows) into `t` strip by strip, a few strips per slice of at most PORCION ms, the
 * mipmaps after the last one. `vivo()` false stops it (returns null). `en` accumulates the main-thread cost.
 */
export async function subirPorFranjas(r: WebGLRenderer, t: DataTexture, px: Uint8Array, w: number, h: number, vivo: () => boolean, en: Subida): Promise<DataTexture | null> {
  const paso = filasPorFranja(w);
  const region = new Box2(new Vector2(), new Vector2());
  const destino = new Vector2();
  await esperarValla(r, en.valla ?? null, vivo, en);
  let inicio = performance.now();
  for (let y = 0; y < h; y += paso) {
    if (!vivo()) return null;
    const y1 = Math.min(h, y + paso);
    // Each strip as its own small source (a view of its rows): no UNPACK_SKIP_ROWS over the whole buffer.
    const fuente = new DataTexture(px.subarray(4 * w * y, 4 * w * y1), w, y1 - y, RGBAFormat, UnsignedByteType);
    region.min.set(0, 0);
    region.max.set(w, y1 - y);
    destino.set(0, y);
    // The last strip also generates the mipmaps.
    t.generateMipmaps = y1 >= h;
    const a = performance.now();
    r.copyTextureToTexture(fuente, t, region, destino);
    const b = performance.now();
    en.ms += b - a;
    en.franjas++;
    if (b - inicio > PORCION && y1 < h) {
      en.max = Math.max(en.max, b - inicio);
      const v = valla(r);
      await ceder();
      await esperarValla(r, v, vivo, en);
      inicio = performance.now();
    }
  }
  en.max = Math.max(en.max, performance.now() - inicio);
  // The next upload (another map) waits for this one too.
  en.valla = valla(r);
  t.generateMipmaps = true;
  // Only the size stays on the CPU side.
  t.image = { data: null as unknown as Uint8Array, width: w, height: h };
  return t;
}

/**
 * The fallback without a painting worker: the map painted on the page's thread in bands of about half a
 * megapixel (one band per task), each read back and uploaded once the GPU has taken the previous one. Returns
 * the texture or null if stopped.
 */
export async function pintarPorBandas(
  r: WebGLRenderer,
  d: DatosPlaca,
  g: Geometria,
  pedido: PedidoCara,
  tipo: TipoMapa,
  lado: number,
  anisotropia: number,
  vivo: () => boolean,
  en: Subida & { pintar: number; leer: number },
): Promise<DataTexture | null> {
  const { w, h, s } = tamMapa(d, lado);
  const t = texturaVacia(r, w, h, tipo === 'color', anisotropia);
  const alto = Math.max(16, Math.min(h, Math.floor((512 * 1024) / w)));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = alto;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const destino = new Vector2();
  const region = new Box2(new Vector2(), new Vector2());
  for (let y0 = 0; y0 < h; y0 += alto) {
    if (!vivo()) {
      t.dispose();
      return null;
    }
    const filas = Math.min(alto, h - y0);
    const t0 = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, alto);
    // The band's rows of the map: the same drawing, shifted up by y0 pixels.
    ctx.setTransform(s, 0, 0, s, 0, -y0);
    pintarMapa(ctx, d, g, pedido, tipo, s);
    const t1 = performance.now();
    const img = ctx.getImageData(0, 0, w, filas);
    const px = new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength);
    voltearFilas(px, w, filas);
    const leida = performance.now();
    // The GPU has taken the previous band before this one is sent (see valla()).
    await esperarValla(r, en.valla ?? null, vivo, en);
    en.valla = null;
    if (!vivo()) {
      t.dispose();
      return null;
    }
    const t2 = performance.now();
    // Waited (between tasks) or not: the band's work was one task or two.
    const unaTarea = t2 - leida < 1;
    // Image rows y0 … y0 + filas − 1 are GL rows h − y0 − filas … h − y0 − 1.
    t.generateMipmaps = y0 + filas >= h;
    region.min.set(0, 0);
    region.max.set(w, filas);
    destino.set(0, h - y0 - filas);
    r.copyTextureToTexture(new DataTexture(px, w, filas, RGBAFormat, UnsignedByteType), t, region, destino);
    const t3 = performance.now();
    en.valla = valla(r);
    en.pintar += t1 - t0;
    en.leer += leida - t1;
    en.ms += t3 - t2;
    en.franjas++;
    en.max = Math.max(en.max, unaTarea ? t3 - t0 : Math.max(leida - t0, t3 - t2));
    if (y0 + filas < h) await ceder();
  }
  c.width = c.height = 0;
  t.generateMipmaps = true;
  t.image = { data: null as unknown as Uint8Array, width: w, height: h };
  return t;
}
