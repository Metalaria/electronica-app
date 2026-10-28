// The physical form of each editor part on a breadboard: package, legs and what each leg is (pinout by
// model for transistors and ICs), printed marking, and the body each package occupies (for collisions).
// Plain TypeScript.

import { pinesDe } from '../editor/catalogo.ts';
import { leerValor } from '../editor/valores.ts';
import type { Componente } from '../editor/tipos.ts';
import { descripcionChip, patasChip } from './logica.ts';
import type { Pt } from './placa.ts';
import type { Pieza } from './tipos.ts';

/**
 * How the legs are arranged:
 *  dos      two legs anywhere within a span (axial and radial parts: the legs bend)
 *  fila     n legs in a line, one pitch apart (TO-92, TO-220, trimmer, switch, bridge, module)
 *  dip      a DIP: two rows 3 pitches apart straddling the channel
 *  uno      one leg (probe)
 *  externo  equipment off the board: terminals 3 pitches apart, wired with leads
 */
export type Forma = 'dos' | 'fila' | 'dip' | 'uno' | 'externo';

export interface Encapsulado {
  id: string;
  forma: Forma;
  /** Electrical pin of each leg (editor pin names); null = not connected inside. */
  patas: (string | null)[];
  /** Spanish label of each leg (E, B, C; 1…8; +, −; A, K). */
  nombres: string[];
  /** Two-leg parts: allowed distance between the legs, and the spans the auto-placement tries. */
  span?: [number, number];
  preferidos?: number[];
  /** Marking printed on the body. */
  marca: string;
  /** Electrolytic: physically polarised although its model is not. */
  polar?: boolean;
  /** Ideal op-amps in a DIP: the supply legs the model does not use (leg index → wanted supply). */
  alimentacion?: Record<number, '+' | '-'>;
  /** Short Spanish description of the package (properties panel). */
  descripcion: string;
  /** Two-leg parts the auto-placement keeps in one row (LEDs and electrolytics stand with both legs in a row). */
  enFila?: boolean;
}

const PIN_LETRA: Record<string, string> = { emitter: 'E', base: 'B', collector: 'C', gate: 'G', drain: 'D', source: 'S' };

function valorDe(c: Componente, campo = 'valor', unidad = ''): number | null {
  const l = leerValor(c.campos[campo] ?? '', unidad);
  return l.ok && l.v != null ? l.v : null;
}

/** «Q2N3904» → «2N3904»; a generic name stays as it is. */
function marcaModelo(m: string): string {
  const t = m.trim();
  if (/^q\d/i.test(t)) return t.slice(1).toUpperCase();
  return t.toUpperCase();
}

interface Patillaje {
  enc: 'to92' | 'to220' | 'to126';
  orden: string[];
  generico: boolean;
}

/** Package and pinout of a transistor by its model (legs left to right, flat face or marking towards you). */
export function patillajeTransistor(tipo: string, modelo: string): Patillaje {
  const m = modelo.toLowerCase();
  const E = 'emitter';
  const B = 'base';
  const C = 'collector';
  const G = 'gate';
  const D = 'drain';
  const S = 'source';
  if (tipo === 'QN' || tipo === 'QP') {
    if (/2n(3904|3906|2222|2907|4401|4403|5551|5401|4124|4126)/.test(m) || /^s?90(1[1-8])/.test(m) || /9018/.test(m)) return { enc: 'to92', orden: [E, B, C], generico: false };
    if (/bc(5[4-6]\d|3[23]\d|1[0-8]\d)/.test(m)) return { enc: 'to92', orden: [C, B, E], generico: false };
    if (/bd1[34]\d/.test(m)) return { enc: 'to126', orden: [E, C, B], generico: false };
    if (/tip|2n3055|mj[e\d]|pot|pow|^qp[np]$|darl/.test(m)) return { enc: 'to220', orden: [B, C, E], generico: !/tip/.test(m) };
    return { enc: 'to92', orden: [E, B, C], generico: true };
  }
  if (tipo === 'MN' || tipo === 'MP') {
    if (/bs170/.test(m)) return { enc: 'to92', orden: [D, G, S], generico: false };
    if (/2n7000|2n7002/.test(m)) return { enc: 'to92', orden: [S, G, D], generico: false };
    if (/irf|irl|^nty$|^pty$|pot|pow/.test(m)) return { enc: 'to220', orden: [G, D, S], generico: !/ir[fl]/.test(m) };
    return { enc: 'to92', orden: [S, G, D], generico: true };
  }
  // JFET: J201, 2N5457, MPF102 style
  return { enc: 'to92', orden: [D, S, G], generico: !/j20\d|2n545\d|mpf10\d/.test(m) };
}

