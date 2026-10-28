// Netlist → editable drawing: the automatic schematic's layout (esquema-auto, in a worker) turned into the
// editor's parts and wires. Every drawn part keeps what its netlist line says beyond its nodes (value, model,
// parameters, verbatim), every wire keeps the name of its node, and every line that is not a drawn part
// (models, subcircuits, parameters, analyses, .control…) stays in the directives, so the drawing gives back an
// equivalent netlist: the same simulation.

import type { DispositivoEditable, EditableAuto } from '../esquema-auto/editable.ts';
import { trocear } from '../esquema-auto/modelo.ts';
import { lineasNetlist, numeroSpice } from '../../simulador/motor/netlist.ts';
import type { PeticionEditable, RespuestaEditable } from './trabajador.ts';
import { PUENTE_DIODOS } from './catalogo.ts';
import { pinesMundo } from './geometria.ts';
import { huecoLibre, ruta, tramos, type P } from './rutas.ts';
import { analisisPorDefecto, type Cable, type Componente, type DocumentoEsquema, type FormaImportada } from './tipos.ts';
import { deSpice } from './valores.ts';

// ------------------------------------------------------------------ worker client

let trabajador: Worker | null = null;
let siguiente = 1;
const pendientes = new Map<number, { ok: (r: EditableAuto | null) => void; mal: (e: Error) => void }>();

function enTrabajador(texto: string): Promise<EditableAuto | null> {
  if (!trabajador) {
    trabajador = new Worker(new URL('./trabajador.ts', import.meta.url), { type: 'module', name: 'editor-esquemas' });
    trabajador.onmessage = (ev: MessageEvent<RespuestaEditable>) => {
      const p = pendientes.get(ev.data.id);
      if (!p) return;
      pendientes.delete(ev.data.id);
      if (ev.data.ok) p.ok(ev.data.r);
      else p.mal(new Error(ev.data.error));
    };
    trabajador.onerror = () => {
      for (const p of pendientes.values()) p.mal(new Error('No se ha podido dibujar la netlist.'));
      pendientes.clear();
      trabajador = null;
    };
  }
  const id = siguiente++;
  return new Promise((ok, mal) => {
    pendientes.set(id, { ok, mal });
    trabajador!.postMessage({ id, texto } satisfies PeticionEditable);
  });
}

// ------------------------------------------------------------------ netlist lines

interface LineaElem {
  nombre: string;
  letra: string;
  nodos: string[];
  resto: string;
  /** Physical lines it spans (0-based, first and last). */
  desde: number;
  hasta: number;
}

const NODOS: Record<string, number> = { R: 2, C: 2, L: 2, D: 2, V: 2, I: 2, E: 4, G: 4, F: 2, H: 2, B: 2, Q: 3, M: 4, J: 3, Z: 3, S: 4, W: 2, T: 4, O: 4, U: 3, K: 0 };

/** Top-level element lines of a netlist, split into name, nodes and the rest (verbatim). */
function lineasElemento(texto: string): Map<string, LineaElem> {
  const fisicas = texto.replace(/\r\n?/g, '\n').split('\n');
  const res = new Map<string, LineaElem>();
  for (const l of lineasNetlist(texto).lineas) {
    if (l.subckt || !l.tokens.length || l.tokens[0]!.startsWith('.')) continue;
    let hasta = l.linea;
    while (hasta + 1 < fisicas.length && /^\s*\+/.test(fisicas[hasta + 1]!)) hasta++;
    // The logical line as written, continuations joined, inline comments dropped.
    const crudo = fisicas
      .slice(l.linea, hasta + 1)
      .map((f, i) => (i ? f.replace(/^\s*\+/, ' ') : f).replace(/;.*$/, '').replace(/\s\$.*$/, ''))
      .join(' ')
      .trim();
    const partes = crudo.split(/\s+/);
    const nombre = partes[0]!;
    const letra = nombre[0]!.toUpperCase();
    let n = NODOS[letra];
    if (letra === 'X') {
      const sin = partes.slice(1).filter((x) => !x.includes('=') && !/^params:$/i.test(x));
      n = Math.max(0, sin.length - 1);
    }
    if (n == null) continue;
    // Nodes are the first plain tokens; a value glued to «(» ends them (V1 a 0 SIN(…)).
    const nodos: string[] = [];
    let i = 1;
    while (nodos.length < n && i < partes.length && !/[()=]/.test(partes[i]!)) nodos.push(partes[i++]!.toLowerCase().replace(/^gnd$/, '0'));
    // The rest, verbatim from the first token after the nodes.
    let pos = 0;
    for (let j = 0; j < i; j++) pos = crudo.indexOf(partes[j]!, pos) + partes[j]!.length;
    res.set(nombre.toLowerCase(), { nombre, letra, nodos, resto: crudo.slice(pos).trim(), desde: l.linea, hasta });
  }
  return res;
}

