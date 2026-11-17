// Schematic «thevenin»: a source with its series resistance (a Thévenin equivalent, or a real source and its internal
// resistance) and a load across the terminals that a switch connects (sección 1.5: 7,2 V and 2,4 Ω; sección 1.10: a
// 9 V battery with 5 Ω into 45 Ω). Without the switch the load is always connected.
import { ng } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'thevenin',
  titulo: 'Fuente con resistencia y carga (Thévenin)',
  resumen: 'Fuente en serie con su resistencia (Thévenin o resistencia interna) y una carga en los bornes.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión en vacío, V_Th o la fem (V)' },
    rth: { obligatoria: true, descripcion: 'resistencia en serie, R_Th o la interna (Ω)', color: 'azul' },
    carga: { obligatoria: true, descripcion: 'resistencia de carga (Ω)', color: 'verde', seVeCon: 'interruptor' },
    interruptor: { interruptor: true, descripcion: 'conecta la carga (abierto: en vacío)', color: 'verde' },
  },
  // 1.2.1 (motor121): the instrument's points and branches, the parts a tap can choose (GUIA §13.1, §13.4)
  medible: (c) => ({
    puntos: { fte: 'Dentro, tras la fuente', s: 'Borne de salida, arriba', '0': 'Borne de abajo, masa' },
    ramas: { vmed: 'Rama de la fuente' },
    zonas: { fuente: 'Fuente', rth: 'Resistencia interna', ...(c.tiene('carga') ? { carga: 'Carga' } : {}), ...(c.tiene('interruptor') ? { interruptor: 'Interruptor de la carga' } : {}) },
  }),
  observables: {
    salida: { medida: 'v(s)', analisis: 'op', unidad: 'V', descripcion: 'tensión en los bornes (la de la carga)' },
    corriente: { medida: 'i(vmed)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la carga' },
    interna: { medida: 'v(a)-v(s)', analisis: 'op', unidad: 'V', descripcion: 'caída en la resistencia en serie' },
  },
  netlist: (c) => [
    `VF fte 0 DC ${c.p('fuente')}`,
    'VMED fte a 0',
    `RTH a s ${ng(c.p('rth'))}`,
    ...(c.cerrado('interruptor') ? [`RL s 0 ${ng(c.p('carga'))}`] : []),
  ],
  describir: (c) =>
    `Fuente de ${c.val('fuente')} con ${c.sim('rth')} de ${c.val('rth')} en serie; ${c.cerrado('interruptor') ? `carga ${c.sim('carga')} de ${c.val('carga')} conectada` : 'bornes en vacío, sin carga'}`,
};
export default d;