/** DIP-8 legs of a single op-amp (TL071 / LM741 pinout): 2 in−, 3 in+, 4 V−, 6 out, 7 V+. */
function dipOperacional(conAlimentacion: boolean, pines: { menos: string; mas: string; out: string; vd?: string; vs?: string }): Pick<Encapsulado, 'patas' | 'alimentacion'> {
  const patas: (string | null)[] = [null, pines.menos, pines.mas, conAlimentacion ? pines.vs! : null, null, pines.out, conAlimentacion ? pines.vd! : null, null];
  return conAlimentacion ? { patas } : { patas, alimentacion: { 3: '-', 6: '+' } };
}

const NOMBRES_DIP8 = ['1', '2', '3', '4', '5', '6', '7', '8'];

function modulo(pines: string[], marca: string, descripcion: string): Encapsulado {
  return { id: 'modulo', forma: 'fila', patas: pines, nombres: pines.map(rotuloPin), marca, descripcion };
}

const ROTULO: Record<string, string> = {
  start: '1',
  end: '2',
  tap: 'cursor',
  p: '+',
  n: '−',
  cp: 'c+',
  cn: 'c−',
  in1: '−',
  in2: '+',
  out: 'sal',
  vd: 'V+',
  vs: 'V−',
  'p.start': 'P1',
  'p.end': 'P2',
  's.start': 'S1',
  's.end': 'S2',
  a: 'A',
  b: 'B',
  y: 'Y',
  clk: 'C',
  set: 'S',
  reset: 'R',
  q: 'Q',
  nq: 'nQ',
  in: 'ent',
};
export function rotuloPin(p: string): string {
  return ROTULO[p] ?? p.replace(/^p(\d+)$/, '$1');
}

/** Is this voltage source a 0 V ammeter (a wire that measures its current)? */
export function esAmperimetro(c: Componente): boolean {
  if (c.tipo === 'AMP') return true;
  const f = c.campos['forma'] ?? 'dc';
  if (c.tipo === 'V' && f === 'dc') {
    const dc = (c.campos['dc'] ?? '').trim();
    return (!dc || valorDe(c, 'dc', 'V') === 0) && !(c.campos['ac'] ?? '').trim();
  }
  if (c.tipo === 'GEN' && c.spice?.letra === 'V') return /^(dc\s+)?0+(\.0*)?\s*$/i.test((c.spice.resto ?? '').trim());
  return false;
}

/** A DC voltage source (bench supply or battery), not a signal generator. */
export function esFuenteContinua(c: Componente): boolean {
  if (esAmperimetro(c)) return false;
  if (c.tipo === 'V') {
    const f = c.campos['forma'] ?? 'dc';
    return f === 'dc' && !(c.campos['ac'] ?? '').trim();
  }
  if (c.tipo === 'GEN' && c.spice?.letra === 'V') {
    const r = (c.spice.resto ?? '').trim();
    return !/\b(sin|pulse|pwl|exp|sffm|am|ac|trrandom|trnoise)\b/i.test(r);
  }
  return false;
}

/** Voltage of a DC source (V), when it is a plain number. */
export function tensionFuente(c: Componente): number | null {
  if (c.tipo === 'V') return valorDe(c, 'dc', 'V');
  if (c.tipo === 'GEN' && c.spice?.letra === 'V') {
    const t = (c.spice.resto ?? '').trim().replace(/^dc\s+/i, '');
    const l = leerValor(t.split(/\s+/)[0] ?? '', 'V');
    return l.ok && l.v != null ? l.v : null;
  }
  return null;
}

