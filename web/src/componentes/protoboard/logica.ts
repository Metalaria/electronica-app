// Logic on the breadboard: the gates and flip-flops of a circuit packed into real 74HC chips.
//
// Where they come from: the editor's digital parts (AND…NOT, D and JK flip-flops), the XSPICE «A» lines of
// the book's netlists (d_and, d_nand, d_or, d_nor, d_xor, d_inverter, d_dff, d_jkff, d_tff), read here from
// the directives where the editor's importer leaves them, and the subcircuits of the book's analog twins
// (AND2, AND3, INV, NAND2, NOR8, OR2, TFF, XOR2…). Their netlist lines never change: a chip is only where
// they sit. Gates of one kind fill chips in order (74HC00 NAND, 02 NOR, 04 NOT, 08 AND, 10 NAND3, 11 AND3,
// 20 NAND4, 21 AND4, 27 NOR3, 30 NAND8, 32 OR, 86 XOR, 4078 NOR8/OR8; 74HC74 D, 74HC112 JK). A T flip-flop is
// half a 74HC74 plus an XOR of a 74HC86 wired D = T ⊕ Q (rising edge, as the book's d_tff): the netlist keeps its
// single d_tff line (owned by the 74HC74 piece), T is a leg of the XOR, and the wires XOR → D and Q → XOR are
// board-only ties, as the ones to the rails. VCC and GND go to the rails; the inputs of the gates not used, and the inputs a gate with
// fewer inputs leaves over, are tied to a rail; PRE and CLR of a flip-flop the circuit does not use go to VCC
// (they are active low on the chip). Those ties are wires of the board only, not part of the netlist.
// What has no real chip (ADC/DAC bridges, the digital clock, XOR of three inputs…) stays a module.

import type { Componente, FormaImportada } from '../editor/tipos.ts';

// ------------------------------------------------------------------ XSPICE lines of the directives

const PUERTA_XSPICE: Record<string, string> = { d_and: 'AND', d_nand: 'NAND', d_or: 'OR', d_nor: 'NOR', d_xor: 'XOR', d_xnor: 'XNOR', d_inverter: 'NOT', d_buffer: 'BUF' };
const BIESTABLE_XSPICE: Record<string, { titulo: string; pines: string[] }> = {
  d_dff: { titulo: 'DFF', pines: ['d', 'clk', 'set', 'reset', 'q', 'nq'] },
  d_jkff: { titulo: 'JKFF', pines: ['j', 'k', 'clk', 'set', 'reset', 'q', 'nq'] },
  d_tff: { titulo: 'TFF', pines: ['t', 'clk', 'set', 'reset', 'q', 'nq'] },
  d_srff: { titulo: 'SRFF', pines: ['s', 'r', 'clk', 'set', 'reset', 'q', 'nq'] },
};
const ROTULO: Record<string, string> = { d: 'D', j: 'J', k: 'K', t: 'T', s: 'S', r: 'R', clk: 'C', set: 'S', reset: 'R', q: 'Q', nq: 'nQ' };

/** Ports of an XSPICE instance: each a node or a vector of nodes («[a b]»), as written. */
function puertos(t: string): string[][] {
  const res: string[][] = [];
  const re = /\[([^\]]*)\]|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) res.push(m[1] != null ? m[1].trim().split(/\s+/).filter(Boolean) : [m[2]!]);
  return res;
}

/**
 * Takes the top-level XSPICE «A» lines out of the directives as parts (kind GEN, letter A, with their line as a
 * template), with the net of each pin. Returns the directives without them.
 */
