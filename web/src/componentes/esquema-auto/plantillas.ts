// Topologies a textbook always draws the same way, recognised by their structure (never by part names), and
// turned into layout rules for the annealing of colocacion.ts:
//   - H bridge: four switches T–a, T–b, a–B, b–B → the classic H, supply on top, the load across the middle,
//     each freewheeling diode beside its switch.
//   - Buck / boost converters: an inductor with a switch node that has a switch (or diode) to ground and a
//     series switch → switch, diode and inductor on one row in the canonical order, the low-side switch
//     hanging from the switch node, input on the left, output capacitor and load on the right.
//   - Wien-bridge oscillator: an op-amp whose + input has R ∥ C to ground and an R–C in series from the output
//     → RC series above, R ∥ C on the left of the + input, gain resistors on the − input below.
//   - Series regulators: a pass transistor between the input and a load, driven by an op-amp or a Zener
//     → input on the left, the pass element in the series path, drivers and reference below, load on the right;
//     adjustable (LM317-type) regulators: a controlled source fed back from a divider → the divider as a
//     vertical stack between the source and the load.
//   - Logic: three or more gates / flip-flops / bridges → columns by logic depth, and the clock and other
//     nets that fan out to many inputs drawn as net labels.
// Orientations are folded into the variants' costs (and a pass transistor gets the horizontal variants it
// needs); everything else is soft constraints between units (Reglas in colocacion.ts).

import { construirVariante, reglasVacias, type Componente, type PinGeo, type Reglas, type RefRegla, type Unidad } from './colocacion.ts';
import { simboloDe } from './simbolos.ts';

/** Extra cost of an orientation the topology does not want. */
const CASTIGO = 9;

type Pin = [number, number]; // [unit, pin]

class Contexto {
  readonly comp: Componente;
  readonly us: Unidad[];
  /** Pins on each net, by net name (ground is «0»; rails keep their name). */
  readonly porNodo = new Map<string, Pin[]>();

  constructor(comp: Componente) {
    this.comp = comp;
    this.us = comp.unidades;
    for (const u of this.us)
      u.pines.forEach((_, i) => {
        const n = this.nodo(u.id, i);
        if (!this.porNodo.has(n)) this.porNodo.set(n, []);
        this.porNodo.get(n)!.push([u.id, i]);
      });
  }

  nodo(u: number, i: number): string {
    const p = this.us[u]!.pines[i]!;
    return p.tipo === 'tierra' ? '0' : p.nodo;
  }

  sim(u: number): string {
    return this.us[u]!.disp?.simbolo ?? '';
  }

  letra(u: number): string {
    return this.us[u]!.disp?.letra ?? '';
  }

  /** Units with a pin on net `n` (each once), except `sin`. */
  en(n: string, ...sin: number[]): number[] {
    return [...new Set((this.porNodo.get(n) ?? []).map(([u]) => u))].filter((u) => !sin.includes(u));
  }

  /** Index of the pin of unit `u` on net `n` (−1 none). */
  pinEn(u: number, n: string): number {
    return this.us[u]!.pines.findIndex((_, i) => this.nodo(u, i) === n);
  }

  pinLlamado(u: number, nombre: string): number {
    return this.us[u]!.pines.findIndex((p) => p.nombre === nombre);
  }

  /** The two switched pins of a switch, transistor, MOSFET or diode (null for other parts). */
  canal(u: number): [number, number] | null {
    const s = this.sim(u);
    const par = (a: string, b: string): [number, number] | null => {
      const i = this.pinLlamado(u, a);
      const j = this.pinLlamado(u, b);
      return i >= 0 && j >= 0 ? [i, j] : null;
    };
    if (s === 'SW' || s === 'D' || s === 'DZ' || s === 'DS' || s === 'LED') return par('start', 'end');
    if (s === 'NMOS' || s === 'PMOS' || s === 'NJF' || s === 'PJF') return par('drain', 'source');
    if (s === 'NPN' || s === 'PNP') return par('collector', 'emitter');
    return null;
  }

  esConmutador(u: number): boolean {
    return ['SW', 'NMOS', 'PMOS', 'NPN', 'PNP'].includes(this.sim(u));
  }

  esDiodo(u: number): boolean {
    return ['D', 'DZ', 'DS', 'LED'].includes(this.sim(u));
  }

  /** Two-terminal part (R, C, L, sources, diodes, switches, controlled sources). */
  dosPines(u: number): boolean {
    return this.us[u]!.pines.length === 2 && !!this.us[u]!.disp && this.us[u]!.disp!.simbolo !== 'OPAMP';
  }

  /** Nets of the two pins of a two-terminal part. */
  nodos2(u: number): [string, string] {
    return [this.nodo(u, 0), this.nodo(u, 1)];
  }

  otro(u: number, n: string): string {
    const [a, b] = this.nodos2(u);
    return a === n ? b : a;
  }

  esFuente(u: number): boolean {
    const l = this.letra(u);
    return (l === 'V' || l === 'I') && this.dosPines(u);
  }

  /** A 0 V source in series (an ammeter of the netlist). */
  esAmperimetro(u: number): boolean {
    const d = this.us[u]!.disp;
    return !!d && d.letra === 'V' && d.simbolo === 'VDC' && (d.numero ?? 0) === 0 && this.dosPines(u);
  }

  rango(n: string): number {
    const p = this.porNodo.get(n)?.find(([u, i]) => this.us[u]!.pines[i]!.red >= 0);
    if (!p) return -1;
    return this.comp.rango[this.us[p[0]]!.pines[p[1]]!.red]!;
  }

  // ------------------------------------------------------------ orientation
  /** Penalises the variants of `u` that do not satisfy `ok` (only when one does). */
  orientar(u: number, ok: (g: PinGeo[]) => boolean, castigo = CASTIGO): boolean {
    const vs = this.us[u]!.vars;
    if (!vs.some((v) => ok(v.pines))) return false;
    for (const v of vs) if (!ok(v.pines)) v.coste += castigo;
    return true;
  }

  /** Pin `a` straight above pin `b`. */
  vertical(u: number, a: number, b: number, castigo = CASTIGO): boolean {
    return this.orientar(u, (g) => g[a]!.x === g[b]!.x && g[a]!.y < g[b]!.y, castigo);
  }

  /** Pin `a` straight left of pin `b`. */
  horizontal(u: number, a: number, b: number, castigo = CASTIGO): boolean {
    return this.orientar(u, (g) => g[a]!.y === g[b]!.y && g[a]!.x < g[b]!.x, castigo);
  }
}

const R = (u: number, p: RefRegla['p']): RefRegla => ({ u, p });

function orden(r: Reglas, a: RefRegla, b: RefRegla, eje: 0 | 1, min: number, peso = 4): void {
  r.orden.push({ a, b, eje, min, peso });
}

function alin(r: Reglas, a: RefRegla, b: RefRegla, eje: 0 | 1, peso = 3): void {
  r.alin.push({ a, b, eje, peso });
}

// ------------------------------------------------------------------ chains

/**
 * Walks from net `n` through two-terminal parts in series (the nets in between have exactly two pins) while
 * `sigue` accepts the part; returns the parts in order with the pin towards `n` and the far pin.
 */
function serie(cx: Contexto, n: string, excluir: Set<number>, sigue: (u: number) => boolean): { u: number; cerca: number; lejos: number; nodo: string }[] {
  const res: { u: number; cerca: number; lejos: number; nodo: string }[] = [];
  let actual = n;
  for (let k = 0; k < 6; k++) {
    const ps = cx.porNodo.get(actual) ?? [];
    const otros = cx.en(actual).filter((u) => !excluir.has(u) && !res.some((x) => x.u === u));
    // From `n` the one part not excluded; after it, only nets joining exactly two pins.
    if ((k > 0 && ps.length !== 2) || otros.length !== 1) break;
    const u = otros[0]!;
    if (!cx.dosPines(u) || !sigue(u)) break;
    const lejos = cx.otro(u, actual);
    if (lejos === '0' || cx.us[u]!.pines.some((p) => p.tipo === 'riel')) break;
    res.push({ u, cerca: cx.pinEn(u, actual), lejos: cx.pinEn(u, lejos), nodo: lejos });
    actual = lejos;
  }
  return res;
}

