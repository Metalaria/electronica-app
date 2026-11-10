// 1.0: the structured questions of an exercise (ejercicios.json `preguntas`, written by contenido/ejercicios.py from
// the «?» lines of contenido/ejercicios_curado.txt): choice, ordering, classification, exact short answer, boolean
// expression and a pair of standard resistor values. Pure functions: what the reader's answer is stored as (a string
// in EstadoEjercicio.valores) and how it is checked. The rules match contenido/ejercicios.py.

import { leer } from './magnitudes';
import { comprobarDiseno, textoCondiciones, textoReferencia } from './diseno-ejercicio';

interface Base {
  id: string;
  /** HTML: what is asked. */
  enunciado: string;
  /** HTML: the development shown once the question is settled (a literal quote of the book's solution). */
  explicacion?: string;
  /** The explanation is the app's own working, not a quote of the book. */
  calculo?: boolean;
}
export interface PEleccion extends Base {
  tipo: 'eleccion';
  opciones: string[];
  correcta: number;
  /**
   * 1.1: why each wrong option is wrong (shown index → HTML), the app's own words: the new exercises not in the book yet
   * (ejercicios_nuevos) and the book's self-assessed exercises turned into choices («razonar», curated `porque N:` lines,
   * only from the book's solution); the other book exercises take theirs from libro/porque/ instead.
   */
  porque?: Record<string, string>;
}
export interface POrden extends Base {
  tipo: 'orden';
  /** In the right order. */
  elementos: string[];
  /** The order they are first shown in (indices of `elementos`). */
  mezcla: number[];
}
export interface PClasificar extends Base {
  tipo: 'clasificar';
  categorias: string[];
  elementos: { texto: string; cat: number }[];
}
export interface PExacta extends Base {
  tipo: 'exacta';
  aceptadas: string[];
}
export interface PLogica extends Base {
  tipo: 'logica';
  expresion: string;
  variables: string[];
  /** Expected output for each combination of `variables`, in binary order (first variable most significant). */
  tabla: number[];
  /** Literals plus negations of the expected expression: an equivalent answer may not be more complex. */
  complejidad: number;
}
export interface PCombinacion extends Base {
  tipo: 'combinacion';
  serie: 'E12';
  /** Target in Ω. */
  objetivo: number;
  unidad: 'Ω';
  tol: number;
  texto: string;
}
/** A component the reader chooses in a design question (1.1). */
export interface ComponenteDiseno {
  /** Placeholder in the netlist: «{R}». */
  id: string;
  /** HTML: «R», «C<sub>1</sub>». */
  nombre: string;
  unidad: 'Ω' | 'F' | 'H';
  serie: 'E12' | 'E24';
  /** Allowed range, in the bare unit. */
  min: number;
  max: number;
}
/**
 * 1.1: an open design question — any values that meet the conditions are right, checked by simulating the circuit with
 * the app's ngspice (lib/diseno-ejercicio.ts). The stored answer keeps the simulated measurements with the values they
 * belong to, so checking is synchronous and grading never depends on running the simulator again.
 */
export interface PDiseno extends Base {
  tipo: 'diseno';
  componentes: ComponenteDiseno[];
  /** Netlist with «{id}» placeholders (SI numbers are put in), without analyses. */
  circuito: string;
  /** Lines of the .control block: the analysis, `let` vectors and one `meas` per measurement. */
  control: string;
  medidas: { id: string; nombre: string; unidad: string }[];
  condiciones: { medida: string; min: number; max: number; texto: string; siBaja: string; siAlta: string }[];
  /** A design that meets every condition (the worked solution's), id → value and text. */
  referencia: Record<string, { valor: number; texto: string }>;
}
export type Pregunta = PEleccion | POrden | PClasificar | PExacta | PLogica | PCombinacion | PDiseno;

export type VeredictoPregunta =
  | { tipo: 'vacio' }
  | { tipo: 'ilegible'; mensaje: string }
  | { tipo: 'bien'; mensaje: string }
  | { tipo: 'cerca'; mensaje: string }
  | { tipo: 'mal'; mensaje: string };