/** The package of a part (and its default legs). */
export function encapsuladoDe(c: Componente): Encapsulado {
  const t = c.tipo;
  const dos = (id: string, patas: string[], nombres: string[], span: [number, number], preferidos: number[], marca: string, descripcion: string, polar = false): Encapsulado => ({
    id,
    forma: 'dos',
    patas,
    nombres,
    span,
    preferidos,
    marca,
    descripcion,
    ...(polar ? { polar } : {}),
  });
  const externo = (id: string, patas: string[], nombres: string[], descripcion: string): Encapsulado => ({ id, forma: 'externo', patas, nombres, marca: '', descripcion });

  // Sources and meters: equipment off the board, wired with leads (a 0 V source is an ammeter in a wire).
  if (esAmperimetro(c)) return dos('medida', ['start', 'end'], ['+', '−'], [1, 30], [3, 2, 4], 'A', 'Amperímetro (un cable que mide su corriente)');
  if (t === 'V' || t === 'VSIN' || t === 'VPULSE' || (t === 'GEN' && c.spice?.letra === 'V'))
    return esFuenteContinua(c)
      ? externo('alimentacion', ['end', 'start'], ['+', '−'], 'Fuente de alimentación de laboratorio (salida flotante)')
      : externo('generador', ['end', 'start'], ['señal', 'común'], 'Generador de funciones');
  if (t === 'I' || (t === 'GEN' && c.spice?.letra === 'I')) return externo('corriente', ['end', 'start'], ['sale', 'entra'], 'Fuente de corriente');
  if (t === 'VM') return externo('voltimetro', ['end', 'start'], ['V', 'COM'], 'Voltímetro (puntas de prueba)');
  if (t === 'SONDA') return { id: 'sonda', forma: 'uno', patas: ['start'], nombres: ['V'], marca: 'V', descripcion: 'Sonda de tensión (marca el punto que se dibuja)' };

  switch (t) {
    case 'R': {
      const v = valorDe(c, 'valor', 'Ω');
      return dos('resistencia', ['start', 'end'], ['1', '2'], [1, 12], [4, 3, 5], v != null ? '' : (c.campos['valor'] ?? ''), 'Resistencia de película de ¼ W');
    }
    case 'POT':
      return { id: 'trimmer', forma: 'fila', patas: ['start', 'tap', 'end'], nombres: ['1', 'cursor', '2'], marca: c.campos['valor'] ?? '', descripcion: 'Potenciómetro de ajuste (trimmer)' };
    case 'C': {
      const v = valorDe(c, 'valor', 'F');
      if (v != null && v >= 1e-6) return { ...dos('electrolitico', ['start', 'end'], ['+', '−'], [1, 6], v > 100.5e-6 ? [2, 3] : [1, 2], '', 'Condensador electrolítico (polarizado: la franja marca el −)', true), enFila: true };
      if (v != null && v > 1e-7) return dos('film', ['start', 'end'], ['1', '2'], [1, 8], [2, 3, 1], '', 'Condensador de poliéster');
      return dos('ceramico', ['start', 'end'], ['1', '2'], [1, 8], [1, 2, 3], '', 'Condensador cerámico de disco');
    }
    case 'L':
      return dos('bobina', ['start', 'end'], ['1', '2'], [1, 12], [4, 3, 5], '', 'Bobina axial');
    case 'D':
    case 'DS':
    case 'DZ':
      return dos(t === 'DZ' ? 'zener' : 'diodo', ['start', 'end'], ['A', 'K'], [1, 12], [4, 3, 5], marcaModelo(c.campos['modelo'] ?? ''), t === 'DZ' ? 'Diodo Zener (la franja marca el cátodo)' : 'Diodo (la franja marca el cátodo)');
    case 'LED':
      return { ...dos('led', ['start', 'end'], ['A', 'K'], [1, 4], [1, 2], '', 'LED de 3 mm: la pata larga es el ánodo y el lado plano el cátodo'), enFila: true };
    case 'QN':
    case 'QP':
    case 'MN':
    case 'MP':
    case 'JN':
    case 'JP': {
      const pj = patillajeTransistor(t, c.campos['modelo'] ?? '');
      const desc = pj.enc === 'to92' ? 'Encapsulado TO-92' : pj.enc === 'to220' ? 'Encapsulado TO-220' : 'Encapsulado TO-126';
      return {
        id: pj.enc,
        forma: 'fila',
        patas: pj.orden,
        nombres: pj.orden.map((p) => PIN_LETRA[p] ?? p),
        marca: marcaModelo(c.campos['modelo'] ?? ''),
        descripcion: `${desc}, patillaje ${pj.orden.map((p) => PIN_LETRA[p]).join('-')}${pj.generico ? ' (genérico: el modelo no es una pieza comercial)' : ''}`,
      };
    }
    case 'OA':
    case 'OA5': {
      const m = (c.campos['modelo'] ?? '').toLowerCase();
      const d = dipOperacional(t === 'OA5', { menos: 'in1', mas: 'in2', out: 'out', vd: 'vd', vs: 'vs' });
      return { id: 'dip', forma: 'dip', ...d, nombres: NOMBRES_DIP8, marca: m === 'op741' ? 'LM741' : m ? m.toUpperCase() : 'AO', descripcion: 'Operacional en DIP-8 (2 −, 3 +, 4 V−, 6 salida, 7 V+)' };
    }
    case 'T555':
      return {
        id: 'dip',
        forma: 'dip',
        patas: ['gnd', 'trig', 'out', 'reset', 'ctrl', 'thres', 'dis', 'vcc'],
        nombres: NOMBRES_DIP8,
        marca: 'NE555',
        descripcion: 'Temporizador 555 en DIP-8 (1 GND, 2 disparo, 3 salida, 4 reset, 5 control, 6 umbral, 7 descarga, 8 Vcc)',
      };
    case 'CHIP': {
      // A 74HC chip (logica.ts): its legs (which gate each one is) are the piece's own.
      const modelo = c.campos['modelo'] ?? '74HC00';
      const n = patasChip(modelo);
      return { id: 'dip', forma: 'dip', patas: Array.from({ length: n }, () => null), nombres: Array.from({ length: n }, (_, i) => String(i + 1)), marca: modelo, descripcion: `Chip lógico en DIP-${n} (${descripcionChip(modelo)}; Vcc en la ${n}, GND en la ${n / 2})` };
    }
    case 'SW':
      return { id: 'conmutador', forma: 'fila', patas: ['end', 'start', null], nombres: ['1', 'común', '3'], marca: '', descripcion: 'Conmutador deslizante (toque para cambiarlo)' };
    case 'TRAFO':
      return modulo(['p.start', 'p.end', 's.start', 's.end'], 'TRAFO', 'Transformador (módulo)');
    case 'E':
    case 'G':
      return modulo(['p', 'n', 'cp', 'cn'], t === 'E' ? 'E' : 'G', 'Fuente controlada (módulo: no es una pieza real)');
    case 'GEN':
      return encapsuladoImportado(c);
    default: {
      // Digital parts (XSPICE) and anything else: a small module with its pins on a header.
      const pines = pinesDe(c);
      const marca = t.startsWith('D') && t.length > 1 ? t.slice(1) : t;
      return modulo(pines, marca, 'Módulo (bloque del simulador con sus patillas en una tira)');
    }
  }
}

