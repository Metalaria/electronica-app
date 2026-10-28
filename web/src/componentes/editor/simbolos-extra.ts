// Symbols of the palette parts added in 0.10 (switches drawn in their state, push buttons, relay, transformer
// with a centre tap, sensors and loads, crystal, text notes), in the book's style: the same line weights and
// proportions as esquema-auto/simbolos.ts (IEC resistor 1 × 0,36, two-terminal parts 2 units long, pins on the
// integer grid, y down). Plain data for geometria.ts.

import type { DefSimbolo, PinDef, Prim, Pt } from '../esquema-auto/simbolos.ts';

const L = 2;

function arco(cx: number, cy: number, r: number, a0: number, a1: number, n = 16): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return p;
}

/** Filled arrow head at `b`, pointing from `a`. */
function punta(a: Pt, b: Pt, largo = 0.16, ancho = 0.06): Prim {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const n = Math.hypot(dx, dy) || 1;
  const ux = dx / n;
  const uy = dy / n;
  const base: Pt = [b[0] - ux * largo, b[1] - uy * largo];
  return { t: 'l', p: [b, [base[0] - uy * ancho, base[1] + ux * ancho], [base[0] + uy * ancho, base[1] - ux * ancho]], cerrado: true, relleno: 'tinta' };
}

function flecha(a: Pt, b: Pt, largo = 0.16, ancho = 0.06): Prim[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const n = Math.hypot(dx, dy) || 1;
  return [{ t: 'l', p: [a, [b[0] - (dx / n) * largo * 0.6, b[1] - (dy / n) * largo * 0.6]] }, punta(a, b, largo, ancho)];
}

/** A dashed straight line (mechanical linkage), as short segments. */
function discontinua(a: Pt, b: Pt, trazo = 0.14, hueco = 0.1): Prim[] {
  const L0 = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / L0;
  const uy = (b[1] - a[1]) / L0;
  const res: Prim[] = [];
  for (let s = 0; s < L0 - 1e-6; s += trazo + hueco) {
    const e = Math.min(L0, s + trazo);
    res.push({ t: 'l', p: [[a[0] + ux * s, a[1] + uy * s], [a[0] + ux * e, a[1] + uy * e]] });
  }
  return res;
}

const pin = (x: number, y: number, dx: number, dy: number): PinDef => ({ x, y, dx, dy });

/** Two-terminal part from (0, 0) to (2, 0) with leads up to a and from b. */
function dos(a: number, b: number, cuerpo: DefSimbolo['cuerpo'], prims: Prim[], etq: DefSimbolo['etq'] = { x: 1, y: cuerpo[1], dx: 0, dy: -1 }): DefSimbolo {
  return {
    pines: { start: pin(0, 0, -1, 0), end: pin(L, 0, 1, 0) },
    cuerpo,
    patas: [
      [[0, 0], [a, 0]],
      [[b, 0], [L, 0]],
    ],
    prims: [{ t: 'l', p: [[0, 0], [a, 0]] }, { t: 'l', p: [[b, 0], [L, 0]] }, ...prims],
    etq,
    dos: true,
  };
}

const contacto = (c: Pt): Prim => ({ t: 'c', c, r: 0.07, relleno: 'fondo' });

// ------------------------------------------------------------------ switches

/** SPST switch drawn open or closed (the book's symbol, with its state). */
export function interruptor(cerrado: boolean): DefSimbolo {
  const d = dos(0.59, 1.41, [0.58, -0.4, 1.42, 0.08], [contacto([0.66, 0]), contacto([1.34, 0]), { t: 'l', p: [[0.72, -0.03], cerrado ? [1.31, -0.08] : [1.36, -0.36]] }], { x: 1, y: -0.42, dx: 0, dy: -1 });
  return d;
}

