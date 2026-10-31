// Where the reader is in each thematic course (0.11): the state of every lesson (completed, passed by the
// placement test, started, pending), the course's progress and the next lesson to «Continuar». Reactive (reads
// the lessons' progress and the courses' state): call it inside $derived.

import type { Indice } from '../../lib/tipos';
import { progresoLecciones } from '../../lib/lecciones.svelte';
import { estadoCursos } from '../../lib/aprendizaje/cursos-estado.svelte';
import { leccionesDeCurso, type Curso, type LeccionCurso } from '../../lib/aprendizaje/cursos';
import { rutaLeccion } from '../../lib/lecciones.svelte';

export type EstadoLeccion = 'hecha' | 'superada' | 'en-curso' | 'pendiente';

export interface LeccionConEstado extends LeccionCurso {
  estado: EstadoLeccion;
}

export interface AvanceCurso {
  lecciones: LeccionConEstado[];
  total: number;
  hechas: number;
  superadas: number;
  /** 0–1: completed or passed. */
  fraccion: number;
  /** The first lesson neither completed nor passed (null when the course is done). */
  siguiente: LeccionConEstado | null;
  /** Its route (at the step where it was left). */
  href: string | null;
  empezado: boolean;
}

export function estadoLeccion(parte: string, label: string): EstadoLeccion {
  const id = `${parte}/${label}`;
  const p = progresoLecciones.secciones[id];
  if (p?.c) return 'hecha';
  if (estadoCursos.superadas[id]) return 'superada';
  if (p && p.h.length) return 'en-curso';
  return 'pendiente';
}

export function avanceCurso(c: Curso, indice: Indice): AvanceCurso {
  const lecciones = leccionesDeCurso(c, indice).map((l) => ({ ...l, estado: estadoLeccion(l.parte, l.label) }));
  const hechas = lecciones.filter((l) => l.estado === 'hecha').length;
  const superadas = lecciones.filter((l) => l.estado === 'superada').length;
  const siguiente = lecciones.find((l) => l.estado !== 'hecha' && l.estado !== 'superada') ?? null;
  let href: string | null = null;
  if (siguiente) {
    const p = progresoLecciones.secciones[`${siguiente.parte}/${siguiente.label}`];
    href = rutaLeccion(siguiente.parte, siguiente.label, p && !p.c ? Math.min(p.u, Math.max(0, p.n - 1)) : undefined);
  }
  const total = lecciones.length;
  return {
    lecciones,
    total,
    hechas,
    superadas,
    fraccion: total ? (hechas + superadas) / total : 0,
    siguiente,
    href,
    empezado: lecciones.some((l) => l.estado !== 'pendiente'),
  };
}
