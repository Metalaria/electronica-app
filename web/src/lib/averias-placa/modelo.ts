// 1.3 (averias13): «Busque la avería» on a console's board — the multimeter's leads on pads of the real board (3D or
// the photo) and the reading of a hidden fault. Pure (no DOM; it runs in Node for the unit tests).
//
// Nothing is invented here. The faults, their values and their sources are those of the console's lesson of faults
// («Consolas por dentro», contenido/lecciones11/consola-<m>/<m>-averias.yaml, card `averia`, published in
// public/libro/lecciones11/…json): its model (values and calculations), its faults (`con`: what each one changes) and
// the blocks it cites (service manuals, ConsoleMods, the book). A console's definition (definiciones.ts) only says
// which nets of its board each of the lesson's measurements is taken on, and what that net is in words: a net the
// lesson says nothing about reads «sin dato», never a made-up number.

import { compilar } from '../../componentes/calculadoras/expresion';

// ------------------------------------------------------------------ the lesson (published JSON, the part used here)

export type TextoJson = string | { t: string; s?: string }[] | undefined;

/** Plain text of a lesson's rich text (runs of text, subscripts, maths). */
export function plano(t: TextoJson): string {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return t.map((x) => x.s ?? '').join('');
}

export interface ModeloJson {
  valores: Record<string, { valor: number; unidad: string; nombre: string }>;
  calculos: Record<string, { expr?: string; si?: string; entonces?: string; sino?: string; unidad: string; nombre: string }>;
  orden: string[];
}

export interface FalloJson {
  id: string;
  pieza: string;
  con: Record<string, number>;
  texto: TextoJson;
}

export interface TarjetaAveriaJson {
  id: string;
  tipo: string;
  titulo: TextoJson;
  texto: TextoJson;
  libro: string[];
  solucion?: TextoJson;
  actividad?: {
    tipo: string;
    fallos: FalloJson[];
    sospechosos: { id: string; rotulo: TextoJson }[];
    sondas: { id: string; rotulo: TextoJson; valor: string }[];
    sano?: Record<string, number>;
  };
}

export interface LeccionJson {
  id: string;
  titulo?: TextoJson;
  modelo: ModeloJson;
  libro: Record<string, { cita: string; seccion?: string; fuente?: { titulo: string; url: string } }>;
  tarjetas: TarjetaAveriaJson[];
}

export type Valores = Record<string, number>;

/** The lesson's model with a fault's changes laid over it (`con`), every calculation done. */
export function evaluarModelo(m: ModeloJson, con: Valores = {}): Valores {
  const e: Valores = {};
  for (const [k, v] of Object.entries(m.valores)) e[k] = v.valor;
  Object.assign(e, con);
  for (const id of m.orden) {
    const c = m.calculos[id]!;
    if (c.si) e[id] = (e[c.si] ?? 0) !== 0 ? compilar(c.entonces!)(e) : compilar(c.sino!)(e);
    else e[id] = compilar(c.expr!)(e);
  }
  return e;
}

/** A source the fault's explanation cites: an external page (with its address) or a section of the book. */
export interface Cita {
  clave: string;
  cita: string;
  titulo: string;
  url: string | null;
}

export function citasDe(l: LeccionJson, t: TarjetaAveriaJson): Cita[] {
  return t.libro
    .map((k) => {
      const b = l.libro[k];
      if (!b) return null;
      if (b.fuente) return { clave: k, cita: b.cita, titulo: b.fuente.titulo, url: b.fuente.url };
      const sec = b.seccion?.replace(/^sec-/, '') ?? k.split('#')[0]!;
      return { clave: k, cita: b.cita, titulo: `Del libro: sección ${sec}`, url: b.seccion ? `#/libro/${k.split('#')[0]}/${b.seccion}` : null };
    })
    .filter((x): x is Cita => !!x);
}

// ------------------------------------------------------------------ a console's definition

