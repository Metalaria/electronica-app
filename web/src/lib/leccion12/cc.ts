// 1.2 living circuit: the DC operating point of a lesson schematic's netlist (lib/leccion11/esquemas/<nombre>/
// esquema.ts → netlist(c, 'op')), solved in the page by modified nodal analysis, so the wires can be coloured by their
// node's voltage while the reader moves a value. Pure (the unit tests run it in Node and compare it, card by card,
// with the lessons' models — which the generator checked against ngspice).
//
// Linear elements only: R, independent V and I sources (their DC value; «0» meters included), C (open), L (short),
// E (VCVS) and F (CCCS, controlled by a V source); a meter «BMED…» (a reading such as a power) is skipped. A netlist with anything else (a diode, a transistor…) is not solved:
// `resolverCC` returns null and the caller uses only what it knows exactly — the sources to ground and the voltages
// the card measures (`nodosConocidos`). As in SPICE, every node has 10⁻¹² S to ground, so a node left floating by a
// capacitor reads 0 V instead of making the system singular.

export interface SolucionCC {
  /** Node voltages (V), ground «0» included. */
  nodos: Record<string, number>;
  /** Current through each V source, E source and coil (A), SPICE sign: into its first node, through it, out of the second. */
  corrientes: Record<string, number>;
}

const SUFIJOS: Record<string, number> = { t: 1e12, g: 1e9, meg: 1e6, k: 1e3, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 };

/** A SPICE number («1.5k», «2.2e-9», «10meg», «4.7uF»); NaN if it is not one. */
export function numeroSpice(s: string): number {
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(meg|[tgkmunpf])?[a-z]*$/i.exec(s.trim());
  if (!m) return NaN;
  return Number(m[1]) * (m[2] ? SUFIJOS[m[2].toLowerCase()]! : 1);
}

/** DC value of a source's tokens after its nodes («DC 12», «12», «0», «DC 0 SIN(0 5 50)», «PULSE(0 5 …)»). */
export function valorDC(tokens: string[]): number {
  const t = tokens.join(' ').replace(/\(\s*/g, '(').trim();
  const dc = /\bdc\s+([^\s()]+)/i.exec(t);
  if (dc) return numeroSpice(dc[1]!) || 0;
  const primero = tokens[0] ?? '';
  const n = numeroSpice(primero);
  if (Number.isFinite(n)) return n;
  const f = /^(?:pulse|sin|pwl)\(\s*([^\s)]+)/i.exec(t);
  if (f) return numeroSpice(f[1]!) || 0;
  return 0;
}

interface Linea {
  nombre: string;
  tipo: string;
  t: string[];
}

function lineas(netlist: readonly string[]): Linea[] {
  const out: Linea[] = [];
  for (const raw of netlist) {
    const s = raw.replace(/;.*$/, '').trim();
    if (!s || /^[.*+]/.test(s)) continue;
    const t = s.split(/\s+/);
    // (esquemas12: a meter «BMED…», a behavioural source on a node of its own that only works out a reading — a power,
    // v·i — loads nothing and is not part of the circuit)
    if (/^bmed/i.test(t[0]!)) continue;
    out.push({ nombre: t[0]!.toLowerCase(), tipo: t[0]![0]!.toUpperCase(), t: t.slice(1) });
  }
  return out;
}

const LINEALES = new Set(['R', 'V', 'I', 'C', 'L', 'E', 'F']);

/** Whether this netlist can be solved here (only linear elements). */
export function esLineal(netlist: readonly string[]): boolean {
  return lineas(netlist).every((l) => LINEALES.has(l.tipo));
}

/** Gaussian elimination with partial pivoting; null if singular. */
function resolver(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[p]![c]!)) p = r;
    if (!(Math.abs(A[p]![c]!) > 1e-300)) return null;
    [A[c], A[p]] = [A[p]!, A[c]!];
    [b[c], b[p]] = [b[p]!, b[c]!];
    const piv = A[c]![c]!;
    for (let r = c + 1; r < n; r++) {
      const f = A[r]![c]! / piv;
      if (!f) continue;
      const fr = A[r]!;
      const fc = A[c]!;
      for (let k = c; k < n; k++) fr[k]! -= f * fc[k]!;
      b[r]! -= f * b[c]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]!;
    for (let k = r + 1; k < n; k++) s -= A[r]![k]! * x[k]!;
    x[r] = s / A[r]![r]!;
  }
  return x;
}

