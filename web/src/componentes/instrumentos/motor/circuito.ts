// A netlist seen as a circuit on the test bench: the analyses and the .control block are removed (the bench
// adds its own), and the top-level elements are listed with the nodes of each terminal, so that instrument
// leads can be attached to nodes or inserted in series with one terminal.
//
// Plain TypeScript without DOM: it also runs in Node (tests and scripts).

import { numeroSpice } from '../../../simulador/motor/netlist.ts';

export interface Terminal {
  /** Short name shown to the reader: «1», «2», «+», «−», «A», «K», «C», «B», «E»… */
  nombre: string;
  nodo: string;
  /** Offsets of the node token in `Circuito.texto` (to cut the terminal for a series ammeter). */
  ini: number;
  fin: number;
}

export interface Elemento {
  /** Name as written (R1, VG, XU1…). */
  nombre: string;
  /** First letter, upper case (R, C, L, V, I, D, Q, M, J, E, F, G, H, B, S, W, X, T, K…). */
  tipo: string;
  terminales: Terminal[];
  /** The whole logical line (continuations joined), for the reader. */
  linea: string;
  /** Offsets of the logical line in `texto` (from its first character to the end of its last continuation). */
  ini: number;
  fin: number;
}

export interface FuenteVariable {
  elemento: string;
  /** Lowest frequency of the source (Hz), or null when it is not periodic or not known. */
  frecuencia: number | null;
  /** Highest frequency written in the source (Hz), for the simulation step. */
  fMax: number | null;
}

export interface Circuito {
  titulo: string;
  /** Circuit only: title, elements, models, .param, .subckt, .options, .ic… No analyses, no .control, no .end. */
  texto: string;
  elementos: Elemento[];
  /** Every node except ground, in order of first appearance. */
  nodos: string[];
  /** Independent voltage sources (candidates for the DDS generator). */
  fuentesV: string[];
  /** Sources that change with time (SIN, PULSE, PWL, SFFM, AM, TRNOISE, B with `time`). */
  variables: FuenteVariable[];
  /** The original .tran asked for UIC (start from the initial conditions, not from the operating point). */
  uic: boolean;
  /** stop time and start time of the original .tran (hints for the bench), or null. */
  tran: { paso: number; fin: number; inicio: number } | null;
}

/** Ground node names of ngspice. */
export function esMasa(n: string): boolean {
  const k = n.toLowerCase();
  return k === '0' || k === 'gnd';
}

/** Dot cards that are analyses or output requests: the bench writes its own. */
const QUITAR = /^\.(op|dc|ac|tran|noise|tf|pz|sens|four|disto|sp|pss|meas|measure|print|plot|probe|save|width|end|graph|fourier)\b/i;

interface Logica {
  texto: string;
  ini: number;
  fin: number;
  /** Token list with offsets in the original text. */
  tokens: { t: string; ini: number; fin: number }[];
}

/** Splits into logical lines (joining «+» continuations), with comments removed and token offsets. */
function logicas(texto: string): { titulo: string; lineas: Logica[]; control: string[] } {
  const fis: { ini: number; t: string }[] = [];
  let p = 0;
  for (const t of texto.split('\n')) {
    fis.push({ ini: p, t });
    p += t.length + 1;
  }
  const lineas: Logica[] = [];
  const control: string[] = [];
  let enControl = false;
  let actual: Logica | null = null;
  for (let i = 1; i < fis.length; i++) {
    const f = fis[i]!;
    const limpia = f.t.replace(/\r$/, '');
    const rec = limpia.trim();
    if (enControl) {
      if (/^\.endc\b/i.test(rec)) enControl = false;
      else control.push(rec);
      continue;
    }
    if (/^\.control\b/i.test(rec)) {
      enControl = true;
      actual = null;
      continue;
    }
    if (!rec || rec.startsWith('*')) continue;
    let cuerpo = limpia;
    const c1 = cuerpo.indexOf(';');
    if (c1 >= 0) cuerpo = cuerpo.slice(0, c1);
    const c2 = cuerpo.search(/\s\$/);
    if (c2 >= 0) cuerpo = cuerpo.slice(0, c2);
    const cont = rec.startsWith('+');
    const re = /[^\s(),=]+|=/g;
    re.lastIndex = cont ? cuerpo.indexOf('+') + 1 : 0;
    const toks: Logica['tokens'] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(cuerpo))) toks.push({ t: m[0], ini: f.ini + m.index, fin: f.ini + m.index + m[0].length });
    if (cont && actual) {
      actual.tokens.push(...toks);
      actual.texto += ' ' + rec.slice(1).trim();
      actual.fin = f.ini + limpia.length;
      continue;
    }
    actual = { texto: rec, ini: f.ini, fin: f.ini + limpia.length, tokens: toks };
    lineas.push(actual);
  }
  return { titulo: (fis[0]?.t ?? '').replace(/\r$/, ''), lineas, control };
}

