// 1.1 lessons: loading the generated data (libro/lecciones11/indice.json and <parte>/<label>.json). The index is small
// and fetched once; a lesson is fetched when opened. Without the files (the sample content, an older book folder) no
// section has a new lesson and the 1.0 lesson opens, as before.

import { leerJSON } from '../datos';
import { esDeRed } from '../errores';
import type { IndiceLecciones11, Leccion11 } from './tipos';

let indice: Promise<IndiceLecciones11 | null> | null = null;
let sinRed = false;
const lecciones = new Map<string, Promise<Leccion11>>();

export function cargarIndice11(): Promise<IndiceLecciones11 | null> {
  indice ??= leerJSON<IndiceLecciones11>('lecciones11/indice.json')
    .then((x) => {
      sinRed = false;
      return x && x.version === 1 && x.lecciones ? x : null;
    })
    .catch((e: unknown) => {
      // offline before the file was ever cached, or a failed fetch: ask again next time
      indice = null;
      sinRed = esDeRed(e);
      return null;
    });
  return indice;
}

/** The last load of the index failed for lack of network (a list built without it is partial: do not keep it). */
export function indice11SinRed(): boolean {
  return sinRed;
}

/** Whether a section («parte», «label») has a new lesson. */
export async function hayLeccion11(parte: string, seccion: string): Promise<boolean> {
  const i = await cargarIndice11();
  return !!i?.lecciones[`${parte}/${seccion}`];
}

export function cargarLeccion11(parte: string, seccion: string): Promise<Leccion11> {
  const id = `${parte}/${seccion}`;
  let p = lecciones.get(id);
  if (!p) {
    p = leerJSON<Leccion11>(`lecciones11/${parte}/${seccion}.json`).then((l) => {
      if (!l || l.version !== 1 || l.id !== id || !Array.isArray(l.tarjetas) || !l.tarjetas.length) throw new Error(`La lección ${id} no se puede leer`);
      return l;
    });
    p.catch(() => lecciones.delete(id));
    lecciones.set(id, p);
  }
  return p;
}
