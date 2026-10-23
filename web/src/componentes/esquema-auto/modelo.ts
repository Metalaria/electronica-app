// Circuit model of a netlist for drawing it: devices with typed terminals, nets, models, subcircuits and the
// supply rails. Plain TypeScript (no DOM): it runs in the app, in a worker and in Node (tests).

import { lineasNetlist, numeroSpice, type LineaNetlist } from '../../simulador/motor/netlist.ts';
import { formatoCorto } from '../grafica/formato.ts';

/** Symbol to draw. */
export type TipoSimbolo =
  | 'R' | 'C' | 'L'
  | 'VDC' | 'VSIN' | 'VPULSO' | 'VPWL' | 'IDC' | 'ISIN' | 'IPULSO'
  | 'D' | 'DZ' | 'LED' | 'DS'
  | 'NPN' | 'PNP' | 'NMOS' | 'PMOS' | 'NJF' | 'PJF'
  | 'DEPV' | 'DEPI' | 'SW' | 'TL' | 'OPAMP' | 'CAJA' | 'PUERTA' | 'TRAFO' | 'PUENTE';

export interface Pin {
  /** Terminal name in the topology (book conventions): start/end, base/collector/emitter, in1/in2/out… */
  nombre: string;
  /** Net (lower case). */
  nodo: string;
  /** Pin label drawn inside boxes (subcircuit port name). */
  rotulo?: string;
  /** Position of the node on the netlist line (0-based), when not implied by the letter. */
  indice?: number;
}

export interface Dispositivo {
  /** Name as written («R1»). */
  nombre: string;
  /** Lower case name, the key of slider parameters and ngspice vectors. */
  clave: string;
  letra: string;
  simbolo: TipoSimbolo;
  /** Book roles (ESQUEMA.md «elementos[]»). */
  rol: string;
  /** schemdraw-like class name. */
  clase: string;
  pines: Pin[];
  /** Value as shown («10 kΩ», «∿ 1 V · 1 kHz»), or ''. */
  valor: string;
  /** Second line for some parts (model, controlling quantity). */
  extra: string;
  /** Numeric value (SI) when it is a plain number. */
  numero: number | null;
  unidad: string;
  /** Model or subcircuit name. */
  modelo: string | null;
  /** 0-based line in the text. */
  linea: number;
  /** Polarity in the book's terms (positivo/negativo, entra/sale, anodo/catodo…). */
  polaridad?: Record<string, string>;
  /** Box title (subcircuits, XSPICE), gate kind for PUERTA. */
  titulo?: string;
  /** Coupled inductors (TRAFO): their device names, primary first; coupling text. */
  bobinas?: Dispositivo[];
  /** Diode bridge (PUENTE): its four diodes and the bridge pins (a, b, p, n) of their anode and cathode. */
  diodos?: { d: Dispositivo; anodo: 'a' | 'b' | 'n'; catodo: 'a' | 'b' | 'p' }[];
  /** Pins hidden in the drawing (op-amp supplies tied to nothing else, MOSFET bulk on its source). */
  ocultos?: Pin[];
}

export interface Modelo {
  nombre: string;
  tipo: string;
  params: Record<string, string>;
}

export interface Subcircuito {
  nombre: string;
  puertos: string[];
  linea: number;
}

export interface Riel {
  nodo: string;
  /** +1 positive rail (drawn upwards), −1 negative. */
  signo: 1 | -1;
  /** The DC source that drives it, or null for a rail only by name. */
  fuente: Dispositivo | null;
  /** Label: V<sub>CC</sub>… as html. */
  html: string;
  texto: string;
}

export interface Circuito {
  titulo: string;
  dispositivos: Dispositivo[];
  /** Supply sources drawn apart (rail to ground). */
  fuentesRiel: Dispositivo[];
  rieles: Map<string, Riel>;
  modelos: Map<string, Modelo>;
  subckts: Map<string, Subcircuito>;
  /** Nets in order of first appearance (ground excluded). */
  nodos: string[];
  /** Lines that could not be read as devices («Q1 a b» with too few nodes…). */
  ignoradas: { linea: number; texto: string; motivo: string }[];
  /** Subcircuit drawn (`opciones.subckt`) or null for the main circuit. */
  subckt: string | null;
  /** Ports of the drawn subcircuit (nets that get a terminal marker). */
  puertos: string[];
}

export const TIERRA = '0';
export function esTierra(n: string): boolean {
  return n === '0' || n === 'gnd';
}

// ------------------------------------------------------------------ tokens

/**
 * Splits a logical line keeping groups together: «SIN(0 1 1k)» → «SIN(0 1 1k)», «{a*b}» and «'…'» whole,
 * «r = 1k» → «r=1k». Commas outside groups separate like blanks.
 */
export function trocear(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let prof = 0;
  let comilla = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (comilla) {
      cur += c;
      if (c === comilla) comilla = '';
      continue;
    }
    if (c === "'" || c === '"') {
      comilla = c;
      cur += c;
      continue;
    }
    if (c === '(' || c === '{' || c === '[') prof++;
    if (c === ')' || c === '}' || c === ']') prof = Math.max(0, prof - 1);
    if (prof === 0 && (c === ' ' || c === '\t' || c === ',')) {
      if (cur) out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur) out.push(cur);
  // Join «a = b», «a= b», «a =b» into «a=b»; a group «( … )» after a word joins it («SIN (0 1)» → «SIN(0 1)»).
  const res: string[] = [];
  for (let i = 0; i < out.length; i++) {
    let t = out[i]!;
    if (t === '=' && res.length && i + 1 < out.length) {
      res[res.length - 1] += '=' + out[++i]!;
      continue;
    }
    if (t.endsWith('=') && i + 1 < out.length && t.length > 1) t += out[++i]!;
    else if (t.startsWith('=') && res.length) {
      res[res.length - 1] += t;
      continue;
    }
    if (t.startsWith('(') && res.length && /^[a-z]+$/i.test(res[res.length - 1]!)) {
      res[res.length - 1] += t;
      continue;
    }
    res.push(t);
  }
  return res;
}

