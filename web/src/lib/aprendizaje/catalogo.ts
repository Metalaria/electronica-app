// What can be answered, by concept (0.11, group B): the bridge between the book's learning data and the mastery,
// smart-practice and problem-of-the-day modules. Everything is loaded on demand and cached by the data modules it
// uses (practica/<parte>.json, repaso/<parte>.json, ejercicios.json, the glossary for the flashcards).
//
// A concept is «<parte>/<label of the h2 section>». Practice items carry their section; a Repaso question's `ref` is
// the section, a subsection inside it («sec-5.3.2», «Apartado»), a problem («prob-…», whose section ejercicios.json
// gives) or an appendix section («apG-4»); an exercise's section comes from ejercicios.json.

import { esDeRed } from '../errores';
import { leerJSON, obtenerIndice, obtenerRefs, ordenLectura } from '../datos';
import { cargarEjercicios, ejercicios } from '../ejercicios.svelte';
import type { ItemCatalogo, ConceptoCandidato, CandidatoProblema, DominioMinimo } from './seleccion';

const practica = () => import('../../componentes/practica/datos');
const repaso = () => import('../../componentes/repaso/datos');

/** The h2 section (concept key) a label of a part belongs to, or null. Needs ejercicios.json for problems. */
export function conceptoDeRef(parte: string, ref: string): string | null {
  let secs: { label: string }[] = [];
  try {
    secs = obtenerIndice().partes[parte]?.secciones ?? [];
  } catch {
    return null;
  }
  if (secs.some((s) => s.label === ref)) return `${parte}/${ref}`;
  const ej = ejercicios.datos?.items[ref];
  if (ej?.seccion && ej.parte === parte) return `${parte}/${ej.seccion}`;
  let mejor: string | null = null;
  for (const s of secs) if (ref.startsWith(`${s.label}.`) && (!mejor || s.label.length > mejor.length)) mejor = s.label;
  return mejor ? `${parte}/${mejor}` : null;
}

// ------------------------------------------------------------------ the concepts that can be practised

interface IndiceConceptos {
  version: number;
  total: number;
  /** Part → labels of its sections with something to answer, in book order. */
  partes: Record<string, string[]>;
}

let practicables: Record<string, string[]> | null = null;
let cargaPracticables: Promise<Record<string, string[]>> | null = null;

/**
 * The sections with something to answer, per part (libro/conceptos.json, web/scripts/conceptos11.mjs): the
 * denominator of the chapter and course mastery bars. Without the file, every section of the index counts.
 */
export function cargarPracticables(): Promise<Record<string, string[]>> {
  cargaPracticables ??= leerJSON<IndiceConceptos>('conceptos.json')
    .then((d) => (practicables = d.partes ?? {}))
    .catch(() => {
      const r: Record<string, string[]> = {};
      try {
        for (const [p, info] of Object.entries(obtenerIndice().partes)) if (info.secciones?.length) r[p] = info.secciones.map((s) => s.label);
      } catch {
        cargaPracticables = null;
      }
      return (practicables = r);
    });
  return cargaPracticables;
}

/** Concept keys of a part that can be practised (empty until cargarPracticables() has resolved). */
export function conceptosPracticables(parte: string): string[] {
  return (practicables?.[parte] ?? []).map((l) => `${parte}/${l}`);
}

/** «5.3 · La ecuación de Shockley» of a concept (its label when the index does not have it). */
export function tituloConcepto(clave: string): string {
  const i = clave.indexOf('/');
  const parte = clave.slice(0, i);
  const label = clave.slice(i + 1);
  try {
    const s = obtenerIndice().partes[parte]?.secciones?.find((x) => x.label === label);
    if (s) return s.num ? `${s.num} · ${s.titulo}` : s.titulo;
  } catch {
    /* index not loaded */
  }
  return label;
}

