// Schematic «norton»: a current source with its resistance in parallel and a load that a switch connects (sección 1.5
// «Norton, y por qué son el mismo teorema»: 3 A and 2,4 Ω; sección 1.10 «Fuentes de corriente reales»).
import { ng } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'norton',
  titulo: 'Fuente de corriente con resistencia en paralelo (Norton)',
  resumen: 'Fuente de corriente, su resistencia en paralelo y una carga en los bornes.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'corriente de la fuente, I_N (A)' },
    rn: { obligatoria: true, descripcion: 'resistencia en paralelo, R_Th (Ω)', color: 'azul' },
    carga: { obligatoria: true, descripcion: 'resistencia de carga (Ω)', color: 'verde', seVeCon: 'interruptor' },
    interruptor: { interruptor: true, descripcion: 'conecta la carga (abierto: en vacío)', color: 'verde' },
  },
  observables: {
    salida: { medida: 'v(s)', analisis: 'op', unidad: 'V', descripcion: 'tensión en los bornes' },
    carga: { medida: 'i(vcarga)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la carga' },
    paralelo: { medida: 'i(vr)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la resistencia en paralelo' },
  },
  netlist: (c) => [
    `IN 0 s DC ${c.p('fuente')}`,
    'VR s r 0',
    `RN r 0 ${ng(c.p('rn'))}`,
    'VCARGA s l 0',
    `RL l 0 ${c.cerrado('interruptor') ? ng(c.p('carga')) : '1e15'}`,
  ],
  describir: (c) =>
    `Fuente de corriente de ${c.val('fuente')} con ${c.sim('rn')} de ${c.val('rn')} en paralelo; ${c.cerrado('interruptor') ? `carga ${c.sim('carga')} de ${c.val('carga')} conectada` : 'bornes en vacío'}`,
};
export default d;
