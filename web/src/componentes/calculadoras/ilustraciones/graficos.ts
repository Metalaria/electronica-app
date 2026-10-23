// Live mini-plots and diagrams of the calculators: the curve a formula is about, with the result marked (RC
// charge with τ and 63 %, Bode with −3 dB, resonance with its bandwidth, the diode knee and its tangent…) or a
// diagram of how its terms combine (quadrature triangles, waterfalls). Each kind reads the formula's values
// through its roles (contenido/formulas_visual.py) and returns a scene in data coordinates that Grafico.svelte
// draws. Plain TypeScript.

import { formatoValor, MENOS } from '../unidades';

export interface EjeG {
  min: number;
  max: number;
  log?: boolean;
  unidad: string;
  /** Axis title (trusted HTML). */
  titulo: string;
  oculto?: boolean;
  /** Category labels instead of numbers (waterfalls). */
  categorias?: string[];
}

export type ItemG =
  | { k: 'linea'; x: number[]; y: number[]; cls: string }
  | { k: 'area'; x: number[]; y: number[]; cls: string }
  | { k: 'punto'; x: number; y: number; cls: string }
  | { k: 'vguia'; x: number; cls: string; html?: string; abajo?: boolean }
  | { k: 'hguia'; y: number; cls: string; html?: string; lado?: 'l' | 'r' }
  | { k: 'texto'; x: number; y: number; html: string; cls: string; ancla: 'l' | 'r' | 'c'; dy?: number }
  | { k: 'flecha'; x1: number; y1: number; x2: number; y2: number; cls: string; doble?: boolean }
  | { k: 'franja'; x1: number; x2: number; cls: string }
  | { k: 'barra'; x: number; y0: number; y1: number; cls: string };

export interface Escena {
  x: EjeG;
  y: EjeG;
  items: ItemG[];
  /** Same scale on both axes (vector diagrams). */
  cuadrado?: boolean;
  /** One-line reading under the plot (HTML). */
  pie?: string;
}

export interface Contexto {
  /** Value of a role (undefined: not mapped or not finite). */
  v: (rol: string) => number | undefined;
  sim: (rol: string) => string;
  unidad: (rol: string) => string;
  /** The role is the quantity being computed (drawn in the accent colour). */
  obj: (rol: string) => boolean;
}

/** Default symbol and unit of each role (used when a role holds an expression instead of a variable). */
export const ROLES_G: Record<string, [string, string]> = {
  Vf: ['V<sub>f</sub>', 'V'], V0: ['V<sub>0</sub>', 'V'], tau: ['τ', 's'], t: ['t', 's'], v: ['v', 'V'],
  fc: ['f<sub>c</sub>', 'Hz'], f: ['f', 'Hz'], n: ['n', ''], f0: ['f<sub>0</sub>', 'Hz'], Q: ['Q', ''], BW: ['BW', 'Hz'],
  R: ['R', 'Ω'], L: ['L', 'H'], C: ['C', 'F'], fx: ['f', 'Hz'], r: ['', ''], dB: ['G', 'dB'], k: ['k', ''],
  Vp: ['V<sub>p</sub>', 'V'], phi: ['φ', '°'], Vrms: ['V<sub>ef</sub>', 'V'], dt: ['Δt', 's'], T: ['T', 's'],
  IS: ['I<sub>S</sub>', 'A'], VT: ['V<sub>T</sub>', 'V'], V: ['V', 'V'], I: ['I', 'A'], kn: ['k<sub>n</sub>', 'A/V²'],
  Vth: ['V<sub>th</sub>', 'V'], VGS: ['V<sub>GS</sub>', 'V'], ID: ['I<sub>D</sub>', 'A'], dV: ['ΔV', 'V'], Io: ['I<sub>o</sub>', 'A'],
  dI: ['ΔI', 'A'], Ipk: ['I<sub>pk</sub>', 'A'], D: ['D', ''], Vavg: ['V<sub>med</sub>', 'V'], Vlow: ['V<sub>bajo</sub>', 'V'],
  Vref: ['V<sub>ref</sub>', 'V'], nb: ['n', 'bit'], LSB: ['LSB', 'V'], tH: ['t<sub>H</sub>', 's'], tL: ['t<sub>L</sub>', 's'],
  VTH: ['V<sub>TH</sub>', 'V'], VTL: ['V<sub>TL</sub>', 'V'], tr: ['t<sub>r</sub>', 's'], zeta: ['ζ', ''],
  a: ['', ''], b: ['', ''], c: ['', ''], d: ['', ''], Vth_: ['V<sub>Th</sub>', 'V'], Rth: ['R<sub>Th</sub>', 'Ω'], RL: ['R<sub>L</sub>', 'Ω'],
  P: ['P', 'W'], VOH: ['V<sub>OH</sub>', 'V'], VIH: ['V<sub>IH</sub>', 'V'], VIL: ['V<sub>IL</sub>', 'V'], VOL: ['V<sub>OL</sub>', 'V'],
  fs: ['f<sub>s</sub>', 'Hz'], fol: ['f<sub>OL</sub>', 'Hz'], ffi: ['f<sub>FI</sub>', 'Hz'], fim: ['f<sub>im</sub>', 'Hz'],
  Amax: ['A<sub>máx</sub>', 'V'], Amin: ['A<sub>mín</sub>', 'V'], m: ['m', ''], f1: ['f<sub>1</sub>', 'Hz'], f2: ['f<sub>2</sub>', 'Hz'],
};

const fmt = (v: number, u: string, c = 3): string => formatoValor(v, u, c, true).replace(/^-/, MENOS);
const s = (html: string): string => `<tspan class="g-sim">${html}</tspan>`;
const et = (c: Contexto, rol: string, v?: number, u?: string): string =>
  v === undefined ? s(c.sim(rol)) : `${s(c.sim(rol))} = ${fmt(v, u ?? c.unidad(rol))}`;
const cls = (c: Contexto, rol: string, base = 'res'): string => (c.obj(rol) ? 'res' : base);

function rangoLog(a: number, b: number): number[] {
  const out: number[] = [];
  const n = 140;
  for (let i = 0; i <= n; i++) out.push(a * (b / a) ** (i / n));
  return out;
}

function rangoLin(a: number, b: number, n = 140): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(a + ((b - a) * i) / n);
  return out;
}

const pos = (x: number | undefined): x is number => x !== undefined && Number.isFinite(x) && x > 0;
const fin = (x: number | undefined): x is number => x !== undefined && Number.isFinite(x);

// ------------------------------------------------------------------ the kinds

