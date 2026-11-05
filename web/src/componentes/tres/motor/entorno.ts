// The studio's room environment (0.12): the prefiltered PMREM of three's RoomEnvironment that makes tin, copper
// and gold look like metals. Until 0.11 every 3D view (each board, each model page, the thumbnails) computed it
// again in its own WebGL context: three or four extra shader programs (the room's materials, the cube-to-cubeUV
// and GGX filters), compiled synchronously where the GPU has no KHR_parallel_shader_compile (the Adreno 650 of the
// Xiaomi Pad 6), plus the GPU work of filtering a 768 × 1024 half-float map; with a software GPU (SwiftShader, the
// test machines) that work alone took 8–9 s and held back the board's first frame.
//
// The result does not depend on the view, so it is computed once on this device, read back from the GPU in small
// bands without blocking the page (a fence per band, polled between tasks), kept in memory for the session and in
// IndexedDB («epa-cache-3d», a database of its own, never part of the user's data or backups) for later sessions.
// Later views upload those exact half-float pixels as a DataTexture with the same size, format, filtering and
// mapping as the PMREM render target: the same shader programs, the same picture, no filtering work. Anything
// unexpected (no float read-back, a lost context, a failed or odd read, no IndexedDB) leaves the old path: the PMREM
// is computed as before.

import { CubeUVReflectionMapping, DataTexture, DataUtils, HalfFloatType, LinearFilter, Mesh, MeshBasicMaterial, PMREMGenerator, REVISION, RGBAFormat, Vector4, type ColorSpace, type Texture, type WebGLRenderer, type WebGLRenderTarget } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** PMREM parameters of the studio (sigma of the room's blur and cube size): part of the cache key. */
const SIGMA = 0.04;
const TAMANO = 256;
/** Bump when the room, its parameters or the stored layout change. */
const VERSION = 1;
const CLAVE = `sala|v${VERSION}|r${REVISION}|${SIGMA}|${TAMANO}`;
const BD = 'epa-cache-3d';
const ALMACEN = 'entorno';
/** Floats copied out of the read-back buffer and converted per task (256 kB). */
const TROZO = 65_536;
const MEDIO_UNO = 0x3c00;

interface Pixeles {
  w: number;
  h: number;
  espacio: ColorSpace;
  datos: Uint16Array;
}

interface Registro {
  clave: string;
  w: number;
  h: number;
  espacio: string;
  datos: ArrayBuffer;
}

let memoria: Pixeles | null = null;
let precarga: Promise<void> | null = null;
let leyendo = false;

/** For the tests and the diagnostic: where the last environment came from and what the cache did. */
export const estadoEntorno: { origen: 'pmrem' | 'memoria' | null; guardado: boolean; leidoDeBd: boolean; error: string; leerMs: number; lectura: string } = {
  origen: null,
  lectura: '',
  guardado: false,
  leidoDeBd: false,
  error: '',
  leerMs: 0,
};
(globalThis as { __epaEntorno?: typeof estadoEntorno }).__epaEntorno = estadoEntorno;

function abrirBd(): Promise<IDBDatabase> {
  return new Promise((resolver, rechazar) => {
    const p = indexedDB.open(BD, 1);
    p.onupgradeneeded = () => {
      if (!p.result.objectStoreNames.contains(ALMACEN)) p.result.createObjectStore(ALMACEN);
    };
    p.onsuccess = () => resolver(p.result);
    p.onerror = () => rechazar(p.error);
    p.onblocked = () => rechazar(new Error('IndexedDB bloqueada'));
  });
}

/** Half-float pixels that look like a PMREM of the room: finite, alpha 0 or 1, most of the map used. */
function sanos(d: Uint16Array, w: number, h: number): boolean {
  if (d.length !== w * h * 4) return false;
  let llenos = 0;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]!;
    if (a === MEDIO_UNO) llenos++;
    else if (a !== 0) return false;
    // exponent all ones: infinity or NaN
    if ((d[i]! & 0x7c00) === 0x7c00 || (d[i + 1]! & 0x7c00) === 0x7c00 || (d[i + 2]! & 0x7c00) === 0x7c00) return false;
  }
  return llenos >= (w * h) / 2;
}

/**
 * Reads the environment saved by an earlier session (once per page; never rejects, and gives up after `plazo` ms so
 * a stuck IndexedDB cannot hold a view back). The views await it before creating their WebGL context.
 */
export function precargarEntorno(plazo = 600): Promise<void> {
  if (memoria) return Promise.resolve();
  precarga ??= new Promise<void>((resolver) => {
    const fin = setTimeout(resolver, plazo);
    const t0 = performance.now();
    let bd: IDBDatabase | null = null;
    const terminar = () => {
      clearTimeout(fin);
      bd?.close();
      resolver();
    };
    try {
      if (typeof indexedDB === 'undefined') return terminar();
      abrirBd()
        .then((b) => {
          bd = b;
          const p = b.transaction(ALMACEN, 'readonly').objectStore(ALMACEN).get(CLAVE);
          p.onsuccess = () => {
            const r = p.result as Registro | undefined;
            if (r && !memoria && r.clave === CLAVE && r.datos instanceof ArrayBuffer && r.datos.byteLength === r.w * r.h * 8) {
              const datos = new Uint16Array(r.datos);
              if (sanos(datos, r.w, r.h)) {
                memoria = { w: r.w, h: r.h, espacio: r.espacio as ColorSpace, datos };
                estadoEntorno.leidoDeBd = true;
                estadoEntorno.leerMs = performance.now() - t0;
              }
            }
            terminar();
          };
          p.onerror = terminar;
        })
        .catch(terminar);
    } catch {
      terminar();
    }
  });
  return precarga;
}

