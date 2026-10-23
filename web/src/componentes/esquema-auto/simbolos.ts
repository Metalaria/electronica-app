// Symbol library of the automatic schematics, in the book's style (schemdraw with IEC resistors, as in
// figure 11.3 of the book). Local coordinates in drawing units, y DOWN, pins on the integer grid. A
// two-terminal part goes from `start` (0, 0) to `end` (2, 0).

import type { Dispositivo, TipoSimbolo } from './modelo.ts';

export type Pt = [number, number];
export type Rect = [number, number, number, number]; // x0, y0, x1, y1

export interface PinDef {
  x: number;
  y: number;
  /** Outward direction of the lead (unit vector on an axis). */
  dx: number;
  dy: number;
}

/** Drawing primitives. Signs, glyphs and texts are drawn upright whatever the orientation. */
export type Prim =
  | { t: 'l'; p: Pt[]; cerrado?: boolean; relleno?: 'tinta' | 'fondo'; fino?: boolean }
  | { t: 'c'; c: Pt; r: number; relleno?: 'tinta' | 'fondo'; fino?: boolean }
  | { t: 'signo'; c: Pt; s: '+' | '-' }
  | { t: 'glifo'; c: Pt; g: 'sin' | 'cuadrada' | 'pwl' }
  | { t: 'texto'; c: Pt; s: string; ancla: 'start' | 'middle' | 'end'; tam: number; negrita?: boolean; ref?: boolean };

export interface DefSimbolo {
  pines: Record<string, PinDef>;
  /** Drawn body (without leads) for clearance tests. */
  cuerpo: Rect;
  /** Leads: segments from each pin to the body. */
  patas: [Pt, Pt][];
  prims: Prim[];
  /** Where the label goes: a point on the body's edge and the outward direction. */
  etq: { x: number; y: number; dx: number; dy: number };
  /** Two-terminal part along x (start → end). */
  dos: boolean;
}

// ------------------------------------------------------------------ orientation

/**
 * Orientation code 0–7: bit 2 mirrors (y → −y) first, then (o & 3) quarter turns clockwise on screen
 * ((x, y) → (−y, x) each).
 */
export function girar(o: number, x: number, y: number): Pt {
  let a = x;
  let b = o & 4 ? -y : y;
  for (let k = 0; k < (o & 3); k++) {
    const t = a;
    a = -b;
    b = t;
  }
  return [a + 0, b + 0];
}

export function girarRect(o: number, r: Rect): Rect {
  const [ax, ay] = girar(o, r[0], r[1]);
  const [bx, by] = girar(o, r[2], r[3]);
  return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)];
}

// ------------------------------------------------------------------ helpers

const L = 2; // two-terminal length

function arco(cx: number, cy: number, r: number, a0: number, a1: number, n = 16): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return p;
}

/** Arrow head at `b` pointing from `a` to `b`. */
function punta(a: Pt, b: Pt, largo = 0.2, ancho = 0.075): Prim {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const n = Math.hypot(dx, dy) || 1;
  const ux = dx / n;
  const uy = dy / n;
  const base: Pt = [b[0] - ux * largo, b[1] - uy * largo];
  return {
    t: 'l',
    p: [b, [base[0] - uy * ancho, base[1] + ux * ancho], [base[0] + uy * ancho, base[1] - ux * ancho]],
    cerrado: true,
    relleno: 'tinta',
  };
}

function flecha(a: Pt, b: Pt, largo = 0.2, ancho = 0.075): Prim[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const n = Math.hypot(dx, dy) || 1;
  const fin: Pt = [b[0] - (dx / n) * largo * 0.6, b[1] - (dy / n) * largo * 0.6];
  return [{ t: 'l', p: [a, fin] }, punta(a, b, largo, ancho)];
}

function dosTerminales(a: number, b: number, alto: number, prims: Prim[], etqAlto = alto): DefSimbolo {
  return {
    pines: { start: { x: 0, y: 0, dx: -1, dy: 0 }, end: { x: L, y: 0, dx: 1, dy: 0 } },
    cuerpo: [a, -alto, b, alto],
    patas: [
      [[0, 0], [a, 0]],
      [[b, 0], [L, 0]],
    ],
    prims: [
      { t: 'l', p: [[0, 0], [a, 0]] },
      { t: 'l', p: [[b, 0], [L, 0]] },
      ...prims,
    ],
    etq: { x: L / 2, y: -etqAlto, dx: 0, dy: -1 },
    dos: true,
  };
}

// ------------------------------------------------------------------ two-terminal parts

function resistor(): DefSimbolo {
  return dosTerminales(0.5, 1.5, 0.18, [{ t: 'l', p: [[0.5, -0.18], [1.5, -0.18], [1.5, 0.18], [0.5, 0.18]], cerrado: true }]);
}