function carga(c: Contexto, descarga: boolean): Escena | null {
  const kV = descarga ? 'V0' : 'Vf';
  const tau = c.v('tau');
  if (!pos(tau)) return null;
  let V = c.v(kV);
  const pct = !fin(V) || c.unidad(kV) === '';
  if (pct) V = 100;
  const Vf = V as number;
  const t = c.v('t');
  const xmax = Math.max(5 * tau, fin(t) ? t * 1.15 : 0);
  const xs = rangoLin(0, xmax);
  const f = (x: number) => (descarga ? Vf * Math.exp(-x / tau) : Vf * (1 - Math.exp(-x / tau)));
  // the curve's own unit when the role «v» is a variable of another kind (the current of an RL)
  const uv = c.unidad('v');
  const uy = pct ? '%' : uv && uv !== 'V' ? uv : c.unidad(kV);
  const items: ItemG[] = [
    { k: 'hguia', y: descarga ? 0 : Vf, cls: 'guia', html: descarga ? undefined : pct ? '100 %' : et(c, kV), lado: 'r' },
    { k: 'linea', x: xs, y: xs.map(f), cls: 'curva' },
    { k: 'vguia', x: tau, cls: cls(c, 'tau', 'guia'), html: et(c, 'tau', tau, 's') },
    { k: 'punto', x: tau, y: f(tau), cls: 'marca' },
    { k: 'texto', x: tau, y: f(tau), html: descarga ? '37 %' : '63 %', cls: 'marca', ancla: 'l', dy: descarga ? -6 : 14 },
  ];
  if (descarga) items.splice(0, 1, { k: 'hguia', y: Vf, cls: 'guia', html: pct ? '100 %' : et(c, kV), lado: 'r' });
  if (fin(t) && t > 0) {
    const y = f(t);
    items.push({ k: 'flecha', x1: t, y1: 0, x2: t, y2: y, cls: cls(c, 't', 'tenue') });
    items.push({ k: 'punto', x: t, y, cls: 'res' });
    items.push({ k: 'texto', x: t, y, html: pct ? `${fmt(y, '%')}` : et(c, 'v', y, uy), cls: 'res', ancla: t > xmax * 0.6 ? 'r' : 'l', dy: -8 });
  }
  return {
    x: { min: 0, max: xmax, unidad: 's', titulo: 't' },
    y: { min: 0, max: Vf * 1.12, unidad: uy, titulo: pct ? 'carga' : c.sim('v') || c.sim(kV) },
    items,
    pie: descarga
      ? `En una constante de tiempo queda el 37 %; en 5τ, menos del 1 %.`
      : `En una constante de tiempo llega al 63 %; en 5τ, a más del 99 %.`,
  };
}

function bode(c: Contexto): Escena | null {
  const fc = c.v('fc');
  if (!pos(fc)) return null;
  const n = Math.max(1, Math.round(c.v('n') ?? 1));
  const f = c.v('f');
  const a = Math.min(fc / 100, pos(f) ? f / 3 : Infinity);
  const b = Math.max(fc * 100, pos(f) ? f * 3 : 0);
  const xs = rangoLog(a, b);
  const H = (x: number) => -10 * Math.log10(1 + (x / fc) ** (2 * n));
  const ymin = Math.min(-40 * n, pos(f) ? H(f) - 6 : 0);
  const items: ItemG[] = [
    { k: 'linea', x: [a, fc, b], y: [0, 0, -20 * n * Math.log10(b / fc)], cls: 'guia' },
    { k: 'linea', x: xs, y: xs.map(H), cls: 'curva' },
    { k: 'hguia', y: -3, cls: 'guia', html: `${MENOS}3 dB`, lado: 'r' },
    { k: 'vguia', x: fc, cls: cls(c, 'fc', 'guia'), html: et(c, 'fc', fc, 'Hz') },
    { k: 'punto', x: fc, y: -3, cls: c.obj('fc') ? 'res' : 'marca' },
  ];
  if (pos(f) && Math.abs(Math.log(f / fc)) > 1e-6) {
    items.push({ k: 'punto', x: f, y: H(f), cls: 'res' });
    items.push({ k: 'texto', x: f, y: H(f), html: `${fmt(H(f), 'dB')}`, cls: 'res', ancla: f > fc ? 'l' : 'r', dy: -8 });
  }
  return {
    x: { min: a, max: b, log: true, unidad: 'Hz', titulo: 'f' },
    y: { min: ymin, max: 6, unidad: 'dB', titulo: '|H|' },
    items,
    pie: `Por encima de f<sub>c</sub> cae ${20 * n} dB por década${n > 1 ? ` (orden ${n})` : ''}; en f<sub>c</sub>, −3 dB (70,7 % de la tensión).`,
  };
}

function resonancia(c: Contexto): Escena | null {
  let f0 = c.v('f0');
  let Q = c.v('Q');
  const BW = c.v('BW');
  const norm = !pos(f0);
  if (norm) f0 = 1;
  if (!pos(Q) && pos(BW) && !norm) Q = (f0 as number) / BW;
  if (!pos(Q)) return null;
  const F = f0 as number;
  const q = Q as number;
  const ancho = Math.max(0.25, Math.min(1.6, 1.4 / Math.sqrt(q)));
  const a = F * 10 ** -ancho;
  const b = F * 10 ** ancho;
  const xs = rangoLog(a, b);
  const A = (x: number) => 100 / Math.sqrt(1 + q * q * (x / F - F / x) ** 2);
  const k = 1 / (2 * q);
  const f1 = F * (Math.sqrt(1 + k * k) - k);
  const f2 = F * (Math.sqrt(1 + k * k) + k);
  return {
    x: { min: a, max: b, log: true, unidad: norm ? '' : 'Hz', titulo: norm ? 'f/f<tspan dy="3" font-size="0.75em">0</tspan>' : 'f' },
    y: { min: 0, max: 112, unidad: '%', titulo: 'respuesta' },
    items: [
      { k: 'franja', x1: f1, x2: f2, cls: cls(c, 'BW', 'banda') },
      { k: 'hguia', y: 70.7, cls: 'guia', html: '70,7 %', lado: 'r' },
      { k: 'linea', x: xs, y: xs.map(A), cls: 'curva' },
      { k: 'vguia', x: F, cls: cls(c, 'f0', 'guia'), html: norm ? s('f<tspan dy="3" font-size="0.75em">0</tspan>') : et(c, 'f0', F, 'Hz') },
      { k: 'flecha', x1: f1, y1: 60, x2: f2, y2: 60, cls: cls(c, 'BW', 'tenue'), doble: true },
      { k: 'texto', x: Math.sqrt(f1 * f2), y: 52, html: `BW${norm ? '' : ' = ' + fmt(f2 - f1, 'Hz')}`, cls: cls(c, 'BW', 'tenue'), ancla: 'c' },
      { k: 'texto', x: F, y: 100, html: et(c, 'Q', q, ''), cls: cls(c, 'Q', 'marca'), ancla: 'l', dy: -4 },
    ],
    pie: `Cuanto mayor es Q, más estrecho y alto es el pico: BW = f<sub>0</sub>/Q entre los puntos de 70,7 %.`,
  };
}