export interface DefAveriaPlaca {
  /** «snes-no-enciende». */
  id: string;
  maquina: string;
  /** The board (consolas/placas/<placa>.json). */
  placa: string;
  /** The lesson and its card of the fault. */
  leccion: { parte: string; seccion: string; tarjeta: string };
  /** A photo of the console's data whose `posiciones` place the board's pads on it (the face shown), if any. */
  foto?: { id: string; lado: 'F' | 'B' };
  /**
   * Each of the lesson's measurements (its `sondas`), on the board: between which two nets, in which function
   * (V with the console plugged in and on; Ω with it off and unplugged). `sinSigno`: the lesson does not say which
   * contact is which (a jack whose polarity is not in its sources).
   */
  sondas: Record<string, { modo: 'V' | 'Ω'; redes: [string, string]; sinSigno?: boolean }>;
  /**
   * Nets that are the same node as one of those, for the lesson's model (the console on: the switch closed, a
   * filter's two sides, …), each with the measurement whose net it shares and the reason, in words.
   */
  iguales?: Record<string, { como: string; porque: string }>;
  /**
   * Voltages to ground (console on) of other nets of the path, as expressions of the lesson's model, each with where
   * the lesson says it («El 7805 recibe la entrada pero no da sus 5 V»): the fault's own words, not a new number.
   */
  tensiones?: Record<string, { expr: string; porque: string }>;
  /** What each net is, in words (shown when a lead touches it). */
  nombres: Record<string, string>;
  /** The test points of the list (the keyboard's and screen reader's way): pad ids («F1.1») and their names. */
  puntos: { pad: string; rotulo: string }[];
  /** The board's parts of each suspect (lit when it is named). */
  piezas: Record<string, string[]>;
  /** Where the camera and the photo start (board units, u = 0.01 mm): the parts of the fault. */
  encuadre: string[];
  /** Notes on the model's limits, shown under the list (e.g. «el modelo no cuenta la caída del puente»). */
  notas?: string[];
}

export type Modo = 'V' | 'Ω';

export type Resultado =
  | { tipo: 'valor'; valor: number; unidad: 'V' | 'Ω'; sonda: string | null }
  | { tipo: 'sin-dato'; motivo: string }
  | { tipo: 'aviso'; texto: string };

/** The net a measurement net stands for (itself, or the one it is the same node as). */
function nodo(def: DefAveriaPlaca, red: string): string {
  return def.iguales?.[red]?.como ?? red;
}

/** The measurement (lesson's `sondas` id) between these two nets in this function, and its sign (+1 as written). */
export function sondaEntre(def: DefAveriaPlaca, a: string, b: string, modo: Modo): { id: string; signo: 1 | -1; sinSigno: boolean } | null {
  const na = nodo(def, a);
  const nb = nodo(def, b);
  for (const [id, s] of Object.entries(def.sondas)) {
    if (s.modo !== modo) continue;
    const [x, y] = s.redes.map((r) => nodo(def, r)) as [string, string];
    if (x === na && y === nb) return { id, signo: 1, sinSigno: !!s.sinSigno };
    if (x === nb && y === na) return { id, signo: modo === 'Ω' ? 1 : -1, sinSigno: !!s.sinSigno };
  }
  return null;
}

/** Above this the meter reads open (OL): the lessons write an open fuse or switch as 1e9 Ω. */
export const ABIERTO = 1e8;

/**
 * What the meter reads with the red lead on net `roja` and the black on `negra` (null: not placed), in this function,
 * with the console on (plugged in and switched on) or off (unplugged), for the lesson's model `v` (a fault applied).
 * Ground is the reference of the voltages. Only the lesson's measurements (and the same nodes) have a value.
 */
