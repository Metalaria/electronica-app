// Web Worker of the 3D board's faces (0.8): paints the colour and metal/roughness maps of a face at full
// resolution on an OffscreenCanvas and sends back their pixels (RGBA, GL row order) as transferred buffers, so
// the page's thread never rasterises a 4096 px canvas nor converts it for WebGL (see caras.ts). One worker per
// 3D board view; the board's geometry is rebuilt here once from the data the view sends.

import { construirGeometria, type Geometria } from './geometria';
import { pintarMapa, tamMapa, type MensajeTrabajador, type RespuestaTrabajador, type TiemposMapa } from './caras';
import type { DatosPlaca } from './datos';

const ambito = self as unknown as Worker;
let datos: DatosPlaca | null = null;
let geo: Geometria | null = null;
let msGeometria = 0;
/** Rows painted per band (about half a megapixel of a 4096 px map). */
const BANDA = 128;

function enviar(r: RespuestaTrabajador, transferir: Transferable[] = []): void {
  ambito.postMessage(r, transferir);
}

// Can this worker paint? (OffscreenCanvas 2D and Path2D in workers: Chromium, Safari/WKWebView 16.4+.)
try {
  const c = new OffscreenCanvas(1, 1);
  const ok = typeof Path2D !== 'undefined' && !!c.getContext('2d');
  enviar({ tipo: 'listo', ok, motivo: ok ? undefined : 'sin Path2D en el trabajador' });
} catch (e) {
  enviar({ tipo: 'listo', ok: false, motivo: e instanceof Error ? e.message : String(e) });
}

ambito.onmessage = (ev: MessageEvent<MensajeTrabajador>) => {
  const m = ev.data;
  if (m.tipo === 'placa') {
    datos = m.datos;
    geo = null;
    return;
  }
  try {
    if (!datos) throw new Error('sin placa');
    if (!geo) {
      const t = performance.now();
      geo = construirGeometria(datos);
      msGeometria = performance.now() - t;
    }
    const mapas: Extract<RespuestaTrabajador, { tipo: 'mapas' }>['mapas'] = [];
    for (const pm of m.mapas) {
      const { w, h, s } = tamMapa(datos, pm.lado);
      // Painted in bands of BANDA rows on a small canvas, each band's rows copied into the map (GL order):
      // in Chromium's workers a 4096 px canvas with the board's clips rasterised 5–20× slower than bands
      // (large AA clip masks), and the map needs no full-size canvas besides its pixels.
      const px = new Uint8Array(4 * w * h);
      const alto = Math.min(BANDA, h);
      const c = new OffscreenCanvas(w, alto);
      // Software canvas: it is read back at once, there is nothing to gain from GPU raster here.
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      const t: TiemposMapa = { pintar: 0, leer: 0, voltear: 0 };
      for (let y0 = 0; y0 < h; y0 += alto) {
        const filas = Math.min(alto, h - y0);
        const t0 = performance.now();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, w, alto);
        ctx.setTransform(s, 0, 0, s, 0, -y0);
        pintarMapa(ctx, datos, geo, m.pedido, pm.tipo, s);
        const t1 = performance.now();
        const img = ctx.getImageData(0, 0, w, filas);
        const t2 = performance.now();
        // Image row y0 + i is GL row h − 1 − y0 − i.
        const fila = 4 * w;
        for (let i = 0; i < filas; i++) px.set(img.data.subarray(i * fila, (i + 1) * fila), (h - 1 - y0 - i) * fila);
        t.pintar += t1 - t0;
        t.leer += t2 - t1;
        t.voltear += performance.now() - t2;
      }
      c.width = c.height = 0;
      mapas.push({ tipo: pm.tipo, w, h, px: px.buffer, t });
    }
    enviar({ tipo: 'mapas', n: m.n, mapas, geometria: msGeometria }, mapas.map((x) => x.px));
    msGeometria = 0;
  } catch (e) {
    enviar({ tipo: 'error', n: m.n, motivo: e instanceof Error ? e.message : String(e) });
  }
};