function impedancia(c: Contexto): Escena | null {
  const R = c.v('R');
  const L = c.v('L');
  const C = c.v('C');
  if (!pos(R) && !pos(L) && !pos(C)) return null;
  const r = pos(R) ? R : 0;
  let fref: number;
  if (pos(L) && pos(C)) fref = 1 / (2 * Math.PI * Math.sqrt(L * C));
  else if (pos(L) && r > 0) fref = r / (2 * Math.PI * L);
  else if (pos(C) && r > 0) fref = 1 / (2 * Math.PI * r * C);
  else return null;
  const f = c.v('f');
  const fx = c.v('fx');
  const a = Math.min(fref / 300, pos(f) ? f / 3 : Infinity, pos(fx) ? fx / 3 : Infinity);
  const b = Math.max(fref * 300, pos(f) ? f * 3 : 0, pos(fx) ? fx * 3 : 0);
  const xs = rangoLog(a, b);
  const Z = (x: number) => {
    const w = 2 * Math.PI * x;
    const X = (pos(L) ? w * L : 0) - (pos(C) ? 1 / (w * C) : 0);
    return Math.sqrt(r * r + X * X);
  };
  const ys = xs.map(Z);
  const ymin = Math.max(Math.min(...ys) / 3, 1e-6);
  const ymax = Math.max(...ys) * 3;
  const items: ItemG[] = [{ k: 'linea', x: xs, y: ys, cls: 'curva' }];
  if (r > 0) items.unshift({ k: 'hguia', y: r, cls: 'guia', html: s(c.sim('R')), lado: 'r' });
  if (pos(L) && pos(C)) items.push({ k: 'vguia', x: fref, cls: 'guia', html: `${s('f<tspan dy="3" font-size="0.75em">0</tspan>')} = ${fmt(fref, 'Hz')}` });
  if (pos(fx)) items.push({ k: 'vguia', x: fx, cls: cls(c, 'fx', 'guia'), html: et(c, 'fx', fx, 'Hz') }, { k: 'punto', x: fx, y: Z(fx), cls: cls(c, 'fx', 'marca') });
  if (pos(f)) {
    items.push({ k: 'punto', x: f, y: Z(f), cls: 'res' });
    items.push({ k: 'texto', x: f, y: Z(f), html: `|Z| = ${fmt(Z(f), 'Ω')}`, cls: 'res', ancla: f > fref ? 'r' : 'l', dy: -8 });
  }
  return {
    x: { min: a, max: b, log: true, unidad: 'Hz', titulo: 'f' },
    y: { min: ymin, max: ymax, log: true, unidad: 'Ω', titulo: '|Z|' },
    items,
    pie: pos(L) && pos(C)
      ? 'Por debajo de f<sub>0</sub> manda la capacidad, por encima la inductancia; en f<sub>0</sub> solo queda la resistencia.'
      : pos(L) ? 'Hasta el codo manda la resistencia; por encima, la reactancia de la bobina crece con f.' : 'Hasta el codo manda la reactancia del condensador; por encima, la resistencia.',
  };
}

function decibelios(c: Contexto): Escena | null {
  const r = c.v('r');
  const k = c.v('k') ?? 20;
  if (!pos(r)) return null;
  const e = Math.log10(r);
  const a = 10 ** (Math.floor(Math.min(e, 0)) - 1);
  const b = 10 ** (Math.ceil(Math.max(e, 0)) + 1);
  const xs = rangoLog(a, b);
  const y = k * Math.log10(r);
  const items: ItemG[] = [
    { k: 'hguia', y: 0, cls: 'guia' },
    { k: 'linea', x: xs, y: xs.map((x) => k * Math.log10(x)), cls: 'curva' },
  ];
  for (const m of [2, 10, 0.5, 0.1, 100]) {
    if (m < a || m > b || Math.abs(Math.log(m / r)) < 0.25) continue;
    items.push({ k: 'punto', x: m, y: k * Math.log10(m), cls: 'marca' });
    items.push({ k: 'texto', x: m, y: k * Math.log10(m), html: `×${String(m).replace('.', ',')}: ${fmt(k * Math.log10(m), 'dB', 2)}`, cls: 'tenue', ancla: 'l', dy: 13 });
  }
  items.push({ k: 'punto', x: r, y, cls: 'res' });
  items.push({ k: 'texto', x: r, y, html: `${fmt(y, 'dB')}`, cls: 'res', ancla: 'r', dy: -8 });
  return {
    x: { min: a, max: b, log: true, unidad: '', titulo: 'relación' },
    y: { min: k * Math.log10(a), max: k * Math.log10(b), unidad: 'dB', titulo: 'dB' },
    items,
    pie: k === 20 ? 'En tensión: ×2 son 6 dB y ×10 son 20 dB; dividir resta lo mismo.' : 'En potencia: ×2 son 3 dB y ×10 son 10 dB; dividir resta lo mismo.',
  };
}

function senoide(c: Contexto): Escena | null {
  const Vp = c.v('Vp');
  if (!pos(Vp)) return null;
  const f = c.v('f');
  const T = pos(f) ? 1 / f : 1;
  const phi = ((c.v('phi') ?? 0) * Math.PI) / 180;
  const xs = rangoLin(0, 2 * T, 200);
  const v = (x: number) => Vp * Math.sin((2 * Math.PI * x) / T + phi);
  const Vef = Vp / Math.SQRT2;
  const items: ItemG[] = [
    { k: 'hguia', y: 0, cls: 'guia' },
    { k: 'hguia', y: Vef, cls: cls(c, 'Vrms', 'guia2'), html: c.v('Vrms') !== undefined ? et(c, 'Vrms', Vef, c.unidad('Vp')) : `ef = ${fmt(Vef, c.unidad('Vp'))}`, lado: 'r' },
    { k: 'linea', x: xs, y: xs.map(v), cls: 'curva' },
    { k: 'hguia', y: Vp, cls: cls(c, 'Vp', 'guia'), html: et(c, 'Vp', Vp), lado: 'l' },
  ];
  const t = c.v('t');
  if (fin(t) && pos(f)) {
    const tt = ((t % T) + T) % T;
    items.push({ k: 'punto', x: tt, y: v(tt), cls: 'res' }, { k: 'texto', x: tt, y: v(tt), html: et(c, 'v', v(tt), c.unidad('Vp')), cls: 'res', ancla: tt > T ? 'r' : 'l', dy: v(tt) > 0 ? 14 : -8 });
  }
  if (pos(f)) items.push({ k: 'flecha', x1: 0, y1: -Vp * 1.12, x2: T, y2: -Vp * 1.12, cls: cls(c, 'f', 'tenue'), doble: true }, { k: 'texto', x: T / 2, y: -Vp * 1.12, html: `T = ${fmt(T, 's')}`, cls: cls(c, 'f', 'tenue'), ancla: 'c', dy: -5 });
  return {
    x: { min: 0, max: 2 * T, unidad: pos(f) ? 's' : '', titulo: pos(f) ? 't' : 't/T' },
    y: { min: -Vp * 1.25, max: Vp * 1.25, unidad: c.unidad('Vp'), titulo: 'v' },
    items,
    pie: 'El valor eficaz de una senoide es su pico dividido por √2 (0,707·V<sub>p</sub>).',
  };
}

function desfase(c: Contexto): Escena | null {
  const T = c.v('T');
  const dt = c.v('dt');
  if (!pos(T) || !fin(dt)) return null;
  const xs = rangoLin(0, 2 * T, 200);
  const items: ItemG[] = [
    { k: 'hguia', y: 0, cls: 'guia' },
    { k: 'linea', x: xs, y: xs.map((x) => Math.sin((2 * Math.PI * x) / T)), cls: 'curva' },
    { k: 'linea', x: xs, y: xs.map((x) => 0.8 * Math.sin((2 * Math.PI * (x - dt)) / T)), cls: 'curva2' },
    { k: 'flecha', x1: T, y1: -0.15, x2: T + dt, y2: -0.15, cls: cls(c, 'dt', 'tenue'), doble: true },
    { k: 'texto', x: T + dt / 2, y: -0.15, html: et(c, 'dt', dt, 's'), cls: cls(c, 'dt', 'tenue'), ancla: 'c', dy: 16 },
    { k: 'texto', x: 0.25 * T, y: 1.05, html: et(c, 'phi', c.v('phi')), cls: cls(c, 'phi', 'marca'), ancla: 'l', dy: -2 },
  ];
  return {
    x: { min: 0, max: 2 * T, unidad: 's', titulo: 't' },
    y: { min: -1.3, max: 1.3, unidad: '', titulo: '', oculto: false },
    items,
    pie: 'Un retardo de un periodo entero son 360°: φ = 360·Δt/T.',
  };
}