function condensador(): DefSimbolo {
  return dosTerminales(0.9, 1.1, 0.3, [
    { t: 'l', p: [[0.9, -0.3], [0.9, 0.3]] },
    { t: 'l', p: [[1.1, -0.3], [1.1, 0.3]] },
  ]);
}

function bobina(): DefSimbolo {
  // schemdraw Inductor2: four loops of a prolate cycloid above the axis.
  const n = 4;
  const x0 = 0.5;
  const paso = 1 / n;
  const r = 0.16;
  const p: Pt[] = [];
  const M = n * 20;
  for (let i = 0; i <= M; i++) {
    const t = (i / M) * 2 * Math.PI * n;
    p.push([x0 + (paso * t) / (2 * Math.PI) + r * Math.sin(t) * 0.9, -r * (1 - Math.cos(t)) * 1.05]);
  }
  p[0] = [x0, 0];
  p[p.length - 1] = [x0 + 1, 0];
  const d = dosTerminales(0.5, 1.5, 0.34, [{ t: 'l', p }]);
  d.cuerpo = [0.38, -0.36, 1.62, 0.04];
  d.etq = { x: 1, y: -0.36, dx: 0, dy: -1 };
  return d;
}

function fuente(dentro: Prim[]): DefSimbolo {
  return dosTerminales(0.5, 1.5, 0.5, [{ t: 'c', c: [1, 0], r: 0.5 }, ...dentro]);
}

function fuenteV(g: 'dc' | 'sin' | 'cuadrada' | 'pwl'): DefSimbolo {
  if (g === 'dc')
    return fuente([
      { t: 'signo', c: [1.24, 0], s: '+' },
      { t: 'signo', c: [0.76, 0], s: '-' },
    ]);
  return fuente([{ t: 'glifo', c: [1, 0], g }]);
}

function fuenteI(g: 'dc' | 'sin' | 'cuadrada'): DefSimbolo {
  const pr: Prim[] = [...flecha([0.68, 0], [1.34, 0], 0.22, 0.09)];
  if (g !== 'dc') pr.push({ t: 'glifo', c: [1, 0.3], g });
  return fuente(pr);
}

function diodo(tipo: 'D' | 'DZ' | 'LED' | 'DS'): DefSimbolo {
  const a = 0.82;
  const b = 1.18;
  const h = 0.25;
  const pr: Prim[] = [{ t: 'l', p: [[a, -h], [b, 0], [a, h]], cerrado: true, relleno: 'fondo' }];
  if (tipo === 'DZ') pr.push({ t: 'l', p: [[b - 0.09, -h - 0.06], [b, -h], [b, h], [b + 0.09, h + 0.06]] });
  else if (tipo === 'DS') pr.push({ t: 'l', p: [[b + 0.08, -h + 0.08], [b + 0.08, -h], [b, -h], [b, h], [b - 0.08, h], [b - 0.08, h - 0.08]] });
  else pr.push({ t: 'l', p: [[b, -h], [b, h]] });
  let alto = h;
  if (tipo === 'LED') {
    pr.push(...flecha([0.9, -0.32], [1.08, -0.62], 0.13, 0.055), ...flecha([1.08, -0.32], [1.26, -0.62], 0.13, 0.055));
    alto = 0.64;
  }
  const d = dosTerminales(a, b, h, pr, alto);
  if (tipo === 'LED') d.cuerpo = [a, -0.64, 1.3, h];
  return d;
}

function dependiente(tension: boolean): DefSimbolo {
  const pr: Prim[] = [{ t: 'l', p: [[0.5, 0], [1, -0.5], [1.5, 0], [1, 0.5]], cerrado: true }];
  if (tension)
    pr.push(
      { t: 'signo', c: [1.22, 0], s: '+' },
      { t: 'signo', c: [0.78, 0], s: '-' },
    );
  else pr.push(...flecha([0.7, 0], [1.32, 0], 0.2, 0.08));
  return dosTerminales(0.5, 1.5, 0.5, pr);
}

function interruptor(): DefSimbolo {
  const d = dosTerminales(0.6, 1.4, 0.1, [
    { t: 'c', c: [0.66, 0], r: 0.07, relleno: 'fondo' },
    { t: 'c', c: [1.34, 0], r: 0.07, relleno: 'fondo' },
    { t: 'l', p: [[0.72, -0.03], [1.36, -0.36]] },
  ]);
  d.patas = [
    [[0, 0], [0.59, 0]],
    [[1.41, 0], [L, 0]],
  ];
  d.prims[0] = { t: 'l', p: [[0, 0], [0.59, 0]] };
  d.prims[1] = { t: 'l', p: [[1.41, 0], [L, 0]] };
  d.cuerpo = [0.58, -0.4, 1.42, 0.08];
  d.etq = { x: 1, y: -0.42, dx: 0, dy: -1 };
  return d;
}