/** Changeover (SPDT): common on the left, contact 1 up-right, contact 2 down-right. */
export function conmutador(posicion: 'a' | 'b'): DefSimbolo {
  const ya = posicion === 'a' ? -1 : 1;
  return {
    pines: { com: pin(0, 0, -1, 0), c1: pin(L, -1, 1, 0), c2: pin(L, 1, 1, 0) },
    cuerpo: [0.58, -1.1, 1.48, 1.1],
    patas: [
      [[0, 0], [0.59, 0]],
      [[1.47, -1], [L, -1]],
      [[1.47, 1], [L, 1]],
    ],
    prims: [
      { t: 'l', p: [[0, 0], [0.59, 0]] },
      { t: 'l', p: [[1.47, -1], [L, -1]] },
      { t: 'l', p: [[1.47, 1], [L, 1]] },
      contacto([0.66, 0]),
      contacto([1.4, -1]),
      contacto([1.4, 1]),
      { t: 'l', p: [[0.71, ya * 0.05], [1.35, ya * 0.9]] },
      { t: 'texto', c: [1.62, -0.72], s: '1', ancla: 'start', tam: 0.28 },
      { t: 'texto', c: [1.62, 0.72], s: '2', ancla: 'start', tam: 0.28 },
    ],
    etq: { x: 0.66, y: 0.2, dx: 0, dy: 1 },
    dos: false,
  };
}

/** Push button (IEC): normally open or normally closed, drawn released or pressed. */
export function pulsador(nc: boolean, pulsado: boolean): DefSimbolo {
  // Contact bridge height: NO released −0,32 (gap), pressed −0,1 (touching); NC released +0,1, pressed +0,34.
  const y = nc ? (pulsado ? 0.34 : 0.1) : pulsado ? -0.1 : -0.32;
  const prims: Prim[] = [
    contacto([0.66, 0]),
    contacto([1.34, 0]),
    { t: 'l', p: [[0.52, y], [1.48, y]] },
    { t: 'l', p: [[1, y], [1, -0.74]] },
    { t: 'l', p: [[0.82, -0.74], [1.18, -0.74]] },
  ];
  return dos(0.59, 1.41, [0.52, -0.76, 1.48, 0.4], prims, { x: 1, y: -0.78, dx: 0, dy: -1 });
}

/** Relay: coil on the left (pins b1 up, b2 down), changeover contact on the right (com down, nc and no up). */
export function rele(): DefSimbolo {
  const prims: Prim[] = [
    { t: 'l', p: [[0, -1], [0, -0.55]] },
    { t: 'l', p: [[0, 0.55], [0, 1]] },
    { t: 'l', p: [[-0.35, -0.55], [0.35, -0.55], [0.35, 0.55], [-0.35, 0.55]], cerrado: true },
    // contacts
    { t: 'l', p: [[2, 1], [2, 0.57]] },
    { t: 'l', p: [[1, -1], [1, -0.57]] },
    { t: 'l', p: [[3, -1], [3, -0.57]] },
    contacto([2, 0.5]),
    contacto([1, -0.5]),
    contacto([3, -0.5]),
    // blade resting on the normally closed contact (coil not energised)
    { t: 'l', p: [[1.97, 0.44], [1.08, -0.44]] },
    ...discontinua([0.35, 0], [1.5, 0]),
    { t: 'texto', c: [0.82, -0.72], s: 'NC', ancla: 'end', tam: 0.24 },
    { t: 'texto', c: [3.18, -0.72], s: 'NA', ancla: 'start', tam: 0.24 },
  ];
  return {
    pines: { b1: pin(0, -1, 0, -1), b2: pin(0, 1, 0, 1), com: pin(2, 1, 0, 1), nc: pin(1, -1, 0, -1), no: pin(3, -1, 0, -1) },
    cuerpo: [-0.35, -0.6, 3.1, 0.6],
    patas: [
      [[0, -1], [0, -0.55]],
      [[0, 0.55], [0, 1]],
      [[2, 1], [2, 0.57]],
      [[1, -1], [1, -0.57]],
      [[3, -1], [3, -0.57]],
    ],
    prims,
    etq: { x: -0.42, y: 0, dx: -1, dy: 0 },
    dos: false,
  };
}

// ------------------------------------------------------------------ transformer with a centre tap

