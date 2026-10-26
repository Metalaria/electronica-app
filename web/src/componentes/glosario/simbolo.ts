// Circuit symbols for the glossary: the parts of the automatic schematics (esquema-auto/simbolos.ts, used
// read-only) drawn alone as a small inline SVG in the text colour. A few keys add some strokes of the same
// style on top of a base symbol (potentiometer, polarised capacitor, photodiode, phototransistor) or draw a
// part that the schematics do not need (ground, fuse, crystal, battery).
// Loaded lazily with the glossary's pictures (glosario/imagenes.ts), never by the reader.

import { simboloDe, transformador, type DefSimbolo, type Prim, type Pt } from '../esquema-auto/simbolos.ts';
import type { Dispositivo, Pin, TipoSimbolo } from '../esquema-auto/modelo.ts';

/** Keys of glosario-imagenes.json («s»), see contenido/glosario_imagenes.py. */
export type ClaveSimbolo =
  | 'R' | 'POT' | 'C' | 'CPOL' | 'L' | 'TRAFO' | 'D' | 'DZ' | 'DS' | 'LED' | 'FOTODIODO' | 'NPN' | 'PNP'
  | 'FOTOTRANSISTOR' | 'NMOS' | 'PMOS' | 'NJF' | 'PJF' | 'OPAMP' | 'AND' | 'NAND' | 'OR' | 'NOR' | 'XOR' | 'NOT'
  | 'FF' | 'REG' | 'VDC' | 'VSIN' | 'VPULSO' | 'IDC' | 'SW' | 'TL' | 'PUENTE' | 'TIERRA' | 'FUSIBLE' | 'XTAL' | 'PILA';

const NOMBRES: Record<ClaveSimbolo, string> = {
  R: 'resistencia', POT: 'potenciómetro', C: 'condensador', CPOL: 'condensador polarizado', L: 'bobina',
  TRAFO: 'transformador', D: 'diodo', DZ: 'diodo Zener', DS: 'diodo Schottky', LED: 'LED', FOTODIODO: 'fotodiodo',
  NPN: 'transistor NPN', PNP: 'transistor PNP', FOTOTRANSISTOR: 'fototransistor', NMOS: 'MOSFET de canal N',
  PMOS: 'MOSFET de canal P', NJF: 'JFET de canal N', PJF: 'JFET de canal P', OPAMP: 'amplificador operacional',
  AND: 'puerta AND', NAND: 'puerta NAND', OR: 'puerta OR', NOR: 'puerta NOR', XOR: 'puerta XOR', NOT: 'inversor',
  FF: 'biestable D', REG: 'regulador de tensión', VDC: 'fuente de tensión continua', VSIN: 'fuente de tensión alterna',
  VPULSO: 'fuente de pulsos', IDC: 'fuente de corriente', SW: 'interruptor', TL: 'línea de transmisión',
  PUENTE: 'puente rectificador', TIERRA: 'tierra', FUSIBLE: 'fusible', XTAL: 'cristal de cuarzo', PILA: 'batería',
};

export function esClaveSimbolo(s: unknown): s is ClaveSimbolo {
  return typeof s === 'string' && s in NOMBRES;
}

export function nombreSimbolo(s: ClaveSimbolo): string {
  return NOMBRES[s];
}

// ------------------------------------------------------------------ building the parts

function disp(simbolo: TipoSimbolo, pines: (string | Pin)[], extra: Partial<Dispositivo> = {}): Dispositivo {
  return {
    nombre: '',
    clave: 'x',
    letra: '',
    simbolo,
    rol: '',
    clase: '',
    pines: pines.map((p) => (typeof p === 'string' ? { nombre: p, nodo: '' } : p)),
    valor: '',
    extra: '',
    numero: null,
    unidad: '',
    modelo: null,
    linea: 0,
    ...extra,
  };
}

const DOS = ['start', 'end'];

/** Arrow from a to b with a filled head (the schematics' style). */
function flecha(a: Pt, b: Pt, largo = 0.16, ancho = 0.065): Prim[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const n = Math.hypot(dx, dy) || 1;
  const ux = dx / n;
  const uy = dy / n;
  const base: Pt = [b[0] - ux * largo, b[1] - uy * largo];
  return [
    { t: 'l', p: [a, base] },
    { t: 'l', p: [b, [base[0] - uy * ancho, base[1] + ux * ancho], [base[0] + uy * ancho, base[1] - ux * ancho]], cerrado: true, relleno: 'tinta' },
  ];
}

function luzEntrante(x: number, y: number): Prim[] {
  // two parallel arrows pointing down-right towards (x, y)
  return [...flecha([x - 0.42, y - 0.42], [x - 0.12, y - 0.12]), ...flecha([x - 0.2, y - 0.5], [x + 0.1, y - 0.2])];
}