/** Concept of a Repaso question (its part's quiz is fetched once). */
export async function conceptoDePregunta(parte: string, id: string): Promise<string | null> {
  const p = parte || id.split('-')[0] || '';
  if (!p) return null;
  const { cargarCuestionario } = await repaso();
  const c = await cargarCuestionario(p).catch(() => null);
  const q = c?.preguntas.find((x) => x.id === id);
  if (!q) return null;
  if (q.ref.startsWith('prob-') || q.ref.startsWith('ej-')) await cargarEjercicios();
  return conceptoDeRef(p, q.ref);
}

/** Concept of an exercise or problem of the book. */
export async function conceptoDeEjercicio(label: string): Promise<string | null> {
  const d = await cargarEjercicios();
  const it = d?.items[label];
  return it?.seccion ? `${it.parte}/${it.seccion}` : null;
}

/** Concept of a practice item (its part from the id: «cap05-pred-sec-5.4»). */
export async function conceptoDePractica(id: string, parte?: string): Promise<string | null> {
  const p = parte || id.split('-')[0] || '';
  if (!p) return null;
  const { cargarPractica } = await practica();
  const d = await cargarPractica(p).catch(() => null);
  const it = d?.items.find((x) => x.id === id);
  return it ? `${it.parte}/${it.seccion}` : null;
}

/** Every answerable item of a part: practice items, Repaso questions and self-checked exercises. */
export async function itemsDeParte(parte: string): Promise<ItemCatalogo[]> {
  return (await itemsYFalta(parte)).items;
}

/** The items of a part, and whether a bank of it did not come for lack of network (the list is then partial). */
async function itemsYFalta(parte: string): Promise<{ items: ItemCatalogo[]; falta: boolean }> {
  const [{ cargarPractica }, { cargarCuestionario }] = await Promise.all([practica(), repaso()]);
  let falta = false;
  // (a part without a quiz has no file: that is no failure)
  const sinRed = (e: unknown) => {
    if (esDeRed(e)) falta = true;
    return null;
  };
  const [pr, rp, ej] = await Promise.all([cargarPractica(parte).catch(sinRed), cargarCuestionario(parte).catch(sinRed), cargarEjercicios()]);
  const r: ItemCatalogo[] = [];
  for (const it of pr?.items ?? []) r.push({ id: it.id, tipo: 'practica', subtipo: it.tipo, concepto: `${it.parte}/${it.seccion}` });
  for (const q of rp?.preguntas ?? []) {
    const c = conceptoDeRef(parte, q.ref);
    if (c) r.push({ id: q.id, tipo: 'pregunta', subtipo: q.tipo, concepto: c });
  }
  for (const [label, it] of Object.entries(ej?.items ?? {})) {
    // 1.0: also the exercises checked only through structured questions (choice, order, classification…)
    if (it.parte !== parte || it.modo !== 'auto' || !(it.respuestas.length || it.preguntas?.length) || !it.seccion) continue;
    r.push({ id: label, tipo: 'ejercicio', subtipo: it.tipo, concepto: `${parte}/${it.seccion}` });
  }
  return { items: r, falta };
}

const conceptosConItems = new Map<string, Promise<Set<string>>>();

/** The concepts of a part that have something to answer (cached per part). */
export function conceptosDeParte(parte: string): Promise<Set<string>> {
  let p = conceptosConItems.get(parte);
  if (!p) {
    // a list made while a bank was missing for lack of network is not kept: the next call loads again (0.11 final QA:
    // offline, a chapter's practice stayed at 4 of its exercises after «Reintentar»)
    p = itemsYFalta(parte).then(({ items, falta }) => {
      if (falta) conceptosConItems.delete(parte);
      return new Set(items.map((x) => x.concepto));
    });
    p.catch(() => conceptosConItems.delete(parte));
    conceptosConItems.set(parte, p);
  }
  return p;
}

/** Reading order of every concept of the book (chapter order × 1000 + section index). */
export function ordenConceptos(): Map<string, number> {
  const r = new Map<string, number>();
  let indice;
  try {
    indice = obtenerIndice();
  } catch {
    return r;
  }
  ordenLectura().forEach((p, i) => {
    (indice.partes[p]?.secciones ?? []).forEach((s, k) => r.set(`${p}/${s.label}`, i * 1000 + k));
  });
  return r;
}

