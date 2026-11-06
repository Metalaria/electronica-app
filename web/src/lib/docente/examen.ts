// «Modo docente» (1.0): an exam as it is taken or printed — the order of its items, the order of the options of each
// choice, and the values of the numeric exercises with changing values — and its grading. Pure and seeded: the exam's
// seed and the variant number (0 = A, 1 = B…) give the same exam on every device, on screen and in the PDF.
//
// Grading, per item, in parts: each numeric field, each structured question, a test question, and (when the exercise
// also asks to explain or design) its open part. A part is right 1, «casi» 0,5 (right digits with a wrong prefix,
// within 10 %… — the same «Casi» as the exercises' panel), wrong or blank 0; the open part is self-assessed by the
// reader against the book's development (1, 0,5 or 0). The item's points are its points × the mean of its parts,
// rounded to hundredths.

import { comprobar, type Esperado } from '../magnitudes';
import { comprobarPregunta, type Pregunta as PreguntaEjercicio } from '../preguntas-ejercicio';
import type { ItemEjercicio } from '../ejercicios.svelte';
import type { Pregunta as PreguntaRepaso } from '../../componentes/repaso/datos';
import { leerNumero, numeroCorrecto } from '../../componentes/repaso/numero';
import { barajarCon, generador, hash } from '../../componentes/practica/azar';
import { comprobarPedido, pedidoDe, variantes, type Pedido, type Variante } from '../../componentes/practica/variantes';
import type { ItemNumerico } from '../../componentes/practica/tipos';
import type { DefinicionExamen, EstadoItem, ItemExamen, ResultadoItem } from './tipos';

/** What the exam needs to know about the book's items (loaded by lib/docente/fuentes.ts, or the JSON in the tests). */
export interface ContextoExamen {
  ejercicio(label: string): ItemEjercicio | undefined;
  pregunta(id: string): PreguntaRepaso | undefined;
  /** The practice item with changing values that reproduces an exercise (practica/<parte>.json). */
  numerico(label: string): ItemNumerico | undefined;
  /**
   * Review 10h (r10h·2): whether the book has changing values for this exercise (practica/indice.json). With it, an
   * exam with variants whose practice item is not loaded counts it in `faltan` instead of falling back to the book's
   * values. Absent: not known (old contexts).
   */
  variable?(label: string): boolean;
}

export interface ItemMontado extends ItemExamen {
  /** 1-based position in this variant. */
  n: number;
  /** Test question: the options in the order shown (indices into `opciones`). */
  orden?: number[];
  /** Exercise: per choice question id, the options in the order shown. */
  opciones?: Record<string, number[]>;
  /** Exercise with changing values: index into its list of variants (componentes/practica/variantes.ts). */
  variante?: number;
  /** Review 10h: the variant as the attempt saw it (stored in the result): grading never depends on the content again. */
  vv?: VarianteGuardada;
}

/** A variant's values, statement and expected answer, as stored with an attempt's result (review 10h). */
export interface VarianteGuardada {
  valores: Record<string, number>;
  resultado: number;
  /** The statement with these values (HTML). */
  enunciado: string;
  /** What the field asked and what is accepted (a standard value also keeps `serie` and `calculado`). */
  esperado: Pedido;
}

export interface ExamenMontado {
  /** The seed of this variant (derived from the exam's seed and `variante`). */
  semilla: number;
  variante: number;
  /** «A», «B»… */
  letra: string;
  items: ItemMontado[];
  /** Items of the definition the context does not have («k:ref»): left out, numbers kept (see montarExamen). */
  faltan: string[];
  maximo: number;
  minutos: number;
}

export const letraVariante = (n: number): string => (n < 26 ? String.fromCharCode(65 + n) : `V${n + 1}`);

/** The seed of variant `n` of an exam. */
export const semillaVariante = (semilla: number, n: number): number => hash(`${semilla >>> 0}|variante|${n}`);

const redondear = (x: number) => Math.round(x * 100) / 100;

const plano = (h: string) => h.replace(/<[^>]+>/g, '').trim().toLowerCase();
/** Yes/No questions keep the book's order (as the exercises' panel does). */
const esSiNo = (p: PreguntaEjercicio) => p.tipo === 'eleccion' && p.opciones.length === 2 && plano(p.opciones[0]!) === 'sí' && plano(p.opciones[1]!) === 'no';

