// 1.2 digital toolkit (course «Digital y programable»): the logic circuit of a lesson widget `logica` and its
// simulation. Gates (AND, OR, NOT, NAND, NOR, XOR, XNOR, buffer), flip-flops (D, JK, T, rising edge), a synchronous
// binary counter, a multiplexer and a decoder, wired by signal names; switches, a clock and LEDs as I/O.
//
// The simulation is event-driven with one unit of delay per piece and fully deterministic: the pieces affected by a
// change are evaluated in their declaration order, their new outputs are applied one time unit later, and so on until
// nothing changes (or a limit, reported as «not stable»: a ring of inverters oscillates). A flip-flop samples its
// inputs as they are at the time its clock rises, so a chain of flip-flops on one clock shifts by one stage per edge
// (the classic delta semantics), and a ripple counter clocks each stage from the previous one. The state is a plain
// serialisable object (the lesson keeps it in the card's state); every function here is pure.
//
// Faults (fault finding, GUIA §11.5): a signal stuck at 0 or 1, or an input pin left unconnected — which a TTL input
// reads as a 1 (book, section 9.3: «en TTL tiende a leerse como un 1») and a logic probe on that pin shows as no level.

import type { Texto } from '../../leccion11/tipos';

export type Nivel = 0 | 1;
export type TipoPuerta = 'and' | 'or' | 'not' | 'nand' | 'nor' | 'xor' | 'xnor' | 'buf';
// (motor12e: «latch», the level-sensitive D latch — transparent while EN is 1 — to set beside a flip-flop)
export type TipoSecuencial = 'd' | 'jk' | 't' | 'contador' | 'latch';
export type TipoPieza = TipoPuerta | TipoSecuencial | 'mux' | 'decodificador';

export const PUERTAS: readonly TipoPuerta[] = ['and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor', 'buf'];
export const SECUENCIALES: readonly TipoSecuencial[] = ['d', 'jk', 't', 'contador', 'latch'];
export const TIPOS_PIEZA: readonly TipoPieza[] = [...PUERTAS, ...SECUENCIALES, 'mux', 'decodificador'];

/** How each piece is named in Spanish (labels, screen readers, messages). */
export const NOMBRE_PIEZA: Record<TipoPieza, string> = {
  and: 'puerta AND',
  or: 'puerta OR',
  not: 'inversor (NOT)',
  nand: 'puerta NAND',
  nor: 'puerta NOR',
  xor: 'puerta XOR',
  xnor: 'puerta XNOR',
  buf: 'búfer',
  d: 'biestable D',
  jk: 'biestable JK',
  t: 'biestable T',
  contador: 'contador',
  latch: 'cerrojo D (latch)',
  mux: 'multiplexor',
  decodificador: 'decodificador',
};

export interface PiezaLogica {
  /** Id (lower case, digits, «-»): its output signal is the id (a gate, a mux) or «id.q», «id.nq», «id.q0», «id.y0»… */
  id: string;
  tipo: TipoPieza;
  /** The signal on each input pin, in the pin order of its type (pinesEntrada): an input, a piece's output, «0» or «1». */
  entradas: string[];
  /** contador: bits of the count; mux: selection bits; decodificador: address bits (1 to 4). */
  bits?: number;
  /** contador: counts 0 … modulo − 1 (default 2^bits): a BCD decade counter is modulo 10. */
  modulo?: number;
  /** Flip-flops: Q at power-on (default 0); contador: the count at power-on. */
  inicial?: number;
  /** Label in the drawing (default: the type: «NAND», «D», «CTR»). */
  rotulo?: Texto;
}

export interface EntradaLogica {
  id: string;
  rotulo: Texto;
  valor: Nivel;
  /** The clock: a «Pulso» button (rise then fall) instead of a switch. */
  reloj: boolean;
}

export interface SalidaLogica {
  id: string;
  /** The signal the LED shows. */
  de: string;
  rotulo: Texto;
}

export interface CircuitoLogico {
  entradas: EntradaLogica[];
  piezas: PiezaLogica[];
  salidas: SalidaLogica[];
}

export type FalloLogico =
  | { tipo: 'atascada-0' | 'atascada-1'; senal: string }
  | { tipo: 'sin-conexion'; pieza: string; pin: number };