/** Arguments of «SIN(0 1 1k)» → ['0','1','1k']. */
function argumentos(tok: string): string[] {
  const a = tok.indexOf('(');
  const b = tok.lastIndexOf(')');
  if (a < 0) return [];
  return trocear(tok.slice(a + 1, b > a ? b : undefined));
}

const NUM = (t: string | undefined): number | null => (t == null ? null : numeroSpice(t));

/** «10 kΩ» for a number, the expression itself for «{rl}». */
function textoValor(tok: string | undefined, unidad: string): { texto: string; numero: number | null } {
  if (!tok) return { texto: '', numero: null };
  const n = numeroSpice(tok);
  if (n !== null) return { texto: formatoCorto(n, unidad), numero: n };
  let t = tok.replace(/^'|'$/g, '');
  if (t.length > 16) t = t.slice(0, 15) + '…';
  return { texto: t, numero: null };
}

function corto(n: number | null, u: string, tok?: string): string {
  if (n !== null) return formatoCorto(n, u);
  if (!tok) return '';
  const t = tok.replace(/^'|'$/g, '');
  return t.length > 12 ? t.slice(0, 11) + '…' : t;
}

// ------------------------------------------------------------------ independent sources

interface Fuente {
  simbolo: 'DC' | 'SIN' | 'PULSO' | 'PWL';
  valor: string;
  dc: number | null;
  /** Only a DC value (no AC, no waveform). */
  soloDC: boolean;
}

