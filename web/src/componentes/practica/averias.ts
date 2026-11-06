// 1.0 «Encuentre la avería»: a live schematic of the book with one faulty part (open, short, ×10 or ×0,1 value,
// reversed diode, open base-emitter junction). The faulty netlist is the figure's own (figuras-vivas/esquema/
// netlist.ts) with that part's line edited; everything the reader measures is read from ngspice's operating point of
// it, never stored. Pure: the generator (web/scripts/averias10.mjs), the app (Averia.svelte) and the tests share it.

import { generarNetlist, type MetaNetlist } from '../figuras-vivas/esquema/netlist.ts';
import type { Esquema, ResultadoOp } from '../figuras-vivas/tipos.ts';

export type TipoAveria = 'abierta' | 'corto' | 'alto' | 'bajo' | 'reves' | 'base-abierta';

export interface Averia {
  /** Element id in the schematic. */
  elemento: string;
  tipo: TipoAveria;
}

/** How each fault is named to the reader (the answer's choices). */
export const NOMBRE_AVERIA: Record<TipoAveria, string> = {
  abierta: 'Está abierta: no conduce',
  corto: 'Está en cortocircuito',
  alto: 'Tiene un valor diez veces mayor',
  bajo: 'Tiene un valor diez veces menor',
  reves: 'Está montado al revés',
  'base-abierta': 'Tiene la unión base-emisor abierta',
};

const DIODOS = new Set(['D', 'LED', 'DZ']);

/** The faults a part can have, by its role in the schematic. */
export function averiasDe(rol: string): TipoAveria[] {
  if (rol === 'R') return ['abierta', 'corto', 'alto', 'bajo'];
  if (DIODOS.has(rol)) return ['abierta', 'corto', 'reves'];
  if (rol === 'QN' || rol === 'QP') return ['base-abierta', 'corto'];
  return [];
}

const PREFIJO: Record<string, string> = { R: 'r', D: 'd', LED: 'd', DZ: 'd', QN: 'q', QP: 'q' };

/** The schematic's netlist with the fault, reduced to its operating point. Throws if the part is not in it. */
export function netlistAveria(esq: Esquema, a: Averia): { texto: string; meta: MetaNetlist } {
  const e = esq.elementos.find((x) => x.id === a.elemento);
  if (!e || !PREFIJO[e.rol]) throw new Error(`la pieza ${a.elemento} no puede averiarse aquí`);
  const valor: Record<string, number> = {};
  if (e.rol === 'R' && e.valor) {
    if (a.tipo === 'alto') valor[e.id] = e.valor * 10;
    else if (a.tipo === 'bajo') valor[e.id] = e.valor / 10;
    else if (a.tipo === 'abierta') valor[e.id] = 1e12;
  }
  const { texto, meta } = generarNetlist(esq, { valor });
  const nombre = `${PREFIJO[e.rol]}_${e.id.toLowerCase()}`;
  const lineas = texto.replace(/\s+$/, '').split('\n');
  const k = lineas.findIndex((l) => l.split(/\s+/)[0]?.toLowerCase() === nombre);
  if (k < 0) throw new Error(`la pieza ${a.elemento} no está en la netlist`);
  const tok = lineas[k]!.trim().split(/\s+/);
  const extra: string[] = [];
  if (DIODOS.has(e.rol)) {
    if (a.tipo === 'abierta') lineas[k] = `* ${nombre} abierto`;
    else if (a.tipo === 'reves') lineas[k] = [tok[0], tok[2], tok[1], ...tok.slice(3)].join(' ');
    else if (a.tipo === 'corto') extra.push(`r_averia ${tok[1]} ${tok[2]} 1m`);
  } else if (e.rol === 'QN' || e.rol === 'QP') {
    // «q_x c b e modelo»
    if (a.tipo === 'base-abierta') {
      lineas[k] = [tok[0], tok[1], `${e.id.toLowerCase()}_bo`, ...tok.slice(3)].join(' ');
      extra.push(`r_averia ${e.id.toLowerCase()}_bo 0 1e12`);
    } else if (a.tipo === 'corto') extra.push(`r_averia ${tok[1]} ${tok[3]} 1m`);
  } else if (e.rol === 'R' && a.tipo === 'corto') extra.push(`r_averia ${tok[1]} ${tok[2]} 1m`);
  return { texto: [...lineas, ...extra].join('\n') + '\n.control\nop\n.endc\n.end\n', meta };
}

/** A measurement point: a node of the schematic, with the name shown and where it is drawn (SVG units). */
export interface PuntoMedida {
  nodo: string;
  nombre: string;
  xy: [number, number];
  masa?: boolean;
}

/** Voltage between the red and black probes (V). */
export function tensionEntre(op: ResultadoOp | null | undefined, roja: string, negra: string): number | null {
  if (!op) return null;
  const a = op.nodos[roja];
  const b = op.nodos[negra];
  return a == null || b == null ? null : a - b;
}

/** Current through a part (A; 0 when the faulty netlist has none, e.g. an open diode). */
export function corrienteDe(op: ResultadoOp | null | undefined, elemento: string): number | null {
  if (!op) return null;
  const e = op.elementos[elemento];
  return e?.corriente ?? 0;
}

/** Whether a reading differs from the healthy one by a clear margin (what makes a measurement «revealing»). */
export function difiere(sano: number, averiado: number, unidad: 'V' | 'A'): boolean {
  const piso = unidad === 'V' ? 0.3 : 1e-5;
  return Math.abs(averiado - sano) >= Math.max(piso, 0.15 * Math.abs(sano));
}

/** Points taken off for each wrong diagnosis before the final one. */
export const PUNTOS_POR_FALLO = 25;

/**
 * Score of a diagnosis: the part and the fault right 100, only the part 60; −5 per measurement beyond three and
 * −25 per earlier wrong diagnosis (`fallos`), never below 20 once the part is right; 0 with the wrong part.
 */
export function puntuacion(medidas: number, piezaBien: boolean, tipoBien: boolean, fallos = 0): number {
  if (!piezaBien) return 0;
  const base = tipoBien ? 100 : 60;
  return Math.max(20, base - 5 * Math.max(0, medidas - 3) - PUNTOS_POR_FALLO * fallos);
}