/** The simulation's state: every signal's level, each sequential piece's stored value and last clock seen. */
export interface EstadoLogico {
  senales: Record<string, Nivel>;
  internos: Record<string, number>;
  relojes: Record<string, Nivel>;
  /** The last settling reached a stable state (false: the circuit oscillates). */
  estable: boolean;
}

/** What a logic probe shows at a point: a level, or no level on an unconnected pin. */
export type Lectura = Nivel | 'aire';

/** A point to probe: a signal (a wire and everything on it) or one input pin of a piece. */
export type Punto = { senal: string } | { pieza: string; pin: number };

/** Time units the settling may take before the circuit is declared unstable. */
export const LIMITE_PASOS = 400;

// ------------------------------------------------------------------ pins

export function esSecuencial(p: PiezaLogica): boolean {
  return (SECUENCIALES as readonly string[]).includes(p.tipo);
}

export function circuitoSecuencial(c: CircuitoLogico): boolean {
  return c.piezas.some(esSecuencial);
}

/** Names of a piece's input pins, in order. */
export function pinesEntrada(p: PiezaLogica): string[] {
  const b = p.bits ?? 1;
  switch (p.tipo) {
    case 'not':
    case 'buf':
      return ['1'];
    case 'd':
      return ['D', 'CLK'];
    case 'latch':
      return ['D', 'EN'];
    case 'jk':
      return ['J', 'K', 'CLK'];
    case 't':
      return ['T', 'CLK'];
    case 'contador':
      return p.entradas.length > 1 ? ['CLK', 'R'] : ['CLK'];
    case 'mux':
      return [...Array.from({ length: b }, (_, k) => `S${k}`), ...Array.from({ length: 2 ** b }, (_, k) => `D${k}`)];
    case 'decodificador':
      return [...Array.from({ length: b }, (_, k) => `A${k}`), ...(p.entradas.length > b ? ['EN'] : [])];
    default:
      return p.entradas.map((_, k) => String(k + 1));
  }
}

/** How many input pins a piece may have: [min, max]. */
export function pinesPermitidos(p: Pick<PiezaLogica, 'tipo' | 'bits'>): [number, number] {
  const b = p.bits ?? 1;
  switch (p.tipo) {
    case 'not':
    case 'buf':
      return [1, 1];
    case 'd':
    case 't':
    case 'latch':
      return [2, 2];
    case 'jk':
      return [3, 3];
    case 'contador':
      return [1, 2];
    case 'mux':
      return [b + 2 ** b, b + 2 ** b];
    case 'decodificador':
      return [b, b + 1];
    default:
      return [2, 4];
  }
}

/** The output signals of a piece, in order. */
export function salidasDe(p: PiezaLogica): string[] {
  const b = p.bits ?? 1;
  switch (p.tipo) {
    case 'd':
    case 'jk':
    case 't':
    case 'latch':
      return [`${p.id}.q`, `${p.id}.nq`];
    case 'contador':
      return Array.from({ length: b }, (_, k) => `${p.id}.q${k}`);
    case 'decodificador':
      return Array.from({ length: 2 ** b }, (_, k) => `${p.id}.y${k}`);
    default:
      return [p.id];
  }
}

/** The name of an output signal on the drawing («Q», «Q̄», «Q0», «Y2»), or '' for a single-output piece. */
export function nombreSalida(senal: string): string {
  const m = /\.(\w+)$/.exec(senal);
  if (!m) return '';
  const s = m[1]!;
  if (s === 'q') return 'Q';
  if (s === 'nq') return 'Q̄';
  return s.toUpperCase();
}

/** Every signal of the circuit: inputs and pieces' outputs. */
export function senales(c: CircuitoLogico): string[] {
  return [...c.entradas.map((e) => e.id), ...c.piezas.flatMap(salidasDe)];
}

// ------------------------------------------------------------------ evaluation

interface Indices {
  /** Signal → indices of the pieces that read it. */
  lectores: Map<string, number[]>;
  /** Signal → index of the piece that drives it (inputs: -1). */
  conductor: Map<string, number>;
}

const cacheIndices = new WeakMap<CircuitoLogico, Indices>();

