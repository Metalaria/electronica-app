// A book (or user) netlist driving a live schematic: matching a drawn topology to the netlist's elements
// and nodes, instrumenting the netlist with 0 V ammeters on the pins of the drawn parts, and turning its
// operating point and transient into the overlay's results (node voltages, terminal currents and, by
// Kirchhoff's current law on the drawn wires, the current of every wire segment).

import type { Grafica } from '../../../simulador/motor/nucleo.ts';
import { numeroSpice } from '../../../simulador/motor/netlist.ts';
import type { Correspondencia, Esquema, Num, ResultadoElemento, ResultadoOp, ResultadoTran } from '../tipos';

// ------------------------------------------------------------------ parsing

export interface LineaElemento {
  /** Instance name, lower case («r1», «q2», «x1»). */
  nombre: string;
  tipo: string;
  nodos: string[];
  /** First value token, when numeric (R, C, L, DC sources). */
  valor: number | null;
  /** Index of the logical line in `logicas`. */
  linea: number;
}

/** Number of node tokens of each SPICE element letter (X: all tokens but the last, before params). */
const NODOS: Record<string, number> = { r: 2, c: 2, l: 2, d: 2, v: 2, i: 2, e: 4, g: 4, f: 2, h: 2, b: 2, q: 3, m: 4, j: 3, s: 4, w: 2, t: 4, k: 0 };

/** Logical lines (continuations «+» joined), with comments kept as they are. */
export function lineasLogicas(texto: string): string[] {
  const res: string[] = [];
  for (const l of texto.replace(/\r/g, '').split('\n')) {
    if (/^\s*\+/.test(l) && res.length) res[res.length - 1] += ' ' + l.replace(/^\s*\+/, '');
    else res.push(l);
  }
  return res;
}

/** Top-level element lines (outside .subckt and .control). */
export function elementos(logicas: string[]): LineaElemento[] {
  const res: LineaElemento[] = [];
  let sub = 0;
  let control = false;
  logicas.forEach((l, i) => {
    const t = l.trim();
    if (i === 0 || !t || t.startsWith('*')) return;
    const low = t.toLowerCase();
    if (low.startsWith('.control')) control = true;
    else if (low.startsWith('.endc')) control = false;
    else if (low.startsWith('.subckt')) sub++;
    else if (low.startsWith('.ends')) sub = Math.max(0, sub - 1);
    if (control || sub || t.startsWith('.')) return;
    const toks = t.replace(/;.*$/, '').split(/\s+/);
    const nombre = toks[0]!.toLowerCase();
    const tipo = nombre[0]!;
    let n = NODOS[tipo];
    if (tipo === 'x') {
      // Nodes are every token up to the subcircuit name (the last token without «=»).
      const sinParams = toks.slice(1).filter((x) => !x.includes('=') && !/^params:$/i.test(x));
      n = Math.max(0, sinParams.length - 1);
    }
    if (n == null) return;
    const nodos = toks.slice(1, 1 + n).map((x) => x.toLowerCase());
    let valor: number | null = null;
    const v = toks[1 + n];
    if (v && 'rclvi'.includes(tipo)) {
      const w = v.toLowerCase() === 'dc' ? toks[2 + n] : v;
      valor = w ? numeroSpice(w) : null;
    }
    res.push({ nombre, tipo, nodos: nodos.map((x) => (x === 'gnd' ? '0' : x)), valor, linea: i });
  });
  return res;
}

// ------------------------------------------------------------------ matching a drawing

/** Pin order of each kind of drawn part on its netlist line. */
function pinesFijos(e: Esquema['elementos'][number]): Record<string, number> | null {
  const pol = e.polaridad ?? {};
  switch (e.rol) {
    case 'V':
    case 'V?':
    case 'BAT':
    case 'VSIN':
    case 'VPULSE':
    case 'VTRI':
      return pol['positivo'] && pol['negativo'] ? { [pol['positivo']]: 0, [pol['negativo']]: 1 } : null;
    case 'I':
      return pol['entra'] && pol['sale'] ? { [pol['entra']]: 0, [pol['sale']]: 1 } : null;
    case 'D':
    case 'DZ':
    case 'LED':
      return pol['anodo'] && pol['catodo'] ? { [pol['anodo']]: 0, [pol['catodo']]: 1 } : null;
    case 'QN':
    case 'QP':
      return { collector: 0, base: 1, emitter: 2 };
    case 'MN':
    case 'MP':
    case 'JN':
    case 'JP':
      return { drain: 0, gate: 1, source: 2 };
    default:
      return null;
  }
}