function diodo(c: Contexto): Escena | null {
  const n = c.v('n') ?? 1;
  const VT = c.v('VT') ?? 0.025852;
  const nVT = n * VT;
  let IS = c.v('IS');
  let V = c.v('V');
  let I = c.v('I');
  if (!pos(IS)) IS = pos(I) && fin(V) ? I / (Math.exp(V / nVT) - 1) : 1e-14;
  if (!fin(V) && pos(I)) V = nVT * Math.log(I / IS + 1);
  if (!fin(V)) {
    // semilog: millivolts per decade
    const xs = rangoLin(0.3, 0.8);
    const items: ItemG[] = [{ k: 'linea', x: xs, y: xs.map((x) => IS! * (Math.exp(x / nVT) - 1)), cls: 'curva' }];
    const d = nVT * Math.log(10);
    const v0 = nVT * Math.log(1e-3 / IS);
    items.push({ k: 'flecha', x1: v0, y1: 1e-3, x2: v0 + d, y2: 1e-3, cls: 'res', doble: true });
    items.push({ k: 'flecha', x1: v0 + d, y1: 1e-3, x2: v0 + d, y2: 1e-2, cls: 'tenue' });
    items.push({ k: 'texto', x: v0, y: 1e-2, html: `${fmt(d, 'V')} por década`, cls: 'res', ancla: 'r', dy: 4 });
    return {
      x: { min: 0.3, max: 0.8, unidad: 'V', titulo: 'V' },
      y: { min: 1e-9, max: 1, log: true, unidad: 'A', titulo: 'I' },
      items,
      pie: 'En escala logarítmica la característica es una recta: cada década de corriente cuesta los mismos milivoltios.',
    };
  }
  if (!pos(I)) I = IS * (Math.exp(V / nVT) - 1);
  const Vop = V as number;
  const Iop = I as number;
  const a = Math.max(0, Vop - 0.15);
  const b = Vop + nVT * Math.log(3);
  const xs = rangoLin(a, b);
  const rd = nVT / Iop;
  const xt = [Vop - Iop * rd * 0.9, Vop + Iop * rd * 1.6];
  return {
    x: { min: a, max: b, unidad: 'V', titulo: 'V' },
    y: { min: 0, max: Iop * 3.1, unidad: 'A', titulo: 'I' },
    items: [
      { k: 'linea', x: xs, y: xs.map((x) => IS! * (Math.exp(x / nVT) - 1)), cls: 'curva' },
      { k: 'linea', x: xt, y: xt.map((x) => Iop + (x - Vop) / rd), cls: 'guia2' },
      { k: 'flecha', x1: Vop, y1: 0, x2: Vop, y2: Iop, cls: cls(c, 'V', 'tenue') },
      { k: 'punto', x: Vop, y: Iop, cls: 'res' },
      { k: 'texto', x: Vop, y: Iop, html: `${fmt(Iop, 'A')} · ${fmt(Vop, 'V')}`, cls: 'res', ancla: 'r', dy: -8 },
      { k: 'texto', x: xt[1] as number, y: Iop + ((xt[1] as number) - Vop) / rd, html: `pendiente 1/r<tspan dy="3" font-size="0.75em">d</tspan><tspan dy="-3"> </tspan>(r<tspan dy="3" font-size="0.75em">d</tspan><tspan dy="-3"> = ${fmt(rd, 'Ω')})</tspan>`, cls: 'tenue', ancla: 'r', dy: 14 },
    ],
    pie: 'La tangente en el punto de trabajo da la resistencia dinámica r<sub>d</sub> = n·V<sub>T</sub>/I.',
  };
}

function cuadratica(c: Contexto): Escena | null {
  const kn = c.v('kn');
  if (!pos(kn)) return null;
  const Vth = c.v('Vth') ?? 0;
  let VGS = c.v('VGS');
  const ID = c.v('ID');
  if (!fin(VGS) && pos(ID)) VGS = Vth + Math.sqrt((2 * ID) / kn);
  if (!fin(VGS)) return null;
  const Vov = Math.max(VGS - Vth, 1e-3);
  const I = 0.5 * kn * Vov * Vov;
  const b = Vth + Vov * 1.6;
  const a = Math.min(0, Vth);
  const xs = rangoLin(a, b);
  const gm = kn * Vov;
  return {
    x: { min: a, max: b, unidad: 'V', titulo: Vth === 0 && c.v('Vth') === undefined ? 'V<tspan dy="3" font-size="0.75em">ov</tspan>' : 'V<tspan dy="3" font-size="0.75em">GS</tspan>' },
    y: { min: 0, max: 0.5 * kn * (b - Vth) ** 2 * 1.05, unidad: 'A', titulo: 'I<tspan dy="3" font-size="0.75em">D</tspan>' },
    items: [
      { k: 'linea', x: xs, y: xs.map((x) => (x > Vth ? 0.5 * kn * (x - Vth) ** 2 : 0)), cls: 'curva' },
      ...(c.v('Vth') !== undefined ? [{ k: 'vguia' as const, x: Vth, cls: cls(c, 'Vth', 'guia'), html: et(c, 'Vth', Vth) }] : []),
      { k: 'linea', x: [VGS - Vov * 0.5, VGS + Vov * 0.5], y: [I - gm * Vov * 0.5, I + gm * Vov * 0.5], cls: 'guia2' },
      { k: 'punto', x: VGS, y: I, cls: 'res' },
      { k: 'texto', x: VGS, y: I, html: `${fmt(I, 'A')}`, cls: 'res', ancla: 'r', dy: -8 },
    ],
    pie: `La pendiente en el punto de trabajo es g<sub>m</sub> = ${fmt(gm, 'S')}: crece con la raíz de la corriente.`,
  };
}

function rizado(c: Contexto): Escena | null {
  const dV = c.v('dV');
  if (!pos(dV)) return null;
  const Vp = pos(c.v('Vp')) ? (c.v('Vp') as number) : 10 * dV;
  const T = pos(c.v('T')) ? (c.v('T') as number) : 1;
  const xs: number[] = [];
  const ys: number[] = [];
  const tc = 0.18 * T;
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i <= 20; i++) {
      const t = k * T + (i / 20) * (T - tc);
      xs.push(t);
      ys.push(Vp - (dV * (t - k * T)) / (T - tc));
    }
    for (let i = 1; i <= 12; i++) {
      const u = i / 12;
      xs.push(k * T + T - tc + u * tc);
      ys.push(Vp - dV + dV * Math.sin((u * Math.PI) / 2));
    }
  }
  const lo = Vp - dV * 3;
  return {
    x: { min: 0, max: 3 * T, unidad: pos(c.v('T')) ? 's' : '', titulo: pos(c.v('T')) ? 't' : 't/T' },
    y: { min: Math.max(0, lo), max: Vp + dV * 1.2, unidad: 'V', titulo: 'v' },
    items: [
      { k: 'hguia', y: Vp, cls: 'guia', html: pos(c.v('Vp')) ? et(c, 'Vp', Vp, 'V') : 'pico', lado: 'r' },
      { k: 'hguia', y: Vp - dV, cls: 'guia' },
      { k: 'linea', x: xs, y: ys, cls: 'curva' },
      { k: 'flecha', x1: 2.5 * T, y1: Vp, x2: 2.5 * T, y2: Vp - dV, cls: cls(c, 'dV', 'tenue'), doble: true },
      { k: 'texto', x: 2.5 * T, y: Vp - dV / 2, html: et(c, 'dV', dV, 'V'), cls: cls(c, 'dV'), ancla: 'r', dy: 4 },
      ...(pos(c.v('T')) ? [{ k: 'flecha' as const, x1: T - tc, y1: Vp - dV * 1.9, x2: 2 * T - tc, y2: Vp - dV * 1.9, cls: cls(c, 'T', 'tenue'), doble: true }, { k: 'texto' as const, x: 1.5 * T - tc, y: Vp - dV * 1.9, html: `T = ${fmt(T, 's')}`, cls: cls(c, 'T', 'tenue'), ancla: 'c' as const, dy: 14 }] : []),
    ],
    pie: 'Entre picos el condensador alimenta la carga solo y se descarga ΔV; en cada pico el rectificador lo recarga.',
  };
}