/**
 * Parts hanging from net `n` towards ground (a shunt branch: a load, a capacitor with its ESR): every
 * two-terminal part on `n` except `excluir`, followed down through series nets to ground.
 */
function ramasATierra(cx: Contexto, n: string, excluir: Set<number>): { u: number; arriba: number; abajo: number }[][] {
  const ramas: { u: number; arriba: number; abajo: number }[][] = [];
  for (const u0 of cx.en(n)) {
    if (excluir.has(u0) || !cx.dosPines(u0)) continue;
    const rama: { u: number; arriba: number; abajo: number }[] = [];
    let u = u0;
    let actual = n;
    for (let k = 0; k < 4; k++) {
      const lejos = cx.otro(u, actual);
      rama.push({ u, arriba: cx.pinEn(u, actual), abajo: cx.pinEn(u, lejos) });
      if (lejos === '0') break;
      const sig = cx.en(lejos, u).filter((w) => !excluir.has(w));
      if ((cx.porNodo.get(lejos)?.length ?? 0) !== 2 || sig.length !== 1 || !cx.dosPines(sig[0]!)) {
        rama.length = 0;
        break;
      }
      u = sig[0]!;
      actual = lejos;
    }
    if (rama.length && cx.nodo(rama[rama.length - 1]!.u, rama[rama.length - 1]!.abajo) === '0') ramas.push(rama);
  }
  return ramas;
}

// ------------------------------------------------------------------ H bridge

function puenteH(cx: Contexto): Reglas | null {
  const sw = cx.us.map((u) => u.id).filter((u) => cx.esConmutador(u) && cx.canal(u));
  const nets = (u: number): [string, string] => {
    const [i, j] = cx.canal(u)!;
    return [cx.nodo(u, i), cx.nodo(u, j)];
  };
  const toca = (u: number, n: string) => nets(u).includes(n);
  const otroN = (u: number, n: string) => (nets(u)[0] === n ? nets(u)[1] : nets(u)[0]);
  for (const s1 of sw)
    for (const T of nets(s1)) {
      for (const s2 of sw) {
        if (s2 === s1 || !toca(s2, T)) continue;
        const a = otroN(s1, T);
        const b = otroN(s2, T);
        if (a === b || a === T || b === T) continue;
        for (const s3 of sw) {
          if (s3 === s1 || s3 === s2 || !toca(s3, a)) continue;
          const B = otroN(s3, a);
          if (B === T || B === b) continue;
          const s4 = sw.find((s) => s !== s1 && s !== s2 && s !== s3 && toca(s, b) && otroN(s, b) === B);
          if (s4 == null) continue;
          // Ground goes at the bottom.
          if (T === '0') continue;
          const r = reglasH(cx, { s1, s2, s3, s4, T, B, a, b });
          if (r) return r;
        }
      }
    }
  return null;
}

function reglasH(cx: Contexto, h: { s1: number; s2: number; s3: number; s4: number; T: string; B: string; a: string; b: string }): Reglas | null {
  const { s1, s2, s3, s4, T, B, a, b } = h;
  // An H bridge drives a load across the middle (a series chain from a to b); four switches without it
  // (two converters sharing their input, a commutating mixer) are something else.
  const diodosH = cx.us.map((u) => u.id).filter((d) => cx.esDiodo(d));
  const cadena = serie(cx, a, new Set([s1, s2, s3, s4, ...diodosH]), (u) => !cx.esConmutador(u));
  if (!cadena.length || cadena[cadena.length - 1]!.nodo !== b) return null;
  const r = reglasVacias('puente-h');
  const p = (u: number, n: string) => cx.pinEn(u, n);
  cx.vertical(s1, p(s1, T), p(s1, a));
  cx.vertical(s2, p(s2, T), p(s2, b));
  cx.vertical(s3, p(s3, a), p(s3, B));
  cx.vertical(s4, p(s4, b), p(s4, B));
  // Two columns, top and bottom rails level.
  alin(r, R(s1, p(s1, a)), R(s3, p(s3, a)), 0, 4);
  alin(r, R(s2, p(s2, b)), R(s4, p(s4, b)), 0, 4);
  alin(r, R(s1, p(s1, T)), R(s2, p(s2, T)), 1, 3);
  alin(r, R(s3, p(s3, B)), R(s4, p(s4, B)), 1, 3);
  orden(r, R(s1, p(s1, a)), R(s3, p(s3, a)), 1, 0, 4);
  orden(r, R(s2, p(s2, b)), R(s4, p(s4, b)), 1, 0, 4);
  orden(r, R(s1, p(s1, a)), R(s2, p(s2, b)), 0, 6, 5);
  // Compact: the lower switches not far below the upper ones (the load row goes in between).
  orden(r, R(s3, p(s3, a)), R(s1, p(s1, a)), 1, -5, 3);
  orden(r, R(s4, p(s4, b)), R(s2, p(s2, b)), 1, -5, 3);
  const usados = new Set([s1, s2, s3, s4]);
  // Freewheeling diodes: beside their switch, on the outer side, cathode towards the upper net.
  const pares: [number, string, string, -1 | 1][] = [
    [s1, T, a, -1],
    [s3, a, B, -1],
    [s2, T, b, 1],
    [s4, b, B, 1],
  ];
  for (const [s, arriba, abajo, lado] of pares) {
    for (const d of cx.us.map((u) => u.id)) {
      if (!cx.esDiodo(d) || usados.has(d)) continue;
      const [n1, n2] = cx.nodos2(d);
      if (!((n1 === arriba && n2 === abajo) || (n1 === abajo && n2 === arriba))) continue;
      usados.add(d);
      cx.vertical(d, p(d, arriba), p(d, abajo));
      if (lado < 0) orden(r, R(d, 'c'), R(s, 'c'), 0, 1.5, 3);
      else orden(r, R(s, 'c'), R(d, 'c'), 0, 1.5, 3);
      alin(r, R(d, 'c'), R(s, 'c'), 1, 2);
    }
  }
  // The load: the series chain from a to b, across the middle, left to right.
  {
    cadena.forEach((c, i) => {
      usados.add(c.u);
      cx.horizontal(c.u, c.cerca, c.lejos, 14);
      if (i) {
        orden(r, R(cadena[i - 1]!.u, 'c'), R(c.u, 'c'), 0, 1.5, 4);
        alin(r, R(cadena[i - 1]!.u, cadena[i - 1]!.lejos), R(c.u, c.cerca), 1, 6);
      }
      orden(r, R(s1, p(s1, a)), R(c.u, 'x0'), 0, 0.8, 4);
      orden(r, R(c.u, 'x1'), R(s2, p(s2, b)), 0, 0.8, 4);
      orden(r, R(s1, p(s1, a)), R(c.u, c.cerca), 1, 1, 4);
      orden(r, R(c.u, c.cerca), R(s3, p(s3, a)), 1, 1, 4);
    });
  }
  // Supply: a series part (an ammeter) feeding the top rail from the left, the sources further left.
  const feed = serie(cx, T, usados, (u) => !cx.esConmutador(u));
  let izq: RefRegla = R(s1, 'c');
  for (const f of feed) {
    usados.add(f.u);
    cx.horizontal(f.u, f.lejos, f.cerca);
    orden(r, R(f.u, f.cerca), izq, 0, 0, 4);
    alin(r, R(f.u, f.cerca), R(s1, p(s1, T)), 1, 3);
    izq = R(f.u, 'c');
  }
  for (const u of cx.us.map((x) => x.id)) {
    if (usados.has(u) || !cx.esFuente(u) || !cx.nodos2(u).includes('0')) continue;
    orden(r, R(u, 'c'), izq, 0, 2, 3);
  }
  // The start: the H drawn on the grid (upper switches T at y 0 → a, b at 2; the load row at 4; lower switches
  // a, b at 6), the load chain across, the diodes outside, the feed on the top rail to the left.
  const anclas: NonNullable<Reglas['anclas']> = [];
  const xL = 0;
  const xR = xL + 3 + 4 * cadena.length;
  anclas.push({ u: s1, pin: p(s1, T), x: xL, y: 0 }, { u: s3, pin: p(s3, a), x: xL, y: 6 });
  anclas.push({ u: s2, pin: p(s2, T), x: xR, y: 0 }, { u: s4, pin: p(s4, b), x: xR, y: 6 });
  cadena.forEach((c, i) => anclas.push({ u: c.u, pin: c.cerca, x: xL + 2 + 4 * i, y: 4 }));
  for (const [s, arriba, , lado] of pares)
    for (const d of cx.us.map((u) => u.id)) {
      if (!cx.esDiodo(d)) continue;
      const pa = p(d, arriba);
      if (pa < 0 || !cx.canal(d) || !nets2(cx, d).includes(arriba) || r.orden.every((o) => o.a.u !== d && o.b.u !== d)) continue;
      if (!(r.orden.some((o) => (o.a.u === d && o.b.u === s) || (o.b.u === d && o.a.u === s)))) continue;
      const top = s === s1 || s === s2 ? 0 : 6;
      anclas.push({ u: d, pin: pa, x: lado < 0 ? xL - 2 : xR + 2, y: top });
    }
  let xf = xL - 4;
  for (const f of feed) {
    anclas.push({ u: f.u, pin: f.cerca, x: xf, y: 0 });
    xf -= 4;
  }
  r.anclas = anclas;
  return r;
}

