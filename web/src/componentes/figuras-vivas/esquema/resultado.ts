// ngspice plots of a regenerated schematic netlist → the same structures as `simulacion.op` / `.tran` of the
// figure data (simular_esquema.py, `collect()`): node voltages, wire-segment and terminal currents, and the
// voltage, current and power of each element.

import type { Grafica } from '../../../simulador/motor/nucleo.ts';
import type { Esquema, ResultadoOp, ResultadoTran, ResultadoElemento, Num } from '../tipos';
import { claveTerm, elementosCircuito, PERIODOS, PUNTOS_PERIODO, type MetaNetlist } from './netlist.ts';

type Tabla = Map<string, Float64Array>;

function tabla(g: Grafica): Tabla {
  const m: Tabla = new Map();
  for (const v of g.vectores) {
    const n = v.nombre.toLowerCase();
    const mv = /^v\((.*)\)$/.exec(n);
    const mi = /^i\((.*)\)$/.exec(n);
    m.set(mv ? mv[1]! : mi ? `${mi[1]!}#branch` : n, v.re);
  }
  return m;
}

const fin = (v: number | undefined): Num => (v == null || !Number.isFinite(v) ? null : Number(v.toPrecision(6)));

/** Builds op or tran results from a table of vectors and a picker of samples. */
function recoger<T>(
  esq: Esquema,
  meta: MetaNetlist,
  raw: Tabla,
  pick: (a: Float64Array | undefined) => T | null,
  restar: (a: Float64Array, b: Float64Array) => Float64Array,
  conPotencia: boolean,
): { nodos: Record<string, T | null>; tramos: Record<string, T | null>; elementos: Record<string, ResultadoElemento<T | null>> } {
  const nodos: Record<string, T | null> = {};
  const tramos: Record<string, T | null> = {};
  const elementos: Record<string, ResultadoElemento<T | null>> = {};
  const cero = raw.values().next().value as Float64Array | undefined;
  for (const nd of esq.nodos) {
    if (nd.tierra) {
      nodos[nd.id] = pick(cero ? new Float64Array(cero.length) : new Float64Array(1));
      continue;
    }
    nodos[nd.id] = pick(raw.get(nd.puntos[0]!.toLowerCase()));
  }
  const pv = (pid: string) => raw.get(pid.toLowerCase());
  const corriente = (n: string | undefined) => (n ? raw.get(`${n}#branch`) : undefined);
  for (const [id, n] of meta.tramo) tramos[id] = pick(corriente(n));
  for (const e of elementosCircuito(esq)) {
    if (e.rol === 'GND') {
      const n = meta.gnd.find(([i]) => i === e.id)?.[1];
      if (n) elementos[e.id] = { corriente: pick(corriente(n)) };
      continue;
    }
    if (e.rol === 'RAIL') {
      elementos[e.id] = { corriente: pick(corriente(meta.rail.get(e.id))), nota: 'positiva hacia el carril' };
      continue;
    }
    const terms: Record<string, T | null> = {};
    const brutos: Record<string, Float64Array | undefined> = {};
    for (const n of Object.keys(e.terminales ?? {})) {
      const a = corriente(meta.term.get(claveTerm(e.id, n)));
      brutos[n] = a;
      terms[n] = pick(a);
    }
    const ent: ResultadoElemento<T | null> = { terminales: terms };
    const ks = Object.keys(terms);
    if (ks.length === 2 && 'start' in terms && 'end' in terms) {
      ent.corriente = terms['start'] ?? null;
      const vs = pv(e.puntos_terminal!['start']!);
      const ve = pv(e.puntos_terminal!['end']!);
      if (vs && ve) ent.tension = pick(restar(vs, ve));
    }
    if (conPotencia) {
      let p = 0;
      let ok = true;
      for (const n of ks) {
        const v = pv(e.puntos_terminal![n]!);
        const i = brutos[n];
        if (!v || !i) {
          ok = false;
          break;
        }
        p += v[0]! * i[0]!;
      }
      if (ok) ent.potencia = fin(p);
    }
    elementos[e.id] = ent;
  }
  return { nodos, tramos, elementos };
}

const restar = (a: Float64Array, b: Float64Array) => {
  const r = new Float64Array(Math.min(a.length, b.length));
  for (let i = 0; i < r.length; i++) r[i] = a[i]! - b[i]!;
  return r;
};

/** Operating point from the `op` plot. */
export function leerOp(esq: Esquema, meta: MetaNetlist, g: Grafica): ResultadoOp {
  return recoger<number>(esq, meta, tabla(g), (a) => (a && a.length ? fin(a[0]) : null), restar, true);
}

/** Last two periods of the transient, resampled to 100 points per period (t from 0). */
export function leerTran(esq: Esquema, meta: MetaNetlist, g: Grafica): ResultadoTran | null {
  const raw = tabla(g);
  const t = raw.get('time');
  if (!t || t.length < 2 || !meta.freq) return null;
  const periodo = 1 / meta.freq;
  const tf = t[t.length - 1]!;
  const t0 = tf - PERIODOS * periodo;
  const n = PUNTOS_PERIODO * PERIODOS + 1;
  // Index and weight of every output sample in the simulated time axis (shared by all vectors).
  const idx = new Int32Array(n);
  const w = new Float64Array(n);
  let j = 0;
  for (let k = 0; k < n; k++) {
    const tk = t0 + (k / (n - 1)) * (tf - t0);
    while (j < t.length - 2 && t[j + 1]! < tk) j++;
    const a = t[j]!;
    const b = t[j + 1]!;
    idx[k] = j;
    w[k] = b > a ? Math.min(1, Math.max(0, (tk - a) / (b - a))) : 0;
  }
  const muestrear = (a: Float64Array | undefined): Num[] | null => {
    if (!a) return null;
    const r: Num[] = new Array(n);
    for (let k = 0; k < n; k++) {
      const i = idx[k]!;
      r[k] = fin(a[i]! + (a[Math.min(a.length - 1, i + 1)]! - a[i]!) * w[k]!);
    }
    return r;
  };
  const base = recoger<Num[]>(esq, meta, raw, muestrear, restar, false);
  return {
    t: Array.from({ length: n }, (_, k) => (k / (n - 1)) * (tf - t0)),
    periodo,
    ...base,
  };
}
