// Content of the «Repaso» page: flashcards built from the glossary and the chapter quizzes
// (repaso/*.json, written by contenido/repaso.py; see ESQUEMA.md).

import type { EntradaGlosario } from '../../lib/tipos';
import { cargarGlosario, idGlosario, leerJSON, obtenerIndice, obtenerRefs, ordenLectura } from '../../lib/datos';
import { normalizarColor } from '../../lib/color';

// ------------------------------------------------------------------ flashcards

export interface Tarjeta {
  /** Glossary id, plus «~i» for the reversed card. */
  id: string;
  inversa: boolean;
  entrada: EntradaGlosario;
  /** Parts its «ver» links point to (chapters / appendices), in reading order. */
  partes: string[];
  /** Position for new cards: the book order of its first link. */
  orden: number;
}

export interface Mazo {
  id: string;
  nombre: string;
  grupo: 'todo' | 'tomo' | 'tema' | 'capitulo';
  /** Glossary ids in the deck (direct cards). */
  ids: Set<string>;
  color?: string;
}

export interface Baraja {
  /** Direct cards in book order. */
  tarjetas: Tarjeta[];
  porId: Map<string, Tarjeta>;
  mazos: Mazo[];
}

let baraja: Promise<Baraja> | null = null;

function numOrden(num: string | undefined): number {
  // «5.3» → 5003, «A.2» → 2 inside its part (the part index carries the rest)
  if (!num) return 0;
  const partes = num.split('.').map((x) => (/^\d+$/.test(x) ? Number(x) : 0));
  return (partes[1] ?? 0) * 100 + (partes[2] ?? 0);
}

/** The cards and decks (built once from glossary.json, refs.json and indice.json). */
export function cargarBaraja(): Promise<Baraja> {
  baraja ??= cargarGlosario().then((glosario) => {
    const refs = obtenerRefs();
    const indice = obtenerIndice();
    const orden = ordenLectura();
    const pos = new Map(orden.map((p, k) => [p, k]));
    const tarjetas: Tarjeta[] = glosario.map((e, k) => {
      const partes: string[] = [];
      let primero = Number.POSITIVE_INFINITY;
      for (const v of e.ver ?? []) {
        const r = refs[v];
        if (!r) continue;
        if (!partes.includes(r.parte)) partes.push(r.parte);
        primero = Math.min(primero, (pos.get(r.parte) ?? 999) * 100_000 + numOrden(r.num));
      }
      partes.sort((a, b) => (pos.get(a) ?? 999) - (pos.get(b) ?? 999));
      const id = e.id ?? idGlosario(e.termino);
      return { id, inversa: false, entrada: e, partes, orden: Number.isFinite(primero) ? primero + k / 10_000 : 1e12 + k };
    });
    tarjetas.sort((a, b) => a.orden - b.orden);
    const porId = new Map(tarjetas.map((t) => [t.id, t]));

    const mazos: Mazo[] = [{ id: 'todo', nombre: 'Todo el glosario', grupo: 'todo', ids: new Set(porId.keys()) }];
    const tomoDe = new Map<string, string>();
    for (const t of indice.tomos) for (const p of t.partes) tomoDe.set(p, t.id);
    for (const t of indice.tomos) {
      const ids = new Set(tarjetas.filter((x) => x.partes.some((p) => tomoDe.get(p) === t.id)).map((x) => x.id));
      if (ids.size) mazos.push({ id: `tomo:${t.id}`, nombre: `Tomo ${t.id} · ${t.titulo}`, grupo: 'tomo', ids });
    }
    for (const b of indice.bloques ?? []) {
      const color = normalizarColor(b.color);
      const ids = new Set(
        tarjetas
          .filter((x) => x.partes.some((p) => normalizarColor(indice.partes[p]?.color) === color && indice.partes[p]?.tipo === 'capitulo'))
          .map((x) => x.id),
      );
      if (ids.size) mazos.push({ id: `tema:${color}`, nombre: b.nombre, grupo: 'tema', ids, color });
    }
    for (const p of orden) {
      const ids = new Set(tarjetas.filter((x) => x.partes.includes(p)).map((x) => x.id));
      const info = indice.partes[p];
      if (!ids.size || !info) continue;
      const corto = info.titulo.split(' — ')[0] ?? info.titulo;
      const nombre = info.tipo === 'capitulo' ? `${info.num} · ${corto}` : info.tipo === 'apendice' ? `${info.num} · ${corto}` : corto;
      mazos.push({ id: `parte:${p}`, nombre, grupo: 'capitulo', ids, color: info.color ?? undefined });
    }
    return { tarjetas, porId, mazos };
  });
  baraja.catch(() => (baraja = null));
  return baraja;
}