const LETRA: Record<string, string> = {
  R: 'r', POT: 'r', LAMP: 'r', C: 'c', VAR: 'c', L: 'l', V: 'v', 'V?': 'v', BAT: 'v', VSIN: 'v', VPULSE: 'v', VTRI: 'v',
  I: 'i', D: 'd', DZ: 'd', LED: 'd', QN: 'q', QP: 'q', MN: 'm', MP: 'm', JN: 'j', JP: 'j', SW: 'r', FUSE: 'r', AM: 'v', VM: 'r',
};
const IGNORAR = new Set(['WIRE', 'DOT', 'ANOT', 'GND', 'RAIL']);

/** Kinds whose drawn value must agree with the netlist (sources are often drawn with another amplitude). */
const VALOR_ESTRICTO = new Set(['R', 'POT', 'C', 'L']);

/**
 * Matches a drawn schematic to a netlist by a small backtracking search: each drawn part takes a netlist
 * element of the same kind (the one with its designator when there is one, R1 ↔ R1; otherwise any whose
 * value agrees), with its pins by polarity (sources, diodes, transistors) or in either order (passives),
 * so that drawn nodes and netlist nodes correspond one to one. Returns null when no consistent match exists.
 */
export function emparejar(esq: Esquema, texto: string): Correspondencia | null {
  const lineas = elementos(lineasLogicas(texto));
  const partes = esq.elementos.filter((e) => !IGNORAR.has(e.rol) && !e.discontinuo && Object.keys(e.terminales ?? {}).length);
  if (!partes.length || partes.length > 60) return null;
  type Opcion = { l: LineaElemento; pines: Record<string, number> };
  const opciones: { e: (typeof partes)[number]; ops: Opcion[] }[] = [];
  for (const e of partes) {
    const letra = LETRA[e.rol];
    if (!letra) return null;
    const ts = Object.keys(e.terminales ?? {});
    const d = (e.designador ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    const porNombre = d ? lineas.filter((x) => x.nombre === d && x.tipo === letra) : [];
    const cand = porNombre.length
      ? porNombre
      : lineas.filter(
          (x) =>
            x.tipo === letra &&
            (!VALOR_ESTRICTO.has(e.rol) || e.valor == null || x.valor == null || Math.abs(x.valor - e.valor) <= Math.abs(e.valor) * 1e-3),
        );
    const fijos = pinesFijos(e);
    const ops: Opcion[] = [];
    for (const l of cand) {
      if (fijos) {
        const pines: Record<string, number> = {};
        for (const t of ts) if (fijos[t] != null && l.nodos[fijos[t]!] != null) pines[t] = fijos[t]!;
        if (Object.keys(pines).length === ts.length) ops.push({ l, pines });
      } else if (ts.length === 2 && l.nodos.length >= 2) {
        ops.push({ l, pines: { [ts[0]!]: 0, [ts[1]!]: 1 } });
        ops.push({ l, pines: { [ts[0]!]: 1, [ts[1]!]: 0 } });
      }
    }
    if (!ops.length) return null;
    opciones.push({ e, ops });
  }
  opciones.sort((a, b) => a.ops.length - b.ops.length);
  const nodos: Record<string, string> = {};
  const inverso: Record<string, string> = {};
  const tierra = esq.nodos.find((n) => n.tierra);
  if (tierra) {
    nodos[tierra.id] = '0';
    inverso['0'] = tierra.id;
  }
  const usados = new Set<string>();
  const eleccion: Opcion[] = [];
  let pasos = 0;
  const buscar = (i: number): boolean => {
    if (i === opciones.length) return true;
    if (++pasos > 50000) return false;
    const { e, ops } = opciones[i]!;
    for (const o of ops) {
      if (usados.has(o.l.nombre)) continue;
      const nuevos: [string, string][] = [];
      let ok = true;
      for (const [t, k] of Object.entries(o.pines)) {
        const fig = e.terminales![t]!;
        const net = o.l.nodos[k]!;
        const a = nodos[fig];
        const b = inverso[net];
        if (a != null || b != null) {
          if (a !== net || b !== fig) {
            ok = false;
            break;
          }
        } else {
          nodos[fig] = net;
          inverso[net] = fig;
          nuevos.push([fig, net]);
        }
      }
      if (ok) {
        usados.add(o.l.nombre);
        eleccion[i] = o;
        if (buscar(i + 1)) return true;
        usados.delete(o.l.nombre);
      }
      for (const [fig, net] of nuevos) {
        delete nodos[fig];
        delete inverso[net];
      }
    }
    return false;
  };
  if (!buscar(0)) return null;
  const elems: Correspondencia['elementos'] = {};
  opciones.forEach(({ e }, i) => (elems[e.id] = { nombre: eleccion[i]!.l.nombre, pines: eleccion[i]!.pines }));
  return { nodos, elementos: elems };
}

// ------------------------------------------------------------------ instrumented netlist

const ANALISIS = /^\.(op|dc|ac|tran|noise|tf|pz|sens|four|disto|sp|pss|meas|measure|print|plot|probe|save|width|end)\b/i;

export interface Instrumentada {
  texto: string;
  /** [element id, terminal] → ammeter name. */
  amperimetros: Map<string, string>;
  tran: boolean;
  /** Longest period of the drawn periodic sources (PULSE, SIN), s, or null. */
  periodo: number | null;
}

/** Period of a PULSE or SIN source line, or null. */
function periodoFuente(linea: string): number | null {
  const p = /pulse\s*\(([^)]*)\)/i.exec(linea);
  if (p) {
    const per = numeroSpice(p[1]!.trim().split(/[\s,]+/)[6] ?? '');
    return per && per > 0 ? per : null;
  }
  const s = /sin\s*\(([^)]*)\)/i.exec(linea);
  if (s) {
    const f = numeroSpice(s[1]!.trim().split(/[\s,]+/)[2] ?? '');
    return f && f > 0 ? 1 / f : null;
  }
  return null;
}

