// Schematic «condensadores-serie»: two capacitors in series on a DC source, each with its leakage drawn as a resistor
// in parallel, and optionally a balancing resistor across each one (sección 3.9: two electrolytics of 200 V on 400 V,
// leakages that differ by 50 % split the voltage 60/40; 100 kΩ balancing resistors carry 2 mA and fix it at half).
// In steady state (the .op the readings come from) the capacitors are open circuits: the leakages, and the balancing
// resistors when connected, decide the split. The switch piece connects both balancing resistors at once.
import { ng, num } from '../comun';
import type { DefinicionEsquema } from '../tipos';

/** An open balancing resistor: a value no current goes through (ngspice rejects removing the line under a meter). */
const ABIERTA = '1e15';

const d: DefinicionEsquema = {
  nombre: 'condensadores-serie',
  titulo: 'Dos condensadores en serie con sus fugas',
  resumen: 'Fuente y dos condensadores en serie, cada uno con su fuga y, si se quiere, una resistencia de equilibrado en paralelo; el reparto de la tensión en régimen permanente.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de la fuente (V)' },
    c1: { obligatoria: true, descripcion: 'condensador de arriba (F)', color: 'azul' },
    c2: { obligatoria: true, descripcion: 'condensador de abajo (F)', color: 'naranja' },
    f1: { obligatoria: true, descripcion: 'fuga del condensador de arriba, como resistencia equivalente (Ω)', color: 'azul' },
    f2: { obligatoria: true, descripcion: 'fuga del condensador de abajo, como resistencia equivalente (Ω)', color: 'naranja' },
    re: { descripcion: 'resistencia de equilibrado, la misma en paralelo con cada condensador (Ω)', color: 'verde' },
    interruptor: { interruptor: true, descripcion: 'conecta las dos resistencias de equilibrado (sin él, conectadas si hay «re»)' },
  },
  observables: {
    v1: { medida: 'v(a)-v(m)', analisis: 'op', unidad: 'V', descripcion: 'tensión del condensador de arriba' },
    v2: { medida: 'v(m)', analisis: 'op', unidad: 'V', descripcion: 'tensión del condensador de abajo' },
    corriente: { medida: 'i(vmed)', analisis: 'op', unidad: 'A', descripcion: 'corriente de la fuente en régimen permanente' },
    fuga1: { medida: 'i(vf1)', analisis: 'op', unidad: 'A', descripcion: 'corriente de fuga del condensador de arriba' },
    fuga2: { medida: 'i(vf2)', analisis: 'op', unidad: 'A', descripcion: 'corriente de fuga del condensador de abajo' },
    equilibrado: { medida: 'i(vme)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la resistencia de equilibrado de arriba (0 si están desconectadas)', requiere: ['re'] },
  },
  netlist: (c) => {
    const re = c.tiene('re') && c.cerrado('interruptor') ? ng(c.p('re')) : ABIERTA;
    return [
      `VF fte 0 DC ${num(c.p('fuente'))}`,
      'VMED fte a 0',
      `C1 a m ${ng(c.p('c1'))}`,
      `C2 m 0 ${ng(c.p('c2'))}`,
      'VF1 a f1 0',
      `RF1 f1 m ${ng(c.p('f1'))}`,
      'VF2 m f2 0',
      `RF2 f2 0 ${ng(c.p('f2'))}`,
      ...(c.tiene('re') ? ['VME a e1 0', `RE1 e1 m ${re}`, `RE2 m 0 ${re}`] : []),
    ];
  },
  describir: (c) => {
    const eq = c.tiene('re')
      ? `; resistencias de equilibrado ${c.sim('re')} de ${c.val('re')} en paralelo con cada uno, ${c.cerrado('interruptor') ? 'conectadas' : 'desconectadas'}`
      : '';
    return `Dos condensadores en serie sobre una fuente de ${c.val('fuente')}: arriba ${c.sim('c1')} de ${c.val('c1')}, con una fuga equivalente a ${c.val('f1')}; abajo ${c.sim('c2')} de ${c.val('c2')}, con una fuga equivalente a ${c.val('f2')}${eq}`;
  },
};
export default d;
