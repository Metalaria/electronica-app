// The small maps the book's text needs to lay itself out completely: the problem panels (ejercicios.json), the
// «Simular» buttons (spice-refs.json) and the «Calcular» rows (formulas-ec.json). They used to be fetched after the
// text was drawn, and each one that arrived pushed the text down under the reader (0.11 QA: up to 360 px on the
// tablet), and the text's fonts (see `fuentes`). The reader (Lector.svelte) and the lessons (leccion/Leccion.svelte)
// wait for them, at most 1.5 s, before showing their first blocks; they are cached, so only the first part or lesson
// of a session waits.

import { cargarEjercicios } from './ejercicios.svelte';
import { cargarRefsSpice } from '../simulador/datos.svelte';
import { cargarMapa } from '../componentes/calculadoras/datos.svelte';

/**
 * The text's fonts, asked for before the text is drawn: when they arrived after it, every paragraph reflowed and the
 * text moved under the reader too (fonts are only fetched once something uses them, so fonts.ready alone would not
 * wait for them).
 */
export function fuentes(): Promise<unknown> {
  const f = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!f?.load) return Promise.resolve();
  return Promise.all(['400 1em "Source Serif 4"', '700 1em "Source Serif 4"', '400 1em "Source Sans 3"', '700 1em "Source Sans 3"'].map((x) => f.load(x).catch(() => [])));
}

/** The text's fonts only, at most 1.5 s (the glossary: 0.11 QA, the whole list reflowed and jumped when they came). */
export function fuentesDeLectura(): Promise<unknown> {
  return Promise.race([fuentes(), new Promise((r) => setTimeout(r, 1500))]);
}

export function mapasDeLectura(): Promise<unknown> {
  return Promise.race([Promise.all([cargarEjercicios(), cargarRefsSpice(), cargarMapa(), fuentes()]), new Promise((r) => setTimeout(r, 1500))]);
}
