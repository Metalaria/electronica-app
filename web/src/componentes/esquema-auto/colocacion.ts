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
  return anchoTexto(s.replace(/[0-9]+(?:[,.][0-9]+)?(\s?)[pnµumkMGT]?(?=[A-Za-zΩ])/g, '8,88$1k').replace(/[0-9]+(?:[,.][0-9]+)?/g, '8,88'), TAM_ETQ);
}

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
  // Flat arrays.
  const rf = new Float64Array(rects.flat());
  const pf = new Float64Array(patas.flatMap(([a, b]) => rectLinea(a, b, 0.02)));
  const qf = new Float64Array(pines.flatMap((g, i) => [g.x, g.y, g.dx, g.dy, u.pines[i]!.red]));
  const obst: [Rect, number][] = [[cuerpo, 1]];
  if (etq) obst.push([etq.rect, 0.35]);
  for (const t of talones) obst.push([t.rect, 0.6]);
  const of = new Float64Array(obst.flatMap(([r]) => r));
  const ow = new Float64Array(obst.map(([, w]) => w));
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
    for (const vv of variantes(d)) u.vars.push(construirVariante(u, simboloDe(d, vv.v), vv.o, vv.coste));
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

interface EstadoRed {
  coste: number;
  segs: Float64Array;
  /** Bounding box of the segments (early outs). */
  bx0: number;
  by0: number;
  bx1: number;
  by1: number;
}

function conCaja(coste: number, l: number[]): EstadoRed {
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  for (let i = 0; i < l.length; i += PASO_SEG) {
    const h = l[i + 3] === 1;
    const x0 = h ? l[i]! : l[i + 2]!;
    const x1 = h ? l[i + 1]! : l[i + 2]!;
    const y0 = h ? l[i + 2]! : l[i]!;
    const y1 = h ? l[i + 2]! : l[i + 1]!;
    if (x0 < bx0) bx0 = x0;
    if (x1 > bx1) bx1 = x1;
    if (y0 < by0) by0 = y0;
    if (y1 > by1) by1 = y1;
  }
  return { coste, segs: new Float64Array(l), bx0, by0, bx1, by1 };
}

/** Adds the segment (x0, y0)–(x1, y1) (axis-aligned) to a flat list. */
function anadirSeg(l: number[], x0: number, y0: number, x1: number, y1: number, ua: number, ub: number): void {
  if (x0 === x1 && y0 === y1) return;
  if (y0 === y1) l.push(Math.min(x0, x1), Math.max(x0, x1), y0, 1, ua, ub);
  else l.push(Math.min(y0, y1), Math.max(y0, y1), x0, 0, ua, ub);
}


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

