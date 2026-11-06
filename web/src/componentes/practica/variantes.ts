// Problems with changing values (0.10): a formula of the book (formulas.json, the calculators' catalogue)
// solved with other realistic values on every attempt. The values come from lists fixed by the generator
// (E12/E24 for resistors, capacitors and inductors, the usual supplies for voltages from 3 V up, round
// 1-1,5-2-2,2-3,3-4,7-5-6,8 series otherwise; device constants, percentages, decibels, temperatures and
// integers keep the book's value), and every variant is checked here: finite result, same sign as the book's
// and inside the variable's usual range. Plain TypeScript (the generator runs it in Node).

import { compilar, type Entorno } from '../calculadoras/expresion.ts';
import type { VarFormula } from '../calculadoras/tipos.ts';
import { calcular } from '../calculadoras/motor.ts';
import { cientifica, formatoValor } from '../calculadoras/unidades.ts';
import { comprobar, type Esperado, type Veredicto } from '../../lib/magnitudes.ts';
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
  // 1.0 (review 10e): the variant must keep the circuit in the regime the statement assumes
  for (const c of it.condiciones ?? []) {
    const x = compilar(c)(valores);
    if (!(x > 0)) return null;
  }
  const r = calcular(it.formula, it.objetivo, valores);
  if (!Number.isFinite(r.valor) || r.error) return null;
  if (Math.sign(r.valor) !== signo) return null;
  const vo = it.formula.vars.find((v) => v.id === it.objetivo);
  if (vo && (Math.abs(r.valor) < Math.abs(vo.min) * 0.999 || Math.abs(r.valor) > Math.abs(vo.max) * 1.001) && vo.min > 0) return null;
  // a standard value is asked: the nearest one must be clearly the nearest (not a tie within the result's tolerance)
  if (it.normalizado) {
    const n = normalizado(r.valor, it.normalizado);
    if (!n || Math.abs(n.otro - r.valor) - Math.abs(n.valor - r.valor) <= 2 * it.tol * Math.abs(r.valor)) return null;
  }
  return r.valor;
}

const SERIES_NORMALIZADAS: Record<NonNullable<ItemNumerico['normalizado']>, number[]> = { E12 };

/**
 * The value of a standard series nearest to `x` (arithmetic distance, any decade) and the runner-up, so that a caller
 * can tell a clear choice from a near tie. Null for a value that is not positive and finite.
 */
export function normalizado(x: number, serie: NonNullable<ItemNumerico['normalizado']>): { valor: number; otro: number } | null {
  if (!(x > 0) || !Number.isFinite(x)) return null;
  const d0 = Math.floor(Math.log10(x));
  const c: number[] = [];
  for (let d = d0 - 1; d <= d0 + 1; d++) for (const m of SERIES_NORMALIZADAS[serie]) c.push(Number((m * 10 ** d).toPrecision(3)));
  c.sort((a, b) => Math.abs(a - x) - Math.abs(b - x));
  return { valor: c[0]!, otro: c[1]! };
}

const cacheListas = new Map<string, Variante[]>();

/** Significant figures of the values a statement shows (valorTexto). */
const CIFRAS = 3;

/** Whether an input of the problem is written in its statement (and so is read with CIFRAS figures). */
function seMuestra(it: ItemNumerico, id: string): boolean {
  return it.ejercicio ? it.ejercicio.html.includes(`{{${id}}}`) : id !== it.objetivo;
}

/**
 * The inputs as the statement shows them: every value written in it rounded to CIFRAS significant figures, so the
 * expected result is the one the reader computes from the statement (review 10i: cap26's V_T shown as 25,9 mV but used
 * as 25,85 mV gave a result 4 % away through the exponential), and two variants that read the same are the same
 * (floating-point twins of the book's values, 9.999999999999999e-06 and 1e-05).
 */
export function comoSeMuestran(it: ItemNumerico, valores: Entorno): Entorno {
  const r: Entorno = {};
  for (const [id, x] of Object.entries(valores)) r[id] = seMuestra(it, id) && Number.isFinite(x) && x !== 0 ? Number(x.toPrecision(CIFRAS)) : x;
  return r;
}

