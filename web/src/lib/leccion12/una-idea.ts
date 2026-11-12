// 1.2 «one idea per screen»: warnings for a card that probably holds more than one idea, or none to look at. Pure,
// no Svelte (the generator, web/scripts/lecciones11.mjs → lib/leccion11/generar.ts, calls it and prints the
// messages as WARNINGS: they never stop a lesson from being published; the 40-word limit itself stays an error there).
//
// The shell draws the visual on top (widget or formula), then the short text, then what is answered, so a card reads
// best when it has one visual, at most ~40 words and at most two sentences.

import { contarPalabras, textoPlano } from '../leccion11/texto';
import type { Tarjeta } from '../leccion11/tipos';

/** Words of title + text + note the screen holds comfortably above the fold of a phone (the generator's limit). */
export const PALABRAS_UNA_IDEA = 40;
/** Sentences of the text: a third one is usually a second idea. */
export const FRASES_UNA_IDEA = 2;

/** Sentences of a plain text («1,5 V.» and «p. ej.» are not ends of sentence). */
export function contarFrases(s: string): number {
  const limpio = s
    .replace(/\bp\. ?ej\./gi, 'p ej')
    .replace(/\b(etc|aprox|fig|ec|sec|cap)\./gi, '$1')
    .replace(/(\d)\.(\d)/g, '$1,$2');
  return limpio.split(/[.!?…]+(?:\s|$)/).filter((x) => x.trim().length > 0).length;
}

/** Whether the card has something to look at or handle (a widget, a formula, an estimate, an order, a match). */
export function tieneVisual(t: Tarjeta): boolean {
  const extra = t as Tarjeta & { actividad?: unknown };
  return !!(t.widget || t.ec || t.estimar || t.ordenar || t.emparejar || extra.actividad);
}

/** The warnings of one card (empty when it reads as one idea). The summary card is not checked. */
export function avisosUnaIdea(t: Tarjeta): string[] {
  if (t.tipo === 'resumen') return [];
  const out: string[] = [];
  const palabras = contarPalabras(t.titulo) + contarPalabras(t.texto) + contarPalabras(t.nota);
  if (palabras > PALABRAS_UNA_IDEA) out.push(`una idea por pantalla: ${palabras} palabras entre título, texto y nota (máximo ${PALABRAS_UNA_IDEA})`);
  const frases = contarFrases(textoPlano(t.texto));
  if (frases > FRASES_UNA_IDEA) out.push(`una idea por pantalla: el texto tiene ${frases} frases (como mucho ${FRASES_UNA_IDEA}; parta la tarjeta)`);
  if (!tieneVisual(t)) out.push('una idea por pantalla: sin nada que mirar o mover (circuito, gráfica, fórmula, estimar, ordenar o emparejar) encima del texto');
  return out;
}
