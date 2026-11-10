// Preparing a «Práctica inteligente» session (0.11, group B): the plan and the items of lib/aprendizaje/seleccion.ts
// over the reader's mastery, course and progress, and each chosen item's data for its component (practice item,
// Repaso question, exercise label, flashcard, or — 1.1 — a card of a hand-authored lesson with its lesson).

import { cargarContexto, cursoActual, estudiada } from '../../lib/aprendizaje/contexto';
import { conceptosConDominio, dominioDe, ultimasRespuestas } from '../../lib/aprendizaje/dominio.svelte';
import { candidatos, itemsDeParte, tarjetasDebidas, tituloConcepto } from '../../lib/aprendizaje/catalogo';

export { tituloConcepto };
import { completar, partesDelPlan, planificar, N_SESION, type Alcance, type ItemElegido, type Motivo, type Plan } from '../../lib/aprendizaje/seleccion';
import { cargarPractica } from '../practica/datos';
import { cargarBaraja, cargarCuestionario, type Pregunta, type Tarjeta } from '../repaso/datos';
import { barajarCon } from '../practica/azar';
import { esDeRed } from '../../lib/errores';
import type { ItemPractica } from '../practica/tipos';
import { cargarLeccion11 } from '../../lib/leccion11/datos';
import { esPracticable, idRespuesta } from '../../lib/leccion11/motor';
import type { Leccion11 } from '../../lib/leccion11/tipos';

export interface ItemSesion extends ItemElegido {
  parte: string;
  /** «5.3 · La ecuación de Shockley». */
  titulo: string;
  practica?: ItemPractica;
  pregunta?: Pregunta;
  /** Order of a choice question's options. */
  orden?: number[];
  tarjeta?: Tarjeta;
  /** A 1.1 lesson card: the lesson and the card's position in it. */
  leccion11?: { leccion: Leccion11; k: number };
}

export interface Sesion {
  items: ItemSesion[];
  plan: Plan;
  /** The concepts of the session (for the before/after of the end screen). */
  conceptos: string[];
  /** The course the new material comes from. */
  curso: string;
  alcance: Alcance | null;
  /** Some bank of its parts did not come for lack of network: the session is smaller than it should be. */
  incompleta?: boolean;
}

export const NOMBRE_MOTIVO: Record<Motivo, string> = {
  debil: 'Para reforzar',
  repasar: 'Para repasar',
  nuevo: 'Nuevo',
  dominado: 'Repaso rápido',
  foco: 'Esta sección',
};

/** «cap05» or «cap05/sec-5.3» (the route's tail) → the focus. */
export function leerAlcance(texto: string): Alcance | null {
  const [parte = '', ...resto] = texto.split('/').filter(Boolean);
  if (!parte) return null;
  const label = resto.join('/');
  return label ? { parte, label } : { parte };
}

/** Chooses and loads a session. `semilla` makes it reproducible. */
export async function prepararSesion(alcanceTexto: string, semilla: number, ahora = Date.now(), n = N_SESION): Promise<Sesion> {
  await cargarContexto();
  const curso = cursoActual();
  const alcance = leerAlcance(alcanceTexto);
  const evidencia = conceptosConDominio()
    .map((d) => d.clave)
    .filter((c) => !alcance || c.startsWith(`${alcance.parte}/`));
  const partes = alcance ? [alcance.parte] : curso.partes;
  const lista = await candidatos(partes, (c) => dominioDe(c), estudiada, evidencia);
  const plan = planificar({ conceptos: lista, curso: curso.partes, alcance, n });
  const claves = new Set(plan.conceptos.map((c) => c.clave));
  const [porParte, tarjetas] = await Promise.all([
    Promise.all(partesDelPlan(plan).map((p) => itemsDeParte(p).catch(() => []))),
    tarjetasDebidas(ahora).catch(() => []),
  ]);
  // a bank of the plan's parts that did not come for lack of network (not one a part does not have): the session is
  // smaller than it should be and says so (0.11 final QA: offline, a chapter's practice offered 4 of its exercises
  // without a word)
  const incompleta = (
    await Promise.all(partesDelPlan(plan).flatMap((p) => [cargarPractica(p), cargarCuestionario(p)].map((x) => x.then(() => false, (e: unknown) => esDeRed(e)))))
  ).some(Boolean);
  const items = [...porParte.flat(), ...tarjetas].filter((it) => claves.has(it.concepto));
  const elegidos = completar({ plan, items, ultimas: ultimasRespuestas(), ahora, semilla });

  const baraja = elegidos.some((x) => x.tipo === 'tarjeta') ? await cargarBaraja().catch(() => null) : null;
  const resueltos: ItemSesion[] = [];
  for (const [k, it] of elegidos.entries()) {
    const parte = it.concepto.slice(0, it.concepto.indexOf('/'));
    const base: ItemSesion = { ...it, parte, titulo: tituloConcepto(it.concepto) };
    if (it.tipo === 'practica') {
      const d = await cargarPractica(parte).catch(() => null);
      base.practica = d?.items.find((x) => x.id === it.id);
      if (!base.practica) continue;
    } else if (it.tipo === 'pregunta') {
      const c = await cargarCuestionario(parte).catch(() => null);
      const q = c?.preguntas.find((x) => x.id === it.id);
      if (!q) continue;
      base.pregunta = q;
      base.orden = q.tipo === 'opcion' ? barajarCon(q.opciones.map((_, j) => j), semilla + k * 7919) : [];
    } else if (it.tipo === 'tarjeta') {
      const t = baraja?.porId.get(it.id.replace(/~i$/, ''));
      if (!t) continue;
      base.tarjeta = it.id.endsWith('~i') ? { ...t, id: it.id, inversa: true } : t;
    } else if (it.tipo === 'leccion11') {
      const l = await cargarLeccion11(parte, it.concepto.slice(parte.length + 1)).catch(() => null);
      const j = l ? l.tarjetas.findIndex((t) => idRespuesta(l, t) === it.id) : -1;
      // (a card renamed or removed since the index was written: nothing to ask)
      if (!l || j < 0 || !esPracticable(l.tarjetas[j]!)) continue;
      base.leccion11 = { leccion: l, k: j };
    }
    resueltos.push(base);
  }
  return { items: resueltos, plan, conceptos: [...new Set(resueltos.map((x) => x.concepto))], curso: curso.id, alcance, incompleta };
}