function nets2(cx: Contexto, u: number): string[] {
  return cx.us[u]!.pines.map((_, i) => cx.nodo(u, i));
}

// ------------------------------------------------------------------ buck / boost

function convertidores(cx: Contexto): Reglas | null {
  let r: Reglas | null = null;
  const vistos = new Set<number>();
  for (const L of cx.us.map((u) => u.id)) {
    if (cx.sim(L) !== 'L' || !cx.dosPines(L)) continue;
    const [n0, n1] = cx.nodos2(L);
    if (n0 === '0' || n1 === '0') continue;
    for (const [sw, otra] of [
      [n0, n1],
      [n1, n0],
    ] as const) {
      const enSw = cx.en(sw, L).filter((u) => cx.dosPines(u) && !vistos.has(u));
      // Low side: a switch or diode from the switch node to ground, maybe with an ammeter in series.
      let bajos: number[] = [];
      for (const u0 of enSw) {
        const cadena: number[] = [];
        let u = u0;
        let n: string = sw;
        for (let k = 0; k < 3; k++) {
          if (!(cx.canal(u) && cx.esConmutador(u)) && !cx.esDiodo(u) && !cx.esAmperimetro(u)) break;
          cadena.push(u);
          n = cx.otro(u, n);
          if (n === '0' || (cx.porNodo.get(n)?.length ?? 0) !== 2) break;
          u = cx.en(n, u)[0]!;
        }
        if (n === '0' && cadena.some((w) => !cx.esAmperimetro(w))) {
          bajos = cadena;
          break;
        }
      }
      if (!bajos.length) continue;
      const serieSw = enSw.find((u) => !bajos.includes(u) && cx.canal(u) && cx.otro(u, sw) !== '0' && cx.otro(u, sw) !== otra);
      if (serieSw == null) continue;
      const X = cx.otro(serieSw, sw);
      // Buck when the series switch comes from the input (a voltage source to ground) and the inductor goes
      // on to the output; boost the other way round; when unclear, the one nearer the sources is the input.
      const entradaX = esEntradaV(cx, X);
      const entradaOtra = esEntradaV(cx, otra) || serie(cx, otra, new Set([L]), (u) => cx.esAmperimetro(u) || cx.letra(u) === 'R').some((x) => esEntradaV(cx, x.nodo));
      const buck = entradaX !== entradaOtra ? entradaX : cx.rango(X) >= 0 && cx.rango(otra) >= 0 ? cx.rango(X) < cx.rango(otra) : true;
      r ??= reglasVacias('convertidor');
      vistos.add(L).add(serieSw);
      for (const b of bajos) vistos.add(b);
      reglasConvertidor(cx, r, { L, sw, bajos, serieSw, X, otra, buck });
      break;
    }
  }
  return r;
}

/** A net fed by a voltage source to ground (not an ammeter) or a positive rail: an input. */
function esEntradaV(cx: Contexto, n: string): boolean {
  if (n === '0') return false;
  if ((cx.porNodo.get(n) ?? []).some(([u, i]) => cx.us[u]!.pines[i]!.tipo === 'riel' && (cx.us[u]!.pines[i]!.riel?.signo ?? 1) > 0)) return true;
  return cx.en(n).some((u) => cx.letra(u) === 'V' && cx.dosPines(u) && !cx.esAmperimetro(u) && cx.otro(u, n) === '0');
}

function reglasConvertidor(
  cx: Contexto,
  r: Reglas,
  c: { L: number; sw: string; bajos: number[]; serieSw: number; X: string; otra: string; buck: boolean },
): void {
  const { L, sw, bajos, serieSw: S, X, otra, buck } = c;
  const bajo = bajos[0]!;
  const p = (u: number, n: string) => cx.pinEn(u, n);
  // Row: [input] — first — sw — second — [output]; buck: switch then inductor; boost: inductor then switch.
  const [primero, segundo] = buck ? [S, L] : [L, S];
  const entrada = buck ? X : otra;
  const salida = buck ? otra : X;
  cx.horizontal(primero, p(primero, entrada), p(primero, sw));
  cx.horizontal(segundo, p(segundo, sw), p(segundo, salida));
  alin(r, R(primero, p(primero, entrada)), R(segundo, p(segundo, salida)), 1, 4);
  orden(r, R(primero, 'c'), R(segundo, 'c'), 0, 2, 4);
  // Low side hanging from the switch node, between the two (with its ammeter, if any, in the same column).
  let n = sw;
  bajos.forEach((u, i) => {
    const m = cx.otro(u, n);
    cx.vertical(u, p(u, n), p(u, m), i ? 4 : CASTIGO);
    if (i) alin(r, R(bajos[i - 1]!, p(bajos[i - 1]!, n)), R(u, p(u, n)), 0, 3);
    n = m;
  });
  orden(r, R(primero, p(primero, sw)), R(bajo, p(bajo, sw)), 0, 0, 4);
  orden(r, R(bajo, p(bajo, sw)), R(segundo, p(segundo, sw)), 0, 0, 4);
  orden(r, R(primero, p(primero, sw)), R(bajo, 'c'), 1, 1, 4);
  alin(r, R(primero, p(primero, sw)), R(bajo, p(bajo, sw)), 1, 3);
  const usados = new Set([L, S, ...bajos]);
  // Output side: series parts continue the row; shunts hang below it, right of the second part.
  let fin = salida;
  let ultimo: RefRegla = R(segundo, p(segundo, salida));
  for (const s of serie(cx, salida, usados, (u) => !cx.esFuente(u) || cx.esAmperimetro(u))) {
    // Only a pure series part (an ammeter, a sense resistor) whose far net has shunts goes on the row.
    if (!ramasATierra(cx, s.nodo, new Set([...usados, s.u])).length) break;
    usados.add(s.u);
    cx.horizontal(s.u, s.cerca, s.lejos);
    alin(r, ultimo, R(s.u, s.cerca), 1, 3);
    orden(r, ultimo, R(s.u, 'c'), 0, 0.5, 3);
    ultimo = R(s.u, s.lejos);
    fin = s.nodo;
  }
  const condensadores: number[] = [];
  const cargas: number[] = [];
  for (const n of new Set([salida, fin]))
    for (const rama of ramasATierra(cx, n, usados)) {
      rama.forEach((x, i) => {
        usados.add(x.u);
        if (!cx.esFuente(x.u) || cx.letra(x.u) === 'I') cx.vertical(x.u, x.arriba, x.abajo, 6);
        orden(r, R(segundo, p(segundo, sw)), R(x.u, 'c'), 0, 1.5, 3);
        orden(r, R(segundo, p(segundo, salida)), R(x.u, 'c'), 1, 0.5, 3);
        if (i) alin(r, R(rama[i - 1]!.u, rama[i - 1]!.abajo), R(x.u, x.arriba), 0, 3);
        else alin(r, ultimo, R(x.u, x.arriba), 1, 1.5);
      });
      // The output capacitor (with its ESR) first, the load at the far right.
      if (rama.some((x) => cx.letra(x.u) === 'C')) condensadores.push(rama[0]!.u);
      else if (rama.length === 1 && ['R', 'I'].includes(cx.letra(rama[0]!.u))) cargas.push(rama[0]!.u);
    }
  for (const c of condensadores) for (const l of cargas) orden(r, R(c, 'c'), R(l, 'c'), 0, 1.5, 4);
  // Input side: series parts (an ammeter) continue the row to the left; the sources further left.
  let izq: RefRegla = R(primero, p(primero, entrada));
  let ini = entrada;
  for (const s of serie(cx, entrada, usados, (u) => cx.esAmperimetro(u) || cx.letra(u) === 'R' || cx.sim(u) === 'L')) {
    usados.add(s.u);
    cx.horizontal(s.u, s.lejos, s.cerca);
    alin(r, izq, R(s.u, s.cerca), 1, 3);
    orden(r, R(s.u, 'c'), izq, 0, 0.5, 3);
    izq = R(s.u, s.lejos);
    ini = s.nodo;
  }
  for (const m of new Set([entrada, ini]))
    for (const u of cx.en(m)) {
      if (usados.has(u)) continue;
      // Whatever feeds the input (a transformer's secondary, a rectifier) is on the left too.
      if (!cx.dosPines(u)) {
        usados.add(u);
        orden(r, R(u, 'x1'), izq, 0, 0.5, 3);
        alin(r, R(u, cx.pinEn(u, m)), izq, 1, 2);
        continue;
      }
      if (cx.otro(u, m) !== '0') continue;
      usados.add(u);
      // Sources on the left; input capacitors hang from the input wire.
      if (cx.esFuente(u)) orden(r, R(u, 'c'), izq, 0, 1, 3);
      else {
        cx.vertical(u, p(u, m), p(u, '0'), 6);
        orden(r, R(u, 'c'), R(primero, 'c'), 0, 1, 3);
      }
    }
}

