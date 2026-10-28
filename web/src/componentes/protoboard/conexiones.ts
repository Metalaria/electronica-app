// Electrical connectivity of a breadboard: what each leg, wire end and equipment terminal touches (the
// strip of 5 holes or the rail it is plugged into), the nets that result, their names, and the netlist
// written by the schematic editor's own writer (editor/netlist.ts) from those nets. Plain TypeScript.
//
// Net names: when the board was made from a schematic (`doc.original`), each net takes the original name
// most of its pins had (ground «0» first), so the directives' v(out), .meas and .control keep working and
// the live schematic keeps the book's node names; a name left out because its pins were merged into
// another net is rewritten in the directives' v(…) expressions. Other nets are n1, n2…
// Ground without an original: the net of the − terminal of the first bench supply.

import type { Conectividad, Red } from '../editor/conectividad.ts';
import { generarNetlist, type Aviso, type Netlist } from '../editor/netlist.ts';
import type { DocumentoEsquema } from '../editor/tipos.ts';
import { EXTERNOS } from './encapsulados.ts';
import { agujero, clavePt, type ConfigPlaca, type Pt } from './placa.ts';
import { clavePin, compsDe, type DocumentoProtoboard } from './tipos.ts';

export interface RedProto {
  nombre: string;
  /** «pieceId.pin» of every electrical pin («gateId.pin» for the gates of a chip). */
  pines: string[];
  /** Conductors (strips «T…», rails «R…») and equipment terminals («E:x,y») it includes. */
  conductores: string[];
  /** Equipment terminals on the net (piece id and terminal index). */
  bornes: { pieza: string; borne: number }[];
  /** Named after the original schematic. */
  original: boolean;
}

export interface ConexionesProto {
  redes: RedProto[];
  redDePin: Map<string, number>;
  /** Conductor (or equipment terminal key) → net index; conductors with nothing on them are absent. */
  redDeConductor: Map<string, number>;
  /** Legs (piece, leg index) that are not in any hole. */
  sueltas: { pieza: string; pata: number }[];
  /** Wire ends in no hole and on no terminal. */
  extremosSueltos: { cable: string; extremo: 'a' | 'b' }[];
  /** Points holding more than one leg or wire end (holes take only one). */
  dobles: Pt[];
  /** Original names merged into another net: lost name → name used. */
  alias: Map<string, string>;
  /**
   * What is joined to what, nets with no pin included (the board-only node of a T flip-flop between its XOR and
   * its D): conductor keys and «P:pin» → a group number.
   */
  grupo: Map<string, number>;
}

export const cfgDe = (d: DocumentoProtoboard): ConfigPlaca => ({ placas: d.placas, columnas: d.columnas });

/** Key of the conductor at a point: a strip or rail when there is a hole, an equipment terminal, or null. */
export function conductorEn(doc: DocumentoProtoboard, x: number, y: number, bornes?: Set<string>): string | null {
  const a = agujero(cfgDe(doc), x, y);
  if (a) return a.nodo;
  const k = `E:${clavePt(x, y)}`;
  if (bornes) return bornes.has(k) ? k : null;
  for (const p of doc.piezas) if (EXTERNOS.has(p.enc) && p.pos.some((q) => q[0] === x && q[1] === y)) return k;
  return null;
}

