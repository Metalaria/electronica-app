// Reading and checking the number typed for a numeric Repaso question (pure: also used by lib/docente in Node).

import type { PreguntaNumero } from './datos';

/** Parses a number typed by the reader: decimal comma or point, spaces, «−», SI-free. */
export function leerNumero(texto: string): number | null {
  let t = texto.trim().replace(/−/g, '-').replace(/[\s  ]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

export function numeroCorrecto(p: PreguntaNumero, v: number): boolean {
  const margen = Math.max(Math.abs(p.valor) * p.tolerancia, 1e-12);
  return Math.abs(v - p.valor) <= margen + Math.abs(p.valor) * 1e-9;
}
