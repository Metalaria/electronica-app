// Schematic «led»: a source, the series resistor and a LED (sección 5.3 «Un ejemplo de diseño completo»: a red LED of
// 2,0 V at 20 mA from 5 V, R = 150 Ω; its Vf from 1,8 to 2,2 V; sección 5.5 «LED»). The LED shines as its current
// over 20 mA. Constant drop «vf», or Shockley «is», «n».
// 1.2 (esquemas12d; secciones 11.9 «VCC frente a +5V» and 12.5 «una red VCC sin fuente»): «etiqueta», the LED's feed
// drawn as two net labels — the source's wire ends in one, the resistor and LED hang from another — connected only
// when the two read the same (closed, both the `sim` of «etiqueta»; open, the LED's reads the `sim` of «etiqueta2»,
// and the branch is left without a source: dark). As the divisor's «etiqueta» (esquemas12c).
import { ng } from '../comun';
import { alReves, modeloDiodo, piezaReves, piezasDiodo, validarDiodo } from '../comun-diodo';
import type { ContextoNetlist, DefinicionEsquema } from '../tipos';

/** The LED's net label does not match the source's: the branch has no supply. */
export const sinRed = (c: ContextoNetlist): boolean => c.tiene('etiqueta') && !c.cerrado('etiqueta');

const d: DefinicionEsquema = {
  nombre: 'led',
  titulo: 'LED con su resistencia',
  resumen: 'Fuente, resistencia en serie y LED; su corriente (el brillo) y su tensión.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de la fuente (V)' },
    r: { obligatoria: true, descripcion: 'resistencia en serie (Ω)', color: 'azul' },
    ...piezasDiodo('vf', 'LED'),
    // (esquemas12c: the LED reversed, as in sección 12.6's rotated footprint: it blocks and stays dark)
    reves: piezaReves(),
    etiqueta: { interruptor: true, descripcion: 'la alimentación por etiquetas de red con el nombre de su «sim»: cerrado, la de la fuente y la del LED iguales (conectado); abierto, distintas (sin alimentación)', color: 'verde' },
    etiqueta2: { descripcion: 'el nombre escrito en la etiqueta del LED, su «sim» (sin ella, el de «etiqueta»); su valor no se usa', color: 'verde' },
  },
  observables: {
    corriente: { medida: 'i(vmed)', analisis: 'op', unidad: 'A', descripcion: 'corriente del LED' },
    vf: { medida: 'v(an)', analisis: 'op', unidad: 'V', descripcion: 'tensión del LED' },
    vr: { medida: 'v(a)-v(an)', analisis: 'op', unidad: 'V', descripcion: 'tensión de la resistencia' },
  },
  validar: (tiene) => [...validarDiodo('vf')(tiene), ...(tiene('etiqueta2') && !tiene('etiqueta') ? ['«etiqueta2» es el nombre de la etiqueta del LED: hace falta «etiqueta»'] : [])],
  // 0,2 V: the book's own spread of a red LED's Vf (1,8 to 2,2 V); the simulator's LED drops vf at 20 mA with n = 2
  // («normal en LED», sección 5.3) and stays within it from 0,4 mA to 1 A
  // (reversed or without supply, the LED carries no current: the constant drop's check reads a 0 V reference at the
  // drop itself, comun-diodo.ts)
  noLineal: (tiene) => (tiene('vf') ? [{ pieza: 'vf', desviacion: 0.2, porque: 'LED de caída vf a 20 mA, n = 2: la dispersión de 1,8 a 2,2 V del libro', medida: (c) => (alReves(c) || sinRed(c) ? 'v(zrev)' : 'v(an)') }] : []),
  netlist: (c) => [
    `VF fte 0 DC ${c.p('fuente')}`,
    // (a label that does not match: the branch hangs from a node of its own, «fa», that nothing feeds)
    sinRed(c) ? 'VMED fa a 0' : 'VMED fte a 0',
    `R1 a an ${ng(c.p('r'))}`,
    alReves(c) ? 'D1 0 an DLED' : 'D1 an 0 DLED',
    ...((alReves(c) || sinRed(c)) && c.tiene('vf') ? [`VREVES zrev 0 DC ${c.p('vf')}`] : []),
    ...modeloDiodo(c, 'DLED', 'vf', 20e-3, 2),
  ],
  describir: (c) =>
    `Fuente de ${c.val('fuente')}, ${c.sim('r')} de ${c.val('r')} y un LED en serie${c.tiene('vf') ? ` de ${c.val('vf')}` : ''}${alReves(c) ? ', montado al revés' : ''}${c.tiene('etiqueta') ? `; la fuente lleva la etiqueta de red «${c.sim('etiqueta')}» y la resistencia del LED cuelga de la etiqueta «${c.sim(c.tiene('etiqueta2') && sinRed(c) ? 'etiqueta2' : 'etiqueta')}»${sinRed(c) ? ': no son la misma red y el LED queda sin alimentación' : ''}` : ''}`,
};
export default d;