function encapsuladoImportado(c: Componente): Encapsulado {
  const f = c.forma;
  const pines = f?.pines.map((p) => p.nombre) ?? [];
  const s = f?.simbolo ?? '';
  const resto = (c.campos['resto'] ?? c.spice?.resto ?? '').trim();
  const primera = resto.split(/\s+/)[0] ?? '';
  const desc = (d: string) => `${d} (línea SPICE importada)`;
  if (s === 'OPAMP') {
    const tiene = (p: string) => pines.includes(p);
    const d = dipOperacional(tiene('vd') && tiene('vs'), { menos: 'in1', mas: 'in2', out: 'out', vd: 'vd', vs: 'vs' });
    const nombre = (c.spice?.letra === 'X' ? resto.split(/\s+/).filter((x) => !x.includes('=')).pop() : '') ?? '';
    return { id: 'dip', forma: 'dip', ...d, nombres: NOMBRES_DIP8, marca: nombre.toLowerCase() === 'op741' ? 'LM741' : (nombre || 'AO').toUpperCase().slice(0, 8), descripcion: desc('Operacional en DIP-8') };
  }
  // A 555 subcircuit with its eight pins in the usual order: the DIP-8 timer.
  const subNombre = c.spice?.letra === 'X' ? (resto.split(/\s+/).filter((x) => !x.includes('=') && !/^params:$/i.test(x)).pop() ?? '') : '';
  if (/555/.test(subNombre) && c.spice && c.spice.nodos.length === 8) {
    const porIndice = new Map(Object.entries(c.spice.pines).map(([n, i]) => [i, n] as [number, string]));
    const patas = Array.from({ length: 8 }, (_, i) => porIndice.get(i) ?? null);
    if (patas.every(Boolean))
      return { id: 'dip', forma: 'dip', patas, nombres: NOMBRES_DIP8, marca: 'NE555', descripcion: desc('Temporizador 555 en DIP-8 (1 GND, 2 disparo, 3 salida, 4 reset, 5 control, 6 umbral, 7 descarga, 8 Vcc)') };
  }
  // A subcircuit named like an LED (the book models some LEDs as a diode plus their forward voltage).
  if (c.spice?.letra === 'X' && pines.length === 2 && /^x?led/i.test(resto.split(/\s+/).filter((x) => !x.includes('=') && !/^params:$/i.test(x)).pop() ?? ''))
    return { id: 'led', forma: 'dos', patas: [pines[0]!, pines[1]!], nombres: ['A', 'K'], span: [1, 4], preferidos: [1, 2], marca: '', descripcion: desc('LED de 3 mm'), enFila: true };
  if (s === 'PUENTE') return { id: 'puente', forma: 'fila', patas: ['p', 'a', 'b', 'n'], nombres: ['+', '~', '~', '−'], marca: 'PUENTE', descripcion: desc('Puente rectificador') };
  if (s === 'NPN' || s === 'PNP' || s === 'NMOS' || s === 'PMOS' || s === 'NJF' || s === 'PJF') {
    const tipo = { NPN: 'QN', PNP: 'QP', NMOS: 'MN', PMOS: 'MP', NJF: 'JN', PJF: 'JP' }[s]!;
    const modelo = c.spice?.letra === 'Q' || c.spice?.letra === 'J' || c.spice?.letra === 'M' ? primera.replace(/=.*/, '') : '';
    const pj = patillajeTransistor(tipo, modelo);
    const orden = pj.orden.filter((p) => pines.includes(p));
    if (orden.length === pines.length)
      return { id: pj.enc, forma: 'fila', patas: orden, nombres: orden.map((p) => PIN_LETRA[p] ?? p), marca: marcaModelo(modelo), descripcion: desc(`Transistor ${pj.enc.toUpperCase()}`) };
  }
  if ((s === 'D' || s === 'DZ' || s === 'DS' || s === 'LED') && pines.length === 2) {
    if (s === 'LED') return { id: 'led', forma: 'dos', patas: ['start', 'end'], nombres: ['A', 'K'], span: [1, 4], preferidos: [1, 2], marca: '', descripcion: desc('LED de 3 mm'), enFila: true };
    return { id: s === 'DZ' ? 'zener' : 'diodo', forma: 'dos', patas: ['start', 'end'], nombres: ['A', 'K'], span: [1, 12], preferidos: [4, 3, 5], marca: marcaModelo(primera), descripcion: desc('Diodo') };
  }
  if ((s === 'R' || s === 'C' || s === 'L') && pines.length === 2) {
    const id = s === 'R' ? 'resistencia' : s === 'L' ? 'bobina' : 'ceramico';
    return { id, forma: 'dos', patas: ['start', 'end'], nombres: ['1', '2'], span: [1, 12], preferidos: s === 'C' ? [1, 2, 3] : [4, 3, 5], marca: primera.slice(0, 10), descripcion: desc(s === 'R' ? 'Resistencia' : s === 'L' ? 'Bobina' : 'Condensador') };
  }
  let titulo = f?.titulo ?? '';
  if (!titulo && c.spice?.letra === 'X') titulo = resto.split(/\s+/).filter((x) => !x.includes('=') && !/^params:$/i.test(x)).pop() ?? '';
  if (!titulo) titulo = c.spice?.letra ?? 'X';
  return modulo(pines, titulo.toUpperCase().slice(0, 10), desc('Módulo'));
}