/** Pin index on the netlist line of a terminal (as esquema-auto's generar.ts indicePin). */
function indicePin(d: DispositivoEditable, t: string): number | null {
  const p = d.pines.find((x) => x.nombre === t) ?? d.ocultos.find((x) => x.nombre === t);
  if (p?.indice != null) return p.indice;
  switch (d.letra) {
    case 'R':
    case 'C':
    case 'L':
    case 'D':
    case 'S':
    case 'W':
    case 'I':
    case 'G':
    case 'F':
      return t === 'start' ? 0 : t === 'end' ? 1 : null;
    case 'V':
    case 'H':
    case 'E':
    case 'B':
      if (d.simbolo === 'DEPI') return t === 'start' ? 0 : t === 'end' ? 1 : null;
      return t === 'end' ? 0 : t === 'start' ? 1 : null;
    case 'Q':
      return ({ collector: 0, base: 1, emitter: 2 } as Record<string, number>)[t] ?? null;
    case 'M':
      return ({ drain: 0, gate: 1, source: 2, bulk: 3 } as Record<string, number>)[t] ?? null;
    case 'J':
    case 'Z':
      return ({ drain: 0, gate: 1, source: 2 } as Record<string, number>)[t] ?? null;
    case 'T':
    case 'O':
    case 'U':
      return ({ a: 0, a_ref: 1, b: 2, b_ref: 3 } as Record<string, number>)[t] ?? null;
    default: {
      const m = /^p(\d+)$/.exec(t);
      return m ? Number(m[1]) - 1 : null;
    }
  }
}

// ------------------------------------------------------------------ sources

/** Fields of a V/I source from its SPICE specification, or null when the editor cannot hold it exactly. */
export function camposFuente(resto: string): Record<string, string> | null {
  const t = trocear(resto);
  const c: Record<string, string> = {};
  let forma = 'dc';
  const num = (x: string | undefined) => (x != null && (numeroSpice(x) != null || /^\{.*\}$/.test(x)) ? x : null);
  for (let i = 0; i < t.length; i++) {
    const tok = t[i]!;
    const low = tok.toLowerCase();
    if (i === 0 && num(tok)) c['dc'] = deSpice(tok);
    else if (low === 'dc' && num(t[i + 1])) c['dc'] = deSpice(t[++i]!);
    else if (low === 'ac' && num(t[i + 1])) {
      c['ac'] = deSpice(t[++i]!);
      if (num(t[i + 1]) && numeroSpice(t[i + 1]!) !== 0) return null;
      if (num(t[i + 1])) i++;
    } else {
      const m = /^(sin|pulse|pwl)\((.*)\)$/is.exec(tok);
      if (!m || forma !== 'dc') return null;
      const a = trocear(m[2]!);
      if (a.some((x) => !num(x))) return null;
      const f = m[1]!.toLowerCase();
      if (f === 'sin') {
        if (a.length < 3 || a.length > 6 || (a[4] != null && numeroSpice(a[4]) !== 0)) return null;
        forma = 'sin';
        [c['vo'], c['va'], c['freq']] = [deSpice(a[0]!), deSpice(a[1]!), deSpice(a[2]!)];
        if (a[3] != null && numeroSpice(a[3]) !== 0) c['td'] = deSpice(a[3]);
        if (a[5] != null && numeroSpice(a[5]) !== 0) c['fase'] = deSpice(a[5]);
      } else if (f === 'pulse') {
        if (a.length !== 7) return null;
        forma = 'pulse';
        ['v1', 'v2', 'td', 'tr', 'tf', 'pw', 'per'].forEach((k, j) => (c[k] = deSpice(a[j]!)));
      } else {
        if (a.length < 2 || a.length % 2) return null;
        forma = 'pwl';
        const pares: string[] = [];
        for (let j = 0; j < a.length; j += 2) pares.push(`${deSpice(a[j]!)} ${deSpice(a[j + 1]!)}`);
        c['pwl'] = pares.join('; ');
      }
    }
  }
  c['forma'] = forma;
  return c;
}

