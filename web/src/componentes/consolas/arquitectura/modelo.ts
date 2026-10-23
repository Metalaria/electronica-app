// Timeline model of the architecture animations: every signal is a list of transitions in real time
// (seconds). A scenario is built once (deterministically) and then sampled at any time t, so play, pause,
// single-step, the scrubber and the logic analyser all read the same data.

export type Nivel = 0 | 1 | 2; // 2 = high impedance / not driven

export interface PistaBit {
  id: string;
  nombre: string;
  tipo: 'bit';
  /** Times of the transitions (s), ascending; value v[i] holds from t[i] to t[i+1]. */
  t: number[];
  v: Nivel[];
  /** Short explanation shown in the analyser legend. */
  ayuda?: string;
}

export interface PistaBus {
  id: string;
  nombre: string;
  tipo: 'bus';
  t: number[];
  /** Value shown (hex, decimal or a short word); null = bus idle / high impedance. */
  v: (string | null)[];
  ayuda?: string;
}

export type Pista = PistaBit | PistaBus;

/** A narrated stretch of the scenario. */
export interface Paso {
  t0: number;
  t1: number;
  texto: string;
}

export interface Escenario {
  id: string;
  titulo: string;
  /** One paragraph shown above the diagram. */
  descripcion: string;
  duracion: number;
  /** Unit used by the time readouts (the analyser picks prefixes itself). */
  escala: 'ns' | 'µs' | 'ms';
  pistas: Pista[];
  pasos: Paso[];
  /** Times where «Paso» stops (bus cycle starts, edges of interest). */
  marcas: number[];
  /** Real seconds that pass per second on screen at speed 1×. */
  realPorSegundo: number;
  /** Signals shown in the analyser by default. */
  defecto: string[];
  /** Note on the timing figures used (sources, simplifications). */
  fidelidad: string;
  /** Time window the analyser opens with (default: the whole scenario). */
  ventana?: [number, number];
}

// ------------------------------------------------------------------ building

export class Cronograma {
  private bits = new Map<string, PistaBit>();
  private buses = new Map<string, PistaBus>();
  private orden: string[] = [];
  pasos: Paso[] = [];
  marcas: number[] = [];

  bit(id: string, nombre: string, inicial: Nivel, ayuda?: string): this {
    this.bits.set(id, { id, nombre, tipo: 'bit', t: [0], v: [inicial], ayuda });
    this.orden.push(id);
    return this;
  }

  bus(id: string, nombre: string, ayuda?: string): this {
    this.buses.set(id, { id, nombre, tipo: 'bus', t: [0], v: [null], ayuda });
    this.orden.push(id);
    return this;
  }

  /** Sets a signal from time t on (later calls may insert earlier times: kept sorted). */
  set(id: string, t: number, v: Nivel | string | null): void {
    const p = this.bits.get(id) ?? this.buses.get(id);
    if (!p) throw new Error(`pista desconocida ${id}`);
    const tt = p.t;
    let i = tt.length;
    while (i > 0 && tt[i - 1]! > t) i--;
    if (i > 0 && Math.abs(tt[i - 1]! - t) < 1e-15) {
      (p.v as unknown[])[i - 1] = v;
      return;
    }
    tt.splice(i, 0, t);
    (p.v as unknown[]).splice(i, 0, v);
  }

  /** Square clock from t0 to t1 with the given period; starts high at t0 (duty: fraction high). */
  reloj(id: string, t0: number, t1: number, periodo: number, alto = 0.5, fase = 0): void {
    const n = Math.ceil((t1 - t0) / periodo) + 1;
    for (let k = 0; k < n; k++) {
      const a = t0 + fase + k * periodo;
      if (a > t1) break;
      this.set(id, a, 1);
      const b = a + periodo * alto;
      if (b < t1) this.set(id, b, 0);
    }
  }

  paso(t0: number, t1: number, texto: string): void {
    this.pasos.push({ t0, t1, texto });
  }

  marca(t: number): void {
    this.marcas.push(t);
  }

  pistas(): Pista[] {
    return this.orden.map((id) => {
      const p = (this.bits.get(id) ?? this.buses.get(id))!;
      compactar(p);
      return p;
    });
  }
}

/** Drops transitions that repeat the previous value. */
function compactar(p: Pista): void {
  const t: number[] = [];
  const v: unknown[] = [];
  for (let i = 0; i < p.t.length; i++) {
    if (v.length && v[v.length - 1] === p.v[i]) continue;
    t.push(p.t[i]!);
    v.push(p.v[i]);
  }
  p.t = t;
  (p as { v: unknown[] }).v = v;
}

// ------------------------------------------------------------------ sampling

/** Index of the transition in force at time t. */
export function indice(p: Pista, t: number): number {
  const a = p.t;
  let lo = 0;
  let hi = a.length - 1;
  if (t < a[0]!) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (a[mid]! <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function valorBit(p: PistaBit, t: number): Nivel {
  return p.v[indice(p, t)]!;
}

export function valorBus(p: PistaBus, t: number): string | null {
  return p.v[indice(p, t)]!;
}

export interface Muestra {
  bits: Record<string, Nivel>;
  buses: Record<string, string | null>;
  paso: Paso | null;
}

export function muestrear(e: Escenario, t: number): Muestra {
  const bits: Record<string, Nivel> = {};
  const buses: Record<string, string | null> = {};
  for (const p of e.pistas) {
    if (p.tipo === 'bit') bits[p.id] = valorBit(p, t);
    else buses[p.id] = valorBus(p, t);
  }
  let paso: Paso | null = null;
  for (const s of e.pasos) if (t >= s.t0 && t < s.t1) paso = s;
  return { bits, buses, paso };
}

// ------------------------------------------------------------------ formatting

export function hex(v: number, digitos: number): string {
  return '$' + v.toString(16).toUpperCase().padStart(digitos, '0');
}

/** «12,5 ns», «3,21 µs», «16,64 ms». */
export function tiempo(s: number, cifras = 3): string {
  const a = Math.abs(s);
  const [k, u] = a >= 1e-3 ? [1e3, 'ms'] : a >= 1e-6 ? [1e6, 'µs'] : [1e9, 'ns'];
  const x = s * k;
  const dec = Math.max(0, cifras - 1 - Math.floor(Math.log10(Math.max(Math.abs(x), 1e-9))));
  return `${x.toFixed(Math.min(dec, 3)).replace('.', ',')} ${u}`;
}

/** Slow-motion factor in words: «1 : 3,0 · 10⁶». */
export function factor(realPorSegundo: number): string {
  const f = 1 / realPorSegundo;
  const e = Math.floor(Math.log10(f));
  const m = f / 10 ** e;
  const sup = String(e)
    .split('')
    .map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)] ?? c)
    .join('');
  return e < 3 ? `1 : ${Math.round(f)}` : `1 : ${m.toFixed(1).replace('.', ',')} · 10${sup}`;
}
