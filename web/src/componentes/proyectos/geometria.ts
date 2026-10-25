// Board geometry built once per board from the JSON: Path2D per copper layer and net (zone fills, tracks by
// width, pads, vias), mask openings, drills, silkscreen and fabrication outlines, plus hit testing. Units: u =
// 0.01 mm, board frame (origin top-left of the outline, y down). Used by the 2D view and by the 3D textures.

import { decodificar, aPlaca, esquinasHuella, PAD_B, PAD_F, PAD_MASK_B, PAD_MASK_F, PAD_NPTH, PAD_PTH, type DatosPlaca, type Pad } from './datos';

export type Lado = 'F' | 'B';

export interface CapaCobre {
  /** net → filled zone polygons (even-odd). */
  zonas: Map<number, Path2D>;
  /** stroke width (u) → net → track path. */
  pistas: Map<number, Map<number, Path2D>>;
  /** net → pad shapes on this layer. */
  pads: Map<number, Path2D>;
  /** net → via pads. */
  vias: Map<number, Path2D>;
}

export interface Geometria {
  ancho: number;
  alto: number;
  contorno: Path2D;
  contornoPts: Float64Array;
  cobre: Record<Lado, CapaCobre>;
  /** Mask openings per side (pads with the side's mask layer). */
  aberturas: Record<Lado, Path2D>;
  /** Every drill (plated pads, vias, unplated holes). */
  taladros: Path2D;
  /** Unplated holes only. */
  taladrosNP: Path2D;
  /** Plated drills as [x, y, w, h, rot] (u), for the 3D barrels. */
  barriles: [number, number, number, number, number][];
  serigrafia: Partial<Record<Lado, { trazos: [number, Path2D][]; rellenos: Path2D; vacia: boolean }>>;
  fab: Record<Lado, Path2D>;
  areas: { camino: Path2D; capas: string[]; nombre: string }[];
  /** Zone polygons per net and layer, for hit testing. */
  zonasRed: { l: Lado; r: number; camino: Path2D; caja: [number, number, number, number] }[];
}

/** Outline points of a pad (u, board frame), grown by `crecer`. */
export function contornoPad(p: Pad, crecer = 0): [number, number][] {
  const forma = p[2];
  const w = p[5] + 2 * crecer;
  const h = p[6] + 2 * crecer;
  const pts: [number, number][] = [];
  const n = 8;
  if (forma === 'c') {
    const r = w / 2;
    for (let i = 0; i < 32; i++) {
      const t = (2 * Math.PI * i) / 32;
      pts.push([r * Math.cos(t), r * Math.sin(t)]);
    }
  } else {
    let r = 0;
    if (forma === 'o') r = Math.min(w, h) / 2;
    else if (forma === 'rr') r = Math.min(Math.min(w, h) * p[8] + crecer, Math.min(w, h) / 2);
    const hw = w / 2;
    const hh = h / 2;
    if (r <= 0.5) {
      pts.push([-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]);
    } else {
      const esq: [number, number, number][] = [
        [hw - r, -hh + r, -90],
        [hw - r, hh - r, 0],
        [-hw + r, hh - r, 90],
        [-hw + r, -hh + r, 180],
      ];
      for (const [cx, cy, a0] of esq) {
        for (let i = 0; i <= n; i++) {
          const t = ((a0 + (90 * i) / n) * Math.PI) / 180;
          pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
        }
      }
    }
  }
  const a = (p[7] * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return pts.map(([x, y]) => [p[3] + x * c + y * s, p[4] - x * s + y * c]);
}

function poligono(camino: Path2D, pts: [number, number][]): void {
  camino.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) camino.lineTo(pts[i]![0], pts[i]![1]);
  camino.closePath();
}

/** A drill (round or slot) as a path. */
function taladro(camino: Path2D, x: number, y: number, w: number, h: number, rot: number): void {
  if (Math.abs(w - h) < 1) {
    camino.moveTo(x + w / 2, y);
    camino.arc(x, y, w / 2, 0, Math.PI * 2);
    return;
  }
  const p: Pad = [0, '', 'o', x, y, w, h, rot, 0, 0, 0, 0, -1, ''];
  poligono(camino, contornoPad(p));
}

