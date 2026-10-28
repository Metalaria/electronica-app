// Automatic wire routing on the drawing's unit grid: an orthogonal path from a point (usually a pin) to the
// nearest of a set of points (another pin, or any point of a net), around the parts' bodies, never along or
// onto another wire, never through a pin or a wire end (both would connect), crossing other wires only at a
// right angle and never turning on them. Dijkstra over (point, direction) with costs for length, bends,
// crossings and running next to a body; plain TypeScript (the editor's «Ruta automática» tool, «Ordenar el
// esquema» and the importer's reconnections use it).

import { cajaMundo, geometria, pinesMundo } from './geometria.ts';
import type { Cable, Componente, DocumentoEsquema } from './tipos.ts';

export type P = [number, number];
type Seg = [number, number, number, number];

export interface OpcionesRuta {
  /** Parts and wires to leave out of the obstacles (the part being connected, wires being replaced). */
  ignorar?: Set<string>;
  /** Outward direction at the start (a pin's lead): leaving that way costs nothing extra. */
  salida?: P;
  /** Margin (units) around the drawing where the path may go. */
  margen?: number;
}

const DIRS: P[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

const k = (x: number, y: number) => `${x},${y}`;

interface Mapa {
  x0: number;
  y0: number;
  w: number;
  h: number;
  /** 1: inside a body; 2: next to a body (soft). */
  cuerpo: Uint8Array;
  /** Wire through the point: bit 1 horizontal, bit 2 vertical; bit 4: a wire end or a pin (cannot be passed). */
  cable: Uint8Array;
}

function construirMapa(doc: DocumentoEsquema, extra: P[], op: OpcionesRuta): Mapa {
  const ign = op.ignorar ?? new Set<string>();
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const amp = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  for (const c of doc.componentes) {
    const g = geometria(c);
    amp(c.x + g.caja[0], c.y + g.caja[1]);
    amp(c.x + g.caja[2], c.y + g.caja[3]);
  }
  for (const w of doc.cables) {
    amp(w.p[0], w.p[1]);
    amp(w.p[2], w.p[3]);
  }
  for (const p of extra) amp(p[0], p[1]);
  const m = op.margen ?? 4;
  x0 = Math.floor(x0) - m;
  y0 = Math.floor(y0) - m;
  x1 = Math.ceil(x1) + m;
  y1 = Math.ceil(y1) + m;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const mapa: Mapa = { x0, y0, w, h, cuerpo: new Uint8Array(w * h), cable: new Uint8Array(w * h) };
  const idx = (x: number, y: number) => (x < x0 || y < y0 || x > x1 || y > y1 ? -1 : (y - y0) * w + (x - x0));
  for (const c of doc.componentes) {
    if (ign.has(c.id) || c.tipo === 'NOTA') continue;
    const b = geometria(c).cuerpo;
    const bx0 = c.x + b[0];
    const by0 = c.y + b[1];
    const bx1 = c.x + b[2];
    const by1 = c.y + b[3];
    for (let y = Math.floor(by0) - 1; y <= Math.ceil(by1) + 1; y++)
      for (let x = Math.floor(bx0) - 1; x <= Math.ceil(bx1) + 1; x++) {
        const i = idx(x, y);
        if (i < 0) continue;
        const dentro = x > bx0 - 0.15 && x < bx1 + 0.15 && y > by0 - 0.15 && y < by1 + 0.15;
        const cerca = x > bx0 - 1 && x < bx1 + 1 && y > by0 - 1 && y < by1 + 1;
        if (dentro) mapa.cuerpo[i] = 1;
        else if (cerca && !mapa.cuerpo[i]) mapa.cuerpo[i] = 2;
      }
  }
  for (const c of doc.componentes) {
    if (ign.has(c.id)) continue;
    for (const p of pinesMundo(c)) {
      const i = idx(Math.round(p.x), Math.round(p.y));
      if (i >= 0 && Math.abs(p.x - Math.round(p.x)) < 1e-6 && Math.abs(p.y - Math.round(p.y)) < 1e-6) mapa.cable[i]! |= 4;
    }
  }
  for (const c of doc.cables) {
    if (ign.has(c.id)) continue;
    const [ax, ay, bx, by] = c.p;
    const hz = Math.abs(ay - by) < 1e-9;
    const vt = Math.abs(ax - bx) < 1e-9;
    for (const [ex, ey] of [
      [ax, ay],
      [bx, by],
    ] as P[]) {
      const i = idx(Math.round(ex), Math.round(ey));
      if (i >= 0) mapa.cable[i]! |= 4;
    }
    if (hz) {
      const y = Math.round(ay);
      for (let x = Math.ceil(Math.min(ax, bx)); x <= Math.floor(Math.max(ax, bx)); x++) {
        const i = idx(x, y);
        if (i >= 0) mapa.cable[i]! |= 1;
      }
    } else if (vt) {
      const x = Math.round(ax);
      for (let y = Math.ceil(Math.min(ay, by)); y <= Math.floor(Math.max(ay, by)); y++) {
        const i = idx(x, y);
        if (i >= 0) mapa.cable[i]! |= 2;
      }
    }
  }
  return mapa;
}

/** A small binary heap of [cost, state]. */
class Monticulo {
  private c: number[] = [];
  private s: number[] = [];
  get vacio() {
    return !this.c.length;
  }
  poner(coste: number, estado: number) {
    const c = this.c;
    const s = this.s;
    c.push(coste);
    s.push(estado);
    let i = c.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (c[p]! <= c[i]!) break;
      [c[p], c[i]] = [c[i]!, c[p]!];
      [s[p], s[i]] = [s[i]!, s[p]!];
      i = p;
    }
  }
  quitar(): [number, number] {
    const c = this.c;
    const s = this.s;
    const r: [number, number] = [c[0]!, s[0]!];
    const uc = c.pop()!;
    const us = s.pop()!;
    if (c.length) {
      c[0] = uc;
      s[0] = us;
      let i = 0;
      for (;;) {
        const a = 2 * i + 1;
        const b = a + 1;
        let m = i;
        if (a < c.length && c[a]! < c[m]!) m = a;
        if (b < c.length && c[b]! < c[m]!) m = b;
        if (m === i) break;
        [c[m], c[i]] = [c[i]!, c[m]!];
        [s[m], s[i]] = [s[i]!, s[m]!];
        i = m;
      }
    }
    return r;
  }
}