/** The DC operating point, or null when the netlist has a non-linear element or the system is singular. */
export function resolverCC(netlist: readonly string[]): SolucionCC | null {
  const ls = lineas(netlist);
  if (!ls.every((l) => LINEALES.has(l.tipo))) return null;
  const nodos = new Map<string, number>();
  const nodo = (s: string | undefined): number => {
    const k = (s ?? '0').toLowerCase();
    if (k === '0' || k === 'gnd') return -1;
    if (!nodos.has(k)) nodos.set(k, nodos.size);
    return nodos.get(k)!;
  };
  // unknown branch currents: V, E and L
  const ramas = new Map<string, number>();
  for (const l of ls) {
    nodo(l.t[0]);
    nodo(l.t[1]);
    if (l.tipo === 'E') {
      nodo(l.t[2]);
      nodo(l.t[3]);
    }
  }
  for (const l of ls) if (l.tipo === 'V' || l.tipo === 'E' || l.tipo === 'L') ramas.set(l.nombre, ramas.size);
  const nn = nodos.size;
  const N = nn + ramas.size;
  if (!N) return { nodos: { '0': 0 }, corrientes: {} };
  const A = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  const b = new Array<number>(N).fill(0);
  const sumar = (r: number, c: number, v: number) => {
    if (r >= 0 && c >= 0) A[r]![c]! += v;
  };
  for (let k = 0; k < nn; k++) A[k]![k]! += 1e-12;
  for (const l of ls) {
    const a = nodo(l.t[0]);
    const z = nodo(l.t[1]);
    if (l.tipo === 'R') {
      const r = Math.abs(numeroSpice(l.t[2] ?? ''));
      const g = 1 / Math.max(r, 1e-9);
      sumar(a, a, g);
      sumar(z, z, g);
      sumar(a, z, -g);
      sumar(z, a, -g);
    } else if (l.tipo === 'I') {
      const v = valorDC(l.t.slice(2));
      if (a >= 0) b[a]! -= v;
      if (z >= 0) b[z]! += v;
    } else if (l.tipo === 'V' || l.tipo === 'L' || l.tipo === 'E') {
      const j = nn + ramas.get(l.nombre)!;
      sumar(a, j, 1);
      sumar(z, j, -1);
      sumar(j, a, 1);
      sumar(j, z, -1);
      if (l.tipo === 'V') b[j] = valorDC(l.t.slice(2));
      else if (l.tipo === 'E') {
        const g = numeroSpice(l.t[4] ?? '') || 0;
        sumar(j, nodo(l.t[2]), -g);
        sumar(j, nodo(l.t[3]), g);
      }
    }
  }
  for (const l of ls) {
    if (l.tipo !== 'F') continue;
    const a = nodo(l.t[0]);
    const z = nodo(l.t[1]);
    const ctl = ramas.get((l.t[2] ?? '').toLowerCase());
    const g = numeroSpice(l.t[3] ?? '') || 0;
    if (ctl == null) return null;
    sumar(a, nn + ctl, g);
    sumar(z, nn + ctl, -g);
  }
  const x = resolver(A, b);
  if (!x || x.some((v) => !Number.isFinite(v))) return null;
  const out: SolucionCC = { nodos: { '0': 0 }, corrientes: {} };
  for (const [k, i] of nodos) out.nodos[k] = Math.abs(x[i]!) < 1e-15 ? 0 : x[i]!;
  for (const [k, i] of ramas) out.corrientes[k] = x[nn + i]!;
  return out;
}

/**
 * What is known exactly without solving (a netlist with non-linear parts): ground, every V source with one end at
 * ground, the voltages the card measures (`medidos`: node → V, from the lesson's model), and whatever 0 V meters, coils
 * and V sources between a known node and another carry over.
 */
export function nodosConocidos(netlist: readonly string[], medidos: Record<string, number>): Record<string, number> {
  const ls = lineas(netlist);
  const v: Record<string, number> = { '0': 0 };
  for (const [k, x] of Object.entries(medidos)) if (Number.isFinite(x)) v[k.toLowerCase()] = x;
  const fuentes = ls.filter((l) => l.tipo === 'V' || l.tipo === 'L').map((l) => ({ a: (l.t[0] ?? '0').toLowerCase(), z: (l.t[1] ?? '0').toLowerCase(), d: l.tipo === 'L' ? 0 : valorDC(l.t.slice(2)) }));
  for (const f of fuentes) {
    if (f.a === 'gnd') f.a = '0';
    if (f.z === 'gnd') f.z = '0';
  }
  for (let vuelta = 0; vuelta < fuentes.length + 1; vuelta++) {
    let cambio = false;
    for (const f of fuentes) {
      if (f.a in v && !(f.z in v)) {
        v[f.z] = v[f.a]! - f.d;
        cambio = true;
      } else if (f.z in v && !(f.a in v)) {
        v[f.a] = v[f.z]! + f.d;
        cambio = true;
      }
    }
    if (!cambio) break;
  }
  return v;
}

/** The node of a measure «v(salida)» (lower case), or null for any other measure («v(a)-v(b)», «i(vmed)»). */
export function nodoDeMedida(medida: string): string | null {
  const m = /^\s*v\(\s*([A-Za-z0-9_]+)\s*\)\s*$/.exec(medida);
  return m ? m[1]!.toLowerCase() : null;
}

/** Points of an SVG path made of straight segments (M, L, H, V, Z; absolute or relative). Curves are not supported. */
export function puntosDeCamino(d: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /([MLHVZmlhvz])([^MLHVZmlhvz]*)/g;
  let x = 0;
  let y = 0;
  let x0 = 0;
  let y0 = 0;
  for (const m of d.matchAll(re)) {
    const c = m[1]!;
    const n = (m[2]!.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi) ?? []).map(Number);
    const rel = c === c.toLowerCase();
    switch (c.toUpperCase()) {
      case 'M':
      case 'L':
        for (let k = 0; k + 1 < n.length; k += 2) {
          x = rel ? x + n[k]! : n[k]!;
          y = rel ? y + n[k + 1]! : n[k + 1]!;
          if (c.toUpperCase() === 'M' && k === 0) {
            x0 = x;
            y0 = y;
          }
          out.push([x, y]);
        }
        break;
      case 'H':
        for (const v of n) {
          x = rel ? x + v : v;
          out.push([x, y]);
        }
        break;
      case 'V':
        for (const v of n) {
          y = rel ? y + v : v;
          out.push([x, y]);
        }
        break;
      case 'Z':
        x = x0;
        y = y0;
        out.push([x, y]);
        break;
    }
  }
  return out;
}