function triangular(c: Contexto): Escena | null {
  const dI = c.v('dI');
  if (!pos(dI)) return null;
  const Io = pos(c.v('Io')) ? (c.v('Io') as number) : dI * 1.5;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let k = 0; k <= 3; k++) {
    xs.push(k, k + 0.5);
    ys.push(Io - dI / 2, Io + dI / 2);
  }
  return {
    x: { min: 0, max: 3, unidad: '', titulo: 't/T' },
    y: { min: 0, max: Io + dI * 1.1, unidad: 'A', titulo: 'i<tspan dy="3" font-size="0.75em">L</tspan>' },
    items: [
      { k: 'hguia', y: Io, cls: cls(c, 'Io', 'guia'), html: pos(c.v('Io')) ? et(c, 'Io', Io, 'A') : 'media', lado: 'l' },
      { k: 'hguia', y: Io + dI / 2, cls: cls(c, 'Ipk', 'guia'), html: c.v('Ipk') !== undefined ? et(c, 'Ipk', Io + dI / 2, 'A') : 'pico', lado: 'r' },
      { k: 'linea', x: xs.slice(0, -1), y: ys.slice(0, -1), cls: 'curva' },
      { k: 'flecha', x1: 2.5, y1: Io - dI / 2, x2: 2.5, y2: Io + dI / 2, cls: cls(c, 'dI', 'tenue'), doble: true },
      { k: 'texto', x: 2.55, y: Io - dI * 0.25, html: et(c, 'dI', dI, 'A'), cls: cls(c, 'dI'), ancla: 'l' },
    ],
    pie: 'La corriente de la bobina sube con el interruptor cerrado y baja con él abierto: ΔI de pico a pico alrededor de la media.',
  };
}

function pwm(c: Contexto): Escena | null {
  const D = c.v('D');
  if (!fin(D) || D < 0 || D > 1) return null;
  const V = pos(c.v('V')) ? (c.v('V') as number) : 1;
  const lo = c.v('Vlow') ?? 0;
  const avg = lo + D * (V - lo);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let k = 0; k < 3; k++) {
    xs.push(k, k, k + D, k + D);
    ys.push(lo, V, V, lo);
  }
  xs.push(3);
  ys.push(lo);
  const u = c.unidad('V') || 'V';
  return {
    x: { min: 0, max: 3, unidad: '', titulo: 't/T' },
    y: { min: Math.min(0, lo), max: V * 1.2, unidad: u, titulo: '' },
    items: [
      { k: 'linea', x: xs, y: ys, cls: 'curva' },
      { k: 'hguia', y: avg, cls: cls(c, 'Vavg', 'guia2'), html: c.v('Vavg') !== undefined ? et(c, 'Vavg', avg, u) : `media = ${fmt(avg, u)}`, lado: 'r' },
      { k: 'flecha', x1: 1, y1: V * 1.08, x2: 1 + D, y2: V * 1.08, cls: cls(c, 'D', 'tenue'), doble: true },
      { k: 'texto', x: 1 + D / 2, y: V * 1.08, html: `D = ${fmt(D * 100, '%', 3)}`, cls: cls(c, 'D', 'tenue'), ancla: 'c', dy: -4 },
    ],
    pie: 'El valor medio es el nivel alto por la fracción del periodo que dura: D·V.',
  };
}

function escalera(c: Contexto): Escena | null {
  const nb = c.v('nb');
  const Vref = c.v('Vref');
  let LSB = c.v('LSB');
  if (!pos(LSB) && pos(Vref) && pos(nb)) LSB = Vref / 2 ** nb;
  if (!pos(LSB)) return null;
  const V = c.v('V');
  let k = c.v('k');
  if (!fin(k) && fin(V)) k = Math.floor(V / LSB);
  const total = pos(nb) ? 2 ** nb : 8;
  const ver = Math.min(total, 8);
  const k0 = fin(k) ? Math.max(0, Math.min(total - ver, Math.round(k) - 3)) : 0;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < ver; i++) {
    xs.push((k0 + i) * LSB, (k0 + i + 1) * LSB);
    ys.push(k0 + i, k0 + i);
  }
  const items: ItemG[] = [
    { k: 'linea', x: [k0 * LSB, (k0 + ver) * LSB], y: [k0 - 0.5, k0 + ver - 0.5], cls: 'guia' },
    { k: 'linea', x: xs, y: ys, cls: 'curva' },
    { k: 'flecha', x1: (k0 + 1) * LSB, y1: k0 + 0.5, x2: (k0 + 2) * LSB, y2: k0 + 0.5, cls: cls(c, 'LSB', 'tenue'), doble: true },
    { k: 'texto', x: (k0 + 2.15) * LSB, y: k0 + 0.5, html: `1 LSB = ${fmt(LSB, 'V')}`, cls: cls(c, 'LSB', 'tenue'), ancla: 'l', dy: 4 },
  ];
  if (fin(k)) {
    const xv = fin(V) ? V : (k + 0.5) * LSB;
    items.push({ k: 'punto', x: xv, y: Math.round(k), cls: 'res' });
    items.push({ k: 'texto', x: xv, y: Math.round(k), html: `código ${Math.round(k)} · ${fmt(xv, 'V')}`, cls: 'res', ancla: 'r', dy: -8 });
  }
  return {
    x: { min: k0 * LSB, max: (k0 + ver) * LSB, unidad: 'V', titulo: 'V' },
    y: { min: k0 - 0.6, max: k0 + ver + 0.4, unidad: '', titulo: 'código' },
    items,
    pie: total > ver ? `Ampliado: ${ver} de los ${total} escalones de ${pos(nb) ? nb + ' bits' : 'la escala'}.` : 'Cada escalón es un LSB: la tensión más pequeña que el convertidor distingue.',
  };
}

