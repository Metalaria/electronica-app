// The answers of an own exam while it is being taken: a per-device draft in localStorage (epa:docente-en-curso:<id>),
// so that a reload or a slip of «Atrás» loses nothing and the clock keeps its start. It is not synchronised (an exam
// is taken on one device); handing it in stores the result (synchronised) and removes the draft — only after the result
// was stored. 1.0 (review 10a, r10a·4): it is written and removed only while this tab may write (lib/pestana-activa.ts
// `escrituraPermitida`, the gate lib/almacen.ts applies to every key): a paused tab never touches it. Read synchronously
// (ExamenPropio shows «en curso» from it), so it stays in this device's localStorage — not a synchronised store, not in
// lib/esquemas.ts (a per-device key with the exam id in its name).

import { escrituraPermitida } from '../../lib/pestana-activa';
import type { DefinicionExamen } from '../../lib/docente/tipos';

export interface Borrador {
  variante: number;
  /** When it was started (ms): the time limit counts from here. */
  inicio: number;
  /** Item number (1-based) → its answers. */
  respuestas: Record<number, Record<string, string>>;
  /** The exam's `actualizado` it was started with (drafts of before review 10c are matched by it alone). */
  actualizado: number;
  /**
   * Review 10c (r10c·4): what is graded as the attempt started (items, points, time, variants, shuffling, seed) and its
   * fingerprint. The attempt goes on with this version whatever is edited or synchronised meanwhile — an edit of the
   * title, the notes, or a «Guardar» with nothing changed never drops the answers; a real change applies to the next one.
   */
  def?: DefinicionExamen;
  huella?: string;
  /** Review 10h: the exam's title (an attempt stays reachable even when the exam is gone for good). */
  titulo?: string;
  /**
   * Review 10h (r10h·3): the attempt was shown at least once. A draft is written only once its questions are on screen;
   * one without this mark (an older build wrote it at «Empezar», before loading) and without answers starts its clock
   * again when it opens. Only an opened attempt is ever handed in by itself.
   */
  abierto?: boolean;
  /** Review 10h: attempt time already counted (ms, by a monotonic clock): a system clock that goes back cannot undo it. */
  transcurrido?: number;
}

const clave = (id: string) => `epa:docente-en-curso:${id}`;

export function leerBorrador(id: string): Borrador | null {
  try {
    const v = JSON.parse(localStorage.getItem(clave(id)) ?? 'null') as Borrador | null;
    return v && typeof v.inicio === 'number' && typeof v.variante === 'number' && v.respuestas && typeof v.respuestas === 'object' ? v : null;
  } catch {
    return null;
  }
}

/** Stores the draft; false when it could not (another tab is the active one, storage blocked or full). */
export function escribirBorrador(id: string, b: Borrador): boolean {
  if (!escrituraPermitida()) return false;
  try {
    localStorage.setItem(clave(id), JSON.stringify(b));
    return true;
  } catch {
    // storage blocked or full: the exam goes on in memory
    return false;
  }
}

const PREFIJO = 'epa:docente-en-curso:';

/** Exam ids with a draft on this device. */
function idsConBorrador(): string[] {
  const r: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIJO)) r.push(k.slice(PREFIJO.length));
    }
  } catch {
    // storage blocked: none
  }
  return r.sort();
}

/**
 * Attempts on this device at exams that no longer exist here — deleted, or gone for good (its tombstone pruned by the
 * synchronisation after 90 days, review 10h r10h·4) — and that carry their own version (`def`): they can still be finished
 * and handed in; the list offers them.
 */
export function intentosDeBorrados(existe: (id: string) => boolean): string[] {
  return idsConBorrador().filter((id) => !existe(id) && !!leerBorrador(id)?.def);
}

/**
 * Removes the drafts of exams that were deleted (their tombstone is known) and that cannot be taken up again — those
 * without their own version (written before review 10c). A draft with `def` stays (review 10f: an exam deleted on
 * another device must not take an attempt in progress here with it; it is still submittable). Deleting the exam ON
 * THIS DEVICE removes its draft (the dialog says an attempt is in progress). Only while this tab may write (the same
 * gate). Returns how many were removed.
 */
export function limpiarHuerfanos(borrado: (id: string) => boolean): number {
  if (!escrituraPermitida()) return 0;
  let n = 0;
  try {
    const claves: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIJO)) claves.push(k);
    }
    for (const k of claves) {
      const id = k.slice(PREFIJO.length);
      if (!borrado(id) || leerBorrador(id)?.def) continue;
      localStorage.removeItem(k);
      n++;
    }
  } catch {
    // storage blocked: nothing to clean
  }
  return n;
}

/** Removes the draft (after its result was stored); false when this tab may not write now. */
export function borrarBorrador(id: string): boolean {
  if (!escrituraPermitida()) return false;
  try {
    localStorage.removeItem(clave(id));
    return true;
  } catch {
    return false;
  }
}
