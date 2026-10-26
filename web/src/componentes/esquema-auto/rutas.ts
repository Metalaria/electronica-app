// Orthogonal wire router on the unit grid: each net is grown as a Steiner tree (Dijkstra from the wires
// already drawn to the nearest unconnected pin), with costs for length, bends, crossings and labels. Wires never
// overlap, never touch another net except by crossing straight at right angles, never pass through a part or a
// pin. A net that cannot be routed reasonably is joined by net labels instead.

import type { Pt, Rect } from './simbolos.ts';

export interface PinRuta {
  x: number;
  y: number;
  dx: number;
  dy: number;
  red: number;
}

export interface Obstaculos {
  /** Closed rectangles wires cannot enter (bodies, ground and supply symbols). */
  cuerpos: Rect[];
  /** Rectangles that wires should avoid (labels). */
  blandos: Rect[];
}

export interface ResultadoRutas {
  /** Wire edges of each net, as unit segments merged into straight runs: [x0, y0, x1, y1]. */
  tramos: [number, number, number, number][][];
  /** Pins (indices into the input array) that are joined by a net label instead of a wire. */
  etiquetas: number[];
  cruces: number;
  longitud: number;
}

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

const C_PASO = 1;
const C_CODO = 2.6;
const C_CRUCE = 7;
const C_BLANDO = 3;
const C_VECINO = 0.35;

class Monticulo {
  private c: number[] = [];
  private v: number[] = [];
  get size(): number {
    return this.c.length;
  }
  push(coste: number, val: number): void {
    const c = this.c;
    const v = this.v;
    c.push(coste);
    v.push(val);
    let i = c.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (c[p]! <= coste) break;
      c[i] = c[p]!;
      v[i] = v[p]!;
      i = p;
    }
    c[i] = coste;
    v[i] = val;
  }
  /** Cost of the last popped entry (pop() returns its value: no array per pop). */
  coste = 0;
  pop(): number {
    const c = this.c;
    const v = this.v;
    const rc = c[0]!;
    const rv = v[0]!;
    const lc = c.pop()!;
    const lv = v.pop()!;
    const n = c.length;
    if (n) {
      let i = 0;
      for (;;) {
        let m = 2 * i + 1;
        if (m >= n) break;
        if (m + 1 < n && c[m + 1]! < c[m]!) m++;
        if (c[m]! >= lc) break;
        c[i] = c[m]!;
        v[i] = v[m]!;
        i = m;
      }
      c[i] = lc;
      v[i] = lv;
    }
    this.coste = rc;
    return rv;
  }
}