function obtener<K, V>(m: Map<K, V>, k: K, crear: () => V): V {
  let v = m.get(k);
  if (v === undefined) {
    v = crear();
    m.set(k, v);
  }
  return v;
}

const nueva = () => new Path2D();

export function construirGeometria(d: DatosPlaca): Geometria {
  const ancho = d.placa.ancho;
  const alto = d.placa.alto;
  const contornoPts = decodificar(d.placa.contorno);
  const contorno = new Path2D();
  for (let i = 0; i < contornoPts.length; i += 2) {
    if (i === 0) contorno.moveTo(contornoPts[0]!, contornoPts[1]!);
    else contorno.lineTo(contornoPts[i]!, contornoPts[i + 1]!);
  }
  contorno.closePath();
  const capa = (): CapaCobre => ({ zonas: new Map(), pistas: new Map(), pads: new Map(), vias: new Map() });
  const cobre: Record<Lado, CapaCobre> = { F: capa(), B: capa() };
  const zonasRed: Geometria['zonasRed'] = [];
  for (const z of d.zonas) {
    const pts = decodificar(z.p);
    const c = obtener(cobre[z.l].zonas, z.r, nueva);
    const sola = new Path2D();
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i]!;
      const y = pts[i + 1]!;
      if (i === 0) {
        c.moveTo(x, y);
        sola.moveTo(x, y);
      } else {
        c.lineTo(x, y);
        sola.lineTo(x, y);
      }
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    c.closePath();
    sola.closePath();
    zonasRed.push({ l: z.l, r: z.r, camino: sola, caja: [x0, y0, x1, y1] });
  }
  for (const lado of ['F', 'B'] as const) {
    const t = d.pistas[lado] ?? [];
    for (let i = 0; i < t.length; i += 6) {
      const porRed = obtener(cobre[lado].pistas, t[i + 1]!, () => new Map<number, Path2D>());
      const c = obtener(porRed, t[i]!, nueva);
      c.moveTo(t[i + 2]!, t[i + 3]!);
      c.lineTo(t[i + 4]!, t[i + 5]!);
    }
  }
  const aberturas: Record<Lado, Path2D> = { F: new Path2D(), B: new Path2D() };
  const taladros = new Path2D();
  const taladrosNP = new Path2D();
  const barriles: Geometria['barriles'] = [];
  for (const p of d.pads) {
    const pts = contornoPad(p);
    const fl = p[11];
    if (fl & PAD_F && !(fl & PAD_NPTH)) poligono(obtener(cobre.F.pads, p[12], nueva), pts);
    if (fl & PAD_B && !(fl & PAD_NPTH)) poligono(obtener(cobre.B.pads, p[12], nueva), pts);
    if (fl & PAD_MASK_F) poligono(aberturas.F, fl & PAD_NPTH ? contornoPad(p) : pts);
    if (fl & PAD_MASK_B) poligono(aberturas.B, fl & PAD_NPTH ? contornoPad(p) : pts);
    if (p[9] > 0) {
      taladro(taladros, p[3], p[4], p[9], p[10], p[7]);
      if (fl & PAD_NPTH) taladro(taladrosNP, p[3], p[4], p[9], p[10], p[7]);
      if (fl & PAD_PTH) barriles.push([p[3], p[4], p[9], p[10], p[7]]);
    }
  }
  const v = d.vias;
  for (let i = 0; i < v.length; i += 5) {
    const [r, x, y, dd, dr] = [v[i]!, v[i + 1]!, v[i + 2]!, v[i + 3]!, v[i + 4]!];
    for (const lado of ['F', 'B'] as const) {
      const c = obtener(cobre[lado].vias, r, nueva);
      c.moveTo(x + dd / 2, y);
      c.arc(x, y, dd / 2, 0, Math.PI * 2);
    }
    taladros.moveTo(x + dr / 2, y);
    taladros.arc(x, y, dr / 2, 0, Math.PI * 2);
    barriles.push([x, y, dr, dr, 0]);
  }
  const serigrafia: Geometria['serigrafia'] = {};
  for (const lado of ['F', 'B'] as const) {
    const s = d.serigrafia[lado];
    if (!s) continue;
    const trazos: [number, Path2D][] = [];
    for (const grupo of s.lineas) {
      const w = grupo[0]! * 100;
      const c = new Path2D();
      let i = 1;
      while (i < grupo.length) {
        const n = grupo[i]!;
        let x = grupo[i + 1]!;
        let y = grupo[i + 2]!;
        c.moveTo(x, y);
        for (let k = 1; k < n; k++) {
          x += grupo[i + 1 + 2 * k]!;
          y += grupo[i + 2 + 2 * k]!;
          c.lineTo(x, y);
        }
        if (n === 1) c.lineTo(x + 0.01, y);
        i += 1 + 2 * n;
      }
      trazos.push([w, c]);
    }
    const rellenos = new Path2D();
    for (const r of s.rellenos) {
      const pts = decodificar(r);
      for (let k = 0; k < pts.length; k += 2) {
        if (k === 0) rellenos.moveTo(pts[0]!, pts[1]!);
        else rellenos.lineTo(pts[k]!, pts[k + 1]!);
      }
      rellenos.closePath();
    }
    for (const [cx, cy, r, w] of s.circulos) {
      if (w > 0) {
        const c = new Path2D();
        c.moveTo(cx + r, cy);
        c.arc(cx, cy, r, 0, Math.PI * 2);
        trazos.push([w, c]);
      } else {
        rellenos.moveTo(cx + r, cy);
        rellenos.arc(cx, cy, r, 0, Math.PI * 2);
      }
    }
    serigrafia[lado] = { trazos, rellenos, vacia: !s.lineas.length && !s.rellenos.length && !s.circulos.length };
  }
  const fab: Record<Lado, Path2D> = { F: new Path2D(), B: new Path2D() };
  for (const h of d.huellas) {
    const c = fab[h.lado];
    for (const g of h.fab) {
      if (g[0] === 'c') {
        const [cx, cy] = aPlaca(h, g[1] as number, g[2] as number);
        const r = g[3] as number;
        c.moveTo(cx + r, cy);
        c.arc(cx, cy, r, 0, Math.PI * 2);
      } else {
        for (let k = 1; k + 1 < g.length; k += 2) {
          const [x, y] = aPlaca(h, g[k] as number, g[k + 1] as number);
          if (k === 1) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
      }
    }
  }
  const areas = d.areas.map((a) => {
    const pts = decodificar(a.p);
    const c = new Path2D();
    for (let k = 0; k < pts.length; k += 2) {
      if (k === 0) c.moveTo(pts[0]!, pts[1]!);
      else c.lineTo(pts[k]!, pts[k + 1]!);
    }
    c.closePath();
    return { camino: c, capas: a.capas, nombre: a.nombre };
  });
  return { ancho, alto, contorno, contornoPts, cobre, aberturas, taladros, taladrosNP, barriles, serigrafia, fab, areas, zonasRed };
}

