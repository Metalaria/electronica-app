// Catalogue of the 3D models for the pages (no three.js): book labels each model illustrates, the animations
// that show the same component, how the catalogue presents it, and the reader's «Ver en 3D» map.
// The models themselves are in modelos/ (crearModelo), loaded only when a 3D view opens.

import { PAQUETES, FAMILIAS_3D, paquete, type Paquete } from './modelos/paquetes';
import type { Montaje, Parametros } from './modelos/tipos';

export interface Modelo3D extends Paquete {
  /** Book labels (sections, subsections, figures) about the construction of this component. */
  libro: string[];
  /** Component animations (ids of animaciones/catalogo.ts) about the same part. */
  animaciones: string[];
  /** How the catalogue shows it: loose leads (as delivered) or mounted on a board. */
  montaje: Montaje;
}

const LIBRO: Record<string, { libro: string[]; animaciones: string[]; montaje?: Montaje }> = {
  'resistencia-axial': { libro: ['sec-2.2', 'sec-2.2.2', 'sec-2.2.3', 'sec-2.2.4', 'fig-2.3', 'sec-2.4'], animaciones: ['resistencia-construccion', 'codigo-colores', 'resistencia-ohm', 'resistencia-potencia'] },
  'resistencia-smd': { libro: ['sec-2.2.5', 'sec-2.5', 'fig-2.3'], animaciones: ['resistencia-construccion'] },
  potenciometro: { libro: ['sec-2.11', 'fig-2.14'], animaciones: ['potenciometro'] },
  trimmer: { libro: ['sec-2.11'], animaciones: ['potenciometro'] },
  termistor: { libro: ['sec-2.6', 'sec-10.4', 'fig-10.7', 'fig-10.14'], animaciones: ['sensores-resistivos', 'supresor'] },
  ldr: { libro: ['sec-2.6', 'sec-45.3', 'fig-45.6'], animaciones: ['sensores-resistivos'] },
  'condensador-disco': { libro: ['sec-3.4.5', 'fig-3.6', 'fig-3.7', 'sec-3.1'], animaciones: ['condensador-ceramico', 'condensador-placas'] },
  mlcc: { libro: ['sec-3.4.1', 'fig-3.7', 'sec-3.7'], animaciones: ['condensador-ceramico', 'esr-autorresonancia'] },
  'condensador-pelicula': { libro: ['sec-3.4.3', 'fig-3.6'], animaciones: ['condensador-pelicula', 'condensador-alterna'] },
  electrolitico: { libro: ['sec-3.4.2', 'fig-3.6', 'fig-3.7', 'sec-3.8'], animaciones: ['condensador-electrolitico', 'rc-carga', 'esr-autorresonancia'], montaje: 'suelto' },
  'electrolitico-smd': { libro: ['sec-3.4.2', 'fig-3.7'], animaciones: ['condensador-electrolitico'] },
  tantalo: { libro: ['sec-3.4.4', 'fig-3.6', 'fig-3.7'], animaciones: ['condensador-electrolitico'] },
  supercondensador: { libro: ['sec-3.10', 'sec-3.4.4'], animaciones: ['supercondensador'], montaje: 'suelto' },
  'bobina-axial': { libro: ['sec-4.2', 'fig-4.3'], animaciones: ['bobina-lenz'] },
  'bobina-radial': { libro: ['sec-4.2', 'fig-4.3', 'fig-4.5', 'sec-4.4'], animaciones: ['bobina-lenz', 'nucleo-saturacion'] },
  toroide: { libro: ['sec-4.4', 'fig-4.1', 'fig-4.3'], animaciones: ['nucleo-saturacion', 'bobina-lenz'] },
  'bobina-smd': { libro: ['sec-4.2', 'sec-4.4'], animaciones: ['nucleo-saturacion'] },
  transformador: { libro: ['sec-4.6', 'fig-4.11', 'fig-4.1', 'sec-4.4'], animaciones: ['transformador'] },
  rele: { libro: ['sec-4.5', 'fig-20.6'], animaciones: ['rele-flyback'] },
  'diodo-do41': { libro: ['sec-5.4', 'fig-5.2', 'sec-5.5'], animaciones: ['diodo-polarizacion', 'union-pn', 'schottky', 'rectificador'] },
  'diodo-do35': { libro: ['sec-5.4', 'sec-5.5'], animaciones: ['diodo-polarizacion', 'zener'] },
  'diodo-sod123': { libro: ['sec-5.4'], animaciones: ['diodo-polarizacion', 'schottky', 'zener'] },
  'led-5mm': { libro: ['sec-5.4', 'sec-5.5', 'sec-45.2'], animaciones: ['led'], montaje: 'suelto' },
  'led-smd': { libro: ['sec-45.2', 'fig-45.14'], animaciones: ['led'] },
  puente: { libro: ['sec-5.4', 'fig-5.2', 'sec-5.6'], animaciones: ['rectificador'] },
  to92: { libro: ['sec-6.4', 'fig-6.9', 'fig-6.10', 'fig-5.2', 'sec-6.1'], animaciones: ['bjt-portadores', 'bjt-curvas', 'jfet', 'hall'] },
  to220: { libro: ['sec-6.4', 'sec-7.3', 'fig-6.9', 'fig-7.5', 'fig-10.1'], animaciones: ['mosfet-canal', 'mosfet-curvas', 'mosfet-puerta', 'tiristor'] },
  sot23: { libro: ['sec-6.4', 'fig-6.10', 'sec-7.3'], animaciones: ['bjt-portadores', 'mosfet-canal'] },
  dpak: { libro: ['sec-6.4', 'sec-7.3', 'fig-7.5'], animaciones: ['mosfet-curvas'] },
  dip: { libro: ['fig-5.2', 'fig-8.1', 'fig-8.8', 'fig-9.3', 'sec-8.5', 'sec-8.1'], animaciones: ['opamp', 'cmos-inversor'] },
  soic: { libro: ['fig-8.1', 'fig-9.3'], animaciones: ['opamp'] },
  qfp: { libro: ['fig-9.3'], animaciones: [] },
  qfn: { libro: ['sec-7.3'], animaciones: [] },
  optoacoplador: { libro: ['sec-45.4', 'fig-45.7', 'sec-20.2'], animaciones: ['optoacoplador'] },
  cristal: { libro: ['sec-20.12', 'fig-20.8'], animaciones: ['cristal'] },
  fusible: { libro: ['sec-10.3', 'fig-10.5'], animaciones: ['fusible'] },
  ptc: { libro: ['sec-10.3', 'fig-10.5'], animaciones: ['fusible'] },
  'tira-pines': { libro: ['fig-20.15'], animaciones: [] },
  borna: { libro: ['fig-20.15'], animaciones: [] },
};