export function partesXspice(directivas: string, primerId: number): { componentes: Componente[]; redes: Record<string, string>; directivas: string } {
  const lineas = directivas.replace(/\r\n?/g, '\n').split('\n');
  const modelos = new Map<string, string>();
  for (const l of lineas) {
    const m = /^\s*\.model\s+(\S+)\s+([a-z_]+)/i.exec(l);
    if (m) modelos.set(m[1]!.toLowerCase(), m[2]!.toLowerCase());
  }
  const componentes: Componente[] = [];
  const redes: Record<string, string> = {};
  const quedan: string[] = [];
  let enSub = 0;
  let enControl = false;
  let k = primerId;
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i]!;
    const s = l.trim().toLowerCase();
    if (s.startsWith('.subckt')) enSub++;
    if (s.startsWith('.ends')) enSub = Math.max(0, enSub - 1);
    if (s.startsWith('.control')) enControl = true;
    if (s.startsWith('.endc')) enControl = false;
    if (enSub || enControl || !/^\s*a\S*\s/i.test(l)) {
      quedan.push(l);
      continue;
    }
    let texto = l.replace(/;.*$/, '').trim();
    while (i + 1 < lineas.length && /^\s*\+/.test(lineas[i + 1]!)) texto += ' ' + lineas[++i]!.replace(/^\s*\+/, '').trim();
    const toks = texto.split(/\s+/);
    const nombre = toks[0]!;
    const modelo = toks[toks.length - 1]!;
    const tipoModelo = modelos.get(modelo.toLowerCase()) ?? '';
    const cuerpo = texto.slice(nombre.length, texto.length - modelo.length).trim();
    const ps = puertos(cuerpo);
    // Pin names by the code model.
    const nombresPines: string[][] = [];
    const puerta = PUERTA_XSPICE[tipoModelo];
    const biest = BIESTABLE_XSPICE[tipoModelo];
    if (puerta && ps.length === 2) {
      nombresPines.push(ps[0]!.map((_, j) => `i${j}`), ['y']);
    } else if (biest && ps.length === biest.pines.length) {
      for (const p of biest.pines) nombresPines.push([p]);
    } else {
      // Bridges and anything else: inputs of the first port, outputs of the second, or p1…pn.
      if (ps.length === 2 && /bridge/.test(tipoModelo)) nombresPines.push(ps[0]!.map((_, j) => `in${j}`), ps[1]!.map((_, j) => `out${j}`));
      else {
        let n = 0;
        for (const p of ps) nombresPines.push(p.map(() => `p${++n}`));
      }
    }
    // The template: every node replaced by {index}; NULL stays.
    const nodos: string[] = [];
    const pines: Record<string, number> = {};
    const formaPines: FormaImportada['pines'] = [];
    const partes = ps.map((p, j) =>
      p.map((nodo, q) => {
        if (/^null$/i.test(nodo)) return nodo;
        const pin = nombresPines[j]?.[q] ?? `p${j}_${q}`;
        if (pin in pines) return `{${pines[pin]}}`;
        pines[pin] = nodos.length;
        nodos.push(nodo.toLowerCase());
        formaPines.push({ nombre: pin, rotulo: ROTULO[pin] ?? pin });
        return `{${nodos.length - 1}}`;
      }),
    );
    // Brackets as written: a vector port keeps its brackets even with one node.
    const conCorchetes = puertosConCorchetes(cuerpo);
    const plantilla = `${nombre} ${partes.map((p, j) => (conCorchetes[j] ? `[${p.join(' ')}]` : p[0]!)).join(' ')} ${modelo}`;
    const titulo = puerta ?? biest?.titulo ?? (/adc/.test(tipoModelo) ? 'ADC' : /dac/.test(tipoModelo) ? 'DAC' : tipoModelo.replace(/^d_/, '').toUpperCase() || 'A');
    const forma: FormaImportada = puerta && puerta !== 'BUF' && puerta !== 'XNOR' ? { simbolo: 'PUERTA', pines: formaPines, titulo } : { simbolo: 'CAJA', pines: formaPines, titulo };
    const c: Componente = {
      id: `ax${++k}`,
      tipo: 'GEN',
      nombre,
      x: componentes.length * 4,
      y: 0,
      o: 0,
      campos: { resto: modelo },
      spice: { letra: 'A', nodos, pines, resto: modelo, plantilla },
      forma,
    };
    componentes.push(c);
    for (const [pin, idx] of Object.entries(pines)) redes[`${c.id}.${pin}`] = nodos[idx] === 'gnd' ? '0' : nodos[idx]!;
  }
  return { componentes, redes, directivas: quedan.join('\n') };
}

