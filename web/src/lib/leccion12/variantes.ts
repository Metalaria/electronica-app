// 1.3 (motor13, encargo punto 7): review by doing. «Práctica inteligente» and a section's spaced review used to ask a
// lesson's card exactly as the lesson did: the same numbers, the same answer, remembered rather than worked out. A
// doing card whose answer comes from the model (simular, leer, medir, reto, diseno) can carry VARIANTS: other values
// of its given data, or (reto, diseno) another goal. Review asks one of them; the lesson itself never does.
//
// Where they come from (the generator, lib/leccion11/generar.ts, at build time; GUIA §13.13):
//   - declared on the card (`variantes: { valores: { R_L: [4700, 22000] }, objetivos: [...] }`), or
//   - automatic, where it is safe: the card's data that some control of the lesson moves, over that control's own
//     positions (the range the author gave it), never the card's own controls (the reader moves those);
//   and each candidate is kept only if
//   - the answer changes (the remembered one is wrong now);
//   - every number written in the card's texts is still true: one that is a quantity the variant changes, written
//     with its unit («1 V de pico», «unos 79,6 kHz»), is written again from the model (`sustituirNumeros`); one that
//     cannot be told apart (no unit, two quantities alike) means no such variant; live values «{{x}}» are recomputed;
//   - the whole lesson, with the card so changed (its `fijar`, its texts, the claims of its `comprobar` that still
//     hold and new ones for the numbers written again), still generates without a single error: every rule of the
//     card (the numbers rule, reachable challenges, typical errors outside the tolerance, readings…);
//   - the app's ngspice agrees with the model in that state too, when the card's circuit is simulated (the script
//     drops a variant whose check fails: scripts/lecciones11.mjs).
// The lesson JSON keeps the variants that pass (Tarjeta.variantes: the fields of the card that change). The one asked
// is chosen from the card's id and the session's seed (`elegirVariante`): nothing about it is stored in the reader's
// progress, so the progress, the backups and the sync format do not change. Pure.

import type { Mando, Tarjeta } from '../leccion11/tipos';
import { generador, semillaDe } from './azar';

/** One variant of a card: the fields of the card that change (its `fijar` with the new data, texts written again…). */
export interface VarianteTarjeta {
  /** The new values of its given data (also in `cambios.fijar`): what the review screen and the tests look at. */
  valores?: Record<string, number>;
  /** Another goal (reto, diseno), declared by the author. */
  objetivo?: true;
  /** Fields of the card replaced (a whole field each). */
  cambios: Partial<Tarjeta>;
  /** Fields of the card that do not apply to the variant (a ladder written for the card's own goal). */
  quitar?: (keyof Tarjeta)[];
}

/** The card types that may have variants: their answer is worked out from the model. */
export const TIPOS_CON_VARIANTES = new Set(['simular', 'leer', 'medir', 'reto', 'diseno']);
/** Variants proposed per card (the ones that pass are kept). */
export const VARIANTES_POR_TARJETA = 3;
/** Values changed at once by an automatic variant. */
const MAX_VALORES_AUTO = 2;
/** How much the answer must change for a variant to count (relative): a remembered answer must be wrong. */
const CAMBIO_MINIMO = 0.05;

// ------------------------------------------------------------------ in review

/** The variant review asks of a card in a session (by the card's id and the session's seed), or null: none. */
export function elegirVariante(t: Pick<Tarjeta, 'id' | 'variantes'>, semilla: number): number | null {
  const n = t.variantes?.length ?? 0;
  if (!n) return null;
  return semillaDe(`${t.id}/${semilla >>> 0}`) % n;
}

/** The card as a variant asks it (the card itself with no variant or an index out of range). */
export function conVariante(t: Tarjeta, k: number | null | undefined): Tarjeta {
  const v = k == null ? undefined : t.variantes?.[k];
  if (!v) return t;
  const r = { ...t, ...v.cambios } as Tarjeta;
  for (const q of v.quitar ?? []) delete r[q];
  return r;
}

/** What the card says of itself when asked as a variant («Con otros valores», «Otro objetivo»). */
export function rotuloVariante(t: Pick<Tarjeta, 'variantes'>, k: number | null | undefined): string | null {
  const v = k == null ? undefined : t.variantes?.[k];
  if (!v) return null;
  return v.objetivo ? 'Otro objetivo' : 'Con otros valores';
}