function cinco55(c: Contexto): Escena | null {
  let tH = c.v('tH');
  let tL = c.v('tL');
  if (!pos(tH) && pos(tL)) tH = tL;
  if (!pos(tL) && pos(tH)) tL = tH;
  if (!pos(tH) || !pos(tL)) return null;
  const T = tH + tL;
  const xo: number[] = [];
  const yo: number[] = [];
  const xc: number[] = [];
  const yc: number[] = [];
  for (let k = 0; k < 2; k++) {
    const t0 = k * T;
    xo.push(t0, t0, t0 + tH, t0 + tH);
    yo.push(1.25, 2.1, 2.1, 1.25);
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      xc.push(t0 + u * tH);
      yc.push(1 / 3 + (1 / 3) * (1 - Math.exp(-u * 0.693)) / 0.5);
    }
    for (let i = 1; i <= 20; i++) {
      const u = i / 20;
      xc.push(t0 + tH + u * tL);
      yc.push((2 / 3) * Math.exp(-u * 0.693));
    }
  }
  xo.push(2 * T);
  yo.push(1.25);
  return {
    x: { min: 0, max: 2 * T, unidad: 's', titulo: 't' },
    y: { min: 0, max: 2.4, unidad: '', titulo: '', oculto: true },
    items: [
      { k: 'hguia', y: 2 / 3, cls: 'guia', html: '⅔ V<tspan dy="3" font-size="0.75em">CC</tspan>', lado: 'r' },
      { k: 'hguia', y: 1 / 3, cls: 'guia', html: '⅓ V<tspan dy="3" font-size="0.75em">CC</tspan>', lado: 'r' },
      { k: 'linea', x: xc, y: yc, cls: 'curva2' },
      { k: 'linea', x: xo, y: yo, cls: 'curva' },
      { k: 'flecha', x1: 0, y1: 2.25, x2: tH, y2: 2.25, cls: cls(c, 'tH', 'tenue'), doble: true },
      { k: 'texto', x: tH / 2, y: 2.25, html: et(c, 'tH', tH, 's'), cls: cls(c, 'tH', 'tenue'), ancla: 'c', dy: -4 },
      { k: 'flecha', x1: tH, y1: 1.12, x2: T, y2: 1.12, cls: cls(c, 'tL', 'tenue'), doble: true },
      { k: 'texto', x: tH + tL / 2, y: 1.12, html: et(c, 'tL', tL, 's'), cls: cls(c, 'tL', 'tenue'), ancla: 'c', dy: 13 },
      { k: 'texto', x: 0.02 * T, y: 0.05, html: 'v<tspan dy="3" font-size="0.75em">C</tspan>', cls: 'tenue', ancla: 'l', dy: -4 },
      { k: 'texto', x: 0.02 * T, y: 1.6, html: 'salida', cls: 'tenue', ancla: 'l' },
    ],
    pie: 'El condensador oscila entre ⅓ y ⅔ de la alimentación: se carga por R<sub>A</sub> + R<sub>B</sub> (salida alta) y se descarga por R<sub>B</sub>.',
  };
}

function histeresis(c: Contexto): Escena | null {
  const H = c.v('VTH');
  const Lo = c.v('VTL');
  if (!fin(H) || !fin(Lo) || H <= Lo) return null;
  const w = H - Lo;
  const a = Lo - w;
  const b = H + w;
  return {
    x: { min: a, max: b, unidad: 'V', titulo: 'v<tspan dy="3" font-size="0.75em">in</tspan>' },
    y: { min: -1.4, max: 1.4, unidad: '', titulo: 'salida', oculto: false },
    items: [
      { k: 'franja', x1: Lo, x2: H, cls: 'banda' },
      { k: 'linea', x: [a, H, H, b], y: [1, 1, -1, -1], cls: 'curva' },
      { k: 'linea', x: [b, Lo, Lo, a], y: [-1, -1, 1, 1], cls: 'curva2' },
      { k: 'vguia', x: H, cls: cls(c, 'VTH', 'guia'), html: et(c, 'VTH', H, 'V') },
      { k: 'vguia', x: Lo, cls: cls(c, 'VTL', 'guia'), html: et(c, 'VTL', Lo, 'V'), abajo: true },
      { k: 'texto', x: (H + Lo) / 2, y: 0, html: `ΔV = ${fmt(w, 'V')}`, cls: 'marca', ancla: 'c' },
    ],
    pie: 'La salida solo cambia al cruzar el umbral del sentido contrario: el ruido menor que ΔV no la hace oscilar.',
  };
}

function escalon(c: Contexto): Escena | null {
  const tr = c.v('tr');
  if (!pos(tr)) return null;
  const tau = tr / Math.log(9);
  const xs = rangoLin(0, 5 * tau);
  const t10 = tau * Math.log(1 / 0.9);
  const t90 = tau * Math.log(10);
  return {
    x: { min: 0, max: 5 * tau, unidad: 's', titulo: 't' },
    y: { min: 0, max: 112, unidad: '%', titulo: 'salida' },
    items: [
      { k: 'hguia', y: 10, cls: 'guia', html: '10 %', lado: 'r' },
      { k: 'hguia', y: 90, cls: 'guia', html: '90 %', lado: 'r' },
      { k: 'linea', x: xs, y: xs.map((x) => 100 * (1 - Math.exp(-x / tau))), cls: 'curva' },
      { k: 'flecha', x1: t10, y1: 50, x2: t90, y2: 50, cls: cls(c, 'tr', 'tenue'), doble: true },
      { k: 'texto', x: (t10 + t90) / 2, y: 50, html: et(c, 'tr', tr, 's'), cls: cls(c, 'tr'), ancla: 'c', dy: -6 },
    ],
    pie: 'El tiempo de subida va del 10 % al 90 % del escalón; con un solo polo, t<sub>r</sub> · BW ≈ 0,35.',
  };
}

function amortiguamiento(c: Contexto): Escena | null {
  const z = c.v('zeta');
  if (!pos(z)) return null;
  const xs = rangoLin(0, 16, 240);
  const y = (t: number): number => {
    if (Math.abs(z - 1) < 1e-6) return 1 - (1 + t) * Math.exp(-t);
    if (z < 1) {
      const wd = Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * t) * (Math.cos(wd * t) + (z / wd) * Math.sin(wd * t));
    }
    const r = Math.sqrt(z * z - 1);
    const s1 = -z + r;
    const s2 = -z - r;
    return 1 + (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s1 - s2);
  };
  const ys = xs.map(y);
  const pico = Math.max(...ys);
  const items: ItemG[] = [
    { k: 'hguia', y: 1, cls: 'guia', html: 'final', lado: 'r' },
    { k: 'linea', x: xs, y: ys, cls: 'curva' },
  ];
  if (z < 1) {
    const tp = Math.PI / Math.sqrt(1 - z * z);
    items.push({ k: 'punto', x: tp, y: y(tp), cls: 'marca' }, { k: 'texto', x: tp, y: y(tp), html: `sobrepico ${fmt((pico - 1) * 100, '%', 2)}`, cls: 'marca', ancla: 'l', dy: -6 });
  }
  items.push({ k: 'texto', x: 15.5, y: 0.15, html: `${et(c, 'zeta', z, '')} · ${z < 1 ? 'subamortiguado' : z === 1 ? 'crítico' : 'sobreamortiguado'}`, cls: cls(c, 'zeta', 'marca'), ancla: 'r' });
  return {
    x: { min: 0, max: 16, unidad: '', titulo: 'ω<tspan dy="3" font-size="0.75em">0</tspan><tspan dy="-3">·t</tspan>' },
    y: { min: 0, max: Math.max(1.25, pico * 1.08), unidad: '', titulo: 'respuesta' },
    items,
    pie: 'Con ζ < 1 la respuesta al escalón oscila y se pasa del valor final; con ζ ≥ 1 llega sin pasarse.',
  };
}

