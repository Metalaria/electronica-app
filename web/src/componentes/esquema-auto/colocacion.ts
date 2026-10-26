// Placement of the parts of one connected circuit on the grid: simulated annealing over positions and
// orientations, with a cost that encodes how a textbook draws a schematic (short orthogonal connections, few
// bends and crossings, signal flowing left → right, grounds at the bottom and supplies at the top, sources
// upright). Ground and supply connections are local symbols, never wires, so they shape the layout through
// the direction of the pins they hang from.

import type { Dispositivo, Riel } from './modelo.ts';
import { esTierra } from './modelo.ts';
import { anchoTexto, girar, girarRect, simboloDe, variantes, type DefSimbolo, type Pt, type Rect } from './simbolos.ts';

export const TAM_ETQ = 0.42;
export const ALTO_LINEA = 0.5;

export type TipoPin = 'red' | 'tierra' | 'riel' | 'puerto';

export interface PinU {
  nombre: string;
  nodo: string;
  /** Index of the signal net in the component (−1 for ground and rails). */
  red: number;
  tipo: TipoPin;
  riel: Riel | null;
}

export interface PinGeo {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export interface Talon {
  /** Pin index in the unit. */
  pin: number;
  tipo: 'tierra' | 'riel';
  /** Polyline of the lead from the pin to the symbol (relative to the unit origin). */
  pata: Pt[];
  /** Attach point of the symbol (end of the lead) and the direction the symbol points to. */
  punto: Pt;
  dir: Pt;
  rect: Rect;
  etq: Rect | null;
}

export interface VarU {
  def: DefSimbolo;
  o: number;
  coste: number;
  pines: PinGeo[];
  /** Body without clearance (wires must not cross it). */
  cuerpo: Rect;
  /** Clearance rectangles: inflated body, label, stubs. */
  rects: Rect[];
  /** Leads as thin segments (pin end excluded). */
  patas: [Pt, Pt][];
  etq: { rect: Rect; lineas: string[]; ancla: 'start' | 'middle' | 'end'; x: number; y: number } | null;
  talones: Talon[];
  // Flat copies for the hot loops of the annealing.
  /** Bounding box of rects and pins. */
  caja: Rect;
  /** Clearance rectangles, 4 numbers each. */
  rf: Float64Array;
  /** Lead rectangles (thin), 4 numbers each. */
  pf: Float64Array;
  /** Pins: x, y, dx, dy, net (−1 ground/rail). */
  qf: Float64Array;
  /** Wire obstacles for the cost: body, label, stubs (4 numbers each) and their weights. */
  of: Float64Array;
  ow: Float64Array;
}

export interface Unidad {
  id: number;
  disp: Dispositivo | null;
  /** Port / terminal marker (one pin, a net name). */
  puerto: string | null;
  pines: PinU[];
  vars: VarU[];
  x: number;
  y: number;
  v: number;
}

export interface Componente {
  unidades: Unidad[];
  redes: string[];
  /** Pins of each net: [unit, pin]. */
  pinesRed: [number, number][][];
  rango: number[];
}

// ------------------------------------------------------------------ labels

/** Reference designator split for display: «R1» → R + sub 1. */
export function partesRef(n: string): { base: string; sub: string } {
  const m = /^([A-Za-z])([A-Za-z0-9_]{1,5})$/.exec(n);
  if (m && !/^[A-Za-z]$/.test(n)) return { base: m[1]!, sub: m[2]! };
  return { base: n, sub: '' };
}

/** Width of a reference rendered with its subscript. */
function anchoRef(n: string): number {
  const p = partesRef(n);
  return anchoTexto(p.base, TAM_ETQ) + anchoTexto(p.sub, TAM_ETQ * 0.72);
}

/** Width reserved for a value: every number counts as «8,88» so that a slider never changes the layout. */
function anchoReservado(s: string): number {
  let w = reservados.get(s);
  if (w === undefined) {
    w = anchoTexto(s.replace(/[0-9]+(?:[,.][0-9]+)?(\s?)[pnµumkMGT]?(?=[A-Za-zΩ])/g, '8,88$1k').replace(/[0-9]+(?:[,.][0-9]+)?/g, '8,88'), TAM_ETQ);
    if (reservados.size > 4000) reservados.clear();
    reservados.set(s, w);
  }
  return w;
}
const reservados = new Map<string, number>();

export function lineasEtiqueta(d: Dispositivo, horizontal: boolean): { lineas: string[]; ancho: number } {
  const ref = d.nombre;
  const lineas: string[] = [];
  let ancho = 0;
  const v = d.valor;
  const extra = d.extra;
  if (d.simbolo === 'PUENTE') {
    if (d.modelo) lineas.push(d.modelo);
    return { lineas, ancho: d.modelo ? anchoTexto(d.modelo, TAM_ETQ) : 0 };
  }
  if (d.simbolo === 'OPAMP' || d.simbolo === 'CAJA' || d.simbolo === 'PUERTA') {
    lineas.push(ref);
    ancho = anchoRef(ref);
    if (d.simbolo === 'OPAMP' && d.modelo) {
      lineas.push(d.modelo);
      ancho = Math.max(ancho, anchoTexto(d.modelo, TAM_ETQ));
    } else if (d.simbolo === 'OPAMP' && v) {
      lineas.push(v);
      ancho = Math.max(ancho, anchoReservado(v));
    }
    return { lineas, ancho };
  }
  if (horizontal) {
    const t = v ? `${ref} ${v}` : ref;
    lineas.push(t);
    ancho = anchoRef(ref) + (v ? anchoTexto(' ', TAM_ETQ) + anchoReservado(v) : 0);
    if (extra && d.letra !== 'D') {
      lineas.push(extra);
      ancho = Math.max(ancho, anchoReservado(extra));
    }
  } else {
    lineas.push(ref);
    ancho = anchoRef(ref);
    if (v) {
      lineas.push(v);
      ancho = Math.max(ancho, anchoReservado(v));
    }
    if (extra && d.letra !== 'D') {
      lineas.push(extra);
      ancho = Math.max(ancho, anchoReservado(extra));
    }
  }
  return { lineas, ancho };
}

// ------------------------------------------------------------------ geometry of a variant

const HOLGURA = 0.4; // clearance around bodies
const GRUESO = 0.04; // half thickness of leads

function inflar(r: Rect, m: number): Rect {
  return [r[0] - m, r[1] - m, r[2] + m, r[3] + m];
}

function rectLinea(a: Pt, b: Pt, m = GRUESO): Rect {
  return [Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m];
}

/** Lead from `a` (pin) to `b` (body) shortened at the pin end so pins can touch. */
function sinPunta(a: Pt, b: Pt): [Pt, Pt] {
  const dx = Math.sign(b[0] - a[0]);
  const dy = Math.sign(b[1] - a[1]);
  return [[a[0] + dx * 0.06, a[1] + dy * 0.06], b];
}

function rectEtiqueta(x: number, y: number, dx: number, dy: number, ancho: number, n: number): { rect: Rect; ancla: 'start' | 'middle' | 'end'; x: number; y: number } {
  const alto = n * ALTO_LINEA;
  const g = 0.1;
  let x0: number;
  let ancla: 'start' | 'middle' | 'end';
  if (dx > 0) {
    x0 = x + g;
    ancla = 'start';
  } else if (dx < 0) {
    x0 = x - g - ancho;
    ancla = 'end';
  } else {
    x0 = x - ancho / 2;
    ancla = 'middle';
  }
  let y0: number;
  if (dy < 0) y0 = y - g - alto;
  else if (dy > 0) y0 = y + g;
  else y0 = y - alto / 2;
  const tx = ancla === 'start' ? x0 : ancla === 'end' ? x0 + ancho : x0 + ancho / 2;
  return { rect: [x0, y0, x0 + ancho, y0 + alto], ancla, x: tx, y: y0 };
}

/** Ground / supply symbol hanging from a pin. */
function talon(pin: number, p: PinGeo, tipo: 'tierra' | 'riel', riel: Riel | null): Talon {
  const { x, y, dx, dy } = p;
  if (tipo === 'tierra') {
    if (dy !== 0) {
      // Straight on (down, or up for the rare upward pin).
      const s = dy;
      const punto: Pt = [x, y + s * 0.45];
      return { pin, tipo, pata: [[x, y], punto], punto, dir: [0, s], rect: [x - 0.34, Math.min(y, y + s * 0.75), x + 0.34, Math.max(y, y + s * 0.75)], etq: null };
    }
    // Sideways: one unit out, then down.
    const ex = x + dx * 1;
    const punto: Pt = [ex, y + 0.45];
    return {
      pin,
      tipo,
      pata: [[x, y], [ex, y], punto],
      punto,
      dir: [0, 1],
      rect: [Math.min(x, ex - 0.34), y - 0.05, Math.max(x, ex + 0.34), y + 0.75],
      etq: null,
    };
  }
  // Supply rail: a T bar with its name beyond.
  const nombre = riel?.texto ?? '';
  const ancho = anchoTexto(nombre, TAM_ETQ) + 0.1;
  const punto: Pt = [x + dx * 0.5, y + dy * 0.5];
  let etq: Rect;
  if (dy < 0) etq = [x - ancho / 2, y - 0.55 - ALTO_LINEA, x + ancho / 2, y - 0.55];
  else if (dy > 0) etq = [x - ancho / 2, y + 0.55, x + ancho / 2, y + 0.55 + ALTO_LINEA];
  else if (dx > 0) etq = [x + 0.6, y - ALTO_LINEA / 2, x + 0.6 + ancho, y + ALTO_LINEA / 2];
  else etq = [x - 0.6 - ancho, y - ALTO_LINEA / 2, x - 0.6, y + ALTO_LINEA / 2];
  const barra = dy !== 0 ? [x - 0.3, punto[1] - 0.05, x + 0.3, punto[1] + 0.05] : [punto[0] - 0.05, y - 0.3, punto[0] + 0.05, y + 0.3];
  const rect: Rect = [Math.min(barra[0]!, etq[0], x), Math.min(barra[1]!, etq[1], y), Math.max(barra[2]!, etq[2], x), Math.max(barra[3]!, etq[3], y)];
  return { pin, tipo, pata: [[x, y], punto], punto, dir: [dx, dy], rect, etq };
}

function costeTalon(t: Talon, riel: Riel | null): number {
  const [dx, dy] = [t.pata[1]![0] - t.pata[0]![0], t.pata[1]![1] - t.pata[0]![1]];
  if (t.tipo === 'tierra') {
    if (dy > 0) return 0;
    if (dy < 0) return 14;
    void dx;
    return 5;
  }
  const s = riel?.signo ?? 1;
  if (dy !== 0) return Math.sign(dy) === -s ? 0 : 9;
  return 4;
}

/** Port marker: an open terminal with the net name. */
export function defPuerto(nombre: string): DefSimbolo {
  return {
    pines: { start: { x: 1, y: 0, dx: 1, dy: 0 } },
    cuerpo: [-0.12, -0.12, 0.12, 0.12],
    patas: [[[1, 0], [0.1, 0]]],
    prims: [
      { t: 'l', p: [[0.1, 0], [1, 0]] },
      { t: 'c', c: [0, 0], r: 0.1, relleno: 'fondo' },
    ],
    etq: { x: -0.15, y: 0, dx: -1, dy: 0 },
    dos: false,
  };
  void nombre;
}

export function construirVariante(u: Unidad, def: DefSimbolo, o: number, coste: number): VarU {
  const pines: PinGeo[] = u.pines.map((p) => {
    const pd = def.pines[p.nombre];
    if (!pd) throw new Error(`símbolo sin terminal ${p.nombre}`);
    const [x, y] = girar(o, pd.x, pd.y);
    const [dx, dy] = girar(o, pd.dx, pd.dy);
    return { x, y, dx, dy };
  });
  const cuerpo = girarRect(o, def.cuerpo);
  const rects: Rect[] = [inflar(cuerpo, HOLGURA)];
  const patas: [Pt, Pt][] = def.patas.map(([a, b]) => sinPunta(girar(o, a[0], a[1]), girar(o, b[0], b[1])));
  for (const [a, b] of patas) rects.push(rectLinea(a, b));
  // Label.
  let etq: VarU['etq'] = null;
  const [ex, ey] = girar(o, def.etq.x, def.etq.y);
  const [edx, edy] = girar(o, def.etq.dx, def.etq.dy);
  if (u.disp) {
    const horizontal = def.dos ? edy !== 0 : true;
    const { lineas, ancho } = lineasEtiqueta(u.disp, horizontal);
    if (lineas.length) {
      const e = rectEtiqueta(ex, ey, edx, edy, ancho, lineas.length);
      etq = { ...e, lineas };
      rects.push(inflar(e.rect, 0.05));
    }
  } else if (u.puerto) {
    const ancho = anchoTexto(u.puerto, TAM_ETQ);
    const e = rectEtiqueta(ex, ey, edx, edy, ancho, 1);
    etq = { ...e, lineas: [u.puerto] };
    rects.push(inflar(e.rect, 0.05));
  }
  // Stubs.
  const talones: Talon[] = [];
  let extra = 0;
  u.pines.forEach((p, i) => {
    if (p.tipo !== 'tierra' && p.tipo !== 'riel') return;
    const t = talon(i, pines[i]!, p.tipo, p.riel);
    talones.push(t);
    rects.push(t.rect);
    if (t.etq) rects.push(inflar(t.etq, 0.05));
    extra += costeTalon(t, p.riel);
  });
  // Flat arrays (filled by hand: Array.prototype.flat/flatMap were a good part of the live layout's time).
  const rf = new Float64Array(4 * rects.length);
  rects.forEach((r, i) => rf.set(r, 4 * i));
  const pf = new Float64Array(4 * patas.length);
  patas.forEach(([a, b], i) => pf.set(rectLinea(a, b, 0.02), 4 * i));
  const qf = new Float64Array(5 * pines.length);
  pines.forEach((g, i) => {
    qf[5 * i] = g.x;
    qf[5 * i + 1] = g.y;
    qf[5 * i + 2] = g.dx;
    qf[5 * i + 3] = g.dy;
    qf[5 * i + 4] = u.pines[i]!.red;
  });
  const nObst = 1 + (etq ? 1 : 0) + talones.length;
  const of = new Float64Array(4 * nObst);
  const ow = new Float64Array(nObst);
  of.set(cuerpo, 0);
  ow[0] = 1;
  let iObst = 1;
  if (etq) {
    of.set(etq.rect, 4 * iObst);
    ow[iObst++] = 0.35;
  }
  for (const t of talones) {
    of.set(t.rect, 4 * iObst);
    ow[iObst++] = 0.6;
  }
  let cx0 = Infinity;
  let cy0 = Infinity;
  let cx1 = -Infinity;
  let cy1 = -Infinity;
  for (const r of rects) {
    cx0 = Math.min(cx0, r[0]);
    cy0 = Math.min(cy0, r[1]);
    cx1 = Math.max(cx1, r[2]);
    cy1 = Math.max(cy1, r[3]);
  }
  for (const g of pines) {
    cx0 = Math.min(cx0, g.x);
    cy0 = Math.min(cy0, g.y);
    cx1 = Math.max(cx1, g.x);
    cy1 = Math.max(cy1, g.y);
  }
  return { def, o, coste: coste + extra, pines, cuerpo, rects, patas, etq, talones, caja: [cx0, cy0, cx1, cy1], rf, pf, qf, of, ow };
}

// ------------------------------------------------------------------ layout rules (recognised topologies)

/** A point of a placed unit: one of its pins, or its body's centre or edges. */
export interface RefRegla {
  u: number;
  p: number | 'c' | 'x0' | 'x1' | 'y0' | 'y1';
}

/**
 * Layout rules of the topologies recognised in a component (plantillas.ts): how a textbook draws an H bridge,
 * a converter, a Wien oscillator, a regulator or a logic circuit. Orientations are folded into the variant
 * costs; what is left are soft constraints between units, added to the annealing cost.
 */
export interface Reglas {
  /** Families recognised (part of the layout's cache key). */
  familias: string[];
  /** coord(a) + min ≤ coord(b) along `eje` (0 = x, 1 = y). */
  orden: { a: RefRegla; b: RefRegla; eje: 0 | 1; min: number; peso: number }[];
  /** coord(a) = coord(b) along `eje`. */
  alin: { a: RefRegla; b: RefRegla; eje: 0 | 1; peso: number }[];
  /** Nets drawn with net labels at every pin instead of wires. */
  etiquetar: Set<number>;
  /** Single pins («unit,pin») joined to their net by a label while the net's other pins are wired. */
  etiquetarPines?: Set<string>;
  /** Flow rank of each unit (replaces the one derived from the nets), e.g. logic depth. */
  rangoU?: number[];
  /** Row of each unit for the layered start (a chain of a logic circuit), −1 none. */
  fila?: number[];
  /** A drawn start for the topology: pin `pin` of unit `u` at (x, y), in its cheapest variant. */
  anclas?: { u: number; pin: number; x: number; y: number }[];
}

export function reglasVacias(familia: string): Reglas {
  return { familias: [familia], orden: [], alin: [], etiquetar: new Set() };
}

// ------------------------------------------------------------------ units of a component

export function crearUnidades(
  disps: Dispositivo[],
  rieles: Map<string, Riel>,
  puertos: string[],
): Componente {
  const redes: string[] = [];
  const idx = new Map<string, number>();
  const red = (n: string) => {
    if (!idx.has(n)) {
      idx.set(n, redes.length);
      redes.push(n);
    }
    return idx.get(n)!;
  };
  const unidades: Unidad[] = [];
  for (const d of disps) {
    const pines: PinU[] = d.pines.map((p) => {
      if (esTierra(p.nodo)) return { nombre: p.nombre, nodo: p.nodo, red: -1, tipo: 'tierra', riel: null };
      const r = rieles.get(p.nodo);
      if (r) return { nombre: p.nombre, nodo: p.nodo, red: -1, tipo: 'riel', riel: r };
      return { nombre: p.nombre, nodo: p.nodo, red: red(p.nodo), tipo: 'red', riel: null };
    });
    const u: Unidad = { id: unidades.length, disp: d, puerto: null, pines, vars: [], x: 0, y: 0, v: 0 };
    // One symbol definition per drawing variant (they are read only; up to eight orientations share it).
    const defs = new Map<number, DefSimbolo>();
    for (const vv of variantes(d)) {
      let def = defs.get(vv.v);
      if (!def) defs.set(vv.v, (def = simboloDe(d, vv.v)));
      u.vars.push(construirVariante(u, def, vv.o, vv.coste));
    }
    unidades.push(u);
  }
  for (const p of puertos) {
    if (!idx.has(p)) continue;
    const u: Unidad = {
      id: unidades.length,
      disp: null,
      puerto: p,
      pines: [{ nombre: 'start', nodo: p, red: idx.get(p)!, tipo: 'red', riel: null }],
      vars: [],
      x: 0,
      y: 0,
      v: 0,
    };
    const def = defPuerto(p);
    for (const o of [0, 2, 1, 3]) u.vars.push(construirVariante(u, def, o, o === 0 || o === 2 ? 0 : 1));
    unidades.push(u);
  }
  const pinesRed: [number, number][][] = redes.map(() => []);
  for (const u of unidades) u.pines.forEach((p, i) => p.red >= 0 && pinesRed[p.red]!.push([u.id, i]));
  return { unidades, redes, pinesRed, rango: rangos(unidades, redes.length) };
}

/** Signal-flow rank of each net: 0 at the inputs (sources to ground, input ports), +1 per part crossed. */
function rangos(us: Unidad[], n: number): number[] {
  const r = new Array<number>(n).fill(-1);
  const cola: number[] = [];
  const marcar = (i: number, v: number) => {
    if (i >= 0 && r[i]! < 0) {
      r[i] = v;
      cola.push(i);
    }
  };
  for (const u of us) {
    const d = u.disp;
    if (d && (d.letra === 'V' || d.letra === 'I') && u.pines.some((p) => p.tipo === 'tierra' || p.tipo === 'riel'))
      for (const p of u.pines) if (p.red >= 0) marcar(p.red, 0);
    if (u.puerto && /^(in|ent|vin|e|i|a|x|inp|inn|ip|im|clk|t|p)\w*$/i.test(u.puerto) && !/^(out|o)/i.test(u.puerto)) marcar(u.pines[0]!.red, 0);
  }
  if (!cola.length) {
    // Floating sources (a bridge rectifier's transformer): both nets are inputs.
    for (const u of us) if (u.disp && (u.disp.letra === 'V' || u.disp.letra === 'I')) for (const p of u.pines) marcar(p.red, 0);
  }
  if (!cola.length && n) marcar(0, 0);
  const porRed: number[][] = Array.from({ length: n }, () => []);
  us.forEach((u) => u.pines.forEach((p) => p.red >= 0 && porRed[p.red]!.push(u.id)));
  for (let k = 0; k < cola.length; k++) {
    const i = cola[k]!;
    for (const uid of porRed[i]!) for (const p of us[uid]!.pines) marcar(p.red, r[i]! + 1);
    if (k === cola.length - 1) {
      // Disconnected leftovers (should not happen inside a component).
      const resto = r.findIndex((x) => x < 0);
      if (resto >= 0) marcar(resto, Math.max(...r) + 1);
    }
  }
  return r.map((x) => (x < 0 ? 0 : x));
}

// ------------------------------------------------------------------ random numbers

export function semilla(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function aleatorio(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ cost

const PESO = {
  bend: 2.2,
  atras: 4.5,
  cruce: 7,
  cuerpo: 7,
  flujo: 0.6,
  flujoU: 0.45,
  area: 0.18,
};

/**
 * Estimated wire segments, 6 numbers each: lo, hi (along the segment), c (the fixed coordinate), horizontal
 * (1/0), and the units at its ends (−1 none), excluded from body tests.
 */
const PASO_SEG = 6;

/** Axis-aligned segment crosses the interior of a rectangle. */
export function segEnRect(s: { x0: number; y0: number; x1: number; y1: number }, r: Rect): boolean {
  const e = 1e-6;
  if (s.y0 === s.y1) {
    if (s.x0 === s.x1) return false;
    const y = s.y0;
    return y > r[1] + e && y < r[3] - e && Math.min(s.x0, s.x1) < r[2] - e && Math.max(s.x0, s.x1) > r[0] + e;
  }
  if (s.x0 === s.x1) {
    const x = s.x0;
    return x > r[0] + e && x < r[2] - e && Math.min(s.y0, s.y1) < r[3] - e && Math.max(s.y0, s.y1) > r[1] + e;
  }
  return false;
}

/** Crossings (perpendicular, strictly inside both; 1 each) and overlaps (collinear; 1.5) of two segment lists
 *  (the first `na` / `nb` numbers of `a` / `b`). */
function crucesListas(a: Float64Array, na: number, b: Float64Array, nb: number): number {
  let c = 0;
  for (let i = 0; i < na; i += PASO_SEG) {
    const alo = a[i]!;
    const ahi = a[i + 1]!;
    const ac = a[i + 2]!;
    const ah = a[i + 3]!;
    for (let j = 0; j < nb; j += PASO_SEG) {
      const blo = b[j]!;
      const bhi = b[j + 1]!;
      const bc = b[j + 2]!;
      if (ah !== b[j + 3]) {
        // One horizontal, one vertical: the fixed coordinate of each inside the other's span.
        if (bc > alo && bc < ahi && ac > blo && ac < bhi) c += 1;
      } else if (ac === bc && Math.min(ahi, bhi) - Math.max(alo, blo) > 1e-6) c += 1.5;
    }
  }
  return c;
}

/**
 * Placement of one component by simulated annealing with an incremental cost.
 *
 * 0.8: the cost terms live in flat typed arrays (per net: its estimated wires, their box and cost, current and
 * pending; per net × unit: wire hits on bodies; per net × net: crossings) and a move allocates nothing. The
 * arithmetic and its order are exactly those of 0.7 (same sums in the same order, same random numbers), so the
 * layouts are identical, only faster.
 */
export class Colocador {
  readonly c: Componente;
  readonly us: Unidad[];
  private rnd: () => number;
  coste = 0;
  private readonly nr: number;
  private readonly nu: number;
  // Current cost terms. Per net k: its estimated wires segs[k] (the first nSeg[k] numbers), their box
  // caja[4k..4k+3] (x0, y0, x1, y1) and the net's own cost.
  private segs: Float64Array[];
  private nSeg: Int32Array;
  private caja: Float64Array;
  private costeRedes: Float64Array;
  /** Body hits of net k's estimated wires on unit u: cuerpo[k·nu + u]. */
  private cuerpo: Float64Array;
  /** Crossings between nets k and j: cruces[k·nr + j] (symmetric). */
  private cruces: Float64Array;
  private costeUnidades: Float64Array;
  private costeArea = 0;
  /** World box of each unit's current variant (x0, y0, x1, y1 at 4u): the early outs of the hit tests without
   *  a call per unit. Refreshed by costeTotal() and for the units a move changes. */
  private cw: Float64Array;
  // Pending move (delta → confirmar): nets recomputed (A, in the order they were found), their new terms in
  // the p* buffers, and the changed hits, crossings, unit costs and rules.
  private pSegs: Float64Array[];
  private pNSeg: Int32Array;
  private pCaja: Float64Array;
  private pCosteRed: Float64Array;
  private A: Int32Array;
  private nA = 0;
  private enA: Int32Array;
  private selloA = 0;
  private pcK: Int32Array;
  private pcU: Int32Array;
  private pcG: Float64Array;
  private npc = 0;
  private pxK: Int32Array;
  private pxJ: Int32Array;
  private pxX: Float64Array;
  private npx = 0;
  private puU = new Int32Array(2);
  private puC = new Float64Array(2);
  private npu = 0;
  private pArea = 0;
  private pCoste = 0;
  private prI: Int32Array;
  private prN: Float64Array;
  private npr = 0;
  private prTotal = 0;
  private vistaRegla: Int32Array;
  private selloR = 0;
  /** Pins of each net that get estimated wires ([unit, pin] pairs; nets drawn with labels: none). */
  private pinesK: Int32Array[];
  private sinCables: Uint8Array;
  /** Signal pins of each unit, and every pin of each net (for alinear). */
  private senal: Int32Array[];
  private pinesRedF: Int32Array[];
  // Scratch for the MST.
  private gx: Float64Array;
  private gy: Float64Array;
  private gdx: Float64Array;
  private gdy: Float64Array;
  private gu: Int32Array;
  private dist: Float64Array;
  private de: Int32Array;
  private en: Uint8Array;
  private redesDe: number[][];
  /** Flow rank of each unit: sources to ground 0, then one more than the earliest net it touches. */
  private rangoU: number[];
  /** Rules of the recognised topologies (null: none). */
  readonly reglas: Reglas | null;
  private costeReglasV = 0;
  /** Cost of each rule (orden first, then alin) and the rules touching each unit (incremental updates). */
  private costeRegla = new Float64Array(0);
  private reglasDeUnidad: number[][] = [];

  constructor(c: Componente, seed: number, reglas: Reglas | null = null) {
    this.c = c;
    this.us = c.unidades;
    this.rnd = aleatorio(seed);
    this.reglas = reglas && (reglas.orden.length || reglas.alin.length || reglas.rangoU) ? reglas : null;
    if (this.reglas) {
      const R = this.reglas;
      this.costeRegla = new Float64Array(R.orden.length + R.alin.length);
      this.reglasDeUnidad = c.unidades.map(() => []);
      [...R.orden, ...R.alin].forEach((r, i) => {
        this.reglasDeUnidad[r.a.u]!.push(i);
        if (r.b.u !== r.a.u) this.reglasDeUnidad[r.b.u]!.push(i);
      });
    }
    this.redesDe = this.us.map((u) => [...new Set(u.pines.filter((p) => p.red >= 0).map((p) => p.red))]);
    this.rangoU = reglas?.rangoU ?? this.us.map((u) => {
      const d = u.disp;
      if (d && (d.letra === 'V' || d.letra === 'I') && u.pines.some((p) => p.tipo !== 'red')) return 0;
      let m = Infinity;
      for (const p of u.pines) if (p.red >= 0) m = Math.min(m, c.rango[p.red]!);
      return Number.isFinite(m) ? m + 1 : 1;
    });
    const nr = (this.nr = c.redes.length);
    const nu = (this.nu = this.us.length);
    // A net drawn with labels has no wires to estimate (nor have the pins labelled one by one).
    const R = this.reglas;
    let maxN = 1;
    this.sinCables = new Uint8Array(nr);
    this.pinesK = c.pinesRed.map((ps0, k) => {
      let ps = ps0;
      if (R?.etiquetarPines?.size) ps = ps.filter(([u, i]) => !R.etiquetarPines!.has(`${u},${i}`));
      if (ps.length < 2 || R?.etiquetar.has(k)) this.sinCables[k] = 1;
      maxN = Math.max(maxN, ps.length);
      return new Int32Array(ps.flat());
    });
    this.pinesRedF = c.pinesRed.map((ps) => new Int32Array(ps.flat()));
    this.senal = this.us.map((u) => new Int32Array(u.pines.flatMap((p, i) => (p.red >= 0 ? [i] : []))));
    // Up to two segments per MST edge.
    const cap = (k: number) => Math.max(1, 12 * (this.pinesK[k]!.length / 2 - 1));
    this.segs = this.pinesK.map((_, k) => new Float64Array(cap(k)));
    this.pSegs = this.pinesK.map((_, k) => new Float64Array(cap(k)));
    this.nSeg = new Int32Array(nr);
    this.pNSeg = new Int32Array(nr);
    this.caja = new Float64Array(4 * nr);
    this.pCaja = new Float64Array(4 * nr);
    this.costeRedes = new Float64Array(nr);
    this.pCosteRed = new Float64Array(nr);
    this.cuerpo = new Float64Array(nr * nu);
    this.cruces = new Float64Array(nr * nr);
    this.costeUnidades = new Float64Array(nu);
    this.cw = new Float64Array(4 * nu);
    this.A = new Int32Array(nr);
    this.enA = new Int32Array(nr);
    this.pcK = new Int32Array(nr * nu);
    this.pcU = new Int32Array(nr * nu);
    this.pcG = new Float64Array(nr * nu);
    this.pxK = new Int32Array(nr * nr);
    this.pxJ = new Int32Array(nr * nr);
    this.pxX = new Float64Array(nr * nr);
    const nReglas = this.costeRegla.length;
    this.prI = new Int32Array(nReglas);
    this.prN = new Float64Array(nReglas);
    this.vistaRegla = new Int32Array(nReglas);
    this.gx = new Float64Array(maxN);
    this.gy = new Float64Array(maxN);
    this.gdx = new Float64Array(maxN);
    this.gdy = new Float64Array(maxN);
    this.gu = new Int32Array(maxN);
    this.dist = new Float64Array(maxN);
    this.de = new Int32Array(maxN);
    this.en = new Uint8Array(maxN);
  }

  // -------------------------------------------------------------- geometry helpers

  pin(u: Unidad, i: number): PinGeo {
    const g = u.vars[u.v]!.pines[i]!;
    return { x: g.x + u.x, y: g.y + u.y, dx: g.dx, dy: g.dy };
  }

  /** Is unit `a` compatible with unit `b` (no overlaps, no shorts)? */
  compatibles(a: Unidad, b: Unidad): boolean {
    const va = a.vars[a.v]!;
    const vb = b.vars[b.v]!;
    // Position of b relative to a.
    const ox = b.x - a.x;
    const oy = b.y - a.y;
    const ca = va.caja;
    const cb = vb.caja;
    if (cb[0] + ox > ca[2] + 1e-6 || cb[2] + ox < ca[0] - 1e-6 || cb[1] + oy > ca[3] + 1e-6 || cb[3] + oy < ca[1] - 1e-6) return true;
    const e = 1e-6;
    const ra = va.rf;
    const rb = vb.rf;
    for (let i = 0; i < ra.length; i += 4) {
      const a0 = ra[i]!;
      const a1 = ra[i + 1]!;
      const a2 = ra[i + 2]!;
      const a3 = ra[i + 3]!;
      for (let j = 0; j < rb.length; j += 4) {
        if (a0 < rb[j + 2]! + ox - e && rb[j]! + ox < a2 - e && a1 < rb[j + 3]! + oy - e && rb[j + 1]! + oy < a3 - e) return false;
      }
    }
    // Pins: same point only on the same net and not facing the same way; never on the other's leads.
    const qa = va.qf;
    const qb = vb.qf;
    for (let i = 0; i < qa.length; i += 5) {
      const px = qa[i]!;
      const py = qa[i + 1]!;
      for (let j = 0; j < qb.length; j += 5) {
        if (Math.abs(qb[j]! + ox - px) < 1e-6 && Math.abs(qb[j + 1]! + oy - py) < 1e-6) {
          const na = qa[i + 4]!;
          if (na < 0 || na !== qb[j + 4]) return false;
          if (qa[i + 2] === qb[j + 2] && qa[i + 3] === qb[j + 3]) return false;
        }
      }
      if (enRects(px - ox, py - oy, vb.pf)) return false;
    }
    for (let j = 0; j < qb.length; j += 5) if (enRects(qb[j]! + ox, qb[j + 1]! + oy, va.pf)) return false;
    return true;
  }

  valida(u: Unidad): boolean {
    // The box test of compatibles() first, inline (most units are far away).
    const ca = u.vars[u.v]!.caja;
    for (const w of this.us) {
      if (w === u) continue;
      const cb = w.vars[w.v]!.caja;
      const ox = w.x - u.x;
      const oy = w.y - u.y;
      if (cb[0] + ox > ca[2] + 1e-6 || cb[2] + ox < ca[0] - 1e-6 || cb[1] + oy > ca[3] + 1e-6 || cb[3] + oy < ca[1] - 1e-6) continue;
      if (!this.compatibles(u, w)) return false;
    }
    return true;
  }

  private refrescar(u: Unidad): void {
    const k = u.vars[u.v]!.caja;
    const i = 4 * u.id;
    this.cw[i] = k[0] + u.x;
    this.cw[i + 1] = k[1] + u.y;
    this.cw[i + 2] = k[2] + u.x;
    this.cw[i + 3] = k[3] + u.y;
  }

  // -------------------------------------------------------------- cost terms

  /** costeUnidad() per unit and variant (it depends on nothing else), computed once. */
  private costeVar: Float64Array[] = [];
  private costeUnidad(u: Unidad): number {
    let t = this.costeVar[u.id];
    if (!t) this.costeVar[u.id] = t = new Float64Array(u.vars.length).fill(NaN);
    let c = t[u.v]!;
    if (Number.isNaN(c)) t[u.v] = c = this.costeUnidadDe(u);
    return c;
  }

  private costeUnidadDe(u: Unidad): number {
    const v = u.vars[u.v]!;
    let c = v.coste;
    // Flow: a pin on a later net should not be left of a pin on an earlier net of the same part.
    const r = this.c.rango;
    for (let i = 0; i < u.pines.length; i++) {
      const a = u.pines[i]!;
      if (a.red < 0) continue;
      for (let j = 0; j < u.pines.length; j++) {
        const b = u.pines[j]!;
        if (b.red < 0 || r[a.red]! >= r[b.red]!) continue;
        const d = v.pines[i]!.x - v.pines[j]!.x;
        if (d > 0) c += PESO.flujo * d;
      }
    }
    return c;
  }

  /**
   * Estimated wires of net k (rectilinear MST, L-shaped edges) written into `segs` with their box into `caja`
   * at 4k; returns [cost, numbers written] through `this.nEscritos`.
   */
  private nEscritos = 0;
  private estadoRed(k: number, segs: Float64Array, caja: Float64Array): number {
    this.nEscritos = 0;
    caja[4 * k] = Infinity;
    caja[4 * k + 1] = Infinity;
    caja[4 * k + 2] = -Infinity;
    caja[4 * k + 3] = -Infinity;
    if (this.sinCables[k]) return 0;
    const ps = this.pinesK[k]!;
    const n = ps.length / 2;
    const us = this.us;
    const gx = this.gx;
    const gy = this.gy;
    const gdx = this.gdx;
    const gdy = this.gdy;
    const gu = this.gu;
    for (let i = 0; i < n; i++) {
      const u = us[ps[2 * i]!]!;
      const g = u.vars[u.v]!.pines[ps[2 * i + 1]!]!;
      gx[i] = g.x + u.x;
      gy[i] = g.y + u.y;
      gdx[i] = g.dx;
      gdy[i] = g.dy;
      gu[i] = u.id;
    }
    // Prim's rectilinear MST.
    const en = this.en;
    const dist = this.dist;
    const de = this.de;
    for (let i = 0; i < n; i++) {
      en[i] = 0;
      dist[i] = Infinity;
      de[i] = -1;
    }
    dist[0] = 0;
    let coste = 0;
    let o = 0;
    for (let it = 0; it < n; it++) {
      let m = -1;
      for (let i = 0; i < n; i++) if (!en[i] && (m < 0 || dist[i]! < dist[m]!)) m = i;
      en[m] = 1;
      const a = de[m]!;
      if (a >= 0) {
        // costeArista(g[a], g[m]) of 0.7, writing its L-shaped estimate.
        const dx = gx[m]! - gx[a]!;
        const dy = gy[m]! - gy[a]!;
        if (dx !== 0 || dy !== 0) {
          let c = Math.abs(dx) + Math.abs(dy);
          if (dx !== 0 && dy !== 0) c += PESO.bend;
          if (dx * gdx[a]! + dy * gdy[a]! < 0) c += PESO.atras;
          if (-dx * gdx[m]! - dy * gdy[m]! < 0) c += PESO.atras;
          const ax = gx[a]!;
          const ay = gy[a]!;
          const bx = gx[m]!;
          const by = gy[m]!;
          if (dx !== 0 && dy !== 0) {
            if (gdx[a] !== 0) {
              o = seg(segs, o, ax, ay, bx, ay, gu[a]!, -1);
              o = seg(segs, o, bx, ay, bx, by, -1, gu[m]!);
            } else {
              o = seg(segs, o, ax, ay, ax, by, gu[a]!, -1);
              o = seg(segs, o, ax, by, bx, by, -1, gu[m]!);
            }
          } else o = seg(segs, o, ax, ay, bx, by, gu[a]!, gu[m]!);
          coste += c;
        }
      }
      for (let i = 0; i < n; i++) {
        if (en[i]) continue;
        const d = Math.abs(gx[i]! - gx[m]!) + Math.abs(gy[i]! - gy[m]!);
        if (d < dist[i]!) {
          dist[i] = d;
          de[i] = m;
        }
      }
    }
    // Flow between parts: a part of lower rank should sit left of the parts it feeds on this net.
    const rangoU = this.rangoU;
    for (let i = 0; i < n; i++) {
      const ui = us[ps[2 * i]!]!;
      const ri = rangoU[ui.id]!;
      const ki = ui.vars[ui.v]!.caja;
      const ci = ui.x + (ki[0] + ki[2]) / 2;
      for (let j = 0; j < n; j++) {
        const uj = us[ps[2 * j]!]!;
        if (uj === ui || rangoU[uj.id]! <= ri) continue;
        const kj = uj.vars[uj.v]!.caja;
        const cj = uj.x + (kj[0] + kj[2]) / 2;
        if (ci > cj) coste += PESO.flujoU * (ci - cj);
      }
    }
    // Box of the segments (early outs).
    let bx0 = Infinity;
    let by0 = Infinity;
    let bx1 = -Infinity;
    let by1 = -Infinity;
    for (let i = 0; i < o; i += PASO_SEG) {
      const h = segs[i + 3] === 1;
      const x0 = h ? segs[i]! : segs[i + 2]!;
      const x1 = h ? segs[i + 1]! : segs[i + 2]!;
      const y0 = h ? segs[i + 2]! : segs[i]!;
      const y1 = h ? segs[i + 2]! : segs[i + 1]!;
      if (x0 < bx0) bx0 = x0;
      if (x1 > bx1) bx1 = x1;
      if (y0 < by0) by0 = y0;
      if (y1 > by1) by1 = y1;
    }
    caja[4 * k] = bx0;
    caja[4 * k + 1] = by0;
    caja[4 * k + 2] = bx1;
    caja[4 * k + 3] = by1;
    this.nEscritos = o;
    return coste;
  }

  /** Weighted hits of a net's estimated wires (`n` numbers of `segs`, box at caja[4k]) on the obstacles of `u`. */
  private golpes(segs: Float64Array, n: number, caja: Float64Array, k: number, u: Unidad): number {
    const v = u.vars[u.v]!;
    const k0 = v.caja;
    if (!n || caja[4 * k]! >= k0[2] + u.x || caja[4 * k + 2]! <= k0[0] + u.x || caja[4 * k + 1]! >= k0[3] + u.y || caja[4 * k + 3]! <= k0[1] + u.y) return 0;
    let c = 0;
    const of = v.of;
    const ow = v.ow;
    const ux = u.x;
    const uy = u.y;
    const e = 1e-6;
    for (let i = 0; i < n; i += PASO_SEG) {
      if (u.id === segs[i + 4] || u.id === segs[i + 5]) continue;
      const lo = segs[i]!;
      const hi = segs[i + 1]!;
      const cc = segs[i + 2]!;
      const h = segs[i + 3] === 1;
      for (let q = 0, w = 0; q < of.length; q += 4, w++) {
        const r0 = of[q]! + ux;
        const r1 = of[q + 1]! + uy;
        const r2 = of[q + 2]! + ux;
        const r3 = of[q + 3]! + uy;
        const toca = h ? cc > r1 + e && cc < r3 - e && lo < r2 - e && hi > r0 + e : cc > r0 + e && cc < r2 - e && lo < r3 - e && hi > r1 + e;
        if (toca) {
          c += ow[w]!;
          break;
        }
      }
    }
    return c;
  }

  /** Crossings between the wires of nets k and j (each from the current or the pending buffers). */
  private crucesEntre(sa: Float64Array, na: number, ca: Float64Array, k: number, sb: Float64Array, nb: number, cb: Float64Array, j: number): number {
    if (!na || !nb || ca[4 * k]! > cb[4 * j + 2]! || cb[4 * j]! > ca[4 * k + 2]! || ca[4 * k + 1]! > cb[4 * j + 3]! || cb[4 * j + 1]! > ca[4 * k + 3]!) return 0;
    return crucesListas(sa, na, sb, nb);
  }

  /** Coordinate of a rule reference along an axis. */
  private coord(r: RefRegla, eje: 0 | 1): number {
    const u = this.us[r.u]!;
    const v = u.vars[u.v]!;
    const o = eje ? u.y : u.x;
    if (typeof r.p === 'number') return (eje ? v.pines[r.p]!.y : v.pines[r.p]!.x) + o;
    const k = v.cuerpo;
    if (r.p === 'c') return (eje ? (k[1] + k[3]) / 2 : (k[0] + k[2]) / 2) + o;
    if (r.p === 'x0') return k[0] + u.x;
    if (r.p === 'x1') return k[2] + u.x;
    if (r.p === 'y0') return k[1] + u.y;
    return k[3] + u.y;
  }

  /** Cost of rule `i` (orden first, then alin). */
  private reglaI(i: number): number {
    const R = this.reglas!;
    if (i < R.orden.length) {
      const r = R.orden[i]!;
      const falta = this.coord(r.a, r.eje) + r.min - this.coord(r.b, r.eje);
      return falta > 1e-6 ? r.peso * (1 + falta) : 0;
    }
    const r = R.alin[i - R.orden.length]!;
    const d = Math.abs(this.coord(r.a, r.eje) - this.coord(r.b, r.eje));
    return d > 1e-6 ? r.peso * (0.5 + d) : 0;
  }

  /** Cost of the soft constraints of the recognised topologies. */
  costeDeReglas(): number {
    const R = this.reglas;
    if (!R) return 0;
    let c = 0;
    const n = R.orden.length + R.alin.length;
    for (let i = 0; i < n; i++) c += this.reglaI(i);
    return c;
  }

  private area(): number {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const u of this.us) {
      const c = u.vars[u.v]!.caja;
      if (c[0] + u.x < x0) x0 = c[0] + u.x;
      if (c[1] + u.y < y0) y0 = c[1] + u.y;
      if (c[2] + u.x > x1) x1 = c[2] + u.x;
      if (c[3] + u.y > y1) y1 = c[3] + u.y;
    }
    return PESO.area * (x1 - x0 + (y1 - y0));
  }

  /** Full cost from scratch (also refreshes the caches). */
  costeTotal(): number {
    const nr = this.nr;
    const nu = this.nu;
    for (const u of this.us) this.refrescar(u);
    for (let k = 0; k < nr; k++) {
      this.costeRedes[k] = this.estadoRed(k, this.segs[k]!, this.caja);
      this.nSeg[k] = this.nEscritos;
    }
    for (let k = 0; k < nr; k++) for (let i = 0; i < nu; i++) this.cuerpo[k * nu + i] = this.golpes(this.segs[k]!, this.nSeg[k]!, this.caja, k, this.us[i]!);
    this.cruces.fill(0);
    for (let k = 0; k < nr; k++)
      for (let j = k + 1; j < nr; j++)
        this.cruces[k * nr + j] = this.cruces[j * nr + k] = this.crucesEntre(this.segs[k]!, this.nSeg[k]!, this.caja, k, this.segs[j]!, this.nSeg[j]!, this.caja, j);
    for (let i = 0; i < nu; i++) this.costeUnidades[i] = this.costeUnidad(this.us[i]!);
    this.costeArea = this.area();
    this.costeReglasV = 0;
    for (let i = 0; i < this.costeRegla.length; i++) this.costeReglasV += this.costeRegla[i] = this.reglaI(i);
    let c = this.costeArea + this.costeReglasV;
    for (let i = 0; i < nu; i++) c += this.costeUnidades[i]!;
    for (let k = 0; k < nr; k++) {
      c += this.costeRedes[k]!;
      for (let i = 0; i < nu; i++) c += PESO.cuerpo * this.cuerpo[k * nu + i]!;
      for (let j = k + 1; j < nr; j++) c += PESO.cruce * this.cruces[k * nr + j]!;
    }
    this.coste = c;
    return c;
  }

  /** Change of cost after moving `u` (and `otro`, a swap; both already moved); keeps the new terms pending. */
  private delta(u: Unidad, otro: Unidad | null): number {
    const nr = this.nr;
    const nu = this.nu;
    const us = this.us;
    // Nets touched by the moved units, in the order they are found.
    const sello = ++this.selloA;
    const enA = this.enA;
    const A = this.A;
    let nA = 0;
    for (const k of this.redesDe[u.id]!) if (enA[k] !== sello) (enA[k] = sello), (A[nA++] = k);
    if (otro) for (const k of this.redesDe[otro.id]!) if (enA[k] !== sello) (enA[k] = sello), (A[nA++] = k);
    this.nA = nA;
    this.npc = this.npx = this.npu = this.npr = 0;
    this.refrescar(u);
    if (otro) this.refrescar(otro);
    const cw = this.cw;
    let d = 0;
    for (let a = 0; a < nA; a++) {
      const k = A[a]!;
      const s = this.pSegs[k]!;
      const ck = this.estadoRed(k, s, this.pCaja);
      const n = (this.pNSeg[k] = this.nEscritos);
      this.pCosteRed[k] = ck;
      d += ck - this.costeRedes[k]!;
      const bx0 = this.pCaja[4 * k]!;
      const by0 = this.pCaja[4 * k + 1]!;
      const bx1 = this.pCaja[4 * k + 2]!;
      const by1 = this.pCaja[4 * k + 3]!;
      for (let i = 0; i < nu; i++) {
        // golpes() returns 0 when the boxes do not overlap: tested here without the call.
        const g = !n || bx0 >= cw[4 * i + 2]! || bx1 <= cw[4 * i]! || by0 >= cw[4 * i + 3]! || by1 <= cw[4 * i + 1]! ? 0 : this.golpes(s, n, this.pCaja, k, us[i]!);
        const viejo = this.cuerpo[k * nu + i]!;
        if (g !== viejo) {
          d += PESO.cuerpo * (g - viejo);
          this.pcK[this.npc] = k;
          this.pcU[this.npc] = i;
          this.pcG[this.npc++] = g;
        }
      }
    }
    for (let k = 0; k < nr; k++) {
      if (enA[k] === sello) continue;
      const n = this.nSeg[k]!;
      if (!n) {
        // No wires: no hits now; only a hit counted before can change.
        if (this.cuerpo[k * nu + u.id] === 0 && (!otro || this.cuerpo[k * nu + otro.id] === 0)) continue;
      }
      for (let m = 0; m < (otro ? 2 : 1); m++) {
        const w = m ? otro! : u;
        const g = this.golpes(this.segs[k]!, n, this.caja, k, w);
        const viejo = this.cuerpo[k * nu + w.id]!;
        if (g !== viejo) {
          d += PESO.cuerpo * (g - viejo);
          this.pcK[this.npc] = k;
          this.pcU[this.npc] = w.id;
          this.pcG[this.npc++] = g;
        }
      }
    }
    for (let a = 0; a < nA; a++) {
      const k = A[a]!;
      const sk = this.pSegs[k]!;
      const nk = this.pNSeg[k]!;
      const kx0 = this.pCaja[4 * k]!;
      const ky0 = this.pCaja[4 * k + 1]!;
      const kx1 = this.pCaja[4 * k + 2]!;
      const ky1 = this.pCaja[4 * k + 3]!;
      for (let j = 0; j < nr; j++) {
        const jA = enA[j] === sello;
        if (j === k || (jA && j < k)) continue;
        // crucesEntre() inline: its box test first.
        const cj = jA ? this.pCaja : this.caja;
        const nj = jA ? this.pNSeg[j]! : this.nSeg[j]!;
        const x = !nk || !nj || kx0 > cj[4 * j + 2]! || cj[4 * j]! > kx1 || ky0 > cj[4 * j + 3]! || cj[4 * j + 1]! > ky1 ? 0 : crucesListas(sk, nk, jA ? this.pSegs[j]! : this.segs[j]!, nj);
        const viejo = this.cruces[k * nr + j]!;
        // Unchanged: adds exactly nothing (the sum stays bit for bit the same).
        if (x === viejo) continue;
        d += PESO.cruce * (x - viejo);
        this.pxK[this.npx] = k;
        this.pxJ[this.npx] = j;
        this.pxX[this.npx++] = x;
      }
    }
    for (let m = 0; m < (otro ? 2 : 1); m++) {
      const w = m ? otro! : u;
      const c = this.costeUnidad(w);
      d += c - this.costeUnidades[w.id]!;
      this.puU[this.npu] = w.id;
      this.puC[this.npu++] = c;
    }
    this.pArea = this.area();
    d += this.pArea - this.costeArea;
    if (this.reglas) {
      // Only the rules touching the moved units change.
      const sr = ++this.selloR;
      let dr = 0;
      for (let m = 0; m < (otro ? 2 : 1); m++) {
        const w = m ? otro! : u;
        for (const i of this.reglasDeUnidad[w.id]!) {
          if (this.vistaRegla[i] === sr) continue;
          this.vistaRegla[i] = sr;
          const n = this.reglaI(i);
          if (n !== this.costeRegla[i]) {
            dr += n - this.costeRegla[i]!;
            this.prI[this.npr] = i;
            this.prN[this.npr++] = n;
          }
        }
      }
      this.prTotal = this.costeReglasV + dr;
      d += dr;
    }
    this.pCoste = this.coste + d;
    return d;
  }

  private confirmar(): void {
    const nr = this.nr;
    const nu = this.nu;
    for (let a = 0; a < this.nA; a++) {
      const k = this.A[a]!;
      // Swap the net's buffers: the pending wires become the current ones.
      const s = this.segs[k]!;
      this.segs[k] = this.pSegs[k]!;
      this.pSegs[k] = s;
      this.nSeg[k] = this.pNSeg[k]!;
      for (let q = 0; q < 4; q++) this.caja[4 * k + q] = this.pCaja[4 * k + q]!;
      this.costeRedes[k] = this.pCosteRed[k]!;
    }
    for (let i = 0; i < this.npc; i++) this.cuerpo[this.pcK[i]! * nu + this.pcU[i]!] = this.pcG[i]!;
    for (let i = 0; i < this.npx; i++) {
      const k = this.pxK[i]!;
      const j = this.pxJ[i]!;
      this.cruces[k * nr + j] = this.cruces[j * nr + k] = this.pxX[i]!;
    }
    for (let i = 0; i < this.npu; i++) this.costeUnidades[this.puU[i]!] = this.puC[i]!;
    this.costeArea = this.pArea;
    if (this.reglas) {
      for (let i = 0; i < this.npr; i++) this.costeRegla[this.prI[i]!] = this.prN[i]!;
      this.costeReglasV = this.prTotal;
    }
    this.coste = this.pCoste;
  }

  // -------------------------------------------------------------- initial placement

  /** Starting placement: compact columns by rank (`capas` false) or layered with barycentre ordering. */
  inicial(capas = false): void {
    if (!capas) return this.inicialColumnas();
    if (this.reglas?.anclas?.length) return this.inicialAnclado(this.reglas.anclas);
    if (this.reglas?.fila && this.reglas.rangoU) return this.inicialFilas(this.reglas.rangoU, this.reglas.fila);
    // Layered start: one column per flow rank, columns as wide as their widest part, and the parts of
    // each column ordered by the mean position of their neighbours in the previous one (barycentre).
    for (const u of this.us) {
      let mejor = 0;
      u.vars.forEach((v, i) => {
        if (v.coste < u.vars[mejor]!.coste) mejor = i;
      });
      u.v = mejor;
    }
    const cols = new Map<number, Unidad[]>();
    for (const u of this.us) {
      const c = this.rangoUnidad(u);
      if (!cols.has(c)) cols.set(c, []);
      cols.get(c)!.push(u);
    }
    const claves = [...cols.keys()].sort((a, b) => a - b);
    const orden = claves.map((k) => cols.get(k)!);
    const vecinos = (u: Unidad): Set<number> => {
      const r = new Set<number>();
      for (const k of this.redesDe[u.id]!) for (const [w] of this.c.pinesRed[k]!) if (w !== u.id) r.add(w);
      return r;
    };
    const vec = this.us.map(vecinos);
    const posicion = new Map<number, number>();
    const fijar = () => orden.forEach((col) => col.forEach((u, i) => posicion.set(u.id, i)));
    fijar();
    for (let pasada = 0; pasada < 4; pasada++) {
      const ida = pasada % 2 === 0;
      for (let ci = ida ? 1 : orden.length - 2; ida ? ci < orden.length : ci >= 0; ci += ida ? 1 : -1) {
        const ref = new Set((orden[ida ? ci - 1 : ci + 1] ?? []).map((u) => u.id));
        const clave = (u: Unidad) => {
          const xs = [...vec[u.id]!].filter((w) => ref.has(w)).map((w) => posicion.get(w)!);
          return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : posicion.get(u.id)!;
        };
        orden[ci]!.sort((a, b) => clave(a) - clave(b) || a.id - b.id);
        fijar();
      }
    }
    const colocadas: Unidad[] = [];
    let x = 0;
    for (const col of orden) {
      let y = 0;
      let ancho = 0;
      for (const u of col) {
        const k = u.vars[u.v]!.caja;
        u.x = Math.round(x - k[0]);
        u.y = Math.round(y - k[1]);
        let intentos = 0;
        while (colocadas.some((w) => !this.compatibles(u, w)) && intentos++ < 400) u.y += 1;
        colocadas.push(u);
        y = u.y + k[3] + 1;
        ancho = Math.max(ancho, k[2] - k[0]);
      }
      x += Math.ceil(ancho) + 3;
    }
  }

  /** The topology's own drawing as the start: anchored units where the template puts them, the others in
   *  compact columns below it. */
  private inicialAnclado(anclas: { u: number; pin: number; x: number; y: number }[]): void {
    const colocadas: Unidad[] = [];
    const fijas = new Set<number>();
    for (const a of anclas) {
      const u = this.us[a.u]!;
      let mejor = 0;
      u.vars.forEach((v, i) => {
        if (v.coste < u.vars[mejor]!.coste) mejor = i;
      });
      u.v = mejor;
      const g = u.vars[u.v]!.pines[a.pin]!;
      const x0 = a.x - g.x;
      const y0 = a.y - g.y;
      // Nearest free spot around the anchor (labels may need a little room).
      let hecho = false;
      for (let r = 0; r <= 4 && !hecho; r++)
        for (let dy = -r; dy <= r && !hecho; dy++)
          for (let dx = -r; dx <= r && !hecho; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            u.x = x0 + dx;
            u.y = y0 + dy;
            hecho = colocadas.every((w) => this.compatibles(u, w));
          }
      if (!hecho) continue;
      fijas.add(u.id);
      colocadas.push(u);
    }
    let fondo = -Infinity;
    for (const u of colocadas) fondo = Math.max(fondo, u.y + u.vars[u.v]!.caja[3]);
    let x = 0;
    for (const u of this.us) {
      if (fijas.has(u.id)) continue;
      let mejor = 0;
      u.vars.forEach((v, i) => {
        if (v.coste < u.vars[mejor]!.coste) mejor = i;
      });
      u.v = mejor;
      const k = u.vars[u.v]!.caja;
      u.x = Math.round(x - k[0]);
      u.y = Math.round(fondo + 2 - k[1]);
      let intentos = 0;
      while (colocadas.some((w) => !this.compatibles(u, w)) && intentos++ < 400) u.y += 1;
      colocadas.push(u);
      x += Math.ceil(k[2] - k[0]) + 2;
    }
  }

  /** Layered start on a grid: one column per rank, one band per row (the chains of a logic circuit); parts
   *  without a row go where their column has room. */
  private inicialFilas(rango: number[], fila: number[]): void {
    for (const u of this.us) {
      let mejor = 0;
      u.vars.forEach((v, i) => {
        if (v.coste < u.vars[mejor]!.coste) mejor = i;
      });
      u.v = mejor;
    }
    const alto = Math.max(...this.us.map((u) => u.vars[u.v]!.caja[3] - u.vars[u.v]!.caja[1])) + 2;
    const cols = [...new Set(rango)].sort((a, b) => a - b);
    const colocadas: Unidad[] = [];
    let x = 0;
    for (const c of cols) {
      const col = this.us.filter((u) => rango[u.id] === c).sort((a, b) => (fila[a.id]! < 0 ? 1e9 : fila[a.id]!) - (fila[b.id]! < 0 ? 1e9 : fila[b.id]!) || a.id - b.id);
      let ancho = 0;
      let libre = 0;
      for (const u of col) {
        const k = u.vars[u.v]!.caja;
        u.x = Math.round(x - k[0]);
        u.y = Math.round((fila[u.id]! >= 0 ? fila[u.id]! * alto : libre) - k[1]);
        let intentos = 0;
        while (colocadas.some((w) => !this.compatibles(u, w)) && intentos++ < 400) u.y += 1;
        colocadas.push(u);
        libre = u.y + k[3] + 1;
        ancho = Math.max(ancho, k[2] - k[0]);
      }
      x += Math.ceil(ancho) + 4;
    }
  }

  /**
   * 0.8, incremental re-layout: the units with a place in `desde` (x, y, variant; from the previous layout of
   * the edited circuit) keep it while it stays valid; each other unit goes, in its cheapest variant, to the
   * nearest free spot around the mean position of the placed units it shares a net with (else right of
   * everything). Returns how many units kept their place.
   */
  inicialDesde(desde: (readonly [number, number, number] | null)[]): number {
    const colocadas: Unidad[] = [];
    let quedan = 0;
    const libres: Unidad[] = [];
    for (const u of this.us) {
      const p = desde[u.id];
      if (p && p[2] < u.vars.length) {
        [u.x, u.y, u.v] = p;
        if (colocadas.every((w) => this.compatibles(u, w))) {
          colocadas.push(u);
          quedan++;
          continue;
        }
      }
      libres.push(u);
    }
    let x1 = 0;
    for (const u of colocadas) x1 = Math.max(x1, u.x + u.vars[u.v]!.caja[2]);
    for (const u of libres) {
      let mejor = 0;
      u.vars.forEach((v, i) => {
        if (v.coste < u.vars[mejor]!.coste) mejor = i;
      });
      u.v = mejor;
      // Mean position of the placed units on its nets.
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (const k of this.redesDe[u.id]!)
        for (const [w] of this.c.pinesRed[k]!) {
          const o = this.us[w]!;
          if (o === u || !colocadas.includes(o)) continue;
          sx += o.x;
          sy += o.y;
          n++;
        }
      const cx = n ? Math.round(sx / n) : Math.ceil(x1) + 2;
      const cy = n ? Math.round(sy / n) : 0;
      let hecho = false;
      for (let r = 0; r <= 16 && !hecho; r++)
        for (let dy = -r; dy <= r && !hecho; dy++)
          for (let dx = -r; dx <= r && !hecho; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            u.x = cx + dx;
            u.y = cy + dy;
            hecho = colocadas.every((w) => this.compatibles(u, w));
          }
      if (!hecho) {
        u.x = Math.ceil(x1) + 2;
        u.y = 0;
        let intentos = 0;
        while (colocadas.some((w) => !this.compatibles(u, w)) && intentos++ < 400) u.y += 1;
      }
      colocadas.push(u);
      x1 = Math.max(x1, u.x + u.vars[u.v]!.caja[2]);
    }
    return quedan;
  }

  private inicialColumnas(): void {
    const colocadas: Unidad[] = [];
    const columnas = new Map<number, number>();
    const orden = [...this.us].sort((a, b) => this.rangoUnidad(a) - this.rangoUnidad(b) || a.id - b.id);
    for (const u of orden) {
      let mejor = 0;
      u.vars.forEach((v, i) => {
        if (v.coste < u.vars[mejor]!.coste) mejor = i;
      });
      u.v = mejor;
      const col = this.rangoUnidad(u);
      u.x = col * 5;
      u.y = columnas.get(col) ?? 0;
      let intentos = 0;
      while (colocadas.some((w) => !this.compatibles(u, w)) && intentos++ < 400) u.y += 1;
      colocadas.push(u);
      columnas.set(col, u.y + 4);
    }
  }

  private rangoUnidad(u: Unidad): number {
    if (this.reglas?.rangoU) return this.reglas.rangoU[u.id]!;
    let m = Infinity;
    for (const p of u.pines) if (p.red >= 0) m = Math.min(m, this.c.rango[p.red]!);
    return Number.isFinite(m) ? m : 0;
  }

  // -------------------------------------------------------------- annealing

  /** Simulated annealing; `rapido` (live layout) stops once the best has not improved for a while. */
  recocer(iteraciones: number, T0 = 3.5, T1 = 0.03, rapido = false): void {
    this.costeTotal();
    const us = this.us;
    if (us.length < 2 && us.every((u) => u.vars.length === 1)) return;
    let mejorCoste = this.coste;
    const mejor = new Float64Array(3 * us.length);
    const guardar = () => {
      for (let i = 0; i < us.length; i++) {
        const w = us[i]!;
        mejor[3 * i] = w.x;
        mejor[3 * i + 1] = w.y;
        mejor[3 * i + 2] = w.v;
      }
    };
    guardar();
    let ultimaMejora = 0;
    const quieto = Math.max(1500, iteraciones * 0.2);
    const rnd = this.rnd;
    for (let it = 0; it < iteraciones; it++) {
      if (rapido && it > iteraciones * 0.4 && it - ultimaMejora > quieto) break;
      const T = T0 * Math.pow(T1 / T0, it / iteraciones);
      const u = us[Math.floor(rnd() * us.length)]!;
      const ax = u.x;
      const ay = u.y;
      const av = u.v;
      let otro: Unidad | null = null;
      let ox = 0;
      let oy = 0;
      const r = rnd();
      const paso = Math.max(1, Math.round(4 * (T / T0)));
      let sacudir = false;
      if (r < 0.28) sacudir = true;
      else if (r < 0.46 && u.vars.length > 1) {
        u.v = Math.floor(rnd() * u.vars.length);
        if (rnd() < 0.6) this.alinear(u);
      } else if (r < 0.9) {
        if (u.vars.length > 1 && rnd() < 0.2) u.v = Math.floor(rnd() * u.vars.length);
        if (!this.alinear(u)) sacudir = true;
      } else {
        otro = us[Math.floor(rnd() * us.length)]!;
        if (otro === u) continue;
        ox = otro.x;
        oy = otro.y;
        otro.x = u.x;
        otro.y = u.y;
        u.x = ox;
        u.y = oy;
      }
      if (sacudir) {
        u.x += Math.round((rnd() * 2 - 1) * paso);
        u.y += Math.round((rnd() * 2 - 1) * paso);
      }
      if (u.x === ax && u.y === ay && u.v === av && !otro) continue;
      if (!this.valida(u) || (otro && !this.valida(otro))) {
        u.x = ax;
        u.y = ay;
        u.v = av;
        if (otro) {
          otro.x = ox;
          otro.y = oy;
        }
        continue;
      }
      const d = this.delta(u, otro);
      if (d <= 0 || rnd() < Math.exp(-d / T)) {
        this.confirmar();
        if (this.coste < mejorCoste - 1e-9) {
          mejorCoste = this.coste;
          ultimaMejora = it;
          guardar();
        }
      } else {
        u.x = ax;
        u.y = ay;
        u.v = av;
        this.refrescar(u);
        if (otro) {
          otro.x = ox;
          otro.y = oy;
          this.refrescar(otro);
        }
      }
    }
    for (let i = 0; i < us.length; i++) {
      const w = us[i]!;
      w.x = mejor[3 * i]!;
      w.y = mejor[3 * i + 1]!;
      w.v = mejor[3 * i + 2]!;
    }
    this.costeTotal();
  }

  /**
   * Removes empty bands: a row (or column) of the grid that no part spans is closed by shifting everything
   * past it, as long as the result stays valid and the cost does not grow. Long empty wires disappear.
   */
  compactar(): void {
    this.costeTotal();
    for (let vuelta = 0; vuelta < 60; vuelta++) {
      let cambio = false;
      for (const eje of [1, 0] as const) {
        const lo = Math.min(...this.us.map((u) => u.vars[u.v]!.caja[eje] + (eje ? u.y : u.x)));
        const hi = Math.max(...this.us.map((u) => u.vars[u.v]!.caja[eje + 2]! + (eje ? u.y : u.x)));
        for (let c = Math.floor(lo); c < Math.ceil(hi); c++) {
          // Is the band (c, c + 1) free of every part?
          const libre = this.us.every((u) => {
            const k = u.vars[u.v]!.caja;
            const a = k[eje]! + (eje ? u.y : u.x);
            const b = k[eje + 2]! + (eje ? u.y : u.x);
            return b <= c + 1e-6 || a >= c + 1 - 1e-6;
          });
          if (!libre) continue;
          const mover = this.us.filter((u) => u.vars[u.v]!.caja[eje]! + (eje ? u.y : u.x) >= c + 1 - 1e-6);
          if (!mover.length || mover.length === this.us.length) continue;
          const antes = this.coste;
          for (const u of mover) eje ? u.y-- : u.x--;
          const ok = mover.every((u) => this.valida(u));
          const nuevo = ok ? this.costeTotal() : Infinity;
          if (nuevo <= antes + 0.3) {
            cambio = true;
          } else {
            for (const u of mover) eje ? u.y++ : u.x++;
            this.costeTotal();
          }
        }
      }
      if (!cambio) break;
    }
  }

  /** Moves `u` so that one of its signal pins lines up with (or touches) a pin of the same net. */
  private alinear(u: Unidad): boolean {
    const mios = this.senal[u.id]!;
    if (!mios.length) return false;
    const i = mios[Math.floor(this.rnd() * mios.length)]!;
    const red = u.pines[i]!.red;
    // The net's other pins (not of this unit): pick one at random.
    const lista = this.pinesRedF[red]!;
    let n = 0;
    for (let q = 0; q < lista.length; q += 2) if (lista[q] !== u.id) n++;
    if (!n) return false;
    let elegido = Math.floor(this.rnd() * n);
    let oi = -1;
    let op = -1;
    for (let q = 0; q < lista.length; q += 2) {
      if (lista[q] === u.id) continue;
      if (elegido-- === 0) {
        oi = lista[q]!;
        op = lista[q + 1]!;
        break;
      }
    }
    const w = this.us[oi]!;
    const gq = w.vars[w.v]!.pines[op]!;
    const qx = gq.x + w.x;
    const qy = gq.y + w.y;
    const gm = u.vars[u.v]!.pines[i]!;
    const mx = gm.x + u.x;
    const my = gm.y + u.y;
    const r = this.rnd();
    if (r < 0.3 && gm.dx === -gq.dx && gm.dy === -gq.dy) {
      u.x += qx - mx;
      u.y += qy - my;
    } else if (r < 0.55) {
      const d = 1 + Math.floor(this.rnd() * 3);
      u.x += qx + gq.dx * d - mx;
      u.y += qy + gq.dy * d - my;
    } else if (r < 0.78) u.x += qx - mx;
    else u.y += qy - my;
    return true;
  }
}

/** Point strictly inside one of the rectangles (flat array). */
function enRects(px: number, py: number, r: Float64Array): boolean {
  for (let i = 0; i < r.length; i += 4) if (px > r[i]! && px < r[i + 2]! && py > r[i + 1]! && py < r[i + 3]!) return true;
  return false;
}

/** Writes the axis-aligned segment (x0, y0)–(x1, y1) at `o` (nothing for a point); returns the next offset. */
function seg(s: Float64Array, o: number, x0: number, y0: number, x1: number, y1: number, ua: number, ub: number): number {
  if (x0 === x1 && y0 === y1) return o;
  if (y0 === y1) {
    s[o] = Math.min(x0, x1);
    s[o + 1] = Math.max(x0, x1);
    s[o + 2] = y0;
    s[o + 3] = 1;
  } else {
    s[o] = Math.min(y0, y1);
    s[o + 1] = Math.max(y0, y1);
    s[o + 2] = x0;
    s[o + 3] = 0;
  }
  s[o + 4] = ua;
  s[o + 5] = ub;
  return o + PASO_SEG;
}
