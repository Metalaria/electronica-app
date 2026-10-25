// When each item of the reader's data last changed or was deleted on this device, for the synchronisation
// (lib/sincronizacion/registro.svelte.ts). The data modules call these two functions; they are cheap (one
// map update and a debounced write of the almacen key `sinc-marcas`) and do nothing else, so a module that
// does not call them still synchronises: the merge then dates a change when it first notices it.
//   { cambios: { <store key>: { <item id>: ms } }, borrados: { <store key>: { <item id>: ms } } }

import { obtenerAlmacen } from '../almacen';

export const CLAVE_MARCAS = 'sinc-marcas';

export interface Marcas {
  cambios: Record<string, Record<string, number>>;
  borrados: Record<string, Record<string, number>>;
}

let marcas: Marcas | null = null;
let carga: Promise<Marcas> | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;

export function cargarMarcas(): Promise<Marcas> {
  carga ??= obtenerAlmacen()
    .then((a) => a.leer<Marcas>(CLAVE_MARCAS))
    .catch(() => undefined)
    .then((m) => {
      const leidas: Marcas = {
        cambios: m && typeof m.cambios === 'object' && m.cambios ? m.cambios : {},
        borrados: m && typeof m.borrados === 'object' && m.borrados ? m.borrados : {},
      };
      // Marks made before the stored ones were read win (they are newer).
      if (marcas) {
        for (const tipo of ['cambios', 'borrados'] as const)
          for (const [k, ids] of Object.entries(marcas[tipo])) leidas[tipo][k] = { ...(leidas[tipo][k] ?? {}), ...ids };
      }
      marcas = leidas;
      return leidas;
    });
  return carga;
}

function guardar(): void {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    temporizador = null;
    void volcarMarcas();
  }, 500);
}

export async function volcarMarcas(): Promise<void> {
  if (temporizador) {
    clearTimeout(temporizador);
    temporizador = null;
  }
  const m = await cargarMarcas();
  await (await obtenerAlmacen()).escribir(CLAVE_MARCAS, m);
}

function anotar(tipo: keyof Marcas, clave: string, ids: string[], t: number): void {
  marcas ??= { cambios: {}, borrados: {} };
  const otro = tipo === 'cambios' ? 'borrados' : 'cambios';
  const mapa = (marcas[tipo][clave] ??= {});
  for (const id of ids) {
    mapa[id] = t;
    if (marcas[otro][clave]) delete marcas[otro][clave]![id];
  }
  void cargarMarcas();
  guardar();
}

/** An item was created or changed on this device (only needed for data without its own time). */
export function anotarCambio(clave: string, id: string, t = Date.now()): void {
  anotar('cambios', clave, [id], t);
}

/** Items were deleted on this device: their tombstones get this time. */
export function anotarBorrado(clave: string, ids: string | string[], t = Date.now()): void {
  anotar('borrados', clave, Array.isArray(ids) ? ids : [ids], t);
}

/** After a synchronisation: forgets the marks not newer than `hasta`. */
export async function olvidarMarcas(hasta: number): Promise<void> {
  const m = await cargarMarcas();
  for (const tipo of ['cambios', 'borrados'] as const) {
    for (const [k, ids] of Object.entries(m[tipo])) {
      for (const [id, t] of Object.entries(ids)) if (t <= hasta) delete ids[id];
      if (!Object.keys(ids).length) delete m[tipo][k];
    }
  }
  await volcarMarcas();
}
