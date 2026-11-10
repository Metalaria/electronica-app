// Schematic «wheatstone»: two dividers on the same source, R1 over R2 and R3 over R4, and a detector between their
// midpoints (sección 1.9: balanced when R₁/R₂ = R₃/R₄; 5 V and an arm from 1000 to 1010 Ω; 2.7 «El Puente de
// Wheatstone»). The detector is an ideal voltmeter, or a resistance (piece «rd») to see the current it takes.
import { ng } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'wheatstone',
  titulo: 'Puente de Wheatstone',
  resumen: 'Dos divisores sobre la misma fuente y un detector entre sus puntos medios.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de alimentación (V)' },
    r1: { obligatoria: true, descripcion: 'rama izquierda, arriba (Ω)', color: 'azul' },
    r2: { obligatoria: true, descripcion: 'rama izquierda, abajo (Ω)', color: 'azul' },
    r3: { obligatoria: true, descripcion: 'rama derecha, arriba (Ω)', color: 'naranja' },
    r4: { obligatoria: true, descripcion: 'rama derecha, abajo (Ω)', color: 'naranja' },
    rd: { descripcion: 'resistencia del detector (Ω); sin ella, un voltímetro ideal', color: 'verde' },
  },
  observables: {
    salida: { medida: 'v(a)-v(b)', analisis: 'op', unidad: 'V', descripcion: 'tensión del detector (punto medio izquierdo menos derecho)' },
    va: { medida: 'v(a)', analisis: 'op', unidad: 'V', descripcion: 'punto medio de la rama izquierda' },
    vb: { medida: 'v(b)', analisis: 'op', unidad: 'V', descripcion: 'punto medio de la rama derecha' },
    corriente: { medida: 'i(vmed)', analisis: 'op', unidad: 'A', descripcion: 'corriente de la fuente' },
    detector: { medida: 'i(vd)', analisis: 'op', unidad: 'A', descripcion: 'corriente por el detector, de izquierda a derecha', requiere: ['rd'] },
  },
  netlist: (c) => [
    `VF fte 0 DC ${ng(c.p('fuente'))}`,
    'VMED fte t 0',
    `R1 t a ${ng(c.p('r1'))}`,
    `R2 a 0 ${ng(c.p('r2'))}`,
    `R3 t b ${ng(c.p('r3'))}`,
    `R4 b 0 ${ng(c.p('r4'))}`,
    ...(c.tiene('rd') ? ['VD a d 0', `RD d b ${ng(c.p('rd'))}`] : []),
  ],
  describir: (c) =>
    `Puente de Wheatstone con ${c.val('fuente')}: a la izquierda ${c.sim('r1')} de ${c.val('r1')} sobre ${c.sim('r2')} de ${c.val('r2')}; a la derecha ${c.sim('r3')} de ${c.val('r3')} sobre ${c.sim('r4')} de ${c.val('r4')}; detector entre los puntos medios${c.tiene('rd') ? ` de ${c.val('rd')}` : ''}`,
};
export default d;
