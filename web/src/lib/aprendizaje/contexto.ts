// Where the reader is (0.11, group B), shared by «Práctica inteligente» and the problem of the day: the current
// course (the one of the chapter being studied, as the start page shows it; the first course for a new reader),
// whether a section counts as studied, and the furthest chapter of a course the reader has reached («level»).
// Reactive reads: call inside $derived or after the stores have loaded (cargarContexto).

import { progresoLecciones, cargarLecciones } from '../lecciones.svelte';
import { aprendizaje, cargarAprendizaje } from '../aprendizaje.svelte';
import { estadoCursos, cargarCursos } from './cursos-estado.svelte';
import { CURSOS, cursosDeParte, type Curso } from './cursos';
import { cargarDominio, dominioDe } from './dominio.svelte';
import { obtenerIndice } from '../datos';
import { destinoActual } from '../../componentes/inicio/destino.svelte';

/** Loads what the context reads. */
export function cargarContexto(): Promise<unknown> {
  return Promise.all([cargarLecciones(), cargarAprendizaje(), cargarCursos(), cargarDominio()]);
}

/** The reader's course: that of the chapter being studied (the first one when it is in two), else the first. */
export function cursoActual(): Curso {
  let parte = '';
  try {
    parte = destinoActual()?.parte ?? '';
  } catch {
    parte = '';
  }
  return cursosDeParte(parte)[0] ?? CURSOS[0]!;
}

/** A section counts as studied: its lesson completed, passed by a placement test, or read in the book. */
export function estudiada(clave: string): boolean {
  if (progresoLecciones.secciones[clave]?.c || estadoCursos.superadas[clave]) return true;
  const i = clave.indexOf('/');
  return !!aprendizaje.leidas[clave.slice(0, i)]?.[clave.slice(i + 1)];
}

/** Index (in the course) of the furthest chapter with a section studied or practised; 0 for a new reader. */
export function nivelEnCurso(c: Curso): number {
  let indice;
  try {
    indice = obtenerIndice();
  } catch {
    return 0;
  }
  let nivel = 0;
  c.partes.forEach((p, i) => {
    const secs = indice.partes[p]?.secciones ?? [];
    if (secs.some((s) => estudiada(`${p}/${s.label}`) || dominioDe(`${p}/${s.label}`).nivel !== 'nuevo')) nivel = i;
  });
  return nivel;
}
