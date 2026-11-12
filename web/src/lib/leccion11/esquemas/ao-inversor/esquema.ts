// Schematic «ao-inversor» (1.2, esquemas12): the inverting amplifier (sección 8.2): the input through R₁ to the − input,
// R₂ from there to the output, the + input to ground; an optional load at the output. Ideal, v_o = −(R₂/R₁)·v_in; the
// amplifier is the app's model (comun-ao.ts: A₀ = 10⁵, rails, GBW and slew rate when the widget gives them), so with
// A₀ finite the gain is −(R₂/R₁)/(1 + (1 + R₂/R₁)/A₀) — within 0,1 % of the ideal up to a gain of about 100.
import { ng } from '../comun';
import { bordesEntrada, describirAO, describirEntrada, netlistAO, observablesAO, piezasAO, piezasEntrada } from '../comun-ao';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'ao-inversor',
  titulo: 'Amplificador inversor con operacional',
  resumen: 'La entrada por R₁ a la entrada −, R₂ de ella a la salida, la entrada + a masa: v_o = −(R₂/R₁)·v_in, hasta la saturación.',
  piezas: {
    ...piezasEntrada(),
    r1: { obligatoria: true, descripcion: 'resistencia de entrada, R₁ (Ω)', color: 'azul' },
    r2: { obligatoria: true, descripcion: 'resistencia de realimentación, R₂ (Ω)', color: 'naranja' },
    carga: { descripcion: 'resistencia de carga en la salida (Ω)' },
    ...piezasAO(),
  },
  observables: {
    ...observablesAO(),
    vmenos: { medida: 'v(mn)', analisis: 'op', unidad: 'V', descripcion: 'tensión de la entrada − (la masa virtual)' },
    i1: { medida: 'i(vmi)', analisis: 'op', unidad: 'A', descripcion: 'corriente por R₁ (de la entrada hacia la entrada −)' },
    carga: { medida: 'i(vml)', analisis: 'op', unidad: 'A', descripcion: 'corriente por la carga', requiere: ['carga'] },
  },
  netlist: (c, analisis) =>
    netlistAO(
      c,
      analisis,
      (fuente) => [fuente, 'VMI in a 0', `R1 a mn ${ng(c.p('r1'))}`, `R2 mn out ${ng(c.p('r2'))}`, ...(c.tiene('carga') ? ['VML out l 0', `RL l 0 ${ng(c.p('carga'))}`] : [])],
      { mas: '0', menos: 'mn', salida: 'out' },
    ),
  tran: { bordes: bordesEntrada },
  describir: (c) =>
    `Amplificador inversor: ${describirEntrada(c)} por ${c.sim('r1')} de ${c.val('r1')} a la entrada −; ${c.sim('r2')} de ${c.val('r2')} de la entrada − a la salida; entrada + a masa; ${describirAO(c)}${c.tiene('carga') ? `; carga de ${c.val('carga')}` : ''}`,
};
export default d;