function cuadratura(c: Contexto): Escena | null {
  const rols = ['a', 'b', 'c', 'd'].filter((r) => fin(c.v(r)));
  if (rols.length < 2) return null;
  const vals = rols.map((r) => Math.abs(c.v(r) as number));
  // spiral of right triangles: each term perpendicular to the running sum
  const pts: [number, number][] = [[0, 0]];
  let dirx = 1;
  let diry = 0;
  let px = 0;
  let py = 0;
  vals.forEach((v, i) => {
    if (i === 0) {
      px = v;
      py = 0;
    } else {
      const L = Math.hypot(px, py) || 1;
      dirx = -py / L;
      diry = px / L;
      px += dirx * v;
      py += diry * v;
    }
    pts.push([px, py]);
  });
  const xsAll = pts.map((p) => p[0]);
  const ysAll = pts.map((p) => p[1]);
  const xmin = Math.min(...xsAll);
  const xmax = Math.max(...xsAll);
  const ymin = Math.min(...ysAll);
  const ymax = Math.max(...ysAll);
  const span = Math.max(xmax - xmin, (ymax - ymin) * 1.7) || 1;
  const cx = (xmin + xmax) / 2;
  const cy = (ymin + ymax) / 2;
  const items: ItemG[] = [];
  const colores = ['seg-a', 'seg-b', 'seg-c', 'seg-d'];
  rols.forEach((r, i) => {
    const p0 = pts[i] as [number, number];
    const p1 = pts[i + 1] as [number, number];
    items.push({ k: 'linea', x: [p0[0], p1[0]], y: [p0[1], p1[1]], cls: c.obj(r) ? 'res-grueso' : (colores[i] as string) });
    const mx = (p0[0] + p1[0]) / 2;
    const my = (p0[1] + p1[1]) / 2;
    const der = i > 0 && p1[0] >= p0[0] - 1e-12;
    items.push({ k: 'texto', x: mx, y: my, html: et(c, r, c.v(r) as number, c.unidad(r)), cls: c.obj(r) ? 'res' : (colores[i] as string), ancla: i === 0 ? 'c' : der ? 'l' : 'r', dy: i === 0 ? 14 : 4 });
  });
  const fin_ = pts[pts.length - 1] as [number, number];
  const r = Math.hypot(fin_[0], fin_[1]);
  items.unshift({ k: 'area', x: pts.map((p) => p[0]), y: pts.map((p) => p[1]), cls: 'banda' });
  items.push({ k: 'linea', x: [0, fin_[0]], y: [0, fin_[1]], cls: c.obj('r') ? 'res-grueso' : 'total' });
  items.push({ k: 'texto', x: fin_[0] / 2, y: fin_[1] / 2, html: et(c, 'r', fin(c.v('r')) ? (c.v('r') as number) : r, c.unidad('r')), cls: c.obj('r') ? 'res' : 'total', ancla: 'r', dy: -6 });
  return {
    // a single triangle sits to the left, leaving room for the label of the vertical leg on its right
    x: rols.length === 2
      ? { min: xmin - span * 0.2, max: xmin + span * 1.04, unidad: '', titulo: '', oculto: true }
      : { min: cx - span * 0.62, max: cx + span * 0.62, unidad: '', titulo: '', oculto: true },
    y: { min: cy - span * 0.36, max: cy + span * 0.36, unidad: '', titulo: '', oculto: true },
    items,
    cuadrado: true,
    pie: rols.length > 2 ? 'Se suman en cuadratura: cada término es perpendicular a la suma de los anteriores.' : 'Se suman en cuadratura, como los catetos de un triángulo rectángulo: el total es la hipotenusa.',
  };
}

function suma(c: Contexto): Escena | null {
  const rols = ['a', 'b', 'c', 'd'].filter((r) => fin(c.v(r)));
  if (!rols.length) return null;
  const items: ItemG[] = [];
  let acc = 0;
  const colores = ['seg-a', 'seg-b', 'seg-c', 'seg-d'];
  const u = c.unidad('r') || c.unidad(rols[0] as string);
  let lo = 0;
  let hi = 0;
  rols.forEach((r, i) => {
    const v = c.v(r) as number;
    const y0 = acc;
    acc += v;
    lo = Math.min(lo, y0, acc);
    hi = Math.max(hi, y0, acc);
    items.push({ k: 'barra', x: i, y0, y1: acc, cls: c.obj(r) ? 'res' : (colores[i] as string) });
    if (i < rols.length) items.push({ k: 'linea', x: [i + 0.35, i + 0.65], y: [acc, acc], cls: 'guia' });
    items.push({ k: 'texto', x: i, y: Math.max(y0, acc), html: `${v >= 0 && i > 0 ? '+' : ''}${fmt(v, c.unidad(r) || u)}`, cls: c.obj(r) ? 'res' : 'tenue', ancla: 'c', dy: -5 });
  });
  const total = fin(c.v('r')) ? (c.v('r') as number) : acc;
  const n = rols.length;
  items.push({ k: 'barra', x: n, y0: 0, y1: acc, cls: c.obj('r') ? 'res' : 'total' });
  items.push({ k: 'texto', x: n, y: Math.max(0, acc), html: `${fmt(acc, u)}`, cls: c.obj('r') ? 'res' : 'total', ancla: 'c', dy: -5 });
  lo = Math.min(lo, 0);
  const pad = (hi - lo) * 0.18 || 1;
  return {
    x: { min: -0.6, max: n + 0.6, unidad: '', titulo: '', categorias: [...rols.map((r) => c.sim(r)), c.sim('r')] },
    y: { min: lo < 0 ? lo - pad * 0.4 : 0, max: hi + pad, unidad: u, titulo: '' },
    items,
    pie: total !== acc && Math.abs(total - acc) > 1e-9 * Math.abs(acc) ? '' : 'Los términos se acumulan de izquierda a derecha hasta el total.',
  };
}

function potenciaCarga(c: Contexto): Escena | null {
  const Vth = c.v('Vth');
  const Rth = c.v('Rth');
  if (!pos(Vth) || !pos(Rth)) return null;
  const RL = c.v('RL');
  const a = Math.min(Rth / 30, pos(RL) ? RL / 2 : Infinity);
  const b = Math.max(Rth * 30, pos(RL) ? RL * 2 : 0);
  const xs = rangoLog(a, b);
  const P = (r: number) => (Vth * Vth * r) / (Rth + r) ** 2;
  const items: ItemG[] = [
    { k: 'linea', x: xs, y: xs.map(P), cls: 'curva' },
    { k: 'vguia', x: Rth, cls: 'guia', html: `R<tspan dy="3" font-size="0.75em">L</tspan><tspan dy="-3"> = R</tspan><tspan dy="3" font-size="0.75em">Th</tspan>` },
    { k: 'hguia', y: P(Rth), cls: 'guia', html: `máx. ${fmt(P(Rth), 'W')}`, lado: 'r' },
  ];
  if (pos(RL)) items.push({ k: 'punto', x: RL, y: P(RL), cls: 'res' }, { k: 'texto', x: RL, y: P(RL), html: et(c, 'P', P(RL), 'W'), cls: 'res', ancla: RL > Rth ? 'l' : 'r', dy: 14 });
  return {
    x: { min: a, max: b, log: true, unidad: 'Ω', titulo: 'R<tspan dy="3" font-size="0.75em">L</tspan>' },
    y: { min: 0, max: P(Rth) * 1.2, unidad: 'W', titulo: 'P' },
    items,
    pie: 'La carga recibe la máxima potencia cuando iguala la resistencia de la fuente (con un rendimiento del 50 %).',
  };
}

