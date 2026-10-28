// Loading the practice items of a part (libro/practica/<parte>.json) and placing them in a lesson.

import { leerJSON } from '../../lib/datos';
import type { PasoLeccion } from '../../lib/leccion-pasos';
import type { IndicePractica, ItemPractica, PracticaParte, SeccionPractica } from './tipos';

const cache = new Map<string, Promise<PracticaParte | null>>();

/** The practice file of a part, or null when the part has none (cached; a failed fetch is retried later). */
export function cargarPractica(parte: string): Promise<PracticaParte | null> {
  let p = cache.get(parte);
  if (!p) {
    p = cargarIndicePractica()
      .then((ind) => (ind && ind.partes.includes(parte) ? leerJSON<PracticaParte>(`practica/${parte}.json`) : null))
      .catch(() => {
        cache.delete(parte);
        return null;
      });
    cache.set(parte, p);
  }
  return p;
}

let indice: Promise<IndicePractica | null> | null = null;

export function cargarIndicePractica(): Promise<IndicePractica | null> {
  indice ??= leerJSON<IndicePractica>('practica/indice.json').catch(() => {
    indice = null;
    return null;
  });
  return indice;
}

/** The lesson's items of a section (in book order) and its key ideas. */
export async function practicaDeSeccion(parte: string, seccion: string): Promise<{ items: ItemPractica[]; ideas: SeccionPractica['ideas'] }> {
  const d = await cargarPractica(parte);
  const s = d?.secciones[seccion];
  if (!d || !s) return { items: [], ideas: [] };
  const porId = new Map(d.items.map((x) => [x.id, x]));
  return { items: s.items.map((id) => porId.get(id)).filter((x): x is ItemPractica => !!x), ideas: s.ideas };
}

/** Index of the step that shows a block (the last step when the block is past every step). */
export function pasoDeBloque(pasos: PasoLeccion[], bloque: number): number {
  for (let k = 0; k < pasos.length; k++) {
    const p = pasos[k]!;
    if (bloque >= p.desde && bloque < p.hasta) return k;
  }
  let mejor = pasos.length - 1;
  for (let k = 0; k < pasos.length; k++) if (pasos[k]!.desde <= bloque) mejor = k;
  return Math.max(0, mejor);
}

/** A screen of a lesson: a step, a practice item after a step, a Repaso question, or the end. */
export type Pantalla = { k: 'paso'; paso: number } | { k: 'practica'; paso: number; item: number } | { k: 'pregunta'; i: number } | { k: 'fin' };

/** The screens of a lesson: every step followed by the items placed after it, then the questions and the end. */
export function pantallasLeccion(pasos: PasoLeccion[], items: ItemPractica[], preguntas: number): Pantalla[] {
  const tras = new Map<number, number[]>();
  items.forEach((it, i) => {
    const k = pasoDeBloque(pasos, it.bloque);
    (tras.get(k) ?? tras.set(k, []).get(k)!).push(i);
  });
  const r: Pantalla[] = [];
  for (let k = 0; k < pasos.length; k++) {
    r.push({ k: 'paso', paso: k });
    for (const i of tras.get(k) ?? []) r.push({ k: 'practica', paso: k, item: i });
  }
  for (let i = 0; i < preguntas; i++) r.push({ k: 'pregunta', i });
  r.push({ k: 'fin' });
  return r;
}

const CLAVE_SEMILLAS = 'epa:practica-semillas';

/** Seed of the next variant of a problem with changing values (device-only convenience: localStorage). */
export function semillaDe(id: string): number {
  try {
    const m = JSON.parse(localStorage.getItem(CLAVE_SEMILLAS) ?? '{}') as Record<string, number>;
    return typeof m[id] === 'number' ? m[id]! : 0;
  } catch {
    return 0;
  }
}

export function guardarSemilla(id: string, n: number): void {
  try {
    const m = JSON.parse(localStorage.getItem(CLAVE_SEMILLAS) ?? '{}') as Record<string, number>;
    m[id] = n;
    localStorage.setItem(CLAVE_SEMILLAS, JSON.stringify(m));
  } catch {
    /* private mode: the seed lives for the session only */
  }
}

/** Name of each kind for headers and the counts. */
export const NOMBRE_TIPO: Record<ItemPractica['tipo'], string> = {
  numerico: 'Calcula',
  prediccion: 'Predice y comprueba',
  deslizador: 'Ajusta',
  toque: 'Señala en el esquema',
  ordenar: 'Ordena',
  parejas: 'Une las parejas',
  protoboard: 'Completa el montaje',
};
