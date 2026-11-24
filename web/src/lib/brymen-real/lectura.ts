// 1.3: the real Brymen's reading as text, and which of its two displays answers a measurement in a given unit.
// Light (no instrument model): the lessons' «En el banco» card uses it.

import type { LecturaReal, PantallaReal } from './protocolo.ts';

/** The unit a value of the app is in, reduced to the meter's («°» never is one of the meter's). */
export function base(u: string): string {
  return u.trim();
}

/** The display of the reading that measures in `unidad` (main first), with a value; null when none does. */
export function pantallaPara(l: LecturaReal | null, unidad: string): PantallaReal | null {
  if (!l) return null;
  const u = base(unidad);
  for (const p of [l.principal, l.secundaria]) if (p && p.unidad === u && p.valor !== null) return p;
  return null;
}

/** What the meter is measuring, in words, when it is not `unidad` («en Ω», «en OL»). */
export function porQueNo(l: LecturaReal | null, unidad: string): string {
  if (!l) return 'Su Brymen todavía no ha enviado ninguna lectura.';
  const p = l.principal;
  if (p.ol) return 'Su Brymen marca OL (fuera de escala): cambie de escala o revise las puntas.';
  if (p.unidad !== base(unidad))
    return `Su Brymen está midiendo ${p.unidad ? `en ${p.prefijo}${p.unidad}` : 'otra cosa'} y esta medida va en ${unidad || 'un número sin unidad'}: gire el selector a la función que pide.`;
  return 'Su Brymen no muestra un número que se pueda usar.';
}

function marca(p: PantallaReal): string {
  if (p.ac && p.dc) return ' AC+DC';
  if (p.ac) return ' ∿';
  if (p.dc && (p.unidad === 'V' || p.unidad === 'A')) return ' ⎓';
  return '';
}

/** Only points, dashes and blanks: the display shows no figures. */
const SIN_CIFRAS = /^[\s.\-]*$/;

/** The display as the meter shows it, in Spanish style: «4,8712 V ⎓», «OL», «12,530 mA ⎓». */
export function textoPantalla(p: PantallaReal): string {
  if (p.ol) return 'OL';
  // 1.4.1: a display with no figures —blank with only the decimal point, or the dashes the meter shows for an instant
  // while it changes range— is a dash, not «, kΩ» or «−-,--- kΩ» (a word on the display, such as a menu, stays)
  if (SIN_CIFRAS.test(p.texto)) return `—${p.unidad ? ` ${p.prefijo}${p.unidad}` : ''}${marca(p)}`;
  const t = p.texto.replace('-', '−').replace('.', ',');
  return `${t}${p.unidad ? ` ${p.prefijo}${p.unidad}` : ''}${marca(p)}`;
}

/** The reading as typed into a field: number and prefixed unit («4,8712 V», «12,530 mA»). */
export function textoCampo(p: PantallaReal): string {
  return `${p.texto.replace('.', ',')}${p.unidad ? ` ${p.prefijo}${p.unidad}` : ''}`;
}

