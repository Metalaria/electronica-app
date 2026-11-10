// Schematic «led»: a source, the series resistor and a LED (sección 5.3 «Un ejemplo de diseño completo»: a red LED of
// 2,0 V at 20 mA from 5 V, R = 150 Ω; its Vf from 1,8 to 2,2 V; sección 5.5 «LED»). The LED shines as its current
// over 20 mA. Constant drop «vf», or Shockley «is», «n».
import { ng } from '../comun';
import { modeloDiodo, noLinealDiodo, piezasDiodo, validarDiodo } from '../comun-diodo';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'led',
  titulo: 'LED con su resistencia',
  resumen: 'Fuente, resistencia en serie y LED; su corriente (el brillo) y su tensión.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de la fuente (V)' },
    r: { obligatoria: true, descripcion: 'resistencia en serie (Ω)', color: 'azul' },
    ...piezasDiodo('vf', 'LED'),
  },
  observables: {
    corriente: { medida: 'i(vmed)', analisis: 'op', unidad: 'A', descripcion: 'corriente del LED' },
    vf: { medida: 'v(an)', analisis: 'op', unidad: 'V', descripcion: 'tensión del LED' },
    vr: { medida: 'v(a)-v(an)', analisis: 'op', unidad: 'V', descripcion: 'tensión de la resistencia' },
  },
  validar: validarDiodo('vf'),
  // 0,2 V: the book's own spread of a red LED's Vf (1,8 to 2,2 V); the simulator's LED drops vf at 20 mA with n = 2
  // («normal en LED», sección 5.3) and stays within it from 0,4 mA to 1 A
  noLineal: noLinealDiodo('vf', 0.2, 'LED de caída vf a 20 mA, n = 2: la dispersión de 1,8 a 2,2 V del libro', 'v(an)'),
  netlist: (c) => [`VF fte 0 DC ${c.p('fuente')}`, 'VMED fte a 0', `R1 a an ${ng(c.p('r'))}`, 'D1 an 0 DLED', ...modeloDiodo(c, 'DLED', 'vf', 20e-3, 2)],
  describir: (c) => `Fuente de ${c.val('fuente')}, ${c.sim('r')} de ${c.val('r')} y un LED en serie${c.tiene('vf') ? ` de ${c.val('vf')}` : ''}`,
};
export default d;