function indices(c: CircuitoLogico): Indices {
  let x = cacheIndices.get(c);
  if (x) return x;
  const lectores = new Map<string, number[]>();
  const conductor = new Map<string, number>();
  for (const e of c.entradas) conductor.set(e.id, -1);
  c.piezas.forEach((p, i) => {
    for (const s of salidasDe(p)) conductor.set(s, i);
    for (const s of p.entradas) {
      const l = lectores.get(s) ?? [];
      if (!l.includes(i)) l.push(i);
      lectores.set(s, l);
    }
  });
  x = { lectores, conductor };
  cacheIndices.set(c, x);
  return x;
}

function forzado(f: FalloLogico | null | undefined, senal: string): Nivel | null {
  if (f && f.tipo !== 'sin-conexion' && f.senal === senal) return f.tipo === 'atascada-1' ? 1 : 0;
  return null;
}

/** The level a piece reads on one of its input pins (an unconnected TTL input reads 1). */
function pin(p: PiezaLogica, k: number, s: EstadoLogico, f: FalloLogico | null | undefined): Nivel {
  if (f?.tipo === 'sin-conexion' && f.pieza === p.id && f.pin === k) return 1;
  const ref = p.entradas[k]!;
  if (ref === '0') return 0;
  if (ref === '1') return 1;
  return s.senales[ref] ?? 0;
}

function puerta(tipo: TipoPuerta, v: Nivel[]): Nivel {
  const y = (b: boolean): Nivel => (b ? 1 : 0);
  switch (tipo) {
    case 'and':
      return y(v.every((x) => x === 1));
    case 'or':
      return y(v.some((x) => x === 1));
    case 'nand':
      return y(!v.every((x) => x === 1));
    case 'nor':
      return y(!v.some((x) => x === 1));
    case 'xor':
      return y(v.filter((x) => x === 1).length % 2 === 1);
    case 'xnor':
      return y(v.filter((x) => x === 1).length % 2 === 0);
    case 'not':
      return y(v[0] === 0);
    case 'buf':
      return v[0] ?? 0;
  }
}

/** Evaluates one piece with the current levels: its outputs' new levels (and its stored state, updated in `s`). */
function evaluar(p: PiezaLogica, s: EstadoLogico, f: FalloLogico | null | undefined): [string, Nivel][] {
  const v = p.entradas.map((_, k) => pin(p, k, s, f));
  const b = p.bits ?? 1;
  if ((PUERTAS as readonly string[]).includes(p.tipo)) return [[p.id, puerta(p.tipo as TipoPuerta, v)]];
  if (p.tipo === 'mux') {
    let sel = 0;
    for (let k = 0; k < b; k++) sel |= v[k]! << k;
    return [[p.id, v[b + sel] ?? 0]];
  }
  if (p.tipo === 'decodificador') {
    let a = 0;
    for (let k = 0; k < b; k++) a |= v[k]! << k;
    const en = v.length > b ? v[b]! : 1;
    return salidasDe(p).map((y, k) => [y, en === 1 && k === a ? 1 : 0]);
  }
  // the D latch: transparent while EN is 1 (Q follows D), holds while EN is 0 — level, not edge
  if (p.tipo === 'latch') {
    let q = s.internos[p.id] ?? 0;
    if (v[1] === 1) q = v[0]!;
    s.internos[p.id] = q;
    return [
      [`${p.id}.q`, q as Nivel],
      [`${p.id}.nq`, (1 - q) as Nivel],
    ];
  }
  // sequential: rising edge of CLK
  const iClk = p.tipo === 'd' || p.tipo === 't' ? 1 : p.tipo === 'jk' ? 2 : 0;
  const clk = v[iClk]!;
  const antes = s.relojes[p.id] ?? 0;
  s.relojes[p.id] = clk;
  const sube = antes === 0 && clk === 1;
  let q = s.internos[p.id] ?? 0;
  if (p.tipo === 'contador') {
    const mod = p.modulo ?? 2 ** b;
    if (v.length > 1 && v[1] === 1) q = 0;
    else if (sube) q = (q + 1) % mod;
    s.internos[p.id] = q;
    return salidasDe(p).map((y, k) => [y, ((q >> k) & 1) as Nivel]);
  }
  if (sube) {
    if (p.tipo === 'd') q = v[0]!;
    else if (p.tipo === 't') q = v[0] === 1 ? 1 - q : q;
    else {
      const j = v[0]!;
      const kk = v[1]!;
      q = j && kk ? 1 - q : j ? 1 : kk ? 0 : q;
    }
  }
  s.internos[p.id] = q;
  return [
    [`${p.id}.q`, q as Nivel],
    [`${p.id}.nq`, (1 - q) as Nivel],
  ];
}