function leerFuente(toks: string[], u: string): Fuente {
  let dcTok: string | undefined;
  let ac: string | undefined;
  let onda: { tipo: string; args: string[] } | null = null;
  for (let i = 3; i < toks.length; i++) {
    const t = toks[i]!;
    const tl = t.toLowerCase();
    if (tl === 'dc') {
      dcTok = toks[++i];
    } else if (tl === 'ac') {
      ac = toks[i + 1] && numeroSpice(toks[i + 1]!) !== null ? toks[++i] : '1';
      if (toks[i + 1] && numeroSpice(toks[i + 1]!) !== null) i++;
    } else if (/^(sin|pulse|pwl|exp|sffm|am|trnoise|trrandom|distof\d)\b/i.test(tl)) {
      const tipo = tl.match(/^[a-z]+/)![0];
      let args = argumentos(t);
      if (!args.length && !t.includes('(')) {
        // «SIN 0 1 1k» without parentheses: numbers that follow.
        args = [];
        while (i + 1 < toks.length && numeroSpice(toks[i + 1]!) !== null) args.push(toks[++i]!);
      }
      onda = { tipo, args };
    } else if (i === 3 && (numeroSpice(t) !== null || t.startsWith('{'))) {
      dcTok = t;
    }
  }
  const dc = NUM(dcTok);
  const partes: string[] = [];
  let simbolo: Fuente['simbolo'] = 'DC';
  if (onda?.tipo === 'sin') {
    simbolo = 'SIN';
    const [vo, va, f] = onda.args;
    const o = NUM(vo);
    let s = `∿ ${corto(NUM(va), u, va)}`;
    if (f) s += ` · ${corto(NUM(f), 'Hz', f)}`;
    if (o) s = `${formatoCorto(o, u)} + ${s}`;
    partes.push(s);
  } else if (onda?.tipo === 'pulse') {
    simbolo = 'PULSO';
    const [v1, v2, , , , pw, per] = onda.args;
    const a = NUM(v1);
    const b = NUM(v2);
    let s = a !== null && b !== null ? `${formatoCorto(a, '')}/${formatoCorto(b, u)}`.replace(/^0\//, '0/') : `${v1 ?? ''}/${v2 ?? ''}`;
    const p = NUM(per);
    if (p) s += ` · ${formatoCorto(1 / p, 'Hz')}`;
    else if (pw) s += ` · ${corto(NUM(pw), 's', pw)}`;
    partes.push(s);
  } else if (onda) {
    simbolo = onda.tipo === 'exp' ? 'PWL' : onda.tipo === 'pwl' ? 'PWL' : 'SIN';
    partes.push(onda.tipo.toUpperCase());
  }
  if (dcTok && (dc === null || dc !== 0 || !partes.length)) partes.unshift(corto(dc, u, dcTok));
  if (ac) {
    if (!onda) simbolo = 'SIN';
    partes.push(`AC ${corto(NUM(ac), u, ac)}`);
  }
  return { simbolo, valor: partes.join(' · '), dc, soloDC: !onda && !ac };
}

// ------------------------------------------------------------------ models and subcircuits

function leerModelos(lineas: LineaNetlist[]): Map<string, Modelo> {
  const m = new Map<string, Modelo>();
  for (const l of lineas) {
    if (l.tokens[0]?.toLowerCase() !== '.model' || l.tokens.length < 3) continue;
    const nombre = l.tokens[1]!.toLowerCase();
    const tipo = l.tokens[2]!.toLowerCase();
    const params: Record<string, string> = {};
    for (let i = 3; i + 2 < l.tokens.length + 1; i++) {
      if (l.tokens[i + 1] === '=' && l.tokens[i + 2] != null) {
        params[l.tokens[i]!.toLowerCase()] = l.tokens[i + 2]!;
        i += 2;
      }
    }
    m.set(nombre, { nombre, tipo, params });
  }
  return m;
}

function leerSubckts(cabeceras: LineaNetlist[]): Map<string, Subcircuito> {
  const m = new Map<string, Subcircuito>();
  for (const c of cabeceras) {
    const t = trocear(c.texto);
    const nombre = (t[1] ?? '?').toLowerCase();
    const puertos: string[] = [];
    for (let i = 2; i < t.length; i++) {
      const x = t[i]!;
      if (/^params:?$/i.test(x) || x.includes('=')) break;
      puertos.push(x.toLowerCase());
    }
    m.set(nombre, { nombre, puertos, linea: c.linea });
  }
  return m;
}

// ------------------------------------------------------------------ op-amps, gates and boxes

const RE_OPAMP = /(^|_)(op|opa|opamp|oa|amp|ao|comp|comparador|lm3[0-9]{2}|lm741|ua741|741|tl0[0-9]{2}|ne553\d|ad8\d+|opa\d+|lf35\d|mcp60\d+|op\d+|inamp)/i;
const P_MAS = /^(inp|in\+|ip|p|plus|non|noninv|ni|nin|pos|mas|in_p|inplus|vinp|v\+in|\+|ina|in1p|e\+)$/i;
const P_MENOS = /^(inn|inm|in-|im|n|minus|inv|neg|menos|in_n|inminus|vinn|v-in|-|inb|in1n|e-)$/i;
const P_SAL = /^(out|o|vo|vout|salida|s|output|y|q)$/i;
const P_VMAS = /^(vp|vcc|vdd|v\+|vpos|vs\+|vplus|alim\+|vsp|pwr|vcc1)$/i;
const P_VMENOS = /^(vn|vee|vss|v-|vneg|vs-|vminus|alim-|vsn|gnd|0)$/i;

/** Pin roles of an op-amp-like subcircuit, or null. */
function pinesOpamp(sub: Subcircuito | undefined, nombreSub: string): { mas: number; menos: number; sal: number; vmas: number; vmenos: number } | null {
  if (!RE_OPAMP.test(nombreSub) && !(sub && sub.puertos.some((p) => P_MAS.test(p)) && sub.puertos.some((p) => P_MENOS.test(p)))) return null;
  const ps = sub?.puertos;
  if (ps) {
    const idx = (re: RegExp) => ps.findIndex((p) => re.test(p));
    const mas = idx(P_MAS);
    const menos = idx(P_MENOS);
    const sal = idx(P_SAL);
    if (mas >= 0 && menos >= 0 && sal >= 0 && ps.length <= 6) {
      return { mas, menos, sal, vmas: idx(P_VMAS), vmenos: idx(P_VMENOS) };
    }
    if (ps.length === 3) return { mas: 0, menos: 1, sal: 2, vmas: -1, vmenos: -1 };
    if (ps.length === 5) return { mas: 0, menos: 1, vmas: 2, vmenos: 3, sal: 4 };
    return null;
  }
  return null;
}

const PUERTAS: [RegExp, string][] = [
  [/^nand/i, 'NAND'],
  [/^nor/i, 'NOR'],
  [/^xnor/i, 'XNOR'],
  [/^xor/i, 'XOR'],
  [/^and/i, 'AND'],
  [/^or/i, 'OR'],
  [/^(inv|not)/i, 'NOT'],
  [/^(buf)/i, 'BUF'],
];

/** IEC gate kind from a subcircuit or XSPICE model name. */
function puerta(nombre: string): string | null {
  const n = nombre.replace(/^d_/, '');
  for (const [re, k] of PUERTAS) if (re.test(n)) return k;
  return null;
}

/** Side of a box pin from its name: outputs right, supplies top/bottom, the rest left. */
export function ladoPuerto(nombre: string): 'izq' | 'der' | 'arr' | 'aba' {
  const n = nombre.toLowerCase();
  if (/^(out|o|y|q|nq|qn|qb|vo|vout|s|salida|outp|outn|o\d|y\d|q\d|k|cat|catodo|neg|pos|c|e|emisor|colector|drain|d|ac2|b2|sal)$/.test(n) || /^(out|sal)/.test(n)) {
    if (/^(pos)$/.test(n)) return 'arr';
    if (/^(neg)$/.test(n)) return 'aba';
    return 'der';
  }
  if (/^(vcc|vdd|v\+|vp|vpos|pwr|alim|vs)$/.test(n)) return 'arr';
  if (/^(gnd|vee|vss|v-|vn|vneg|ref|tierra)$/.test(n)) return 'aba';
  return 'izq';
}

// ------------------------------------------------------------------ rails

const RE_RIEL = /^(v?cc|v?dd|v?ee|v?ss|vbat|vbatt|vb|vs|vsup|vsupply|valim|alim|vpos|vneg|vplus|vminus|v\+|v-|vp|vn|vdc|vccq|vdda|vddd|vcc\d|vdd\d|v\d+v?\d*|v\d+_\d+|bat|vb\+|\+\d+v?|-\d+v?)$/i;
const RE_NEG = /^(v?ee|v?ss|vneg|vminus|v-|vn|-\d+v?)$/i;

/** «V<sub>CC</sub>» from «vcc». */
export function htmlRiel(n: string): string {
  const m = /^v(cc|dd|ee|ss|bat|batt|b|s|sup|alim|pos|neg|plus|minus|p|n|dc|\d+.*)$/i.exec(n);
  if (m) return `V<sub>${esc(m[1]!.toUpperCase())}</sub>`;
  return esc(n);
}
/** Plain text of a rail label: «VCC» for v-names, the netlist name otherwise. */
export function textoRiel(n: string): string {
  return /^v(cc|dd|ee|ss|bat|batt|b|s|sup|alim|pos|neg|plus|minus|p|n|dc|\d+.*)$/i.test(n) ? n.toUpperCase() : n;
}
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ------------------------------------------------------------------ devices

function dos(nombre: string, a: string, b: string): Pin[] {
  void nombre;
  return [
    { nombre: 'start', nodo: a.toLowerCase() },
    { nombre: 'end', nodo: b.toLowerCase() },
  ];
}

function nuevo(l: LineaNetlist, t: string[], p: Partial<Dispositivo> & Pick<Dispositivo, 'simbolo' | 'rol' | 'clase' | 'pines'>): Dispositivo {
  return {
    nombre: t[0]!,
    clave: t[0]!.toLowerCase(),
    letra: t[0]![0]!.toUpperCase(),
    valor: '',
    extra: '',
    numero: null,
    unidad: '',
    modelo: null,
    linea: l.linea,
    ...p,
  };
}

function tipoDiodo(modelo: string, m: Modelo | undefined): 'D' | 'DZ' | 'LED' | 'DS' {
  const n = modelo.toLowerCase();
  if (/led/.test(n)) return 'LED';
  if (/(^|_)(z|bz|zen|1n47|1n52|1n53|dz)/.test(n) || /zener/.test(n)) return 'DZ';
  if (/(schott|bat\d|1n58|ss1|mbr|sk\d|dsch)/.test(n)) return 'DS';
  if (m) {
    const bv = numeroSpice(m.params['bv'] ?? '');
    if (bv !== null && bv > 0 && bv <= 60 && !/1n4148|1n914|1n400/.test(n)) return 'DZ';
    const nn = numeroSpice(m.params['n'] ?? '');
    const is = numeroSpice(m.params['is'] ?? '');
    if (nn !== null && is !== null && is < 1e-16 && nn >= 1.5) return 'LED';
  }
  return 'D';
}

const ROL_DIODO = { D: 'D', DS: 'D', DZ: 'DZ', LED: 'LED' } as const;
const CLASE_DIODO = { D: 'Diode', DS: 'Schottky', DZ: 'Zener', LED: 'LED' } as const;

function leerDispositivo(
  l: LineaNetlist,
  modelos: Map<string, Modelo>,
  subckts: Map<string, Subcircuito>,
): Dispositivo | { error: string } {
  const t = trocear(l.texto);
  const nombre = t[0]!;
  const k = nombre[0]!.toUpperCase();
  const nod = (i: number) => (t[i] ?? '').toLowerCase();
  const falta = (n: number) => (t.length < n ? { error: `faltan nodos (${t.length - 1})` } : null);
  switch (k) {
    case 'R':
    case 'C':
    case 'L': {
      const f = falta(3);
      if (f) return f;
      const u = k === 'R' ? 'Ω' : k === 'C' ? 'F' : 'H';
      let tok = t[3] && !t[3].includes('=') ? t[3] : undefined;
      if (!tok) {
        const kv = t.slice(3).find((x) => /^(r|resistance|c|capacitance|l|inductance)=/i.test(x));
        if (kv) tok = kv.split('=')[1];
      }
      // «R1 a b rmod 1k»: a model name before the value.
      if (tok && numeroSpice(tok) === null && !tok.startsWith('{') && t[4] && numeroSpice(t[4]) !== null) tok = t[4];
      const v = textoValor(tok, u);
      const ic = t.slice(3).find((x) => /^ic=/i.test(x));
      return nuevo(l, t, {
        simbolo: k,
        rol: k,
        clase: k === 'R' ? 'ResistorIEC' : k === 'C' ? 'Capacitor' : 'Inductor2',
        pines: dos(nombre, nod(1), nod(2)),
        valor: v.texto,
        numero: v.numero,
        unidad: u,
        extra: ic ? `${ic.split('=')[0]!.toUpperCase()} = ${corto(NUM(ic.split('=')[1]), k === 'L' ? 'A' : 'V', ic.split('=')[1])}` : '',
      });
    }
    case 'V':
    case 'I': {
      const f = falta(3);
      if (f) return f;
      const u = k === 'V' ? 'V' : 'A';
      const fu = leerFuente(t, u);
      const simbolo = ((k === 'V' ? 'V' : 'I') + (fu.simbolo === 'DC' ? 'DC' : fu.simbolo === 'SIN' ? 'SIN' : fu.simbolo === 'PULSO' ? 'PULSO' : 'PWL')) as TipoSimbolo;
      const simb: TipoSimbolo = k === 'I' ? (fu.simbolo === 'SIN' ? 'ISIN' : fu.simbolo === 'PULSO' ? 'IPULSO' : 'IDC') : simbolo;
      const rol = k === 'I' ? 'I' : fu.simbolo === 'DC' ? 'V' : fu.simbolo === 'SIN' ? 'VSIN' : fu.simbolo === 'PULSO' ? 'VPULSE' : 'V?';
      const clase = k === 'I' ? 'SourceI' : fu.simbolo === 'DC' ? 'SourceV' : fu.simbolo === 'SIN' ? 'SourceSin' : fu.simbolo === 'PULSO' ? 'SourceSquare' : 'Source';
      // SPICE V n+ n-: «+» at n+. Drawn as schemdraw does: «+» at «end». I n+ n-: current enters at n+.
      const pines: Pin[] =
        k === 'V'
          ? [
              { nombre: 'start', nodo: nod(2) },
              { nombre: 'end', nodo: nod(1) },
            ]
          : dos(nombre, nod(1), nod(2));
      return nuevo(l, t, {
        simbolo: simb,
        rol,
        clase,
        pines,
        valor: fu.valor || (k === 'V' ? '0 V' : '0 A'),
        numero: fu.soloDC ? fu.dc : null,
        unidad: u,
        polaridad: k === 'V' ? { positivo: 'end', negativo: 'start' } : { entra: 'start', sale: 'end' },
      });
    }
    case 'D': {
      const f = falta(4);
      if (f) return f;
      const modelo = t[3] ?? '';
      const m = modelos.get(modelo.toLowerCase());
      const tipo = tipoDiodo(modelo, m);
      return nuevo(l, t, {
        simbolo: tipo,
        rol: ROL_DIODO[tipo],
        clase: CLASE_DIODO[tipo],
        pines: dos(nombre, nod(1), nod(2)),
        modelo,
        valor: tipo === 'DZ' && m?.params['bv'] ? `${formatoCorto(numeroSpice(m.params['bv']) ?? 0, 'V')}` : '',
        extra: modelo,
        polaridad: { anodo: 'start', catodo: 'end' },
      });
    }
    case 'Q': {
      const f = falta(5);
      if (f) return f;
      let modelo = t[4]!;
      let sustrato: string | null = null;
      if (!modelos.has(modelo.toLowerCase()) && t[5] && modelos.has(t[5].toLowerCase())) {
        sustrato = nod(4);
        modelo = t[5];
      }
      void sustrato;
      const m = modelos.get(modelo.toLowerCase());
      const pnp = m ? m.tipo.startsWith('pnp') : /pnp|3906|bc55|bc32|bd1[34]\d|tip3[02]|tip42|2n2907|2n5401/i.test(modelo);
      return nuevo(l, t, {
        simbolo: pnp ? 'PNP' : 'NPN',
        rol: pnp ? 'QP' : 'QN',
        clase: pnp ? 'BjtPnp' : 'BjtNpn',
        pines: [
          { nombre: 'collector', nodo: nod(1) },
          { nombre: 'base', nodo: nod(2) },
          { nombre: 'emitter', nodo: nod(3) },
        ],
        modelo,
        extra: modelo,
      });
    }
    case 'M': {
      const f = falta(6);
      if (f) return f;
      const modelo = t[5]!;
      const m = modelos.get(modelo.toLowerCase());
      const p = m ? m.tipo.startsWith('pmos') || m.tipo === 'p' : /pmos|irf9|bss84|^p/i.test(modelo);
      const pines: Pin[] = [
        { nombre: 'drain', nodo: nod(1) },
        { nombre: 'gate', nodo: nod(2) },
        { nombre: 'source', nodo: nod(3) },
      ];
      const ocultos: Pin[] = [];
      if (nod(4) !== nod(3)) pines.push({ nombre: 'bulk', nodo: nod(4) });
      else ocultos.push({ nombre: 'bulk', nodo: nod(4) });
      return nuevo(l, t, {
        simbolo: p ? 'PMOS' : 'NMOS',
        rol: p ? 'MP' : 'MN',
        clase: p ? 'PFet' : 'NFet',
        pines,
        ocultos,
        modelo,
        extra: modelo,
      });
    }
    case 'J':
    case 'Z': {
      const f = falta(5);
      if (f) return f;
      const modelo = t[4]!;
      const m = modelos.get(modelo.toLowerCase());
      const p = m ? m.tipo.startsWith('pjf') : /pjf|^p/i.test(modelo);
      return nuevo(l, t, {
        simbolo: p ? 'PJF' : 'NJF',
        rol: p ? 'JP' : 'JN',
        clase: p ? 'JFetP' : 'JFetN',
        pines: [
          { nombre: 'drain', nodo: nod(1) },
          { nombre: 'gate', nodo: nod(2) },
          { nombre: 'source', nodo: nod(3) },
        ],
        modelo,
        extra: modelo,
      });
    }
    case 'E':
    case 'G':
    case 'F':
    case 'H':
    case 'B': {
      const f = falta(3);
      if (f) return f;
      const resto = t.slice(3);
      const tension = k === 'E' || k === 'H' || (k === 'B' && /^v\s*=/i.test(resto.join(' ')));
      let valor = '';
      let extra = '';
      let numero: number | null = null;
      // E1 out 0 inp inn 1e5 drawn as an op-amp when the gain is large.
      if (k === 'E' && resto.length === 3 && numeroSpice(resto[2]!) !== null && !esTierra(nod(1)) && esTierra(nod(2))) {
        const g = numeroSpice(resto[2]!)!;
        numero = g;
        if (Math.abs(g) >= 1000) {
          return nuevo(l, t, {
            simbolo: 'OPAMP',
            rol: 'OA',
            clase: 'Opamp',
            pines: [
              { nombre: 'in1', nodo: nod(4), indice: 3 },
              { nombre: 'in2', nodo: nod(3), indice: 2 },
              { nombre: 'out', nodo: nod(1), indice: 0 },
            ],
            ocultos: [{ nombre: 'ref', nodo: nod(2), indice: 1 }],
            valor: `A = ${formatoCorto(g, '')}`,
            numero: g,
            polaridad: { inversora: 'in1', no_inversora: 'in2', salida: 'out' },
          });
        }
      }
      if ((k === 'E' || k === 'G') && resto.length === 3 && numeroSpice(resto[2]!) !== null) {
        numero = numeroSpice(resto[2]!)!;
        valor = `${formatoCorto(numero, k === 'G' ? 'S' : '')} · v(${resto[0]}, ${resto[1]})`.replace(/^1 · /, '');
      } else if ((k === 'F' || k === 'H') && resto.length >= 2) {
        numero = numeroSpice(resto[1]!);
        valor = `${corto(numero, k === 'H' ? 'Ω' : '', resto[1])} · i(${resto[0]})`;
      } else {
        let e = resto.join(' ').replace(/\s+/g, ' ');
        if (e.length > 22) e = e.slice(0, 21) + '…';
        valor = e;
      }
      const pines: Pin[] = tension
        ? [
            { nombre: 'start', nodo: nod(2) },
            { nombre: 'end', nodo: nod(1) },
          ]
        : dos(nombre, nod(1), nod(2));
      return nuevo(l, t, {
        simbolo: tension ? 'DEPV' : 'DEPI',
        rol: 'DEP',
        clase: tension ? 'SourceControlledV' : 'SourceControlledI',
        pines,
        valor,
        extra,
        numero,
        polaridad: tension ? { positivo: 'end', negativo: 'start' } : { entra: 'start', sale: 'end' },
      });
    }
    case 'S':
    case 'W': {
      const f = falta(3);
      if (f) return f;
      const ctl = k === 'S' ? (t[3] && t[4] ? `v(${t[3]}, ${t[4]})` : '') : t[3] ? `i(${t[3]})` : '';
      const modelo = k === 'S' ? t[5] ?? '' : t[4] ?? '';
      const estado = t.find((x) => /^(on|off)$/i.test(x));
      return nuevo(l, t, {
        simbolo: 'SW',
        rol: 'SW',
        clase: 'Switch',
        pines: dos(nombre, nod(1), nod(2)),
        valor: ctl ? `control ${ctl}` : '',
        modelo,
        extra: estado ?? '',
      });
    }
    case 'T':
    case 'O':
    case 'U': {
      const f = falta(5);
      if (f) return f;
      const z0 = t.find((x) => /^z0=/i.test(x));
      const td = t.find((x) => /^td=/i.test(x));
      const partes: string[] = [];
      if (z0) partes.push(`Z₀ ${corto(NUM(z0.split('=')[1]), 'Ω', z0.split('=')[1])}`);
      if (td) partes.push(`${corto(NUM(td.split('=')[1]), 's', td.split('=')[1])}`);
      return nuevo(l, t, {
        simbolo: 'TL',
        rol: 'TL',
        clase: 'Coax',
        pines: [
          { nombre: 'a', nodo: nod(1) },
          { nombre: 'a_ref', nodo: nod(2) },
          { nombre: 'b', nodo: nod(3) },
          { nombre: 'b_ref', nodo: nod(4) },
        ],
        valor: partes.join(' · ') || (k === 'O' ? t[5] ?? '' : ''),
      });
    }
    case 'X': {
      // Nodes, then the subcircuit name, then parameters (a=b, «params:»).
      const pos: string[] = [];
      for (let i = 1; i < t.length; i++) {
        const x = t[i]!;
        if (/^params:?$/i.test(x) || x.includes('=')) break;
        pos.push(x);
      }
      if (pos.length < 2) return { error: 'subcircuito sin nodos' };
      const subNombre = pos[pos.length - 1]!;
      const nodos = pos.slice(0, -1).map((x) => x.toLowerCase());
      const sub = subckts.get(subNombre.toLowerCase());
      const params = t.slice(pos.length + 1).filter((x) => x.includes('='));
      const extra = params.length ? params.join(' ').slice(0, 28) : '';
      const op = pinesOpamp(sub, subNombre);
      if (op && nodos.length === (sub?.puertos.length ?? nodos.length) && op.sal < nodos.length) {
        const pines: Pin[] = [
          { nombre: 'in1', nodo: nodos[op.menos]!, indice: op.menos },
          { nombre: 'in2', nodo: nodos[op.mas]!, indice: op.mas },
          { nombre: 'out', nodo: nodos[op.sal]!, indice: op.sal },
        ];
        if (op.vmas >= 0 && nodos[op.vmas] != null) pines.push({ nombre: 'vd', nodo: nodos[op.vmas]!, indice: op.vmas });
        if (op.vmenos >= 0 && nodos[op.vmenos] != null) pines.push({ nombre: 'vs', nodo: nodos[op.vmenos]!, indice: op.vmenos });
        // Extra ports (an instrumentation amplifier's «ref»): drawn as box pins is not possible here; listed.
        const usados = new Set([op.menos, op.mas, op.sal, op.vmas, op.vmenos]);
        const otros = nodos.map((n, i) => ({ n, i })).filter((x) => !usados.has(x.i));
        for (const o of otros) pines.push({ nombre: `p${o.i + 1}`, nodo: o.n, rotulo: sub?.puertos[o.i] ?? String(o.i + 1), indice: o.i });
        if (!otros.length) {
          return nuevo(l, t, {
            simbolo: 'OPAMP',
            rol: 'OA',
            clase: 'Opamp',
            pines,
            modelo: subNombre,
            titulo: subNombre,
            extra,
            polaridad: { inversora: 'in1', no_inversora: 'in2', salida: 'out' },
          });
        }
      }
      const g = puerta(subNombre);
      const puertos = sub?.puertos ?? nodos.map((_, i) => String(i + 1));
      const pines: Pin[] = nodos.map((n, i) => ({ nombre: `p${i + 1}`, nodo: n, rotulo: puertos[i] ?? String(i + 1) }));
      return nuevo(l, t, {
        simbolo: g ? 'PUERTA' : 'CAJA',
        rol: 'X',
        clase: g ? 'Gate' : 'Ic',
        pines,
        modelo: subNombre,
        titulo: g ?? subNombre,
        extra,
      });
    }
    case 'A': {
      // XSPICE: ports are single nodes or [ ] vectors, maybe with %v, %d… prefixes; the last token is the
      // model. «NULL» leaves a port unconnected (not drawn).
      const limpio = l.texto.replace(/~/g, ' ').replace(/%[a-z_]+/gi, ' ');
      const grupos: string[][] = [];
      const re = /\[([^\]]*)\]|([^\s\[\]]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(limpio))) grupos.push(m[1] != null ? m[1].split(/\s+/).filter(Boolean) : [m[2]!]);
      if (grupos.length < 3) return { error: 'dispositivo XSPICE incompleto' };
      const modelo = grupos[grupos.length - 1]![0]!;
      const puertos = grupos.slice(1, -1).filter((g) => !(g.length === 1 && g[0]!.includes('=')));
      const mod = modelos.get(modelo.toLowerCase());
      const tipo = (mod?.tipo ?? modelo).toLowerCase();
      const g = puerta(tipo);
      const FF: Record<string, string[]> = {
        d_dff: ['D', 'C', 'S', 'R', 'Q', 'nQ'],
        d_tff: ['T', 'C', 'S', 'R', 'Q', 'nQ'],
        d_jkff: ['J', 'K', 'C', 'S', 'R', 'Q', 'nQ'],
        d_srff: ['S', 'R', 'C', 'S', 'R', 'Q', 'nQ'],
        d_dlatch: ['D', 'E', 'S', 'R', 'Q', 'nQ'],
      };
      const pines: Pin[] = [];
      let k = 0;
      puertos.forEach((grupo, gi) => {
        grupo.forEach((n, j) => {
          const i = k++;
          let rotulo = String(i + 1);
          if (FF[tipo]) rotulo = FF[tipo]![i] ?? rotulo;
          else if (/bridge/.test(tipo)) rotulo = gi === 0 ? `in${grupo.length > 1 ? j + 1 : ''}` : `out${grupo.length > 1 ? j + 1 : ''}`;
          else if (g) rotulo = gi === puertos.length - 1 ? 'out' : `in${i + 1}`;
          if (/^null$/i.test(n)) return;
          pines.push({ nombre: `p${i + 1}`, nodo: n.toLowerCase(), rotulo, indice: i });
        });
      });
      if (!pines.length) return { error: 'dispositivo XSPICE sin conexiones' };
      return nuevo(l, t, {
        simbolo: g ? 'PUERTA' : 'CAJA',
        rol: 'X',
        clase: g ? 'Gate' : 'Ic',
        pines,
        modelo,
        titulo: g ?? (FF[tipo] ? tipo.replace(/^d_/, '').toUpperCase() : tipo.replace(/_bridge$/, '').toUpperCase()),
        extra: mod ? modelo : '',
      });
    }
    case 'K':
      return { error: 'acoplamiento' };
    default: {
      // Unknown letter (P, N, Y…): a box with every token that is not a value.
      const nodos = t.slice(1, -1).filter((x) => !x.includes('='));
      if (nodos.length < 2) return { error: `elemento «${k}» no reconocido` };
      return nuevo(l, t, {
        simbolo: 'CAJA',
        rol: 'X',
        clase: 'Ic',
        pines: nodos.map((n, i) => ({ nombre: `p${i + 1}`, nodo: n.toLowerCase(), rotulo: String(i + 1) })),
        modelo: t[t.length - 1] ?? null,
        titulo: t[t.length - 1] ?? k,
      });
    }
  }
}

