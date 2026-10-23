// Drawing of a KiCad sheet from the compact «CSG1» geometry (contenido/consolas_svg.py): one Path2D per
// (layer, tile) so that only the tiles on screen are stroked, and text strokes are skipped when they would
// be smaller than about three pixels (level of detail). Units: 0.01 mm.

export interface Capa {
  rol: number;
  relleno: boolean;
  texto: boolean;
  /** Stroke width in 0.01 mm. */
  ancho: number;
  teselas: { caja: [number, number, number, number]; camino: Path2D }[];
}

export interface Dibujo {
  ancho: number;
  alto: number;
  capas: Capa[];
}

const NT = 8; // tiles per side

export function decodificar(buf: ArrayBuffer): Dibujo {
  const dv = new DataView(buf);
  const magia = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magia !== 'CSG1') throw new Error('Formato de hoja desconocido');
  const n = dv.getUint16(4, true);
  const ancho = dv.getFloat32(8, true) * 100;
  const alto = dv.getFloat32(12, true) * 100;
  const bytes = new Uint8Array(buf);
  let o = 16;
  const capas: Capa[] = [];
  const tw = ancho / NT;
  const th = alto / NT;
  for (let k = 0; k < n; k++) {
    const rol = dv.getUint8(o);
    const flags = dv.getUint8(o + 1);
    const w = dv.getFloat32(o + 4, true) * 100;
    const npol = dv.getUint32(o + 8, true);
    const ncir = dv.getUint32(o + 12, true);
    const nb = dv.getUint32(o + 16, true);
    o += 20;
    const fin = o + nb;
    let p = o;
    const leer = (): number => {
      let r = 0;
      let s = 0;
      let b: number;
      do {
        b = bytes[p++]!;
        r += (b & 0x7f) * 2 ** s;
        s += 7;
      } while (b & 0x80);
      // zigzag
      return r % 2 === 1 ? -(r + 1) / 2 : r / 2;
    };
    const teselas = new Map<number, { caja: [number, number, number, number]; camino: Path2D }>();
    const tesela = (x0: number, y0: number, x1: number, y1: number) => {
      const cx = Math.min(NT - 1, Math.max(0, Math.floor((x0 + x1) / 2 / tw)));
      const cy = Math.min(NT - 1, Math.max(0, Math.floor((y0 + y1) / 2 / th)));
      const key = cy * NT + cx;
      let t = teselas.get(key);
      if (!t) {
        t = { caja: [x0, y0, x1, y1], camino: new Path2D() };
        teselas.set(key, t);
      } else {
        t.caja[0] = Math.min(t.caja[0], x0);
        t.caja[1] = Math.min(t.caja[1], y0);
        t.caja[2] = Math.max(t.caja[2], x1);
        t.caja[3] = Math.max(t.caja[3], y1);
      }
      return t.camino;
    };
    let px = 0;
    let py = 0;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < npol; i++) {
      const m = leer();
      px += leer();
      py += leer();
      xs.length = 0;
      ys.length = 0;
      xs.push(px);
      ys.push(py);
      let x = px;
      let y = py;
      for (let j = 1; j < m; j++) {
        x += leer();
        y += leer();
        xs.push(x);
        ys.push(y);
      }
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (let j = 0; j < xs.length; j++) {
        x0 = Math.min(x0, xs[j]!);
        x1 = Math.max(x1, xs[j]!);
        y0 = Math.min(y0, ys[j]!);
        y1 = Math.max(y1, ys[j]!);
      }
      const c = tesela(x0 - w, y0 - w, x1 + w, y1 + w);
      c.moveTo(xs[0]!, ys[0]!);
      for (let j = 1; j < xs.length; j++) c.lineTo(xs[j]!, ys[j]!);
      if (flags & 1) c.closePath();
    }
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < ncir; i++) {
      cx += leer();
      cy += leer();
      const r = leer();
      const c = tesela(cx - r - w, cy - r - w, cx + r + w, cy + r + w);
      c.moveTo(cx + r, cy);
      c.arc(cx, cy, r, 0, Math.PI * 2);
    }
    o = fin;
    capas.push({ rol, relleno: (flags & 1) !== 0, texto: (flags & 2) !== 0, ancho: w, teselas: [...teselas.values()] });
  }
  return { ancho, alto, capas };
}

export interface ColoresEsquema {
  fondo: string;
  papel: string;
  roles: Record<number, string>;
  realce: string;
  realceSuave: string;
  seleccion: string;
}

export function colores(oscuro: boolean, acento: string): ColoresEsquema {
  return oscuro
    ? {
        fondo: '#111417',
        papel: '#191d22',
        roles: { 1: '#e08b80', 2: '#2a2924', 3: '#5cc77a', 4: '#86a6ff', 5: '#e3e6ea', 6: '#6fc9c6', 7: '#e29b9b', 8: '#d295d2', 9: '#97acf2', 10: '#d6d9dd', 11: '#a0a7ae' },
        realce: '#ffb02e',
        realceSuave: 'rgba(255,176,46,0.35)',
        seleccion: acento,
      }
    : {
        fondo: '#ece9e2',
        papel: '#fbfaf5',
        roles: { 1: '#8b1d1d', 2: '#fbf3cf', 3: '#17803a', 4: '#1f3f9e', 5: '#1b1b1b', 6: '#0c6262', 7: '#a32121', 8: '#7a1f7a', 9: '#2340b0', 10: '#222222', 11: '#666666' },
        realce: '#e07000',
        realceSuave: 'rgba(224,112,0,0.30)',
        seleccion: acento,
      };
}

export interface VistaEsquema {
  /** CSS pixels per 0.01 mm. */
  k: number;
  /** Offset in CSS pixels. */
  ox: number;
  oy: number;
}

/** Draws the sheet; returns the number of tiles stroked (for the performance test). */
export function dibujar(
  ctx: CanvasRenderingContext2D,
  d: Dibujo,
  v: VistaEsquema,
  dpr: number,
  anchoCss: number,
  altoCss: number,
  col: ColoresEsquema,
  atenuar: boolean,
): number {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = col.fondo;
  ctx.fillRect(0, 0, anchoCss, altoCss);
  const s = v.k * dpr;
  ctx.setTransform(s, 0, 0, s, v.ox * dpr, v.oy * dpr);
  ctx.fillStyle = col.papel;
  ctx.fillRect(0, 0, d.ancho, d.alto);
  // visible window in sheet units
  const x0 = -v.ox / v.k;
  const y0 = -v.oy / v.k;
  const x1 = x0 + anchoCss / v.k;
  const y1 = y0 + altoCss / v.k;
  const pxPorMm = v.k * 100;
  const textoPx = 1.27 * pxPorMm;
  const minimo = 0.55 / v.k; // thinnest stroke: about half a CSS pixel
  let n = 0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = atenuar ? 0.38 : 1;
  for (const c of d.capas) {
    if (c.texto && textoPx < 2.6) continue;
    const color = col.roles[c.rol] ?? col.roles[11]!;
    if (c.relleno) ctx.fillStyle = color;
    else {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(c.ancho, minimo);
    }
    const a = ctx.globalAlpha;
    if (c.texto && textoPx < 5) ctx.globalAlpha = a * ((textoPx - 2.6) / 2.4) * 0.8 + a * 0.2;
    for (const t of c.teselas) {
      const b = t.caja;
      if (b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) continue;
      if (c.relleno) ctx.fill(t.camino);
      else ctx.stroke(t.camino);
      n++;
    }
    ctx.globalAlpha = a;
  }
  ctx.globalAlpha = 1;
  return n;
}
