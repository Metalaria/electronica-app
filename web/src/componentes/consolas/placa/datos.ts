// The console mainboards in 3D and 2D (contenido/consolas_pcb.py → public/consolas/placas/): the boards use the
// «Proyectos KiCad» format (proyectos/datos.ts, DatosPlaca), drawn by the same viewer components, plus the link to
// the console's schematic (`consola`).

import type { DatosPlaca } from '../../proyectos/datos';
import type { IdMaquina } from '../datos';

export interface FuentePlaca {
  titulo: string;
  autor: string;
  url: string;
  licencia: string;
  uso: string;
}

export interface DatosPlacaConsola extends DatosPlaca {
  consola: {
    maquina: IdMaquina;
    /** The board's references and nets are those of the console's schematic. */
    enlazada: boolean;
    aviso: string;
    fuente: FuentePlaca;
    /** Board net → schematic net (by the pins of its pads). */
    redes: Record<string, string>;
    /** References that are also in the schematic. */
    refs: string[];
    /** Copper layers of the original (the viewer draws the outer two). */
    capas_cobre: string[];
    tipo: 'kicad' | 'gerber';
  };
}

export interface ResumenPlaca {
  id: string;
  maquina: IdMaquina;
  titulo: string;
  corto: string;
  enlazada: boolean;
  tipo: 'kicad' | 'gerber';
  aviso: string;
  fuente: FuentePlaca;
  ancho: number;
  alto: number;
  capas: number;
  componentes: number;
  redes: number;
  bytes: number;
}

/** Boards of each machine, for the tabs (known without fetching anything). */
export const PLACAS_DE: Partial<Record<IdMaquina, { id: string; corto: string; enlazada: boolean }[]>> = {
  megadrive: [{ id: 'megadrive', corto: 'IC BD M5 PAL · recreación KiCad', enlazada: true }],
  gbc: [
    { id: 'gbc-cgb04', corto: 'CGB-CPU-04 · Gerber', enlazada: true },
    { id: 'gbc-opengbc', corto: 'OpenGBC · placa moderna', enlazada: false },
  ],
};

export function tienePlaca(m: IdMaquina): boolean {
  return !!PLACAS_DE[m]?.length;
}

const cache = new Map<string, Promise<unknown>>();

function pedir<T>(ruta: string): Promise<T> {
  let p = cache.get(ruta);
  if (!p) {
    p = fetch(ruta).then((r) => {
      if (!r.ok) throw new Error(`No se pudo cargar ${ruta} (${r.status})`);
      return r.json();
    });
    p.catch(() => cache.delete(ruta));
    cache.set(ruta, p);
  }
  return p as Promise<T>;
}

export function cargarPlacaConsola(id: string): Promise<DatosPlacaConsola> {
  return pedir<DatosPlacaConsola>(`consolas/placas/${id}.json`);
}

export function cargarIndicePlacas(): Promise<{ version: number; placas: ResumenPlaca[] }> {
  return pedir<{ version: number; placas: ResumenPlaca[] }>('consolas/placas/indice.json');
}

/** Schematic net → board net (inverse of `consola.redes`). */
export function redDePlaca(d: DatosPlacaConsola, redEsquema: string): string | null {
  if (!d.consola.enlazada) return null;
  for (const [placa, esq] of Object.entries(d.consola.redes)) if (esq === redEsquema) return placa;
  return d.redes.some((r) => r.n === redEsquema) ? redEsquema : null;
}
