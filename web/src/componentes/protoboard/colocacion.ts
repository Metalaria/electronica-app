// Auto-placement: a circuit (CircuitoFuente) laid out on breadboards as a person would do it.
//
//  1. Each part gets its package (encapsulados.ts); sources and meters become equipment off the board.
//  2. Ground goes to the blue rails; the DC supplies (sources from a net to ground) to the red ones: the
//     most used positive supply on top, a negative one (or a second positive one) at the bottom.
//  3. The parts are placed one by one, each next to what it connects to (the first one is the leftmost
//     of the schematic; then the part sharing most signal nets with those already placed, the schematic's
//     left-to-right order breaking ties). Every position of the part in a window of columns is scored: a
//     leg in a strip of its own net or in its rail costs nothing, a leg in a new strip costs a strip plus
//     the jumper to the nearest strip of its net that still has a free hole; legs never go into a strip of
//     another net, into an occupied hole or under a body, and bodies never overlap. Columns to the left,
//     the first board and rows away from the rails are preferred. When a leg opens a new strip of a net
//     that already has some, the jumper is laid at once (holes chosen for a short wire that crosses few
//     bodies and wires).
//  4. Equipment goes above the first board, in the schematic's order; each terminal gets a lead to its
//     rail or to a free hole of its net (a strip of its own when the net has none).
//  5. Rails of one net that are used in several rows (top and bottom, other boards) are bridged.
// A 400-point board is tried first, then one, two, three and four 830-point boards.
// Plain TypeScript (Node tests); a few milliseconds per part.

import { pinesDe } from '../editor/catalogo.ts';
import type { Componente } from '../editor/tipos.ts';
import { CABLE, CICLO_SENAL } from './colores.ts';
import {
  bajoCuerpo,
  bornesExterno,
  cajaCuerpo,
  cuerpoDe,
  encapsuladoDe,
  esFuenteContinua,
  patasCompletas,
  patasDip,
  patasFila,
  solapan,
  tensionFuente,
  type Cuerpo,
  type Encapsulado,
} from './encapsulados.ts';
import { empaquetar, type ChipMontado } from './logica.ts';
import { agujero, agujerosDe, ALTO_PLACA, clavePt, columnasRiel, FILAS_ABAJO, FILAS_ARRIBA, FILAS_RIEL, type ConfigPlaca, type Pt } from './placa.ts';
import { clavePin, type CableProto, type CircuitoFuente, type DocumentoProtoboard, type Pieza } from './tipos.ts';

const TAMANOS: ConfigPlaca[] = [
  { placas: 1, columnas: 30 },
  { placas: 1, columnas: 63 },
  { placas: 2, columnas: 63 },
  { placas: 3, columnas: 63 },
  { placas: 4, columnas: 63 },
];

interface Parte {
  comp: Componente;
  enc: Encapsulado;
  /** Net of each leg for the placement (a unique «nc:…» for legs connected to nothing). */
  redes: string[];
  x: number;
  y: number;
  polo?: number;
  chip?: ChipMontado;
}

export interface ResultadoColocacion {
  doc: DocumentoProtoboard;
  /** Notes about the placement (Spanish). */
  notas: string[];
}

/** Rough DC voltage of every net (sources, then averaging through resistive parts): electrolytic polarity. */
export function estimarTensiones(f: CircuitoFuente): Map<string, number> {
  const v = new Map<string, number>([['0', 0]]);
  const red = (c: Componente, p: string) => f.redes[`${c.id}.${p}`];
  const fuentes = f.componentes.filter((c) => esFuenteContinua(c) || c.tipo === 'V');
  for (let it = 0; it < 6; it++)
    for (const c of fuentes) {
      const val = tensionFuente(c);
      if (val == null) continue;
      const a = red(c, 'end');
      const b = red(c, 'start');
      if (!a || !b) continue;
      if (v.has(b) && !v.has(a)) v.set(a, v.get(b)! + val);
      else if (v.has(a) && !v.has(b)) v.set(b, v.get(a)! - val);
    }
  const fijas = new Set(v.keys());
  const vecinos = new Map<string, string[]>();
  const enlazar = (a?: string, b?: string) => {
    if (!a || !b || a === b) return;
    (vecinos.get(a) ?? vecinos.set(a, []).get(a)!).push(b);
    (vecinos.get(b) ?? vecinos.set(b, []).get(b)!).push(a);
  };
  for (const c of f.componentes) {
    if (['R', 'L', 'D', 'DS', 'DZ', 'LED', 'SW', 'AMP'].includes(c.tipo)) enlazar(red(c, 'start'), red(c, 'end'));
    else if (c.tipo === 'POT') {
      enlazar(red(c, 'start'), red(c, 'tap'));
      enlazar(red(c, 'tap'), red(c, 'end'));
    } else if (c.tipo === 'QN' || c.tipo === 'QP') {
      enlazar(red(c, 'base'), red(c, 'emitter'));
      enlazar(red(c, 'collector'), red(c, 'emitter'));
    } else if (['MN', 'MP', 'JN', 'JP'].includes(c.tipo)) enlazar(red(c, 'drain'), red(c, 'source'));
  }
  for (const n of vecinos.keys()) if (!v.has(n)) v.set(n, 0);
  for (let it = 0; it < 60; it++)
    for (const [n, vs] of vecinos) {
      if (fijas.has(n)) continue;
      let s = 0;
      for (const m of vs) s += v.get(m) ?? 0;
      v.set(n, s / vs.length);
    }
  return v;
}

