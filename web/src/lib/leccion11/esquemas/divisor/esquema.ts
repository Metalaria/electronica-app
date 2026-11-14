// Schematic «divisor»: a source, R arriba and R abajo in series, and an optional load across the lower one that a
// switch connects (sección 1.4 «Y su trampa»; 1.11 the voltmeter's load). The 1.1 reference lesson cap01/sec-1.4.
// 1.2 (esquemas12c; secciones 11.6, 11.11): the load's connection drawn as the schematic reading it teaches —
// «union», a crossing of the output wire and the load's lead, connected only with its dot (closed); «etiqueta», the
// load on its own with a net label: connected when the two labels read the same (closed). The labels are the `sim` of
// the pieces «etiqueta» (at the output) and «etiqueta2» (at the load; without it, the same): a lesson writes the typo
// in etiqueta2's sim and opens the switch.
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
    union: { interruptor: true, descripcion: 'la carga cuelga de un cruce con el hilo de salida: cerrado, con punto de unión (conectada); abierto, cruce sin punto (no conectada)', color: 'verde' },
    etiqueta: { interruptor: true, descripcion: 'la carga, aparte, unida por una etiqueta de red con el nombre de su «sim»: cerrado, las dos etiquetas iguales (conectada); abierto, distintas', color: 'verde' },
    etiqueta2: { descripcion: 'el nombre escrito en la etiqueta de la carga, su «sim» (sin ella, el de «etiqueta»); su valor no se usa', color: 'verde' },
  },
  observables: {
    salida: { medida: 'v(salida)', analisis: 'op', unidad: 'V', descripcion: 'tensión del nodo de salida' },
    corriente: { medida: 'i(vmed)', analisis: 'op', unidad: 'A', descripcion: 'corriente de la fuente' },
    abajo: { medida: 'i(vabajo)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la resistencia de abajo' },
    carga: { medida: 'i(vcarga)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la carga (0 desconectada)', requiere: ['carga'] },
  },
  validar: (tiene) => [
    ...(tiene('interruptor') && !tiene('carga') ? ['un interruptor sin carga'] : []),
    ...((tiene('union') || tiene('etiqueta')) && !tiene('carga') ? ['«union» y «etiqueta» unen la carga: hace falta «carga»'] : []),
    ...(tiene('union') && tiene('etiqueta') ? ['o «union» o «etiqueta», no las dos'] : []),
    ...(tiene('etiqueta2') && !tiene('etiqueta') ? ['«etiqueta2» es el nombre de la etiqueta de la carga: hace falta «etiqueta»'] : []),
  ],
  netlist(c) {
    const cargada = c.tiene('carga') && c.cerrado('interruptor') && c.cerrado('union') && c.cerrado('etiqueta');
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
    `Divisor de tensión: fuente de ${c.val('fuente')}, ${c.sim('arriba')} de ${c.val('arriba')} arriba y ${c.sim('abajo')} de ${c.val('abajo')} abajo${c.tiene('carga') && c.cerrado('interruptor') && c.cerrado('union') && c.cerrado('etiqueta') ? `, con una carga de ${c.val('carga')}` : ''}${c.tiene('union') ? (c.cerrado('union') ? '; la carga cuelga de un cruce con punto de unión' : '; el hilo de la carga cruza el de salida sin punto: no están unidos') : ''}${c.tiene('etiqueta') ? `; la salida lleva la etiqueta «${c.sim('etiqueta')}» y la carga «${c.sim(c.tiene('etiqueta2') && !c.cerrado('etiqueta') ? 'etiqueta2' : 'etiqueta')}»` : ''}`,
};
export default d;
