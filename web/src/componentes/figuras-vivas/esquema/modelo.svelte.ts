// State of one live schematic: its geometry in SVG units (wires, nodes, current paths through the parts),
// the results shown (the book's operating point and transient, or a re-simulation with other values), the
// playback of the transient, the particle animation and the selection.

import { afin, distPolilinea, distRect, trayecto, type Trayecto } from '../geometria';
import type { Elemento, Esquema, Num, Punto, ResultadoOp, ResultadoTran } from '../tipos';
import { elementosCircuito } from './netlist.ts';

export type Clave = { k: 'tramo'; id: string } | { k: 'elem'; id: string } | { k: 'term'; id: string; t: string };

export interface Camino {
  clave: Clave;
  tr: Trayecto;
  /** Node of a wire segment (for highlighting). */
  nodo: string | null;
  elemento: string | null;
  /** Particle phase (arc length offset, SVG units) and spacing. */
  fase: number;
  n: number;
  paso: number;
}

export interface NodoGeo {
  id: string;
  tierra: boolean;
  etiquetas: string[];
  tramos: Punto[][];
  /** Points of the node not covered by any wire (terminals joined directly). */
  sueltos: Punto[];
  /** Terminal anchors connected to it, «E3.start». */
  terminales: { el: string; t: string; p: Punto }[];
}

export interface ElementoGeo {
  e: Elemento;
  /** Symbol box in SVG units [x0, y0, x1, y1]. */
  caja: [number, number, number, number] | null;
  centro: Punto;
}

export type Seleccion = { k: 'tramo' | 'nodo' | 'elem'; id: string } | null;

/** Parts whose «rol» has no current of its own to animate. */
const SIN_CAMINO = new Set(['GND', 'RAIL', 'DOT', 'WIRE', 'ANOT']);

function centroCaja(c: [number, number, number, number]): Punto {
  return [(c[0] + c[2]) / 2, (c[1] + c[3]) / 2];
}

/** Value of a result series at a fractional sample index. */
function enIndice(a: Num[] | null | undefined, f: number | null): number | null {
  if (!a || f == null) return null;
  const i = Math.floor(f);
  const u = f - i;
  const v0 = a[Math.min(a.length - 1, Math.max(0, i))];
  const v1 = a[Math.min(a.length - 1, Math.max(0, i + 1))];
  if (v0 == null || v1 == null) return v0 ?? v1 ?? null;
  return v0 + (v1 - v0) * u;
}

function calcularRangos(op: ResultadoOp | null, tran: ResultadoTran | null): { vmin: number; vmax: number; imax: number } {
  let vmin = 0;
  let vmax = 0;
  let imax = 0;
  const v = (x: Num | undefined) => {
    if (x == null || !Number.isFinite(x)) return;
    if (x < vmin) vmin = x;
    if (x > vmax) vmax = x;
  };
  const i = (x: Num | undefined) => {
    if (x != null && Number.isFinite(x)) imax = Math.max(imax, Math.abs(x));
  };
  if (op) {
    Object.values(op.nodos).forEach(v);
    Object.values(op.tramos).forEach(i);
    for (const e of Object.values(op.elementos)) {
      i(e.corriente);
      Object.values(e.terminales ?? {}).forEach(i);
    }
  }
  if (tran) {
    for (const a of Object.values(tran.nodos)) a?.forEach(v);
    for (const a of Object.values(tran.tramos)) a?.forEach(i);
    for (const e of Object.values(tran.elementos)) {
      e.corriente?.forEach(i);
      for (const a of Object.values(e.terminales ?? {})) a?.forEach(i);
    }
  }
  return { vmin, vmax, imax };
}

export class EstadoEsquema {
  readonly esq: Esquema;
  readonly indice: number;
  readonly simulable: boolean;
  readonly caminos: Camino[] = [];
  readonly nodos: NodoGeo[] = [];
  readonly elementos: ElementoGeo[] = [];
  readonly nodoDePunto = new Map<string, string>();
  /** Bounding box of the drawing in SVG units. */
  readonly limites: [number, number, number, number];

  // ---------------------------------------------------------------- reactive state
  op = $state.raw<ResultadoOp | null>(null);
  tran = $state.raw<ResultadoTran | null>(null);
  /** Position in the transient, 0–1 of the two periods kept. */
  fase = $state(0);
  reproduciendo = $state(true);
  electrones = $state(false);
  seleccion = $state<Seleccion>(null);
  hover = $state<Seleccion>(null);
  /** Values changed with the sliders (element id → value; «f:id» → frequency; «i:id» → load current). */
  cambios = $state<Record<string, number>>({});
  estadoSim = $state<'libro' | 'simulando' | 'ok' | 'error'>('libro');
  mensaje = $state('');

  /** Results come from outside (a netlist's own simulation, set into `op`/`tran`), not from the figure data. */
  readonly externo: boolean;