export function lectura(def: DefAveriaPlaca, l: LeccionJson, v: Valores, roja: string | null, negra: string | null, modo: Modo, encendida: boolean): Resultado {
  const unidad = modo;
  if (modo === 'Ω' && encendida) return { tipo: 'aviso', texto: 'Con la consola encendida no se mide resistencia: apáguela y desenchúfela (el óhmetro pone su propia corriente).' };
  if (!roja || !negra) return modo === 'V' ? { tipo: 'valor', valor: 0, unidad, sonda: null } : { tipo: 'valor', valor: Infinity, unidad, sonda: null };
  if (roja === negra || nodo(def, roja) === nodo(def, negra)) return { tipo: 'valor', valor: 0, unidad, sonda: null };
  if (modo === 'V' && !encendida) return { tipo: 'valor', valor: 0, unidad, sonda: null };
  const s = sondaEntre(def, roja, negra, modo);
  if (!s) {
    // a voltage against ground: any two nets whose voltages to ground the lesson gives
    if (modo === 'V') {
      const a = tensionAMasa(def, l, v, roja);
      const b = tensionAMasa(def, l, v, negra);
      if (a !== null && b !== null) return { tipo: 'valor', valor: a - b, unidad, sonda: null };
    }
    return {
      tipo: 'sin-dato',
      motivo:
        modo === 'V'
          ? 'La avería documentada no dice qué tensión hay entre esos dos puntos: aquí no hay lectura con fuente.'
          : 'La avería documentada no dice qué resistencia hay entre esos dos puntos: aquí no hay lectura con fuente.',
    };
  }
  const calculo = def.sondas[s.id]!;
  const k = valorDe(l, def, s.id);
  const x = k ? v[k] : undefined;
  if (x === undefined) return { tipo: 'sin-dato', motivo: 'La lección no da este valor.' };
  if (modo === 'Ω') return { tipo: 'valor', valor: x >= ABIERTO ? Infinity : x, unidad, sonda: s.id };
  return { tipo: 'valor', valor: calculo.sinSigno ? Math.abs(x) : s.signo * x, unidad, sonda: s.id };
}

/** Which value of the lesson's model a measurement (`sondas` id) reads. */
function valorDe(l: LeccionJson, def: DefAveriaPlaca, id: string): string | null {
  const t = l.tarjetas.find((x) => x.id === def.leccion.tarjeta);
  return t?.actividad?.sondas.find((x) => x.id === id)?.valor ?? null;
}

/** The voltage of a net to ground (console on) when one of the lesson's V measurements is that net against ground. */
export function tensionAMasa(def: DefAveriaPlaca, l: LeccionJson, v: Valores, red: string): number | null {
  const n = nodo(def, red);
  if (n === 'GND') return 0;
  const t = def.tensiones?.[n];
  if (t) return compilar(t.expr)(v);
  for (const [id, s] of Object.entries(def.sondas)) {
    if (s.modo !== 'V' || s.sinSigno) continue;
    const [a, b] = s.redes.map((r) => nodo(def, r));
    const k = valorDe(l, def, id);
    if (!k) continue;
    if (a === n && b === 'GND') return v[k] ?? null;
    if (b === n && a === 'GND') return v[k] === undefined ? null : -v[k]!;
  }
  return null;
}

// ------------------------------------------------------------------ the diagnosis

export interface Diagnostico {
  bien: boolean;
  texto: string;
}

/**
 * The reader names a suspect (lesson's `sospechosos` id) for the hidden fault `fallo`. Right: the fault's own text.
 * Wrong: a measurement of the lesson that tells the two apart — what it reads now and what it would read if it were
 * the named part — when the reader has taken it (`medidas`), or which one to take.
 */
export function diagnosticar(def: DefAveriaPlaca, l: LeccionJson, t: TarjetaAveriaJson, fallo: FalloJson, sospechoso: string, medidas: ReadonlySet<string>, fmt: (x: number, unidad: string) => string): Diagnostico {
  const a = t.actividad!;
  if (fallo.pieza === sospechoso) return { bien: true, texto: plano(fallo.texto) };
  const nombre = (id: string) => plano(a.sospechosos.find((x) => x.id === id)?.rotulo) || id;
  const otro = a.fallos.find((f) => f.pieza === sospechoso);
  const ahora = evaluarModelo(l.modelo, fallo.con);
  const si = otro ? evaluarModelo(l.modelo, otro.con) : null;
  const unidadDe = (k: string) => l.modelo.calculos[k]?.unidad ?? l.modelo.valores[k]?.unidad ?? '';
  const distintas = si ? a.sondas.filter((s) => Math.abs((ahora[s.valor] ?? 0) - (si[s.valor] ?? 0)) > 1e-9 && def.sondas[s.id]) : [];
  const hecha = distintas.find((s) => medidas.has(s.id));
  if (hecha && si) {
    const u = unidadDe(hecha.valor);
    return {
      bien: false,
      texto: `No es «${nombre(sospechoso)}»: «${plano(hecha.rotulo)}» marcaría ${fmt(si[hecha.valor]!, u)} si lo fuera, y marca ${fmt(ahora[hecha.valor]!, u)}.`,
    };
  }
  const falta = distintas[0];
  return { bien: false, texto: falta ? `Todavía no lo sabe: mida «${plano(falta.rotulo)}», que lo distingue.` : `No es «${nombre(sospechoso)}».` };
}