/**
 * The circuit of a netlist with a 0 V source in series with every matched pin, without its analyses and
 * .control block, plus its own `op` and (when the netlist has a transient and `conTran`) the same `tran`.
 */
export function instrumentar(texto: string, corr: Correspondencia[], conTran: boolean): Instrumentada {
  const logicas = lineasLogicas(texto);
  const lineas = elementos(logicas);
  const porNombre = new Map(lineas.map((l) => [l.nombre, l]));
  const amperimetros = new Map<string, string>();
  const extra: string[] = [];
  const cambios = new Map<number, string>();
  let periodo: number | null = null;
  for (const c of corr) {
    for (const [eid, { nombre, pines }] of Object.entries(c.elementos)) {
      const l = porNombre.get(nombre);
      if (!l) continue;
      if (l.tipo === 'v' || l.tipo === 'i') {
        const per = periodoFuente(logicas[l.linea]!);
        if (per) periodo = Math.max(periodo ?? 0, per);
      }
      const toks = (cambios.get(l.linea) ?? logicas[l.linea]!).trim().split(/\s+/);
      for (const [t, k] of Object.entries(pines)) {
        const nodo = l.nodos[k];
        if (nodo == null) continue;
        const interno = `fv_${nombre}_${k}`;
        const am = `vfv_${nombre}_${k}`;
        if (!amperimetros.has(`${eid}|${t}`)) {
          toks[1 + k] = interno;
          extra.push(`${am} ${nodo} ${interno} 0`);
        }
        amperimetros.set(`${eid}|${t}`, am);
      }
      cambios.set(l.linea, toks.join(' '));
    }
  }
  // The transient of the netlist (dot card or .control command), reused as it is.
  let tran: string | null = null;
  for (const l of logicas) {
    const m = /^\s*\.?tran\s+(\S+)\s+(\S+)/i.exec(l);
    if (m) {
      // At most ~20 000 output steps: the animation keeps 240 samples anyway.
      const paso = numeroSpice(m[1]!);
      const fin = numeroSpice(m[2]!);
      const p = paso && fin && fin / paso > 20000 ? String(fin / 20000) : m[1]!;
      tran = `tran ${p} ${m[2]}${/\buic\b/i.test(l) ? ' uic' : ''}`;
      break;
    }
  }
  const salida: string[] = [];
  let control = false;
  logicas.forEach((l, i) => {
    const t = l.trim().toLowerCase();
    if (t.startsWith('.control')) control = true;
    if (control) {
      if (t.startsWith('.endc')) control = false;
      return;
    }
    if (i > 0 && ANALISIS.test(t)) return;
    salida.push(cambios.get(i) ?? l);
  });
  salida.push('* live-schematic ammeters', ...extra, '.control', 'op');
  if (conTran && tran) salida.push(tran);
  salida.push('.endc', '.end');
  return { texto: salida.join('\n') + '\n', amperimetros, tran: !!(conTran && tran), periodo };
}