/**
 * Fingerprint of what is graded in an exam (items with their points, time, variants, shuffling, seed): not the title,
 * the notes, the room to answer on paper or the filters. An attempt in progress is tied to it (review 10c, r10c·4).
 */
export function huellaExamen(def: Pick<DefinicionExamen, 'items' | 'minutos' | 'variantes' | 'barajar' | 'semilla'>): string {
  const graded = { items: def.items.map((i) => [i.k, i.ref, i.puntos]), minutos: def.minutos, variantes: def.variantes, barajar: def.barajar, semilla: def.semilla };
  return hash(JSON.stringify(graded)).toString(36);
}

/** A new random exam seed (32 bits). */
export function nuevaSemilla(): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0]!;
}

/** The order of the definition's items in a variant (seed of the variant): the numbers are positions in it. */
function ordenDe(def: Pick<DefinicionExamen, 'items' | 'barajar'>, semilla: number): ItemExamen[] {
  return def.barajar ? barajarCon(def.items, hash(`${semilla}|orden`)) : [...def.items];
}

/** «k:ref» → its number in variant `variante` (every item of the definition, available or not). */
export function numerosDe(def: Pick<DefinicionExamen, 'items' | 'barajar' | 'semilla'>, variante: number): Map<string, number> {
  return new Map(ordenDe(def, semillaVariante(def.semilla, variante)).map((it, i) => [`${it.k}:${it.ref}`, i + 1]));
}

/** Assembles variant `variante` of an exam. Items the book no longer has are left out. */
export function montarExamen(def: DefinicionExamen, ctx: ContextoExamen, variante = 0): ExamenMontado {
  const semilla = semillaVariante(def.semilla, variante);
  // (review 10f, r10f·1: the order and the numbers come from the definition alone — an item the context does not have
  // (not loaded, or no longer in the book) is left out WITHOUT renumbering the others, so an answer stored under its
  // number can never move to another question; `faltan` names what was left out, for the caller to refuse to go on)
  // (review 10h, r10h·2: an exercise with changing values in an exam with variants needs its practice item too — without
  // it the variant could not be shown and the book's values would be asked instead)
  const hay = (it: ItemExamen) =>
    it.k === 'ejercicio' ? !!ctx.ejercicio(it.ref) && !(def.variantes && ctx.variable?.(it.ref) && !ctx.numerico(it.ref)) : !!ctx.pregunta(it.ref);
  const orden = ordenDe(def, semilla);
  const faltan = orden.filter((it) => !hay(it)).map((it) => `${it.k}:${it.ref}`);
  const items: ItemMontado[] = orden.flatMap((it, i) => {
    if (!hay(it)) return [];
    const m: ItemMontado = { k: it.k, ref: it.ref, puntos: it.puntos, n: i + 1 };
    const s = hash(`${semilla}|${it.k}|${it.ref}`);
    if (it.k === 'pregunta') {
      const p = ctx.pregunta(it.ref)!;
      if (p.tipo === 'opcion' && def.barajar) m.orden = barajarCon(p.opciones.map((_, k) => k), s);
    } else {
      const e = ctx.ejercicio(it.ref)!;
      if (def.barajar) {
        for (const p of e.preguntas ?? []) {
          if (p.tipo !== 'eleccion' || esSiNo(p)) continue;
          (m.opciones ??= {})[p.id] = barajarCon(p.opciones.map((_, k) => k), hash(`${s}|${p.id}`));
        }
      }
      if (def.variantes) {
        const num = ctx.numerico(it.ref);
        const lista = num ? variantes(num) : [];
        if (lista.length) m.variante = Math.floor(generador(s)() * lista.length);
      }
    }
    return [m];
  });
  return {
    semilla,
    variante,
    letra: letraVariante(variante),
    items,
    faltan,
    maximo: redondear(items.reduce((a, it) => a + it.puntos, 0)),
    minutos: def.minutos,
  };
}

