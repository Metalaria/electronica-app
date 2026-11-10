// Schematic «paralelo»: a source and two resistors in parallel (sección 1.4 «Paralelo: la tensión manda»).
import { ng } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'paralelo',
  titulo: 'Dos resistencias en paralelo',
  resumen: 'Fuente y dos ramas en paralelo; mide la corriente total y la de cada rama.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de la fuente (V)' },
    r1: { obligatoria: true, descripcion: 'resistencia de la primera rama (Ω)', color: 'azul' },
    r2: { obligatoria: true, descripcion: 'resistencia de la segunda rama (Ω)', color: 'naranja' },
  },
  observables: {
    total: { medida: 'i(vmed)', analisis: 'op', unidad: 'A', descripcion: 'corriente total de la fuente' },
    i1: { medida: 'i(v1)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la primera rama' },
    i2: { medida: 'i(v2)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la segunda rama' },
  },
  netlist: (c) => [`VF fte 0 DC ${ng(c.p('fuente'))}`, 'VMED fte ent 0', 'V1 ent a 0', `R1 a 0 ${ng(c.p('r1'))}`, 'V2 ent b 0', `R2 b 0 ${ng(c.p('r2'))}`],
  describir: (c) => `Dos resistencias en paralelo con una fuente de ${c.val('fuente')}: ${c.sim('r1')} de ${c.val('r1')} y ${c.sim('r2')} de ${c.val('r2')}`,
};
export default d;
