// Netlist text: what to send to the engine, which analyses it runs, and the component values that can be varied.
//
// The parameter rules are the same as in contenido/spice.py (which writes them to spice.json); the build-time
// validator (scripts/validar-spice.mjs) checks that both agree on every netlist of the book.
// Plain TypeScript without DOM or Svelte: it also runs in Node.

/** Prefix added to every `echo` of a .control block, so the output can be split into sections. */
export const MARCA_ECO = '@@S@@';

// ------------------------------------------------------------------ numbers

const NUM_SPICE = /^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)([a-zµ]*)$/i;

/** Value of a SPICE number («4.7k», «100nF», «1meg», «2.2e-6»), or null if the token is not a number. */
export function numeroSpice(tok: string): number | null {
  const m = NUM_SPICE.exec(tok.trim());
  if (!m) return null;
  const base = parseFloat(m[1]!);
  const suf = m[2]!.toLowerCase();
  let mult = 1;
  if (suf.startsWith('meg')) mult = 1e6;
  else if (suf.startsWith('mil')) mult = 25.4e-6;
  else if (suf) {
    const k: Record<string, number> = { t: 1e12, g: 1e9, k: 1e3, m: 1e-3, u: 1e-6, µ: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15, a: 1e-18 };
    mult = k[suf[0]!] ?? 1;
  }
  const v = base * mult;
  return Number.isFinite(v) ? v : null;
}

/** Writes a value as a short SPICE number with an engineering suffix: 4700 → «4.7k», 1e6 → «1meg». */
export function textoSpice(v: number, cifras = 4): string {
  if (v === 0) return '0';
  const SUF: [number, string][] = [
    [1e12, 't'],
    [1e9, 'g'],
    [1e6, 'meg'],
    [1e3, 'k'],
    [1, ''],
    [1e-3, 'm'],
    [1e-6, 'u'],
    [1e-9, 'n'],
    [1e-12, 'p'],
    [1e-15, 'f'],
  ];
  const a = Math.abs(v);
  const [mult, suf] = SUF.find(([m]) => a >= m * 0.9995) ?? SUF[SUF.length - 1]!;
  const n = Number((v / mult).toPrecision(cifras));
  return `${n}${suf}`;
}

// ------------------------------------------------------------------ lines and tokens

interface Token {
  texto: string;
  /** Offset in the whole text. */
  ini: number;
  fin: number;
}

interface LineaLogica {
  /** Index of the first physical line (0-based). */
  linea: number;
  tokens: Token[];
}

interface Estructura {
  /** Element and dot lines outside .control, with the .subckt they belong to. */
  lineas: (LineaLogica & { subckt: string | null })[];
  /** Lines inside .control blocks (trimmed text). */
  control: string[];
  hayControl: boolean;
  /** `.subckt` header lines (tokens from «.subckt»), with the .subckt they are nested in. */
  cabeceras: (LineaLogica & { subckt: string | null })[];
}