/** The valid variants of a problem, in a fixed order (at most 40, all different from the book's values). */
export function variantes(it: ItemNumerico): Variante[] {
  const c = cacheListas.get(it.id);
  if (c) return c;
  const libro = calcular(it.formula, it.objetivo, it.libro).valor;
  const signo = Math.sign(libro) || 1;
  const rnd = generador(hash(it.id));
  const vistos = new Set<string>([JSON.stringify(comoSeMuestran(it, it.libro))]);
  const lista: Variante[] = [];
  const ids = Object.keys(it.varia);
  for (let intento = 0; intento < 400 && lista.length < MAX_LISTA && ids.length; intento++) {
    const elegidos: Entorno = { ...it.libro };
    for (const id of ids) {
      const vs = it.varia[id]!.valores;
      elegidos[id] = vs[Math.floor(rnd() * vs.length)]!;
    }
    const valores = comoSeMuestran(it, elegidos);
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
  // speeds of the order of light's: «1,8 × 10⁸ m/s», not «180 Mm/s» (review 10i)
  if (unidad === 'm/s' && Math.abs(v) >= 1e5) return `${cientifica(v, CIFRAS, true)}\u00a0m/s`;
  return formatoValor(v, unidad, CIFRAS, true);
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
  if (it.ejercicio) return rellenar(it, v, it.ejercicio.html);
  // «Calcule I (corriente del diodo) con estos datos: I_S = 10 fA (corriente de saturación); …» — the symbol first and
  // the book's name in brackets, so names of any shape read well (review 10i: «Calcule corriente del diodo, I, si …
  // tensión térmica kT/q V_T = …»)
  const datos = f.vars
    .filter((x) => x.id !== it.objetivo)
    .map((x) => `${x.sim}${NBSP}=${NBSP}${valorTexto(v.valores[x.id]!, x.unidad)} (${nombreMinuscula(x.nombre)})`);
  return `Calcule ${vo.sim} (${nombreMinuscula(vo.nombre)}) con estos datos: ${datos.join('; ')}.`;
}

/** A text of the item with its «{{id}}» placeholders written with this variant's values. */
function rellenar(it: ItemNumerico, v: Variante, h: string): string {
  for (const x of it.formula.vars) {
    const val = v.valores[x.id];
    if (val == null) continue;
    h = h.split(`{{${x.id}}}`).join(valorTexto(val, x.unidad));
  }
  return h;
}

/** Tolerance of a standard value (the book's own for its «Valor E12» answers): only that value is accepted. */
const TOL_SERIE = 0.005;

/**
 * What the answer field of a variant asks and what is accepted (practice, problem of the day, teacher-mode exams and
 * their PDF use the same): `nombre` is the exercise's `pide` with this variant's values (a formula's own problem: its
 * name and symbol). A standard value asked (`normalizado`) is the series value nearest to the result, `calculado` the
 * result itself.
 */
export interface Pedido extends Esperado {
  nombre: string;
  serie?: NonNullable<ItemNumerico['normalizado']>;
  calculado?: { valor: number; texto: string; tol: number };
}

export function pedidoDe(it: ItemNumerico, v: Variante): Pedido {
  const vo = it.formula.vars.find((x) => x.id === it.objetivo)!;
  const nombre = it.ejercicio ? rellenar(it, v, it.ejercicio.pide) : `${vo.nombre} (${vo.sim})`;
  const n = it.normalizado ? normalizado(v.resultado, it.normalizado) : null;
  if (it.normalizado && n)
    return {
      valor: n.valor,
      unidad: vo.unidad,
      tol: TOL_SERIE,
      texto: valorTexto(n.valor, vo.unidad),
      nombre,
      serie: it.normalizado,
      calculado: { valor: v.resultado, texto: valorTexto(v.resultado, vo.unidad), tol: it.tol },
    };
  return { valor: v.resultado, unidad: vo.unidad, tol: it.tol, texto: valorTexto(v.resultado, vo.unidad), nombre };
}

/**
 * Checks an answer against a Pedido. A standard value is right only exactly (a prefix or sign slip of it is still
 * «close»); the calculated value is «close» with a message that says what is missing; any other value is wrong (a
 * value merely near the standard one is not «close»: there is no «almost E12»).
 */
export function comprobarPedido(texto: string, p: Pedido): Veredicto {
  const r = comprobar(texto, p);
  if (!p.serie || !p.calculado || r.tipo === 'bien' || r.tipo === 'vacio' || r.tipo === 'ilegible' || r.tipo === 'unidad') return r;
  const c = comprobar(texto, { valor: p.calculado.valor, unidad: p.unidad, tol: p.calculado.tol, texto: p.calculado.texto });
  if (c.tipo === 'bien') return { tipo: 'cerca', mensaje: `Ese es el valor calculado; se pide el valor ${p.serie} más cercano a él.` };
  if (r.tipo === 'cerca' && !r.mensaje.startsWith('Cerca:')) return r;
  return { tipo: 'mal', mensaje: `No es el valor ${p.serie} más cercano al resultado del cálculo.` };
}

/** «En esta variante se pide:» — with «solo» when the book's exercise asks more than this one result. */
export function textoPide(it: ItemNumerico): string {
  return `En esta variante se pide${it.ejercicio?.solo ? ' solo' : ''}:`;
}

/** How the solution names the accepted answer: «2,2 kΩ (el valor E12 más cercano a 2,26 kΩ)». */
export function textoCorrecto(p: Pick<Pedido, 'texto' | 'serie' | 'calculado'>): string {
  return p.serie && p.calculado ? `${p.texto} (el valor ${p.serie} más cercano a ${p.calculado.texto})` : p.texto;
}

/** Whether a book paragraph quotes values with units (the hint that shows it then says they are the book's). */
export function citaConValores(html: string): boolean {
  const t = html.replace(/<sub>.*?<\/sub>/g, '').replace(/<[^>]+>/g, '');
  return /\d+(?:[.,]\d+)?\s*(?:[pnuµmkMG])?(?:Hz|H|F|V|A|Ω|W|s)(?![\p{L}\d])/u.test(t);
}