function guardarEnBd(px: Pixeles): void {
  try {
    if (typeof indexedDB === 'undefined') return;
    void abrirBd()
      .then((b) => {
        const tx = b.transaction(ALMACEN, 'readwrite');
        const r: Registro = { clave: CLAVE, w: px.w, h: px.h, espacio: px.espacio, datos: px.datos.buffer as ArrayBuffer };
        tx.objectStore(ALMACEN).put(r, CLAVE);
        tx.oncomplete = () => {
          estadoEntorno.guardado = true;
          b.close();
        };
        tx.onerror = tx.onabort = () => b.close();
      })
      .catch(() => {});
  } catch {
    /* no storage: kept in memory only */
  }
}

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 0.12 QA: puts the canvas viewport back as setSize() leaves it. three's setRenderTarget(null) — at the end of the
 * filtering and of the read-back — floors the viewport in device pixels where setSize()/setViewport() round it: on a
 * canvas whose CSS size times the pixel ratio is not whole (572.4 × 2 → 1144 vs 1145 rows), a view that filtered or
 * read the environment after its first resize drew one row shorter, every part a fraction of a pixel off (1,1 % of
 * the NES board's pixels differed from 0.11 and from the same board opened again, until the next resize).
 */
function reponerVista(renderer: WebGLRenderer): void {
  if (renderer.getRenderTarget() !== null) return;
  renderer.setViewport(renderer.getViewport(new Vector4()));
  renderer.setScissor(renderer.getScissor(new Vector4()));
}

/** Waits for a fence without blocking (polled between tasks); false if the context is lost, it fails or times out. */
async function esperarValla(gl: WebGL2RenderingContext, ms: number): Promise<boolean> {
  const valla = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (!valla) return false;
  gl.flush();
  const t0 = performance.now();
  try {
    for (;;) {
      await esperar(16);
      if (gl.isContextLost()) return false;
      if (gl.getSyncParameter(valla, gl.SYNC_STATUS) === gl.SIGNALED) return true;
      // (a flush lets the GPU process look at its pending queries now: without one, with nothing else being sent,
      // Chromium reported the fence seconds after the GPU had passed it)
      gl.flush();
      if (performance.now() - t0 > ms) return false;
    }
  } finally {
    if (!gl.isContextLost()) gl.deleteSync(valla);
  }
}

/** Read-backs still on the GPU, by context: the view that closes meanwhile lets its context go when they end. */
const pendientes = new WeakMap<object, Promise<void>>();

/** The longest a closed view's context is kept for its read-back (then it is released anyway). */
const PLAZO_LECTURA = 60_000;

/**
 * Reads the freshly computed PMREM back into memory (and IndexedDB). The read is queued right behind the filtering,
 * before the view's own GPU work (with a software GPU, a read waiting behind the board's frames took tens of
 * seconds), as floats (always allowed with EXT_color_buffer_float) into a pixel-pack buffer that lives only until the
 * GPU has done it; a fence polled between tasks says when. The floats are then copied and converted to half floats
 * (exact: they are half floats) in short slices. Nothing here blocks the page. The read survives the view: its
 * textures can go (GL keeps what queued commands still use), only its context waits (soltarContexto).
 */
function leerDeGpu(renderer: WebGLRenderer, rt: WebGLRenderTarget): void {
  if (leyendo || memoria) return;
  const gl = renderer.getContext();
  if (!(typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) || gl.isContextLost()) return;
  if (!renderer.extensions.has('EXT_color_buffer_float')) return;
  const w = rt.width;
  const h = rt.height;
  const espacio = rt.texture.colorSpace as ColorSpace;
  let pbo: WebGLBuffer | null = null;
  try {
    pbo = gl.createBuffer();
    const previo = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, w * h * 16, gl.STREAM_READ);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    renderer.setRenderTarget(previo);
    reponerVista(renderer);
  } catch (e) {
    if (pbo) gl.deleteBuffer(pbo);
    estadoEntorno.error = e instanceof Error ? e.message : String(e);
    return;
  }
  leyendo = true;
  const p = terminarLectura(gl, pbo, w, h, espacio);
  pendientes.set(gl, p);
  void p.finally(() => pendientes.delete(gl));
}