/** Whether a check of this question counts as an attempt (something readable was given). */
export const legible = (v: VeredictoPregunta): boolean => v.tipo === 'bien' || v.tipo === 'cerca' || v.tipo === 'mal';

// ------------------------------------------------------------------ stored values

/** «2,0,1» → [2, 0, 1]; empty slots («1,,0») are -1. */
export function leerLista(valor: string, n: number): number[] {
  const p = valor ? valor.split(',') : [];
  return Array.from({ length: n }, (_, i) => {
    const x = p[i] ?? '';
    return /^\d+$/.test(x) ? Number(x) : -1;
  });
}
export const escribirLista = (l: number[]): string => l.map((x) => (x >= 0 ? String(x) : '')).join(',');

/** A combination answer: «15 k|15 k|paralelo». */
export function leerCombinacion(valor: string): { a: string; b: string; modo: 'serie' | 'paralelo' | '' } {
  const [a = '', b = '', m = ''] = valor.split('|');
  return { a, b, modo: m === 'serie' || m === 'paralelo' ? m : '' };
}
export const escribirCombinacion = (a: string, b: string, modo: string): string => `${a.replace(/\|/g, '')}|${b.replace(/\|/g, '')}|${modo}`;

// ------------------------------------------------------------------ boolean expressions

type Fn = (e: Record<string, number>) => number;

/**
 * Parses a boolean expression: single capital letters; NOT as a postfix ' (or ’ ′) or a prefix ¬ ! ~; AND as · * & ∧
 * or by juxtaposition (AB); OR as + | ∨; XOR as ⊕ ^; parentheses; 0 and 1. Lower-case letters are taken as capitals.
 * Throws an Error with a Spanish message.
 */
export function analizarLogica(texto: string): { f: Fn; variables: string[]; complejidad: number } {
  const tk: string[] = [];
  for (const ch of texto) {
    if (/\s/.test(ch)) continue;
    if ("'’′".includes(ch)) tk.push("'");
    else if ('¬!~'.includes(ch)) tk.push('!');
    else if ('·*&∧⋅'.includes(ch)) tk.push('&');
    else if ('+|∨'.includes(ch)) tk.push('|');
    else if ('⊕^'.includes(ch)) tk.push('^');
    else if ('()01'.includes(ch)) tk.push(ch);
    else if (/^[a-z]$/i.test(ch)) tk.push(ch.toUpperCase());
    else throw new Error(`el símbolo «${ch}» no vale en una expresión lógica`);
  }
  let pos = 0;
  let complejidad = 0;
  const ver = () => tk[pos];
  const esVar = (c: string | undefined) => !!c && /^[A-Z]$/.test(c);

  function primario(): Fn {
    const c = ver();
    let g: Fn;
    if (c === '!') {
      pos++;
      complejidad++;
      const f = primario();
      g = (e) => 1 - f(e);
    } else if (c === '(') {
      pos++;
      g = o();
      if (ver() !== ')') throw new Error('falta cerrar un paréntesis');
      pos++;
    } else if (c === '0' || c === '1') {
      pos++;
      const v = Number(c);
      g = () => v;
    } else if (esVar(c)) {
      pos++;
      complejidad++;
      g = (e) => e[c!] ?? 0;
    } else {
      throw new Error(c ? `no se esperaba «${c === '&' ? '·' : c === '|' ? '+' : c}»` : 'la expresión está incompleta');
    }
    while (ver() === "'") {
      pos++;
      complejidad++;
      const f = g;
      g = (e) => 1 - f(e);
    }
    return g;
  }
  function y(): Fn {
    let f = primario();
    for (;;) {
      const c = ver();
      if (c === '&') pos++;
      else if (!(c === '(' || c === '!' || c === '0' || c === '1' || esVar(c))) break;
      const a = f;
      const b = primario();
      f = (e) => a(e) & b(e);
    }
    return f;
  }
  function ox(): Fn {
    let f = y();
    while (ver() === '^') {
      pos++;
      const a = f;
      const b = y();
      f = (e) => a(e) ^ b(e);
    }
    return f;
  }
  function o(): Fn {
    let f = ox();
    while (ver() === '|') {
      pos++;
      const a = f;
      const b = ox();
      f = (e) => a(e) | b(e);
    }
    return f;
  }
  if (!tk.length) throw new Error('la expresión está vacía');
  const f = o();
  if (pos !== tk.length) throw new Error(tk[pos] === ')' ? 'sobra un paréntesis' : 'sobra algo al final');
  const variables = [...new Set(tk.filter(esVar))].sort();
  return { f, variables, complejidad };
}