function puertosConCorchetes(cuerpo: string): boolean[] {
  const res: boolean[] = [];
  const re = /\[([^\]]*)\]|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cuerpo))) res.push(m[1] != null);
  return res;
}

// ------------------------------------------------------------------ what each part is

export type Familia = 'AND' | 'NAND' | 'OR' | 'NOR' | 'XOR' | 'NOT' | 'DFF' | 'JK' | 'TFF';

export interface Logica {
  familia: Familia;
  /** Gates: input pins in order and the output pin. */
  entradas?: string[];
  salida?: string;
  /** Flip-flops: role (d, j, k, t, clk, set, reset, q, nq) → pin. */
  roles?: Record<string, string>;
}

const PUERTA_EDITOR: Record<string, Familia> = { DAND: 'AND', DOR: 'OR', DNAND: 'NAND', DNOR: 'NOR', DXOR: 'XOR', DNOT: 'NOT' };

/** The logic function of a part, when a 74HC chip can hold it. */
export function logicaDe(c: Componente): Logica | null {
  const fe = PUERTA_EDITOR[c.tipo];
  if (fe) return fe === 'NOT' ? { familia: 'NOT', entradas: ['a'], salida: 'y' } : { familia: fe, entradas: ['a', 'b'], salida: 'y' };
  if (c.tipo === 'DFF') return { familia: 'DFF', roles: { d: 'd', clk: 'clk', set: 'set', reset: 'reset', q: 'q', nq: 'nq' } };
  if (c.tipo === 'DJK') return { familia: 'JK', roles: { j: 'j', k: 'k', clk: 'clk', set: 'set', reset: 'reset', q: 'q', nq: 'nq' } };
  if (c.tipo !== 'GEN' || !c.forma) return null;
  const pines = c.forma.pines;
  if (c.spice?.letra === 'A') {
    const t = c.forma.titulo ?? '';
    if (['AND', 'NAND', 'OR', 'NOR', 'XOR', 'NOT'].includes(t)) {
      const entradas = pines.filter((p) => /^i\d+$/.test(p.nombre)).map((p) => p.nombre);
      if (!pines.some((p) => p.nombre === 'y')) return null;
      return { familia: t as Familia, entradas, salida: 'y' };
    }
    const ff: Record<string, Familia> = { DFF: 'DFF', JKFF: 'JK', TFF: 'TFF' };
    if (ff[t]) {
      const roles: Record<string, string> = {};
      for (const p of pines) roles[p.nombre] = p.nombre;
      return { familia: ff[t]!, roles };
    }
    return null;
  }
  if (c.spice?.letra === 'X') {
    // The analog twins of the book: subcircuits named like the gate («NAND2», «AND3», «INV», «TFF»).
    const sub = (c.spice.resto.split(/\s+/)[0] ?? '').toUpperCase();
    const rot = pines.map((p) => (p.rotulo ?? '').toLowerCase());
    const m = /^(NAND|AND|NOR|OR|XOR)(\d)$/.exec(sub);
    if (m && rot[rot.length - 1] === 'y' && rot.length === Number(m[2]) + 1)
      return { familia: m[1] as Familia, entradas: pines.slice(0, -1).map((p) => p.nombre), salida: pines[pines.length - 1]!.nombre };
    if (/^(INV|NOT)$/.test(sub) && pines.length === 2) return { familia: 'NOT', entradas: [pines[0]!.nombre], salida: pines[1]!.nombre };
    if (sub === 'TFF' && rot.join(' ') === 't clk q nq') return { familia: 'TFF', roles: { t: pines[0]!.nombre, clk: pines[1]!.nombre, q: pines[2]!.nombre, nq: pines[3]!.nombre } };
  }
  return null;
}

// ------------------------------------------------------------------ the chips