export function conexiones(doc: DocumentoProtoboard): ConexionesProto {
  const cfg = cfgDe(doc);
  const indice = new Map<string, number>();
  const padre: number[] = [];
  const id = (k: string): number => {
    let i = indice.get(k);
    if (i == null) {
      i = padre.length;
      indice.set(k, i);
      padre.push(i);
    }
    return i;
  };
  const raiz = (i: number): number => {
    while (padre[i] !== i) {
      padre[i] = padre[padre[i]!]!;
      i = padre[i]!;
    }
    return i;
  };
  const unir = (a: number, b: number) => {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) padre[ra] = rb;
  };

  const ocupacion = new Map<string, number>();
  const ocupar = (x: number, y: number) => {
    const k = clavePt(x, y);
    ocupacion.set(k, (ocupacion.get(k) ?? 0) + 1);
  };
  const bornes = new Set<string>();
  const borneDe = new Map<string, { pieza: string; borne: number }[]>();
  for (const p of doc.piezas) {
    if (!EXTERNOS.has(p.enc)) continue;
    p.pos.forEach((q, i) => {
      const k = `E:${clavePt(q[0], q[1])}`;
      bornes.add(k);
      (borneDe.get(k) ?? borneDe.set(k, []).get(k)!).push({ pieza: p.id, borne: i });
    });
  }

  const sueltas: ConexionesProto['sueltas'] = [];
  const pinIds = new Map<string, number>();
  for (const p of doc.piezas) {
    const externo = EXTERNOS.has(p.enc);
    p.pos.forEach((q, i) => {
      let k: string;
      if (externo) k = `E:${clavePt(q[0], q[1])}`;
      else {
        ocupar(q[0], q[1]);
        const a = agujero(cfg, q[0], q[1]);
        if (a) k = a.nodo;
        else {
          k = `L:${p.id}:${i}`;
          sueltas.push({ pieza: p.id, pata: i });
        }
      }
      const n = id(k);
      const pin = p.patas[i];
      if (!pin) return;
      const kp = clavePin(p, pin);
      const prev = pinIds.get(kp);
      if (prev == null) pinIds.set(kp, n);
      else unir(prev, n);
    });
  }
  const extremosSueltos: ConexionesProto['extremosSueltos'] = [];
  for (const w of doc.cables) {
    const ext = (pt: Pt, e: 'a' | 'b'): number => {
      const c = conductorEn(doc, pt[0], pt[1], bornes);
      if (c) {
        if (!c.startsWith('E:')) ocupar(pt[0], pt[1]);
        return id(c);
      }
      extremosSueltos.push({ cable: w.id, extremo: e });
      return id(`C:${w.id}:${e}`);
    };
    unir(ext(w.a, 'a'), ext(w.b, 'b'));
  }

  // Nets: groups holding at least one pin.
  const grupos = new Map<number, { pines: string[]; conductores: string[] }>();
  for (const [kp, n] of pinIds) {
    const r = raiz(n);
    (grupos.get(r) ?? grupos.set(r, { pines: [], conductores: [] }).get(r)!).pines.push(kp);
  }
  for (const [k, i] of indice) {
    if (!(k.startsWith('T') || k.startsWith('R') || k.startsWith('E:'))) continue;
    const g = grupos.get(raiz(i));
    if (g) g.conductores.push(k);
  }
  const lista = [...grupos.values()];

  // Names.
  const orig = doc.original ?? {};
  const nombres: (string | null)[] = lista.map(() => null);
  const usados = new Set<string>();
  const cuentas = lista.map((g) => {
    const c = new Map<string, number>();
    for (const p of g.pines) {
      const o = orig[p];
      if (o) c.set(o, (c.get(o) ?? 0) + 1);
    }
    return c;
  });
  // Ground: the net with most original ground pins; without an original, the bench supply's −.
  let tierra = -1;
  let mejorTierra = 0;
  cuentas.forEach((c, i) => {
    const n = c.get('0') ?? 0;
    if (n > mejorTierra) {
      mejorTierra = n;
      tierra = i;
    }
  });
  if (tierra < 0 && !Object.values(orig).includes('0')) {
    const fuente = doc.piezas.find((p) => p.enc === 'alimentacion') ?? doc.piezas.find((p) => p.enc === 'generador');
    if (fuente) {
      const k = `${fuente.id}.start`;
      if (pinIds.has(k)) tierra = lista.findIndex((g) => g.pines.includes(k));
    }
  }
  if (tierra >= 0) {
    nombres[tierra] = '0';
    usados.add('0');
  }
  // Other original names: the net that holds most pins of a name gets it.
  const pedidos: { red: number; nombre: string; n: number }[] = [];
  cuentas.forEach((c, i) => {
    for (const [nombre, n] of c) if (nombre !== '0') pedidos.push({ red: i, nombre, n });
  });
  pedidos.sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre));
  for (const p of pedidos) {
    if (nombres[p.red] != null || usados.has(p.nombre)) continue;
    nombres[p.red] = p.nombre;
    usados.add(p.nombre);
  }
  const todosOriginales = new Set(Object.values(orig));
  let k = 1;
  lista.forEach((_, i) => {
    if (nombres[i] != null) return;
    while (usados.has(`n${k}`) || todosOriginales.has(`n${k}`)) k++;
    nombres[i] = `n${k}`;
    usados.add(`n${k}`);
  });
  // Original names that no net kept: where most of their pins went.
  const alias = new Map<string, string>();
  for (const nombre of todosOriginales) {
    if (usados.has(nombre)) continue;
    let mejor = -1;
    let n = 0;
    cuentas.forEach((c, i) => {
      const x = c.get(nombre) ?? 0;
      if (x > n) {
        n = x;
        mejor = i;
      }
    });
    if (mejor >= 0) alias.set(nombre, nombres[mejor]!);
  }

  const redes: RedProto[] = lista.map((g, i) => ({
    nombre: nombres[i]!,
    pines: g.pines,
    conductores: g.conductores,
    bornes: g.conductores.filter((c) => c.startsWith('E:')).flatMap((c) => borneDe.get(c) ?? []),
    original: todosOriginales.has(nombres[i]!),
  }));
  const redDePin = new Map<string, number>();
  const redDeConductor = new Map<string, number>();
  redes.forEach((r, i) => {
    for (const p of r.pines) redDePin.set(p, i);
    for (const c of r.conductores) redDeConductor.set(c, i);
  });
  const dobles: Pt[] = [];
  for (const [kk, n] of ocupacion)
    if (n > 1) {
      const [x, y] = kk.split(',').map(Number) as [number, number];
      if (agujero(cfg, x, y)) dobles.push([x, y]);
    }
  const grupo = new Map<string, number>();
  for (const [k, i] of indice) if (k.startsWith('T') || k.startsWith('R') || k.startsWith('E:')) grupo.set(k, raiz(i));
  for (const [kp, n] of pinIds) grupo.set(`P:${kp}`, raiz(n));
  return { redes, redDePin, redDeConductor, sueltas, extremosSueltos, dobles, alias, grupo };
}