// ------------------------------------------------------------------ conversion

const TIPO_DIODO: Record<string, string> = { D: 'D', DZ: 'DZ', LED: 'LED', DS: 'DS' };
const TIPO_TRANS: Record<string, string> = { NPN: 'QN', PNP: 'QP', NJF: 'JN', PJF: 'JP', NMOS: 'MN', PMOS: 'MP' };

function primeroYResto(resto: string): [string, string] {
  const t = resto.trim();
  const m = /^(\S+)\s*(.*)$/s.exec(t);
  return m ? [m[1]!, m[2]!.trim()] : ['', ''];
}

const redondo = (v: number) => Math.round(v * 1e4) / 1e4;

/** Orientation of a symbol drawn by default pointing (0, −1) (supply) that must point to `dir`. */
function orientacionHacia(dir: [number, number], base: [number, number]): number {
  for (let o = 0; o < 4; o++) {
    let [x, y] = base;
    for (let k = 0; k < o; k++) [x, y] = [-y, x];
    if (Math.abs(x - dir[0]) < 1e-6 && Math.abs(y - dir[1]) < 1e-6) return o;
  }
  return 0;
}

/** A single value token (a number or a constant expression in braces), or null. */
function valorSolo(resto: string): string | null {
  const t = resto.trim();
  if (!t || /\s/.test(t.replace(/\{[^}]*\}/g, 'x'))) return null;
  return numeroSpice(t) != null || /^\{.*\}$/.test(t) ? t : null;
}

/** A coupling factor as the reader writes it: «0,999» (not «999m»). */
function factor(tok: string): string {
  return /^[0-9.]+$/.test(tok) ? tok.replace('.', ',') : deSpice(tok);
}

type Lineas = NonNullable<Componente['lineas']>;

/**
 * The palette's transformer for an imported one when it fits exactly: two coils with one coupling, or a primary
 * and a secondary in two equal halves in series (the centre tap) with the three couplings equal. The line names
 * are kept (field «_nombres»), so the netlist it writes is the same. Returns its fields and how the layout's pins
 * map onto its own.
 */
function trafoPaleta(lineas: Lineas, claves: string[]): { campos: Record<string, string>; pines: Record<string, string> } | null {
  const ls = lineas.filter((l) => l.letra === 'L');
  const ks = lineas.filter((l) => l.letra === 'K');
  if (ls.length !== claves.length || ls.some((l) => l.nodos.length !== 2 || !valorSolo(l.resto))) return null;
  const kv = ks.map((k) => k.resto.trim().split(/\s+/));
  if (kv.some((t) => t.length !== 3 || !valorSolo(t[2]!))) return null;
  const valorK = kv[0]?.[2];
  if (!valorK || kv.some((t) => t[2] !== valorK)) return null;
  const par = (a: string, b: string) => kv.some((t) => (t[0]!.toLowerCase() === a && t[1]!.toLowerCase() === b) || (t[0]!.toLowerCase() === b && t[1]!.toLowerCase() === a));
  const n = ls.map((l) => l.nombre.toLowerCase());
  if (ls.length === 2) {
    if (ks.length !== 1 || !par(n[0]!, n[1]!)) return null;
    return {
      campos: { modo: 'inductancias', lp: deSpice(valorSolo(ls[0]!.resto)!), ls: deSpice(valorSolo(ls[1]!.resto)!), k: factor(valorK), toma: 'no', _nombres: [...ls.map((l) => l.nombre), ks[0]!.nombre].join(' ') },
      pines: { [`${claves[0]}.start`]: 'p.start', [`${claves[0]}.end`]: 'p.end', [`${claves[1]}.start`]: 's.start', [`${claves[1]}.end`]: 's.end' },
    };
  }
  if (ls.length !== 3 || ks.length !== 3 || !par(n[0]!, n[1]!) || !par(n[0]!, n[2]!) || !par(n[1]!, n[2]!)) return null;
  let [s1, s2] = [1, 2];
  let c1 = claves[1]!;
  let c2 = claves[2]!;
  if (ls[1]!.nodos[1] !== ls[2]!.nodos[0]) {
    if (ls[2]!.nodos[1] !== ls[1]!.nodos[0]) return null;
    [s1, s2] = [2, 1];
    [c1, c2] = [c2, c1];
  }
  if (valorSolo(ls[s1]!.resto) !== valorSolo(ls[s2]!.resto)) return null;
  const kOrden = [par(n[0]!, n[s1]!), par(n[0]!, n[s2]!), par(n[s1]!, n[s2]!)];
  if (kOrden.some((x) => !x)) return null;
  const kDe = (a: string, b: string) => ks.find((_, i) => (kv[i]![0]!.toLowerCase() === a && kv[i]![1]!.toLowerCase() === b) || (kv[i]![0]!.toLowerCase() === b && kv[i]![1]!.toLowerCase() === a))!.nombre;
  return {
    campos: {
      modo: 'inductancias',
      lp: deSpice(valorSolo(ls[0]!.resto)!),
      ls: deSpice(valorSolo(ls[s1]!.resto)!),
      k: factor(valorK),
      toma: 'si',
      _nombres: [ls[0]!.nombre, ls[s1]!.nombre, ls[s2]!.nombre, kDe(n[0]!, n[s1]!), kDe(n[0]!, n[s2]!), kDe(n[s1]!, n[s2]!)].join(' '),
    },
    pines: { [`${claves[0]}.start`]: 'p.start', [`${claves[0]}.end`]: 'p.end', [`${c1}.start`]: 's.start', [`${c1}.end`]: 's.mid', [`${c2}.start`]: 's.mid', [`${c2}.end`]: 's.end' },
  };
}