// ------------------------------------------------------------------ Wien bridge

function wien(cx: Contexto): Reglas | null {
  for (const oa of cx.us.map((u) => u.id)) {
    if (cx.sim(oa) !== 'OPAMP') continue;
    const iMas = cx.pinLlamado(oa, 'in2');
    const iMenos = cx.pinLlamado(oa, 'in1');
    const iOut = cx.pinLlamado(oa, 'out');
    if (iMas < 0 || iMenos < 0 || iOut < 0) continue;
    const P = cx.nodo(oa, iMas);
    const N = cx.nodo(oa, iMenos);
    if (P === '0' || N === '0') continue;
    const aTierra = cx.en(P, oa).filter((u) => cx.dosPines(u) && cx.otro(u, P) === '0');
    const rp = aTierra.find((u) => cx.letra(u) === 'R');
    const cp = aTierra.find((u) => cx.letra(u) === 'C');
    if (rp == null || cp == null) continue;
    // Series R–C from the + input to the output side.
    const s1 = cx.en(P, oa).find((u) => cx.dosPines(u) && (cx.letra(u) === 'R' || cx.letra(u) === 'C') && cx.otro(u, P) !== '0');
    if (s1 == null) continue;
    const x = cx.otro(s1, P);
    if ((cx.porNodo.get(x)?.length ?? 0) !== 2) continue;
    const s2 = cx.en(x, s1)[0];
    if (s2 == null || !cx.dosPines(s2) || !['R', 'C'].includes(cx.letra(s2)) || cx.letra(s2) === cx.letra(s1)) continue;
    const Q = cx.otro(s2, x);
    if (Q === '0' || Q === P) continue;
    return reglasWien(cx, { oa, iMas, iMenos, iOut, P, N, rp, cp, s1, s2, x, Q });
  }
  return null;
}

function reglasWien(
  cx: Contexto,
  w: { oa: number; iMas: number; iMenos: number; iOut: number; P: string; N: string; rp: number; cp: number; s1: number; s2: number; x: string; Q: string },
): Reglas {
  const r = reglasVacias('wien');
  const { oa, iMas, iMenos, iOut, P, N, rp, cp, s1, s2, x, Q } = w;
  const p = (u: number, n: string) => cx.pinEn(u, n);
  // + input on top (the Wien network comes from above), − below (the gain network).
  cx.orientar(oa, (g) => g[iMas]!.y < g[iMenos]!.y);
  // R ∥ C to ground on the left of the + input, upright.
  for (const u of [rp, cp]) {
    cx.vertical(u, p(u, P), p(u, '0'));
    orden(r, R(u, 'c'), R(oa, iMas), 0, 1, 4);
    orden(r, R(u, p(u, P)), R(oa, iMas), 1, -0.5, 2);
  }
  orden(r, R(cp, 'c'), R(rp, 'c'), 0, 1.5, 2);
  // Series R–C above the op-amp, from the + side (left) to the output side (right).
  cx.horizontal(s1, p(s1, P), p(s1, x));
  cx.horizontal(s2, p(s2, x), p(s2, Q));
  alin(r, R(s1, p(s1, x)), R(s2, p(s2, x)), 1, 3);
  orden(r, R(s1, 'c'), R(oa, 'y0'), 1, 1, 4);
  orden(r, R(oa, iOut), R(s2, p(s2, Q)), 0, -1, 3);
  // Units of the − side (gain network): below the − input.
  const usados = new Set([oa, rp, cp, s1, s2]);
  const lado = new Set<number>();
  const pila = [N];
  const vistos = new Set([N, Q, '0', P]);
  while (pila.length) {
    const n = pila.pop()!;
    for (const u of cx.en(n)) {
      if (usados.has(u) || lado.has(u)) continue;
      lado.add(u);
      for (let i = 0; i < cx.us[u]!.pines.length; i++) {
        const m = cx.nodo(u, i);
        if (!vistos.has(m)) {
          vistos.add(m);
          pila.push(m);
        }
      }
    }
  }
  // The gain path from the − input to the output: one row below the op-amp, left to right; the rest of the
  // gain network (a diode limiter) under that row; the resistor to ground upright on the left.
  const camino = caminoEntre(cx, N, Q, lado);
  for (const u of lado) {
    usados.add(u);
    orden(r, R(oa, iMenos), R(u, 'c'), 1, 1, 4);
    if (cx.dosPines(u) && cx.nodos2(u).includes('0')) {
      cx.vertical(u, p(u, cx.otro(u, '0')), p(u, '0'));
      orden(r, R(u, 'c'), R(oa, iMenos), 0, 0.5, 3);
    } else if (cx.dosPines(u)) cx.orientar(u, (g) => g[0]!.y === g[1]!.y, 5);
  }
  camino.forEach((c, i) => {
    cx.horizontal(c.u, c.cerca, c.lejos, 6);
    if (i) {
      alin(r, R(camino[i - 1]!.u, camino[i - 1]!.lejos), R(c.u, c.cerca), 1, 3);
      orden(r, R(camino[i - 1]!.u, 'c'), R(c.u, 'c'), 0, 1.5, 3);
    }
  });
  if (camino.length)
    for (const u of lado) {
      if (camino.some((c) => c.u === u) || (cx.dosPines(u) && cx.nodos2(u).includes('0'))) continue;
      orden(r, R(camino[0]!.u, camino[0]!.cerca), R(u, 'c'), 1, 1, 3);
    }
  // Everything after the op-amp's output (its output stage, the output node's other parts): on the right,
  // the output node's own parts last (the output column, where the feedback loops start).
  const enQ: number[] = [];
  const etapa: number[] = [];
  for (const u of cx.us.map((v) => v.id)) {
    if (usados.has(u)) continue;
    const toca = cx.us[u]!.pines.some((_, i) => [cx.nodo(oa, iOut), Q].includes(cx.nodo(u, i)));
    if (!toca && !cx.us[u]!.pines.some((_, i) => !['0', P, N, x].includes(cx.nodo(u, i)))) continue;
    orden(r, R(oa, iOut), R(u, 'c'), 0, 0.5, 3);
    if (cx.us[u]!.pines.some((_, i) => cx.nodo(u, i) === Q)) enQ.push(u);
    else etapa.push(u);
  }
  if (Q !== cx.nodo(oa, iOut)) for (const a of etapa) for (const b of enQ) orden(r, R(a, 'c'), R(b, 'c'), 0, 1.5, 3);
  // The output node's own parts beyond the Wien network's end: the output column is their left edge.
  for (const b of enQ) orden(r, R(s2, p(s2, Q)), R(b, 'x0'), 0, 0.5, 3);
  // The output stage (a macro-model's pole, a limiter) continues the output to the right, at its level.
  let ant: RefRegla = R(oa, iOut);
  for (const c of serie(cx, cx.nodo(oa, iOut), new Set([oa]), (u) => etapa.includes(u))) {
    cx.horizontal(c.u, c.cerca, c.lejos, 6);
    alin(r, ant, R(c.u, c.cerca), 1, 3);
    for (const rama of ramasATierra(cx, c.nodo, new Set([c.u])))
      if (rama.length === 1 && etapa.includes(rama[0]!.u)) {
        cx.vertical(rama[0]!.u, rama[0]!.arriba, rama[0]!.abajo, 6);
        alin(r, R(c.u, c.lejos), R(rama[0]!.u, rama[0]!.arriba), 1, 2);
      }
    ant = R(c.u, c.lejos);
  }
  return r;
}

