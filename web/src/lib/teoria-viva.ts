// 1.0 «Teoría que se mueve»: the book's formulas whose values the reader moves in the text
// (web/public/libro/teoria-viva.json, written by web/scripts/teoria10.mjs from contenido/teoria_viva_curado.json;
// ESQUEMA.md «Teoría que se mueve»). Read-only content; nothing is stored. Pure helpers (no runes, no Vite) so the tests
// run them in Node: the result for a set of slider positions, and the points of the small graph. The loading lives in
// lib/teoria-viva-lugares.svelte.ts.
import { compilar, type Funcion } from '../componentes/calculadoras/expresion';

export interface EntradaViva {
  id: string;
  /** HTML symbol («R<sub>2</sub>»). */
  sim: string;
  nombre: string;
  unidad: string;
  /** The values the slider walks through, ascending. */
  valores: number[];
  /** Index of the starting value (the book's, where it gives one). */
  inicio: number;
  /** The values are spread on a logarithmic scale (the graph's x axis follows). */
  log: boolean;
}

export interface PiezaViva {
  id: string;
  /** Index of the equation block in its part (the reader and the lessons number top-level blocks the same way). */
  bloque: number;
  svg: string;
  titulo: string;
  formula: string;
  expr: string;
  resultado: { id: string; sim: string; nombre: string; unidad: string };
  entradas: EntradaViva[];
  grafica: { x: string; ylog: boolean };
}

export interface DatosTeoriaViva {
  version: 1;
  total: number;
  partes: Record<string, PiezaViva[]>;
}

/** The piece placed after a part's top-level block, if any. */
export function piezaEn(d: DatosTeoriaViva | null, parte: string, bloque: number): PiezaViva | undefined {
  return d?.partes[parte]?.find((p) => p.bloque === bloque);
}

const compiladas = new Map<string, Funcion>();
function funcion(expr: string): Funcion {
  let f = compiladas.get(expr);
  if (!f) compiladas.set(expr, (f = compilar(expr)));
  return f;
}

/** The values of every input at the given slider positions. */
export function entorno(p: PiezaViva, pos: Record<string, number>): Record<string, number> {
  return Object.fromEntries(p.entradas.map((e) => [e.id, e.valores[Math.min(e.valores.length - 1, Math.max(0, pos[e.id] ?? e.inicio))]!]));
}

export function resultadoDe(p: PiezaViva, pos: Record<string, number>): number {
  return funcion(p.expr)(entorno(p, pos));
}

/** The graph: the result along the x input (the other inputs where they are), and the current point. */
export function curva(p: PiezaViva, pos: Record<string, number>, n = 80): { xs: number[]; ys: number[]; x: number; y: number; xlog: boolean } {
  const ex = p.entradas.find((e) => e.id === p.grafica.x)!;
  const base = entorno(p, pos);
  const lo = ex.valores[0]!;
  const hi = ex.valores[ex.valores.length - 1]!;
  const xs = Array.from({ length: n }, (_, k) => (ex.log ? lo * (hi / lo) ** (k / (n - 1)) : lo + ((hi - lo) * k) / (n - 1)));
  const f = funcion(p.expr);
  const ys = xs.map((x) => f({ ...base, [ex.id]: x }));
  return { xs, ys, x: base[ex.id]!, y: f(base), xlog: ex.log };
}

/** A new slider position after a key (arrows ±1, Page Up/Down ±a tenth of the range, Home/End), or null. */
/**
 * A number for aria-valuenow/min/max without an exponent («0.00000015915», not «1.5915e-7»: axe and some screen
 * readers reject the exponent form, and capacitances and inductances in farads and henries have one).
 */
export function numeroAria(v: number): string {
  if (!Number.isFinite(v)) return '0';
  const s = String(v);
  if (!/e/i.test(s)) return s;
  if (Math.abs(v) >= 1e21) return BigInt(Math.round(v)).toString();
  const decimales = Math.min(100, Math.max(0, 15 - Math.floor(Math.log10(Math.abs(v) || 1))));
  return v.toFixed(decimales).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/**
 * numeroAria() for a slider's aria-valuemin / max / now written straight in the markup: `aria-valuenow={ariaNumero(v)}`.
 * Svelte's types ask for a number there, but it writes the value with setAttribute as it is, so the decimal text
 * goes through unchanged on every update. (Motor fixes 1.1: an action that rewrote the attributes after Svelte
 * lost the race on the next update — moving a 220 nF control wrote «2.2e-7» again.)
 */
export function ariaNumero(v: number): number {
  return numeroAria(v) as unknown as number;
}

export function teclaMando(tecla: string, pos: number, n: number): number | null {
  const salto = Math.max(1, Math.round(n / 10));
  const dentro = (k: number) => Math.min(n - 1, Math.max(0, k));
  switch (tecla) {
    case 'ArrowRight':
    case 'ArrowUp':
      return dentro(pos + 1);
    case 'ArrowLeft':
    case 'ArrowDown':
      return dentro(pos - 1);
    case 'PageUp':
      return dentro(pos + salto);
    case 'PageDown':
      return dentro(pos - salto);
    case 'Home':
      return 0;
    case 'End':
      return n - 1;
    default:
      return null;
  }
}