// ------------------------------------------------------------------ in the generator

/**
 * Drops from a lesson the variants whose ngspice check failed (`fuera`: card id → indices), in place; how many went.
 * scripts/lecciones11.mjs calls it after running the checks (a variant the simulator contradicts is not offered).
 */
export function descartarVariantes(tarjetas: Tarjeta[], fuera: ReadonlyMap<string, ReadonlySet<number>>): number {
  let n = 0;
  for (const t of tarjetas) {
    const f = fuera.get(t.id);
    if (!f || !t.variantes) continue;
    const antes = t.variantes.length;
    t.variantes = t.variantes.filter((_, j) => !f.has(j));
    n += antes - t.variantes.length;
    if (!t.variantes.length) delete t.variantes;
  }
  return n;
}

/**
 * The automatic value domains of a card: each model value that some control of the lesson moves (a slider; its
 * positions are the author's range for it), except the card's own controls. Sorted, without repeats.
 */
export function dominiosAutomaticos(mandosLeccion: readonly Mando[], propios: readonly string[]): Record<string, number[]> {
  const d: Record<string, Set<number>> = {};
  for (const m of mandosLeccion) {
    if (m.tipo !== 'deslizador' || propios.includes(m.valor)) continue;
    for (const v of m.valores) (d[m.valor] ??= new Set()).add(v);
  }
  return Object.fromEntries(Object.entries(d).map(([k, s]) => [k, [...s].sort((a, b) => a - b)]));
}

/** A value domain declared by the author: a list, or { min, max, paso } (or a message saying what is wrong). */
export function dominioDeclarado(x: unknown): number[] | string {
  const num = (y: unknown): y is number => typeof y === 'number' && Number.isFinite(y);
  if (Array.isArray(x)) {
    if (x.length < 1 || !x.every(num)) return 'una lista de números';
    return [...new Set(x)].sort((a, b) => a - b);
  }
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    if (!num(o.min) || !num(o.max) || !num(o.paso) || !(o.min < o.max) || !(o.paso > 0)) return '{ min, max, paso } con min < max y paso > 0';
    const [min, max, paso] = [o.min, o.max, o.paso];
    const n = Math.round((max - min) / paso);
    if (n > 1000) return 'más de 1000 posiciones';
    return Array.from({ length: n + 1 }, (_, k) => Number((min + k * paso).toPrecision(12)));
  }
  return 'una lista de números o { min, max, paso }';
}

export const distinto = (a: number, b: number) => Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * The values a card's answer depends on, among the domains: those for which some other position changes `respuesta`
 * by at least CAMBIO_MINIMO (relative).
 */
export function dependencias(dominios: Record<string, number[]>, inicial: Record<string, number>, respuesta: (v: Record<string, number>) => number[]): string[] {
  const r0 = respuesta(inicial);
  return Object.keys(dominios).filter((k) => dominios[k]!.some((x) => distinto(x, inicial[k] ?? NaN) && cambia(r0, respuesta({ ...inicial, [k]: x }))));
}

/** Whether some answer changed by at least CAMBIO_MINIMO (and none stopped being a number). */
export function cambia(antes: number[], despues: number[]): boolean {
  if (!despues.every(Number.isFinite)) return false;
  return antes.some((a, k) => Math.abs(despues[k]! - a) > CAMBIO_MINIMO * Math.max(Math.abs(a), Math.abs(despues[k]!), 1e-30));
}

/**
 * Candidate value sets: `n` draws (seeded by the card: the same every build), each changing one or up to `max` of the
 * values (each to another position of its domain), without repeats.
 */