/**
 * Orthogonal path from `a` to the nearest of `destinos` (grid points), as a list of corner points (a first,
 * the reached destination last), or null when there is none. `a` and the destinations may be pins or wire
 * points: they are allowed even though they are «occupied».
 */
export function ruta(doc: DocumentoEsquema, a: P, destinos: P[], op: OpcionesRuta = {}): P[] | null {
  const A: P = [Math.round(a[0]), Math.round(a[1])];
  const D = destinos.map((d) => [Math.round(d[0]), Math.round(d[1])] as P);
  if (!D.length) return null;
  if (D.some((d) => d[0] === A[0] && d[1] === A[1])) return [A];
  const m = construirMapa(doc, [A, ...D], op);
  const { x0, y0, w, h } = m;
  const destino = new Set(D.map((d) => k(d[0], d[1])));
  const N = w * h;
  const dist = new Float64Array(N * 4).fill(Infinity);
  const prev = new Int32Array(N * 4).fill(-1);
  const heap = new Monticulo();
  const ia = (A[1] - y0) * w + (A[0] - x0);
  for (let d = 0; d < 4; d++) {
    const s = ia * 4 + d;
    // Leaving against a pin's lead (into its own body) is expensive.
    const contra = op.salida && DIRS[d]![0] === -op.salida[0] && DIRS[d]![1] === -op.salida[1];
    const lado = op.salida && !contra && !(DIRS[d]![0] === op.salida[0] && DIRS[d]![1] === op.salida[1]);
    dist[s] = contra ? 6 : lado ? 0.9 : 0;
    heap.poner(dist[s]!, s);
  }
  let fin = -1;
  while (!heap.vacio) {
    const [c, s] = heap.quitar();
    if (c > dist[s]!) continue;
    const i = s >> 2;
    const d = s & 3;
    const x = (i % w) + x0;
    const y = Math.floor(i / w) + y0;
    if (i !== ia && destino.has(k(x, y))) {
      fin = s;
      break;
    }
    for (let nd = 0; nd < 4; nd++) {
      if (((nd + 2) & 3) === d && i !== ia) continue;
      const [dx, dy] = DIRS[nd]!;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < x0 || ny < y0 || nx >= x0 + w || ny >= y0 + h) continue;
      const j = (ny - y0) * w + (nx - x0);
      const esDestino = destino.has(k(nx, ny));
      // Turning on a point: the corner must be free of other wires (it would connect to them).
      const gira = nd !== d && i !== ia;
      if (gira && m.cable[i]! & 3) continue;
      if (!esDestino) {
        if (m.cuerpo[j] === 1) continue;
        const cb = m.cable[j]!;
        if (cb & 4) continue;
        // Running along a wire is forbidden; crossing it at a right angle is allowed.
        if (dx !== 0 && cb & 1) continue;
        if (dy !== 0 && cb & 2) continue;
      } else if (m.cuerpo[j] === 1 && !(m.cable[j]! & 4)) {
        // A destination inside a body that is not a pin: not reachable this way.
        continue;
      }
      let coste = 1 + (gira ? 1.2 : 0) + (m.cuerpo[j] === 2 ? 0.35 : 0) + (m.cable[j]! & 3 && !esDestino ? 1.5 : 0);
      if (esDestino && m.cable[j]! & 3 && !(m.cable[j]! & 4)) {
        // Ending on a wire's inside: only at a right angle (a T junction), not along it.
        if ((dx !== 0 && m.cable[j]! & 1) || (dy !== 0 && m.cable[j]! & 2)) continue;
        coste += 0.2;
      }
      const ns = j * 4 + nd;
      const nc = c + coste;
      if (nc < dist[ns]!) {
        dist[ns] = nc;
        prev[ns] = s;
        heap.poner(nc, ns);
      }
    }
  }
  if (fin < 0) return null;
  const puntos: P[] = [];
  for (let s = fin; s >= 0; s = prev[s]!) {
    const i = s >> 2;
    puntos.push([(i % w) + x0, Math.floor(i / w) + y0]);
    if ((s >> 2) === ia && prev[s]! < 0) break;
  }
  puntos.reverse();
  // Keep the corners only.
  const esquinas: P[] = [puntos[0]!];
  for (let i = 1; i < puntos.length - 1; i++) {
    const p = puntos[i - 1]!;
    const q = puntos[i]!;
    const r = puntos[i + 1]!;
    if ((q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]) !== 0) esquinas.push(q);
  }
  if (puntos.length > 1) esquinas.push(puntos[puntos.length - 1]!);
  return esquinas;
}

