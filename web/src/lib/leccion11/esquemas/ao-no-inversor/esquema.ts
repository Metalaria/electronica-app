// Schematic «ao-no-inversor» (1.2, esquemas12): the non-inverting amplifier (sección 8.2): the input to the + input, R₂
// from the output to the − input and R₁ from there to ground, v_o = (1 + R₂/R₁)·v_in; without R₁ it is the voltage
// follower (the output joined to the − input: gain 1). An optional load at the output. The amplifier is the app's
// model (comun-ao.ts).
import { ng } from '../comun';
import { bordesEntrada, describirAO, describirEntrada, netlistAO, observablesAO, piezasAO, piezasEntrada } from '../comun-ao';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'ao-no-inversor',
  titulo: 'Amplificador no inversor y seguidor con operacional',
  resumen: 'La entrada a la entrada +, R₂ de la salida a la entrada − y R₁ a masa: v_o = (1 + R₂/R₁)·v_in; sin R₁, el seguidor.',
  piezas: {
    ...piezasEntrada(),
    r1: { descripcion: 'resistencia de la entrada − a masa, R₁ (Ω); sin ella, seguidor', color: 'azul' },
    r2: { descripcion: 'resistencia de realimentación, de la salida a la entrada −, R₂ (Ω; con R₁)', color: 'naranja' },
    carga: { descripcion: 'resistencia de carga en la salida (Ω)' },
    ...piezasAO(),
  },
  observables: {
    ...observablesAO(),
    vmenos: { medida: 'v(mn)', analisis: 'op', unidad: 'V', descripcion: 'tensión de la entrada −' },
    i1: { medida: 'i(vmi)', analisis: 'op', unidad: 'A', descripcion: 'corriente por R₁ (de la entrada − a masa)', requiere: ['r1'] },
    carga: { medida: 'i(vml)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la carga', requiere: ['carga'] },
  },
  validar: (tiene) => (tiene('r1') !== tiene('r2') ? ['«r1» y «r2» van juntas (sin ninguna de las dos, seguidor)'] : []),
  netlist: (c, analisis) =>
    netlistAO(
      c,
      analisis,
      (fuente) => [
        fuente,
        ...(c.tiene('r1') ? [`R2 out mn ${ng(c.p('r2'))}`, 'VMI mn a 0', `R1 a 0 ${ng(c.p('r1'))}`] : ['VMI out mn 0']),
        ...(c.tiene('carga') ? ['VML out l 0', `RL l 0 ${ng(c.p('carga'))}`] : []),
      ],
      { mas: 'in', menos: 'mn', salida: 'out' },
    ),
  tran: { bordes: bordesEntrada },
  describir: (c) =>
    c.tiene('r1')
      ? `Amplificador no inversor: ${describirEntrada(c)} a la entrada +; ${c.sim('r2')} de ${c.val('r2')} de la salida a la entrada − y ${c.sim('r1')} de ${c.val('r1')} de ella a masa; ${describirAO(c)}${c.tiene('carga') ? `; carga de ${c.val('carga')}` : ''}`
      : `Seguidor de tensión: ${describirEntrada(c)} a la entrada +, la salida unida a la entrada −; ${describirAO(c)}${c.tiene('carga') ? `; carga de ${c.val('carga')}` : ''}`,
};
export default d;