// ------------------------------------------------------------------ hit testing

export type Impacto2D =
  | { tipo: 'pad'; pad: number; huella: number; red: number }
  | { tipo: 'pista'; red: number; lado: Lado }
  | { tipo: 'via'; red: number }
  | { tipo: 'zona'; red: number; lado: Lado }
  | { tipo: 'huella'; huella: number };

function distSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x1 + t * dx - px, y1 + t * dy - py);
}

function dentro(pts: [number, number][], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) c = !c;
  }
  return c;
}

let ctxPrueba: CanvasRenderingContext2D | null = null;

function prueba(): CanvasRenderingContext2D | null {
  if (!ctxPrueba && typeof document !== 'undefined') ctxPrueba = document.createElement('canvas').getContext('2d');
  return ctxPrueba;
}

/**
 * What is under the board point (x, y) seen from side `lado` (u); `tol` in u. Visible copper layers decide what
 * can be hit; parts are tested by their body box (smallest first) when no copper is under the point.
 */
export function impacto(d: DatosPlaca, g: Geometria, x: number, y: number, tol: number, lado: Lado, visibles: Record<Lado, boolean>, componentes = true): Impacto2D | null {
  let mejor: Impacto2D | null = null;
  let dmin = Infinity;
  for (let i = 0; i < d.pads.length; i++) {
    const p = d.pads[i]!;
    const fl = p[11];
    if (!((fl & PAD_F && visibles.F) || (fl & PAD_B && visibles.B) || fl & PAD_NPTH)) continue;
    const r = Math.max(p[5], p[6]) / 2 + tol;
    const dd = Math.hypot(p[3] - x, p[4] - y);
    if (dd > r) continue;
    const dentroPad = dentro(contornoPad(p, tol * 0.5), x, y);
    if (dentroPad && dd < dmin) {
      dmin = dd;
      mejor = { tipo: 'pad', pad: i, huella: p[0], red: p[12] };
    }
  }
  if (mejor) return mejor;
  const v = d.vias;
  for (let i = 0; i < v.length; i += 5) {
    if (Math.hypot(v[i + 1]! - x, v[i + 2]! - y) <= v[i + 3]! / 2 + tol) return { tipo: 'via', red: v[i]! };
  }
  const orden: Lado[] = lado === 'F' ? ['F', 'B'] : ['B', 'F'];
  for (const l of orden) {
    if (!visibles[l]) continue;
    const t = d.pistas[l] ?? [];
    let red = -1;
    let dm = Infinity;
    for (let i = 0; i < t.length; i += 6) {
      const dd = distSeg(x, y, t[i + 2]!, t[i + 3]!, t[i + 4]!, t[i + 5]!) - t[i + 1]! / 2;
      if (dd < tol && dd < dm) {
        dm = dd;
        red = t[i]!;
      }
    }
    if (red >= 0) return { tipo: 'pista', red, lado: l };
  }
  if (componentes) {
    let area = Infinity;
    let h = -1;
    for (let i = 0; i < d.huellas.length; i++) {
      const hu = d.huellas[i]!;
      if (hu.t === 'mec') continue;
      const e = esquinasHuella(hu);
      if (dentro(e, x, y)) {
        const [x0, y0, x1, y1] = hu.m.caja;
        const a = (x1 - x0) * (y1 - y0);
        if (a < area) {
          area = a;
          h = i;
        }
      }
    }
    if (h >= 0) return { tipo: 'huella', huella: h };
  }
  const ctx = prueba();
  if (ctx) {
    for (const l of orden) {
      if (!visibles[l]) continue;
      for (const z of g.zonasRed) {
        if (z.l !== l || x < z.caja[0] || x > z.caja[2] || y < z.caja[1] || y > z.caja[3]) continue;
        if (ctx.isPointInPath(z.camino, x, y, 'evenodd')) return { tipo: 'zona', red: z.r, lado: l };
      }
    }
  }
  return null;
}

/** Box (u) of a net's copper, or null. */
export function cajaRed(d: DatosPlaca, red: number): [number, number, number, number] | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const mas = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  for (const p of d.pads) if (p[12] === red) mas(p[3], p[4]);
  for (const l of ['F', 'B']) {
    const t = d.pistas[l] ?? [];
    for (let i = 0; i < t.length; i += 6) {
      if (t[i] !== red) continue;
      mas(t[i + 2]!, t[i + 3]!);
      mas(t[i + 4]!, t[i + 5]!);
    }
  }
  return x0 === Infinity ? null : [x0, y0, x1, y1];
}

export function cajaHuella(d: DatosPlaca, i: number): [number, number, number, number] {
  const e = esquinasHuella(d.huellas[i]!);
  const xs = e.map((p) => p[0]);
  const ys = e.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