/** Shortest chain of two-terminal parts of `dentro` from net `a` to net `b` (not through ground). */
function caminoEntre(cx: Contexto, a: string, b: string, dentro: Set<number>): { u: number; cerca: number; lejos: number }[] {
  const previo = new Map<string, { u: number; de: string }>();
  const cola = [a];
  const visto = new Set([a]);
  while (cola.length) {
    const n = cola.shift()!;
    if (n === b) break;
    for (const u of cx.en(n)) {
      if (!dentro.has(u) || !cx.dosPines(u)) continue;
      const m = cx.otro(u, n);
      if (m === '0' || visto.has(m)) continue;
      visto.add(m);
      previo.set(m, { u, de: n });
      cola.push(m);
    }
  }
  if (!previo.has(b)) return [];
  const res: { u: number; cerca: number; lejos: number }[] = [];
  for (let n = b; n !== a; ) {
    const { u, de } = previo.get(n)!;
    res.unshift({ u, cerca: cx.pinEn(u, de), lejos: cx.pinEn(u, n) });
    n = de;
  }
  return res;
}

// ------------------------------------------------------------------ regulators

const PASO_VARIANTES: Record<string, [number, number][]> = {
  // [orientation, cost]: input pin left, output pin right, control pin below (then above).
  NPN: [
    [3, 0.5],
    [5, 1.5],
  ],
  NMOS: [
    [3, 0.5],
    [5, 1.5],
  ],
  PNP: [
    [7, 0.5],
    [1, 1.5],
  ],
  PMOS: [
    [7, 0.5],
    [1, 1.5],
  ],
};

function reguladores(cx: Contexto): Reglas | null {
  // A DC reference: a Zener, or an op-amp with a DC source (or a Zener) on one of its inputs.
  const conReferencia =
    cx.us.some((u) => cx.sim(u.id) === 'DZ') ||
    cx.us.some(
      (u) =>
        cx.sim(u.id) === 'OPAMP' &&
        ['in1', 'in2'].some((nm) => {
          const i = cx.pinLlamado(u.id, nm);
          return i >= 0 && cx.en(cx.nodo(u.id, i)).some((w) => (cx.sim(w) === 'VDC' && cx.dosPines(w) && cx.nodos2(w).includes('0')) || cx.sim(w) === 'DZ');
        }),
    );
  let r: Reglas | null = null;
  if (conReferencia) {
    const esEntrada = (n: string): boolean => {
      if (n === '0') return false;
      const ps = cx.porNodo.get(n) ?? [];
      if (ps.some(([u, i]) => cx.us[u]!.pines[i]!.tipo === 'riel' && (cx.us[u]!.pines[i]!.riel?.signo ?? 1) > 0)) return true;
      if (cx.en(n).some((u) => cx.esFuente(u) && cx.letra(u) === 'V' && cx.otro(u, n) === '0')) return true;
      if (/^(in|vin|ent|vi)\w*$/.test(n) && cx.comp.unidades.some((u) => u.puerto === n)) return true;
      // Through an ammeter.
      return cx.en(n).some((u) => cx.esAmperimetro(u) && cx.en(cx.otro(u, n), u).some((w) => cx.esFuente(w) && cx.otro(w, cx.otro(u, n)) === '0'));
    };
    const candidatos: { q: number; ent: number; sal: number; ctl: number }[] = [];
    for (const q of cx.us.map((u) => u.id)) {
      const s = cx.sim(q);
      if (!PASO_VARIANTES[s]) continue;
      const pnp = s === 'PNP' || s === 'PMOS';
      const bjt = s === 'NPN' || s === 'PNP';
      const c = cx.pinLlamado(q, bjt ? 'collector' : 'drain');
      const e = cx.pinLlamado(q, bjt ? 'emitter' : 'source');
      const b = cx.pinLlamado(q, bjt ? 'base' : 'gate');
      if (c < 0 || e < 0 || b < 0) continue;
      const [ent, sal] = pnp ? [e, c] : [c, e];
      const nSal = cx.nodo(q, sal);
      if (!esEntrada(cx.nodo(q, ent)) || nSal === '0' || cx.us[q]!.pines[sal]!.tipo === 'riel') continue;
      if (cx.nodo(q, b) === '0') continue;
      // A complementary output stage (class B) shares its output with another transistor: not a regulator.
      if (cx.en(nSal, q).some((w) => (PASO_VARIANTES[cx.sim(w)] ?? null) && cx.canal(w)?.some((i) => cx.nodo(w, i) === nSal))) continue;
      candidatos.push({ q, ent, sal, ctl: b });
    }
    // The pass element is the last of a Darlington: its output is nobody's control.
    const paso = candidatos.filter((c) => !candidatos.some((d) => d !== c && cx.nodo(d.q, d.ctl) === cx.nodo(c.q, c.sal)));
    for (const c of paso) {
      // A load to ground on the output (or after one series resistor).
      const nSal = cx.nodo(c.q, c.sal);
      const hayCarga = (n: string) => cx.en(n, c.q).some((u) => cx.dosPines(u) && cx.otro(u, n) === '0' && ['R', 'I', 'C'].includes(cx.letra(u)));
      const rs = cx.en(nSal, c.q).find((u) => cx.dosPines(u) && cx.letra(u) === 'R' && cx.otro(u, nSal) !== '0' && hayCarga(cx.otro(u, nSal)));
      if (!hayCarga(nSal) && rs == null) continue;
      r ??= reglasVacias('regulador');
      reglasPaso(cx, r, c, rs ?? null, candidatos);
    }
  }
  const aj = ajustables(cx);
  if (aj) {
    if (!r) return aj;
    r.familias.push(...aj.familias);
    r.orden.push(...aj.orden);
    r.alin.push(...aj.alin);
  }
  return r;
}

/** Gives a transistor the variants with its switched pins horizontal (it lies in a series path). */
function variantesHorizontales(cx: Contexto, q: number): void {
  const u = cx.us[q]!;
  const d = u.disp!;
  for (const [o, coste] of PASO_VARIANTES[d.simbolo] ?? []) {
    if (u.vars.some((v) => v.o === o)) continue;
    u.vars.push(construirVariante(u, simboloDe(d, 0), o, coste));
  }
}

