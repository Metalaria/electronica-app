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
  /** Text the search opens with (e.g. from the index filter), consumed when it opens. */
  buscarTexto: '',
  ajustes: false,
  figura: null as FiguraAbierta | null,
  /** Narrow layout of the pages (below 1024 px): the pages' own phone and tablet arrangements. */
  movil: false,
  /**
   * 2.2, Material window size classes (lib/ventana.ts): compact < 600 → the bottom bar and the phone header; medium
   * 600–839 → the rail, with the book index as a drawer; expanded ≥ 840 → the rail and the index panel (as 2.1).
   */
  ventana: 'expandida' as 'compacta' | 'media' | 'expandida',
  /** compact window: bottom bar + phone header (the shell; pages keep `movil`). */
  compacta: false,
  /** compact or medium window: the book index is a drawer, not a panel beside the page. */
  cajon: false,
});