// ------------------------------------------------------------------ transistors

function bjt(pnp: boolean): DefSimbolo {
  // base (−1, 0), collector (0, −1), emitter (0, 1); circle as schemdraw's Bjt with circle=True.
  const bx = -0.42;
  const pr: Prim[] = [
    { t: 'c', c: [-0.17, 0], r: 0.6 },
    { t: 'l', p: [[-1, 0], [bx, 0]] },
    { t: 'l', p: [[bx, -0.34], [bx, 0.34]] },
    { t: 'l', p: [[bx, -0.16], [0, -0.48], [0, -1]] },
    { t: 'l', p: [[bx, 0.16], [0, 0.48], [0, 1]] },
  ];
  if (pnp) pr.push(punta([0, 0.48], [bx + 0.03, 0.18], 0.2, 0.08));
  else pr.push(punta([bx, 0.16], [-0.02, 0.465], 0.2, 0.08));
  return {
    pines: {
      base: { x: -1, y: 0, dx: -1, dy: 0 },
      collector: { x: 0, y: -1, dx: 0, dy: -1 },
      emitter: { x: 0, y: 1, dx: 0, dy: 1 },
    },
    cuerpo: [-0.77, -0.6, 0.43, 0.6],
    patas: [
      [[-1, 0], [-0.77, 0]],
      [[0, -1], [0, -0.6]],
      [[0, 1], [0, 0.6]],
    ],
    prims: pr,
    etq: { x: 0.45, y: 0, dx: 1, dy: 0 },
    dos: false,
  };
}

function mosfet(p: boolean, bulk: boolean): DefSimbolo {
  // gate (−1, 0), drain (0, −1), source (0, 1), bulk (1, 0) when it is not tied to the source.
  const g = -0.55;
  const c = -0.4;
  const pr: Prim[] = [
    { t: 'l', p: [[-1, 0], [g, 0]] },
    { t: 'l', p: [[g, -0.42], [g, 0.42]] },
    { t: 'l', p: [[c, -0.46], [c, -0.22]] },
    { t: 'l', p: [[c, -0.12], [c, 0.12]] },
    { t: 'l', p: [[c, 0.22], [c, 0.46]] },
    { t: 'l', p: [[c, -0.34], [0, -0.34], [0, -1]] },
    { t: 'l', p: [[c, 0.34], [0, 0.34], [0, 1]] },
  ];
  if (bulk) pr.push({ t: 'l', p: [[c, 0], [1, 0]] });
  else pr.push({ t: 'l', p: [[c, 0], [0, 0], [0, 0.34]] });
  if (p) pr.push(punta([c + 0.02, 0], [-0.08, 0], 0.2, 0.08));
  else pr.push(punta([-0.08, 0], [c + 0.02, 0], 0.2, 0.08));
  const pines: Record<string, PinDef> = {
    gate: { x: -1, y: 0, dx: -1, dy: 0 },
    drain: { x: 0, y: -1, dx: 0, dy: -1 },
    source: { x: 0, y: 1, dx: 0, dy: 1 },
  };
  const patas: [Pt, Pt][] = [
    [[-1, 0], [g, 0]],
    [[0, -1], [0, -0.5]],
    [[0, 1], [0, 0.5]],
  ];
  if (bulk) {
    pines['bulk'] = { x: 1, y: 0, dx: 1, dy: 0 };
    patas.push([[1, 0], [0.1, 0]]);
  }
  return { pines, cuerpo: [-0.6, -0.5, 0.1, 0.5], patas, prims: pr, etq: { x: 0.12, y: -0.5, dx: 1, dy: 0 }, dos: false };
}

function jfet(p: boolean): DefSimbolo {
  const c = -0.4;
  const pr: Prim[] = [
    { t: 'l', p: [[c, -0.46], [c, 0.46]] },
    { t: 'l', p: [[c, -0.3], [0, -0.3], [0, -1]] },
    { t: 'l', p: [[c, 0.3], [0, 0.3], [0, 1]] },
  ];
  if (p) pr.push({ t: 'l', p: [[-1, 0.3], [c - 0.18, 0.3]] }, punta([c, 0.3], [-0.98 + 0.4, 0.3], 0.2, 0.08));
  else pr.push({ t: 'l', p: [[-1, 0.3], [c - 0.18, 0.3]] }, punta([-0.9, 0.3], [c, 0.3], 0.2, 0.08));
  const d: DefSimbolo = {
    pines: {
      gate: { x: -1, y: 0, dx: -1, dy: 0 },
      drain: { x: 0, y: -1, dx: 0, dy: -1 },
      source: { x: 0, y: 1, dx: 0, dy: 1 },
    },
    cuerpo: [-0.6, -0.5, 0.1, 0.5],
    patas: [
      [[-1, 0], [-1, 0.3]],
      [[0, -1], [0, -0.5]],
      [[0, 1], [0, 0.5]],
    ],
    prims: [{ t: 'l', p: [[-1, 0], [-1, 0.3]] }, ...pr],
    etq: { x: 0.12, y: -0.5, dx: 1, dy: 0 },
    dos: false,
  };
  return d;
}