function puertas(tipo: string): Dispositivo {
  const ent = tipo === 'NOT' ? ['a'] : ['a', 'b'];
  return disp('PUERTA', [...ent, { nombre: 'y', nodo: '', rotulo: 'y' }], { titulo: tipo });
}

function definicion(clave: ClaveSimbolo): DefSimbolo {
  switch (clave) {
    case 'R':
    case 'C':
    case 'L':
    case 'D':
    case 'DZ':
    case 'DS':
    case 'LED':
    case 'SW':
      return simboloDe(disp(clave, DOS));
    case 'VDC':
    case 'VSIN':
    case 'VPULSO':
    case 'IDC':
      return simboloDe(disp(clave, DOS));
    case 'NPN':
    case 'PNP':
      return simboloDe(disp(clave, ['collector', 'base', 'emitter']));
    case 'NMOS':
    case 'PMOS':
    case 'NJF':
    case 'PJF':
      return simboloDe(disp(clave, ['drain', 'gate', 'source']));
    case 'OPAMP':
      return simboloDe(disp('OPAMP', ['in1', 'in2', 'out']));
    case 'TL':
      return simboloDe(disp('TL', ['a', 'a_ref', 'b', 'b_ref']));
    case 'AND':
    case 'NAND':
    case 'OR':
    case 'NOR':
    case 'XOR':
    case 'NOT':
      return simboloDe(puertas(clave));
    case 'TRAFO':
      return transformador([disp('L', DOS, { clave: 'l1' }), disp('L', DOS, { clave: 'l2' })]);
    case 'PUENTE': {
      const d = (anodo: 'a' | 'b' | 'n', catodo: 'a' | 'b' | 'p') => ({ d: disp('D', DOS), anodo, catodo });
      return simboloDe(disp('PUENTE', ['a', 'b', 'p', 'n'], { diodos: [d('a', 'p'), d('b', 'p'), d('n', 'a'), d('n', 'b')] }));
    }
    case 'FF': {
      const s = simboloDe(disp('CAJA', [
        { nombre: 'd', nodo: '', rotulo: 'D' },
        { nombre: 'clk', nodo: '', rotulo: '>' },
        { nombre: 'q', nodo: '', rotulo: 'Q' },
        { nombre: 'nq', nodo: '', rotulo: 'nQ' },
      ]));
      return s;
    }
    case 'REG': {
      const s = simboloDe(disp('CAJA', [
        { nombre: 'in', nodo: '', rotulo: 'IN' },
        { nombre: 'out', nodo: '', rotulo: 'OUT' },
        { nombre: 'gnd', nodo: '', rotulo: 'GND' },
      ]));
      return s;
    }
    case 'POT': {
      const s = simboloDe(disp('R', DOS));
      s.prims.push(...flecha([1, 0.62], [1, 0.2], 0.18, 0.07));
      return s;
    }
    case 'CPOL': {
      const s = simboloDe(disp('C', DOS));
      s.prims.push({ t: 'signo', c: [0.68, -0.3], s: '+' });
      return s;
    }
    case 'FOTODIODO': {
      const s = simboloDe(disp('D', DOS));
      s.prims.push(...luzEntrante(0.98, -0.3));
      return s;
    }
    case 'FOTOTRANSISTOR': {
      const s = simboloDe(disp('NPN', ['collector', 'base', 'emitter']));
      s.prims.push(...luzEntrante(-0.62, -0.5));
      return s;
    }
    case 'TIERRA':
      return figura([
        { t: 'l', p: [[1, -0.7], [1, 0]] },
        { t: 'l', p: [[0.55, 0], [1.45, 0]] },
        { t: 'l', p: [[0.7, 0.17], [1.3, 0.17]] },
        { t: 'l', p: [[0.86, 0.34], [1.14, 0.34]] },
      ]);
    case 'FUSIBLE':
      return figura([
        { t: 'l', p: [[0, 0], [2, 0]] },
        { t: 'l', p: [[0.5, -0.18], [1.5, -0.18], [1.5, 0.18], [0.5, 0.18]], cerrado: true },
      ]);
    case 'XTAL':
      return figura([
        { t: 'l', p: [[0, 0], [0.7, 0]] },
        { t: 'l', p: [[1.3, 0], [2, 0]] },
        { t: 'l', p: [[0.7, -0.3], [0.7, 0.3]] },
        { t: 'l', p: [[1.3, -0.3], [1.3, 0.3]] },
        { t: 'l', p: [[0.85, -0.24], [1.15, -0.24], [1.15, 0.24], [0.85, 0.24]], cerrado: true },
      ]);
    case 'PILA':
      return figura([
        { t: 'l', p: [[0, 0], [0.8, 0]] },
        { t: 'l', p: [[1.2, 0], [2, 0]] },
        { t: 'l', p: [[0.8, -0.34], [0.8, 0.34]] },
        { t: 'l', p: [[0.92, -0.16], [0.92, 0.16]], cerrado: false },
        { t: 'l', p: [[1.08, -0.34], [1.08, 0.34]] },
        { t: 'l', p: [[1.2, -0.16], [1.2, 0.16]] },
        { t: 'signo', c: [0.62, -0.32], s: '+' },
      ]);
  }
}

