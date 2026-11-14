// Schematic «fuente-corriente-y-tension» (1.2): the circuit of figure 22.9 (sección 22.8 «Transformación de Fuentes»:
// «con 12 V y 4 Ω en serie, 3 Ω y una fuente de 2 A entre los mismos terminales»; the node gives 60/7 = 8,57 V). A
// voltage source with its series resistance, a resistance and a current source, all three between the same two
// terminals, and an optional load that a switch connects. The source transformation of the lesson (3 A ∥ 4 Ω, 5 A ∥
// 1,71 Ω, 8,57 V with 1,71 Ω) is the model's; the drawing is always the starting circuit.
import { ng, num } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'fuente-corriente-y-tension',
  titulo: 'Fuente de tensión con su resistencia, resistencia y fuente de corriente en paralelo',
  resumen: 'Fuente de tensión con resistencia en serie, una resistencia y una fuente de corriente entre los mismos dos terminales; carga opcional.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de la fuente de tensión (V)' },
    rs: { obligatoria: true, descripcion: 'resistencia en serie con la fuente de tensión (Ω)', color: 'azul' },
    rp: { obligatoria: true, descripcion: 'resistencia entre los terminales (Ω)', color: 'naranja' },
    corriente: { obligatoria: true, descripcion: 'corriente de la fuente de corriente, hacia el terminal de arriba (A)' },
    carga: { descripcion: 'resistencia de carga en los terminales (Ω)', color: 'verde', seVeCon: 'interruptor' },
    interruptor: { interruptor: true, descripcion: 'conecta la carga (abierto: en vacío)', color: 'verde' },
  },
  observables: {
    salida: { medida: 'v(a)', analisis: 'op', unidad: 'V', descripcion: 'tensión entre los terminales' },
    rama: { medida: 'i(vm)', analisis: 'op', unidad: 'A', descripcion: 'corriente que la rama de la fuente de tensión lleva al terminal (por la resistencia en serie)' },
    paralelo: { medida: 'i(vr)', analisis: 'op', unidad: 'A', descripcion: 'corriente que baja por la resistencia entre los terminales' },
    fuentei: { medida: 'i(vi)', analisis: 'op', unidad: 'A', descripcion: 'corriente que la fuente de corriente lleva al terminal' },
    carga: { medida: 'i(vcarga)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la carga', requiere: ['carga'] },
  },
  validar: (tiene) => (tiene('interruptor') && !tiene('carga') ? ['«piezas.interruptor»: sin «carga» no hay nada que conectar'] : []),
  netlist: (c) => [
    `V1 f 0 DC ${num(c.p('fuente'))}`,
    `RS f x ${ng(c.p('rs'))}`,
    'VM x a 0',
    'VR a r 0',
    `RP r 0 ${ng(c.p('rp'))}`,
    // the current leaves the source at i (SPICE: from n+ = 0 through the source to n− = i)
    `I1 0 i DC ${num(c.p('corriente'))}`,
    'VI i a 0',
    ...(c.tiene('carga') ? ['VCARGA a l 0', `RL l 0 ${c.cerrado('interruptor') ? ng(c.p('carga')) : '1e15'}`] : []),
  ],
  describir: (c) => {
    const carga = c.tiene('carga') ? (c.cerrado('interruptor') ? `; carga ${c.sim('carga')} de ${c.val('carga')} conectada` : '; carga desconectada') : '';
    return `Entre los mismos dos terminales: fuente de ${c.val('fuente')} con ${c.sim('rs')} de ${c.val('rs')} en serie, ${c.sim('rp')} de ${c.val('rp')} y una fuente de corriente de ${c.val('corriente')} hacia el terminal de arriba${carga}`;
  },
};
export default d;