// ------------------------------------------------------------------ circuit

export interface OpcionesModelo {
  /** Draw the body of this .subckt instead of the main circuit. */
  subckt?: string | null;
}

export function leerCircuito(texto: string, opciones: OpcionesModelo = {}): Circuito {
  const limpio = texto.replace(/^﻿/, '');
  const { lineas, subckts: cab } = lineasNetlist(limpio);
  const modelos = leerModelos(lineas);
  const subckts = leerSubckts(cab);
  const objetivo = opciones.subckt ? opciones.subckt.toLowerCase() : null;
  const dispositivos: Dispositivo[] = [];
  const ignoradas: Circuito['ignoradas'] = [];
  const acoples: { nombre: string; bobinas: string[]; k: string; linea: number }[] = [];
  const fisicas = limpio.replace(/\r\n?/g, '\n').split('\n');

  for (const l of lineas) {
    if (l.subckt !== objetivo) continue;
    const t0 = l.tokens[0] ?? '';
    if (!t0 || t0.startsWith('.')) continue;
    if (/^k/i.test(t0)) {
      const t = trocear(l.texto);
      const bob = t.slice(1, -1).filter((x) => /^l/i.test(x));
      if (bob.length >= 2) acoples.push({ nombre: t[0]!, bobinas: bob.map((b) => b.toLowerCase()), k: t[t.length - 1] ?? '', linea: l.linea });
      else ignoradas.push({ linea: l.linea, texto: l.texto, motivo: 'acoplamiento incompleto' });
      continue;
    }
    const d = leerDispositivo(l, modelos, subckts);
    if ('error' in d) ignoradas.push({ linea: l.linea, texto: l.texto, motivo: d.error });
    else dispositivos.push(d);
  }
  void fisicas;

  // Coupled inductors → one transformer block; the inductors stay as its coils.
  if (acoples.length) {
    const grupo = new Map<string, string>();
    const raiz = (x: string): string => {
      let r = x;
      while (grupo.get(r) && grupo.get(r) !== r) r = grupo.get(r)!;
      return r;
    };
    for (const a of acoples) for (const b of a.bobinas) if (!grupo.has(b)) grupo.set(b, b);
    for (const a of acoples) for (const b of a.bobinas.slice(1)) {
      const ra = raiz(a.bobinas[0]!);
      const rb = raiz(b);
      if (ra !== rb) grupo.set(rb, ra);
    }
    const porRaiz = new Map<string, string[]>();
    for (const b of grupo.keys()) {
      const r = raiz(b);
      if (!porRaiz.has(r)) porRaiz.set(r, []);
      porRaiz.get(r)!.push(b);
    }
    for (const [r, miembros] of porRaiz) {
      const bobinas = dispositivos.filter((d) => d.letra === 'L' && miembros.includes(d.clave));
      if (bobinas.length < 2) continue;
      // Primary: the first inductor named in the first K line of the group.
      const k = acoples.find((a) => a.bobinas.some((b) => raiz(b) === r))!;
      bobinas.sort((a, b) => (a.clave === k.bobinas[0] ? -1 : b.clave === k.bobinas[0] ? 1 : a.linea - b.linea));
      const nombresK = acoples.filter((a) => a.bobinas.some((b) => raiz(b) === r));
      const kv = numeroSpice(k.k);
      const pines: Pin[] = [];
      bobinas.forEach((b, i) => {
        pines.push({ nombre: `${b.clave}.start`, nodo: b.pines[0]!.nodo });
        pines.push({ nombre: `${b.clave}.end`, nodo: b.pines[1]!.nodo });
        void i;
      });
      const idx = dispositivos.indexOf(bobinas[0]!);
      const trafo: Dispositivo = {
        nombre: nombresK.map((a) => a.nombre).join(', '),
        clave: nombresK[0]!.nombre.toLowerCase(),
        letra: 'K',
        simbolo: 'TRAFO',
        rol: 'K',
        clase: 'Transformer',
        pines,
        valor: kv !== null ? `k = ${formatoCorto(kv, '')}` : k.k,
        extra: '',
        numero: kv,
        unidad: '',
        modelo: null,
        linea: k.linea,
        bobinas,
      };
      for (const b of bobinas) dispositivos.splice(dispositivos.indexOf(b), 1);
      dispositivos.splice(Math.min(idx, dispositivos.length), 0, trafo);
    }
  }

  agruparPuentes(dispositivos);

  // Nets in order of appearance, and the number of pins on each.
  const nodos: string[] = [];
  const cuenta = new Map<string, number>();
  for (const d of dispositivos)
    for (const p of d.pines) {
      if (esTierra(p.nodo)) continue;
      if (!cuenta.has(p.nodo)) nodos.push(p.nodo);
      cuenta.set(p.nodo, (cuenta.get(p.nodo) ?? 0) + 1);
    }

  // Supply rails: a DC voltage source from a net to ground whose net is named like a supply, or feeds
  // three or more other pins. Inside a subcircuit body, ports are never rails.
  const puertos = objetivo ? (subckts.get(objetivo)?.puertos ?? []).filter((p) => !esTierra(p)) : [];
  const rieles = new Map<string, Riel>();
  const fuentesRiel: Dispositivo[] = [];
  for (const d of dispositivos) {
    if (d.letra !== 'V' || d.simbolo !== 'VDC') continue;
    const [neg, pos] = [d.pines[0]!.nodo, d.pines[1]!.nodo];
    let nodo: string | null = null;
    let signo: 1 | -1 = 1;
    if (esTierra(neg) && !esTierra(pos)) nodo = pos;
    else if (esTierra(pos) && !esTierra(neg)) {
      nodo = neg;
      signo = -1;
    }
    if (!nodo || rieles.has(nodo) || puertos.includes(nodo)) continue;
    const otros = (cuenta.get(nodo) ?? 0) - 1;
    const porNombre = RE_RIEL.test(nodo);
    if (!porNombre && otros < 3) continue;
    if (otros < 1) continue;
    if (d.numero !== null && d.numero < 0) signo = signo === 1 ? -1 : 1;
    else if (d.numero === null && RE_NEG.test(nodo)) signo = -1;
    rieles.set(nodo, { nodo, signo, fuente: d, html: htmlRiel(nodo), texto: textoRiel(nodo) });
    fuentesRiel.push(d);
  }
  const resto = dispositivos.filter((d) => !fuentesRiel.includes(d));

  // Op-amp supply pins on a rail are drawn as rail stubs; other hidden pins are only listed.
  const titulo = (fisicas[0] ?? '').replace(/^\*\s*/, '').trim();
  return {
    titulo,
    dispositivos: resto,
    fuentesRiel,
    rieles,
    modelos,
    subckts,
    nodos,
    ignoradas,
    subckt: objetivo,
    puertos,
  };
}