  constructor(esq: Esquema, indice: number, externo = false) {
    this.esq = esq;
    this.indice = indice;
    this.externo = externo;
    this.simulable = externo || (!!esq.simulacion?.simulable && !!esq.simulacion.op);
    this.op = esq.simulacion?.op ?? null;
    this.tran = esq.simulacion?.tran ?? null;
    const A = esq.dibujo_a_svg;
    const P = (p: Punto) => afin(A, p);
    const pts = new Map(esq.puntos.map((p) => [p.id, p]));
    for (const p of esq.puntos) this.nodoDePunto.set(p.id, p.nodo);

    // Wires.
    const cubiertos = new Set<string>();
    for (const t of esq.tramos) {
      cubiertos.add(t.de);
      cubiertos.add(t.a);
      this.caminos.push({ clave: { k: 'tramo', id: t.id }, tr: trayecto(t.puntos.map(P)), nodo: t.nodo, elemento: null, fase: 0, n: 0, paso: 0 });
    }
    // Current paths through the parts.
    const excluidos = new Set(esq.simulacion?.excluidos ?? []);
    const circuito = new Set(elementosCircuito(esq).map((e) => e.id));
    for (const e of esq.elementos) {
      const caja = e.caja ? (() => {
        const a = P([e.caja![0], e.caja![1]]);
        const b = P([e.caja![2], e.caja![3]]);
        return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])] as [number, number, number, number];
      })() : null;
      const centro = e.anclas['center'] ? P(e.anclas['center']) : caja ? centroCaja(caja) : P(Object.values(e.anclas)[0] ?? [0, 0]);
      if (e.rol !== 'WIRE' && e.rol !== 'DOT') this.elementos.push({ e, caja, centro });
      if (SIN_CAMINO.has(e.rol) || excluidos.has(e.id) || !circuito.has(e.id)) continue;
      const ts = Object.keys(e.terminales ?? {}).filter((t) => e.anclas[t]);
      if (ts.length === 2 && ts.includes('start') && ts.includes('end')) {
        this.caminos.push({ clave: { k: 'elem', id: e.id }, tr: trayecto([P(e.anclas['start']!), P(e.anclas['end']!)]), nodo: null, elemento: e.id, fase: 0, n: 0, paso: 0 });
      } else if (ts.length >= 2) {
        for (const t of ts)
          this.caminos.push({ clave: { k: 'term', id: e.id, t }, tr: trayecto([P(e.anclas[t]!), centro]), nodo: null, elemento: e.id, fase: 0, n: 0, paso: 0 });
      }
    }
    // Nodes.
    for (const nd of esq.nodos) {
      const tramos = esq.tramos.filter((t) => t.nodo === nd.id).map((t) => t.puntos.map(P));
      // The leads drawn as part of a two-terminal symbol (from its terminal to the body, schemdraw's
      // start→istart and iend→end) are wires of the node too: they get its colour along their whole length.
      for (const e of esq.elementos) {
        const te = e.terminales ?? {};
        if (Object.keys(te).length !== 2 || !('start' in te) || !('end' in te)) continue;
        for (const [t, i] of [['start', 'istart'], ['end', 'iend']] as const) {
          const a = e.anclas[t];
          const b = e.anclas[i];
          if (te[t] !== nd.id || !a || !b || Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-3) continue;
          tramos.push([P(a), P(b)]);
        }
      }
      const sueltos = nd.puntos.filter((p) => !cubiertos.has(p)).map((p) => P(pts.get(p)!.xy));
      const terminales = nd.terminales.flatMap((s) => {
        const [el, t] = s.split('.') as [string, string];
        const e = esq.elementos.find((x) => x.id === el);
        const a = e?.anclas[t];
        return a ? [{ el, t, p: P(a) }] : [];
      });
      this.nodos.push({ id: nd.id, tierra: nd.tierra, etiquetas: nd.etiquetas ?? [], tramos, sueltos, terminales });
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const ampliar = (p: Punto) => {
      x0 = Math.min(x0, p[0]);
      y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]);
      y1 = Math.max(y1, p[1]);
    };
    for (const p of esq.puntos) ampliar(P(p.xy));
    for (const g of this.elementos) if (g.caja) {
      ampliar([g.caja[0], g.caja[1]]);
      ampliar([g.caja[2], g.caja[3]]);
    }
    this.limites = [x0, y0, x1, y1];
  }

  // ---------------------------------------------------------------- results at the current time

  /** Fractional sample index in the transient, or null (operating point). */
  get muestra(): number | null {
    return this.muestraEn(this.fase);
  }

  /**
   * Position of the particle animation in the transient (0–1), advanced every frame without reactivity;
   * `fase` (what the colours, cards and scrubber show) follows it at a lower rate.
   */
  faseFina = 0;
  /** Last `fase` written by the animation (a different value means the reader moved the scrubber). */
  faseEscrita = 0;

  muestraEn(fase: number): number | null {
    const tr = this.tran;
    if (!tr || tr.t.length < 2) return null;
    return Math.min(tr.t.length - 1, Math.max(0, fase * (tr.t.length - 1)));
  }

  /** Simulated time shown (s), or null. */
  get tiempo(): number | null {
    const tr = this.tran;
    const m = this.muestra;
    if (!tr || m == null) return null;
    return enIndice(tr.t, m);
  }

  tension(nodo: string, f = this.muestra): number | null {
    if (f != null && this.tran) return enIndice(this.tran.nodos[nodo], f);
    return this.op?.nodos[nodo] ?? null;
  }

  corriente(c: Clave, f = this.muestra): number | null {
    if (f != null && this.tran) {
      const tr = this.tran;
      if (c.k === 'tramo') return enIndice(tr.tramos[c.id], f);
      const e = tr.elementos[c.id];
      if (!e) return null;
      if (c.k === 'elem') return enIndice(e.corriente ?? e.terminales?.['start'] ?? null, f);
      return enIndice(e.terminales?.[c.t] ?? null, f);
    }
    const op = this.op;
    if (!op) return null;
    if (c.k === 'tramo') return op.tramos[c.id] ?? null;
    const e = op.elementos[c.id];
    if (!e) return null;
    if (c.k === 'elem') return e.corriente ?? e.terminales?.['start'] ?? null;
    return e.terminales?.[c.t] ?? null;
  }

  /** V, I, P of an element at the current time. */
  medidas(id: string): { v: number | null; i: number | null; p: number | null; terminales: Record<string, number | null> } {
    const f = this.muestra;
    const e = this.esq.elementos.find((x) => x.id === id);
    const terminales: Record<string, number | null> = {};
    for (const t of Object.keys(e?.terminales ?? {})) terminales[t] = this.corriente({ k: 'term', id, t }, f);
    let v: number | null = null;
    let i: number | null = null;
    let p: number | null = null;
    if (e && e.terminales && 'start' in e.terminales && 'end' in e.terminales && Object.keys(e.terminales).length === 2) {
      const va = this.tension(e.terminales['start']!, f);
      const vb = this.tension(e.terminales['end']!, f);
      if (va != null && vb != null) v = va - vb;
      i = this.corriente({ k: 'elem', id }, f);
    }
    if (e) {
      // Power = Σ V·I over the terminals (positive: absorbed).
      let s = 0;
      let ok = Object.keys(terminales).length > 0;
      for (const [t, it] of Object.entries(terminales)) {
        const vn = this.tension(e.terminales![t]!, f);
        if (it == null || vn == null) {
          ok = false;
          break;
        }
        s += vn * it;
      }
      if (ok) p = s;
      else if (f == null) p = this.op?.elementos[id]?.potencia ?? null;
    }
    return { v, i, p, terminales };
  }

  /** Voltage and current ranges over the operating point and the transient (colour and speed scales). */
  readonly rangos = $derived.by(() => calcularRangos(this.op, this.tran));

  // ---------------------------------------------------------------- hit testing

  /** What is under an SVG point; `radio` is the hit distance in SVG units. */
  buscar(X: number, Y: number, radio: number): Seleccion {
    let mejor: Seleccion = null;
    let d = radio;
    for (const c of this.caminos) {
      if (c.clave.k !== 'tramo') continue;
      const e = distPolilinea(X, Y, c.tr.pts);
      if (e < d) {
        d = e;
        mejor = { k: 'tramo', id: c.clave.id };
      }
    }
    // A part wins when the pointer is on its symbol and no wire is right under it.
    let dEl = Infinity;
    let el: string | null = null;
    for (const g of this.elementos) {
      if (!g.caja || g.e.rol === 'ANOT') continue;
      const e = distRect(X, Y, g.caja[0], g.caja[1], g.caja[2], g.caja[3]);
      const area = (g.caja[2] - g.caja[0]) * (g.caja[3] - g.caja[1]);
      // Smaller symbols first when nested (a ground inside a big op-amp box).
      const peso = e + area * 1e-6;
      if (e < radio && peso < dEl) {
        dEl = peso;
        el = g.e.id;
      }
    }
    if (el && (dEl === 0 || dEl < d) && !(mejor && d < radio * 0.25)) {
      const g = this.elementos.find((x) => x.e.id === el)!;
      if (g.e.rol === 'GND') {
        const n = g.e.terminales?.['start'];
        return n ? { k: 'nodo', id: n } : { k: 'elem', id: el };
      }
      return { k: 'elem', id: el };
    }
    if (mejor) return mejor;
    // Node points (terminals joined without wires).
    for (const p of this.esq.puntos) {
      const q = afin(this.esq.dibujo_a_svg, p.xy);
      const e = Math.hypot(q[0] - X, q[1] - Y);
      if (e < d) {
        d = e;
        mejor = { k: 'nodo', id: p.nodo };
      }
    }
    return mejor;
  }

  nodoDe(s: Seleccion): string | null {
    if (!s) return null;
    if (s.k === 'nodo') return s.id;
    if (s.k === 'tramo') return this.esq.tramos.find((t) => t.id === s.id)?.nodo ?? null;
    return null;
  }
}