// ------------------------------------------------------------------ op-amp, boxes, gates

function opamp(masArriba: boolean, alim: { vd: boolean; vs: boolean }): DefSimbolo {
  // in1 (−) and in2 (+) on the left, out on the right; supply pins above and below.
  const yMenos = masArriba ? 1 : -1;
  const yMas = -yMenos;
  const pr: Prim[] = [
    { t: 'l', p: [[0.5, -1.6], [3.5, 0], [0.5, 1.6]], cerrado: true },
    { t: 'l', p: [[0, -1], [0.5, -1]] },
    { t: 'l', p: [[0, 1], [0.5, 1]] },
    { t: 'l', p: [[3.5, 0], [4, 0]] },
    { t: 'signo', c: [0.84, yMenos], s: '-' },
    { t: 'signo', c: [0.84, yMas], s: '+' },
  ];
  const pines: Record<string, PinDef> = {
    in1: { x: 0, y: yMenos, dx: -1, dy: 0 },
    in2: { x: 0, y: yMas, dx: -1, dy: 0 },
    out: { x: 4, y: 0, dx: 1, dy: 0 },
  };
  const patas: [Pt, Pt][] = [
    [[0, -1], [0.5, -1]],
    [[0, 1], [0.5, 1]],
    [[3.5, 0], [4, 0]],
  ];
  // Triangle edge at x = 2: |y| = 1.6·(1 − 1.5/3) = 0.8.
  if (alim.vd) {
    pines['vd'] = { x: 2, y: -2, dx: 0, dy: -1 };
    pr.push({ t: 'l', p: [[2, -2], [2, -0.8]] });
    patas.push([[2, -2], [2, -0.8]]);
  }
  if (alim.vs) {
    pines['vs'] = { x: 2, y: 2, dx: 0, dy: 1 };
    pr.push({ t: 'l', p: [[2, 2], [2, 0.8]] });
    patas.push([[2, 2], [2, 0.8]]);
  }
  return { pines, cuerpo: [0.5, -1.6, 3.5, 1.6], patas, prims: pr, etq: { x: 2.9, y: -0.75, dx: 1, dy: -1 }, dos: false };
}

export interface LadoPines {
  izq: { nombre: string; rotulo: string }[];
  der: { nombre: string; rotulo: string }[];
  arr: { nombre: string; rotulo: string }[];
  aba: { nombre: string; rotulo: string }[];
}