function copia(s: EstadoLogico): EstadoLogico {
  return { senales: { ...s.senales }, internos: { ...s.internos }, relojes: { ...s.relojes }, estable: s.estable };
}

/** Runs the events from `afectadas` (pieces to evaluate) and `cambios` (signals that change now) until stable. */
function asentar(c: CircuitoLogico, s: EstadoLogico, cambios: Map<string, Nivel>, afectadas: Set<number>, f: FalloLogico | null | undefined): EstadoLogico {
  const { lectores } = indices(c);
  let pendientes = cambios;
  let porEvaluar = afectadas;
  let t = 0;
  while ((pendientes.size || porEvaluar.size) && t < LIMITE_PASOS) {
    for (const [sig, v0] of pendientes) {
      const v = forzado(f, sig) ?? v0;
      if (s.senales[sig] !== v) {
        s.senales[sig] = v;
        for (const i of lectores.get(sig) ?? []) porEvaluar.add(i);
      }
    }
    pendientes = new Map();
    for (const i of [...porEvaluar].sort((a, b) => a - b)) {
      const p = c.piezas[i]!;
      for (const [sig, v0] of evaluar(p, s, f)) {
        const v = forzado(f, sig) ?? v0;
        if (s.senales[sig] !== v) pendientes.set(sig, v);
      }
    }
    porEvaluar = new Set();
    t++;
  }
  s.estable = pendientes.size === 0 && porEvaluar.size === 0;
  if (!s.estable) {
    // Equal delays can race forever where real gates do not: two cross-coupled NANDs powered on with both inputs
    // high flip together at every step. Settle them in order instead (each piece sees the outputs of the ones before
    // it at once): a latch falls into one of its two states (deterministically), a true oscillator (a ring of an odd
    // number of inverters) still does not settle and stays «not stable».
    for (const [sig, v] of pendientes) s.senales[sig] = forzado(f, sig) ?? v;
    for (let ronda = 0; ronda < 4 * c.piezas.length + 4; ronda++) {
      let cambio = false;
      for (const p of c.piezas)
        for (const [sig, v0] of evaluar(p, s, f)) {
          const v = forzado(f, sig) ?? v0;
          if (s.senales[sig] !== v) {
            s.senales[sig] = v;
            cambio = true;
          }
        }
      if (!cambio) {
        s.estable = true;
        break;
      }
    }
  }
  return s;
}

/**
 * Power-on: inputs at their values (or `entradas`), flip-flops and counters at their `inicial`, every piece evaluated
 * once and the circuit settled. Edge detection starts from the clocks as they are now (power-on is not an edge).
 */
export function iniciar(c: CircuitoLogico, f?: FalloLogico | null, entradas?: Record<string, Nivel>): EstadoLogico {
  const s: EstadoLogico = { senales: {}, internos: {}, relojes: {}, estable: true };
  for (const e of c.entradas) s.senales[e.id] = forzado(f, e.id) ?? entradas?.[e.id] ?? e.valor;
  for (const p of c.piezas) {
    if (esSecuencial(p)) {
      const q = p.inicial ?? 0;
      s.internos[p.id] = q;
      if (p.tipo === 'contador') salidasDe(p).forEach((y, k) => (s.senales[y] = forzado(f, y) ?? (((q >> k) & 1) as Nivel)));
      else {
        s.senales[`${p.id}.q`] = forzado(f, `${p.id}.q`) ?? (q ? 1 : 0);
        s.senales[`${p.id}.nq`] = forzado(f, `${p.id}.nq`) ?? (q ? 0 : 1);
      }
    } else for (const y of salidasDe(p)) s.senales[y] = forzado(f, y) ?? 0;
  }
  // (the clocks a sequential piece sees at power-on are its starting point, not an edge)
  for (const p of c.piezas)
    if (esSecuencial(p)) {
      const iClk = p.tipo === 'd' || p.tipo === 't' ? 1 : p.tipo === 'jk' ? 2 : 0;
      s.relojes[p.id] = pin(p, iClk, s, f);
    }
  return asentar(c, s, new Map(), new Set(c.piezas.map((_, i) => i).filter((i) => !esSecuencial(c.piezas[i]!) || c.piezas[i]!.tipo === 'contador' || c.piezas[i]!.tipo === 'latch')), f);
}