/** Splits the text into logical lines (joining «+» continuations) and tokens with their offsets. */
function estructura(texto: string): Estructura {
  const fisicas: { ini: number; texto: string }[] = [];
  let p = 0;
  for (const t of texto.split('\n')) {
    fisicas.push({ ini: p, texto: t });
    p += t.length + 1;
  }
  const lineas: Estructura['lineas'] = [];
  const control: string[] = [];
  let enControl = false;
  let hayControl = false;
  const pila: string[] = [];
  const cabeceras: Estructura['cabeceras'] = [];
  let actual: (LineaLogica & { subckt: string | null }) | null = null;

  // The first line is always the title.
  for (let i = 1; i < fisicas.length; i++) {
    const f = fisicas[i]!;
    const limpio = f.texto.replace(/\r$/, '');
    const recortado = limpio.trim();
    if (enControl) {
      if (/^\.endc\b/i.test(recortado)) enControl = false;
      else control.push(recortado);
      continue;
    }
    if (/^\.control\b/i.test(recortado)) {
      enControl = true;
      hayControl = true;
      actual = null;
      continue;
    }
    if (!recortado || recortado.startsWith('*')) continue;
    const continuacion = recortado.startsWith('+');
    // Inline comments: «;» anywhere, «$» after a blank (ngspice rules).
    let cuerpo = limpio;
    const c1 = cuerpo.indexOf(';');
    if (c1 >= 0) cuerpo = cuerpo.slice(0, c1);
    const c2 = cuerpo.search(/\s\$/);
    if (c2 >= 0) cuerpo = cuerpo.slice(0, c2);
    const tokens: Token[] = [];
    const re = /[^\s(),=]+|=/g;
    let m: RegExpExecArray | null;
    const desde = continuacion ? cuerpo.indexOf('+') + 1 : 0;
    re.lastIndex = desde;
    while ((m = re.exec(cuerpo))) tokens.push({ texto: m[0], ini: f.ini + m.index, fin: f.ini + m.index + m[0].length });
    if (continuacion && actual) {
      actual.tokens.push(...tokens);
      continue;
    }
    const primero = tokens[0]?.texto.toLowerCase() ?? '';
    if (primero === '.subckt') {
      // The header is kept apart (not in `lineas`); «+» continuations extend it.
      actual = { linea: i, tokens, subckt: pila[pila.length - 1] ?? null };
      cabeceras.push(actual);
      pila.push((tokens[1]?.texto ?? '?').toLowerCase());
      continue;
    }
    if (primero === '.ends') {
      pila.pop();
      actual = null;
      continue;
    }
    actual = { linea: i, tokens, subckt: pila[pila.length - 1] ?? null };
    lineas.push(actual);
  }
  return { lineas, control, hayControl, cabeceras };
}

/** One logical line of a netlist (continuations joined), for readers of the circuit structure. */
export interface LineaNetlist {
  /** 0-based physical line where it starts. */
  linea: number;
  /** Innermost .subckt it belongs to (lower case), or null. */
  subckt: string | null;
  /** Tokens as written (separators «( ) , =» dropped, «=» kept as a token). */
  tokens: string[];
  /** The logical line as written, from its first token to its last (continuations included). */
  texto: string;
}

/**
 * Structure of a netlist for drawing it (esquema-auto): element and dot lines outside .control and the
 * `.subckt` headers. Same tokenizer and comment rules as the parameter reader.
 */
export function lineasNetlist(texto: string): { lineas: LineaNetlist[]; subckts: LineaNetlist[] } {
  const t = texto.replace(/\r\n?/g, '\n');
  const e = estructura(t);
  const conv = (l: LineaLogica & { subckt: string | null }): LineaNetlist => ({
    linea: l.linea,
    subckt: l.subckt,
    tokens: l.tokens.map((k) => k.texto),
    texto: l.tokens.length ? t.slice(l.tokens[0]!.ini, l.tokens[l.tokens.length - 1]!.fin) : '',
  });
  return { lineas: e.lineas.map(conv), subckts: e.cabeceras.map(conv) };
}

// ------------------------------------------------------------------ analyses

const ANALISIS = ['op', 'dc', 'ac', 'tran', 'noise', 'tf', 'pz', 'sens', 'four', 'disto', 'sp', 'pss'] as const;
export type TipoAnalisis = (typeof ANALISIS)[number];