/** Coil drawn vertically from (x, y0) to (x, y1) with loops towards +x (lado 1) or −x (lado −1). */
function bobinaVertical(x: number, y0: number, y1: number, lado: 1 | -1, n = 4): Pt[] {
  const largo = y1 - y0;
  const paso = largo / n;
  const r = 0.15;
  const p: Pt[] = [];
  const M = n * 20;
  for (let i = 0; i <= M; i++) {
    const t = (i / M) * 2 * Math.PI * n;
    p.push([x + lado * r * (1 - Math.cos(t)) * 1.05, y0 + (paso * t) / (2 * Math.PI) + r * Math.sin(t) * 0.9]);
  }
  p[0] = [x, y0];
  p[p.length - 1] = [x, y1];
  return p;
}

/** Primary on the left (pins p.start, p.end), secondary on the right in two halves with its centre tap s.mid. */
export function transformadorToma(): DefSimbolo {
  const prims: Prim[] = [
    { t: 'l', p: [[0, 1], [0.9, 1], [0.9, 1.3]] },
    { t: 'l', p: bobinaVertical(0.9, 1.3, 2.7, 1) },
    { t: 'l', p: [[0.9, 2.7], [0.9, 3], [0, 3]] },
    { t: 'l', p: [[3, 0], [2.1, 0], [2.1, 0.3]] },
    { t: 'l', p: bobinaVertical(2.1, 0.3, 1.7, -1) },
    { t: 'l', p: [[2.1, 1.7], [2.1, 2.3]] },
    { t: 'l', p: [[2.1, 2], [3, 2]] },
    { t: 'l', p: bobinaVertical(2.1, 2.3, 3.7, -1) },
    { t: 'l', p: [[2.1, 3.7], [2.1, 4], [3, 4]] },
    { t: 'l', p: [[1.42, 0.1], [1.42, 3.9]] },
    { t: 'l', p: [[1.58, 0.1], [1.58, 3.9]] },
    { t: 'c', c: [0.62, 1.28], r: 0.06, relleno: 'tinta' },
    { t: 'c', c: [2.38, 0.28], r: 0.06, relleno: 'tinta' },
  ];
  return {
    pines: { 'p.start': pin(0, 1, -1, 0), 'p.end': pin(0, 3, -1, 0), 's.start': pin(3, 0, 1, 0), 's.mid': pin(3, 2, 1, 0), 's.end': pin(3, 4, 1, 0) },
    cuerpo: [0.85, 0, 2.15, 4],
    patas: [
      [[0, 1], [0.9, 1]],
      [[0, 3], [0.9, 3]],
      [[3, 0], [2.1, 0]],
      [[3, 2], [2.1, 2]],
      [[3, 4], [2.1, 4]],
    ],
    prims,
    etq: { x: 1.5, y: 0, dx: 0, dy: -1 },
    dos: false,
  };
}

// ------------------------------------------------------------------ sensors and loads

const RESISTOR: Prim = { t: 'l', p: [[0.5, -0.18], [1.5, -0.18], [1.5, 0.18], [0.5, 0.18]], cerrado: true };

/** Light-dependent resistor: the resistor with two arrows of light falling on it. */
export function ldr(): DefSimbolo {
  return dos(0.5, 1.5, [0.28, -0.86, 1.5, 0.18], [RESISTOR, ...flecha([0.3, -0.84], [0.72, -0.28]), ...flecha([0.72, -0.84], [1.14, -0.28])], { x: 1, y: 0.2, dx: 0, dy: 1 });
}

/** Thermistor (NTC or PTC): the resistor crossed by the non-linear stroke, with «−t°» or «+t°». */
export function termistor(ptc: boolean): DefSimbolo {
  return dos(
    0.5,
    1.5,
    [0.2, -0.62, 1.95, 0.46],
    [
      RESISTOR,
      { t: 'l', p: [[0.2, 0.44], [0.42, 0.44], [1.56, -0.44]] },
      { t: 'texto', c: [1.62, -0.5], s: ptc ? '+t°' : '−t°', ancla: 'start', tam: 0.3 },
    ],
    { x: 1, y: 0.48, dx: 0, dy: 1 },
  );
}

