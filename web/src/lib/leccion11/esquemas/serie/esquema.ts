// Schematic «serie»: a source and two to four resistors in series round one loop (sección 1.3, the 12 V loop with
// 4, 6 and 2 Ω; sección 1.4, 100 + 220 + 470 Ω). Measures the loop's current and each resistor's voltage.
import { ng } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const RS = ['r1', 'r2', 'r3', 'r4'] as const;
const d: DefinicionEsquema = {
  nombre: 'serie',
  titulo: 'Resistencias en serie',
  resumen: 'Fuente y de dos a cuatro resistencias en un solo lazo; la corriente común y la tensión de cada una.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de la fuente (V)' },
    r1: { obligatoria: true, descripcion: 'primera resistencia, arriba a la izquierda (Ω)', color: 'azul' },
    r2: { obligatoria: true, descripcion: 'segunda resistencia, arriba a la derecha (Ω)', color: 'naranja' },
    r3: { descripcion: 'tercera resistencia, a la derecha (Ω)', color: 'verde' },
    r4: { descripcion: 'cuarta resistencia, abajo (Ω)', color: 'azul' },
  },
  observables: {
    corriente: { medida: 'i(vmed)', analisis: 'op', unidad: 'A', descripcion: 'corriente del lazo' },
    v1: { medida: 'v(a0)-v(a1)', analisis: 'op', unidad: 'V', descripcion: 'tensión en la primera resistencia' },
    v2: { medida: 'v(a1)-v(a2)', analisis: 'op', unidad: 'V', descripcion: 'tensión en la segunda' },
    v3: { medida: 'v(a2)-v(a3)', analisis: 'op', unidad: 'V', descripcion: 'tensión en la tercera', requiere: ['r3'] },
    v4: { medida: 'v(a3)-v(a4)', analisis: 'op', unidad: 'V', descripcion: 'tensión en la cuarta', requiere: ['r3', 'r4'] },
  },
  validar: (tiene) => (tiene('r4') && !tiene('r3') ? ['«r4» sin «r3» (se ponen en orden)'] : []),
  netlist(c) {
    const rs = RS.filter((r) => c.tiene(r));
    return [
      `VF fte 0 DC ${ng(c.p('fuente'))}`,
      'VMED fte a0 0',
      ...rs.map((r, k) => `R${k + 1} a${k} a${k + 1} ${ng(c.p(r))}`),
      `VFIN a${rs.length} 0 0`,
    ];
  },
  describir: (c) =>
    `Resistencias en serie con una fuente de ${c.val('fuente')}: ${RS.filter((r) => c.tiene(r)).map((r) => `${c.sim(r)} de ${c.val(r)}`).join(', ')}`,
};
export default d;