/** The palette's bridge for four diodes in the usual places with the same model and nothing else on their lines. */
function puentePaleta(lineas: Lineas, diodos: NonNullable<FormaImportada['diodos']>): Record<string, string> | null {
  if (lineas.length !== 4 || diodos.length !== 4) return null;
  const modelos = lineas.map((l) => (l.nodos.length === 2 && /^\S+$/.test(l.resto.trim()) ? l.resto.trim() : null));
  if (modelos.some((m) => !m || m.includes('=') || m.toLowerCase() !== modelos[0]!.toLowerCase())) return null;
  const nombres: string[] = [];
  for (const [an, ca] of PUENTE_DIODOS) {
    const i = diodos.findIndex((x) => x.anodo === an && x.catodo === ca);
    if (i < 0) return null;
    nombres.push(diodos[i]!.nombre);
  }
  return { modelo: modelos[0]!, _nombres: nombres.join(' ') };
}

/**
 * A subcircuit that is just a diode bridge (four diodes between its four ports, one model defined outside it, no
 * parameters): which port is ∿1, ∿2, + and −, and the model.
 */
function subcircuitoPuente(texto: string, nombre: string): { puertos: ('a' | 'b' | 'p' | 'n')[]; modelo: string } | null {
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n');
  const i0 = lineas.findIndex((l) => new RegExp(`^\\s*\\.subckt\\s+${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s`, 'i').test(l));
  if (i0 < 0) return null;
  const cab = lineas[i0]!.trim().split(/\s+/).slice(2);
  if (cab.length !== 4 || cab.some((x) => x.includes('='))) return null;
  const puertos = cab.map((x) => x.toLowerCase());
  const diodos: [string, string, string][] = [];
  for (let i = i0 + 1; i < lineas.length; i++) {
    const t = lineas[i]!.trim();
    if (!t || t.startsWith('*')) continue;
    if (/^\.ends/i.test(t)) break;
    const tk = t.replace(/;.*$/, '').trim().split(/\s+/);
    if (!/^d/i.test(tk[0]!) || tk.length !== 4) return null;
    diodos.push([tk[1]!.toLowerCase(), tk[2]!.toLowerCase(), tk[3]!]);
  }
  if (diodos.length !== 4 || diodos.some((d) => d[2].toLowerCase() !== diodos[0]![2].toLowerCase())) return null;
  const catodos = new Map<string, number>();
  const anodos = new Map<string, number>();
  for (const [a, c] of diodos) {
    catodos.set(c, (catodos.get(c) ?? 0) + 1);
    anodos.set(a, (anodos.get(a) ?? 0) + 1);
  }
  const p = [...catodos.entries()].find(([, n]) => n === 2)?.[0];
  const n = [...anodos.entries()].find(([, k]) => k === 2)?.[0];
  if (!p || !n || p === n) return null;
  const ac = puertos.filter((x) => x !== p && x !== n);
  if (ac.length !== 2 || !puertos.includes(p) || !puertos.includes(n)) return null;
  for (const x of ac) if (!diodos.some((d) => d[0] === x && d[1] === p) || !diodos.some((d) => d[0] === n && d[1] === x)) return null;
  return { puertos: puertos.map((x) => (x === p ? 'p' : x === n ? 'n' : x === ac[0] ? 'a' : 'b')), modelo: diodos[0]![2] };
}

