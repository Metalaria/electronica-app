// Schematic «mixto»: R1 in series with the parallel pair R2 ‖ R3 (sección 1.4 «Redes mixtas: el método»; 2.9).
import { ng } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'mixto',
  titulo: 'Red mixta: serie y paralelo',
  resumen: 'R₁ en serie con el paralelo R₂ ‖ R₃; corriente total, la de cada rama y las dos tensiones.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de la fuente (V)' },
    r1: { obligatoria: true, descripcion: 'resistencia en serie, arriba (Ω)', color: 'azul' },
    r2: { obligatoria: true, descripcion: 'primera rama del paralelo (Ω)', color: 'naranja' },
    r3: { obligatoria: true, descripcion: 'segunda rama del paralelo (Ω)', color: 'verde' },
  },
  observables: {
    corriente: { medida: 'i(vmed)', analisis: 'op', unidad: 'A', descripcion: 'corriente total (por R₁)' },
    i2: { medida: 'i(v2)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la rama de R₂' },
    i3: { medida: 'i(v3)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la rama de R₃' },
    v1: { medida: 'v(a)-v(b)', analisis: 'op', unidad: 'V', descripcion: 'tensión en R₁' },
    paralelo: { medida: 'v(b)', analisis: 'op', unidad: 'V', descripcion: 'tensión del paralelo' },
  },
  netlist: (c) => [
    `VF fte 0 DC ${ng(c.p('fuente'))}`,
    'VMED fte a 0',
    `R1 a b ${ng(c.p('r1'))}`,
    'V2 b x 0',
    `R2 x 0 ${ng(c.p('r2'))}`,
    'V3 b y 0',
    `R3 y 0 ${ng(c.p('r3'))}`,
  ],
  describir: (c) =>
    `Red mixta con una fuente de ${c.val('fuente')}: ${c.sim('r1')} de ${c.val('r1')} en serie con el paralelo de ${c.sim('r2')}, ${c.val('r2')}, y ${c.sim('r3')}, ${c.val('r3')}`,
};
export default d;
