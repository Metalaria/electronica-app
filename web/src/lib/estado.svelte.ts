// Shared UI state of the app.

import type { Indice, Refs } from './tipos';
import type { TemaEfectivo } from './color';

export interface FiguraAbierta {
  src: string;
  num?: string | null;
  pie?: string | null;
  credito?: string | null;
  alt: string;
}

export const app = $state({
  cargado: false,
  error: '',
  indice: null as Indice | null,
  refs: {} as Refs,
  modo: 'libro' as 'libro' | 'muestra',
  tema: 'claro' as TemaEfectivo,
  /** Accent colour of the part on screen (block colour, hex without #). */
  color: '1A3A5C',
  /** Section being read (scroll spy). */
  seccion: null as { parte: string; label: string; num: string; titulo: string } | null,
  /** Fraction of the current part already scrolled. */
  progreso: 0,
  lateral: false,
  buscador: false,
  ajustes: false,
  figura: null as FiguraAbierta | null,
  /** Width class: phones and small tablets use the drawer. */
  movil: false,
});
