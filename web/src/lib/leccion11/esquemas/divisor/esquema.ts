// Schematic «divisor»: a source, R arriba and R abajo in series, and an optional load across the lower one that a
// switch connects (sección 1.4 «Y su trampa»; 1.11 the voltmeter's load). The 1.1 reference lesson cap01/sec-1.4.
import { ng } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'divisor',
  titulo: 'Divisor de tensión',
  resumen: 'Fuente, dos resistencias en serie y una carga opcional en paralelo con la de abajo.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de la fuente (V)' },
    arriba: { obligatoria: true, descripcion: 'resistencia de arriba (Ω)', color: 'azul' },
    abajo: { obligatoria: true, descripcion: 'resistencia de abajo (Ω)', color: 'naranja' },
    carga: { descripcion: 'carga en paralelo con la de abajo (Ω)', color: 'verde', seVeCon: 'interruptor' },
    interruptor: { interruptor: true, descripcion: 'conecta la carga (si falta, la carga está siempre conectada)', color: 'verde' },
  },
  observables: {
    salida: { medida: 'v(salida)', analisis: 'op', unidad: 'V', descripcion: 'tensión del nodo de salida' },
    corriente: { medida: 'i(vmed)', analisis: 'op', unidad: 'A', descripcion: 'corriente de la fuente' },
    abajo: { medida: 'i(vabajo)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la resistencia de abajo' },
    carga: { medida: 'i(vcarga)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la carga (0 desconectada)', requiere: ['carga'] },
  },
  validar: (tiene) => (tiene('interruptor') && !tiene('carga') ? ['un interruptor sin carga'] : []),
  netlist(c) {
    const cargada = c.tiene('carga') && c.cerrado('interruptor');
    return [
      `VF fte 0 DC ${ng(c.p('fuente'))}`,
      'VMED fte ent 0',
      `R1 ent salida ${ng(c.p('arriba'))}`,
      'VABAJO salida b 0',
      `R2 b 0 ${ng(c.p('abajo'))}`,
      ...(c.tiene('carga') ? ['VCARGA salida c 0', `RL c 0 ${cargada ? ng(c.p('carga')) : '1e15'}`] : []),
    ];
  },
  describir: (c) =>
    `Divisor de tensión: fuente de ${c.val('fuente')}, ${c.sim('arriba')} de ${c.val('arriba')} arriba y ${c.sim('abajo')} de ${c.val('abajo')} abajo${c.tiene('carga') && c.cerrado('interruptor') ? `, con una carga de ${c.val('carga')}` : ''}`,
};
export default d;