/** Names of the subcircuits defined in a netlist with their ports (for «ver el interior»). */
export function subcircuitosDe(texto: string): Subcircuito[] {
  return [...leerSubckts(lineasNetlist(texto).subckts).values()];
}

/**
 * Four diodes forming a full-wave bridge (two cathodes on p, two anodes on n, the other ends on the AC nets
 * a and b) are drawn together as the classic diamond.
 */
function agruparPuentes(ds: Dispositivo[]): void {
  for (;;) {
    const diodos = ds.filter((d) => d.letra === 'D' && d.simbolo !== 'PUENTE');
    let hecho = false;
    for (const p of new Set(diodos.map((d) => d.pines[1]!.nodo))) {
      const aP = diodos.filter((d) => d.pines[1]!.nodo === p);
      for (let i = 0; i < aP.length && !hecho; i++)
        for (let j = i + 1; j < aP.length && !hecho; j++) {
          const d1 = aP[i]!;
          const d2 = aP[j]!;
          const a = d1.pines[0]!.nodo;
          const b = d2.pines[0]!.nodo;
          if (a === b || a === p || b === p) continue;
          const d3s = diodos.filter((d) => d.pines[1]!.nodo === a && d !== d1 && d !== d2);
          for (const d3 of d3s) {
            const n = d3.pines[0]!.nodo;
            if (n === p || n === a || n === b) continue;
            const d4 = diodos.find((d) => d.pines[1]!.nodo === b && d.pines[0]!.nodo === n && d !== d1 && d !== d2 && d !== d3);
            if (!d4) continue;
            const puente: Dispositivo = {
              nombre: [d1, d2, d3, d4].map((d) => d.nombre).join(', '),
              clave: `puente:${d1.clave}`,
              letra: 'D',
              simbolo: 'PUENTE',
              rol: 'PUENTE',
              clase: 'Bridge',
              pines: [
                { nombre: 'a', nodo: a },
                { nombre: 'b', nodo: b },
                { nombre: 'p', nodo: p },
                { nombre: 'n', nodo: n },
              ],
              valor: '',
              extra: '',
              numero: null,
              unidad: '',
              modelo: d1.modelo,
              linea: d1.linea,
              diodos: [
                { d: d1, anodo: 'a', catodo: 'p' },
                { d: d2, anodo: 'b', catodo: 'p' },
                { d: d3, anodo: 'n', catodo: 'a' },
                { d: d4, anodo: 'n', catodo: 'b' },
              ],
            };
            const idx = Math.min(...[d1, d2, d3, d4].map((d) => ds.indexOf(d)));
            for (const d of [d1, d2, d3, d4]) ds.splice(ds.indexOf(d), 1);
            ds.splice(Math.min(idx, ds.length), 0, puente);
            hecho = true;
            break;
          }
        }
      if (hecho) break;
    }
    if (!hecho) return;
  }
}