async function terminarLectura(gl: WebGL2RenderingContext, pbo: WebGLBuffer, w: number, h: number, espacio: ColorSpace): Promise<void> {
  try {
    // with a software GPU this is the long part: the filtering itself
    estadoEntorno.lectura = 'esperando a la GPU';
    if (!(await esperarValla(gl, PLAZO_LECTURA))) {
      estadoEntorno.lectura = 'sin terminar';
      return;
    }
    const datos = new Uint16Array(w * h * 4);
    const trozo = new Float32Array(TROZO);
    for (let o = 0; o < datos.length; o += TROZO) {
      if (gl.isContextLost()) {
        estadoEntorno.lectura = 'sin terminar';
        return;
      }
      const n = Math.min(TROZO, datos.length - o);
      const vista = trozo.subarray(0, n);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, o * 4, vista);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      for (let i = 0; i < n; i++) datos[o + i] = DataUtils.toHalfFloat(vista[i]!);
      await esperar(0);
    }
    // (no getError(): a synchronous round trip; a failed read leaves the buffer at zero, which sanos() refuses)
    if (!sanos(datos, w, h)) {
      estadoEntorno.error = 'entorno leído no válido';
      estadoEntorno.lectura = '';
      return;
    }
    estadoEntorno.lectura = 'leído';
    memoria ??= { w, h, espacio, datos };
    guardarEnBd(memoria);
  } catch (e) {
    estadoEntorno.error = e instanceof Error ? e.message : String(e);
  } finally {
    if (!gl.isContextLost()) gl.deleteBuffer(pbo);
    leyendo = false;
  }
}

/**
 * Releases a view's WebGL context (instead of renderer.forceContextLoss()): at once, or, while the environment is
 * still being read back from it, when that ends (at most PLAZO_LECTURA), its drawing buffer shrunk to 1 px meanwhile.
 * Call it after renderer.dispose() and after every texture and geometry of the view are disposed.
 */
export function soltarContexto(renderer: WebGLRenderer): void {
  const gl = renderer.getContext();
  const p = pendientes.get(gl);
  if (!p) {
    renderer.forceContextLoss();
    return;
  }
  try {
    const c = gl.canvas as HTMLCanvasElement | OffscreenCanvas;
    c.width = 1;
    c.height = 1;
  } catch {
    /* the buffer stays as it is until the context goes */
  }
  void p.finally(() => renderer.forceContextLoss());
}

/**
 * The studio's environment map for this renderer: the saved pixels when this device has them, else the PMREM
 * computed now (and read back for the next views). `liberar()` gives its GPU memory back.
 *
 * `lecturaTras` (0.12, follow-up): the read-back waits for it (the board view passes its first frame on screen), so
 * the first view on a device — or every view where storage is wiped — shows its board as soon as 0.11 did: queued
 * right behind the filtering, the read-back went before the first frame and delayed it 2–3 s with a software GPU.
 * If the view closes before that, the read-back is issued then, before its textures go (soltarContexto keeps the
 * context until it ends). Without it, the read-back is issued at once (the model viewer, the thumbnails).
 */
export function crearEntorno(renderer: WebGLRenderer, { lecturaTras }: { lecturaTras?: Promise<unknown> } = {}): { textura: Texture; listo: Promise<void>; liberar(): void } {
  void precargarEntorno();
  if (memoria) {
    const t = new DataTexture(memoria.datos, memoria.w, memoria.h, RGBAFormat, HalfFloatType);
    // exactly the PMREM render target's texture (PMREMGenerator._allocateTargets / _createRenderTarget)
    t.mapping = CubeUVReflectionMapping;
    t.name = 'PMREM.cubeUv';
    t.magFilter = LinearFilter;
    t.minFilter = LinearFilter;
    t.generateMipmaps = false;
    t.flipY = false;
    t.colorSpace = memoria.espacio;
    t.needsUpdate = true;
    estadoEntorno.origen = 'memoria';
    return { textura: t, listo: Promise.resolve(), liberar: () => t.dispose() };
  }
  const pmrem = new PMREMGenerator(renderer);
  const sala = new RoomEnvironment();
  const rt = pmrem.fromScene(sala, SIGMA, 0.1, 100, { size: TAMANO });
  sala.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (m.material as MeshBasicMaterial).dispose();
    }
  });
  pmrem.dispose();
  reponerVista(renderer);
  estadoEntorno.origen = 'pmrem';
  // When the GPU has done the filtering (a fence, polled between tasks): until then any synchronous GL query (the
  // link status of the view's programs) would wait for it with the page blocked.
  const gl = renderer.getContext();
  const listo = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext ? esperarValla(gl, PLAZO_LECTURA).then(() => {}) : Promise.resolve();
  let empezada = false;
  let liberada = false;
  const empezar = (): void => {
    if (empezada) return;
    empezada = true;
    leerDeGpu(renderer, rt);
  };
  if (lecturaTras) void lecturaTras.then(() => (liberada ? undefined : empezar())).catch(() => {});
  else empezar();
  return {
    textura: rt.texture,
    listo,
    liberar() {
      // (closed before its first frame: read it now, while its texture is still there)
      empezar();
      liberada = true;
      rt.texture.dispose();
    },
  };
}

/** Tests: forget the copy in memory (the next view computes or reads it again). */
export function olvidarEntornoEnMemoria(): void {
  memoria = null;
  precarga = null;
}