export function proponerValores(semilla: string, dominios: Record<string, number[]>, claves: readonly string[], inicial: Record<string, number>, n = VARIANTES_POR_TARJETA, max = MAX_VALORES_AUTO): Record<string, number>[] {
  const rnd = generador(semillaDe(semilla));
  const out: Record<string, number>[] = [];
  const vistos = new Set<string>();
  for (let intento = 0; intento < n * 8 && out.length < n; intento++) {
    const cuantas = Math.min(claves.length, 1 + Math.floor(rnd() * max));
    // (a seeded shuffle: the same every build)
    const orden = claves.map((k) => [rnd(), k] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const elegidas = orden.slice(0, cuantas).sort();
    const v: Record<string, number> = {};
    for (const k of elegidas) {
      const otros = dominios[k]!.filter((x) => distinto(x, inicial[k] ?? NaN));
      if (otros.length) v[k] = otros[Math.floor(rnd() * otros.length)]!;
    }
    const clave = JSON.stringify(Object.entries(v).sort());
    if (!Object.keys(v).length || vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(v);
  }
  return out;
}

// ------------------------------------------------------------------ the card's written numbers, written again

/** A quantity of the model in the card's state and in the variant's. */
export interface CantidadVariante {
  id: string;
  /** SI unit without prefix (the model's), '' when none. */
  unidad: string;
  antes: number;
  despues: number;
  /**
   * The card uses it (a live value, its answer, a typical error, a condition, its widget, or a step of one of them):
   * only these are written again; a number that is another quantity that changes means no such variant (the book's
   * «hasta 1 GHz» that happens to be 1/t of the card's flank must not become «100 MHz»).
   */
  relevante: boolean;
  /**
   * What it is to the card: a datum the variant changes, the answer (or its reading), or another step. A number of the
   * book that is «another step» is ambiguous (the book may say it for another reason): no such variant.
   */
  rol: 'dato' | 'respuesta' | 'otro';
}

const PREFIJOS: [string, number][] = [['', 1], ['p', 1e-12], ['n', 1e-9], ['µ', 1e-6], ['μ', 1e-6], ['u', 1e-6], ['m', 1e-3], ['k', 1e3], ['M', 1e6], ['G', 1e9], ['T', 1e12]];
/** Units written without a prefix (the app's own list: componentes/calculadoras/unidades.ts). */
const SIN_PREFIJO = new Set(['', '%', 'dB', 'dBm', '°', '°C', 'rad', 'ppm']);
const ESPACIOS = /^[ \u00a0\u2009\u202f]?/;
/** Numbers written without a unit that are a formula's constants, not data («2π», «1/RC», «10 veces», «100 %»). */
const CONSTANTES_SUELTAS = new Set([0, 1, 2, 3, 4, 10, 100, 1000]);

/** The text with the live values, sub/superscripts and hexadecimal literals blanked (same length): not numbers to read. */
function enmascarar(s: string): string {
  return s
    .replace(/\{\{[^}]*\}\}|[_^]\{[^}]*\}/g, (x) => ' '.repeat(x.length))
    .replace(/(?<![\p{L}\p{N}_$])(\$|0[xX]|0[bB])[0-9A-Fa-f]+(?![\p{L}\p{N}_])/gu, (x) => ' '.repeat(x.length));
}

/**
 * An author's text (as written in the YAML) with each number that is a quantity the variant changes written again
 * from the model, or why it cannot be. A number followed by a unit (with or without a prefix: «1 ms», «79,6 kHz») is
 * that unit's quantities: if it is (a scaling of) exactly one quantity that changes, and none that stays, it is
 * replaced by the new value as the app formats it; two alike are ambiguous. A number without a unit is unsafe if it is
 * a quantity that changes as written (or with a bare prefix, «10 k»). Other numbers stay (the book's, a count, a
 * quantity that does not change). Returns the text and the quantities written again.
 */