// ------------------------------------------------------------------ results

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

/**
 * Wire-segment currents of one node by Kirchhoff's law on the drawn wires: each connected group of wires
 * gets its terminal currents, and a ground or supply symbol on it (or, without one, its first point)
 * balances the sum. Loops formed only by wires carry no circulating current (a spanning tree is used).
 */
function corrientesCables(esq: Esquema, inyeccion: Map<string, number>, sumideros: Set<string>): Record<string, number> {
  const res: Record<string, number> = {};
  const vecinos = new Map<string, { t: string; otro: string }[]>();
  for (const t of esq.tramos) {
    (vecinos.get(t.de) ?? vecinos.set(t.de, []).get(t.de)!).push({ t: t.id, otro: t.a });
    (vecinos.get(t.a) ?? vecinos.set(t.a, []).get(t.a)!).push({ t: t.id, otro: t.de });
    res[t.id] = 0;
  }
  const visto = new Set<string>();
  const tramos = new Map(esq.tramos.map((t) => [t.id, t]));
  for (const inicio of vecinos.keys()) {
    if (visto.has(inicio)) continue;
    // Component of wires: find it, then root it at a sink when there is one.
    const comp: string[] = [];
    const pila = [inicio];
    visto.add(inicio);
    while (pila.length) {
      const p = pila.pop()!;
      comp.push(p);
      for (const v of vecinos.get(p) ?? []) if (!visto.has(v.otro)) {
        visto.add(v.otro);
        pila.push(v.otro);
      }
    }
    const raiz = comp.find((p) => sumideros.has(p)) ?? comp[0]!;
    const padre = new Map<string, { p: string; t: string }>();
    const orden: string[] = [];
    const dentro = new Set([raiz]);
    const cola = [raiz];
    while (cola.length) {
      const p = cola.shift()!;
      orden.push(p);
      for (const v of vecinos.get(p) ?? []) if (!dentro.has(v.otro)) {
        dentro.add(v.otro);
        padre.set(v.otro, { p, t: v.t });
        cola.push(v.otro);
      }
    }
    const suma = new Map<string, number>();
    for (let i = orden.length - 1; i > 0; i--) {
      const p = orden[i]!;
      const s = (suma.get(p) ?? 0) + (inyeccion.get(p) ?? 0);
      const { p: q, t } = padre.get(p)!;
      // s flows from p towards its parent q.
      const tr = tramos.get(t)!;
      res[t] = tr.de === p ? s : -s;
      suma.set(q, (suma.get(q) ?? 0) + s);
    }
  }
  return res;
}