/** A choice question with its options in the order shown (the stored answer is a position in that order). */
export function preguntaVista(p: PreguntaEjercicio, orden: number[] | undefined): PreguntaEjercicio {
  if (p.tipo !== 'eleccion' || !orden) return p;
  return { ...p, opciones: orden.map((k) => p.opciones[k]!), correcta: orden.indexOf(p.correcta) };
}

/** The variant of an exercise with changing values that this item shows (null: the book's values). */
export function varianteDe(m: ItemMontado, ctx: ContextoExamen): { item: ItemNumerico; v: Variante } | null {
  if (m.k !== 'ejercicio' || (m.variante == null && !m.vv)) return null;
  const item = ctx.numerico(m.ref);
  // (a stored variant — a result's — keeps its own values even if the practice content changed)
  if (item && m.vv) return { item, v: { valores: m.vv.valores, resultado: m.vv.resultado } };
  const v = item && m.variante != null ? variantes(item)[m.variante] : undefined;
  return item && v ? { item, v } : null;
}

/** What a result stores of a variant (review 10h). */
export function guardarVariante(item: ItemNumerico, v: Variante, enunciado: string): VarianteGuardada {
  return { valores: { ...v.valores }, resultado: v.resultado, enunciado, esperado: esperadoVariante(item, v) };
}

/**
 * The expected answer of the variant: the formula's unknown with the exercise's tolerance, or the nearest standard value
 * when the statement asks for one; `nombre` = what the field asks, the same text as the practice (final QA 1.0: it was
 * the formula's variable, «Reactancia capacitiva (XC)» for a resistance and no frequency for one of three).
 */
export function esperadoVariante(item: ItemNumerico, v: Variante): Pedido {
  return pedidoDe(item, v);
}

export interface ParteCalificada {
  /** Key in the answers: r1…, p1…, `r` (test question), `abierta`. */
  id: string;
  tipo: 'campo' | 'pregunta' | 'test' | 'abierta';
  /** 1, 0,5 or 0; null: an open part not self-assessed yet. */
  nota: number | null;
  /** «Correcto», «Casi: …», «No es correcto», «Sin responder». */
  mensaje: string;
}

export interface Calificacion {
  puntos: number;
  maximo: number;
  estado: EstadoItem;
  partes: ParteCalificada[];
}

const SIN_RESPONDER = 'Sin responder.';

function notaCampo(texto: string, e: Esperado, alternativas: Esperado[] = []): ParteCalificada & { tipo: 'campo' } {
  return notaDe(comprobar(texto ?? '', e, alternativas));
}

/** A variant's field: a standard value is accepted only exactly (a stored result without `serie` grades as before). */
function notaVariante(texto: string, p: Pedido): ParteCalificada & { tipo: 'campo' } {
  return notaDe(comprobarPedido(texto ?? '', p));
}

function notaDe(v: ReturnType<typeof comprobar>): ParteCalificada & { tipo: 'campo' } {
  if (v.tipo === 'bien') return { id: '', tipo: 'campo', nota: 1, mensaje: 'Correcto.' };
  if (v.tipo === 'cerca') return { id: '', tipo: 'campo', nota: 0.5, mensaje: v.mensaje };
  if (v.tipo === 'vacio') return { id: '', tipo: 'campo', nota: 0, mensaje: SIN_RESPONDER };
  return { id: '', tipo: 'campo', nota: 0, mensaje: v.mensaje };
}

/**
 * Grades one item from the answers given (`valores`, the same keys as an exercise's panel; a test question: `r`).
 * `autoeval`: the reader's self-assessment of the open part (1, 0,5 or 0), when given.
 */