export function sustituirNumeros(
  s: string,
  cambian: readonly CantidadVariante[],
  quedan: readonly { unidad: string; valor: number }[],
  formato: (id: string, v: number) => string,
  /** Whether a written number is one of the book's (the numbers rule's list). */
  delLibro: (n: { v: number; decimales: number }) => boolean = () => false,
): { texto: string; usadas: string[] } | { inseguro: string } {
  const m0 = enmascarar(s);
  const re = /(?<![\p{L}\p{N}_.,])([-−]?)(\d{1,3}(?:[ \u00a0\u2009\u202f]\d{3})+(?!\d)|\d+)([.,]\d+)?(?![0-9])/gu;
  const unidades = [...new Set([...cambian.map((c) => c.unidad), ...quedan.map((c) => c.unidad)].filter((u) => u))].sort((a, b) => b.length - a.length);
  const cambios: { ini: number; fin: number; texto: string }[] = [];
  const usadas = new Set<string>();
  for (const m of m0.matchAll(re)) {
    const ini = m.index ?? 0;
    let fin = ini + m[0].length;
    // (part numbers — «2N3904», «74HC00» — are names)
    if (/^[A-Z]{1,2}\d/.test(m0.slice(fin))) continue;
    const decimales = m[3] ? m[3].length - 1 : 0;
    const v = Number(`${m[2]!.replace(/[ \u00a0\u2009\u202f]/g, '')}${m[3] ? `.${m[3].slice(1)}` : ''}`) * (m[1] ? -1 : 1);
    const cerca = (x: number, valor: number, f: number) => Math.abs(Math.abs(x * f) - Math.abs(valor)) <= 0.5 * 10 ** -decimales * f * (1 + 1e-9) + 1e-12 * Math.abs(valor);
    const resto = m0.slice(fin);
    // (a power: «10⁻⁹» is the number 1e-9, a quantity of its own; «400²» is 400 squared, the base is the quantity)
    const potencia = /^(?:\^\{([-−]?\d+)\}|([⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+))/u.exec(resto);
    if (potencia) {
      const exp = Number((potencia[1] ?? [...potencia[2]!].map((ch) => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(ch) >= 0 ? String('⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(ch)) : ch === '⁻' ? '-' : '').join('')).replace('−', '-'));
      const x = v === 10 && Number.isFinite(exp) ? 10 ** exp : v;
      const igual = (a: number, b: number) => Math.abs(Math.abs(a) - Math.abs(b)) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));
      if (cambian.some((c) => igual(x, c.antes))) return { inseguro: `«${s.slice(ini, fin + potencia[0].length).trim()}» es un dato que cambia` };
      if (x === v ? quedan.some((c) => cerca(v, c.valor, 1)) || CONSTANTES_SUELTAS.has(v) : quedan.some((c) => igual(x, c.valor))) continue;
      return { inseguro: `«${s.slice(ini, fin + potencia[0].length).trim()}» no es ninguna cantidad del modelo: puede salir de los datos que cambian` };
    }
    // the unit written after it, with its prefix (the longest that fits, then a word boundary; «V/ns», «V·s» are other
    // units: then it has none of the model's)
    const sp = ESPACIOS.exec(resto)![0].length;
    let unidad: { u: string; f: number; largo: number } | null = null;
    for (const u of unidades)
      for (const [p, f] of SIN_PREFIJO.has(u) ? [['', 1] as [string, number]] : PREFIJOS) {
        const w = p + u;
        if (resto.startsWith(w, sp) && !/^[\p{L}\p{N}/·*^⁻]/u.test(resto.slice(sp + w.length)) && (!unidad || w.length > unidad.largo - sp)) unidad = { u, f, largo: sp + w.length };
      }
    if (unidad) {
      const { u, f } = unidad;
      const todas = cambian.filter((c) => c.unidad === u && cerca(v, c.antes, f));
      if (todas.some((c) => !c.relevante)) return { inseguro: `«${s.slice(ini, fin + unidad.largo).trim()}» es una cantidad que cambia y la tarjeta no usa` };
      const cambiadas = [...new Set(todas.map((c) => c.id))];
      const igual = quedan.some((c) => c.unidad === u && cerca(v, c.valor, f));
      if (!cambiadas.length) {
        // (a quantity that stays, or a unit the variant does not touch: it stays true; else it may come from the
        // data that change — «9 V entre 50 Ω» when one of the two resistors changes —: no such variant)
        if (igual || !cambian.some((c) => c.unidad === u)) continue;
        return { inseguro: `«${s.slice(ini, fin + unidad.largo).trim()}» puede salir de los datos que cambian y no es ninguna cantidad del modelo` };
      }
      if (cambiadas.length > 1 || igual) return { inseguro: `«${s.slice(ini, fin + unidad.largo).trim()}» puede ser más de una cantidad` };
      const c = cambian.find((x) => x.id === cambiadas[0])!;
      if (c.rol === 'otro' && delLibro({ v, decimales })) return { inseguro: `«${s.slice(ini, fin + unidad.largo).trim()}» es un número del libro y también un paso que cambia` };
      // (written without its sign, it stays without it)
      const nuevo = !m[1] && c.antes < 0 ? Math.abs(c.despues) : c.despues;
      fin += unidad.largo;
      cambios.push({ ini, fin, texto: formato(c.id, nuevo) });
      usadas.add(c.id);
      continue;
    }
    // without a unit: a quantity that stays as written, or a small constant of a formula («2π», «1/RC», «10 veces»)
    const prefijoSuelto = /^[pnµμumkMGT](?![\p{L}\p{N}])/u.test(resto.slice(sp));
    const factores = prefijoSuelto ? PREFIJOS.map(([, f]) => f) : [1];
    if (cambian.some((c) => factores.some((f) => cerca(v, c.antes, f)))) return { inseguro: `«${m[0].trim()}» es un dato que cambia y no lleva unidad` };
    if (quedan.some((c) => factores.some((f) => cerca(v, c.valor, f)))) continue;
    if (!prefijoSuelto && CONSTANTES_SUELTAS.has(v)) continue;
    return { inseguro: `«${m[0].trim()}» no es ninguna cantidad del modelo: puede salir de los datos que cambian` };
  }
  let texto = s;
  for (const c of cambios.reverse()) texto = texto.slice(0, c.ini) + c.texto + texto.slice(c.fin);
  return { texto, usadas: [...usadas] };
}

/**
 * Words that compare magnitudes («tres veces por debajo», «apenas cuentan», «el doble», «lejos del máximo»): a claim
 * the new values may make false and no number betrays. A card that has them gets no automatic variant (an author who
 * declares variants has read them).
 */
export const PALABRAS_DE_PROPORCION =
  /(?<![\p{L}])(veces|doble|triple|mitad|tercio|apenas|casi|lejos|cerca|despreciable|desprecia|mucho|muchos|mucha|poco|pocos|poca|peor|mejor|domina|dominante|manda|mandan|sobra|sobran|basta|bastan|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|cuarenta|cincuenta|cien|mil|millón|millones|voltios|milivoltios|microvoltios|amperios|miliamperios|microamperios|ohmios|kilohmios|megaohmios|vatios|milivatios|segundos|milisegundos|microsegundos|minutos|horas|hercios|kilohercios|megahercios)(?![\p{L}])/iu;

/** The keys of a card's source whose strings are texts the reader sees (anywhere in the card: activity, widget…). */
export const CLAVES_DE_TEXTO = new Set(['titulo', 'texto', 'nota', 'exito', 'ayuda', 'solucion', 'escalera', 'rotulo', 'porque', 'logrado', 'boton', 'si_tolerancias', 'dentro', 'bajo', 'alto']);

/**
 * Every text of a card's source (a deep copy) written again for the variant (`sustituirNumeros`), or the first reason
 * it cannot be. Keys that are not texts (ids, expressions, values) are left alone.
 */
export function sustituirEnTarjeta(
  ft: Record<string, unknown>,
  cambian: readonly CantidadVariante[],
  quedan: readonly { unidad: string; valor: number }[],
  formato: (id: string, v: number) => string,
  delLibro: (n: { v: number; decimales: number }) => boolean = () => false,
): { tarjeta: Record<string, unknown>; usadas: string[] } | { inseguro: string } {
  const usadas = new Set<string>();
  let inseguro: string | null = null;
  const texto = (s: string): string => {
    if (inseguro) return s;
    const r = sustituirNumeros(s, cambian, quedan, formato, delLibro);
    if ('inseguro' in r) {
      inseguro = r.inseguro;
      return s;
    }
    for (const u of r.usadas) usadas.add(u);
    return r.texto;
  };
  // a text key's value: a string, a list of them (escalera), a map of them (porque), or objects with a «texto»
  const deTexto = (x: unknown): unknown => {
    if (typeof x === 'string') return texto(x);
    if (Array.isArray(x)) return x.map(deTexto);
    if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, y]) => [k, deTexto(y)]));
    return x;
  };
  const andar = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(andar);
    if (!x || typeof x !== 'object') return x;
    return Object.fromEntries(Object.entries(x).map(([k, y]) => [k, CLAVES_DE_TEXTO.has(k) ? deTexto(y) : k === 'pistas' && Array.isArray(y) ? y.map((p) => (typeof p === 'string' ? texto(p) : andar(p))) : andar(y)]));
  };
  const tarjeta = andar(ft) as Record<string, unknown>;
  return inseguro ? { inseguro } : { tarjeta, usadas: [...usadas] };
}