const NOMBRES_2 = ['1', '2'];

/** Number of node tokens and their names for an element line. */
function terminalesDe(tipo: string, toks: string[]): string[] | null {
  switch (tipo) {
    case 'R':
    case 'C':
    case 'L':
      return NOMBRES_2;
    case 'V':
    case 'I':
    case 'B':
    case 'F':
    case 'H':
    case 'W':
      return ['+', '−'];
    case 'D':
      return ['A', 'K'];
    case 'Q':
      return ['C', 'B', 'E'];
    case 'M':
      return ['D', 'G', 'S', 'Sub'];
    case 'J':
    case 'Z':
      return ['D', 'G', 'S'];
    case 'S':
    case 'T':
      return ['+', '−', 'c+', 'c−'];
    case 'E':
    case 'G': {
      const t3 = (toks[3] ?? '').toLowerCase();
      if (/^(value|vol|cur|poly|table|laplace|freq)/.test(t3) || toks[4] === '=') return ['+', '−'];
      return ['+', '−', 'c+', 'c−'];
    }
    case 'X': {
      // Nodes are every token up to the subcircuit name (the last token that is not a «name = value»).
      let fin = toks.length;
      while (fin >= 3 && toks[fin - 2] === '=') fin -= 3;
      const n = fin - 2;
      return n > 0 ? Array.from({ length: n }, (_, i) => String(i + 1)) : null;
    }
    default:
      return null;
  }
}

/** Frequencies of a source line («SIN(0 1 1k)», «PULSE(… per)»), the lowest one, or null. */
function frecuenciaFuente(texto: string): { variable: boolean; f: number | null; fMax?: number | null } {
  const t = texto.toLowerCase();
  const args = (clave: string) => {
    const m = new RegExp(`\\b${clave}\\s*\\(([^)]*)\\)`).exec(t);
    return m ? m[1]!.split(/[\s,]+/).filter(Boolean).map((x) => numeroSpice(x)) : null;
  };
  const sin = args('sin');
  if (sin) {
    const f = sin[2] ?? null;
    return { variable: true, f: f && f > 0 ? f : null };
  }
  const pulse = args('pulse');
  if (pulse) {
    const per = pulse[6] ?? null;
    return { variable: true, f: per && per > 0 ? 1 / per : null };
  }
  if (/\b(pwl|sffm|am|trnoise|trrandom|exp)\s*\(/.test(t)) {
    const sffm = args('sffm');
    const f = sffm ? (sffm[4] ?? null) : null;
    return { variable: true, f: f && f > 0 ? f : null };
  }
  if (/\btime\b/.test(t)) {
    // Behavioural source: frequencies written as «2*pi*1k*time» (take the lowest).
    let fmin: number | null = null;
    let fmax: number | null = null;
    const re = /2\s*\*\s*pi\s*\*\s*([0-9.]+[a-zµ]*)\s*\*\s*time/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      const f = numeroSpice(m[1]!);
      if (f && f > 0) {
        fmin = fmin === null ? f : Math.min(fmin, f);
        fmax = fmax === null ? f : Math.max(fmax, f);
      }
    }
    return { variable: true, f: fmin, fMax: fmax };
  }
  return { variable: false, f: null };
}

