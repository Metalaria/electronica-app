// Editing a breadboard by hand: where a part can go (legs in free holes, bodies not on top of each other,
// nothing hidden under a body), turning and reversing parts, finding a free place for a new part, and
// where a wire end can be plugged. Plain TypeScript; the state (estado.svelte.ts) calls it.

import { TIPO } from '../editor/catalogo.ts';
import type { Componente } from '../editor/tipos.ts';
import { bajoCuerpo, bornesExterno, cajaExterno, cuerpoDe, encapsuladoDe, EXTERNOS, patasDip, patasFila, solapan, type Encapsulado } from './encapsulados.ts';
import { agujero, ALTO_PLACA, clavePt, type Pt } from './placa.ts';
import { empaquetar } from './logica.ts';
import type { CableProto, DocumentoProtoboard, Pieza } from './tipos.ts';

const cfgDe = (d: DocumentoProtoboard) => ({ placas: d.placas, columnas: d.columnas });

/** Points taken by legs and wire ends (holes hold one each), except those of `ignorar`. */
function ocupados(doc: DocumentoProtoboard, ignorar: Set<string>): Set<string> {
  const s = new Set<string>();
  for (const p of doc.piezas) if (!ignorar.has(p.id) && !EXTERNOS.has(p.enc)) for (const q of p.pos) s.add(clavePt(q[0], q[1]));
  for (const w of doc.cables) {
    if (ignorar.has(w.id)) continue;
    if (!ignorar.has(`${w.id}:a`)) s.add(clavePt(w.a[0], w.a[1]));
    if (!ignorar.has(`${w.id}:b`)) s.add(clavePt(w.b[0], w.b[1]));
  }
  return s;
}

/** Why a part cannot be where it is (Spanish), or null when it can. */
export function motivoInvalida(doc: DocumentoProtoboard, p: Pieza, ignorar: Set<string> = new Set([p.id])): string | null {
  const cfg = cfgDe(doc);
  if (EXTERNOS.has(p.enc)) {
    const [x0, y0, x1, y1] = cajaExterno(p);
    if (y1 > -1.3) return 'Los aparatos van por encima de la protoboard.';
    if (x0 < -8 || x1 > doc.columnas + 10) return 'Fuera de la mesa.';
    for (const o of doc.piezas) {
      if (ignorar.has(o.id) || !EXTERNOS.has(o.enc)) continue;
      const c = cajaExterno(o);
      if (x0 < c[2] && c[0] < x1 && y0 < c[3] && c[1] < y1) return `Encima de ${o.comp.nombre}.`;
    }
    return null;
  }
  const oc = ocupados(doc, ignorar);
  const vistos = new Set<string>();
  for (const [x, y] of p.pos) {
    const a = agujero(cfg, x, y);
    if (!a) return 'Alguna pata no cae en un agujero.';
    const k = clavePt(x, y);
    if (oc.has(k) || vistos.has(k)) return `El agujero ${a.fila}${a.tipo === 'riel' ? '' : x} ya está ocupado.`;
    vistos.add(k);
  }
  const b = cuerpoDe(p);
  for (const o of doc.piezas) {
    if (ignorar.has(o.id) || EXTERNOS.has(o.enc)) continue;
    const ob = cuerpoDe(o);
    if (b && ob && solapan(b, ob)) return `Chocaría con ${o.comp.nombre}.`;
    if (ob) for (const q of p.pos) if (bajoCuerpo(ob, q[0], q[1])) return `Una pata quedaría debajo de ${o.comp.nombre}.`;
    if (b) for (const q of o.pos) if (bajoCuerpo(b, q[0], q[1])) return `Taparía una pata de ${o.comp.nombre}.`;
  }
  if (b)
    for (const w of doc.cables) {
      if (ignorar.has(w.id)) continue;
      for (const q of [w.a, w.b]) if (bajoCuerpo(b, q[0], q[1])) return 'Taparía la punta de un cable.';
    }
  return null;
}

/** Where a wire end can go: a free hole or an equipment terminal. */
export function motivoExtremo(doc: DocumentoProtoboard, q: Pt, ignorar: Set<string>): string | null {
  for (const p of doc.piezas) if (EXTERNOS.has(p.enc) && p.pos.some((t) => t[0] === q[0] && t[1] === q[1])) return null;
  const a = agujero(cfgDe(doc), q[0], q[1]);
  if (!a) return 'El extremo no cae en un agujero ni en un borne.';
  if (ocupados(doc, ignorar).has(clavePt(q[0], q[1]))) return 'Ese agujero ya está ocupado.';
  for (const p of doc.piezas) {
    const b = cuerpoDe(p);
    if (b && bajoCuerpo(b, q[0], q[1])) return `Ese agujero está debajo de ${p.comp.nombre}.`;
  }
  return null;
}

const centroide = (pos: Pt[]): Pt => [pos.reduce((s, q) => s + q[0], 0) / pos.length, pos.reduce((s, q) => s + q[1], 0) / pos.length];

/** Legs turned 90° clockwise about their centre (DIPs turn 180°). */
export function girarPos(p: Pieza): Pt[] {
  if (p.enc === 'dip') return invertirPos(p);
  const [cx, cy] = centroide(p.pos);
  const g = p.pos.map(([x, y]) => [cx - (y - cy), cy + (x - cx)] as Pt);
  // Back on the grid (a two-leg part with an odd span rounds its centre).
  const dx = Math.round(g[0]![0]) - g[0]![0];
  const dy = Math.round(g[0]![1]) - g[0]![1];
  return g.map(([x, y]) => [Math.round(x + dx), Math.round(y + dy)] as Pt);
}