/** Leaves the circuit on breadboards. Throws an Error with a Spanish message when it does not fit. */
export function colocarCircuito(f: CircuitoFuente): ResultadoColocacion {
  let ultimo: unknown = null;
  // On each board size, with some air between bodies first, parts touching each other only when that fails.
  for (const cfg of TAMANOS)
    for (const aire of [0.3, 0]) {
      try {
        return new Colocador(f, cfg, aire).ejecutar();
      } catch (e) {
        if (!(e instanceof NoCabe)) throw e;
        ultimo = e;
      }
    }
  const n = f.componentes.length;
  throw new Error(`El circuito no cabe en cuatro placas de 830 puntos (${n} componentes${ultimo instanceof NoCabe ? `; no hay sitio para ${ultimo.message}` : ''}).`);
}

class NoCabe extends Error {}

class Colocador {
  private f: CircuitoFuente;
  private cfg: ConfigPlaca;
  private ocupado = new Set<string>();
  private bloqueado = new Set<string>();
  private condRed = new Map<string, string>();
  private condsDe = new Map<string, string[]>();
  private cuerpos: { b: Cuerpo; caja: [number, number, number, number] }[] = [];
  private rejilla = new Map<number, number[]>();
  private piezas: Pieza[] = [];
  private cables: CableProto[] = [];
  private frente: number[];
  private colores = new Map<string, string>();
  private nCables = 0;
  private notas: string[] = [];
  /** Net of each rail row (index 0–3, the same on every board). */
  private redRiel: (string | null)[] = [null, null, null, null];
  private signoRed = new Map<string, number>();
  /** Legs and equipment terminals of each net still to be placed. */
  private restantes = new Map<string, number>();

  private libresDe(red: string): number {
    let n = 0;
    for (const c of this.condsDe.get(red) ?? []) n += this.libres(c).length;
    return n;
  }

  private aire: number;

  constructor(f: CircuitoFuente, cfg: ConfigPlaca, aire: number) {
    this.f = f;
    this.cfg = cfg;
    this.aire = aire;
    this.frente = Array.from({ length: cfg.placas }, () => 0);
  }

  // ---------------------------------------------------------------- conductors and holes

  private agujerosCache = new Map<string, Pt[]>();
  private agujerosDe(nodo: string): Pt[] {
    let a = this.agujerosCache.get(nodo);
    if (!a) this.agujerosCache.set(nodo, (a = agujerosDe(this.cfg, nodo)));
    return a;
  }

  private libre(x: number, y: number): boolean {
    const k = clavePt(x, y);
    return !this.ocupado.has(k) && !this.bloqueado.has(k);
  }

  private libres(nodo: string): Pt[] {
    return this.agujerosDe(nodo).filter(([x, y]) => this.libre(x, y));
  }

  private esRiel(nodo: string): boolean {
    return nodo.startsWith('R');
  }

  /** Centre of a conductor (for distances); rails are measured from `cerca`. */
  private centro(nodo: string, cerca: Pt): Pt {
    const m = /^([TR])(\d+):(\d+)(?::([ab]))?$/.exec(nodo)!;
    const oy = Number(m[2]) * ALTO_PLACA;
    if (m[1] === 'T') return [Number(m[3]), oy + (m[4] === 'a' ? 5 : 12)];
    return [Math.min(Math.max(cerca[0], 2), this.cfg.columnas - 1), oy + FILAS_RIEL[Number(m[3])]!];
  }

  private asignar(nodo: string, red: string) {
    this.condRed.set(nodo, red);
    if (!this.esRiel(nodo)) (this.condsDe.get(red) ?? this.condsDe.set(red, []).get(red)!).push(nodo);
  }

  /** Conductors of a net with a free hole (strips, and its rails on every board). */
  private conectables(red: string): string[] {
    const res: string[] = [];
    for (const c of this.condsDe.get(red) ?? []) if (this.libres(c).length) res.push(c);
    this.redRiel.forEach((r, i) => {
      if (r !== red) return;
      for (let p = 0; p < this.cfg.placas; p++) res.push(`R${p}:${i}`);
    });
    return res;
  }

  private tieneConductores(red: string): boolean {
    return (this.condsDe.get(red)?.length ?? 0) > 0 || this.redRiel.includes(red);
  }

  private colorDe(red: string): string {
    let c = this.colores.get(red);
    if (!c) {
      const s = this.signoRed.get(red);
      c = red === '0' ? CABLE.negro : s === 1 ? CABLE.rojo : s === -1 ? CABLE.azul : CICLO_SENAL[this.colores.size % CICLO_SENAL.length]!;
      this.colores.set(red, c);
    }
    return c;
  }

  // ---------------------------------------------------------------- bodies

  private cuerposCerca(caja: [number, number, number, number]): number[] {
    const res = new Set<number>();
    for (let x = Math.floor(caja[0]); x <= Math.ceil(caja[2]); x++) for (const i of this.rejilla.get(x) ?? []) res.add(i);
    return [...res];
  }