/** Text width in drawing units of a string at font size `tam` (Source Sans 3, approximate). */
export function anchoTexto(s: string, tam: number): number {
  let w = 0;
  for (const ch of s) {
    if (/[ilj.,:;'|!·]/.test(ch)) w += 0.26;
    else if (/[ftrI ()\-−/]/.test(ch)) w += 0.36;
    else if (/[mwMWΩ∿µ…→]/.test(ch)) w += 0.82;
    else if (/[A-Z]/.test(ch)) w += 0.6;
    else w += 0.5;
  }
  return w * tam;
}

export const TAM_PIN = 0.3;

function caja(lados: LadoPines, titulo: string): DefSimbolo {
  const ni = lados.izq.length;
  const nd = lados.der.length;
  const na = lados.arr.length;
  const nb = lados.aba.length;
  const filas = Math.max(ni, nd, 1);
  const anchoRot = (xs: { rotulo: string }[]) => Math.max(0, ...xs.map((x) => anchoTexto(x.rotulo, TAM_PIN)));
  const interior = anchoRot(lados.izq) + anchoRot(lados.der) + 0.5;
  const ancho = Math.max(2, Math.ceil(Math.max(interior, na, nb, 0) + (na || nb ? 1 : 0)), Math.ceil(anchoTexto(titulo, 0.36) - 0.4));
  const alto = filas + 1;
  const x0 = 1;
  const x1 = 1 + ancho;
  const pines: Record<string, PinDef> = {};
  const patas: [Pt, Pt][] = [];
  const pr: Prim[] = [{ t: 'l', p: [[x0, 0], [x1, 0], [x1, alto], [x0, alto]], cerrado: true }];
  const yIzq = (i: number, n: number) => (n === filas ? i + 1 : Math.round(((i + 1) * alto) / (n + 1)));
  lados.izq.forEach((p, i) => {
    const y = yIzq(i, ni);
    pines[p.nombre] = { x: 0, y, dx: -1, dy: 0 };
    patas.push([[0, y], [x0, y]]);
    pr.push({ t: 'l', p: [[0, y], [x0, y]] }, { t: 'texto', c: [x0 + 0.12, y], s: p.rotulo, ancla: 'start', tam: TAM_PIN });
  });
  lados.der.forEach((p, i) => {
    const y = yIzq(i, nd);
    pines[p.nombre] = { x: x1 + 1, y, dx: 1, dy: 0 };
    patas.push([[x1 + 1, y], [x1, y]]);
    pr.push({ t: 'l', p: [[x1, y], [x1 + 1, y]] }, { t: 'texto', c: [x1 - 0.12, y], s: p.rotulo, ancla: 'end', tam: TAM_PIN });
  });
  lados.arr.forEach((p, i) => {
    const x = x0 + Math.round(((i + 1) * ancho) / (na + 1));
    pines[p.nombre] = { x, y: -1, dx: 0, dy: -1 };
    patas.push([[x, -1], [x, 0]]);
    pr.push({ t: 'l', p: [[x, -1], [x, 0]] }, { t: 'texto', c: [x, 0.3], s: p.rotulo, ancla: 'middle', tam: TAM_PIN });
  });
  lados.aba.forEach((p, i) => {
    const x = x0 + Math.round(((i + 1) * ancho) / (nb + 1));
    pines[p.nombre] = { x, y: alto + 1, dx: 0, dy: 1 };
    patas.push([[x, alto + 1], [x, alto]]);
    pr.push({ t: 'l', p: [[x, alto], [x, alto + 1]] }, { t: 'texto', c: [x, alto - 0.3], s: p.rotulo, ancla: 'middle', tam: TAM_PIN });
  });
  return { pines, cuerpo: [x0, 0, x1, alto], patas, prims: pr, etq: { x: x0, y: 0, dx: 0, dy: -1 }, dos: false };
}

const SIGNO_PUERTA: Record<string, [string, boolean]> = {
  AND: ['&', false],
  NAND: ['&', true],
  OR: ['≥1', false],
  NOR: ['≥1', true],
  XOR: ['=1', false],
  XNOR: ['=1', true],
  NOT: ['1', true],
  BUF: ['1', false],
};

function puertaIEC(tipo: string, entradas: string[], salidas: string[]): DefSimbolo {
  const [signo, negada] = SIGNO_PUERTA[tipo] ?? ['?', false];
  const n = Math.max(entradas.length, 1);
  const alto = Math.max(2, n + 1);
  const x0 = 1;
  const x1 = 3;
  const pines: Record<string, PinDef> = {};
  const patas: [Pt, Pt][] = [];
  const pr: Prim[] = [
    { t: 'l', p: [[x0, 0], [x1, 0], [x1, alto], [x0, alto]], cerrado: true },
    { t: 'texto', c: [(x0 + x1) / 2, 0.55], s: signo, ancla: 'middle', tam: 0.42 },
  ];
  entradas.forEach((nm, i) => {
    const y = n === 1 ? alto / 2 : Math.round(((i + 1) * alto) / (n + 1));
    pines[nm] = { x: 0, y, dx: -1, dy: 0 };
    patas.push([[0, y], [x0, y]]);
    pr.push({ t: 'l', p: [[0, y], [x0, y]] });
  });
  salidas.forEach((nm, i) => {
    const y = salidas.length === 1 ? Math.round(alto / 2) : i + 1;
    pines[nm] = { x: x1 + 1, y, dx: 1, dy: 0 };
    patas.push([[x1 + 1, y], [x1, y]]);
    if (negada && i === 0) pr.push({ t: 'c', c: [x1 + 0.1, y], r: 0.1, relleno: 'fondo' }, { t: 'l', p: [[x1 + 0.2, y], [x1 + 1, y]] });
    else pr.push({ t: 'l', p: [[x1, y], [x1 + 1, y]] });
  });
  return { pines, cuerpo: [x0, 0, x1, alto], patas, prims: pr, etq: { x: 2, y: 0, dx: 0, dy: -1 }, dos: false };
}

function lineaTransmision(): DefSimbolo {
  const pr: Prim[] = [
    { t: 'l', p: [[1.15, -0.32], [2.85, -0.32]] },
    { t: 'l', p: [[1.15, 0.32], [2.85, 0.32]] },
    ...[1.15, 2.85].map((cx): Prim => ({ t: 'l', p: arco(cx, 0, 0.32, -Math.PI / 2, (3 * Math.PI) / 2, 24).map(([x, y]) => [cx + (x - cx) * 0.35, y] as Pt), cerrado: true })),
    { t: 'l', p: [[0, 0], [1.15, 0]] },
    { t: 'l', p: [[2.85, 0], [4, 0]] },
    { t: 'l', p: [[0, 1], [1.4, 1], [1.4, 0.32]] },
    { t: 'l', p: [[4, 1], [2.6, 1], [2.6, 0.32]] },
  ];
  return {
    pines: {
      a: { x: 0, y: 0, dx: -1, dy: 0 },
      a_ref: { x: 0, y: 1, dx: -1, dy: 0 },
      b: { x: 4, y: 0, dx: 1, dy: 0 },
      b_ref: { x: 4, y: 1, dx: 1, dy: 0 },
    },
    cuerpo: [1, -0.35, 3, 0.35],
    patas: [
      [[0, 0], [1, 0]],
      [[4, 0], [3, 0]],
      [[0, 1], [1.4, 1]],
      [[4, 1], [2.6, 1]],
    ],
    prims: pr,
    etq: { x: 2, y: -0.36, dx: 0, dy: -1 },
    dos: false,
  };
}

/** Coil drawn vertically from (x, y0) to (x, y1) with loops towards +x (lado 1) or −x (lado −1). */
function bobinaVertical(x: number, y0: number, y1: number, lado: 1 | -1): Pt[] {
  const n = 4;
  const largo = y1 - y0;
  const paso = largo / n;
  const r = 0.15;
  const p: Pt[] = [];
  const M = n * 20;
  for (let i = 0; i <= M; i++) {
    const t = (i / M) * 2 * Math.PI * n;
    p.push([x + lado * r * (1 - Math.cos(t)) * 1.05, y0 + (paso * t) / (2 * Math.PI) + r * Math.sin(t) * 0.9 * (largo / Math.abs(largo))]);
  }
  p[0] = [x, y0];
  p[p.length - 1] = [x, y1];
  return p;
}

/** Transformer: primary coil on the left, the other coils stacked on the right. Pins «l1.start»… */
export function transformador(bobinas: Dispositivo[]): DefSimbolo {
  const pines: Record<string, PinDef> = {};
  const patas: [Pt, Pt][] = [];
  const pr: Prim[] = [];
  const [prim, ...sec] = bobinas;
  const nSec = Math.max(1, sec.length);
  const alto = nSec * 3 - 1;
  const p = prim!.clave;
  pines[`${p}.start`] = { x: 0, y: 0, dx: -1, dy: 0 };
  pines[`${p}.end`] = { x: 0, y: 2, dx: -1, dy: 0 };
  pr.push({ t: 'l', p: [[0, 0], [0.9, 0], [0.9, 0.3]] }, { t: 'l', p: bobinaVertical(0.9, 0.3, 1.7, 1) }, { t: 'l', p: [[0.9, 1.7], [0.9, 2], [0, 2]] });
  patas.push([[0, 0], [0.9, 0]], [[0, 2], [0.9, 2]]);
  sec.forEach((b, i) => {
    const y = i * 3;
    pines[`${b.clave}.start`] = { x: 3, y, dx: 1, dy: 0 };
    pines[`${b.clave}.end`] = { x: 3, y: y + 2, dx: 1, dy: 0 };
    pr.push({ t: 'l', p: [[3, y], [2.1, y], [2.1, y + 0.3]] }, { t: 'l', p: bobinaVertical(2.1, y + 0.3, y + 1.7, -1) }, { t: 'l', p: [[2.1, y + 1.7], [2.1, y + 2], [3, y + 2]] });
    patas.push([[3, y], [2.1, y]], [[3, y + 2], [2.1, y + 2]]);
  });
  pr.push({ t: 'l', p: [[1.42, 0.1], [1.42, alto - 0.1]] }, { t: 'l', p: [[1.58, 0.1], [1.58, alto - 0.1]] });
  // Dot convention: both coils start at the dotted end.
  pr.push({ t: 'c', c: [0.62, 0.28], r: 0.06, relleno: 'tinta' });
  sec.forEach((_, i) => pr.push({ t: 'c', c: [2.38, i * 3 + 0.28], r: 0.06, relleno: 'tinta' }));
  return { pines, cuerpo: [0.85, 0, 2.15, Math.max(2, alto)], patas, prims: pr, etq: { x: 1.5, y: 0, dx: 0, dy: -1 }, dos: false };
}

/** Corners of the diode bridge diamond. */
export const ESQUINAS_PUENTE: Record<'a' | 'b' | 'p' | 'n', Pt> = { a: [0, 2], b: [4, 2], p: [2, 0], n: [2, 4] };

/** Full-wave diode bridge drawn as the classic diamond, every diode pointing to p. */
function puenteDiodos(d: Dispositivo): DefSimbolo {
  const pr: Prim[] = [];
  for (const x of d.diodos ?? []) {
    const A = ESQUINAS_PUENTE[x.anodo];
    const K = ESQUINAS_PUENTE[x.catodo];
    const L = Math.hypot(K[0] - A[0], K[1] - A[1]);
    const u: Pt = [(K[0] - A[0]) / L, (K[1] - A[1]) / L];
    const w: Pt = [-u[1], u[0]];
    const M: Pt = [(A[0] + K[0]) / 2, (A[1] + K[1]) / 2];
    const h = 0.25;
    const b0: Pt = [M[0] - u[0] * 0.18, M[1] - u[1] * 0.18];
    const t0: Pt = [M[0] + u[0] * 0.18, M[1] + u[1] * 0.18];
    pr.push(
      { t: 'l', p: [A, b0] },
      { t: 'l', p: [t0, K] },
      { t: 'l', p: [[b0[0] + w[0] * h, b0[1] + w[1] * h], t0, [b0[0] - w[0] * h, b0[1] - w[1] * h]], cerrado: true, relleno: 'fondo' },
      { t: 'l', p: [[t0[0] + w[0] * h, t0[1] + w[1] * h], [t0[0] - w[0] * h, t0[1] - w[1] * h]] },
    );
    // Name outside the diamond.
    const o: Pt = [M[0] - 2, M[1] - 2];
    const n = Math.hypot(o[0], o[1]) || 1;
    const c: Pt = [M[0] + (o[0] / n) * 0.5, M[1] + (o[1] / n) * 0.5 + 0.12];
    pr.push({ t: 'texto', c, s: x.d.nombre, ancla: o[0] < 0 ? 'end' : 'start', tam: 0.36, ref: true });
  }
  return {
    pines: {
      a: { x: 0, y: 2, dx: -1, dy: 0 },
      b: { x: 4, y: 2, dx: 1, dy: 0 },
      p: { x: 2, y: 0, dx: 0, dy: -1 },
      n: { x: 2, y: 4, dx: 0, dy: 1 },
    },
    cuerpo: [0.25, 0.25, 3.75, 3.75],
    patas: [],
    prims: pr,
    etq: { x: 2, y: 0, dx: 1, dy: -1 },
    dos: false,
  };
}

// ------------------------------------------------------------------ catalogue

export function simboloDe(d: Dispositivo, variante = 0): DefSimbolo {
  const s: TipoSimbolo = d.simbolo;
  switch (s) {
    case 'R':
      return resistor();
    case 'C':
      return condensador();
    case 'L':
      return bobina();
    case 'VDC':
      return fuenteV('dc');
    case 'VSIN':
      return fuenteV('sin');
    case 'VPULSO':
      return fuenteV('cuadrada');
    case 'VPWL':
      return fuenteV('pwl');
    case 'IDC':
      return fuenteI('dc');
    case 'ISIN':
      return fuenteI('sin');
    case 'IPULSO':
      return fuenteI('cuadrada');
    case 'D':
    case 'DZ':
    case 'LED':
    case 'DS':
      return diodo(s);
    case 'NPN':
    case 'PNP':
      return bjt(s === 'PNP');
    case 'NMOS':
    case 'PMOS':
      return mosfet(s === 'PMOS', d.pines.some((p) => p.nombre === 'bulk'));
    case 'NJF':
    case 'PJF':
      return jfet(s === 'PJF');
    case 'DEPV':
      return dependiente(true);
    case 'DEPI':
      return dependiente(false);
    case 'SW':
      return interruptor();
    case 'TL':
      return lineaTransmision();
    case 'OPAMP': {
      const extra = d.pines.filter((p) => !['in1', 'in2', 'out', 'vd', 'vs'].includes(p.nombre));
      if (extra.length) return simboloCaja(d);
      return opamp(variante === 1, { vd: d.pines.some((p) => p.nombre === 'vd'), vs: d.pines.some((p) => p.nombre === 'vs') });
    }
    case 'PUERTA': {
      const salidas = d.pines.filter((p, i) => i === d.pines.length - 1 || /^(n?q|y|out|o)$/i.test(p.rotulo ?? ''));
      const sal = salidas.length && salidas.length < d.pines.length ? salidas : [d.pines[d.pines.length - 1]!];
      const ent = d.pines.filter((p) => !sal.includes(p));
      return puertaIEC(d.titulo ?? '', ent.map((p) => p.nombre), sal.map((p) => p.nombre));
    }
    case 'TRAFO':
      return transformador(d.bobinas ?? []);
    case 'PUENTE':
      return puenteDiodos(d);
    case 'CAJA':
      return simboloCaja(d);
  }
}

function simboloCaja(d: Dispositivo): DefSimbolo {
  const lados: LadoPines = { izq: [], der: [], arr: [], aba: [] };
  for (const p of d.pines) {
    const rot = p.rotulo ?? p.nombre;
    const lado = ladoDe(rot, p.nombre);
    lados[lado].push({ nombre: p.nombre, rotulo: rot });
  }
  // Balance: never everything on one side when there are several pins.
  if (!lados.der.length && lados.izq.length >= 2) lados.der.push(lados.izq.pop()!);
  if (lados.der.length > lados.izq.length + 2) while (lados.der.length > lados.izq.length + 1) lados.izq.push(lados.der.shift()!);
  if (lados.izq.length > lados.der.length + 3) while (lados.izq.length > lados.der.length + 1) lados.der.unshift(lados.izq.pop()!);
  return caja(lados, d.titulo ?? '');
}

function ladoDe(rotulo: string, nombre: string): keyof LadoPines {
  void nombre;
  const n = rotulo.toLowerCase();
  // Flip-flops (XSPICE): set above, reset below, outputs right.
  if (rotulo === 'S' || rotulo === 'R') return rotulo === 'S' ? 'arr' : 'aba';
  if (rotulo === 'Q' || rotulo === 'nQ') return 'der';
  if (/^(vcc|vdd|v\+|vp|vpos|pwr|alim\+?|vs\+?)$/.test(n)) return 'arr';
  if (/^(gnd|vee|vss|v-|vn|vneg|tierra|alim-)$/.test(n)) return 'aba';
  if (/^(out|o|y|q|nq|qn|qb|vo|vout|salida|sal|outp|outn|o\d+|y\d+|q\d+|k|cat|catodo|b|vb|2|3)$/.test(n) || /^(out|sal)/.test(n)) {
    if (/^(2|3|b|vb)$/.test(n)) return 'der';
    return 'der';
  }
  if (/^(pos)$/.test(n)) return 'der';
  if (/^(neg)$/.test(n)) return 'der';
  return 'izq';
}

/** Variants a part can take: [symbol variant, orientation, cost]. */
export function variantes(d: Dispositivo): { v: number; o: number; coste: number }[] {
  const todas = (c: (o: number) => number) => [0, 1, 2, 3, 4, 5, 6, 7].map((o) => ({ v: 0, o, coste: c(o) }));
  switch (d.simbolo) {
    case 'NPN':
    case 'NMOS':
    case 'NJF':
      return [
        { v: 0, o: 0, coste: 0 },
        { v: 0, o: 6, coste: 1 },
        { v: 0, o: 4, coste: 4 },
        { v: 0, o: 2, coste: 4 },
      ];
    case 'PNP':
    case 'PMOS':
    case 'PJF':
      return [
        { v: 0, o: 4, coste: 0 },
        { v: 0, o: 2, coste: 1 },
        { v: 0, o: 0, coste: 4 },
        { v: 0, o: 6, coste: 4 },
      ];
    case 'OPAMP':
      if (d.pines.some((p) => !['in1', 'in2', 'out', 'vd', 'vs'].includes(p.nombre))) return [{ v: 0, o: 0, coste: 0 }];
      return [
        { v: 0, o: 0, coste: 0 },
        { v: 1, o: 0, coste: 0.3 },
      ];
    case 'CAJA':
    case 'PUERTA':
    case 'TRAFO':
      return [{ v: 0, o: 0, coste: 0 }];
    case 'PUENTE':
      // p up (classic), p to the right, then the others.
      return [
        { v: 0, o: 0, coste: 0 },
        { v: 0, o: 1, coste: 0.4 },
        { v: 0, o: 3, coste: 0.4 },
        { v: 0, o: 2, coste: 1.5 },
      ];
    case 'TL':
      return [{ v: 0, o: 0, coste: 0 }];
    case 'VDC':
    case 'VSIN':
    case 'VPULSO':
    case 'VPWL':
    case 'IDC':
    case 'ISIN':
    case 'IPULSO':
    case 'DEPV':
    case 'DEPI':
      // Sources: vertical with «+» (or the arrow) upwards.
      return todas((o) => ((o & 3) === 3 ? 0 : (o & 3) === 1 ? 1.5 : 2.5));
    case 'D':
    case 'DZ':
    case 'LED':
    case 'DS':
      return todas((o) => ((o & 3) === 2 ? 0.6 : 0));
    default:
      return todas(() => 0);
  }
}
