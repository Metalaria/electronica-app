// Preparing a «Práctica inteligente» session (0.11, group B): the plan and the items of lib/aprendizaje/seleccion.ts
// over the reader's mastery, course and progress, and each chosen item's data for its component (practice item,
// Repaso question, exercise label, flashcard).

import { cargarContexto, cursoActual, estudiada } from '../../lib/aprendizaje/contexto';
import { conceptosConDominio, dominioDe, ultimasRespuestas } from '../../lib/aprendizaje/dominio.svelte';
import { candidatos, itemsDeParte, tarjetasDebidas, tituloConcepto } from '../../lib/aprendizaje/catalogo';

export { tituloConcepto };
import { completar, partesDelPlan, planificar, N_SESION, type Alcance, type ItemElegido, type Motivo, type Plan } from '../../lib/aprendizaje/seleccion';
import { cargarPractica } from '../practica/datos';
import { cargarBaraja, cargarCuestionario, type Pregunta, type Tarjeta } from '../repaso/datos';
import { barajarCon } from '../practica/azar';
import type { ItemPractica } from '../practica/tipos';

export interface ItemSesion extends ItemElegido {
  parte: string;
  /** «5.3 · La ecuación de Shockley». */
  titulo: string;
  practica?: ItemPractica;
  pregunta?: Pregunta;
  /** Order of a choice question's options. */
  orden?: number[];
  tarjeta?: Tarjeta;
}

export interface Sesion {
  items: ItemSesion[];
  plan: Plan;
  /** The concepts of the session (for the before/after of the end screen). */
  conceptos: string[];
  /** The course the new material comes from. */
  curso: string;
  alcance: Alcance | null;
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
    }
    resueltos.push(base);
  }
  return { items: resueltos, plan, conceptos: [...new Set(resueltos.map((x) => x.concepto))], curso: curso.id, alcance };
}