/** Sets inputs to new levels and settles. */
export function poner(c: CircuitoLogico, s0: EstadoLogico, valores: Record<string, Nivel>, f?: FalloLogico | null): EstadoLogico {
  const cambios = new Map<string, Nivel>();
  for (const [k, v] of Object.entries(valores)) cambios.set(k, v);
  return asentar(c, copia(s0), cambios, new Set(), f);
}

/** One clock pulse on the clock input: rise, settle, fall, settle. */
export function pulso(c: CircuitoLogico, s0: EstadoLogico, reloj: string, f?: FalloLogico | null): EstadoLogico {
  const a = poner(c, s0, { [reloj]: 1 }, f);
  const b = poner(c, a, { [reloj]: 0 }, f);
  b.estable = a.estable && b.estable;
  return b;
}

export function leer(s: EstadoLogico, senal: string): Nivel {
  if (senal === '0') return 0;
  if (senal === '1') return 1;
  return s.senales[senal] ?? 0;
}

/** What a logic probe shows at a point. */
export function sondear(c: CircuitoLogico, s: EstadoLogico, punto: Punto, f?: FalloLogico | null): Lectura {
  if ('senal' in punto) return leer(s, punto.senal);
  if (f?.tipo === 'sin-conexion' && f.pieza === punto.pieza && f.pin === punto.pin) return 'aire';
  const p = c.piezas.find((x) => x.id === punto.pieza);
  return p ? leer(s, p.entradas[punto.pin] ?? '0') : 0;
}

/** The clock input, if any. */
export function relojDe(c: CircuitoLogico): string | null {
  return c.entradas.find((e) => e.reloj)?.id ?? null;
}

/** The inputs a truth table runs through (every input but the clock), in order (the first is the most significant). */
export function entradasTabla(c: CircuitoLogico): string[] {
  return c.entradas.filter((e) => !e.reloj).map((e) => e.id);
}

export interface FilaTabla {
  e: Nivel[];
  s: Nivel[];
}

export interface TablaVerdad {
  entradas: string[];
  salidas: string[];
  filas: FilaTabla[];
  /** Every row settled (a combinational loop that oscillates does not). */
  estable: boolean;
}

/** Levels of the inputs in row `r` of a truth table (binary order, the first input most significant: 00, 01, 10, 11). */
export function filaEntradas(n: number, r: number): Nivel[] {
  return Array.from({ length: n }, (_, k) => ((r >> (n - 1 - k)) & 1) as Nivel);
}

/** The truth table of a combinational circuit (its outputs' signals, or `salidas`), with a fault if given. */
export function tablaVerdad(c: CircuitoLogico, salidas?: string[], f?: FalloLogico | null): TablaVerdad {
  const ent = entradasTabla(c);
  const sal = salidas ?? c.salidas.map((x) => x.id);
  const filas: FilaTabla[] = [];
  let estable = true;
  for (let r = 0; r < 2 ** ent.length; r++) {
    const e = filaEntradas(ent.length, r);
    const st = iniciar(c, f, Object.fromEntries(ent.map((id, k) => [id, e[k]!])));
    estable &&= st.estable;
    filas.push({ e, s: sal.map((id) => leer(st, senalDeSalida(c, id))) });
  }
  return { entradas: ent, salidas: sal, filas, estable };
}

/** The signal an output id (an LED) shows; a signal name is itself. */
export function senalDeSalida(c: CircuitoLogico, id: string): string {
  return c.salidas.find((x) => x.id === id)?.de ?? id;
}

// ------------------------------------------------------------------ timing diagram

export interface Cronograma {
  ciclos: number;
  /** Two slots per clock cycle: the clock low (inputs of the cycle applied), then high (the rising edge in between). */
  tramos: Record<string, Nivel>[];
  estable: boolean;
}