/** Cards of a deck in book order (with the reversed ones after their direct card when enabled). */
export function tarjetasDe(b: Baraja, mazoId: string, inversas: boolean): Tarjeta[] {
  const mazo = b.mazos.find((m) => m.id === mazoId) ?? b.mazos[0]!;
  const out: Tarjeta[] = [];
  for (const t of b.tarjetas) {
    if (!mazo.ids.has(t.id)) continue;
    out.push(t);
    if (inversas) out.push({ ...t, id: `${t.id}~i`, inversa: true, orden: t.orden + 0.5 });
  }
  return out;
}

// ------------------------------------------------------------------ quizzes

export interface PreguntaBase {
  id: string;
  enunciado: string;
  explicacion: string;
  ref: string;
  ref_num: string | null;
  ref_tipo: string;
  ref_titulo?: string;
  cita: string;
}
export interface PreguntaOpcion extends PreguntaBase {
  tipo: 'opcion';
  opciones: string[];
  correcta: number;
}
export interface PreguntaNumero extends PreguntaBase {
  tipo: 'numero';
  valor: number;
  unidad: string;
  /** Relative tolerance (0,02 = ±2 %). */
  tolerancia: number;
  /** The value as the book writes it. */
  valor_texto: string;
}
export type Pregunta = PreguntaOpcion | PreguntaNumero;

export interface CuestionarioParte {
  parte: string;
  preguntas: Pregunta[];
}

export interface EntradaIndiceRepaso {
  parte: string;
  tipo: string;
  num: string | null;
  titulo: string;
  tomo: string | null;
  color: string | null;
  preguntas: number;
  numericas: number;
}

export interface IndiceRepaso {
  version: number;
  total: number;
  partes: EntradaIndiceRepaso[];
}

let indiceRepaso: Promise<IndiceRepaso> | null = null;
const cuestionarios = new Map<string, Promise<CuestionarioParte>>();

export function cargarIndiceRepaso(): Promise<IndiceRepaso> {
  indiceRepaso ??= leerJSON<IndiceRepaso>('repaso/indice.json').catch(() => ({ version: 1, total: 0, partes: [] }));
  return indiceRepaso;
}

/** One chapter's questions (fetched when the quiz opens). */
export function cargarCuestionario(parte: string): Promise<CuestionarioParte> {
  let p = cuestionarios.get(parte);
  if (!p) {
    p = leerJSON<CuestionarioParte>(`repaso/${parte}.json`);
    p.catch(() => cuestionarios.delete(parte));
    cuestionarios.set(parte, p);
  }
  return p;
}

/** Parses a number typed by the reader: decimal comma or point, spaces, «−», SI-free. */
export function leerNumero(texto: string): number | null {
  let t = texto.trim().replace(/−/g, '-').replace(/[\s  ]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

export function numeroCorrecto(p: PreguntaNumero, v: number): boolean {
  const margen = Math.max(Math.abs(p.valor) * p.tolerancia, 1e-12);
  return Math.abs(v - p.valor) <= margen + Math.abs(p.valor) * 1e-9;
}

/** Fisher-Yates with Math.random. */
export function barajar<T>(xs: T[]): T[] {
  const a = xs.slice();
  for (let k = a.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [a[k], a[j]] = [a[j]!, a[k]!];
  }
  return a;
}