/** Legs of a package as an editor part sees them, with a check that every electrical pin has a leg. */
export function patasCompletas(c: Componente, e: Encapsulado): boolean {
  if (e.forma === 'externo' || e.forma === 'uno' || c.tipo === 'CHIP') return true;
  const tiene = new Set(e.patas.filter((p): p is string => !!p));
  return pinesDe(c).every((p) => tiene.has(p));
}

// ------------------------------------------------------------------ geometry of the legs

/** Unit direction of a part from its legs (first → second leg). */
export function direccion(p: Pieza): Pt {
  if (p.pos.length < 2) return [1, 0];
  const [a, b] = [p.pos[0]!, p.pos[1]!];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  return [dx / L, dy / L];
}

/** Normal on the «face» side: the left of the leg direction on screen (up for legs going right). */
export function normal(u: Pt): Pt {
  return [u[1], -u[0]];
}

/** Legs of an inline package from its first leg and direction. */
export function patasFila(a: Pt, d: Pt, n: number): Pt[] {
  return Array.from({ length: n }, (_, i) => [a[0] + i * d[0], a[1] + i * d[1]] as Pt);
}

/** Legs of a DIP: pin 1 at `a`, pins 1…n/2 along d, the other row 3 pitches on the normal side. */
export function patasDip(a: Pt, d: Pt, n: number): Pt[] {
  const m = n / 2;
  const nn = normal(d);
  const res: Pt[] = [];
  for (let i = 0; i < m; i++) res.push([a[0] + i * d[0], a[1] + i * d[1]]);
  for (let i = 0; i < m; i++) {
    const k = m - 1 - i;
    res.push([a[0] + k * d[0] + 3 * nn[0], a[1] + k * d[1] + 3 * nn[1]]);
  }
  return res;
}