interface ChipPuertas {
  modelo: string;
  familia: Familia;
  entradas: number;
  patas: number;
  /** Each gate: its input pins then its output pin (1-based). */
  puertas: number[][];
  vcc: number;
  gnd: number;
  descripcion: string;
}

interface ChipBiestables {
  modelo: string;
  familias: Familia[];
  patas: number;
  /** Each flip-flop: role → pin (1-based). */
  biestables: Record<string, number>[];
  vcc: number;
  gnd: number;
  descripcion: string;
}

const C4 = [[1, 2, 3], [4, 5, 6], [9, 10, 8], [12, 13, 11]];
const C3 = [[1, 2, 13, 12], [3, 4, 5, 6], [9, 10, 11, 8]];
const C2x4 = [[1, 2, 4, 5, 6], [9, 10, 12, 13, 8]];

export const CHIPS_PUERTAS: ChipPuertas[] = [
  { modelo: '74HC00', familia: 'NAND', entradas: 2, patas: 14, puertas: C4, vcc: 14, gnd: 7, descripcion: 'cuatro puertas NAND de dos entradas' },
  { modelo: '74HC02', familia: 'NOR', entradas: 2, patas: 14, puertas: [[2, 3, 1], [5, 6, 4], [8, 9, 10], [11, 12, 13]], vcc: 14, gnd: 7, descripcion: 'cuatro puertas NOR de dos entradas (la salida va primero)' },
  { modelo: '74HC04', familia: 'NOT', entradas: 1, patas: 14, puertas: [[1, 2], [3, 4], [5, 6], [9, 8], [11, 10], [13, 12]], vcc: 14, gnd: 7, descripcion: 'seis inversores' },
  { modelo: '74HC08', familia: 'AND', entradas: 2, patas: 14, puertas: C4, vcc: 14, gnd: 7, descripcion: 'cuatro puertas AND de dos entradas' },
  { modelo: '74HC10', familia: 'NAND', entradas: 3, patas: 14, puertas: C3, vcc: 14, gnd: 7, descripcion: 'tres puertas NAND de tres entradas' },
  { modelo: '74HC11', familia: 'AND', entradas: 3, patas: 14, puertas: C3, vcc: 14, gnd: 7, descripcion: 'tres puertas AND de tres entradas' },
  { modelo: '74HC20', familia: 'NAND', entradas: 4, patas: 14, puertas: C2x4, vcc: 14, gnd: 7, descripcion: 'dos puertas NAND de cuatro entradas (patillas 3 y 11 sin conectar)' },
  { modelo: '74HC21', familia: 'AND', entradas: 4, patas: 14, puertas: C2x4, vcc: 14, gnd: 7, descripcion: 'dos puertas AND de cuatro entradas (patillas 3 y 11 sin conectar)' },
  { modelo: '74HC27', familia: 'NOR', entradas: 3, patas: 14, puertas: C3, vcc: 14, gnd: 7, descripcion: 'tres puertas NOR de tres entradas' },
  { modelo: '74HC30', familia: 'NAND', entradas: 8, patas: 14, puertas: [[1, 2, 3, 4, 5, 6, 11, 12, 8]], vcc: 14, gnd: 7, descripcion: 'una puerta NAND de ocho entradas' },
  { modelo: '74HC32', familia: 'OR', entradas: 2, patas: 14, puertas: C4, vcc: 14, gnd: 7, descripcion: 'cuatro puertas OR de dos entradas' },
  { modelo: '74HC86', familia: 'XOR', entradas: 2, patas: 14, puertas: C4, vcc: 14, gnd: 7, descripcion: 'cuatro puertas XOR de dos entradas' },
  // 74HC4078 (as the CD4078B): inputs A–D on 2–5 and E–H on 9–12, OR output on 1, NOR output on 13, 6 and 8 NC.
  { modelo: '74HC4078', familia: 'NOR', entradas: 8, patas: 14, puertas: [[2, 3, 4, 5, 9, 10, 11, 12, 13]], vcc: 14, gnd: 7, descripcion: 'una puerta NOR/OR de ocho entradas (OR en la 1, NOR en la 13)' },
  { modelo: '74HC4078', familia: 'OR', entradas: 8, patas: 14, puertas: [[2, 3, 4, 5, 9, 10, 11, 12, 1]], vcc: 14, gnd: 7, descripcion: 'una puerta NOR/OR de ocho entradas (OR en la 1, NOR en la 13)' },
];