/** The straight runs of a path. */
export function tramos(p: P[]): Seg[] {
  const res: Seg[] = [];
  for (let i = 0; i + 1 < p.length; i++) res.push([p[i]![0], p[i]![1], p[i + 1]![0], p[i + 1]![1]]);
  return res;
}

/** Every grid point of a net's wires and pins (destinations to join it anywhere). */
export function puntosDeRed(doc: DocumentoEsquema, pines: string[], cables: string[]): P[] {
  const res: P[] = [];
  const vistos = new Set<string>();
  const poner = (x: number, y: number) => {
    if (Math.abs(x - Math.round(x)) > 1e-6 || Math.abs(y - Math.round(y)) > 1e-6) return;
    const kk = k(Math.round(x), Math.round(y));
    if (vistos.has(kk)) return;
    vistos.add(kk);
    res.push([Math.round(x), Math.round(y)]);
  };
  const porId = new Map(doc.componentes.map((c) => [c.id, c] as [string, Componente]));
  for (const pk of pines) {
    const [id, ...r] = pk.split('.');
    const c = porId.get(id!);
    if (!c) continue;
    const nombre = r.join('.');
    const p = pinesMundo(c).find((q) => q.nombre === nombre);
    if (p) poner(p.x, p.y);
  }
  const cb = new Map(doc.cables.map((w) => [w.id, w] as [string, Cable]));
  for (const id of cables) {
    const wv = cb.get(id);
    if (!wv) continue;
    const [ax, ay, bx, by] = wv.p;
    const n = Math.round(Math.max(Math.abs(bx - ax), Math.abs(by - ay)));
    for (let i = 0; i <= n; i++) poner(ax + ((bx - ax) * i) / (n || 1), ay + ((by - ay) * i) / (n || 1));
  }
  return res;
}

/**
 * A free place for a part near (x, y): its box, one unit around, touches no wire, pin or body of the others.
 * Returns its origin or null within `radio` units.
 */
export function huecoLibre(doc: DocumentoEsquema, c: Componente, cerca: P, radio = 14, ignorar = new Set<string>()): P | null {
  const ocupado = new Set<string>();
  const marcar = (x: number, y: number) => ocupado.add(k(Math.round(x), Math.round(y)));
  for (const w of doc.cables) {
    if (ignorar.has(w.id)) continue;
    const [ax, ay, bx, by] = w.p;
    const n = Math.round(Math.max(Math.abs(bx - ax), Math.abs(by - ay)));
    for (let i = 0; i <= n; i++) marcar(ax + ((bx - ax) * i) / (n || 1), ay + ((by - ay) * i) / (n || 1));
  }
  const cajas: [number, number, number, number][] = [];
  for (const o of doc.componentes) {
    if (ignorar.has(o.id) || o.id === c.id) continue;
    for (const p of pinesMundo(o)) marcar(p.x, p.y);
    cajas.push(cajaMundo(o));
  }
  const g = geometria(c).caja;
  const prueba = (x: number, y: number) => {
    const b: [number, number, number, number] = [x + g[0] - 1, y + g[1] - 1, x + g[2] + 1, y + g[3] + 1];
    for (let yy = Math.ceil(b[1]); yy <= Math.floor(b[3]); yy++) for (let xx = Math.ceil(b[0]); xx <= Math.floor(b[2]); xx++) if (ocupado.has(k(xx, yy))) return false;
    return !cajas.some((o) => o[0] < b[2] && o[2] > b[0] && o[1] < b[3] && o[3] > b[1]);
  };
  const x0 = Math.round(cerca[0] - (g[0] + g[2]) / 2);
  const y0 = Math.round(cerca[1] - (g[1] + g[3]) / 2);
  for (let r = 0; r <= radio; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (prueba(x0 + dx, y0 + dy)) return [x0 + dx, y0 + dy];
      }
  return null;
}