/** Terminals of a piece of equipment from its first terminal. */
export function bornesExterno(a: Pt, n = 2): Pt[] {
  return Array.from({ length: n }, (_, i) => [a[0] + 3 * i, a[1]] as Pt);
}

/** Box of a piece of equipment (world units): [x0, y0, x1, y1]. */
export function cajaExterno(p: Pieza): [number, number, number, number] {
  const a = p.pos[0]!;
  return [a[0] - 2.5, a[1] - 5.6, a[0] + 5.5, a[1] + 0.9];
}

/** Body of a part: an oriented rectangle (centre, unit axis, half length, half width). */
export interface Cuerpo {
  c: Pt;
  u: Pt;
  hl: number;
  hw: number;
  /** Drawn as a disc of radius hl (LEDs, electrolytics, standing resistors). */
  redondo?: boolean;
}

/** Diameter (pitches) of an electrolytic can by capacitance. */
export function diametroElectrolitico(c: number): number {
  if (c <= 10.5e-6) return 2.0;
  if (c <= 100.5e-6) return 2.5;
  return 3.2;
}

/** Length and width (pitches) of the body of a two-leg part. */
export function medidasDos(p: Pieza): { largo: number; ancho: number; pie: boolean } {
  const L = p.pos.length >= 2 ? Math.hypot(p.pos[1]![0] - p.pos[0]![0], p.pos[1]![1] - p.pos[0]![1]) : 0;
  switch (p.enc) {
    case 'resistencia':
      return L >= 2.9 ? { largo: 2.4, ancho: 0.95, pie: false } : { largo: 1, ancho: 1, pie: true };
    case 'bobina':
      return L >= 2.9 ? { largo: 2.4, ancho: 1.1, pie: false } : { largo: 1.1, ancho: 1.1, pie: true };
    case 'diodo':
    case 'zener': {
      const grande = /400\d|1n54|uf|by/i.test(p.comp.campos['modelo'] ?? '');
      const l = grande ? 2.0 : 1.55;
      return L >= l + 0.6 ? { largo: l, ancho: grande ? 1.05 : 0.75, pie: false } : { largo: 1, ancho: 1, pie: true };
    }
    case 'ceramico':
      return { largo: Math.min(1.9, Math.max(1.2, L + 0.7)), ancho: 0.75, pie: false };
    case 'film':
      return { largo: Math.max(2.4, L + 0.8), ancho: 1.2, pie: false };
    case 'led':
      return { largo: 1.45, ancho: 1.45, pie: false };
    case 'electrolitico': {
      const l = leerValor(p.comp.campos['valor'] ?? '', 'F');
      const d = diametroElectrolitico(l.ok && l.v != null ? l.v : 1e-6);
      return { largo: d, ancho: d, pie: false };
    }
    case 'medida':
      return { largo: 1.1, ancho: 1.1, pie: false };
    default:
      return { largo: 1, ancho: 1, pie: false };
  }
}