export function calificarItem(m: ItemMontado, ctx: ContextoExamen, valores: Record<string, string>, autoeval?: number): Calificacion {
  const partes: ParteCalificada[] = [];
  if (m.k === 'pregunta') {
    const p = ctx.pregunta(m.ref);
    if (p?.tipo === 'opcion') {
      const r = valores.r ?? '';
      if (!/^\d+$/.test(r)) partes.push({ id: 'r', tipo: 'test', nota: 0, mensaje: SIN_RESPONDER });
      else {
        const elegida = m.orden ? m.orden[Number(r)] : Number(r);
        partes.push(elegida === p.correcta ? { id: 'r', tipo: 'test', nota: 1, mensaje: 'Correcto.' } : { id: 'r', tipo: 'test', nota: 0, mensaje: 'No es la respuesta correcta.' });
      }
    } else if (p) {
      const v = leerNumero(valores.r ?? '');
      if (!(valores.r ?? '').trim()) partes.push({ id: 'r', tipo: 'test', nota: 0, mensaje: SIN_RESPONDER });
      else if (v == null) partes.push({ id: 'r', tipo: 'test', nota: 0, mensaje: 'No se entiende el número.' });
      else partes.push(numeroCorrecto(p, v) ? { id: 'r', tipo: 'test', nota: 1, mensaje: 'Correcto.' } : { id: 'r', tipo: 'test', nota: 0, mensaje: 'No es correcto.' });
    }
  } else {
    const e = ctx.ejercicio(m.ref);
    const vr = varianteDe(m, ctx);
    if (m.vv) {
      partes.push({ ...notaVariante(valores.r1 ?? '', m.vv.esperado), id: 'r1' });
    } else if (vr) {
      partes.push({ ...notaVariante(valores.r1 ?? '', esperadoVariante(vr.item, vr.v)), id: 'r1' });
    } else if (e) {
      for (const r of e.respuestas) partes.push({ ...notaCampo(valores[r.id] ?? '', r, r.alternativas), id: r.id });
      for (const p of e.preguntas ?? []) {
        const v = comprobarPregunta(preguntaVista(p, m.opciones?.[p.id]), valores[p.id] ?? '');
        const nota = v.tipo === 'bien' ? 1 : v.tipo === 'cerca' ? 0.5 : 0;
        partes.push({ id: p.id, tipo: 'pregunta', nota, mensaje: v.tipo === 'vacio' ? SIN_RESPONDER : v.mensaje });
      }
      if (e.modo === 'comparar' || (e.otras?.length ?? 0) > 0) {
        // nothing written and not self-assessed: a blank answer, not one waiting for the comparison
        const escrito = !!(valores.texto ?? '').trim();
        const n = autoeval == null ? (escrito ? null : 0) : autoeval >= 1 ? 1 : autoeval >= 0.5 ? 0.5 : 0;
        const mensaje = n == null ? 'Compárelo con el desarrollo del libro.' : autoeval == null ? SIN_RESPONDER : n === 1 ? 'Bien.' : n === 0.5 ? 'A medias.' : 'Mal.';
        partes.push({ id: 'abierta', tipo: 'abierta', nota: n, mensaje });
      }
    }
  }
  const total = partes.length || 1;
  const suma = partes.reduce((a, p) => a + (p.nota ?? 0), 0);
  const puntos = redondear((m.puntos * suma) / total);
  const pendiente = partes.some((p) => p.nota == null);
  const vacio = partes.every((p) => p.mensaje === SIN_RESPONDER);
  let estado: EstadoItem;
  if (pendiente) estado = 'pendiente';
  else if (suma >= total) estado = 'bien';
  else if (suma > 0) estado = 'parcial';
  else estado = vacio ? 'blanco' : 'mal';
  return { puntos, maximo: m.puntos, estado, partes };
}

/** The whole exam's grade. */
export function calificarExamen(ex: ExamenMontado, ctx: ContextoExamen, respuestas: Record<number, Record<string, string>>, autoeval: Record<number, number> = {}) {
  const items = ex.items.map((m) => calificarItem(m, ctx, respuestas[m.n] ?? {}, autoeval[m.n]));
  return { items, puntos: redondear(items.reduce((a, c) => a + c.puntos, 0)), maximo: ex.maximo, pendientes: items.filter((c) => c.estado === 'pendiente').length };
}

/** «7,5» — points as the app writes numbers. */
export const textoPuntos = (x: number): string => String(redondear(x)).replace('.', ',');

/** An item of a stored result as it was shown (to grade it again, e.g. after the self-assessment). */
export function montadoDeResultado(it: ResultadoItem, n: number): ItemMontado {
  const m: ItemMontado = { k: it.k, ref: it.ref, puntos: it.maximo, n };
  if (it.orden) m.orden = it.orden;
  if (it.opciones) m.opciones = it.opciones;
  if (it.variante != null) m.variante = it.variante;
  if (it.vv) m.vv = it.vv;
  return m;
}