  private cabeCuerpo(b: Cuerpo | null, aire: number): boolean {
    if (!b) return true;
    const caja = cajaCuerpo(b);
    for (const i of this.cuerposCerca(caja)) {
      const o = this.cuerpos[i]!;
      if (o.caja[0] >= caja[2] + aire || o.caja[2] <= caja[0] - aire || o.caja[1] >= caja[3] + aire || o.caja[3] <= caja[1] - aire) continue;
      // A little air between bodies (0,3 pitch): parts that touch are hard to tell apart and to pick.
      if (solapan(b, o.b, -aire)) return false;
    }
    // No leg or wire end may end up hidden under it.
    for (let x = Math.ceil(caja[0]); x <= Math.floor(caja[2]); x++)
      for (let y = Math.ceil(caja[1]); y <= Math.floor(caja[3]); y++) if (this.ocupado.has(clavePt(x, y)) && bajoCuerpo(b, x, y)) return false;
    return true;
  }

  private ponerCuerpo(b: Cuerpo | null) {
    if (!b) return;
    const caja = cajaCuerpo(b);
    const i = this.cuerpos.length;
    this.cuerpos.push({ b, caja });
    for (let x = Math.floor(caja[0]); x <= Math.ceil(caja[2]); x++) (this.rejilla.get(x) ?? this.rejilla.set(x, []).get(x)!).push(i);
    for (let x = Math.ceil(caja[0]); x <= Math.floor(caja[2]); x++)
      for (let y = Math.ceil(caja[1]); y <= Math.floor(caja[3]); y++) if (bajoCuerpo(b, x, y)) this.bloqueado.add(clavePt(x, y));
  }

  /**
   * Bodies stay over the strips: none covers the rails (except a two-leg part with a leg in a rail) and
   * only a DIP or a two-leg part with its legs on both sides crosses the channel.
   */
  private enZona(b: Cuerpo, pos: Pt[], forma: string): boolean {
    const caja = cajaCuerpo(b);
    const placa = Math.floor((pos[0]![1] + 2) / ALTO_PLACA);
    const oy = placa * ALTO_PLACA;
    const ry = pos.map((q) => q[1] - oy);
    const enRiel = ry.some((y) => y <= 1 || y >= 16);
    const cruza = ry.some((y) => y <= 7) && ry.some((y) => y >= 10);
    const y0 = caja[1] - oy;
    const y1 = caja[3] - oy;
    if (!enRiel && (y0 < 2.2 || y1 > 14.8)) return false;
    if (forma !== 'dip' && !cruza && y0 < 8.9 && y1 > 8.1) return false;
    return true;
  }