/** Candidates of the planner for some parts (every section with items) plus the given concepts with evidence. */
export async function candidatos(
  partes: string[],
  dominioDe: (clave: string) => DominioMinimo | null,
  leccionHecha: (clave: string) => boolean,
  conEvidencia: string[],
): Promise<ConceptoCandidato[]> {
  const orden = ordenConceptos();
  const claves = new Set<string>(conEvidencia);
  const sets = await Promise.all(partes.map((p) => conceptosDeParte(p).catch(() => new Set<string>())));
  for (const s of sets) for (const c of s) claves.add(c);
  return [...claves]
    .filter((c) => orden.has(c))
    .map((clave) => ({ clave, parte: clave.slice(0, clave.indexOf('/')), orden: orden.get(clave)!, dominio: dominioDe(clave), leccion: leccionHecha(clave) }));
}

// ------------------------------------------------------------------ flashcards

/**
 * Glossary flashcards already due now (reviews and learning steps; never new cards: their daily quota belongs to
 * the Repaso page), each under the concept of the first section its «ver» links point to.
 */
export async function tarjetasDebidas(ahora: number): Promise<ItemCatalogo[]> {
  const [{ cargarBaraja }, { repaso: estado, cargarRepaso }] = await Promise.all([repaso(), import('../../componentes/repaso/estado.svelte')]);
  await cargarRepaso();
  const b = await cargarBaraja().catch(() => null);
  if (!b) return [];
  const refs = obtenerRefs();
  const r: ItemCatalogo[] = [];
  for (const [id, s] of Object.entries(estado.tarjetas)) {
    if (!s || s.v > ahora) continue;
    const t = b.porId.get(id.replace(/~i$/, ''));
    if (!t) continue;
    let concepto: string | null = null;
    for (const v of t.entrada.ver ?? []) {
      const ref = refs[v];
      if (!ref) continue;
      concepto = conceptoDeRef(ref.parte, v);
      if (concepto) break;
    }
    if (concepto) r.push({ id, tipo: 'tarjeta', subtipo: 'tarjeta', concepto });
  }
  return r;
}

// ------------------------------------------------------------------ problem of the day

/**
 * Problems for the problem of the day in some parts: «Calcula» items and self-checked exercises not solved. With
 * `alcanceEjercicios: 'todos'`, the exercises of the whole book (the last resort when a course has nothing left).
 */
export async function candidatosProblema(partes: string[], resueltos: (label: string) => boolean, alcanceEjercicios: 'partes' | 'todos' = 'partes'): Promise<CandidatoProblema[]> {
  const dentro = new Set(partes);
  const orden = ordenConceptos();
  const { cargarPractica } = await practica();
  const [ej, ...prs] = await Promise.all([cargarEjercicios(), ...partes.map((p) => cargarPractica(p).catch(() => null))]);
  const r: CandidatoProblema[] = [];
  for (const d of prs) {
    for (const it of d?.items ?? []) {
      if (it.tipo !== 'numerico') continue;
      r.push({ id: it.id, k: 'practica', parte: it.parte, orden: orden.get(`${it.parte}/${it.seccion}`) ?? 1e9 });
    }
  }
  for (const [label, it] of Object.entries(ej?.items ?? {})) {
    // 1.0: any self-checked exercise (numeric fields or structured questions) can be the problem of the day
    if (it.modo !== 'auto' || !(it.respuestas.length || it.preguntas?.length) || resueltos(label)) continue;
    if (alcanceEjercicios === 'partes' && !dentro.has(it.parte)) continue;
    r.push({ id: label, k: 'ejercicio', parte: it.parte, orden: orden.get(`${it.parte}/${it.seccion ?? ''}`) ?? 1e9 });
  }
  return r;
}