export const CHIPS_BIESTABLES: ChipBiestables[] = [
  {
    modelo: '74HC74',
    familias: ['DFF'],
    patas: 14,
    biestables: [
      { reset: 1, d: 2, clk: 3, set: 4, q: 5, nq: 6 },
      { nq: 8, q: 9, set: 10, clk: 11, d: 12, reset: 13 },
    ],
    vcc: 14,
    gnd: 7,
    descripcion: 'dos biestables D por flanco de subida; PRE y CLR (S y R) son activas a nivel bajo en el chip; un biestable T es uno de ellos con una XOR de un 74HC86: D = T ⊕ Q',
  },
  {
    modelo: '74HC112',
    familias: ['JK'],
    patas: 16,
    biestables: [
      { clk: 1, k: 2, j: 3, set: 4, q: 5, nq: 6, reset: 15 },
      { nq: 7, q: 9, set: 10, j: 11, k: 12, clk: 13, reset: 14 },
    ],
    vcc: 16,
    gnd: 8,
    descripcion: 'dos biestables JK; el chip cambia en el flanco de bajada y PRE y CLR son activas a nivel bajo',
  },
];

/**
 * A tie of a leg that is not in the netlist: to a supply rail, to the net of another leg of the chip, to the net
 * of a pin («compId.pin»: Q of a T flip-flop into its XOR), or to a net of the board only, shared with a leg of
 * another chip («interna»: «tffId:d», the XOR's output into D).
 */
export type Atadura = '+' | '-' | { igual: number } | { pin: string } | { interna: string };

export interface ChipMontado {
  comp: Componente;
  /** Parts in the netlist that this chip holds (a T flip-flop belongs to its 74HC74, not to its XOR's chip). */
  comps: Componente[];
  /** Per leg: «compId|pin» of the part using it, or null. */
  patas: (string | null)[];
  ataduras: Record<number, Atadura>;
  /** Per leg: vcc, gnd, in, out, nc. */
  roles: string[];
  modelo: string;
}

export const tieneChip = (c: Componente): boolean => {
  const l = logicaDe(c);
  if (!l) return false;
  if (l.entradas) return !!elegirChip(l.familia, l.entradas.length);
  return true;
};

function elegirChip(familia: Familia, entradas: number): ChipPuertas | null {
  const xs = CHIPS_PUERTAS.filter((c) => c.familia === familia && c.entradas >= entradas && (familia !== 'XOR' || c.entradas === entradas)).sort((a, b) => a.entradas - b.entradas);
  return xs[0] ?? null;
}

/** The key that groups parts into one kind of chip. */
function claveChip(l: Logica): string | null {
  if (l.entradas) {
    const c = elegirChip(l.familia, l.entradas.length);
    return c ? `${c.modelo}|${c.familia}|${c.entradas}` : null;
  }
  return l.familia === 'DFF' ? '74HC74' : l.familia === 'JK' ? '74HC112' : null;
}

/** A pin of a slot that is a board-only node of a T flip-flop: «#d» (XOR output = D) or «#q» (Q into the XOR). */
const INTERNO = /^#(d|q)$/;

/**
 * Packs the parts that a 74HC chip can hold, in the given order; returns the chips and the parts left.
 * `conectado` says whether a pin is wired in the circuit: the asynchronous set and reset of a flip-flop
 * only take their legs when they are (XSPICE's are active high, the chip's PRE and CLR active low: left
 * alone, those legs are tied to Vcc, inactive, as on a real board).
 */
