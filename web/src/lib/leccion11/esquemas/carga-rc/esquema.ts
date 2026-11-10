// Schematic «carga-rc»: a capacitor charged or discharged through a resistor from t = 0 (sección 3.2: 100 µF, 10 kΩ,
// 9 V, τ = 1 s; the 63,2 % at 1τ). The switch piece chooses charge (1: to the source) or discharge (0: to ground);
// «v0» is the capacitor's voltage at t = 0. Curves against time: the simulator's transient from that initial state.
import { ng, num } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'carga-rc',
  titulo: 'Carga y descarga de un condensador (RC)',
  resumen: 'Fuente, conmutador, R y C desde t = 0; tensión del condensador, de la resistencia y corriente frente al tiempo.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de la fuente (V)' },
    r: { obligatoria: true, descripcion: 'resistencia (Ω)', color: 'azul' },
    c: { obligatoria: true, descripcion: 'capacidad (F)', color: 'naranja' },
    v0: { descripcion: 'tensión del condensador en t = 0 (V); sin ella, descargado' },
    interruptor: { interruptor: true, descripcion: 'conmutador: 1 carga desde la fuente, 0 descarga a masa (sin él, carga)' },
  },
  observables: {
    vc: { medida: 'v(c)', analisis: 'tran', unidad: 'V', descripcion: 'tensión del condensador, v_C(t)' },
    vr: { medida: 'v(a)-v(c)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la resistencia' },
    i: { medida: 'i(vmed)', analisis: 'tran', unidad: 'A', descripcion: 'corriente (positiva al cargar)' },
  },
  netlist: (c) => [
    `VF fte 0 DC ${c.cerrado('interruptor') ? num(c.p('fuente')) : 0}`,
    'VMED fte a 0',
    `R1 a c ${ng(c.p('r'))}`,
    `C1 c 0 ${ng(c.p('c'))} IC=${num(c.p('v0'))}`,
  ],
  describir: (c) =>
    `Circuito RC: ${c.cerrado('interruptor') ? `se carga desde una fuente de ${c.val('fuente')}` : 'se descarga a masa'} a través de ${c.sim('r')} de ${c.val('r')}; condensador ${c.sim('c')} de ${c.val('c')}${c.tiene('v0') ? `, que empieza con ${c.val('v0')}` : ', que empieza descargado'}`,
};
export default d;