/** Net name at a point of the board (hole or terminal): the probe of future instruments. */
export function redEn(doc: DocumentoProtoboard, con: ConexionesProto, x: number, y: number): string | null {
  const c = conductorEn(doc, x, y);
  if (!c) return null;
  const i = con.redDeConductor.get(c);
  return i == null ? null : con.redes[i]!.nombre;
}

/** v(lost) → v(kept) in the directives' voltage expressions, for names merged away. */
export function renombrarDirectivas(texto: string, alias: Map<string, string>): string {
  if (!alias.size || !texto) return texto;
  return texto.replace(/\b(v[a-z]{0,3})\(([^()]*)\)/gi, (m, f: string, args: string) => {
    const partes = args.split(',');
    let cambio = false;
    const nuevas = partes.map((a) => {
      const t = a.trim().toLowerCase();
      const n = alias.get(t);
      if (n == null) return a;
      cambio = true;
      return a.replace(a.trim(), n);
    });
    return cambio ? `${f}(${nuevas.join(',')})` : m;
  });
}

export interface NetlistProto extends Netlist {
  conexiones: ConexionesProto;
}

/** The netlist of the board (editor/netlist.ts on the board's nets). */
export function netlistProtoboard(doc: DocumentoProtoboard, con: ConexionesProto = conexiones(doc)): NetlistProto {
  const redes: Red[] = con.redes.map((r) => ({ nombre: r.nombre, pines: r.pines, cables: [], explicita: r.original || r.pines.length + r.bornes.length > 1 }));
  const conEditor: Conectividad = { redes, redDePin: con.redDePin, redDeCable: new Map(), uniones: [], sueltos: [], conflictos: [] };
  const docEditor: DocumentoEsquema = {
    version: 1,
    titulo: doc.titulo,
    componentes: doc.piezas.flatMap(compsDe),
    cables: [],
    analisis: doc.analisis,
    directivas: renombrarDirectivas(doc.directivas, con.alias),
  };
  const nl = generarNetlist(docEditor, conEditor);
  // The editor speaks of ground symbols and loose terminals; the board has its own wording (comprobaciones.ts).
  // A board made from a netlist without a ground node at its top level (cells of subcircuits) keeps it so.
  const sinMasaOriginal = !!doc.original && !Object.values(doc.original).includes('0');
  const errores: Aviso[] = nl.errores.filter((e) => !(sinMasaOriginal && /^Falta la masa/.test(e.texto))).map((e) =>
    /^Falta la masa/.test(e.texto)
      ? { texto: 'Falta la masa: conecte el borne − (negro) de la fuente de alimentación al carril azul (−) y lleve a él las masas del circuito.' }
      : e,
  );
  const avisos = nl.avisos.filter((a) => !/no está conectado a nada/.test(a.texto));
  return { ...nl, errores, avisos, conexiones: con };
}