export function documentoDeEditable(texto: string, e: EditableAuto, origen: DocumentoEsquema['origen']): DocumentoEsquema {
  const fisicas = texto.replace(/\r\n?/g, '\n').split('\n');
  const elems = lineasElemento(texto);
  const usadas = new Set<number>();
  const componentes: Componente[] = [];
  const cables: Cable[] = [];
  let nc = 0;
  let nw = 0;
  const cid = () => `c${++nc}`;
  const wid = () => `w${++nw}`;
  const marcar = (l: LineaElem) => {
    for (let i = l.desde; i <= l.hasta; i++) usadas.add(i);
  };
  /** Pins that moved when a layout's symbol became a palette part: [where the layout's wires end, the new pin]. */
  const reconectar: [P, P, string][] = [];
  /** Turns an imported part into a palette part, keeping the layout's wires connected. */
  const convertir = (gen: Componente, nuevo: Componente, mapa: Record<string, string>) => {
    const viejos = pinesMundo(gen);
    const nuevos = new Map(pinesMundo(nuevo).map((q) => [q.nombre, q]));
    for (const v of viejos) {
      const q = nuevos.get(mapa[v.nombre] ?? '');
      if (q && (Math.abs(q.x - v.x) > 1e-6 || Math.abs(q.y - v.y) > 1e-6)) reconectar.push([[v.x, v.y], [q.x, q.y], nuevo.id]);
    }
    return nuevo;
  };
  let nTrafo = 0;
  let nPuente = 0;
  /** Subcircuit bridges to turn into the palette's bridge once the wires are known (a free place for the diamond). */
  const puentesX: { gen: Componente; nuevo: Componente; mapa: Record<string, string> }[] = [];

  for (const p of e.partes) {
    const d = p.disp;
    const base = { id: cid(), nombre: d.nombre, x: redondo(p.x), y: redondo(p.y), o: p.o, ...(p.v ? { v: p.v } : {}) };
    // Several lines: transformer coils (with their couplings) and diode bridges.
    if (d.simbolo === 'TRAFO' || d.simbolo === 'PUENTE') {
      const subs = d.simbolo === 'TRAFO' ? (d.bobinas ?? []) : (d.diodos ?? []).map((x) => x.d);
      const lineas: NonNullable<Componente['lineas']> = [];
      let ok = true;
      subs.forEach((s, i) => {
        const l = elems.get(s.nombre.toLowerCase());
        if (!l) {
          ok = false;
          return;
        }
        marcar(l);
        const pines: Record<string, number> =
          d.simbolo === 'TRAFO' ? { [`${s.clave}.start`]: 0, [`${s.clave}.end`]: 1 } : { [d.diodos![i]!.anodo]: 0, [d.diodos![i]!.catodo]: 1 };
        lineas.push({ nombre: l.nombre, letra: l.letra, nodos: l.nodos, pines, resto: l.resto });
      });
      if (d.simbolo === 'TRAFO') {
        const nombres = new Set(subs.map((s) => s.nombre.toLowerCase()));
        for (const l of elems.values()) {
          if (l.letra !== 'K') continue;
          const refs = l.resto.split(/\s+/).filter((x) => /^l/i.test(x));
          if (refs.length >= 2 && refs.every((r) => nombres.has(r.toLowerCase()))) {
            marcar(l);
            lineas.push({ nombre: l.nombre, letra: 'K', nodos: [], pines: {}, resto: l.resto });
          }
        }
      }
      if (!ok) continue;
      const forma: FormaImportada = {
        simbolo: d.simbolo,
        pines: d.pines.map((x) => ({ nombre: x.nombre, ...(x.rotulo ? { rotulo: x.rotulo } : {}) })),
        ...(d.simbolo === 'TRAFO' ? { bobinas: subs.map((s) => s.clave) } : { diodos: d.diodos!.map((x) => ({ nombre: x.d.nombre, anodo: x.anodo, catodo: x.catodo })) }),
      };
      const gen: Componente = { ...base, nombre: d.simbolo === 'TRAFO' ? subs.map((s) => s.nombre).join('·') : d.nombre || 'Puente', tipo: 'GEN', campos: {}, forma, lineas };
      // 0.10: the palette's transformer and bridge when they hold the lines exactly.
      if (d.simbolo === 'TRAFO') {
        const t = trafoPaleta(lineas, subs.map((s) => s.clave));
        if (t) {
          componentes.push(convertir(gen, { ...base, tipo: 'TRAFO', nombre: `T${++nTrafo}`, campos: t.campos }, t.pines));
          continue;
        }
      } else {
        const b = puentePaleta(lineas, forma.diodos!);
        if (b) {
          componentes.push({ ...base, tipo: 'PUENTE', nombre: `BR${++nPuente}`, campos: b });
          continue;
        }
      }
      componentes.push(gen);
      continue;
    }
    const l = elems.get(d.nombre.toLowerCase());
    if (!l) continue;
    marcar(l);
    const pines: Record<string, number> = {};
    for (const pin of d.pines) {
      const k = indicePin(d, pin.nombre);
      if (k != null) pines[pin.nombre] = k;
    }
    const s = d.simbolo;
    const simple = (tipo: string, campos: Record<string, string>): Componente => ({ ...base, tipo, campos });
    let c: Componente | null = null;
    const [v0, resto0] = primeroYResto(l.resto);
    const valorOk = v0 && (numeroSpice(v0) != null || /^\{.*\}$/.test(v0));
    if ((s === 'R' || s === 'C' || s === 'L') && l.nodos.length === 2 && valorOk) {
      c = simple(s, { valor: deSpice(v0), ...(resto0 ? { extra: resto0 } : {}) });
    } else if ((s === 'VDC' || s === 'VSIN' || s === 'VPULSO' || s === 'VPWL') && l.letra === 'V') {
      const f = camposFuente(l.resto);
      c = simple('V', f ?? { forma: 'texto', spec: l.resto });
    } else if ((s === 'IDC' || s === 'ISIN' || s === 'IPULSO') && l.letra === 'I') {
      const f = camposFuente(l.resto);
      c = simple('I', f && f['forma'] !== 'pwl' ? f : { forma: 'texto', spec: l.resto });
    } else if (TIPO_DIODO[s] && l.letra === 'D' && v0) {
      c = simple(TIPO_DIODO[s]!, { modelo: v0, ...(resto0 ? { extra: resto0 } : {}) });
    } else if (TIPO_TRANS[s] && v0) {
      const t = TIPO_TRANS[s]!;
      const bulkEnFuente = l.letra === 'M' && l.nodos.length === 4 && l.nodos[3] === l.nodos[2] && !d.pines.some((x) => x.nombre === 'bulk');
      if ((l.letra === 'Q' && l.nodos.length === 3 && /^[^=]+$/.test(v0)) || (l.letra === 'J' && l.nodos.length === 3) || bulkEnFuente)
        c = simple(t, { modelo: v0, ...(resto0 ? { extra: resto0 } : {}) });
    }
    if (!c && l.letra === 'X' && l.nodos.length === 4) {
      // A subcircuit that is only a diode bridge: the palette's bridge, its diodes written at the top level.
      const sub = primeroYResto(l.resto)[0];
      const pb = sub && !l.resto.trim().includes(' ') ? subcircuitoPuente(texto, sub) : null;
      // Not when the text looks inside the instance (@d.xb1.d1[id], v(xb1.n)): those names would be lost.
      const interno = new RegExp(`(^|[^a-z0-9_])${l.nombre.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`, 'i').test(texto);
      if (pb && !interno && !definidoDentro(texto, pb.modelo)) {
        const gen: Componente = {
          ...base,
          tipo: 'GEN',
          campos: { resto: l.resto },
          spice: { letra: l.letra, nodos: l.nodos, pines, resto: l.resto },
          forma: { simbolo: s, pines: d.pines.map((x) => ({ nombre: x.nombre, ...(x.rotulo ? { rotulo: x.rotulo } : {}) })), ...(d.titulo ? { titulo: d.titulo } : {}) },
        };
        const mapa: Record<string, string> = {};
        for (const [pin, k] of Object.entries(pines)) mapa[pin] = pb.puertos[k]!;
        puentesX.push({ gen, nuevo: { ...base, o: 0, tipo: 'PUENTE', campos: { modelo: pb.modelo } }, mapa });
        c = gen;
      }
    }
    if (!c) {
      c = {
        ...base,
        tipo: 'GEN',
        campos: { resto: l.resto },
        spice: { letra: l.letra, nodos: l.nodos, pines, resto: l.resto },
        forma: { simbolo: s, pines: d.pines.map((x) => ({ nombre: x.nombre, ...(x.rotulo ? { rotulo: x.rotulo } : {}) })), ...(d.titulo ? { titulo: d.titulo } : {}) },
      };
    }
    componentes.push(c);
  }

  // Wires, keeping their node names.
  for (const w of e.cables)
    for (const r of w.runs) cables.push({ id: wid(), p: [redondo(r[0]), redondo(r[1]), redondo(r[2]), redondo(r[3])], red: w.red === '0' ? undefined : w.red });
  const polilinea = (pts: [number, number][], red?: string) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-6) cables.push({ id: wid(), p: [redondo(a[0]), redondo(a[1]), redondo(b[0]), redondo(b[1])], ...(red ? { red } : {}) });
    }
  };
  for (const t of e.tierras) {
    // The editor's ground carries its own 0.45 lead: wire up to the last bend, the symbol hangs from there.
    const pata = t.pata as [number, number][];
    const fin = pata.length > 2 ? pata[pata.length - 2]! : pata[0]!;
    if (pata.length > 2) polilinea(pata.slice(0, -1));
    const o = t.dir[1] < 0 ? 2 : 0;
    componentes.push({ id: cid(), tipo: 'GND', nombre: '', x: redondo(fin[0]), y: redondo(fin[1]), o, campos: {} });
  }
  for (const r of e.rieles) {
    const p0 = r.pata[0]!;
    componentes.push({ id: cid(), tipo: 'RIEL', nombre: '', x: redondo(p0[0]), y: redondo(p0[1]), o: orientacionHacia(r.dir as [number, number], [0, -1]), campos: { red: r.red } });
  }
  for (const et of e.etiquetas)
    componentes.push({ id: cid(), tipo: 'ETQ', nombre: '', x: redondo(et.pin[0]), y: redondo(et.pin[1]), o: orientacionHacia(et.dir as [number, number], [1, 0]), campos: { red: et.red } });

  // The layout's wires come as unit runs: joined into straight segments, so that two nets crossing at a grid
  // point cross inside their segments (no connection) instead of both ending there (which would join them).
  const unidos = fusionarTramos(cables, componentes);
  cables.length = 0;
  for (const w of unidos) cables.push({ ...w, id: wid() });

  // Subcircuit bridges: the diamond in a free place near the box (it is bigger), wired to the box's pins.
  for (const { gen, nuevo, mapa } of puentesX) {
    const doc0: DocumentoEsquema = { version: 1, titulo: '', componentes, cables, analisis: analisisPorDefecto(), directivas: '' };
    const gv = pinesMundo(gen);
    const centro: P = [gv.reduce((a, q) => a + q.x, 0) / gv.length, gv.reduce((a, q) => a + q.y, 0) / gv.length];
    const sitio = huecoLibre(doc0, nuevo, centro, 14, new Set([gen.id]));
    if (!sitio) continue;
    nuevo.x = sitio[0];
    nuevo.y = sitio[1];
    componentes[componentes.indexOf(gen)] = convertir(gen, nuevo, mapa);
  }

  // Pins of the palette parts that are not where the layout drew them: a routed wire from the old place (the part
  // is an obstacle, its pin the destination); when there is no way, a pair of net labels (or grounds) joins them.
  if (reconectar.length) {
    const doc0: DocumentoEsquema = { version: 1, titulo: '', componentes, cables, analisis: analisisPorDefecto(), directivas: '' };
    for (const [a, b] of reconectar) {
      const pts = ruta(doc0, a, [b]);
      if (pts) {
        for (const t of tramos(pts)) if (Math.hypot(t[2] - t[0], t[3] - t[1]) > 1e-6) cables.push({ id: wid(), p: t });
        continue;
      }
      const red = cables.find((w) => (Math.abs(w.p[0] - a[0]) < 1e-6 && Math.abs(w.p[1] - a[1]) < 1e-6) || (Math.abs(w.p[2] - a[0]) < 1e-6 && Math.abs(w.p[3] - a[1]) < 1e-6))?.red;
      for (const q of [a, b]) componentes.push(red ? { id: cid(), tipo: 'ETQ', nombre: '', x: q[0], y: q[1], o: 0, campos: { red } } : { id: cid(), tipo: 'GND', nombre: '', x: q[0], y: q[1], o: 0, campos: {} });
    }
  }

  // Everything else stays as directives, in order (title and .end out).
  const directivas: string[] = [];
  fisicas.forEach((f, i) => {
    if (i === 0 || usadas.has(i)) return;
    if (/^\s*\.end\s*$/i.test(f)) return;
    directivas.push(f);
  });
  while (directivas.length && !directivas[directivas.length - 1]!.trim()) directivas.pop();
  while (directivas.length && !directivas[0]!.trim()) directivas.shift();
  const titulo = (fisicas[0] ?? '').replace(/^\s*\*+\s*/, '').trim() || 'Circuito importado';
  const tieneAnalisis = /^\s*\.(op|tran|ac|dc|noise|tf|pz|sens|four|disto)\b/im.test(directivas.join('\n')) || /^\s*\.control/im.test(directivas.join('\n'));
  const analisis = analisisPorDefecto();
  analisis.op = !tieneAnalisis;
  return { version: 1, titulo, componentes, cables, analisis, directivas: directivas.join('\n'), origen };
}