  /** How many bodies a straight wire passes over, and how many wires it crosses. */
  private cruces(a: Pt, b: Pt): number {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const caja: [number, number, number, number] = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
    let n = 0;
    const pasos = Math.max(2, Math.ceil(L / 0.3));
    for (const i of this.cuerposCerca(caja)) {
      const o = this.cuerpos[i]!;
      if (o.caja[0] > caja[2] + 0.1 || o.caja[2] < caja[0] - 0.1 || o.caja[1] > caja[3] + 0.1 || o.caja[3] < caja[1] - 0.1) continue;
      for (let k = 1; k < pasos; k++) {
        const t = k / pasos;
        if (bajoCuerpo(o.b, a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), 0)) {
          n += 6;
          break;
        }
      }
    }
    for (const w of this.cables) if (seCruzan(a, b, w.a, w.b)) n += 0.7;
    return n;
  }

  // ---------------------------------------------------------------- wires

  private nuevoCable(a: Pt, b: Pt, color: string) {
    this.cables.push({ id: `w${++this.nCables}`, a, b, color });
    this.ocupado.add(clavePt(a[0], a[1]));
    this.ocupado.add(clavePt(b[0], b[1]));
  }

  /** A jumper from conductor `de` to the nearest conductor of its net with a free hole. */
  private enlazar(de: string, red: string, excluir: Set<string>) {
    const origen = this.libres(de);
    if (!origen.length) return false;
    const ref = origen[0]!;
    let mejor: { a: Pt; b: Pt; s: number } | null = null;
    for (const c of this.conectables(red)) {
      if (c === de || excluir.has(c)) continue;
      const cc = this.centro(c, ref);
      const dc = Math.hypot(cc[0] - ref[0], cc[1] - ref[1]);
      if (mejor && dc - 6 > mejor.s) continue;
      let destinos = this.libres(c);
      if (this.esRiel(c)) destinos = destinos.filter((p) => Math.abs(p[0] - ref[0]) <= 7);
      for (const a of origen)
        for (const b of destinos) {
          const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (L < 0.9) continue;
          const s = L + this.cruces(a, b) + (a[0] !== b[0] && a[1] !== b[1] ? 1.6 : 0);
          if (!mejor || s < mejor.s) mejor = { a, b, s };
        }
    }
    if (!mejor) return false;
    this.nuevoCable(mejor.a, mejor.b, this.colorDe(red));
    return true;
  }

  // ---------------------------------------------------------------- candidates

  private evaluar(pos: Pt[], parte: Parte, provisional: Pieza): number | null {
    let coste = 0;
    const vistos = new Map<string, string>();
    /** Legs going into existing strips of each net (a net must keep a free hole for what comes later). */
    const entran = new Map<string, number>();
    let xmin = Infinity;
    let placa = 0;
    for (let i = 0; i < pos.length; i++) {
      const [x, y] = pos[i]!;
      const a = agujero(this.cfg, x, y);
      if (!a || !this.libre(x, y)) return null;
      xmin = Math.min(xmin, x);
      placa = Math.max(placa, a.placa);
      const red = parte.redes[i]!;
      const previo = vistos.get(a.nodo);
      if (previo != null) {
        if (previo !== red || red.startsWith('nc:')) return null;
        continue;
      }
      vistos.set(a.nodo, red);
      const cn = this.condRed.get(a.nodo);
      if (a.tipo === 'riel') {
        if (cn !== red) return null;
        coste -= 3;
        continue;
      }
      if (cn != null) {
        if (cn !== red) return null;
        coste -= 2;
        entran.set(red, (entran.get(red) ?? 0) + 1);
        continue;
      }
      if (red.startsWith('nc:')) {
        coste += 0.6;
        continue;
      }
      coste += 1.5;
      if (this.tieneConductores(red)) {
        let d = Infinity;
        for (const c of this.conectables(red)) {
          const cc = this.centro(c, [x, y]);
          d = Math.min(d, Math.abs(cc[0] - x) + Math.abs(cc[1] - y) * 0.6);
        }
        if (d === Infinity) return null;
        coste += 2.5 + 0.3 * d;
      }
    }
    provisional.pos = pos;
    const cuerpo = cuerpoDe(provisional);
    if (!this.cabeCuerpo(cuerpo, parte.enc.id === 'medida' ? Math.min(this.aire, -0.04) : this.aire)) return null;
    // (an electrolytic can stands above the board and may overhang the rails or the channel)
    if (cuerpo && parte.enc.id !== 'electrolitico' && !this.enZona(cuerpo, pos, parte.enc.forma)) return null;
    // Every net that still has legs to come must keep a free hole: legs into its strips, the jumpers of
    // its new strips and holes hidden under this body all use them up.
    const delta = new Map<string, number>();
    const suma = (r: string, d: number) => delta.set(r, (delta.get(r) ?? 0) + d);
    for (const [r, n] of entran) suma(r, -n);
    const nuevasDe = new Map<string, number>();
    for (const [nodo, r] of vistos)
      if (!this.condRed.has(nodo) && !r.startsWith('nc:')) {
        const k = nuevasDe.get(r) ?? 0;
        nuevasDe.set(r, k + 1);
        suma(r, 4 - (this.tieneConductores(r) || k > 0 ? 2 : 0));
      }
    /** Free holes of existing strips of each net that this body would hide. */
    const tapados = new Map<string, number>();
    /** Holes each new strip keeps for its own jumper. */
    const propios = new Map<string, number>();
    for (const [nodo] of vistos) if (!this.condRed.has(nodo)) propios.set(nodo, this.libres(nodo).length - pos.filter(([x, y]) => agujero(this.cfg, x, y)?.nodo === nodo).length);
    if (cuerpo) {
      const caja = cajaCuerpo(cuerpo);
      for (let x = Math.ceil(caja[0]); x <= Math.floor(caja[2]); x++)
        for (let y = Math.ceil(caja[1]); y <= Math.floor(caja[3]); y++) {
          if (!this.libre(x, y) || !bajoCuerpo(cuerpo, x, y)) continue;
          const a = agujero(this.cfg, x, y);
          if (!a || a.tipo === 'riel') continue;
          if (propios.has(a.nodo)) propios.set(a.nodo, propios.get(a.nodo)! - 1);
          const r = this.condRed.get(a.nodo) ?? vistos.get(a.nodo);
          if (r) suma(r, -1);
          if (this.condRed.has(a.nodo) && r) tapados.set(r, (tapados.get(r) ?? 0) + 1);
        }
    }
    // A new strip of a net that must be joined needs a free hole for its jumper.
    const enlazadas = new Set<string>();
    for (const [nodo, libres] of propios) {
      const r = vistos.get(nodo)!;
      if (r.startsWith('nc:')) continue;
      const necesita = this.tieneConductores(r) || enlazadas.has(r);
      enlazadas.add(r);
      if (necesita && libres < 1) return null;
      // …and the strips it joins must still have one once this part is in.
      if (this.tieneConductores(r) && !this.redRiel.includes(r) && this.libresDe(r) - (entran.get(r) ?? 0) - (tapados.get(r) ?? 0) < 1) return null;
    }
    for (const [r, d] of delta) {
      if (r.startsWith('nc:') || this.redRiel.includes(r)) continue;
      const quedan = (this.restantes.get(r) ?? 0) - parte.redes.filter((x) => x === r).length;
      if (quedan <= 0) continue;
      const libres = this.libresDe(r) + d;
      if (libres < Math.min(2, quedan)) return null;
      if (libres < 3) coste += 1.5;
    }
    // Rows next to the rails are kept for the jumpers to them.
    for (const [, y] of pos) {
      const ry = ((y % ALTO_PLACA) + ALTO_PLACA) % ALTO_PLACA;
      if (ry === 3 || ry === 14) coste += 0.35;
    }
    return coste + 0.06 * xmin + 40 * placa;
  }

  private ventanas(parte: Parte): { placa: number; x0: number; x1: number }[] {
    const N = this.cfg.columnas;
    const res: { placa: number; x0: number; x1: number }[] = [];
    const ultima = Math.max(0, ...this.frente.map((f, i) => (f > 0 ? i : 0)));
    for (let p = 0; p < this.cfg.placas && p <= ultima + 1; p++) {
      const fr = this.frente[p]!;
      if (N <= 32) res.push({ placa: p, x0: 1, x1: N });
      else res.push({ placa: p, x0: Math.max(1, fr - 26), x1: Math.min(N, fr + 14) });
    }
    // Around the strips of its nets.
    for (const r of parte.redes)
      for (const c of this.condsDe.get(r) ?? []) {
        const m = /^T(\d+):(\d+)/.exec(c);
        if (m) res.push({ placa: Number(m[1]), x0: Math.max(1, Number(m[2]) - 8), x1: Math.min(N, Number(m[2]) + 8) });
      }
    return res;
  }

  private candidatos(parte: Parte): Pt[][] {
    const e = parte.enc;
    const res: Pt[][] = [];
    const vistos = new Set<string>();
    const anadir = (p: Pt[]) => {
      const k = p.map((q) => q.join(',')).join(';');
      if (vistos.has(k)) return;
      vistos.add(k);
      res.push(p);
    };
    for (const v of this.ventanas(parte)) {
      const oy = v.placa * ALTO_PLACA;
      const filas = [...FILAS_ARRIBA, ...FILAS_ABAJO].map((f) => f + oy);
      for (let x = v.x0; x <= v.x1; x++) {
        if (e.forma === 'dos') {
          const [smin, smax] = e.span ?? [1, 10];
          for (const d of e.preferidos ?? [smin]) {
            if (d < smin || d > smax) continue;
            for (const y of filas) {
              anadir([[x, y], [x + d, y]]);
              anadir([[x + d, y], [x, y]]);
            }
          }
          if (e.enFila) continue;
          // Across the channel (e ↔ f) and into the rails.
          if (smin <= 3 && smax >= 3) {
            anadir([[x, oy + 7], [x, oy + 10]]);
            anadir([[x, oy + 10], [x, oy + 7]]);
          }
          for (const [a, b] of [[3, 1], [3, 0], [14, 16], [14, 17]] as const) {
            const d = Math.abs(a - b);
            if (d < smin || d > smax) continue;
            anadir([[x, oy + a], [x, oy + b]]);
            anadir([[x, oy + b], [x, oy + a]]);
          }
        } else if (e.forma === 'fila') {
          const n = e.patas.length;
          for (const y of filas) {
            anadir(patasFila([x, y], [1, 0], n));
            anadir(patasFila([x + n - 1, y], [-1, 0], n));
          }
        } else if (e.forma === 'dip') {
          const m = e.patas.length / 2;
          anadir(patasDip([x, oy + 10], [1, 0], e.patas.length));
          anadir(patasDip([x + m - 1, oy + 7], [-1, 0], e.patas.length));
        } else if (e.forma === 'uno') {
          for (const y of filas) anadir([[x, y]]);
        }
      }
    }
    return res;
  }

  private colocar(parte: Parte) {
    const provisional: Pieza = {
      id: parte.comp.id,
      comp: parte.comp,
      enc: parte.enc.id,
      pos: [],
      patas: parte.enc.patas,
      ...(parte.polo != null ? { polo: parte.polo } : {}),
      ...(parte.chip ? { chip: { comps: parte.chip.comps, roles: parte.chip.roles, ataduras: parte.chip.ataduras } } : {}),
    };
    let mejor: { pos: Pt[]; coste: number } | null = null;
    for (const pos of this.candidatos(parte)) {
      const c = this.evaluar(pos, parte, provisional);
      if (c != null && (!mejor || c < mejor.coste - 1e-9)) mejor = { pos, coste: c };
    }
    if (!mejor) throw new NoCabe(`${parte.comp.nombre || parte.enc.descripcion}`);
    const pos = mejor.pos;
    provisional.pos = pos;
    // Which conductors did the part open, and which nets already had conductors?
    const antes = new Map<string, boolean>();
    for (const r of parte.redes) if (!antes.has(r)) antes.set(r, this.tieneConductores(r));
    const nuevos: { nodo: string; red: string }[] = [];
    for (const r of parte.redes) this.restantes.set(r, (this.restantes.get(r) ?? 0) - 1);
    pos.forEach(([x, y], i) => {
      this.ocupado.add(clavePt(x, y));
      const a = agujero(this.cfg, x, y)!;
      const red = parte.redes[i]!;
      if (!this.condRed.has(a.nodo)) {
        this.asignar(a.nodo, red);
        nuevos.push({ nodo: a.nodo, red });
      }
      this.frente[a.placa] = Math.max(this.frente[a.placa]!, x);
    });
    this.ponerCuerpo(cuerpoDe(provisional));
    this.piezas.push(provisional);
    // Jumpers: each new strip of a net that had conductors joins the nearest one; two new strips of a
    // new net join each other.
    const porRed = new Map<string, string[]>();
    for (const { nodo, red } of nuevos) if (!red.startsWith('nc:')) (porRed.get(red) ?? porRed.set(red, []).get(red)!).push(nodo);
    for (const [red, nodos] of porRed) {
      if (antes.get(red)) {
        // Each new strip to one the net already had, or to a new one already joined to it (never to one
        // still apart: that would leave them apart).
        const fuera = new Set(nodos);
        for (const n of nodos) if (this.enlazar(n, red, fuera)) fuera.delete(n);
      } else {
        // A new net opened in several strips: a chain from the first.
        for (let i = 1; i < nodos.length; i++) this.enlazar(nodos[i]!, red, new Set(nodos.slice(i)));
      }
    }
  }

  // ---------------------------------------------------------------- equipment

  private colocarEquipos(externos: Parte[]) {
    const porFila = Math.max(1, Math.floor((this.cfg.columnas - 1) / 9));
    externos.forEach((p, i) => {
      const fila = Math.floor(i / porFila);
      const col = i % porFila;
      const a: Pt = [3 + col * 9, -3 - fila * 8];
      const pos = bornesExterno(a, p.enc.patas.length);
      const pieza: Pieza = { id: p.comp.id, comp: p.comp, enc: p.enc.id, pos, patas: p.enc.patas };
      this.piezas.push(pieza);
      pos.forEach((t, j) => {
        const red = p.redes[j]!;
        const destino = this.huecoParaPuntaDe(red, t);
        if (destino) this.nuevoCable(t, destino, j === 0 ? (p.enc.id === 'alimentacion' && (this.signoRed.get(red) ?? 0) < 0 ? CABLE.azul : CABLE.rojo) : CABLE.negro);
      });
    });
  }

  /** A free hole of a net for an equipment lead, near the terminal; opens a strip when needed. */
  private huecoParaPuntaDe(red: string, t: Pt): Pt | null {
    if (red.startsWith('nc:')) return null;
    let mejor: { p: Pt; s: number } | null = null;
    const probar = (p: Pt, extra = 0) => {
      const s = Math.hypot(p[0] - t[0], p[1] - t[1]) * 0.35 + extra + this.cruces(t, p) * 1.2;
      if (!mejor || s < mejor.s) mejor = { p, s };
    };
    const filaR = this.redRiel.findIndex((r, i) => r === red && i < 2);
    if (filaR >= 0) for (const p of this.libres(`R0:${filaR}`)) probar(p);
    else {
      for (const c of this.condsDe.get(red) ?? []) for (const p of this.libres(c)) probar(p);
      // A rail of the net elsewhere (bottom rails).
      if (!mejor) this.redRiel.forEach((r, i) => r === red && this.libres(`R0:${i}`).forEach((p) => probar(p, 6)));
    }
    if (mejor) return (mejor as { p: Pt }).p;
    // A strip of its own, near the left of the first board, joined to the net if it has conductors.
    const tenia = this.tieneConductores(red);
    for (let x = 1; x <= this.cfg.columnas; x++) {
      for (const lado of ['a', 'b'] as const) {
        const nodo = `T0:${x}:${lado}`;
        if (this.condRed.has(nodo) || this.libres(nodo).length < 5) continue;
        this.asignar(nodo, red);
        if (tenia && !this.enlazar(nodo, red, new Set([nodo]))) {
          this.condRed.delete(nodo);
          this.condsDe.set(red, (this.condsDe.get(red) ?? []).filter((c) => c !== nodo));
          continue;
        }
        const libres = this.libres(nodo);
        return libres[lado === 'a' ? 0 : libres.length - 1] ?? null;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- rails

  private puentearRieles() {
    const porRed = new Map<string, string[]>();
    for (let p = 0; p < this.cfg.placas; p++)
      this.redRiel.forEach((r, i) => {
        if (!r) return;
        const nodo = `R${p}:${i}`;
        const usado = this.agujerosDe(nodo).some(([x, y]) => this.ocupado.has(clavePt(x, y)));
        if (usado) (porRed.get(r) ?? porRed.set(r, []).get(r)!).push(nodo);
      });
    // The supply's own rail (row 0 or 1 of the first board) is always part of the chain.
    for (const [red, nodos] of porRed) {
      const y = (n: string) => {
        const m = /^R(\d+):(\d)/.exec(n)!;
        return Number(m[1]) * ALTO_PLACA + FILAS_RIEL[Number(m[2])]!;
      };
      nodos.sort((a, b) => y(a) - y(b));
      for (let i = 0; i + 1 < nodos.length; i++) {
        const [a, b] = [nodos[i]!, nodos[i + 1]!];
        const ya = y(a);
        const yb = y(b);
        let mejor: { x: number; s: number } | null = null;
        for (const x of columnasRiel(this.cfg.columnas)) {
          if (!this.libre(x, ya) || !this.libre(x, yb)) continue;
          const s = this.cruces([x, ya], [x, yb]) * 4 + (this.cfg.columnas - x) * 0.05;
          if (!mejor || s < mejor.s) mejor = { x, s };
        }
        if (mejor) this.nuevoCable([mejor.x, ya], [mejor.x, yb], this.colorDe(red));
      }
    }
  }

  // ---------------------------------------------------------------- run

  ejecutar(): ResultadoColocacion {
    const f = this.f;
    const redesF: Record<string, string> = { ...f.redes };
    const red = (c: Componente, p: string | null, i: number) => (p ? (redesF[`${c.id}.${p}`] ?? `nc:${c.id}:${p}`) : `nc:${c.id}:${i}`);
    const tensiones = estimarTensiones(f);
    // Logic gates and flip-flops into 74HC chips (logica.ts), filled left to right as drawn.
    const posDe = (c: Componente) => f.posiciones[c.id] ?? [0, 0];
    const enOrden = [...f.componentes].sort((a, b) => posDe(a)[0] - posDe(b)[0] || posDe(a)[1] - posDe(b)[1]);
    let nChip = 0;
    const usosRed = new Map<string, number>();
    for (const r of Object.values(redesF)) usosRed.set(r, (usosRed.get(r) ?? 0) + 1);
    const { chips, resto } = empaquetar(enOrden, () => `ci${++nChip}`, (id, pin) => (usosRed.get(redesF[`${id}.${pin}`] ?? '') ?? 0) >= 2);
    const componentes = f.componentes.filter((c) => resto.includes(c));
    // Their supply: a DC source of 2 to 6 V from a net to ground, or a 5 V bench supply of their own.
    let vcc: string | null = null;
    if (chips.length) {
      for (const c of f.componentes) {
        const v = tensionFuente(c);
        if (!esFuenteContinua(c) || encapsuladoDe(c).id !== 'alimentacion' || v == null || v < 2 || v > 6) continue;
        const [a, b] = [redesF[`${c.id}.end`], redesF[`${c.id}.start`]];
        if (a && b === '0' && a !== '0') {
          vcc = a;
          break;
        }
      }
      if (!vcc) {
        const usadas = new Set(Object.values(redesF));
        vcc = ['vcc', 'vdd', 'vcc_ci', 'vcc_74hc'].find((n) => !usadas.has(n)) ?? 'vcc_74hc';
        const nombres = new Set(f.componentes.map((c) => c.nombre.toUpperCase()));
        const nombre = ['VCC', 'VDD', 'VCC1', 'VCC2'].find((n) => !nombres.has(n)) ?? 'VCC9';
        const fuente: Componente = { id: 'vcc74', tipo: 'V', nombre, x: 0, y: 0, o: 0, campos: { forma: 'dc', dc: '5' } };
        componentes.unshift(fuente);
        redesF['vcc74.end'] = vcc;
        redesF['vcc74.start'] = '0';
        this.notas.push(`Los chips 74HC se alimentan con una fuente de 5 V añadida (${nombre}).`);
      }
    }
    const partes: Parte[] = [];
    for (const c of componentes) {
      let enc = encapsuladoDe(c);
      if (!patasCompletas(c, enc)) {
        const pines = pinesDe(c);
        enc = { id: 'modulo', forma: 'fila', patas: pines, nombres: pines, marca: c.nombre, descripcion: 'Módulo' };
      }
      const [x, y] = c.id === 'vcc74' ? [-1e6, 0] : (f.posiciones[c.id] ?? [0, 0]);
      const redes = enc.patas.map((p, i) => red(c, p, i));
      const parte: Parte = { comp: c, enc, redes, x, y };
      if (enc.polar) {
        const va = tensiones.get(redes[0]!) ?? 0;
        const vb = tensiones.get(redes[1]!) ?? 0;
        parte.polo = va >= vb ? 0 : 1;
      }
      partes.push(parte);
    }
    for (const ch of chips) {
      const enc = encapsuladoDe(ch.comp);
      const redes = ch.patas.map((pin, i) => {
        if (pin) return redesF[pin.replace('|', '.')] ?? `nc:${ch.comp.id}:${i}`;
        const t = ch.ataduras[i];
        if (t && typeof t === 'object' && 'pin' in t) return redesF[t.pin] ?? `nc:${ch.comp.id}:${i}`;
        // A board-only node (XOR output → D of a T flip-flop): a net of its own, with no pin.
        if (t && typeof t === 'object' && 'interna' in t) return `int:${t.interna}`;
        return t === '+' ? vcc! : t === '-' ? '0' : `nc:${ch.comp.id}:${i}`;
      });
      // A leg tied to another leg's net (K of a T flip-flop, joined to J).
      ch.patas.forEach((_, i) => {
        const t = ch.ataduras[i];
        if (t && typeof t === 'object' && 'igual' in t) redes[i] = redes[t.igual]!;
      });
      // (a chip of XORs of T flip-flops holds none of their parts: it goes where the first one is)
      const primero = ch.comps[0] ?? f.componentes.find((c) => ch.patas.some((q) => q?.startsWith(`${c.id}|`)));
      const [x, y] = primero ? posDe(primero) : [0, 0];
      partes.push({ comp: ch.comp, enc: { ...enc, patas: ch.patas }, redes, x, y, chip: ch });
    }

    // Supplies: DC sources from a net to ground.
    const usos = new Map<string, number>();
    for (const p of partes) if (p.enc.forma !== 'externo') for (const r of p.redes) usos.set(r, (usos.get(r) ?? 0) + 1);
    const positivas: { red: string; n: number }[] = [];
    const negativas: { red: string; n: number }[] = [];
    for (const p of partes) {
      if (p.enc.id !== 'alimentacion') continue;
      const v = tensionFuente(p.comp);
      const [mas, menos] = [p.redes[0]!, p.redes[1]!];
      if (menos === '0' && mas !== '0') ((v ?? 1) >= 0 ? positivas : negativas).push({ red: mas, n: usos.get(mas) ?? 0 });
      else if (mas === '0' && menos !== '0') ((v ?? 1) >= 0 ? negativas : positivas).push({ red: menos, n: usos.get(menos) ?? 0 });
    }
    const orden = (l: { red: string; n: number }[]) => [...new Map(l.sort((a, b) => b.n - a.n).map((x) => [x.red, x])).values()];
    const pos = orden(positivas);
    const neg = orden(negativas);
    for (const x of pos) this.signoRed.set(x.red, 1);
    for (const x of neg) this.signoRed.set(x.red, -1);
    const hayTierra = partes.some((p) => p.redes.includes('0'));
    const arriba = pos[0]?.red ?? neg[0]?.red ?? null;
    const abajo = neg.find((x) => x.red !== arriba)?.red ?? pos.find((x) => x.red !== arriba)?.red ?? arriba;
    this.redRiel = [arriba, hayTierra ? '0' : null, hayTierra ? '0' : null, abajo];
    for (let p = 0; p < this.cfg.placas; p++) this.redRiel.forEach((r, i) => r && this.condRed.set(`R${p}:${i}`, r));
    // Ideal op-amps: their supply legs go to the supplies (they are not in the model).
    const masPos = arriba && this.signoRed.get(arriba) === 1 ? arriba : null;
    const masNeg = neg[0]?.red ?? (hayTierra ? '0' : null);
    for (const p of partes)
      if (p.enc.alimentacion)
        for (const [i, s] of Object.entries(p.enc.alimentacion)) {
          const r = s === '+' ? masPos : masPos ? masNeg : null;
          if (r) p.redes[Number(i)] = r;
        }

    for (const p of partes) for (const r of p.redes) this.restantes.set(r, (this.restantes.get(r) ?? 0) + 1);
    // Order: leftmost first, then by shared signal nets with what is placed.
    const placa = partes.filter((p) => p.enc.forma !== 'externo' && p.enc.forma !== 'uno');
    const sondas = partes.filter((p) => p.enc.forma === 'uno');
    const externos = partes.filter((p) => p.enc.forma === 'externo').sort((a, b) => a.x - b.x || a.y - b.y);
    const alimentacion = new Set([...this.redRiel.filter((r): r is string => !!r)]);
    const presentes = new Set<string>();
    const pendientes = [...placa].sort((a, b) => a.x - b.x || a.y - b.y);
    while (pendientes.length) {
      let iMejor = 0;
      let sMejor = -1;
      pendientes.forEach((p, i) => {
        let s = 0;
        for (const r of new Set(p.redes)) if (!alimentacion.has(r) && presentes.has(r)) s++;
        if (s > sMejor) {
          sMejor = s;
          iMejor = i;
        }
      });
      const p = pendientes.splice(iMejor, 1)[0]!;
      this.colocar(p);
      for (const r of p.redes) presentes.add(r);
    }
    for (const s of sondas) this.colocar(s);
    // Nets that only equipment touches still need a strip: the leads open it.
    this.colocarEquipos(externos);
    this.puentearRieles();
    // Chips numbered as they sit on the boards (top to bottom, left to right).
    const chipsPuestos = this.piezas.filter((p) => p.chip).sort((a, b) => Math.floor(a.pos[0]![1] / ALTO_PLACA) - Math.floor(b.pos[0]![1] / ALTO_PLACA) || a.pos[0]![0] - b.pos[0]![0]);
    chipsPuestos.forEach((p, i) => (p.comp.nombre = `CI${i + 1}`));

    // Every strip of a net joined? (a net opened twice by equipment leads, or a jumper with no free hole)
    const doc: DocumentoProtoboard = {
      version: 1,
      titulo: f.titulo,
      placas: this.cfg.placas,
      columnas: this.cfg.columnas,
      piezas: this.piezas.map((p) => ({ ...p, comp: { ...p.comp } })),
      cables: this.cables,
      analisis: f.analisis,
      directivas: f.directivas,
      original: Object.fromEntries(
        this.piezas.flatMap((p) =>
          p.patas.flatMap((pin) => {
            const k = pin ? clavePin(p, pin) : '';
            return pin && redesF[k] ? [[k, redesF[k]!]] : [];
          }),
        ),
      ),
      ...(f.refs?.length ? { refs: f.refs } : {}),
      origen: f.origen,
    };
    // Keep the equipment's parts in their schematic order in the doc (piezas: board parts, then equipment).
    const placas = this.cfg.placas > 1 ? `${this.cfg.placas} placas de 830 puntos` : this.cfg.columnas <= 30 ? 'una placa de 400 puntos' : 'una placa de 830 puntos';
    this.notas.push(`Montado en ${placas}.`);
    return { doc, notas: this.notas };
  }
}

/** Do two segments cross (proper intersection, not touching at the ends)? */
export function seCruzan(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return d1 * d2 < -1e-9 && d3 * d4 < -1e-9;
}