/** Reads a netlist (a book netlist, the free circuit or a practice circuit) as a bench circuit. */
export function leerCircuito(netlist: string): Circuito {
  const fuente = netlist.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const { titulo, lineas } = logicas(fuente);

  // Rebuild the text keeping every physical line except analyses, .control blocks and .end.
  const fisicas = fuente.split('\n');
  const quitar = new Set<number>();
  {
    let enControl = false;
    let ultimaQuitada = false;
    for (let i = 1; i < fisicas.length; i++) {
      const rec = fisicas[i]!.trim();
      if (enControl) {
        quitar.add(i);
        if (/^\.endc\b/i.test(rec)) enControl = false;
        continue;
      }
      if (/^\.control\b/i.test(rec)) {
        enControl = true;
        quitar.add(i);
        continue;
      }
      if (rec.startsWith('+') && ultimaQuitada) {
        quitar.add(i);
        continue;
      }
      ultimaQuitada = QUITAR.test(rec);
      if (ultimaQuitada) quitar.add(i);
    }
  }
  // Keep offsets valid: removed lines become comments of the same length? Simpler: rebuild and re-parse.
  const texto = fisicas.map((l, i) => (quitar.has(i) ? '*' + ' '.repeat(Math.max(0, l.length - 1)) : l)).join('\n');

  let tran: Circuito['tran'] = null;
  let uic = false;
  for (const l of lineas) {
    const k = l.tokens[0]?.t.toLowerCase();
    if (k === '.tran') {
      const nums = l.tokens.slice(1).map((x) => numeroSpice(x.t));
      const [paso, fin, inicio] = [nums[0] ?? null, nums[1] ?? null, nums[2] ?? null];
      if (fin) tran = { paso: paso ?? fin / 1000, fin, inicio: inicio ?? 0 };
      if (l.tokens.some((x) => x.t.toLowerCase() === 'uic')) uic = true;
    }
  }

  // Elements of the top level (inside .subckt the nodes are local).
  const elementos: Elemento[] = [];
  const nodos: string[] = [];
  const vistos = new Set<string>();
  const fuentesV: string[] = [];
  const variables: FuenteVariable[] = [];
  let enSub = 0;
  for (const l of logicas(texto).lineas) {
    const t0 = l.tokens[0]?.t ?? '';
    const k = t0.toLowerCase();
    if (k === '.subckt') {
      enSub++;
      continue;
    }
    if (k === '.ends') {
      enSub = Math.max(0, enSub - 1);
      continue;
    }
    if (enSub || t0.startsWith('.')) continue;
    const tipo = t0[0]?.toUpperCase() ?? '';
    const nombresT = terminalesDe(
      tipo,
      l.tokens.map((x) => x.t),
    );
    if (!nombresT) continue;
    const terminales: Terminal[] = [];
    for (let i = 0; i < nombresT.length; i++) {
      const tok = l.tokens[1 + i];
      if (!tok) break;
      terminales.push({ nombre: nombresT[i]!, nodo: tok.t, ini: tok.ini, fin: tok.fin });
      const n = tok.t;
      if (!esMasa(n) && !vistos.has(n.toLowerCase())) {
        vistos.add(n.toLowerCase());
        nodos.push(n);
      }
    }
    elementos.push({ nombre: t0, tipo, terminales, linea: l.texto, ini: l.ini, fin: l.fin });
    if (tipo === 'V') fuentesV.push(t0);
    if (tipo === 'V' || tipo === 'I' || tipo === 'B') {
      const fr = frecuenciaFuente(l.texto);
      if (fr.variable) variables.push({ elemento: t0, frecuencia: fr.f, fMax: fr.fMax ?? fr.f });
    }
  }
  return { titulo, texto, elementos, nodos, fuentesV, variables, uic, tran };
}

/** Elements connected to a node, as «R1·2» labels. */
export function conexionesDe(c: Circuito, nodo: string): string[] {
  const k = nodo.toLowerCase();
  const res: string[] = [];
  for (const e of c.elementos) {
    for (const t of e.terminales) if (t.nodo.toLowerCase() === k) res.push(e.terminales.length > 1 ? `${e.nombre}·${t.nombre}` : e.nombre);
  }
  return res;
}
