// Schematic «zener»: the classic regulator, a series resistor from the input and a Zener across the output, with an
// optional load that a switch connects (sección 5.8: R_s = (V_in − V_Z)/(I_Z + I_L); the dynamic resistance r_z of
// the table, 30 Ω at 3,3 V, 7 Ω at 5,1 V). The Zener is the book's piecewise-linear model: V_Z, plus I_Z·r_z if «rz».
import { ng, num, zener } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'zener',
  titulo: 'Regulador Zener',
  resumen: 'Entrada, resistencia en serie, Zener en la salida y una carga; salida y corrientes.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de entrada (V)' },
    rs: { obligatoria: true, descripcion: 'resistencia en serie (Ω)', color: 'azul' },
    vz: { obligatoria: true, descripcion: 'tensión Zener V_Z (V)', color: 'naranja' },
    rz: { descripcion: 'resistencia dinámica r_z (Ω)', color: 'naranja' },
    carga: { descripcion: 'resistencia de carga (Ω)', color: 'verde', seVeCon: 'interruptor' },
    interruptor: { interruptor: true, descripcion: 'conecta la carga (sin él, siempre conectada)', color: 'verde' },
  },
  observables: {
    salida: { medida: 'v(s)', analisis: 'op', unidad: 'V', descripcion: 'tensión de salida (la del Zener)' },
    serie: { medida: 'i(vmed)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la resistencia en serie' },
    iz: { medida: 'i(vzm)', analisis: 'op', unidad: 'A', descripcion: 'corriente del Zener (de cátodo a ánodo)' },
    carga: { medida: 'i(vcarga)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la carga', requiere: ['carga'] },
  },
  validar: (tiene) => (tiene('interruptor') && !tiene('carga') ? ['un interruptor sin carga'] : []),
  // 0,1 V: the simulator's Zener breaks down at V_Z (+ I·r_z) at 5 mA with n = 1, so it stays within ± 0,1 V from
  // 0,1 mA to 250 mA; the book's table varies the current from 5 to 20 mA
  noLineal: (tiene) => [
    {
      pieza: 'vz',
      desviacion: 0.1,
      porque: 'Zener de V_Z a 5 mA, n = 1: ± 0,1 V entre 0,1 mA y 250 mA',
      // its V_Z in the simulation: the output less what r_z drops
      medida: (c) => (tiene('rz') ? `v(s)-${num(c.p('rz'))}*i(vzm)` : 'v(s)'),
    },
  ],
  netlist(c) {
    const cargada = c.tiene('carga') && c.cerrado('interruptor');
    return [
      `VF fte 0 DC ${c.p('fuente')}`,
      'VMED fte a 0',
      `RS a s ${ng(c.p('rs'))}`,
      'VZM s z 0',
      'DZ 0 z DZM',
      zener('DZM', c.p('vz'), c.tiene('rz') ? c.p('rz') : 0),
      ...(c.tiene('carga') ? ['VCARGA s l 0', `RL l 0 ${cargada ? ng(c.p('carga')) : '1e15'}`] : []),
    ];
  },
  describir: (c) =>
    `Regulador Zener: entrada de ${c.val('fuente')}, ${c.sim('rs')} de ${c.val('rs')} en serie y un Zener de ${c.val('vz')}${c.tiene('rz') ? ` con r_z de ${c.val('rz')}` : ''} en la salida${c.tiene('carga') && c.cerrado('interruptor') ? `; carga de ${c.val('carga')}` : '; sin carga'}`,
};
export default d;