function reglasPaso(
  cx: Contexto,
  r: Reglas,
  c: { q: number; ent: number; sal: number; ctl: number },
  rs: number | null,
  candidatos: { q: number; ent: number; sal: number; ctl: number }[],
): void {
  const { q } = c;
  // The pass element lies in the series path, input on the left, its control pin below.
  variantesHorizontales(cx, q);
  cx.horizontal(q, c.ent, c.sal, 12);
  cx.orientar(q, (g) => g[c.ctl]!.y > g[c.ent]!.y, 3);
  const nEnt = cx.nodo(q, c.ent);
  const nSal = cx.nodo(q, c.sal);
  const fila = R(q, c.sal);
  const usados = new Set([q]);
  // Input side: an ammeter on the row, the source on the left.
  let izq: RefRegla = R(q, c.ent);
  let ini = nEnt;
  for (const s of serie(cx, nEnt, usados, (w) => cx.esAmperimetro(w))) {
    usados.add(s.u);
    cx.horizontal(s.u, s.lejos, s.cerca);
    alin(r, izq, R(s.u, s.cerca), 1, 3);
    izq = R(s.u, s.lejos);
    ini = s.nodo;
  }
  for (const n of new Set([nEnt, ini]))
    for (const w of cx.en(n)) {
      if (usados.has(w) || !cx.esFuente(w) || cx.otro(w, n) !== '0') continue;
      usados.add(w);
      orden(r, R(w, 'c'), izq, 0, 1, 4);
    }
  // Output side: the sense resistor on the row, the loads on the right.
  let der: RefRegla = R(q, c.sal);
  let nCarga = nSal;
  if (rs != null) {
    usados.add(rs);
    const lejos = cx.otro(rs, nSal);
    cx.horizontal(rs, cx.pinEn(rs, nSal), cx.pinEn(rs, lejos));
    alin(r, der, R(rs, cx.pinEn(rs, nSal)), 1, 3);
    orden(r, der, R(rs, 'c'), 0, 0.5, 3);
    der = R(rs, cx.pinEn(rs, lejos));
    nCarga = lejos;
  }
  for (const w of cx.en(nCarga)) {
    if (usados.has(w) || !cx.dosPines(w) || cx.otro(w, nCarga) !== '0' || !['R', 'I', 'C'].includes(cx.letra(w))) continue;
    usados.add(w);
    cx.vertical(w, cx.pinEn(w, nCarga), cx.pinEn(w, '0'), 4);
    orden(r, der, R(w, 'c'), 0, 0.5, 4);
    alin(r, fila, R(w, cx.pinEn(w, nCarga)), 1, 2);
  }
  // A Darlington driver: also horizontal, below and left of the pass element, its output up to the control.
  const nCtl = cx.nodo(q, c.ctl);
  for (const d of candidatos) {
    if (d.q === q || cx.nodo(d.q, d.sal) !== nCtl) continue;
    variantesHorizontales(cx, d.q);
    cx.horizontal(d.q, d.ent, d.sal, 6);
    cx.orientar(d.q, (g) => g[d.ctl]!.y > g[d.ent]!.y, 2);
    orden(r, R(d.q, d.sal), R(q, c.ctl), 0, 0, 3);
  }
  // A current-limit transistor across the sense resistor (base on one end, emitter on the other): under
  // the resistor, collector to the left, base up.
  if (rs != null) {
    for (const t of cx.us.map((v) => v.id)) {
      if (t === q || !PASO_VARIANTES[cx.sim(t)] || !['NPN', 'PNP'].includes(cx.sim(t))) continue;
      const b = cx.pinLlamado(t, 'base');
      const e = cx.pinLlamado(t, 'emitter');
      const k = cx.pinLlamado(t, 'collector');
      if (b < 0 || e < 0 || k < 0 || cx.nodo(t, b) !== nSal || cx.nodo(t, e) !== nCarga) continue;
      variantesHorizontales(cx, t);
      cx.orientar(t, (g) => g[k]!.y === g[e]!.y && g[k]!.x < g[e]!.x && g[b]!.y < g[k]!.y, 6);
      orden(r, R(rs, 'c'), R(t, 'c'), 1, 1.5, 3);
      alin(r, R(t, b), R(rs, cx.pinEn(rs, nSal)), 0, 2);
    }
  }
  // Everything else (error amplifier, reference, Zener, driver, current limit): below the series path.
  for (const w of cx.us.map((v) => v.id)) {
    if (usados.has(w) || cx.us[w]!.puerto) continue;
    orden(r, fila, R(w, 'y0'), 1, 0.6, 3);
    if (cx.sim(w) === 'OPAMP') {
      const o = cx.pinLlamado(w, 'out');
      if (o >= 0 && cx.nodo(w, o) === nCtl) {
        orden(r, R(w, o), R(q, c.ctl), 0, 0, 3);
        // The fed-back input (from the output side) below, so its wire runs under the amplifier.
        const salida = new Set([nSal, nCarga]);
        const i1 = cx.pinLlamado(w, 'in1');
        const i2 = cx.pinLlamado(w, 'in2');
        const fb = [i1, i2].find((i) => i >= 0 && salida.has(cx.nodo(w, i)));
        const ref = [i1, i2].find((i) => i >= 0 && i !== fb);
        if (fb != null && ref != null) cx.orientar(w, (g) => g[fb]!.y > g[ref]!.y, 3);
      }
    }
  }
}

