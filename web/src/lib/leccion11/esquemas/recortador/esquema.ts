// Schematic «recortador»: a diode clipper (sección 5.9) — a sine input, a series resistor and, from the output node,
// the branches that limit it: a diode to ground (or to a reference V_ref, or through a Zener) that clips the positive
// peaks at vd (+ V_ref, + V_Z), a diode from ground that clips the negative ones at −vd, or two Zeners in antiserie
// that clip both at ±(V_Z + vd) (problema 5.C: two 5,6 V Zeners clip at ±6,3 V). Without load, below the threshold the
// output follows the input. Diodes in the book's constant-drop model (piece «vd»).
import { diodoCaida, isCalibrada, ng, num, temperatura, zener } from '../comun';
import type { DefinicionEsquema, NoLineal } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'recortador',
  titulo: 'Recortador con diodos',
  resumen: 'Entrada senoidal, resistencia en serie y diodos (con referencia o Zener) del nodo de salida a masa; la salida recortada frente al tiempo.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'amplitud (pico) de la tensión senoidal de entrada, V_p (V)' },
    f: { obligatoria: true, descripcion: 'frecuencia de la entrada (Hz)' },
    r: { obligatoria: true, descripcion: 'resistencia en serie (Ω)', color: 'azul' },
    vd: { obligatoria: true, descripcion: 'caída de cada diodo cuando conduce (V): el modelo de caída constante; con «zz», la directa de cada Zener' },
    positivo: { interruptor: true, descripcion: 'conecta la rama que recorta los picos positivos: diodo con el ánodo en la salida (sin él, conectada)', color: 'naranja' },
    negativo: { interruptor: true, descripcion: 'conecta la rama que recorta los picos negativos: diodo con el cátodo en la salida (sin él, conectada)', color: 'verde' },
    vref: { descripcion: 'tensión de referencia de la rama positiva (V): recorta en V_ref + vd (sin ella, a masa)', color: 'naranja' },
    vz: { descripcion: 'Zener en serie con el diodo de la rama positiva (V): recorta en V_Z + vd', color: 'naranja' },
    zz: { descripcion: 'dos Zener de esta tensión en antiserie, del nodo a masa, en lugar de las ramas (V): recortan en ±(V_Z + vd)', color: 'naranja' },
  },
  observables: {
    salida: { medida: 'v(s)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de salida, recortada' },
    entrada: { medida: 'v(fte)', analisis: 'tran', unidad: 'V', descripcion: 'tensión senoidal de entrada' },
    i: { medida: 'i(vmed)', analisis: 'tran', unidad: 'A', descripcion: 'corriente por la resistencia, de la entrada a la salida' },
  },
  validar: (tiene) => {
    const out: string[] = [];
    if (tiene('zz') && ['positivo', 'negativo', 'vref', 'vz'].some(tiene)) out.push('«zz» (dos Zener en antiserie) va solo: sin «positivo», «negativo», «vref» ni «vz»');
    return out;
  },
  // 0,2 V per diode: the simulator's diodes drop vd at 10 mA with n = 1; clipping a few volts through the book's 1 kΩ
  // they carry from tenths of a milliampere to about 10 mA (vd − 0,14 V to vd), and near the threshold, where the
  // model's output just follows the input, a real diode already conducts a little (some 0,08 V less with 1 kΩ).
  // 0,1 V per Zener: breakdown at V_Z at 5 mA with n = 1, as in the «zener» schematic.
  noLineal: (tiene) => {
    const out: NoLineal[] = [{ pieza: 'vd', desviacion: 0.2, porque: 'diodos de caída vd a 10 mA, n = 1: de vd − 0,14 V a vd entre 0,05 y 10 mA de recorte' }];
    if (tiene('vz')) out.push({ pieza: 'vz', desviacion: 0.1, porque: 'Zener de V_Z a 5 mA, n = 1: ± 0,1 V entre 0,1 mA y 250 mA' });
    if (tiene('zz')) out.push({ pieza: 'zz', desviacion: 0.1, porque: 'Zener de V_Z a 5 mA, n = 1: ± 0,1 V entre 0,1 mA y 250 mA' });
    return out;
  },
  netlist(c) {
    const vd = c.p('vd');
    const lineas = [
      temperatura(),
      `VF fte 0 DC 0 SIN(0 ${num(c.p('fuente'))} ${num(c.p('f'))})`,
      'VMED fte a 0',
      `R1 a s ${ng(c.p('r'))}`,
      'RX s 0 1e9',
      diodoCaida('DX', vd),
    ];
    if (c.tiene('zz')) {
      // anodes joined: positive, the upper one breaks down and the lower conducts; negative, the other way round
      lineas.push('DZA m s DZZ', 'DZB m 0 DZZ', 'RM m 0 1e9');
      lineas.push(`.model DZZ D(IS=${isCalibrada(Math.max(vd, 0.05), 10e-3).toPrecision(8)} N=1 BV=${num(c.p('zz'))} IBV=5e-3 NBV=1)`);
      return lineas;
    }
    if (c.cerrado('positivo')) {
      // diode s → p1, then the Zener (cathode up) p1 → p2, then the reference p2 → ground
      const p2 = c.tiene('vz') ? 'p2' : 'p1';
      lineas.push('D1 s p1 DX');
      if (c.tiene('vz')) lineas.push(`DZ1 ${p2} p1 DZP`, zener('DZP', c.p('vz'), 0));
      lineas.push(c.tiene('vref') ? `VREF ${p2} 0 DC ${num(c.p('vref'))}` : `VREF ${p2} 0 DC 0`);
    }
    if (c.cerrado('negativo')) lineas.push('D2 0 s DX');
    return lineas;
  },
  describir: (c) => {
    const ramas: string[] = [];
    if (c.tiene('zz')) ramas.push(`dos Zener de ${c.val('zz')} en antiserie del nodo de salida a masa`);
    else {
      if (c.cerrado('positivo'))
        ramas.push(`un diodo hacia ${c.tiene('vz') ? `un Zener de ${c.val('vz')} y ` : ''}${c.tiene('vref') ? `una referencia de ${c.val('vref')}` : 'masa'} que recorta los picos positivos`);
      if (c.cerrado('negativo')) ramas.push('un diodo desde masa que recorta los picos negativos');
    }
    return `Recortador: entrada senoidal de ${c.val('fuente')} de pico y ${c.val('f')}, ${c.sim('r')} de ${c.val('r')} en serie y ${ramas.length ? ramas.join(' y ') : 'ningún diodo conectado'}; cada diodo cae ${c.val('vd')} cuando conduce`;
  },
};
export default d;
