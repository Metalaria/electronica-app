// Schematic «resistencia»: a source and a single resistor (sección 1.1, 220 Ω on 12 V; sección 1.2, the law of Ohm and
// a resistance that changes with temperature). Measures the current and the resistor's voltage.
import { ng } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'resistencia',
  titulo: 'Una fuente y una resistencia',
  resumen: 'Fuente y una sola resistencia; la corriente que circula y la tensión en la resistencia (ley de Ohm).',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de la fuente (V)' },
    r: { obligatoria: true, descripcion: 'resistencia (Ω)', color: 'naranja' },
  },
  observables: {
    corriente: { medida: 'i(vmed)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la resistencia' },
    tension: { medida: 'v(a)', analisis: 'op', unidad: 'V', descripcion: 'tensión en la resistencia' },
  },
  netlist: (c) => [`VF fte 0 DC ${ng(c.p('fuente'))}`, 'VMED fte a 0', `R1 a 0 ${ng(c.p('r'))}`],
  describir: (c) => `Una fuente de ${c.val('fuente')} conectada a una resistencia ${c.sim('r')} de ${c.val('r')}`,
};
export default d;
