// The two collections of animations that share the gallery, the page and the «Ver animación» button:
// components (how each part works inside, #/componentes) and concepts (the theory the book explains with
// static figures: phasors, Fourier, aliasing, feedback…, #/conceptos). Metadata only: the scenes are lazy.

import type { Component } from 'svelte';
import { ANIMACIONES, FAMILIAS } from './catalogo';
import { CARGADORES } from './cargadores';
import { CONCEPTOS, AREAS } from './conceptos/catalogo';
import { CARGADORES_CONCEPTOS } from './conceptos/cargadores';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Cargador = () => Promise<{ default: Component<any> }>;

export interface EntradaColeccion {
  id: string;
  titulo: string;
  resumen: string;
  claves: string;
  libro: string[];
  /** Family (components) or area (concepts). */
  grupo: string;
  /** Gallery artwork: a component glyph (ui/Simbolo) or a concept glyph (conceptos/Icono). */
  arte: string;
}

export interface GrupoColeccion {
  id: string;
  nombre: string;
  color: string;
}

export interface Coleccion {
  /** First segment of the route: #/componentes/<id> or #/conceptos/<id>. */
  ruta: 'componentes' | 'conceptos';
  /** Breadcrumb and window title. */
  nombre: string;
  grupos: GrupoColeccion[];
  lista: EntradaColeccion[];
  cargadores: Record<string, Cargador>;
}

export const COMPONENTES: Coleccion = {
  ruta: 'componentes',
  nombre: 'Componentes',
  grupos: FAMILIAS,
  lista: ANIMACIONES.map((a) => ({ ...a, grupo: a.familia, arte: a.simbolo })),
  cargadores: CARGADORES,
};

export const CONCEPTOS_ANIMADOS: Coleccion = {
  ruta: 'conceptos',
  nombre: 'Conceptos',
  grupos: AREAS,
  lista: CONCEPTOS.map((c) => ({ ...c, grupo: c.area, arte: c.icono })),
  cargadores: CARGADORES_CONCEPTOS,
};

export function disponibleEn(col: Coleccion, id: string): boolean {
  return id in col.cargadores;
}

export function entrada(col: Coleccion, id: string): EntradaColeccion | undefined {
  return col.lista.find((a) => a.id === id);
}

export function grupoDe(col: Coleccion, id: string): GrupoColeccion {
  return col.grupos.find((g) => g.id === id) ?? col.grupos[0]!;
}

export interface EnlaceAnimacion {
  entrada: EntradaColeccion;
  coleccion: Coleccion;
  href: string;
}

let porEtiqueta: Map<string, EnlaceAnimacion[]> | null = null;

/** Every available animation (component or concept) that illustrates a book label, components first. */
export function enlacesDe(label: string): EnlaceAnimacion[] {
  if (!porEtiqueta) {
    porEtiqueta = new Map();
    for (const col of [COMPONENTES, CONCEPTOS_ANIMADOS])
      for (const e of col.lista) {
        if (!disponibleEn(col, e.id)) continue;
        for (const l of e.libro) {
          const lista = porEtiqueta.get(l) ?? [];
          lista.push({ entrada: e, coleccion: col, href: `#/${col.ruta}/${e.id}` });
          porEtiqueta.set(l, lista);
        }
      }
  }
  return porEtiqueta.get(label) ?? [];
}