/** Crossings (perpendicular, strictly inside both; 1 each) and overlaps (collinear; 1.5) of two segment lists. */
function crucesListas(a: Float64Array, b: Float64Array): number {
  let c = 0;
  for (let i = 0; i < a.length; i += PASO_SEG) {
    const alo = a[i]!;
    const ahi = a[i + 1]!;
    const ac = a[i + 2]!;
    const ah = a[i + 3]!;
    for (let j = 0; j < b.length; j += PASO_SEG) {
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


interface Pendiente {
  coste: number;
  redes: Map<number, EstadoRed>;
  costeRed: Map<number, number>;
  cuerpo: [number, number, number][];
  cruces: [number, number, number][];
  unidades: [number, number][];
  area: number;
  /** Changed rule costs: [rule index, new cost]; and the new total. */
  reglas: [number, number][];
  reglasTotal: number;
}

export class Colocador {
  readonly c: Componente;
  readonly us: Unidad[];
  private rnd: () => number;
  coste = 0;
  // Caches of the cost terms.
  private redes: EstadoRed[] = [];
  private costeRedes: number[] = [];
  /** Body hits of net k's estimated wires on unit u. */
  private cuerpo: number[][] = [];
  private cruces: number[][] = [];
  private costeUnidades: number[] = [];
  private costeArea = 0;
  private pendiente: Pendiente | null = null;
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
    for (const w of this.us) if (w !== u && !this.compatibles(u, w)) return false;
    return true;
  }

  // -------------------------------------------------------------- cost terms

  private costeUnidad(u: Unidad): number {
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

  private estadoRed(k: number): EstadoRed {
    let ps = this.c.pinesRed[k]!;
    // A net drawn with labels has no wires to estimate (nor have the pins labelled one by one).
    if (this.reglas?.etiquetarPines?.size) ps = ps.filter(([u, i]) => !this.reglas!.etiquetarPines!.has(`${u},${i}`));
    const n = ps.length;
    if (n < 2 || this.reglas?.etiquetar.has(k)) return conCaja(0, []);
    const g = ps.map(([ui, pi]) => this.pin(this.us[ui]!, pi));
    // Prim's rectilinear MST.
    const en = new Array<boolean>(n).fill(false);
    const dist = new Array<number>(n).fill(Infinity);
    const de = new Array<number>(n).fill(-1);
    dist[0] = 0;
    let coste = 0;
    const segs: number[] = [];
    for (let it = 0; it < n; it++) {
      let m = -1;
      for (let i = 0; i < n; i++) if (!en[i] && (m < 0 || dist[i]! < dist[m]!)) m = i;
      en[m] = true;
      if (de[m]! >= 0) coste += costeArista(g[de[m]!]!, g[m]!, segs, ps[de[m]!]![0], ps[m]![0]);
      for (let i = 0; i < n; i++) {
        if (en[i]) continue;
        const d = Math.abs(g[i]!.x - g[m]!.x) + Math.abs(g[i]!.y - g[m]!.y);
        if (d < dist[i]!) {
          dist[i] = d;
          de[i] = m;
        }
      }
    }
    // Flow between parts: a part of lower rank should sit left of the parts it feeds on this net.
    for (let i = 0; i < n; i++) {
      const ui = this.us[ps[i]![0]]!;
      const ri = this.rangoU[ui.id]!;
      const ci = ui.x + (ui.vars[ui.v]!.caja[0] + ui.vars[ui.v]!.caja[2]) / 2;
      for (let j = 0; j < n; j++) {
        const uj = this.us[ps[j]![0]]!;
        if (uj === ui || this.rangoU[uj.id]! <= ri) continue;
        const cj = uj.x + (uj.vars[uj.v]!.caja[0] + uj.vars[uj.v]!.caja[2]) / 2;
        if (ci > cj) coste += PESO.flujoU * (ci - cj);
      }
    }
    return conCaja(coste, segs);
  }

  private golpes(red: EstadoRed, u: Unidad): number {
    const v = u.vars[u.v]!;
    const k0 = v.caja;
    if (!red.segs.length || red.bx0 >= k0[2] + u.x || red.bx1 <= k0[0] + u.x || red.by0 >= k0[3] + u.y || red.by1 <= k0[1] + u.y) return 0;
    const segs = red.segs;
    let c = 0;
    const of = v.of;
    const ow = v.ow;
    const ux = u.x;
    const uy = u.y;
    const e = 1e-6;
    for (let i = 0; i < segs.length; i += PASO_SEG) {
      if (u.id === segs[i + 4] || u.id === segs[i + 5]) continue;
      const lo = segs[i]!;
      const hi = segs[i + 1]!;
      const cc = segs[i + 2]!;
      const h = segs[i + 3] === 1;
      for (let k = 0, w = 0; k < of.length; k += 4, w++) {
        const r0 = of[k]! + ux;
        const r1 = of[k + 1]! + uy;
        const r2 = of[k + 2]! + ux;
        const r3 = of[k + 3]! + uy;
        const toca = h ? cc > r1 + e && cc < r3 - e && lo < r2 - e && hi > r0 + e : cc > r0 + e && cc < r2 - e && lo < r3 - e && hi > r1 + e;
        if (toca) {
          c += ow[w]!;
          break;
        }
      }
    }
    return c;
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
    const nr = this.c.redes.length;
    this.redes = [];
    this.costeRedes = [];
    for (let k = 0; k < nr; k++) {
      const e = this.estadoRed(k);
      this.redes.push(e);
      this.costeRedes.push(e.coste);
    }
    this.cuerpo = this.redes.map((e) => this.us.map((u) => this.golpes(e, u)));
    this.cruces = Array.from({ length: nr }, () => new Array<number>(nr).fill(0));
    for (let k = 0; k < nr; k++)
      for (let j = k + 1; j < nr; j++) this.cruces[k]![j] = this.cruces[j]![k] = crucesEntre(this.redes[k]!, this.redes[j]!);
    this.costeUnidades = this.us.map((u) => this.costeUnidad(u));
    this.costeArea = this.area();
    this.costeReglasV = 0;
    for (let i = 0; i < this.costeRegla.length; i++) this.costeReglasV += this.costeRegla[i] = this.reglaI(i);
    let c = this.costeArea + this.costeReglasV;
    for (const x of this.costeUnidades) c += x;
    for (let k = 0; k < nr; k++) {
      c += this.costeRedes[k]!;
      for (const g of this.cuerpo[k]!) c += PESO.cuerpo * g;
      for (let j = k + 1; j < nr; j++) c += PESO.cruce * this.cruces[k]![j]!;
    }
    this.coste = c;
    return c;
  }

  /** Change of cost after moving `movidas` (already moved); keeps the new terms pending. */
  private delta(movidas: Unidad[]): number {
    const nr = this.c.redes.length;
    const A = new Set<number>();
    for (const u of movidas) for (const k of this.redesDe[u.id]!) A.add(k);
    const p: Pendiente = { coste: 0, redes: new Map(), costeRed: new Map(), cuerpo: [], cruces: [], unidades: [], area: 0, reglas: [], reglasTotal: 0 };
    let d = 0;
    for (const k of A) {
      const e = this.estadoRed(k);
      p.redes.set(k, e);
      d += e.coste - this.costeRedes[k]!;
      for (const u of this.us) {
        const g = this.golpes(e, u);
        if (g !== this.cuerpo[k]![u.id]) {
          d += PESO.cuerpo * (g - this.cuerpo[k]![u.id]!);
          p.cuerpo.push([k, u.id, g]);
        }
      }
    }
    for (let k = 0; k < nr; k++) {
      if (A.has(k)) continue;
      for (const u of movidas) {
        const g = this.golpes(this.redes[k]!, u);
        if (g !== this.cuerpo[k]![u.id]) {
          d += PESO.cuerpo * (g - this.cuerpo[k]![u.id]!);
          p.cuerpo.push([k, u.id, g]);
        }
      }
    }
    for (const k of A) {
      const a = p.redes.get(k)!;
      for (let j = 0; j < nr; j++) {
        if (j === k || (A.has(j) && j < k)) continue;
        const x = crucesEntre(a, p.redes.get(j) ?? this.redes[j]!);
        d += PESO.cruce * (x - this.cruces[k]![j]!);
        p.cruces.push([k, j, x]);
      }
    }
    for (const u of movidas) {
      const c = this.costeUnidad(u);
      d += c - this.costeUnidades[u.id]!;
      p.unidades.push([u.id, c]);
    }
    p.area = this.area();
    d += p.area - this.costeArea;
    if (this.reglas) {
      // Only the rules touching the moved units change.
      const vistas = new Set<number>();
      let dr = 0;
      for (const u of movidas)
        for (const i of this.reglasDeUnidad[u.id]!) {
          if (vistas.has(i)) continue;
          vistas.add(i);
          const n = this.reglaI(i);
          if (n !== this.costeRegla[i]) {
            dr += n - this.costeRegla[i]!;
            p.reglas.push([i, n]);
          }
        }
      p.reglasTotal = this.costeReglasV + dr;
      d += dr;
    }
    p.coste = this.coste + d;
    this.pendiente = p;
    return d;
  }

  private confirmar(): void {
    const p = this.pendiente!;
    for (const [k, e] of p.redes) {
      this.redes[k] = e;
      this.costeRedes[k] = e.coste;
    }
    for (const [k, u, g] of p.cuerpo) this.cuerpo[k]![u] = g;
    for (const [k, j, x] of p.cruces) this.cruces[k]![j] = this.cruces[j]![k] = x;
    for (const [u, c] of p.unidades) this.costeUnidades[u] = c;
    this.costeArea = p.area;
    if (this.reglas) {
      for (const [i, n] of p.reglas) this.costeRegla[i] = n;
      this.costeReglasV = p.reglasTotal;
    }
    this.coste = p.coste;
    this.pendiente = null;
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
    let mejor = us.map((u) => [u.x, u.y, u.v] as const);
    let ultimaMejora = 0;
    const quieto = Math.max(1500, iteraciones * 0.2);
    for (let it = 0; it < iteraciones; it++) {
      if (rapido && it > iteraciones * 0.4 && it - ultimaMejora > quieto) break;
      const T = T0 * Math.pow(T1 / T0, it / iteraciones);
      const u = us[Math.floor(this.rnd() * us.length)]!;
      const antes = { x: u.x, y: u.y, v: u.v };
      let otro: Unidad | null = null;
      let otroAntes: { x: number; y: number } | null = null;
      const r = this.rnd();
      const paso = Math.max(1, Math.round(4 * (T / T0)));
      const sacudir = () => {
        u.x += Math.round((this.rnd() * 2 - 1) * paso);
        u.y += Math.round((this.rnd() * 2 - 1) * paso);
      };
      if (r < 0.28) sacudir();
      else if (r < 0.46 && u.vars.length > 1) {
        u.v = Math.floor(this.rnd() * u.vars.length);
        if (this.rnd() < 0.6) this.alinear(u);
      } else if (r < 0.9) {
        if (u.vars.length > 1 && this.rnd() < 0.2) u.v = Math.floor(this.rnd() * u.vars.length);
        if (!this.alinear(u)) sacudir();
      } else {
        otro = us[Math.floor(this.rnd() * us.length)]!;
        if (otro === u) continue;
        otroAntes = { x: otro.x, y: otro.y };
        [u.x, otro.x] = [otro.x, u.x];
        [u.y, otro.y] = [otro.y, u.y];
      }
      const deshacer = () => {
        u.x = antes.x;
        u.y = antes.y;
        u.v = antes.v;
        if (otro && otroAntes) {
          otro.x = otroAntes.x;
          otro.y = otroAntes.y;
        }
      };
      if (u.x === antes.x && u.y === antes.y && u.v === antes.v && !otro) continue;
      if (!this.valida(u) || (otro && !this.valida(otro))) {
        deshacer();
        continue;
      }
      const d = this.delta(otro ? [u, otro] : [u]);
      if (d <= 0 || this.rnd() < Math.exp(-d / T)) {
        this.confirmar();
        if (this.coste < mejorCoste - 1e-9) {
          mejorCoste = this.coste;
          ultimaMejora = it;
          mejor = us.map((w) => [w.x, w.y, w.v] as const);
        }
      } else {
        this.pendiente = null;
        deshacer();
      }
    }
    us.forEach((w, i) => {
      [w.x, w.y, w.v] = mejor[i]!;
    });
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
    const mios = u.pines.map((p, i) => ({ p, i })).filter((x) => x.p.red >= 0);
    if (!mios.length) return false;
    const { p, i } = mios[Math.floor(this.rnd() * mios.length)]!;
    const otros = this.c.pinesRed[p.red]!.filter(([ui]) => ui !== u.id);
    if (!otros.length) return false;
    const [oi, op] = otros[Math.floor(this.rnd() * otros.length)]!;
    const q = this.pin(this.us[oi]!, op);
    const mi = this.pin(u, i);
    const r = this.rnd();
    if (r < 0.3 && mi.dx === -q.dx && mi.dy === -q.dy) {
      u.x += q.x - mi.x;
      u.y += q.y - mi.y;
    } else if (r < 0.55) {
      const d = 1 + Math.floor(this.rnd() * 3);
      u.x += q.x + q.dx * d - mi.x;
      u.y += q.y + q.dy * d - mi.y;
    } else if (r < 0.78) u.x += q.x - mi.x;
    else u.y += q.y - mi.y;
    return true;
  }
}

/** Point strictly inside one of the rectangles (flat array). */
function enRects(px: number, py: number, r: Float64Array): boolean {
  for (let i = 0; i < r.length; i += 4) if (px > r[i]! && px < r[i + 2]! && py > r[i + 1]! && py < r[i + 3]!) return true;
  return false;
}

function crucesEntre(a: EstadoRed, b: EstadoRed): number {
  if (!a.segs.length || !b.segs.length || a.bx0 > b.bx1 || b.bx0 > a.bx1 || a.by0 > b.by1 || b.by0 > a.by1) return 0;
  return crucesListas(a.segs, b.segs);
}

function costeArista(a: PinGeo, b: PinGeo, segs: number[], ua: number, ub: number): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return 0;
  let c = Math.abs(dx) + Math.abs(dy);
  if (dx !== 0 && dy !== 0) c += PESO.bend;
  if (dx * a.dx + dy * a.dy < 0) c += PESO.atras;
  if (-dx * b.dx - dy * b.dy < 0) c += PESO.atras;
  // L-shaped estimate: leave `a` along its own axis first.
  if (dx !== 0 && dy !== 0) {
    if (a.dx !== 0) {
      anadirSeg(segs, a.x, a.y, b.x, a.y, ua, -1);
      anadirSeg(segs, b.x, a.y, b.x, b.y, -1, ub);
    } else {
      anadirSeg(segs, a.x, a.y, a.x, b.y, ua, -1);
      anadirSeg(segs, a.x, b.y, b.x, b.y, -1, ub);
    }
  } else anadirSeg(segs, a.x, a.y, b.x, b.y, ua, ub);
  return c;
}