function niveles(c: Contexto): Escena | null {
  const roles = ['VOH', 'VIH', 'VIL', 'VOL'].filter((r) => fin(c.v(r)));
  if (!roles.length) return null;
  const vals = roles.map((r) => c.v(r) as number);
  const top = Math.max(...vals) * 1.25 || 1;
  const items: ItemG[] = [];
  const X: Record<string, [number, number]> = { VOH: [0, 1], VOL: [0, 1], VIH: [1.4, 2.4], VIL: [1.4, 2.4] };
  for (const r of roles) {
    const v = c.v(r) as number;
    const [a, b] = X[r] as [number, number];
    items.push({ k: 'linea', x: [a, b], y: [v, v], cls: 'curva' });
    items.push({ k: 'texto', x: a > 1 ? b : a, y: v, html: et(c, r, v, 'V'), cls: c.obj(r) ? 'res' : 'tenue', ancla: a > 1 ? 'r' : 'l', dy: -5 });
  }
  const H1 = c.v('VOH');
  const H2 = c.v('VIH');
  if (fin(H1) && fin(H2)) items.unshift({ k: 'area', x: [0, 2.4, 2.4, 0], y: [H2, H2, H1, H1], cls: 'banda' }, { k: 'texto', x: 1.2, y: (H1 + H2) / 2, html: `NM<tspan dy="3" font-size="0.75em">H</tspan><tspan dy="-3"> = ${fmt(H1 - H2, 'V')}</tspan>`, cls: 'res', ancla: 'c', dy: 4 });
  const L1 = c.v('VIL');
  const L2 = c.v('VOL');
  if (fin(L1) && fin(L2)) items.unshift({ k: 'area', x: [0, 2.4, 2.4, 0], y: [L2, L2, L1, L1], cls: 'banda' }, { k: 'texto', x: 1.2, y: (L1 + L2) / 2, html: `NM<tspan dy="3" font-size="0.75em">L</tspan><tspan dy="-3"> = ${fmt(L1 - L2, 'V')}</tspan>`, cls: 'res', ancla: 'c', dy: 4 });
  return {
    x: { min: -0.1, max: 2.5, unidad: '', titulo: '', categorias: [], oculto: true },
    y: { min: 0, max: top, unidad: 'V', titulo: 'V' },
    items: [...items, { k: 'texto', x: 0.5, y: top * 0.97, html: 'salida', cls: 'tenue', ancla: 'c' }, { k: 'texto', x: 1.9, y: top * 0.97, html: 'entrada', cls: 'tenue', ancla: 'c' }],
    pie: 'El margen de ruido es lo que separa lo que garantiza la salida de lo que exige la entrada.',
  };
}

function espectro(c: Contexto): Escena | null {
  const fs = c.v('fs');
  const fol = c.v('fol');
  const ffi = c.v('ffi');
  let fim = c.v('fim');
  if (!pos(fim) && pos(fol) && pos(ffi) && pos(fs) && fol > fs) fim = fol + ffi;
  const lineas: [string, number, string][] = [];
  if (pos(ffi)) lineas.push(['ffi', ffi, 'curva2']);
  if (pos(fs)) lineas.push(['fs', fs, 'curva']);
  if (pos(fol)) lineas.push(['fol', fol, 'guia2']);
  if (pos(fim)) lineas.push(['fim', fim, 'guia']);
  if (lineas.length < 2) return null;
  const max = Math.max(...lineas.map((l) => l[1])) * 1.12;
  const items: ItemG[] = [];
  const alto: Record<string, number> = { ffi: 0.7, fs: 1, fol: 0.85, fim: 0.55 };
  const orden = [...lineas].sort((p, q) => p[1] - q[1]);
  for (const [r, f, k] of lineas) {
    // a line with a close neighbour on its right labels to the left
    const i = orden.findIndex((l) => l[0] === r);
    const sig = orden[i + 1];
    const izq = (sig && sig[1] - f < max * 0.25) || f > max * 0.7;
    items.push({ k: 'flecha', x1: f, y1: 0, x2: f, y2: alto[r] as number, cls: c.obj(r) ? 'res' : k });
    items.push({ k: 'texto', x: f, y: alto[r] as number, html: et(c, r, f, 'Hz'), cls: c.obj(r) ? 'res' : 'tenue', ancla: izq ? 'r' : 'l', dy: -4 });
  }
  return {
    x: { min: 0, max, unidad: 'Hz', titulo: 'f' },
    y: { min: 0, max: 1.25, unidad: '', titulo: '', oculto: true },
    items,
    pie: 'El mezclador lleva la señal a la FI (f<sub>OL</sub> − f<sub>s</sub>); la imagen, a 2·f<sub>FI</sub> de la señal, también caería en la FI.',
  };
}

function am(c: Contexto): Escena | null {
  const Amax = c.v('Amax');
  const Amin = c.v('Amin');
  if (!pos(Amax) || !fin(Amin)) return null;
  const xs = rangoLin(0, 2, 600);
  const env = (x: number) => (Amax + Amin) / 2 + ((Amax - Amin) / 2) * Math.sin(2 * Math.PI * x);
  return {
    x: { min: 0, max: 2, unidad: '', titulo: 't' },
    y: { min: -Amax * 1.2, max: Amax * 1.3, unidad: 'V', titulo: 'v' },
    items: [
      { k: 'linea', x: xs, y: xs.map((x) => env(x) * Math.sin(2 * Math.PI * 14 * x)), cls: 'curva' },
      { k: 'linea', x: xs, y: xs.map(env), cls: 'guia2' },
      { k: 'hguia', y: Amax, cls: cls(c, 'Amax', 'guia'), html: et(c, 'Amax', Amax, 'V'), lado: 'r' },
      { k: 'hguia', y: Amin, cls: cls(c, 'Amin', 'guia'), html: et(c, 'Amin', Amin, 'V'), lado: 'r' },
      { k: 'texto', x: 0.75, y: Amax * 1.18, html: et(c, 'm', (Amax - Amin) / (Amax + Amin), ''), cls: cls(c, 'm', 'marca'), ancla: 'c' },
    ],
    pie: 'El índice se lee en pantalla con la envolvente: m = (A<sub>máx</sub> − A<sub>mín</sub>)/(A<sub>máx</sub> + A<sub>mín</sub>).',
  };
}

function banda(c: Contexto): Escena | null {
  const f1 = c.v('f1');
  const f2 = c.v('f2');
  if (!pos(f1) || !pos(f2)) return null;
  const f0 = Math.sqrt(f1 * f2);
  const a = Math.min(f1, f2) / 4;
  const b = Math.max(f1, f2) * 4;
  return {
    x: { min: a, max: b, log: true, unidad: 'Hz', titulo: 'f' },
    y: { min: 0, max: 1.3, unidad: '', titulo: '', oculto: true },
    items: [
      { k: 'franja', x1: f1, x2: f2, cls: 'banda' },
      { k: 'vguia', x: f1, cls: cls(c, 'f1', 'guia'), html: et(c, 'f1', f1, 'Hz') },
      { k: 'vguia', x: f2, cls: cls(c, 'f2', 'guia'), html: et(c, 'f2', f2, 'Hz') },
      { k: 'flecha', x1: f0, y1: 0, x2: f0, y2: 0.75, cls: cls(c, 'f0', 'marca') },
      { k: 'texto', x: f0, y: 0.75, html: et(c, 'f0', f0, 'Hz'), cls: cls(c, 'f0', 'marca'), ancla: 'c', dy: -5 },
      { k: 'flecha', x1: f1, y1: 0.3, x2: f0, y2: 0.3, cls: 'tenue', doble: true },
      { k: 'flecha', x1: f0, y1: 0.3, x2: f2, y2: 0.3, cls: 'tenue', doble: true },
      { k: 'texto', x: f0, y: 0.3, html: `×${fmt(f0 / f1, '', 3)}`, cls: 'tenue', ancla: 'c', dy: 14 },
    ],
    pie: 'En escala logarítmica la frecuencia central queda en el medio: es la media geométrica de los extremos.',
  };
}

export const GRAFICOS: Record<string, (c: Contexto) => Escena | null> = {
  carga: (c) => carga(c, false),
  descarga: (c) => carga(c, true),
  bode,
  resonancia,
  impedancia,
  decibelios,
  senoide,
  desfase,
  diodo,
  cuadratica,
  rizado,
  triangular,
  pwm,
  escalera,
  '555': cinco55,
  histeresis,
  escalon,
  amortiguamiento,
  cuadratura,
  suma,
  'potencia-carga': potenciaCarga,
  niveles,
  espectro,
  am,
  banda,
};