/** The body of a part on the board (null for equipment and probes). */
export function cuerpoDe(p: Pieza): Cuerpo | null {
  const n = p.pos.length;
  if (p.enc === 'sonda' || EXTERNOS.has(p.enc) || !n) return null;
  if (n === 2 && ['resistencia', 'bobina', 'diodo', 'zener', 'ceramico', 'film', 'led', 'electrolitico', 'medida'].includes(p.enc)) {
    const [a, b] = [p.pos[0]!, p.pos[1]!];
    const m = medidasDos(p);
    const u = direccion(p);
    if (m.pie) return { c: a, u, hl: 0.55, hw: 0.55, redondo: true };
    const c: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (p.enc === 'led' || p.enc === 'electrolitico' || p.enc === 'medida') return { c, u, hl: m.largo / 2, hw: m.largo / 2, redondo: true };
    return { c, u, hl: m.largo / 2, hw: m.ancho / 2 };
  }
  const u = direccion(p);
  const nn = normal(u);
  if (p.enc === 'dip') {
    const m = n / 2;
    const a = p.pos[0]!;
    const c: Pt = [a[0] + ((m - 1) / 2) * u[0] + 1.5 * nn[0], a[1] + ((m - 1) / 2) * u[1] + 1.5 * nn[1]];
    return { c, u, hl: (m - 1) / 2 + 0.48, hw: 1.06 };
  }
  // inline packages: centre of the legs, shifted to the body side
  const a = p.pos[0]!;
  const b = p.pos[n - 1]!;
  const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const lado = (k: number): Pt => [mid[0] + k * nn[0], mid[1] + k * nn[1]];
  switch (p.enc) {
    case 'to92':
      return { c: lado(0.22), u, hl: 1.0, hw: 0.68 };
    case 'to220':
      return { c: lado(0.75), u, hl: 2.0, hw: 1.0 };
    case 'to126':
      return { c: lado(0.55), u, hl: 1.55, hw: 0.75 };
    case 'trimmer':
      return { c: lado(0.95), u, hl: 1.3, hw: 1.3 };
    case 'conmutador':
      return { c: mid, u, hl: 1.75, hw: 0.72 };
    case 'puente':
      return { c: lado(0.15), u, hl: (n - 1) / 2 + 0.7, hw: 0.62 };
    default:
      // module: a small board beside its header, covering the next row only
      return { c: lado(1.0), u, hl: Math.max((n - 1) / 2 + 0.55, 1.1), hw: 0.72 };
  }
}

export const EXTERNOS = new Set(['alimentacion', 'generador', 'corriente', 'voltimetro']);

/** Corners of a body. */
export function esquinas(b: Cuerpo): Pt[] {
  const [ux, uy] = b.u;
  const [nx, ny] = [-uy, ux];
  const r: Pt[] = [];
  for (const [s, t] of [[1, 1], [-1, 1], [-1, -1], [1, -1]] as const) r.push([b.c[0] + s * b.hl * ux + t * b.hw * nx, b.c[1] + s * b.hl * uy + t * b.hw * ny]);
  return r;
}

/** Do two bodies overlap (separating axis test, with a small tolerance)? */
export function solapan(a: Cuerpo, b: Cuerpo, holgura = 0.04): boolean {
  if (a.redondo && b.redondo) return Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]) < a.hl + b.hl - holgura;
  const ea = esquinas(a);
  const eb = esquinas(b);
  for (const [ux, uy] of [a.u, [-a.u[1], a.u[0]], b.u, [-b.u[1], b.u[0]]] as Pt[]) {
    let amin = Infinity;
    let amax = -Infinity;
    let bmin = Infinity;
    let bmax = -Infinity;
    for (const [x, y] of ea) {
      const v = x * ux + y * uy;
      amin = Math.min(amin, v);
      amax = Math.max(amax, v);
    }
    for (const [x, y] of eb) {
      const v = x * ux + y * uy;
      bmin = Math.min(bmin, v);
      bmax = Math.max(bmax, v);
    }
    if (amax - holgura <= bmin || bmax - holgura <= amin) return false;
  }
  return true;
}

/** Is a point under a body (a hole hidden by a part)? */
export function bajoCuerpo(b: Cuerpo, x: number, y: number, holgura = 0.15): boolean {
  const dx = x - b.c[0];
  const dy = y - b.c[1];
  if (b.redondo) return Math.hypot(dx, dy) < b.hl - holgura;
  const a = dx * b.u[0] + dy * b.u[1];
  const n = -dx * b.u[1] + dy * b.u[0];
  return Math.abs(a) < b.hl - holgura && Math.abs(n) < b.hw - holgura;
}

/** Axis-aligned box of a body. */
export function cajaCuerpo(b: Cuerpo): [number, number, number, number] {
  if (b.redondo) return [b.c[0] - b.hl, b.c[1] - b.hl, b.c[0] + b.hl, b.c[1] + b.hl];
  const e = esquinas(b);
  return [Math.min(...e.map((p) => p[0])), Math.min(...e.map((p) => p[1])), Math.max(...e.map((p) => p[0])), Math.max(...e.map((p) => p[1]))];
}