/** Overlay results from the plots of an instrumented run. */
export function resultados(
  esq: Esquema,
  corr: Correspondencia,
  ins: Instrumentada,
  graficas: Grafica[],
): { op: ResultadoOp | null; tran: ResultadoTran | null } {
  const puntoDe = new Map<string, string>();
  for (const e of esq.elementos) for (const [t, p] of Object.entries(e.puntos_terminal ?? {})) puntoDe.set(`${e.id}|${t}`, p);
  const sumideros = new Set<string>();
  for (const e of esq.elementos) if ((e.rol === 'GND' || e.rol === 'RAIL') && e.puntos_terminal?.['start']) sumideros.add(e.puntos_terminal['start']);

  const construir = (raw: Tabla, idx: (a: Float64Array) => number): {
    nodos: Record<string, Num>;
    tramos: Record<string, Num>;
    elementos: Record<string, ResultadoElemento<Num>>;
  } => {
    const val = (a: Float64Array | undefined): Num => {
      if (!a || !a.length) return null;
      const v = a[Math.min(a.length - 1, idx(a))]!;
      return Number.isFinite(v) ? v : null;
    };
    const nodos: Record<string, Num> = {};
    for (const n of esq.nodos) {
      const net = corr.nodos[n.id];
      nodos[n.id] = n.tierra || net === '0' ? 0 : net ? val(raw.get(net)) : null;
    }
    const elementos: Record<string, ResultadoElemento<Num>> = {};
    const inyeccion = new Map<string, number>();
    for (const [eid] of Object.entries(corr.elementos)) {
      const e = esq.elementos.find((x) => x.id === eid);
      if (!e) continue;
      const terminales: Record<string, Num> = {};
      for (const t of Object.keys(e.terminales ?? {})) {
        const am = ins.amperimetros.get(`${eid}|${t}`);
        const i = am ? val(raw.get(`${am}#branch`)) : null;
        terminales[t] = i;
        const p = puntoDe.get(`${eid}|${t}`);
        if (p && i != null) inyeccion.set(p, (inyeccion.get(p) ?? 0) - i);
      }
      const r: ResultadoElemento<Num> = { terminales };
      if ('start' in terminales && 'end' in terminales && Object.keys(terminales).length === 2) {
        r.corriente = terminales['start'] ?? null;
        const a = nodos[e.terminales!['start']!];
        const b = nodos[e.terminales!['end']!];
        if (a != null && b != null) r.tension = a - b;
      }
      let p = 0;
      let ok = true;
      for (const [t, i] of Object.entries(terminales)) {
        const v = nodos[e.terminales![t]!];
        if (i == null || v == null) ok = false;
        else p += v * i;
      }
      if (ok) r.potencia = p;
      elementos[eid] = r;
    }
    const tramos = corrientesCables(esq, inyeccion, sumideros);
    return { nodos, tramos, elementos };
  };

  const gop = graficas.find((g) => /operating/i.test(g.analisis));
  const op = gop ? construir(tabla(gop), () => 0) : null;
  let tran: ResultadoTran | null = null;
  const gtr = graficas.find((g) => /transient/i.test(g.analisis));
  if (gtr) {
    const raw = tabla(gtr);
    const t = raw.get('time');
    if (t && t.length > 1) {
      // A transient of many periods of a drawn source: its last two periods, as in the book's figures.
      const t1 = t[t.length - 1]!;
      const largo = ins.periodo && t1 - t[0]! > 4 * ins.periodo;
      const t0 = largo ? t1 - 2 * ins.periodo! : t[0]!;
      const N = largo ? 201 : 240;
      let j = 0;
      while (j < t.length - 1 && t[j + 1]! <= t0) j++;
      const muestras: ReturnType<typeof construir>[] = [];
      const ts: number[] = [];
      for (let k = 0; k < N; k++) {
        const tk = t0 + ((t1 - t0) * k) / (N - 1);
        while (j < t.length - 1 && t[j + 1]! <= tk) j++;
        ts.push(tk - t0);
        muestras.push(construir(raw, () => j));
      }
      const serie = <K extends 'nodos' | 'tramos'>(clave: K) => {
        const r: Record<string, Num[]> = {};
        for (const id of Object.keys(muestras[0]![clave])) r[id] = muestras.map((m) => m[clave][id] ?? null);
        return r;
      };
      const elementos: ResultadoTran['elementos'] = {};
      for (const id of Object.keys(muestras[0]!.elementos)) {
        const ts0 = muestras[0]!.elementos[id]!;
        const terminales: Record<string, Num[]> = {};
        for (const tt of Object.keys(ts0.terminales ?? {})) terminales[tt] = muestras.map((m) => m.elementos[id]?.terminales?.[tt] ?? null);
        elementos[id] = {
          terminales,
          corriente: 'corriente' in ts0 ? muestras.map((m) => m.elementos[id]?.corriente ?? null) : undefined,
          tension: 'tension' in ts0 ? muestras.map((m) => m.elementos[id]?.tension ?? null) : undefined,
        };
      }
      tran = { t: ts, periodo: largo ? ins.periodo! : (t1 - t0) / 2, nodos: serie('nodos'), tramos: serie('tramos'), elementos };
    }
  }
  return { op, tran };
}