function figura(prims: Prim[]): DefSimbolo {
  return { pines: {}, cuerpo: [0, 0, 0, 0], patas: [], prims, etq: { x: 0, y: 0, dx: 0, dy: -1 }, dos: false };
}

// ------------------------------------------------------------------ SVG

const S = 30; // px per drawing unit
const n = (v: number) => String(Math.round(v * 100) / 100);

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function glifo(g: 'sin' | 'cuadrada' | 'pwl', cx: number, cy: number): Pt[] {
  if (g === 'sin') {
    const ps: Pt[] = [];
    for (let i = 0; i <= 24; i++) ps.push([cx - 0.27 + (0.54 * i) / 24, cy - 0.15 * Math.sin((2 * Math.PI * i) / 24)]);
    return ps;
  }
  if (g === 'cuadrada')
    return [
      [cx - 0.28, cy + 0.14],
      [cx - 0.14, cy + 0.14],
      [cx - 0.14, cy - 0.14],
      [cx + 0.14, cy - 0.14],
      [cx + 0.14, cy + 0.14],
      [cx + 0.28, cy + 0.14],
    ];
  return [
    [cx - 0.28, cy + 0.14],
    [cx - 0.05, cy - 0.14],
    [cx + 0.1, cy + 0.04],
    [cx + 0.28, cy - 0.1],
  ];
}

const cache = new Map<ClaveSimbolo, string>();

/**
 * Inline SVG of a symbol, drawn with `currentColor` (fills «fondo» use --simbolo-fondo, the card's background).
 * Its size is the drawing's at 30 px per grid unit; the page scales it with CSS.
 */
export function svgSimbolo(clave: ClaveSimbolo): string {
  const hit = cache.get(clave);
  if (hit) return hit;
  const def = definicion(clave);
  const partes: string[] = [];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const caja = (x: number, y: number, r = 0) => {
    x0 = Math.min(x0, x - r);
    y0 = Math.min(y0, y - r);
    x1 = Math.max(x1, x + r);
    y1 = Math.max(y1, y + r);
  };
  const camino = (ps: Pt[], cerrado = false) => {
    for (const [x, y] of ps) caja(x, y);
    return `M${ps.map(([x, y]) => `${n(x * S)} ${n(y * S)}`).join('L')}${cerrado ? 'Z' : ''}`;
  };
  const relleno = (r?: 'tinta' | 'fondo') => (r === 'tinta' ? ' class="t"' : r === 'fondo' ? ' class="f"' : '');
  for (const pr of def.prims) {
    switch (pr.t) {
      case 'l':
        partes.push(`<path${relleno(pr.relleno)} d="${camino(pr.p, pr.cerrado)}"/>`);
        break;
      case 'c':
        caja(pr.c[0], pr.c[1], pr.r);
        partes.push(`<circle${relleno(pr.relleno)} cx="${n(pr.c[0] * S)}" cy="${n(pr.c[1] * S)}" r="${n(pr.r * S)}"/>`);
        break;
      case 'signo': {
        const [cx, cy] = pr.c;
        const h = 0.12;
        const d = camino([[cx - h, cy], [cx + h, cy]]) + (pr.s === '+' ? camino([[cx, cy - h], [cx, cy + h]]) : '');
        partes.push(`<path d="${d}"/>`);
        break;
      }
      case 'glifo':
        partes.push(`<path d="${camino(glifo(pr.g, pr.c[0], pr.c[1]))}"/>`);
        break;
      case 'texto': {
        if (!pr.s) break;
        const [cx, cy] = pr.c;
        const w = pr.s.length * pr.tam * 0.55;
        const xa = pr.ancla === 'start' ? cx : pr.ancla === 'end' ? cx - w : cx - w / 2;
        caja(xa, cy - pr.tam / 2);
        caja(xa + w, cy + pr.tam / 2);
        partes.push(
          `<text x="${n(cx * S)}" y="${n((cy + pr.tam * 0.36) * S)}" text-anchor="${pr.ancla}" font-size="${n(pr.tam * S)}">${escapar(pr.s)}</text>`,
        );
        break;
      }
    }
  }
  const m = 0.22;
  const vx = (x0 - m) * S;
  const vy = (y0 - m) * S;
  const w = (x1 - x0 + 2 * m) * S;
  const h = (y1 - y0 + 2 * m) * S;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" class="simbolo-svg" viewBox="${n(vx)} ${n(vy)} ${n(w)} ${n(h)}" width="${n(w)}" height="${n(h)}"` +
    ` fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${partes.join('')}</svg>`;
  cache.set(clave, svg);
  return svg;
}
