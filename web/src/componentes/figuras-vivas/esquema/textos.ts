// Spanish names of the schematic parts, and the component animation that explains each kind of part.

import type { Elemento } from '../tipos';

const NOMBRES: Record<string, string> = {
  R: 'Resistencia',
  POT: 'Potenciómetro',
  C: 'Condensador',
  L: 'Bobina',
  V: 'Fuente de tensión',
  'V?': 'Fuente',
  BAT: 'Batería',
  I: 'Fuente de corriente',
  VSIN: 'Generador senoidal',
  VPULSE: 'Generador de onda cuadrada',
  VTRI: 'Generador de onda triangular',
  DEP: 'Fuente controlada',
  D: 'Diodo',
  DZ: 'Diodo Zener',
  LED: 'LED',
  PD: 'Fotodiodo',
  VAR: 'Varicap',
  QN: 'Transistor NPN',
  QP: 'Transistor PNP',
  QPHOTO: 'Fototransistor',
  MN: 'MOSFET de canal N',
  MP: 'MOSFET de canal P',
  JN: 'JFET de canal N',
  JP: 'JFET de canal P',
  OA: 'Amplificador operacional',
  GND: 'Masa',
  RAIL: 'Alimentación',
  SW: 'Interruptor',
  SPDT: 'Conmutador',
  LAMP: 'Lámpara',
  SPK: 'Altavoz',
  FUSE: 'Fusible',
  AM: 'Amperímetro',
  VM: 'Voltímetro',
  XFMR: 'Transformador',
  X: 'Componente',
  X2: 'Componente',
};

export function nombreElemento(e: Elemento): string {
  const base = NOMBRES[e.rol] ?? e.clase;
  return e.designador && e.designador !== base ? `${base} ${e.designador}` : base;
}

const ANIMACION: Record<string, string> = {
  R: 'resistencia-ohm',
  POT: 'potenciometro',
  C: 'condensador-placas',
  VAR: 'condensador-placas',
  L: 'bobina-lenz',
  XFMR: 'transformador',
  D: 'diodo-polarizacion',
  DZ: 'zener',
  LED: 'led',
  PD: 'fotodiodo',
  QN: 'bjt-portadores',
  QP: 'bjt-portadores',
  QPHOTO: 'optoacoplador',
  MN: 'mosfet-canal',
  MP: 'mosfet-canal',
  JN: 'jfet',
  JP: 'jfet',
  OA: 'opamp',
  FUSE: 'fusible',
  LAMP: 'resistencia-potencia',
};

/** Id of the component animation (animaciones/catalogo.ts) of a part, or null. */
export function animacionDe(e: Elemento): string | null {
  if (e.rol === 'D' && /schottky/i.test(e.clase)) return 'schottky';
  return ANIMACION[e.rol] ?? null;
}

/** Plain text of a schematic label («$V_{out}$» → «Vout»). */
export function textoEtiqueta(t: string): string {
  return t.replace(/\$|\\mathrm|\\,|[{}_^]/g, '').replace(/\\([a-zA-Z]+)/g, (_m, n: string) => GRIEGO[n] ?? n).trim();
}

const GRIEGO: Record<string, string> = { Omega: 'Ω', mu: 'µ', alpha: 'α', beta: 'β', tau: 'τ', Delta: 'Δ', pi: 'π' };
