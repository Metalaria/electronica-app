// Schematic «transformador»: an ideal transformer (the book's formulas, sección 4.6: V₁/V₂ = N₁/N₂ = a, I₁/I₂ = N₂/N₁,
// P₁ ≈ P₂) between a source and a load that a switch connects. The values are effective (RMS) or peak alike: the
// circuit is linear, so the simulator checks it as DC through a voltage-controlled voltage source (the secondary) and
// a current-controlled current source (what the primary draws).
import { ng, num } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'transformador',
  titulo: 'Transformador ideal con carga',
  resumen: 'Fuente, transformador ideal de N₁ y N₂ espiras y una carga en el secundario.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión del primario (V, eficaz o de pico)' },
    n1: { obligatoria: true, descripcion: 'espiras del primario', color: 'azul' },
    n2: { obligatoria: true, descripcion: 'espiras del secundario', color: 'naranja' },
    carga: { obligatoria: true, descripcion: 'resistencia de carga del secundario (Ω)', color: 'verde', seVeCon: 'interruptor' },
    interruptor: { interruptor: true, descripcion: 'conecta la carga (abierto: secundario en vacío)', color: 'verde' },
  },
  observables: {
    secundario: { medida: 'v(s)', analisis: 'op', unidad: 'V', descripcion: 'tensión del secundario' },
    i1: { medida: 'i(vmed)', analisis: 'op', unidad: 'A', descripcion: 'corriente del primario' },
    i2: { medida: 'i(vcarga)', analisis: 'op', unidad: 'A', descripcion: 'corriente del secundario (por la carga)' },
  },
  netlist(c) {
    const a = c.p('n2') / c.p('n1');
    const cargada = c.cerrado('interruptor');
    return [
      `VF fte 0 DC ${c.p('fuente')}`,
      'VMED fte p 0',
      `E2 s 0 p 0 ${num(a)}`,
      'VCARGA s l 0',
      cargada ? `RL l 0 ${ng(c.p('carga'))}` : 'RL l 0 1e15',
      `F1 p 0 VCARGA ${num(a)}`,
    ];
  },
  describir: (c) =>
    `Transformador ideal: primario de ${c.val('n1')} espiras con ${c.val('fuente')}, secundario de ${c.val('n2')} espiras; ${c.cerrado('interruptor') ? `carga ${c.sim('carga')} de ${c.val('carga')}` : 'secundario en vacío'}`,
};
export default d;