function combinacion(variables: string[], k: number): Record<string, number> {
  const e: Record<string, number> = {};
  variables.forEach((v, i) => (e[v] = (k >> (variables.length - 1 - i)) & 1));
  return e;
}

// ------------------------------------------------------------------ standard values

const SERIES: Record<string, number[]> = { E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2] };

/** Whether a value (Ω) belongs to a standard series, in any decade from 1 Ω to 10 MΩ. */
export function esDeSerie(v: number, serie: string): boolean {
  if (!(v >= 1 - 1e-9) || v > 10e6 * (1 + 1e-9)) return false;
  const d = Math.floor(Math.log10(v) + 1e-9);
  const m = v / 10 ** d;
  return (SERIES[serie] ?? []).some((b) => Math.abs(m - b) < 1e-6 * b) || Math.abs(m - 10) < 1e-6;
}

/** Spanish display of a resistance: 7480 → «7,48 kΩ». */
export function textoOhmios(v: number): string {
  const [f, p] = v >= 1e6 ? [1e6, 'M'] : v >= 1e3 ? [1e3, 'k'] : [1, ''];
  const x = v / f;
  const t = x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2);
  return `${t.replace(/\.?0+$/, '').replace('.', ',')} ${p}Ω`;
}

// ------------------------------------------------------------------ checking

const sinEspacios = (t: string) => t.replace(/[\s  ]+/g, '');