export const MODELOS_3D: Modelo3D[] = PAQUETES.map((p) => ({
  ...p,
  libro: LIBRO[p.tipo]?.libro ?? [],
  animaciones: LIBRO[p.tipo]?.animaciones ?? [],
  montaje: LIBRO[p.tipo]?.montaje ?? 'placa',
}));

export { FAMILIAS_3D };

export function modelo3d(tipo: string): Modelo3D | undefined {
  return MODELOS_3D.find((m) => m.tipo === tipo);
}

export function nombreDe(tipo: string): string {
  return paquete(tipo)?.nombre ?? tipo;
}

let porEtiqueta: Map<string, Modelo3D[]> | null = null;

/** Models about a book label: the reader's «Ver en 3D» button. */
export function modelosDe(label: string): Modelo3D[] {
  if (!porEtiqueta) {
    porEtiqueta = new Map();
    for (const m of MODELOS_3D)
      for (const l of m.libro) {
        const lista = porEtiqueta.get(l) ?? [];
        lista.push(m);
        porEtiqueta.set(l, lista);
      }
  }
  return porEtiqueta.get(label) ?? [];
}

export function hrefModelo(tipo: string, p?: Parametros): string {
  const q = p && Object.keys(p).length ? '?' + new URLSearchParams(Object.entries(p).map(([k, v]) => [k, String(v)])).toString() : '';
  return `#/componentes/3d/${tipo}${q}`;
}
