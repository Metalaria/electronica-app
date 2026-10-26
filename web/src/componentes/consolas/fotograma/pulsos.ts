// Pulses that travel along the wires of the schematic, the tracks of the board or the copper of the photo, away
// from the part that drives the net. A net's segments are oriented once (shortest path over the segment graph
// from the driver's pins; segments not reached are oriented by straight distance) and cached; every frame each
// segment is stroked with a dash pattern whose offset continues the distance from the driver, so the dashes flow
// outwards along the whole net.

/** Oriented segments: x1, y1, x2, y2, distance from the source at (x1, y1). */
export type Tramos = Float64Array;

/**
 * `segs`: x1, y1, x2, y2 repeated (any units). `fuentes`: points of the driver's pins in the same units.
 * `tol`: snapping distance for joining segment ends.
 */
export function orientar(segs: ArrayLike<number>, fuentes: [number, number][], tol: number): Tramos {
  const n = Math.floor(segs.length / 4);
  const out = new Float64Array(n * 5);
  if (!n) return out;
  // nodes by snapped coordinates
  const clave = (x: number, y: number) => `${Math.round(x / tol)},${Math.round(y / tol)}`;
  const id = new Map<string, number>();
  const px: number[] = [];
  const py: number[] = [];
  const nodo = (x: number, y: number) => {
    const k = clave(x, y);
    let i = id.get(k);
    if (i === undefined) {
      i = px.length;
      id.set(k, i);
      px.push(x);
      py.push(y);
    }
    return i;
  };
  const ady: [number, number][][] = [];
  const extremos: [number, number][] = [];
  for (let s = 0; s < n; s++) {
    const a = nodo(segs[s * 4]!, segs[s * 4 + 1]!);
    const b = nodo(segs[s * 4 + 2]!, segs[s * 4 + 3]!);
    extremos.push([a, b]);
    const l = Math.hypot(segs[s * 4 + 2]! - segs[s * 4]!, segs[s * 4 + 3]! - segs[s * 4 + 1]!);
    (ady[a] ??= []).push([b, l]);
    (ady[b] ??= []).push([a, l]);
  }
  // sources: nodes near a driver pin (else the nearest node to each pin)
  const dist = new Float64Array(px.length).fill(Infinity);
  for (const [fx, fy] of fuentes) {
    let mejor = -1;
    let dm = Infinity;
    for (let i = 0; i < px.length; i++) {
      const d = Math.hypot(px[i]! - fx, py[i]! - fy);
      if (d < dm) {
        dm = d;
        mejor = i;
      }
      if (d <= tol * 1.5) dist[i] = Math.min(dist[i]!, d);
    }
    if (mejor >= 0 && dm > tol * 1.5) dist[mejor] = Math.min(dist[mejor]!, dm);
  }
  // Dijkstra (small graphs: a simple O(V²) scan is enough)
  const hecho = new Uint8Array(px.length);
  for (;;) {
    let u = -1;
    let du = Infinity;
    for (let i = 0; i < px.length; i++) if (!hecho[i] && dist[i]! < du) {
      du = dist[i]!;
      u = i;
    }
    if (u < 0) break;
    hecho[u] = 1;
    for (const [v, l] of ady[u] ?? []) if (du + l < dist[v]!) dist[v] = du + l;
  }
  const recta = (x: number, y: number) => {
    let d = Infinity;
    for (const [fx, fy] of fuentes) d = Math.min(d, Math.hypot(x - fx, y - fy));
    return d === Infinity ? 0 : d;
  };
  for (let s = 0; s < n; s++) {
    const [a, b] = extremos[s]!;
    let x1 = segs[s * 4]!;
    let y1 = segs[s * 4 + 1]!;
    let x2 = segs[s * 4 + 2]!;
    let y2 = segs[s * 4 + 3]!;
    let da = dist[a]!;
    let db = dist[b]!;
    if (!Number.isFinite(da) || !Number.isFinite(db)) {
      da = recta(x1, y1);
      db = recta(x2, y2);
    }
    if (db < da) {
      [x1, y1, x2, y2] = [x2, y2, x1, y1];
      da = db;
    }
    out.set([x1, y1, x2, y2, da], s * 5);
  }
  return out;
}

/** Path of every segment (for the glow under the dashes). */
export function camino(t: Tramos): Path2D {
  const p = new Path2D();
  for (let i = 0; i < t.length; i += 5) {
    p.moveTo(t[i]!, t[i + 1]!);
    p.lineTo(t[i + 2]!, t[i + 3]!);
  }
  return p;
}

export interface EstiloPulso {
  color: string;
  /** 0–1: how recently the net moved. */
  energia: number;
  /** Logic level: high lines bright, low lines dim, null = no level. */
  nivel: 0 | 1 | null;
  /** View scale: CSS px per unit. */
  k: number;
  /** Distance travelled by the pulses, in CSS px (grows with wall time). */
  avance: number;
  /** Line width of the glow, CSS px. */
  ancho: number;
  /** Device pixel ratio already in the context's transform. */
  dpr: number;
}

/** Draws one net: a glow along its segments and dashes flowing away from the driver. The context is in units. */
export function dibujarPulsos(ctx: CanvasRenderingContext2D, t: Tramos, p: Path2D, e: EstiloPulso): void {
  if (e.energia <= 0.02 || !t.length) return;
  const u = 1 / e.k; // units per CSS px
  const alto = e.nivel !== 0;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = e.color;
  // glow
  ctx.globalAlpha = (alto ? 0.34 : 0.18) * e.energia;
  ctx.lineWidth = e.ancho * 2.4 * u;
  ctx.stroke(p);
  ctx.globalAlpha = (alto ? 0.9 : 0.5) * e.energia;
  ctx.lineWidth = e.ancho * u;
  ctx.stroke(p);
  // dashes: only for lines that carry a 1 (or have no level); a 0 stays as a dim line
  if (alto) {
    const guion = 10 * u;
    const hueco = 14 * u;
    const periodo = guion + hueco;
    ctx.globalAlpha = Math.min(1, 0.4 + e.energia);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.2, e.ancho * 0.55) * u;
    ctx.setLineDash([guion, hueco]);
    const av = (e.avance * u) % periodo;
    for (let i = 0; i < t.length; i += 5) {
      ctx.lineDashOffset = -(av - (t[i + 4]! % periodo));
      ctx.beginPath();
      ctx.moveTo(t[i]!, t[i + 1]!);
      ctx.lineTo(t[i + 2]!, t[i + 3]!);
      ctx.stroke();
    }
  }
  ctx.restore();
}