/** Adjustable regulators: a controlled source fed back from the middle of a resistive divider. */
function ajustables(cx: Contexto): Reglas | null {
  let r: Reglas | null = null;
  for (const ra of cx.us.map((u) => u.id)) {
    if (cx.letra(ra) !== 'R' || !cx.dosPines(ra)) continue;
    for (const adj of cx.nodos2(ra)) {
      const X = cx.otro(ra, adj);
      if (adj === '0' || X === '0') continue;
      const rb = cx.en(adj, ra).find((u) => cx.letra(u) === 'R' && cx.dosPines(u) && cx.otro(u, adj) === '0');
      if (rb == null) continue;
      if (cx.en(adj).some((u) => !cx.dosPines(u))) continue;
      // A controlled source driven by v(adj…).
      // A controlled source whose expression is v(adj) plus a constant (only that node, not truncated).
      const fuente = cx.us.find(
        (u) =>
          u.disp &&
          u.disp.simbolo === 'DEPV' &&
          !u.disp.valor.includes('…') &&
          (u.disp.valor.match(/v\(/gi) ?? []).length === 1 &&
          new RegExp(`v\\(${adj.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s*,\\s*0)?\\)`, 'i').test(u.disp.valor),
      );
      if (!fuente) continue;
      r ??= reglasVacias('ajustable');
      const p = (u: number, n: string) => cx.pinEn(u, n);
      cx.vertical(ra, p(ra, X), p(ra, adj));
      cx.vertical(rb, p(rb, adj), p(rb, '0'));
      alin(r, R(ra, p(ra, adj)), R(rb, p(rb, adj)), 0, 4);
      const usados = new Set([ra, rb]);
      // The adjust current source beside the lower resistor.
      for (const u of cx.en(adj, ra, rb)) {
        usados.add(u);
        orden(r, R(rb, 'c'), R(u, 'c'), 0, 1.5, 3);
      }
      // Series parts between the source and the divider (a reference source in series) on the top row.
      let izq: RefRegla = R(ra, p(ra, X));
      let ini = X;
      for (const s of serie(cx, X, new Set([...usados, ...cx.en(X).filter((u) => cx.dosPines(u) && cx.otro(u, X) === '0')]), (u) => cx.letra(u) === 'V' || cx.letra(u) === 'R')) {
        usados.add(s.u);
        cx.horizontal(s.u, s.lejos, s.cerca);
        alin(r, izq, R(s.u, s.cerca), 1, 3);
        orden(r, R(s.u, 'c'), izq, 0, 0.5, 3);
        izq = R(s.u, s.lejos);
        ini = s.nodo;
      }
      // The regulating source on the left; loads to ground on the right.
      const src = fuente.id;
      usados.add(src);
      orden(r, R(src, 'c'), izq, 0, 1, 4);
      for (const u of cx.en(X)) {
        if (usados.has(u) || !cx.dosPines(u) || cx.otro(u, X) !== '0') continue;
        usados.add(u);
        cx.vertical(u, p(u, X), p(u, '0'), 4);
        orden(r, R(ra, 'c'), R(u, 'c'), 0, 1.5, 3);
      }
      void ini;
      break;
    }
  }
  return r;
}

// ------------------------------------------------------------------ logic

function logica(cx: Contexto): Reglas | null {
  const us = cx.us;
  const esLogica = (u: Unidad) => !!u.disp && (u.disp.simbolo === 'PUERTA' || u.disp.simbolo === 'CAJA') && u.pines.length >= 2;
  const logicas = us.filter(esLogica);
  // Small circuits (a few gates) are drawn well by the general placement; counters, decoders and the like
  // (six or more blocks besides the XSPICE bridges) get columns by logic depth.
  const puentes = (u: Unidad) => /^(adc|dac)$/i.test(u.disp?.titulo ?? '');
  if (logicas.filter((u) => !puentes(u)).length < 6 || !logicas.some((u) => u.disp!.simbolo === 'PUERTA')) return null;
  // Inputs: pins on the left (or top/bottom) of the box; outputs: on the right.
  const sale = (u: Unidad, i: number) => (esLogica(u) ? u.vars[0]!.pines[i]!.dx > 0 : cx.esFuente(u.id) && cx.otro(u.id, '0') === cx.nodo(u.id, i));
  const entradasDe = new Map<string, number>();
  for (const u of logicas) u.pines.forEach((p, i) => p.red >= 0 && !sale(u, i) && entradasDe.set(cx.nodo(u.id, i), (entradasDe.get(cx.nodo(u.id, i)) ?? 0) + 1));
  const conductor = new Map<string, number>();
  for (const u of us) u.pines.forEach((p, i) => p.red >= 0 && sale(u, i) && !conductor.has(cx.nodo(u.id, i)) && conductor.set(cx.nodo(u.id, i), u.id));
  // Nets fanning out to many inputs straight from the sources (clock, enable), maybe through an input
  // bridge: no logic depth, drawn as labels. (A counter's output feeding many gates is logic, not global.)
  const primario = (n: string): boolean => {
    const d = conductor.get(n);
    if (d == null) return true;
    const u = us[d]!;
    return !esLogica(u) || /^adc/i.test(u.disp?.titulo ?? '');
  };
  const globales = new Set([...entradasDe].filter(([n, k]) => k >= 4 && primario(n)).map(([n]) => n));
  // Depth: longest path from the sources, ignoring the global nets and the edges that close a loop.
  const hijos = new Map<number, Set<number>>();
  for (const u of us)
    u.pines.forEach((p, i) => {
      const n = cx.nodo(u.id, i);
      if (p.red < 0 || sale(u, i) || globales.has(n)) return;
      const d = conductor.get(n);
      if (d == null || d === u.id) return;
      if (!hijos.has(d)) hijos.set(d, new Set());
      hijos.get(d)!.add(u.id);
    });
  const estado = new Array<number>(us.length).fill(0);
  const topo: number[] = [];
  const atras = new Set<string>();
  const visitar = (u: number) => {
    estado[u] = 1;
    for (const h of hijos.get(u) ?? []) {
      if (estado[h] === 1) atras.add(`${u}>${h}`);
      else if (estado[h] === 0) visitar(h);
    }
    estado[u] = 2;
    topo.push(u);
  };
  const raices = us.filter((u) => !us.some((w) => hijos.get(w.id)?.has(u.id))).map((u) => u.id);
  for (const u of [...raices, ...us.map((u) => u.id)]) if (estado[u] === 0) visitar(u);
  topo.reverse();
  const prof = new Array<number>(us.length).fill(0);
  for (const u of topo) for (const h of hijos.get(u) ?? []) if (!atras.has(`${u}>${h}`)) prof[h] = Math.max(prof[h]!, prof[u]! + (esLogica(us[h]!) ? 1 : 0));
  // Sources at depth 0, logic from 1.
  for (const u of logicas) prof[u.id] = Math.max(prof[u.id]!, 1);
  for (const u of us) if (!esLogica(u) && !(cx.esFuente(u.id) && cx.nodos2(u.id).includes('0'))) prof[u.id] = Math.max(prof[u.id]!, 1);
  // Terminal markers: an output after its driver, an input in the first column.
  for (const u of us) {
    if (!u.puerto) continue;
    const d = conductor.get(cx.nodo(u.id, 0));
    prof[u.id] = d != null && esLogica(us[d]!) ? prof[d]! + 1 : 0;
  }
  const r = reglasVacias('logica');
  r.rangoU = prof;
  // Sources upright, ground below.
  for (const u of us) if (cx.esFuente(u.id) && cx.nodos2(u.id).includes('0')) cx.vertical(u.id, cx.pinEn(u.id, cx.otro(u.id, '0')), cx.pinEn(u.id, '0'));
  // Columns by depth.
  const conCol = us.filter((u) => esLogica(u) || !!u.puerto || (cx.esFuente(u.id) && cx.nodos2(u.id).includes('0')));
  for (const a of conCol)
    for (const b of conCol) if (prof[a.id]! < prof[b.id]!) orden(r, R(a.id, 'x1'), R(b.id, 'x0'), 0, prof[b.id]! - prof[a.id]! === 1 ? 3.5 : 5, 6);
  // An output feeding one input in the next column is a straight wire (or two labels face to face): the two
  // pins level, so each chain of the circuit reads as a row.
  // Those links make the chains (rows) of the layered start.
  const padre = us.map((u) => u.id);
  const raiz = (i: number): number => (padre[i] === i ? i : (padre[i] = raiz(padre[i]!)));
  for (const ps of cx.comp.pinesRed) {
    const drv = ps.filter(([u, i]) => esLogica(us[u]!) && sale(us[u]!, i));
    if (drv.length !== 1) continue;
    const [u, i] = drv[0]!;
    const sig = ps.filter(([v, j]) => esLogica(us[v]!) && !sale(us[v]!, j) && prof[v]! === prof[u]! + 1);
    if (sig.length !== 1) continue;
    alin(r, R(u, i), R(sig[0]![0], sig[0]![1]), 1, 4);
    const [a, b] = [raiz(u), raiz(sig[0]![0])];
    if (a !== b) padre[Math.max(a, b)] = Math.min(a, b);
  }
  const grupos = new Map<number, number>();
  for (const u of logicas) {
    const g = raiz(u.id);
    if (us.filter((w) => esLogica(w) && raiz(w.id) === g).length < 2) continue;
    if (!grupos.has(g)) grupos.set(g, grupos.size);
  }
  r.fila = us.map((u) => (esLogica(u) && grupos.has(raiz(u.id)) ? grupos.get(raiz(u.id))! : -1));
  // Labels: the global nets (clock, enable) everywhere; an output reaching two or more columns ahead (a
  // counter's outputs into its gates and decoder) is labelled at those far inputs, and wired to the next
  // column (or labelled at its source too when it feeds nothing there).
  r.etiquetarPines = new Set();
  for (const [k, ps] of cx.comp.pinesRed.entries()) {
    if (ps.length < 2) continue;
    const cols = ps.map(([u]) => prof[u]!);
    if (globales.has(cx.comp.redes[k]!)) {
      r.etiquetar.add(k);
      continue;
    }
    const drv = ps.find(([u, i]) => sale(us[u]!, i));
    const p0 = drv ? prof[drv[0]]! : Math.min(...cols);
    const lejos = ps.filter(([u, i]) => !sale(us[u]!, i) && prof[u]! > p0 + 1);
    if (!lejos.length || Math.max(...cols) - Math.min(...cols) < 2) continue;
    const cerca = ps.filter(([u, i]) => !sale(us[u]!, i) && prof[u]! <= p0 + 1);
    if (!drv || !cerca.length) r.etiquetar.add(k);
    else for (const [u, i] of lejos) r.etiquetarPines.add(`${u},${i}`);
  }
  return r;
}

// ------------------------------------------------------------------ rectifiers

/** An AC source (sine, or any source floating between two nets) or a transformer winding. */
function esAlterna(cx: Contexto, u: number): boolean {
  const s = cx.sim(u);
  return s === 'VSIN' || s === 'ISIN' || s === 'TRAFO';
}

/**
 * Rectifiers in their textbook form: the AC source upright on the left with its series parts along the top
 * (and bottom) wires; a bridge as the diamond with the AC corners top and bottom, + on the right, − on the
 * left; a half-wave (or centre-tap) diode horizontal on the top row; the filter capacitor and the load hanging
 * from the + node on the right, capacitor first. A bridge whose − is not ground cannot reach the load's return
 * without a crossing (the bridge, the source and the load form a K4): its − corner is joined by a net label.
 */
function rectificadores(cx: Contexto): Reglas | null {
  const us = cx.us;
  const puentes = us.filter((u) => cx.sim(u.id) === 'PUENTE').map((u) => u.id);
  // Half-wave / centre-tap: diodes from the AC side into a node with a capacitor.
  const conC = (n: string) => n !== '0' && cx.en(n).some((u) => cx.letra(u) === 'C' && cx.dosPines(u));
  const ladoAlterna = (n: string, sin: number): boolean => {
    const vistos = new Set([n]);
    const pila = [n];
    for (let k = 0; pila.length && k < 12; k++) {
      const m = pila.pop()!;
      for (const u of cx.en(m)) {
        if (u === sin) continue;
        if (esAlterna(cx, u)) return true;
        if (!cx.dosPines(u) || cx.esDiodo(u) || cx.letra(u) === 'C') continue;
        const o = cx.otro(u, m);
        if (o !== '0' && !vistos.has(o)) {
          vistos.add(o);
          pila.push(o);
        }
      }
    }
    return false;
  };
  const diodos = us
    .map((u) => u.id)
    .filter((d) => {
      if (!cx.esDiodo(d) || cx.sim(d) === 'DZ') return false;
      const ia = cx.pinLlamado(d, 'start');
      const ik = cx.pinLlamado(d, 'end');
      return ia >= 0 && ik >= 0 && conC(cx.nodo(d, ik)) && cx.nodo(d, ia) !== '0' && ladoAlterna(cx.nodo(d, ia), d);
    });
  if (!puentes.length && !diodos.length) return null;
  const r = reglasVacias('rectificador');
  const usados = new Set<number>();
  const p = (u: number, n: string) => cx.pinEn(u, n);

  /** The filter and the load on node P (return N, or ground): upright, right of `desde`, capacitors first. */
  const salida = (P: string, N: string, desde: RefRegla) => {
    const conds: number[] = [];
    const cargas: number[] = [];
    for (const u of cx.en(P)) {
      if (usados.has(u) || !cx.dosPines(u)) continue;
      const o = cx.otro(u, P);
      if (o !== N && o !== '0') continue;
      usados.add(u);
      cx.vertical(u, p(u, P), p(u, o), 6);
      orden(r, desde, R(u, 'c'), 0, 1.5, 4);
      alin(r, desde, R(u, p(u, P)), 1, 2);
      (cx.letra(u) === 'C' ? conds : cargas).push(u);
    }
    for (const c of conds) for (const l of cargas) orden(r, R(c, 'c'), R(l, 'c'), 0, 1.5, 3);
    // The return's own shunts to ground (a reference resistor) on the right too.
    if (N !== '0')
      for (const u of cx.en(N)) {
        if (usados.has(u) || !cx.dosPines(u) || cx.otro(u, N) !== '0') continue;
        usados.add(u);
        cx.vertical(u, p(u, N), p(u, '0'), 6);
        orden(r, desde, R(u, 'c'), 0, 1.5, 3);
      }
  };

  /** The AC side from net `n` back to the source, along the row of `fila`, all left of `limite`. */
  const alterna = (n: string, fila: RefRegla, limite: RefRegla, excluir: number) => {
    let ant: RefRegla = fila;
    let actual = n;
    for (let k = 0; k < 6; k++) {
      const sig = cx.en(actual).filter((u) => u !== excluir && !usados.has(u) && cx.dosPines(u));
      // Shunts to ground on the AC wire hang below it.
      for (const u of sig.filter((w) => cx.otro(w, actual) === '0' && !esAlterna(cx, w))) {
        usados.add(u);
        cx.vertical(u, p(u, actual), p(u, '0'), 6);
        orden(r, R(u, 'c'), limite, 0, 1, 3);
      }
      const serie = sig.filter((w) => cx.otro(w, actual) !== '0' && !usados.has(w));
      if (serie.length !== 1) break;
      const u = serie[0]!;
      usados.add(u);
      const lejos = cx.otro(u, actual);
      if (esAlterna(cx, u) || (cx.letra(u) === 'V' && !cx.esAmperimetro(u))) {
        // The source: upright, left of everything.
        cx.vertical(u, p(u, actual), p(u, lejos), 6);
        orden(r, R(u, 'x1'), limite, 0, 3, 4);
        alin(r, fila, R(u, p(u, actual)), 1, 1.5);
        return u;
      }
      cx.horizontal(u, p(u, lejos), p(u, actual), 6);
      alin(r, ant, R(u, p(u, actual)), 1, 3);
      orden(r, R(u, 'c'), limite, 0, 1, 3);
      ant = R(u, p(u, lejos));
      actual = lejos;
    }
    return null;
  };

  const anclas: NonNullable<Reglas['anclas']> = [];
  for (const pb of puentes) {
    usados.add(pb);
    const ia = cx.pinLlamado(pb, 'a');
    const ib = cx.pinLlamado(pb, 'b');
    const ip = cx.pinLlamado(pb, 'p');
    const iN = cx.pinLlamado(pb, 'n');
    if ([ia, ib, ip, iN].some((i) => i < 0)) continue;
    // AC corners top and bottom, + right, − left.
    cx.orientar(pb, (g) => g[ia]!.x === g[ib]!.x && g[ia]!.y < g[ib]!.y && g[ip]!.x > g[iN]!.x, 12);
    const A = cx.nodo(pb, ia);
    const B = cx.nodo(pb, ib);
    const P = cx.nodo(pb, ip);
    const N = cx.nodo(pb, iN);
    const izq = R(pb, iN);
    const fuente = alterna(A, R(pb, ia), izq, pb) ?? null;
    const fuenteB = alterna(B, R(pb, ib), izq, pb);
    void fuenteB;
    salida(P, N, R(pb, ip));
    if (N !== '0' && (cx.porNodo.get(N)?.length ?? 0) > 1) {
      r.etiquetarPines ??= new Set();
      r.etiquetarPines.add(`${pb},${iN}`);
    }
    anclas.push({ u: pb, pin: ia, x: 0, y: 0 });
    if (fuente != null) anclas.push({ u: fuente, pin: cx.us[fuente]!.pines.findIndex((_, i) => !['0'].includes(cx.nodo(fuente, i))), x: -8, y: 0 });
  }
  // Half-wave (one diode) or centre-tap (two into the same node): diodes horizontal, anode on the left.
  const porSalida = new Map<string, number[]>();
  for (const d of diodos) {
    const P = cx.nodo(d, cx.pinLlamado(d, 'end'));
    if (!porSalida.has(P)) porSalida.set(P, []);
    porSalida.get(P)!.push(d);
  }
  for (const [P, ds] of porSalida) {
    if (ds.some((d) => usados.has(d))) continue;
    ds.forEach((d, i) => {
      usados.add(d);
      const ia = cx.pinLlamado(d, 'start');
      const ik = cx.pinLlamado(d, 'end');
      cx.horizontal(d, ia, ik, 8);
      if (i) {
        // Centre-tap: the second diode on its own row below, cathodes in one column.
        alin(r, R(ds[0]!, ik), R(d, ik), 0, 3);
        orden(r, R(ds[0]!, ik), R(d, ik), 1, 3, 3);
      }
      alterna(cx.nodo(d, ia), R(d, ia), R(d, 'x0'), d);
    });
    // Ground return (or the diode's own return): the filter on the right of the cathodes.
    salida(P, '0', R(ds[0]!, cx.pinLlamado(ds[0]!, 'end')));
  }
  if (!r.orden.length && !r.alin.length) return null;
  if (anclas.length) r.anclas = anclas;
  return r;
}

// ------------------------------------------------------------------ entry

/** Layout rules of the topologies recognised in a component (null: none). Mutates the variants' costs. */
export function reglasDe(comp: Componente): Reglas | null {
  if (comp.unidades.length < 3) return null;
  const cx = new Contexto(comp);
  const todas: Reglas[] = [];
  const h = puenteH(cx);
  if (h) todas.push(h);
  else {
    const c = convertidores(cx);
    if (c) todas.push(c);
  }
  const w = wien(cx);
  if (w) todas.push(w);
  if (!h) {
    const g = reguladores(cx);
    if (g) todas.push(g);
  }
  if (!h && !w && !todas.some((x) => x.familias.includes('convertidor'))) {
    const rc = rectificadores(cx);
    if (rc) todas.push(rc);
  }
  const l = logica(cx);
  if (l) todas.push(l);
  if (!todas.length) return null;
  const r = reglasVacias(todas.flatMap((x) => x.familias).join('+'));
  r.familias = todas.flatMap((x) => x.familias);
  for (const x of todas) {
    r.orden.push(...x.orden);
    r.alin.push(...x.alin);
    for (const k of x.etiquetar) r.etiquetar.add(k);
    if (x.etiquetarPines?.size) r.etiquetarPines = new Set([...(r.etiquetarPines ?? []), ...x.etiquetarPines]);
    if (x.rangoU) r.rangoU = x.rangoU;
    if (x.fila) r.fila = x.fila;
    if (x.anclas) r.anclas = [...(r.anclas ?? []), ...x.anclas];
  }
  return r;
}
