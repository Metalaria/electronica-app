// Problems with changing values (0.10): a formula of the book (formulas.json, the calculators' catalogue)
// solved with other realistic values on every attempt. The values come from lists fixed by the generator
// (E12/E24 for resistors, capacitors and inductors, the usual supplies for voltages from 3 V up, round
// 1-1,5-2-2,2-3,3-4,7-5-6,8 series otherwise; device constants, percentages, decibels, temperatures and
// integers keep the book's value), and every variant is checked here: finite result, same sign as the book's
// and inside the variable's usual range. Plain TypeScript (the generator runs it in Node).

import type { Entorno } from '../calculadoras/expresion.ts';
import type { VarFormula } from '../calculadoras/tipos.ts';
import { calcular } from '../calculadoras/motor.ts';
import { formatoValor } from '../calculadoras/unidades.ts';
import { generador, hash } from './azar.ts';
import type { ItemNumerico, Variacion } from './tipos.ts';

const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
const REDONDOS = [1, 1.5, 2, 2.2, 3, 3.3, 4, 4.7, 5, 6, 6.8, 8];
const ALIMENTACION = [3.3, 5, 6, 9, 12, 15, 18, 24, 30, 36, 48];
/** Voltages that belong to a device, not to the circuit around it. */
const PROPIA = /zener|early|umbral|directa|referencia|garantizada|reconocida|pérdida|saturaci|ruptura|codo|diodo|led|base-emisor|puerta/i;

function serie(mantisas: number[], lo: number, hi: number): number[] {
  const r: number[] = [];
  if (!(lo > 0) || !(hi > lo)) return r;
  for (let d = Math.floor(Math.log10(lo)) - 1; d <= Math.ceil(Math.log10(hi)); d++)
    for (const m of mantisas) {
      const v = Number((m * 10 ** d).toPrecision(3));
      if (v >= lo * (1 - 1e-9) && v <= hi * (1 + 1e-9)) r.push(v);
    }
  return [...new Set(r)].sort((a, b) => a - b);
}

/** How a variable of a formula may change around its book value (null: it keeps the book value). */
export function variacionDe(v: VarFormula, libro: number): Variacion | null {
  if (!(libro > 0) || !Number.isFinite(libro) || v.entero) return null;
  const lo = Math.max(v.min, libro / 3);
  const hi = Math.min(v.max, libro * 3);
  let r: Variacion | null = null;
  if (v.unidad === 'Ω' || v.unidad === 'F' || v.unidad === 'H') r = { serie: 'E12', valores: serie(E12, lo, hi) };
  else if (v.unidad === 'V') {
    // From 3 V up a voltage is a supply or a signal level; below it, or when the book names a property of a
    // device (Zener, Early, threshold, logic levels, references…), it keeps the book's value.
    if (libro < 3 || PROPIA.test(v.nombre) || /^V_(Z|A|F|BE|T|D|IH|IL|OH|OL|ref|sat|th|GS|gs)/.test(v.id)) return null;
    r = { serie: 'alimentacion', valores: ALIMENTACION.filter((x) => x >= Math.max(v.min, libro / 2.5) && x <= Math.min(v.max, libro * 2.5)) };
  } else if (['A', 'W', 'Hz', 's', 'J', 'C', 'S', 'Wh', 'Ah', 'VA', 'bit/s'].includes(v.unidad)) r = { serie: 'redondos', valores: serie(REDONDOS, lo, hi) };
  if (!r || r.valores.length < 3) return null;
  return r;
}

export interface Variante {
  valores: Entorno;
  resultado: number;
}

const MAX_LISTA = 40;

function valida(it: ItemNumerico, valores: Entorno, signo: number): number | null {
  const r = calcular(it.formula, it.objetivo, valores);
  if (!Number.isFinite(r.valor) || r.error) return null;
  if (Math.sign(r.valor) !== signo) return null;
  const vo = it.formula.vars.find((v) => v.id === it.objetivo);
  if (vo && (Math.abs(r.valor) < Math.abs(vo.min) * 0.999 || Math.abs(r.valor) > Math.abs(vo.max) * 1.001) && vo.min > 0) return null;
  return r.valor;
}

const cacheListas = new Map<string, Variante[]>();

/** The valid variants of a problem, in a fixed order (at most 40, all different from the book's values). */
export function variantes(it: ItemNumerico): Variante[] {
  const c = cacheListas.get(it.id);
  if (c) return c;
  const libro = calcular(it.formula, it.objetivo, it.libro).valor;
  const signo = Math.sign(libro) || 1;
  const rnd = generador(hash(it.id));
  const vistos = new Set<string>([JSON.stringify(it.libro)]);
  const lista: Variante[] = [];
  const ids = Object.keys(it.varia);
  for (let intento = 0; intento < 400 && lista.length < MAX_LISTA && ids.length; intento++) {
    const valores: Entorno = { ...it.libro };
    for (const id of ids) {
      const vs = it.varia[id]!.valores;
      valores[id] = vs[Math.floor(rnd() * vs.length)]!;
    }
    const k = JSON.stringify(valores);
    if (vistos.has(k)) continue;
    vistos.add(k);
    const r = valida(it, valores, signo);
    if (r == null) continue;
    lista.push({ valores, resultado: r });
  }
  cacheListas.set(it.id, lista);
  return lista;
}

/** Variant number `semilla` (0, 1, 2…: consecutive seeds never give the same values when there are two). */
export function variante(it: ItemNumerico, semilla: number): Variante | null {
  const l = variantes(it);
  if (!l.length) return null;
  const n = ((semilla % l.length) + l.length) % l.length;
  return l[n]!;
}

/** «4,7 kΩ» as the book writes values (three significant figures, trailing zeros trimmed). */
export function valorTexto(v: number, unidad: string): string {
  return formatoValor(v, unidad, 3, true);
}

const NBSP = ' ';

function nombreMinuscula(n: string): string {
  // «Corriente de base» → «corriente de base»; acronyms («LED», «RMS…») stay.
  return /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(n) ? n[0]!.toLowerCase() + n.slice(1) : n;
}

/** Statement of a variant: the exercise's own text with the new values, or a sentence around the formula's names. */
export function enunciadoDe(it: ItemNumerico, v: Variante): string {
  const f = it.formula;
  const vo = f.vars.find((x) => x.id === it.objetivo)!;
  if (it.ejercicio) {
    let h = it.ejercicio.html;
    for (const x of f.vars) {
      const val = v.valores[x.id];
      if (val == null) continue;
      h = h.split(`{{${x.id}}}`).join(valorTexto(val, x.unidad));
    }
    return h;
  }
  const datos = f.vars
    .filter((x) => x.id !== it.objetivo)
    .map((x) => `${nombreMinuscula(x.nombre)} ${x.sim}${NBSP}=${NBSP}${valorTexto(v.valores[x.id]!, x.unidad)}`);
  const lista = datos.length > 1 ? `${datos.slice(0, -1).join(', ')} y ${datos[datos.length - 1]}` : datos[0];
  return `Calcula ${nombreMinuscula(vo.nombre)}, ${vo.sim}, si ${lista}.`;
}