/** Turned round: legs reversed (polarity of a two-leg part, flat face of a TO-92, notch of a DIP). */
export function invertirPos(p: Pieza): Pt[] {
  if (p.enc === 'dip') {
    const [cx, cy] = centroide(p.pos);
    return p.pos.map(([x, y]) => [Math.round(2 * cx - x), Math.round(2 * cy - y)] as Pt);
  }
  return [...p.pos].reverse();
}

/** The first valid translation of a part near where it is (spiral over the board). */
export function huecoCercano(doc: DocumentoProtoboard, p: Pieza, radio = 40): Pt[] | null {
  const ignorar = new Set([p.id]);
  for (let r = 0; r <= radio; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const pos = p.pos.map(([x, y]) => [x + dx, y + dy] as Pt);
        if (!motivoInvalida(doc, { ...p, pos }, ignorar)) return pos;
      }
  return null;
}

/** Initial legs of a package (to be moved to a free place). */
export function patasIniciales(e: Encapsulado, cerca: Pt): Pt[] {
  const [x, y] = [Math.round(cerca[0]), Math.round(cerca[1])];
  switch (e.forma) {
    case 'dos':
      return [[x, y], [x + (e.preferidos?.[0] ?? 3), y]];
    case 'fila':
      return patasFila([x, y], [1, 0], e.patas.length);
    case 'dip':
      return patasDip([x, Math.floor(y / ALTO_PLACA) * ALTO_PLACA + 10], [1, 0], e.patas.length);
    case 'uno':
      return [[x, y]];
    default:
      return bornesExterno([x, Math.min(-3, y)], e.patas.length);
  }
}

/** A new piece for an editor part, placed at a free spot near `cerca` (null when the board is full). */
export function nuevaPieza(doc: DocumentoProtoboard, comp: Componente, cerca: Pt): Pieza | null {
  const e = encapsuladoDe(comp);
  const p: Pieza = { id: comp.id, comp, enc: e.id, pos: patasIniciales(e, cerca), patas: e.patas, ...(e.polar ? { polo: 0 } : {}) };
  if (EXTERNOS.has(e.id)) {
    // Equipment: the free slot nearest to the left of the area above the board.
    for (let fila = 0; fila < 6; fila++)
      for (let x = 3; x <= doc.columnas; x += 9) {
        const pos = bornesExterno([x, -3 - fila * 8], e.patas.length);
        if (!motivoInvalida(doc, { ...p, pos })) return { ...p, pos };
      }
    return null;
  }
  const pos = huecoCercano(doc, p, 60);
  return pos ? { ...p, pos } : null;
}

/**
 * A 74HC chip holding these logic parts (of one kind), placed at a free spot near `cerca`; its spare inputs
 * and its supply legs are left for the user to wire (the checks name them).
 */
export function nuevoChip(doc: DocumentoProtoboard, comps: Componente[], id: string, cerca: Pt): Pieza | null {
  const ch = empaquetar(comps, () => id).chips[0];
  if (!ch) return null;
  const usados = new Set(doc.piezas.map((p) => p.comp.nombre.toUpperCase()));
  let k = 1;
  while (usados.has(`CI${k}`)) k++;
  ch.comp.nombre = `CI${k}`;
  const p = nuevaPieza(doc, ch.comp, cerca);
  return p ? { ...p, patas: ch.patas, chip: { comps: ch.comps, roles: ch.roles, ataduras: ch.ataduras } } : null;
}

/** A fresh editor part of a palette kind with a free designator. */
export function componenteNuevo(doc: DocumentoProtoboard, tipo: string, id: string): Componente | null {
  const t = TIPO.get(tipo);
  if (!t) return null;
  const usados = new Set(doc.piezas.flatMap((p) => [p.comp, ...(p.chip?.comps ?? [])]).map((c) => c.nombre.toUpperCase()));
  let nombre = '';
  if (t.prefijo) for (let k = 1; ; k++) if (!usados.has(`${t.prefijo}${k}`.toUpperCase())) {
    nombre = `${t.prefijo}${k}`;
    break;
  }
  return { id, tipo, nombre, x: 0, y: 0, o: t.o, campos: { ...t.inicial } };
}

/** Equipment terminal at a point, if any. */
export function borneEn(doc: DocumentoProtoboard, q: Pt): { pieza: Pieza; i: number } | null {
  for (const p of doc.piezas) {
    if (!EXTERNOS.has(p.enc)) continue;
    const i = p.pos.findIndex((t) => t[0] === q[0] && t[1] === q[1]);
    if (i >= 0) return { pieza: p, i };
  }
  return null;
}

/** Wires whose ends sit on the terminals of a piece of equipment (they move with it). */
export function cablesDeBornes(doc: DocumentoProtoboard, p: Pieza): { cable: CableProto; extremo: 'a' | 'b' }[] {
  const res: { cable: CableProto; extremo: 'a' | 'b' }[] = [];
  for (const w of doc.cables)
    for (const e of ['a', 'b'] as const) if (p.pos.some((t) => t[0] === w[e][0] && t[1] === w[e][1])) res.push({ cable: w, extremo: e });
  return res;
}