/**
 * Straight runs of each net joined into the longest segments: a point where exactly two collinear runs of the
 * net meet, with no pin on it, disappears.
 */
function fusionarTramos(cables: Cable[], componentes: Componente[]): Omit<Cable, 'id'>[] {
  const k = (x: number, y: number) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
  const pines = new Set<string>();
  for (const c of componentes) for (const p of pinesMundo(c)) pines.add(k(p.x, p.y));
  const porRed = new Map<string, Cable[]>();
  for (const w of cables) {
    const r = w.red ?? '0';
    (porRed.get(r) ?? porRed.set(r, []).get(r)!).push(w);
  }
  const res: Omit<Cable, 'id'>[] = [];
  for (const [red, ws] of porRed) {
    // Points of the net and the runs at each.
    const en = new Map<string, number[]>();
    ws.forEach((w, i) => {
      for (const kk of [k(w.p[0], w.p[1]), k(w.p[2], w.p[3])]) (en.get(kk) ?? en.set(kk, []).get(kk)!).push(i);
    });
    const hor = (w: Cable) => Math.abs(w.p[1] - w.p[3]) < 1e-9;
    const usado = new Set<number>();
    const paso = (kk: string, desde: number): number | null => {
      const l = en.get(kk)!;
      if (l.length !== 2 || pines.has(kk)) return null;
      const otro = l[0] === desde ? l[1]! : l[0]!;
      return hor(ws[otro]!) === hor(ws[desde]!) && !usado.has(otro) ? otro : null;
    };
    ws.forEach((w, i) => {
      if (usado.has(i)) return;
      usado.add(i);
      let a: [number, number] = [w.p[0], w.p[1]];
      let b: [number, number] = [w.p[2], w.p[3]];
      // Extend from both ends.
      for (const lado of [0, 1] as const) {
        let actual = i;
        let punto = lado ? b : a;
        for (;;) {
          const sig = paso(k(punto[0], punto[1]), actual);
          if (sig == null) break;
          usado.add(sig);
          const s = ws[sig]!;
          const lejos: [number, number] = k(s.p[0], s.p[1]) === k(punto[0], punto[1]) ? [s.p[2], s.p[3]] : [s.p[0], s.p[1]];
          punto = lejos;
          actual = sig;
        }
        if (lado) b = punto;
        else a = punto;
      }
      res.push({ p: [a[0], a[1], b[0], b[1]], ...(red !== '0' && w.red ? { red: w.red } : {}) });
    });
  }
  return res;
}

/** Is a model name defined inside some subcircuit (so it cannot be used at the top level)? */
function definidoDentro(texto: string, modelo: string): boolean {
  let dentro = 0;
  for (const l of texto.split('\n')) {
    const t = l.trim().toLowerCase();
    if (t.startsWith('.subckt')) dentro++;
    else if (t.startsWith('.ends')) dentro = Math.max(0, dentro - 1);
    else if (dentro && new RegExp(`^\\.model\\s+${modelo.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s`).test(t)) return true;
  }
  return false;
}

/** The automatic schematic's layout of a netlist, as editable data (in the editor's worker). */
export function disponerNetlist(texto: string): Promise<EditableAuto | null> {
  return enTrabajador(texto);
}

/** Opens a netlist text as a drawing (null when nothing in it can be drawn). */
export async function importarNetlist(texto: string, origen: DocumentoEsquema['origen']): Promise<DocumentoEsquema | null> {
  const e = await enTrabajador(texto);
  if (!e || (!e.partes.length && !e.tierras.length)) return null;
  return documentoDeEditable(texto, e, origen);
}