/** Lamp (IEC): a circle with a cross. */
export function lampara(): DefSimbolo {
  const r = 0.42;
  const k = r * Math.SQRT1_2;
  return dos(1 - r, 1 + r, [1 - r, -r, 1 + r, r], [
    { t: 'c', c: [1, 0], r },
    { t: 'l', p: [[1 - k, -k], [1 + k, k]] },
    { t: 'l', p: [[1 - k, k], [1 + k, -k]] },
  ]);
}

/** Buzzer: a small body with its dome, + on the first terminal. */
export function zumbador(): DefSimbolo {
  return dos(0.6, 1.4, [0.6, -0.6, 1.4, 0.18], [
    { t: 'l', p: [[0.6, -0.18], [1.4, -0.18], [1.4, 0.18], [0.6, 0.18]], cerrado: true },
    { t: 'l', p: arco(1, -0.18, 0.4, Math.PI, 2 * Math.PI, 20) },
    { t: 'signo', c: [0.34, -0.3], s: '+' },
  ]);
}

/** Loudspeaker (IEC): the coil box and the cone; both terminals on the left. */
export function altavoz(): DefSimbolo {
  return {
    pines: { start: pin(0, 0, -1, 0), end: pin(0, 1, -1, 0) },
    cuerpo: [0.55, -0.85, 1.55, 1.85],
    patas: [
      [[0, 0], [0.55, 0]],
      [[0, 1], [0.55, 1]],
    ],
    prims: [
      { t: 'l', p: [[0, 0], [0.55, 0]] },
      { t: 'l', p: [[0, 1], [0.55, 1]] },
      { t: 'l', p: [[0.55, -0.3], [0.95, -0.3], [0.95, 1.3], [0.55, 1.3]], cerrado: true },
      { t: 'l', p: [[0.95, -0.3], [1.55, -0.85], [1.55, 1.85], [0.95, 1.3]] },
    ],
    etq: { x: 1.6, y: 0.5, dx: 1, dy: 0 },
    dos: false,
  };
}

/** DC motor: a circle with «M» and the DC stroke under it, + on the first terminal. */
export function motor(): DefSimbolo {
  return dos(0.55, 1.45, [0.55, -0.45, 1.45, 0.45], [
    { t: 'c', c: [1, 0], r: 0.45, relleno: 'fondo' },
    { t: 'texto', c: [1, -0.06], s: 'M', ancla: 'middle', tam: 0.44 },
    { t: 'l', p: [[0.84, 0.24], [1.16, 0.24]] },
    { t: 'signo', c: [0.3, -0.28], s: '+' },
  ]);
}

/** Quartz crystal: the plate between two electrodes. */
export function cristal(): DefSimbolo {
  return dos(0.72, 1.28, [0.72, -0.34, 1.28, 0.34], [
    { t: 'l', p: [[0.72, -0.32], [0.72, 0.32]] },
    { t: 'l', p: [[1.28, -0.32], [1.28, 0.32]] },
    { t: 'l', p: [[0.84, -0.22], [1.16, -0.22], [1.16, 0.22], [0.84, 0.22]], cerrado: true },
  ]);
}

// ------------------------------------------------------------------ text notes

export const TAM_NOTA = 0.42;
export const ALTO_NOTA = 0.56;

/** A text note: one text per line from its origin (top left); no pins. */
export function nota(texto: string): DefSimbolo {
  const lineas = (texto.trim() ? texto : 'Nota').split('\n').slice(0, 30);
  const ancho = Math.max(1, ...lineas.map((l) => l.length * TAM_NOTA * 0.52));
  return {
    pines: {},
    cuerpo: [-0.12, -0.12, ancho + 0.12, lineas.length * ALTO_NOTA + 0.06],
    patas: [],
    prims: lineas.map((s, i): Prim => ({ t: 'texto', c: [0, 0.3 + i * ALTO_NOTA], s, ancla: 'start', tam: TAM_NOTA })),
    etq: { x: 0, y: 0, dx: 0, dy: -1 },
    dos: false,
  };
}
