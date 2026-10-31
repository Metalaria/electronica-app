// The parts tray (0.11): the cards a beginner needs (each a real-looking part with its name and value) and
// the drawing of a card, the part as it looks on the board in a small SVG of its own. Plain TypeScript.

import { TIPO, textoValor } from '../editor/catalogo.ts';
import type { Componente } from '../editor/tipos.ts';
import { modeloPorNombre } from '../editor/modelos.ts';
import { defsProtoboard, svgPieza } from './dibujo.ts';
import { piezaDe } from './edicion.ts';
import { cajaCuerpo, cajaExterno, cuerpoDe, EXTERNOS } from './encapsulados.ts';
import type { DocumentoProtoboard, Pieza } from './tipos.ts';

export interface CartaBandeja {
  clave: string;
  /** Editor part kind and the fields it starts with. */
  tipo: string;
  campos?: Record<string, string>;
  nombre: string;
}

/** Free building: the common parts first. «Más piezas» opens the whole palette. */
export const CARTAS: CartaBandeja[] = [
  { clave: 'R', tipo: 'R', campos: { valor: '1k' }, nombre: 'Resistencia' },
  { clave: 'LEDR', tipo: 'LED', campos: { modelo: 'LEDR' }, nombre: 'LED' },
  { clave: 'LEDV', tipo: 'LED', campos: { modelo: 'LEDV' }, nombre: 'LED' },
  { clave: 'PUL', tipo: 'PULNA', nombre: 'Pulsador' },
  { clave: 'C', tipo: 'C', campos: { valor: '100n' }, nombre: 'Condensador' },
  { clave: 'CE', tipo: 'C', campos: { valor: '10µ' }, nombre: 'Electrolítico' },
  { clave: 'QN', tipo: 'QN', nombre: 'Transistor NPN' },
  { clave: 'POT', tipo: 'POT', nombre: 'Potenciómetro' },
  { clave: 'D', tipo: 'D', nombre: 'Diodo' },
  { clave: 'SW', tipo: 'SW', nombre: 'Interruptor' },
  { clave: 'LDR', tipo: 'LDR', nombre: 'LDR' },
  { clave: 'ZUMB', tipo: 'ZUMB', nombre: 'Zumbador' },
  { clave: 'QP', tipo: 'QP', nombre: 'Transistor PNP' },
  { clave: '555', tipo: 'T555', nombre: 'Temporizador 555' },
  { clave: 'OA', tipo: 'OA5', nombre: 'Operacional' },
  { clave: 'NAND', tipo: 'DNAND', nombre: 'Puertas NAND' },
  { clave: 'V', tipo: 'V', campos: { forma: 'dc', dc: '9' }, nombre: 'Fuente' },
];

/** A sample part of a card (for its drawing and its value line). */
export function muestra(c: CartaBandeja): Componente {
  const t = TIPO.get(c.tipo);
  return { id: `muestra-${c.clave}`, tipo: c.tipo, nombre: '', x: 0, y: 0, o: t?.o ?? 0, campos: { ...(t?.inicial ?? {}), ...(c.campos ?? {}) } };
}

/** The value line of a card or of a guide's part: «1 kΩ», «2N3904», «74HC00». */
export function valorCarta(comp: Componente, p?: Pieza): string {
  if (p?.chip) return String(p.comp.campos['modelo'] ?? '');
  const FIJO: Record<string, string> = { DNAND: '74HC00', T555: 'NE555', OA5: 'DIP-8', SW: 'deslizante', CONM: 'deslizante', LDR: 'según la luz', PULNA: '6 × 6 mm', PULNC: '6 × 6 mm' };
  if (FIJO[comp.tipo]) return FIJO[comp.tipo]!;
  if (comp.tipo === 'LED') return /v/i.test(comp.campos['modelo'] ?? '') ? 'verde, 3 mm' : 'rojo, 3 mm';
  const v = textoValor(comp);
  if (v && !/^pos\.|pulsado/.test(v)) {
    const m = comp.campos['modelo'] ? modeloPorNombre(comp.campos['modelo'])?.descripcion : undefined;
    if (comp.tipo === 'LED' || comp.tipo === 'D' || comp.tipo === 'DZ') return m?.split(' (')[0] ?? v;
    if (comp.campos['modelo'] && /^Q/i.test(comp.campos['modelo'])) return comp.campos['modelo'].replace(/^Q/, '');
    return v;
  }
  const m = comp.campos['modelo'];
  if (m) return m.replace(/^Q/, '').replace(/^ne555$/i, 'NE555').replace(/^opa5$/i, '');
  return '';
}

const VACIO: DocumentoProtoboard = { version: 1, titulo: '', placas: 1, columnas: 30, piezas: [], cables: [], analisis: { op: true, tran: { activo: false, paso: '', fin: '', inicio: '', uic: false }, ac: { activo: false, tipo: 'dec', puntos: '', fini: '', ffin: '' }, dc: { activo: false, fuente: '', ini: '', fin: '', paso: '' } }, directivas: '' };

const cache = new Map<string, string>();

/** The drawing of a part for a card: an SVG of its own, cropped to the part (legs included). */
export function svgCarta(x: Componente | Pieza): string {
  const p = 'comp' in x ? x : piezaDe(VACIO, x);
  if (!p) return '';
  const clave = JSON.stringify([p.comp.tipo, p.comp.campos, p.enc, p.pos, p.polo ?? null]);
  const hecho = cache.get(clave);
  if (hecho) return hecho;
  let caja: [number, number, number, number];
  if (EXTERNOS.has(p.enc)) caja = cajaExterno(p);
  else {
    const b = cuerpoDe(p);
    const xs = p.pos.map((q) => q[0]);
    const ys = p.pos.map((q) => q[1]);
    caja = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    if (b) {
      const c = cajaCuerpo(b);
      caja = [Math.min(caja[0], c[0]), Math.min(caja[1], c[1]), Math.max(caja[2], c[2]), Math.max(caja[3], c[3])];
    }
  }
  const m = 0.45;
  const [x0, y0, x1, y1] = [caja[0] - m, caja[1] - m, caja[2] + m, caja[3] + m];
  // A small piece of board behind the legs: they look plugged in.
  const agujeros = EXTERNOS.has(p.enc) ? '' : p.pos.map((q) => `<rect x="${q[0] - 0.2}" y="${q[1] - 0.2}" width=".4" height=".4" rx=".08" fill="#3d3d3d"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" aria-hidden="true">${defsProtoboard()}${agujeros}${svgPieza({ ...p, comp: { ...p.comp, nombre: '' } })}</svg>`;
  cache.set(clave, svg);
  return svg;
}