// ------------------------------------------------------------------ the pads on a photo

export type Afin = [number, number, number, number, number, number];

/**
 * The affine map (least squares) from board coordinates to photo pixels, from the footprints' reference points the
 * console's data place on the photo (`posiciones`, fitted there to hundreds of points with ~1 px of error). Null with
 * fewer than three or all in a line.
 */
export function ajusteAfin(pares: [[number, number], [number, number]][]): Afin | null {
  if (pares.length < 3) return null;
  // normal equations: (AᵀA) m = Aᵀb for each output coordinate, A = [x y 1]
  const ata = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const atx = [0, 0, 0];
  const aty = [0, 0, 0];
  for (const [[x, y], [px, py]] of pares) {
    const f = [x, y, 1];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) ata[i * 3 + j]! += f[i]! * f[j]!;
      atx[i]! += f[i]! * px;
      aty[i]! += f[i]! * py;
    }
  }
  const mx = resolver3(ata, atx);
  const my = resolver3(ata, aty);
  return mx && my ? [mx[0], mx[1], mx[2], my[0], my[1], my[2]] : null;
}

function resolver3(m: number[], b: number[]): [number, number, number] | null {
  const [a, bb, c, d, e, f, g, h, i] = m as [number, number, number, number, number, number, number, number, number];
  const det = a * (e * i - f * h) - bb * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12 * Math.max(1, Math.abs(a * e * i))) return null;
  const col = (k: number) => {
    const r = [...m];
    r[k] = b[0]!;
    r[3 + k] = b[1]!;
    r[6 + k] = b[2]!;
    const [a2, b2, c2, d2, e2, f2, g2, h2, i2] = r as [number, number, number, number, number, number, number, number, number];
    return (a2 * (e2 * i2 - f2 * h2) - b2 * (d2 * i2 - f2 * g2) + c2 * (d2 * h2 - e2 * g2)) / det;
  };
  return [col(0), col(1), col(2)];
}

export function aplicarAfin(m: Afin, x: number, y: number): [number, number] {
  return [m[0] * x + m[1] * y + m[2], m[3] * x + m[4] * y + m[5]];
}

/** A projective map (homography) h0…h7, h8 = 1: x' = (h0 x + h1 y + h2) / (h6 x + h7 y + 1), y' likewise with h3…h5. */
export type Proyectiva = [number, number, number, number, number, number, number, number, number];

/**
 * 1.4 (contenido14): the projective map (least squares, normalised coordinates) from board coordinates to photo
 * pixels, for a photo taken at a slight angle (the Super Nintendo's iFixit photos), where an affine map leaves pads
 * several pixels off at the edges. Null with fewer than four points or a degenerate set.
 */