/** Whether the netlist has a .control block, and the analyses it runs (dot cards and control commands). */
export function analizarNetlist(texto: string): { control: boolean; analisis: TipoAnalisis[] } {
  const e = estructura(texto.replace(/\r\n?/g, '\n'));
  const vistos = new Set<TipoAnalisis>();
  for (const l of e.lineas) {
    const t = l.tokens[0]?.texto.toLowerCase() ?? '';
    if (t.startsWith('.')) {
      const a = t.slice(1) as TipoAnalisis;
      if ((ANALISIS as readonly string[]).includes(a)) vistos.add(a);
      if (t === '.meas' || t === '.measure') {
        const a2 = (l.tokens[1]?.texto.toLowerCase() ?? '') as TipoAnalisis;
        if ((ANALISIS as readonly string[]).includes(a2)) vistos.add(a2);
      }
    }
  }
  for (const c of e.control) {
    const t = (c.split(/[\s(]/)[0] ?? '').toLowerCase() as TipoAnalisis;
    if ((ANALISIS as readonly string[]).includes(t)) vistos.add(t);
  }
  return { control: e.hayControl, analisis: ANALISIS.filter((a) => vistos.has(a)) };
}

// ------------------------------------------------------------------ engine input

/** Control commands that would stop or block the engine, or need a screen ngspice does not have here. */
const ANULADOS = /^(quit|exit|plot|iplot|gnuplot|hardcopy|asciiplot|edit|shell|xgraph|wrs2p|cd|rusage)\b/i;

/**
 * Text sent to ngspice: line endings normalised, `quit`/`exit` and interactive plotting commands commented out
 * (the app draws the plots), every `echo` of a .control block tagged with MARCA_ECO, and optionally the KLU
 * solver selected.
 */
export function prepararParaMotor(
  texto: string,
  opciones: { klu?: boolean } = {},
): { texto: string; control: boolean; anulados: string[] } {
  const lineas = texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const anulados: string[] = [];
  let enControl = false;
  let control = false;
  for (let i = 1; i < lineas.length; i++) {
    const t = lineas[i]!.trim();
    if (!enControl) {
      if (/^\.control\b/i.test(t)) enControl = control = true;
      continue;
    }
    if (/^\.endc\b/i.test(t)) {
      enControl = false;
      continue;
    }
    if (ANULADOS.test(t)) {
      anulados.push(t);
      lineas[i] = `* (anulado en la aplicación) ${t}`;
    } else if (/^echo\b/i.test(t)) {
      lineas[i] = lineas[i]!.replace(/^(\s*echo)\b/i, `$1 ${MARCA_ECO}`);
    }
  }
  // Optional KLU solver (see simular.ts). It goes just before .end (or at the end) so the line numbers of
  // ngspice's messages still match the editor.
  if (opciones.klu) {
    const fin = lineas.findIndex((l, i) => i > 0 && /^\s*\.end\s*$/i.test(l));
    if (fin > 0) lineas.splice(fin, 0, '.options klu');
    else lineas.push('.options klu');
  }
  let res = lineas.join('\n');
  if (!res.endsWith('\n')) res += '\n';
  return { texto: res, control, anulados };
}

// ------------------------------------------------------------------ parameters

export type CampoParametro = 'valor' | 'dc' | 'sin.va' | 'sin.freq' | 'pulse.v2' | 'pulse.per' | 'param';
export type TipoParametro = 'R' | 'C' | 'L' | 'V' | 'I' | 'E' | 'G' | 'param';

export interface Parametro {
  /** Stable identifier: «r1», «v1.dc», «v1.sin.freq», «opamp.r2» (inside .subckt opamp), «param:rload». */
  id: string;
  /** Element (or .param) name as written. */
  elemento: string;
  subckt: string | null;
  campo: CampoParametro;
  tipo: TipoParametro;
  /** Value in the netlist (SI units). */
  valor: number;
  /** The token as written («4.7k»). */
  texto: string;
  unidad: string;
  /** Slider range (same sign as valor), log scale. */
  min: number;
  max: number;
  /** Snap to the E12 series (R, C and L). */
  e12: boolean;
  /** 0-based line where the element starts. */
  linea: number;
}

interface Hallazgo {
  p: Parametro;
  tok: Token;
}

const UNIDAD: Record<string, string> = { R: 'Ω', C: 'F', L: 'H', V: 'V', I: 'A', E: '', G: 'S', param: '' };

function nombresAlterados(control: string[]): Set<string> {
  const s = new Set<string>();
  for (const c of control) {
    const m = /^(alter|alterparam)\s+@?([^\s[=]+)/i.exec(c);
    if (m) s.add(m[2]!.toLowerCase());
  }
  return s;
}

function hallar(texto: string): Hallazgo[] {
  const e = estructura(texto.replace(/\r\n?/g, '\n'));
  const alterados = nombresAlterados(e.control);
  const res: Hallazgo[] = [];
  const ids = new Set<string>();

  const agregar = (
    elemento: string,
    subckt: string | null,
    campo: CampoParametro,
    tipo: TipoParametro,
    tok: Token | undefined,
    linea: number,
  ) => {
    if (!tok) return;
    const valor = numeroSpice(tok.texto);
    if (valor === null || valor === 0) return;
    const base = (subckt ? `${subckt}.` : '') + elemento.toLowerCase();
    const id = tipo === 'param' ? `param:${base}` : campo === 'valor' ? base : `${base}.${campo}`;
    if (ids.has(id)) return;
    ids.add(id);
    const unidad = campo === 'sin.freq' ? 'Hz' : campo === 'pulse.per' ? 's' : (UNIDAD[tipo] ?? '');
    res.push({
      p: {
        id,
        elemento,
        subckt,
        campo,
        tipo,
        valor,
        texto: tok.texto,
        unidad,
        min: valor / 10,
        max: valor * 10,
        e12: tipo === 'R' || tipo === 'C' || tipo === 'L',
        linea,
      },
      tok,
    });
  };

  for (const l of e.lineas) {
    const t = l.tokens;
    const nombre = t[0]?.texto ?? '';
    const k = nombre[0]?.toUpperCase() ?? '';
    if (nombre.toLowerCase() === '.param') {
      // .param a = 1k b = 2k
      for (let i = 1; i + 2 < t.length + 1; i++) {
        if (t[i + 1]?.texto === '=' && t[i + 2]) {
          const n = t[i]!.texto;
          if (!alterados.has(n.toLowerCase())) agregar(n, l.subckt, 'param', 'param', t[i + 2], l.linea);
          i += 2;
        }
      }
      continue;
    }
    if (nombre.startsWith('.') || alterados.has(nombre.toLowerCase())) continue;
    if (k === 'R' || k === 'C' || k === 'L') {
      if (t.length >= 4 && t[4]?.texto !== '=') agregar(nombre, l.subckt, 'valor', k, t[3], l.linea);
    } else if (k === 'E' || k === 'G') {
      if (t.length === 6) agregar(nombre, l.subckt, 'valor', k, t[5], l.linea);
    } else if (k === 'V' || k === 'I') {
      let i = 3;
      while (i < t.length) {
        const w = t[i]!.texto.toLowerCase();
        if (w === 'dc') {
          agregar(nombre, l.subckt, 'dc', k, t[i + 1], l.linea);
          i += 2;
        } else if (w === 'ac') {
          i += 2;
          if (i < t.length && numeroSpice(t[i]!.texto) !== null) i++;
        } else if (w === 'sin' || w === 'pulse') {
          const args: Token[] = [];
          let j = i + 1;
          while (j < t.length && numeroSpice(t[j]!.texto) !== null) args.push(t[j++]!);
          if (w === 'sin') {
            agregar(nombre, l.subckt, 'sin.va', k, args[1], l.linea);
            agregar(nombre, l.subckt, 'sin.freq', k, args[2], l.linea);
          } else {
            agregar(nombre, l.subckt, 'pulse.v2', k, args[1], l.linea);
            agregar(nombre, l.subckt, 'pulse.per', k, args[6], l.linea);
          }
          i = j;
        } else if (i === 3 && numeroSpice(t[i]!.texto) !== null) {
          agregar(nombre, l.subckt, 'dc', k, t[i], l.linea);
          i++;
        } else {
          i++;
        }
      }
    }
  }
  return res;
}

/** Component values that can be varied with a slider. */
export function listarParametros(texto: string): Parametro[] {
  return hallar(texto).map((h) => h.p);
}

/** Current value of a parameter in the text, or null when it is no longer there (edited away). */
export function leerParametro(texto: string, id: string): number | null {
  return hallar(texto).find((h) => h.p.id === id)?.p.valor ?? null;
}

/** Rewrites the token of a parameter with a new value. Returns the text unchanged if it is not found. */
export function aplicarParametro(texto: string, id: string, valor: number): string {
  const h = hallar(texto).find((x) => x.p.id === id);
  if (!h) return texto;
  return texto.slice(0, h.tok.ini) + textoSpice(valor) + texto.slice(h.tok.fin);
}

// ------------------------------------------------------------------ E12

const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];

/** E12 values between a and b (positive, inclusive). */
export function serieE12(a: number, b: number): number[] {
  const res: number[] = [];
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  for (let d = Math.floor(Math.log10(lo)) - 1; d <= Math.ceil(Math.log10(hi)); d++) {
    for (const m of E12) {
      const v = Number((m * 10 ** d).toPrecision(3));
      if (v >= lo * 0.999 && v <= hi * 1.001) res.push(v);
    }
  }
  return res;
}
