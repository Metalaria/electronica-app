// Netlist → editable drawing: the automatic schematic's layout (esquema-auto, in a worker) turned into the
// editor's parts and wires. Every drawn part keeps what its netlist line says beyond its nodes (value, model,
// parameters, verbatim), every wire keeps the name of its node, and every line that is not a drawn part
// (models, subcircuits, parameters, analyses, .control…) stays in the directives, so the drawing gives back an
// equivalent netlist: the same simulation.

import type { DispositivoEditable, EditableAuto } from '../esquema-auto/editable.ts';
import { trocear } from '../esquema-auto/modelo.ts';
import { lineasNetlist, numeroSpice } from '../../simulador/motor/netlist.ts';
import type { PeticionEditable, RespuestaEditable } from './trabajador.ts';
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
      componentes.push({ ...base, nombre: d.simbolo === 'TRAFO' ? subs.map((s) => s.nombre).join('·') : d.nombre || 'Puente', tipo: 'GEN', campos: {}, forma, lineas });
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

/** Opens a netlist text as a drawing (null when nothing in it can be drawn). */
export async function importarNetlist(texto: string, origen: DocumentoEsquema['origen']): Promise<DocumentoEsquema | null> {
  const e = await enTrabajador(texto);
  if (!e || (!e.partes.length && !e.tierras.length)) return null;
  return documentoDeEditable(texto, e, origen);
}