export function ajusteProyectivo(pares: [[number, number], [number, number]][]): Proyectiva | null {
  if (pares.length < 4) return null;
  // (normalise both point sets: centroid at 0, mean distance √2, so that the 8 × 8 system is well conditioned)
  const norm = (ps: [number, number][]) => {
    const cx = ps.reduce((s, p) => s + p[0], 0) / ps.length;
    const cy = ps.reduce((s, p) => s + p[1], 0) / ps.length;
    const d = ps.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cy), 0) / ps.length || 1;
    const k = Math.SQRT2 / d;
    return { k, cx, cy, f: (p: [number, number]): [number, number] => [(p[0] - cx) * k, (p[1] - cy) * k] };
  };
  const na = norm(pares.map((p) => p[0]));
  const nb = norm(pares.map((p) => p[1]));
  const ata = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  const atb = new Array<number>(8).fill(0);
  const fila = (r: number[], v: number) => {
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) ata[i]![j]! += r[i]! * r[j]!;
      atb[i]! += r[i]! * v;
    }
  };
  for (const [a, b] of pares) {
    const [x, y] = na.f(a);
    const [u, v] = nb.f(b);
    fila([x, y, 1, 0, 0, 0, -u * x, -u * y], u);
    fila([0, 0, 0, x, y, 1, -v * x, -v * y], v);
  }
  // Gaussian elimination with partial pivoting
  const m = ata.map((r, i) => [...r, atb[i]!]);
  for (let c = 0; c < 8; c++) {
    let piv = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[piv]![c]!)) piv = r;
    if (Math.abs(m[piv]![c]!) < 1e-12) return null;
    [m[c], m[piv]] = [m[piv]!, m[c]!];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = m[r]![c]! / m[c]![c]!;
      for (let k = c; k < 9; k++) m[r]![k]! -= f * m[c]![k]!;
    }
  }
  const h = m.map((r, i) => r[8]! / r[i]!);
  // undo the normalisation: H = Tb⁻¹ · Hn · Ta
  const Hn = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!, 1];
  const Ta = [na.k, 0, -na.k * na.cx, 0, na.k, -na.k * na.cy, 0, 0, 1];
  const TbInv = [1 / nb.k, 0, nb.cx, 0, 1 / nb.k, nb.cy, 0, 0, 1];
  const mul = (A: number[], B: number[]) => Array.from({ length: 9 }, (_, i) => [0, 1, 2].reduce((s, k) => s + A[Math.floor(i / 3) * 3 + k]! * B[k * 3 + (i % 3)]!, 0));
  const H = mul(TbInv, mul(Hn, Ta));
  const z = H[8]!;
  if (!Number.isFinite(z) || Math.abs(z) < 1e-15) return null;
  return H.map((v) => v / z) as Proyectiva;
}

export function aplicarProyectivo(h: Proyectiva, x: number, y: number): [number, number] {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

// ------------------------------------------------------------------ the board's pads

/** A pad of the board as a test point: «F1.2», its net, where it is (u), which faces a lead reaches it from. */
export interface PuntoPad {
  id: string;
  ref: string;
  num: string;
  x: number;
  y: number;
  red: string | null;
  F: boolean;
  B: boolean;
}

/** Minimal board shape (proyectos/datos.ts DatosPlaca) used here. */
export interface PlacaMinima {
  redes: { n: string }[];
  huellas: { r: string; x: number; y: number; pads: [number, number] }[];
  pads: (string | number)[][];
}

const PAD_F = 1;
const PAD_B = 2;
const PAD_PTH = 4;

export function padsDe(d: PlacaMinima): PuntoPad[] {
  const res: PuntoPad[] = [];
  // (a footprint may repeat a pad number — a tab, a thermal pad —: the first one stands for that pin)
  const vistos = new Set<string>();
  for (const h of d.huellas) {
    const [a, n] = h.pads;
    for (let k = a; k < a + n; k++) {
      const p = d.pads[k]!;
      const num = String(p[1]);
      if (!num || vistos.has(`${h.r}.${num}`)) continue;
      vistos.add(`${h.r}.${num}`);
      const flags = p[11] as number;
      const red = (p[12] as number) >= 0 ? (d.redes[p[12] as number]?.n ?? null) : null;
      const pth = !!(flags & PAD_PTH);
      res.push({ id: `${h.r}.${num}`, ref: h.r, num, x: p[3] as number, y: p[4] as number, red, F: pth || !!(flags & PAD_F), B: pth || !!(flags & PAD_B) });
    }
  }
  return res;
}

/** The net of a pad id («F1.2»). */
export function redDePad(pads: readonly PuntoPad[], id: string): string | null {
  return pads.find((p) => p.id === id)?.red ?? null;
}

/** «F1, pata 2» and what the net is (the definition's name, or the net's own). */
export function describirPad(def: DefAveriaPlaca, p: PuntoPad): string {
  const red = p.red ? (def.nombres[p.red] ?? `red ${p.red.replace(/^\//, '')}`) : 'sin conectar';
  return `${p.ref}, pata ${p.num} (${red})`;
}