export function empaquetar(comps: Componente[], nuevoId: () => string, conectado: (id: string, pin: string) => boolean = () => false): { chips: ChipMontado[]; resto: Componente[] } {
  /** A slot of a chip: a gate or a flip-flop of a part; `propio` when the chip holds the part itself. */
  interface Hueco {
    c: Componente;
    l: Logica;
    propio: boolean;
  }
  const grupos = new Map<string, Hueco[]>();
  const resto: Componente[] = [];
  const poner = (k: string, h: Hueco) => (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(h);
  const tffs: { c: Componente; r: Record<string, string> }[] = [];
  for (const c of comps) {
    const l = logicaDe(c);
    if (l?.familia === 'TFF' && l.roles?.['t'] && l.roles['clk'] && l.roles['q']) {
      // A T flip-flop: its D flip-flop now, its XOR after the circuit's own XORs.
      const r = l.roles;
      poner('74HC74', { c, propio: true, l: { familia: 'DFF', roles: { d: '#d', clk: r['clk']!, q: r['q']!, ...(r['nq'] ? { nq: r['nq'] } : {}) } } });
      tffs.push({ c, r });
      continue;
    }
    const k = l ? claveChip(l) : null;
    if (!l || !k) {
      resto.push(c);
      continue;
    }
    poner(k, { c, l, propio: true });
  }
  const xor = CHIPS_PUERTAS.find((x) => x.modelo === '74HC86')!;
  for (const { c, r } of tffs) poner(`${xor.modelo}|${xor.familia}|${xor.entradas}`, { c, propio: false, l: { familia: 'XOR', entradas: [r['t']!, '#q'], salida: '#d' } });

  const chips: ChipMontado[] = [];
  let n = 0;
  for (const [k, lista] of grupos) {
    const puertas = lista[0]!.l.entradas ? CHIPS_PUERTAS.find((x) => `${x.modelo}|${x.familia}|${x.entradas}` === k)! : null;
    const biest = puertas ? null : CHIPS_BIESTABLES.find((x) => x.modelo === k)!;
    const porChip = puertas ? puertas.puertas.length : biest!.biestables.length;
    for (let i = 0; i < lista.length; i += porChip) {
      const grupo = lista.slice(i, i + porChip);
      const total = puertas ? puertas.patas : biest!.patas;
      const patas: (string | null)[] = Array.from({ length: total }, () => null);
      const roles: string[] = Array.from({ length: total }, () => 'nc');
      const ataduras: Record<number, Atadura> = {};
      const vcc = (puertas ?? biest)!.vcc - 1;
      const gnd = (puertas ?? biest)!.gnd - 1;
      roles[vcc] = 'vcc';
      roles[gnd] = 'gnd';
      ataduras[vcc] = '+';
      ataduras[gnd] = '-';
      /** A leg for a pin of a slot: the part's pin, or the tie of a T flip-flop's board-only node. */
      const asignar = (i0: number, h: Hueco, pin: string) => {
        const m = INTERNO.exec(pin);
        if (!m) patas[i0] = `${h.c.id}|${pin}`;
        else if (m[1] === 'd') ataduras[i0] = { interna: `${h.c.id}:d` };
        else ataduras[i0] = { pin: `${h.c.id}.${logicaDe(h.c)!.roles!['q']}` };
      };
      if (puertas) {
        const f = puertas.familia;
        // A spare input of a gate holds its neutral level: 1 for AND/NAND, 0 for OR/NOR.
        const neutro: Atadura = f === 'AND' || f === 'NAND' ? '+' : '-';
        puertas.puertas.forEach((pp, g) => {
          const usado = grupo[g];
          const ins = pp.slice(0, -1);
          const out = pp[pp.length - 1]! - 1;
          roles[out] = 'out';
          ins.forEach((pin, j) => {
            roles[pin - 1] = 'in';
            if (!usado) ataduras[pin - 1] = '-';
            else if (j < usado.l.entradas!.length) asignar(pin - 1, usado, usado.l.entradas![j]!);
            else ataduras[pin - 1] = neutro;
          });
          if (usado) asignar(out, usado, usado.l.salida!);
        });
      } else {
        biest!.biestables.forEach((mapa, g) => {
          const usado = grupo[g];
          for (const [rol, pin] of Object.entries(mapa)) {
            const i0 = pin - 1;
            roles[i0] = rol === 'q' || rol === 'nq' ? 'out' : 'in';
            if (!usado) {
              if (roles[i0] === 'in') ataduras[i0] = rol === 'set' || rol === 'reset' ? '+' : '-';
              continue;
            }
            let pinComp = usado.l.roles![rol];
            if (pinComp && (rol === 'set' || rol === 'reset') && !conectado(usado.c.id, pinComp)) pinComp = undefined;
            if (pinComp) asignar(i0, usado, pinComp);
            else if (roles[i0] === 'in') ataduras[i0] = rol === 'set' || rol === 'reset' ? '+' : '-';
          }
        });
      }
      const modelo = (puertas ?? biest)!.modelo;
      const comp: Componente = { id: nuevoId(), tipo: 'CHIP', nombre: `CI${++n}`, x: grupo[0]!.c.x, y: grupo[0]!.c.y, o: 0, campos: { modelo } };
      chips.push({ comp, comps: grupo.filter((x) => x.propio).map((x) => x.c), patas, ataduras, roles, modelo });
    }
  }
  return { chips, resto };
}

/** Description of a chip by its part number. */
export function descripcionChip(modelo: string): string {
  const c = CHIPS_PUERTAS.find((x) => x.modelo === modelo) ?? CHIPS_BIESTABLES.find((x) => x.modelo === modelo);
  return c ? `${modelo}: ${c.descripcion}` : modelo;
}

/** Number of legs of a chip by its part number. */
export function patasChip(modelo: string): number {
  return (CHIPS_PUERTAS.find((x) => x.modelo === modelo) ?? CHIPS_BIESTABLES.find((x) => x.modelo === modelo))?.patas ?? 14;
}

/** What each leg of a chip piece is, for its pinout list («U1 A», «Vcc», «libre → +», «NC»). */
export function rotulosChip(p: { patas: (string | null)[]; chip?: { comps: Componente[]; roles: string[]; ataduras: Record<number, Atadura> } }, otros: Componente[] = []): string[] {
  const ch = p.chip;
  if (!ch) return [];
  const porId = new Map([...otros, ...ch.comps].map((c) => [c.id, c]));
  const nombre = (id: string) => porId.get(id)?.nombre ?? '?';
  return ch.roles.map((rol, i) => {
    const pin = p.patas[i];
    if (pin) {
      const [id, pn] = pin.split('|') as [string, string];
      const c = porId.get(id);
      const r = c?.forma?.pines.find((x) => x.nombre === pn)?.rotulo ?? pn;
      return `${c?.nombre ?? '?'} ${ROTULO_PATA[pn] ?? ROTULO_PATA[r.toLowerCase()] ?? r.toUpperCase()}`;
    }
    if (rol === 'vcc') return 'Vcc';
    if (rol === 'gnd') return 'GND';
    const t = ch.ataduras[i];
    // The board-only nodes of a T flip-flop (D = T ⊕ Q).
    if (t && typeof t === 'object' && 'interna' in t) return rol === 'out' ? `${nombre(t.interna.split(':')[0]!)} → D` : `${nombre(t.interna.split(':')[0]!)} D ← XOR`;
    if (t && typeof t === 'object' && 'pin' in t) return `Q de ${nombre(t.pin.split('.')[0]!)}`;
    if (rol === 'in') return t === '+' ? 'libre → +' : t === '-' ? 'libre → −' : t && 'igual' in t ? `= ${t.igual + 1}` : 'libre';
    return rol === 'out' ? 'libre' : 'NC';
  });
}

const ROTULO_PATA: Record<string, string> = { a: 'A', b: 'B', y: 'Y', d: 'D', j: 'J', k: 'K', t: 'T', clk: 'CLK', set: 'PRE', reset: 'CLR', q: 'Q', nq: 'Q̄', i0: 'A', i1: 'B', i2: 'C', i3: 'D', i4: 'E', i5: 'F', i6: 'G', i7: 'H' };