/** Checks the reader's stored answer to one question. */
export function comprobarPregunta(p: Pregunta, valor: string): VeredictoPregunta {
  switch (p.tipo) {
    case 'eleccion': {
      if (!/^\d+$/.test(valor)) return { tipo: 'vacio' };
      return Number(valor) === p.correcta ? { tipo: 'bien', mensaje: 'Correcto.' } : { tipo: 'mal', mensaje: 'No es la respuesta correcta.' };
    }
    case 'orden': {
      if (!valor) return { tipo: 'vacio' };
      const l = leerLista(valor, p.elementos.length);
      const valido = new Set(l).size === l.length && l.every((x) => x >= 0 && x < l.length);
      if (!valido) return { tipo: 'ilegible', mensaje: 'Ordene todos los elementos.' };
      const enSitio = l.filter((x, i) => x === i).length;
      if (enSitio === l.length) return { tipo: 'bien', mensaje: 'Correcto: es el orden del libro.' };
      return { tipo: 'mal', mensaje: `${enSitio} de ${l.length} están en su sitio.` };
    }
    case 'clasificar': {
      const l = leerLista(valor, p.elementos.length);
      const faltan = l.filter((x) => x < 0 || x >= p.categorias.length).length;
      if (faltan === l.length) return { tipo: 'vacio' };
      if (faltan) return { tipo: 'ilegible', mensaje: faltan === 1 ? 'Falta uno por responder.' : `Faltan ${faltan} por responder.` };
      const bien = l.filter((x, i) => x === p.elementos[i]!.cat).length;
      if (bien === l.length) return { tipo: 'bien', mensaje: 'Correcto.' };
      return { tipo: 'mal', mensaje: `${bien} de ${l.length} están bien.` };
    }
    case 'exacta': {
      const v = sinEspacios(valor);
      if (!v) return { tipo: 'vacio' };
      if (p.aceptadas.some((a) => sinEspacios(a) === v)) return { tipo: 'bien', mensaje: 'Correcto.' };
      if (p.aceptadas.some((a) => sinEspacios(a).toLowerCase() === v.toLowerCase())) {
        return { tipo: 'cerca', mensaje: 'Casi: revise las mayúsculas y minúsculas.' };
      }
      return { tipo: 'mal', mensaje: 'No es la respuesta correcta.' };
    }
    case 'logica': {
      if (!valor.trim()) return { tipo: 'vacio' };
      let r: ReturnType<typeof analizarLogica>;
      try {
        r = analizarLogica(valor);
      } catch (e) {
        return { tipo: 'ilegible', mensaje: `No se entiende la expresión: ${e instanceof Error ? e.message : String(e)}.` };
      }
      const ajenas = r.variables.filter((v) => !p.variables.includes(v));
      if (ajenas.length) return { tipo: 'mal', mensaje: `La expresión no debería depender de ${ajenas.join(', ')}.` };
      for (let k = 0; k < p.tabla.length; k++) {
        const e = combinacion(p.variables, k);
        if (r.f(e) !== p.tabla[k]) {
          const caso = p.variables.map((v) => `${v} = ${e[v]}`).join(', ');
          return { tipo: 'mal', mensaje: `No es equivalente: con ${caso} su expresión da ${r.f(e)} y debería dar ${p.tabla[k]}.` };
        }
      }
      if (r.complejidad > p.complejidad) return { tipo: 'cerca', mensaje: 'Es equivalente, pero se puede simplificar más.' };
      return { tipo: 'bien', mensaje: 'Correcto: es equivalente y está simplificada.' };
    }
    case 'combinacion': {
      const c = leerCombinacion(valor);
      if (!c.a.trim() && !c.b.trim()) return { tipo: 'vacio' };
      if (!c.a.trim() || !c.b.trim()) return { tipo: 'ilegible', mensaje: 'Escriba las dos resistencias.' };
      if (!c.modo) return { tipo: 'ilegible', mensaje: 'Elija si van en serie o en paralelo.' };
      const va = leer(c.a, 'Ω');
      const vb = leer(c.b, 'Ω');
      if ('error' in va || 'error' in vb) return { tipo: 'ilegible', mensaje: 'No se entiende alguno de los valores (pruebe «6,8 k» o «680»).' };
      const fuera = [va.valor, vb.valor].filter((v) => !esDeSerie(v, p.serie));
      if (fuera.length) return { tipo: 'mal', mensaje: `${textoOhmios(fuera[0]!)} no es un valor de la serie ${p.serie}.` };
      const r = c.modo === 'serie' ? va.valor + vb.valor : (va.valor * vb.valor) / (va.valor + vb.valor);
      const err = Math.abs(r - p.objetivo) / p.objetivo;
      if (err <= p.tol * (1 + 1e-9)) return { tipo: 'bien', mensaje: `Correcto: ${c.modo === 'serie' ? 'en serie' : 'en paralelo'} dan ${textoOhmios(r)}.` };
      if (err <= 0.1) return { tipo: 'cerca', mensaje: `Casi: dan ${textoOhmios(r)}, a más del ${String(p.tol * 100).replace('.', ',')} % de ${p.texto}.` };
      return { tipo: 'mal', mensaje: `Dan ${textoOhmios(r)}; se piden ${p.texto}.` };
    }
    case 'diseno':
      return comprobarDiseno(p, valor);
  }
}

/** HTML of the right answer, shown once the question is settled. */
export function respuestaCorrecta(p: Pregunta): string {
  switch (p.tipo) {
    case 'eleccion':
      return p.opciones[p.correcta] ?? '';
    case 'orden':
      return p.elementos.map((e, i) => `${i + 1}. ${e}`).join('; ');
    case 'clasificar':
      return p.elementos.map((e) => `${e.texto}: ${p.categorias[e.cat] ?? ''}`).join('; ');
    case 'exacta':
      return p.aceptadas[0] ?? '';
    case 'logica':
      return p.expresion;
    case 'combinacion':
      return `cualquier pareja ${p.serie} en serie o en paralelo que dé ${p.texto} (±${String(p.tol * 100).replace('.', ',')} %)`;
    case 'diseno':
      return `cualquier diseño que cumpla ${textoCondiciones(p)}; por ejemplo, ${textoReferencia(p)}`;
  }
}