export function enrutar(
  pines: PinRuta[],
  nRedes: number,
  obs: Obstaculos,
  orden?: number[],
  etiquetar?: Set<number>,
  pinesEtiqueta?: Set<number>,
): ResultadoRutas {
  // Grid bounds.
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const ampliar = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  for (const p of pines) ampliar(p.x, p.y);
  for (const r of obs.cuerpos) {
    ampliar(r[0], r[1]);
    ampliar(r[2], r[3]);
  }
  x0 = Math.floor(x0) - 3;
  y0 = Math.floor(y0) - 3;
  x1 = Math.ceil(x1) + 3;
  y1 = Math.ceil(y1) + 3;
  const W = x1 - x0 + 1;
  const H = y1 - y0 + 1;
  const N = W * H;
  const id = (x: number, y: number) => (y - y0) * W + (x - x0);

  const bloq = new Uint8Array(N);
  const bloqH = new Uint8Array(N); // edge (x, y) → (x + 1, y)
  const bloqV = new Uint8Array(N); // edge (x, y) → (x, y + 1)
  const blando = new Float32Array(N);
  const pinEn = new Int32Array(N).fill(-1); // net of a pin at that point (−2: several nets: never)
  const e = 1e-6;
  for (const r of obs.cuerpos) {
    for (let y = Math.ceil(r[1] - e); y <= Math.floor(r[3] + e); y++)
      for (let x = Math.ceil(r[0] - e); x <= Math.floor(r[2] + e); x++) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) bloq[id(x, y)] = 1;
    // Edges crossing the rectangle (also between grid points).
    for (let y = Math.ceil(r[1] - e); y <= Math.floor(r[3] + e); y++)
      for (let x = Math.floor(r[0]); x < Math.ceil(r[2]); x++) if (x >= x0 && x < x1 && y >= y0 && y <= y1 && x < r[2] - e && x + 1 > r[0] + e) bloqH[id(x, y)] = 1;
    for (let x = Math.ceil(r[0] - e); x <= Math.floor(r[2] + e); x++)
      for (let y = Math.floor(r[1]); y < Math.ceil(r[3]); y++) if (x >= x0 && x <= x1 && y >= y0 && y < y1 && y < r[3] - e && y + 1 > r[1] + e) bloqV[id(x, y)] = 1;
  }
  for (const r of obs.blandos)
    for (let y = Math.ceil(r[1] - 0.1); y <= Math.floor(r[3] + 0.1); y++)
      for (let x = Math.ceil(r[0] - 0.1); x <= Math.floor(r[2] + 0.1); x++) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) blando[id(x, y)] = C_BLANDO;
  for (const p of pines) {
    const k = id(p.x, p.y);
    pinEn[k] = pinEn[k] === -1 || pinEn[k] === p.red ? p.red : -2;
    bloq[k] = 0;
  }

  // Wire occupancy.
  const usoH = new Int32Array(N).fill(-1);
  const usoV = new Int32Array(N).fill(-1);
  const usoP = new Int32Array(N).fill(-1); // net with a wire through the point
  const nodoP = new Uint8Array(N); // 1 when that wire bends, ends or branches there (no crossing allowed)

  const pinesDe: number[][] = Array.from({ length: nRedes }, () => []);
  // Pins joined by a label of their own (the far ends of a net whose near pins are wired) are not routed.
  const etiquetasFijas: number[] = [];
  pines.forEach((p, i) => {
    if (pinesEtiqueta?.has(i)) etiquetasFijas.push(i);
    else pinesDe[p.red]?.push(i);
  });

  // Net order: short nets first.
  const extension = (k: number) => {
    const ps = pinesDe[k]!.map((i) => pines[i]!);
    if (ps.length < 2) return 0;
    const xs = ps.map((p) => p.x);
    const ys = ps.map((p) => p.y);
    return Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys) + ps.length * 0.5;
  };
  const redes = orden ?? [...Array(nRedes).keys()].sort((a, b) => extension(a) - extension(b) || a - b);

  const etiquetas: number[] = [...etiquetasFijas];
  // A net left with a single wired pin is labelled there too.
  for (const ps of pinesDe) if (ps.length === 1 && etiquetasFijas.some((i) => pines[i]!.red === pines[ps[0]!]!.red)) etiquetas.push(ps[0]!);
  const dist = new Float64Array(N * 4);
  const previo = new Int32Array(N * 4);
  // dist[s] is valid only when sello[s] === vuelta (no refill of the whole array per search).
  const sello = new Int32Array(N * 4);
  let vuelta = 0;
  const D = (s: number) => (sello[s] === vuelta ? dist[s]! : Infinity);
  const enArbol = new Uint8Array(N);
  // Target points of the current search: esObjetivo[a] === vuelta (a Map lookup per neighbour was the
  // router's hottest line).
  const esObjetivo = new Int32Array(N);
  let cruces = 0;
  let longitud = 0;
  const aristas: [number, number][][] = Array.from({ length: nRedes }, () => []);

  const usoArista = (a: number, d: number): number => {
    // a: point index, d: direction → net using the edge or −1.
    const x = (a % W) + x0;
    const y = Math.floor(a / W) + y0;
    if (d === 0) return usoH[a]!;
    if (d === 2) return x - 1 >= x0 ? usoH[a - 1]! : -1;
    if (d === 1) return usoV[a]!;
    return y - 1 >= y0 ? usoV[a - W]! : -1;
  };
  const bloqArista = (a: number, d: number): boolean => {
    if (d === 0) return !!bloqH[a];
    if (d === 2) return !!bloqH[a - 1];
    if (d === 1) return !!bloqV[a];
    return !!bloqV[a - W];
  };
  /** The other net passes straight through `q` along the axis perpendicular to `d`. */
  const cruzable = (q: number, d: number): boolean => {
    if (nodoP[q]) return false;
    const otra = usoP[q]!;
    const horizontal = d === 0 || d === 2;
    return usoArista(q, horizontal ? 1 : 0) === otra && usoArista(q, horizontal ? 3 : 2) === otra;
  };

  for (const k of redes) {
    const ps = pinesDe[k]!;
    if (ps.length < 2) continue;
    // Nets that read better as labels (a clock, an enable): a label at every pin, no wire.
    if (etiquetar?.has(k)) {
      for (const i of ps) etiquetas.push(i);
      continue;
    }
    enArbol.fill(0);
    const arbol: number[] = [];
    const conectado = new Set<number>();
    // Start from the pin closest to the others' centroid of the leftmost… simply the first pin.
    const p0 = ps[0]!;
    conectado.add(p0);
    const a0 = id(pines[p0]!.x, pines[p0]!.y);
    enArbol[a0] = 1;
    arbol.push(a0);
    // Pins sharing the point of p0 are connected already.
    for (const i of ps) if (i !== p0 && id(pines[i]!.x, pines[i]!.y) === a0) conectado.add(i);

    while (conectado.size < ps.length) {
      // Target points.
      const objetivo = new Map<number, number[]>();
      for (const i of ps) {
        if (conectado.has(i)) continue;
        const a = id(pines[i]!.x, pines[i]!.y);
        if (enArbol[a]) {
          conectado.add(i);
          continue;
        }
        if (!objetivo.has(a)) objetivo.set(a, []);
        objetivo.get(a)!.push(i);
      }
      if (!objetivo.size) break;
      vuelta++;
      for (const a of objetivo.keys()) esObjetivo[a] = vuelta;
      const h = new Monticulo();
      for (const a of arbol) {
        for (let d = 0; d < 4; d++) {
          const s = a * 4 + d;
          // Start state: «arrived going d» so continuing straight costs no bend; any direction allowed.
          dist[s] = 0;
          sello[s] = vuelta;
          previo[s] = -1;
          h.push(0, s);
        }
      }
      let fin = -1;
      while (h.size) {
        const s = h.pop();
        const c = h.coste;
        if (c > D(s)) continue;
        const a = s >> 2;
        const d0 = s & 3;
        if (esObjetivo[a] === vuelta && !enArbol[a]) {
          fin = s;
          break;
        }
        const x = (a % W) + x0;
        const y = Math.floor(a / W) + y0;
        const cruzando = usoP[a]! >= 0 && usoP[a] !== k;
        for (let d = 0; d < 4; d++) {
          if (cruzando && d !== d0) continue;
          if (!enArbol[a] && d === ((d0 + 2) & 3)) continue;
          const nx = x + DX[d]!;
          const ny = y + DY[d]!;
          if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
          if (bloqArista(a, d)) continue;
          if (usoArista(a, d) >= 0) continue;
          const q = id(nx, ny);
          if (bloq[q]) continue;
          if (enArbol[q]) continue;
          const pq = pinEn[q]!;
          if (pq !== -1 && !(pq === k && esObjetivo[q] === vuelta)) continue;
          let coste = C_PASO + blando[q]!;
          const otra = usoP[q]!;
          if (otra >= 0 && otra !== k) {
            if (!cruzable(q, d) || esObjetivo[q] === vuelta) continue;
            coste += C_CRUCE;
          }
          if (enArbol[a] ? false : d !== d0) coste += C_CODO;
          // Leaving a pin backwards into nothing is fine, but prefer leaving along the pin direction.
          // Light penalty for running right next to another net's wire.
          for (let m = 0, dd = d === 0 || d === 2 ? 1 : 0; m < 2; m++, dd += 2) {
            const vx = nx + DX[dd]!;
            const vy = ny + DY[dd]!;
            if (vx >= x0 && vx <= x1 && vy >= y0 && vy <= y1) {
              const u = usoP[(vy - y0) * W + (vx - x0)]!;
              if (u >= 0 && u !== k) coste += C_VECINO;
            }
          }
          const ns = q * 4 + d;
          const nc = c + coste;
          if (nc < D(ns)) {
            dist[ns] = nc;
            sello[ns] = vuelta;
            previo[ns] = s;
            h.push(nc, ns);
          }
        }
      }
      if (fin < 0) {
        // Unreachable: every pin left is joined by labels (and one pin of the tree too).
        for (const lista of objetivo.values()) for (const i of lista) etiquetas.push(i), conectado.add(i);
        if (!etiquetas.includes(p0)) etiquetas.push(p0);
        break;
      }
      // Reconstruct.
      const camino: number[] = [];
      let s = fin;
      while (s >= 0) {
        camino.push(s >> 2);
        const p = previo[s]!;
        if (p < 0) break;
        s = p;
      }
      camino.reverse();
      const llegada = camino[camino.length - 1]!;
      const pinsLlegada = objetivo.get(llegada)!;
      // Too long a detour for what it joins: labels read better.
      const pa = pines[pinsLlegada[0]!]!;
      const inicio = camino[0]!;
      const ix = (inicio % W) + x0;
      const iy = Math.floor(inicio / W) + y0;
      const manh = Math.abs(pa.x - ix) + Math.abs(pa.y - iy);
      const largo = camino.length - 1;
      if (largo > 2.4 * manh + 14 && largo > 18) {
        for (const i of pinsLlegada) etiquetas.push(i), conectado.add(i);
        if (!etiquetas.includes(p0)) etiquetas.push(p0);
        continue;
      }
      // Commit.
      for (let i = 0; i + 1 < camino.length; i++) {
        const a = camino[i]!;
        const b = camino[i + 1]!;
        const ax = (a % W) + x0;
        const bx = (b % W) + x0;
        if (Math.abs(b - a) === 1 && Math.floor(a / W) === Math.floor(b / W)) usoH[Math.min(a, b)] = k;
        else usoV[Math.min(a, b)] = k;
        void ax;
        void bx;
        aristas[k]!.push([a, b]);
        longitud++;
      }
      for (let i = 0; i < camino.length; i++) {
        const a = camino[i]!;
        if (usoP[a]! >= 0 && usoP[a] !== k) cruces++;
        else {
          usoP[a] = k;
          const pr = camino[i - 1];
          const sg = camino[i + 1];
          const recto = pr != null && sg != null && sg - a === a - pr;
          if (!recto || enArbol[a] || pinEn[a] === k) nodoP[a] = 1;
        }
        if (!(usoP[a]! >= 0 && usoP[a] !== k)) {
          enArbol[a] = 1;
          arbol.push(a);
        }
      }
      for (const i of pinsLlegada) conectado.add(i);
    }
  }

  // Merge unit edges into straight runs per net.
  const tramos: [number, number, number, number][][] = aristas.map((lista) => {
    const res: [number, number, number, number][] = [];
    for (const [a, b] of lista) {
      const ax = (a % W) + x0;
      const ay = Math.floor(a / W) + y0;
      const bx = (b % W) + x0;
      const by = Math.floor(b / W) + y0;
      res.push([ax, ay, bx, by]);
    }
    return res;
  });
  return { tramos, etiquetas: [...new Set(etiquetas)], cruces, longitud };
}

/** Points of a polyline list where three or more wire ends or pins meet. */
export function puntoClave(x: number, y: number): string {
  return `${x},${y}`;
}

export type { Pt };
