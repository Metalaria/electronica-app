// 1.1 «Proyectos por etapas»: each stage's circuit is an ordinary saved circuit of «Mis circuitos» (store
// `editor-circuitos`, synchronised like any other), made from the stage's netlist the first time the stage is opened —
// or again when the reader deleted it — and marked `origen: {tipo: 'proyecto', id: <stage id>}` so the editor shows
// the stage's band. The stage record (lib/proyectos11/registro.ts `c`) keeps its id, so every device opens the same one.

import { cargarCircuitos, circuito, guardarNuevo, actualizar, listaCircuitos } from '../editor/circuitos.svelte';
import { importarNetlist } from '../editor/importar';
import type { DocumentoEsquema } from '../editor/tipos';
import { anotarCircuitoEtapa, cargarProyectos, registroEtapa } from '../../lib/proyectos11/estado.svelte';
import type { Etapa, Proyecto } from '../../lib/proyectos11/tipos';
import { plano } from '../../lib/proyectos11/comprobar';

/** «Fuente de laboratorio · Etapa 1: El rectificador y el filtro». */
export const tituloCircuito = (p: Proyecto, e: Etapa): string => `${p.corto} · Etapa ${e.n}: ${plano(e.titulo)}`;

/** The stage's starting drawing (the editor's layout of its netlist). */
export async function dibujoInicial(p: Proyecto, e: Etapa): Promise<DocumentoEsquema> {
  const doc = await importarNetlist(e.netlist, { tipo: 'proyecto', id: e.id });
  if (!doc) throw new Error('No se pudo dibujar el circuito de esta etapa.');
  doc.titulo = tituloCircuito(p, e);
  return doc;
}

const enCurso = new Map<string, Promise<string>>();

/** The id of the stage's circuit, made now if there is none (or it was deleted). One at a time per stage. */
export function asegurarCircuito(p: Proyecto, e: Etapa): Promise<string> {
  const ya = enCurso.get(e.id);
  if (ya) return ya;
  const t = (async () => {
    await Promise.all([cargarCircuitos(), cargarProyectos()]);
    const c = registroEtapa(e.id)?.c;
    if (c && circuito(c)) return c;
    // a circuit of this stage that the record does not name (made on another device before the records met): reuse it
    const otro = listaCircuitos().find((x) => x.doc.origen?.tipo === 'proyecto' && x.doc.origen.id === e.id);
    const id = otro?.id ?? (await guardarNuevo(tituloCircuito(p, e), await dibujoInicial(p, e)));
    await anotarCircuitoEtapa(e.id, id).catch(() => undefined);
    return id;
  })();
  enCurso.set(e.id, t);
  void t.finally(() => enCurso.delete(e.id)).catch(() => undefined);
  return t;
}

/** «Restaurar la etapa»: the same circuit (same id) drawn again from the stage's netlist. */
export async function restaurarCircuito(p: Proyecto, e: Etapa, id: string): Promise<void> {
  await actualizar(id, await dibujoInicial(p, e));
}