/**
 * The circuit over `ciclos` clock cycles. Each cycle starts with the clock low and the inputs of `estimulo` for that
 * cycle (a list of levels per input; missing inputs keep their value), then the clock rises in the middle of the
 * cycle: the inputs are stable around every rising edge. Without a clock the second slot is the same as the first.
 */
export function cronograma(c: CircuitoLogico, ciclos: number, estimulo: Record<string, Nivel[]>, f?: FalloLogico | null): Cronograma {
  const reloj = relojDe(c);
  const de = (k: number) => {
    const v: Record<string, Nivel> = {};
    for (const [id, xs] of Object.entries(estimulo)) if (xs[k] != null) v[id] = xs[k]!;
    if (reloj) v[reloj] = 0;
    return v;
  };
  let s = iniciar(c, f, de(0));
  let estable = s.estable;
  const tramos: Record<string, Nivel>[] = [];
  for (let k = 0; k < ciclos; k++) {
    if (k > 0) s = poner(c, s, de(k), f);
    estable &&= s.estable;
    tramos.push({ ...s.senales });
    if (reloj) s = poner(c, s, { [reloj]: 1 }, f);
    estable &&= s.estable;
    tramos.push({ ...s.senales });
  }
  return { ciclos, tramos, estable };
}

// ------------------------------------------------------------------ truth functions (design)

/** A function of n inputs as a bit mask over the 2^n rows of its truth table (bit r = output in row r). */
export function mascaraEntrada(n: number, k: number): number {
  let m = 0;
  for (let r = 0; r < 2 ** n; r++) if ((r >> (n - 1 - k)) & 1) m |= 1 << r;
  return m;
}

export function mascaraDe(columna: readonly Nivel[]): number {
  return columna.reduce<number>((m, v, r) => m | (v << r), 0);
}

function puertaMascara(tipo: TipoPuerta, a: number, b: number, todo: number): number {
  switch (tipo) {
    case 'and':
      return a & b;
    case 'or':
      return a | b;
    case 'nand':
      return ~(a & b) & todo;
    case 'nor':
      return ~(a | b) & todo;
    case 'xor':
      return a ^ b;
    case 'xnor':
      return ~(a ^ b) & todo;
    case 'not':
      return ~a & todo;
    case 'buf':
      return a;
  }
}

/**
 * The fewest gates of `tipos` (two-input, or one for NOT/buffer) that make the function `objetivo` of n inputs, up to
 * `hasta` gates; null when none up to `hasta` does or the search would visit more than `presupuesto` circuits (then
 * `agotado` says so). Iterative deepening over gate sequences, each gate reading the inputs or earlier gates.
 */
export function minimoPuertas(objetivo: number, n: number, tipos: readonly TipoPuerta[], hasta: number, presupuesto = 3_000_000): { minimo: number | null; agotado: boolean } {
  const todo = 2 ** (2 ** n) - 1;
  const base = Array.from({ length: n }, (_, k) => mascaraEntrada(n, k));
  if (base.includes(objetivo)) return { minimo: 0, agotado: false };
  let visitados = 0;
  let agotado = false;
  const buscar = (disponibles: number[], quedan: number): boolean => {
    if (quedan === 0) return false;
    for (const tipo of tipos) {
      const una = tipo === 'not' || tipo === 'buf';
      for (let i = 0; i < disponibles.length; i++)
        for (let j = una ? i : i; j < (una ? i + 1 : disponibles.length); j++) {
          if (++visitados > presupuesto) {
            agotado = true;
            return false;
          }
          const y = puertaMascara(tipo, disponibles[i]!, disponibles[j]!, todo);
          if (y === objetivo) return true;
          if (quedan > 1 && !disponibles.includes(y)) {
            disponibles.push(y);
            const ok = buscar(disponibles, quedan - 1);
            disponibles.pop();
            if (ok) return true;
            if (agotado) return false;
          }
        }
    }
    return false;
  };
  for (let g = 1; g <= hasta; g++) {
    if (buscar([...base], g)) return { minimo: g, agotado: false };
    if (agotado) return { minimo: null, agotado: true };
  }
  return { minimo: null, agotado: false };
}
