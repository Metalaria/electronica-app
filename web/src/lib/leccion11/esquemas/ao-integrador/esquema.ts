// Schematic «ao-integrador» (1.2, esquemas12): the inverting integrator (sección 8.2): the input through R to the −
// input, C from there to the output (and optionally R_f in parallel with C, the resistor that limits the DC gain),
// the + input to ground. Ideal, v_o(t) = v₀ − (1/(R·C))·∫v_in dt (v₀ = `v0`, the output at t = 0); in AC,
// H = −1/(jωRC), or −(R_f/R)/(1 + jωR_fC) with R_f. The amplifier is the app's model (comun-ao.ts): with rails the
// output stops at them, and the author's model holds only while it does not get there.
import { ng, num } from '../comun';
import { bordesEntrada, describirAO, describirEntrada, netlistAO, observablesAO, piezasAO, piezasEntrada } from '../comun-ao';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'ao-integrador',
  titulo: 'Integrador con operacional',
  resumen: 'La entrada por R a la entrada −, C de ella a la salida (con R_f en paralelo, opcional): v_o = v₀ − (1/RC)·∫v_in dt.',
  piezas: {
    ...piezasEntrada(),
    r: { obligatoria: true, descripcion: 'resistencia de entrada, R (Ω)', color: 'azul' },
    c: { obligatoria: true, descripcion: 'condensador de realimentación, C (F)', color: 'naranja' },
    rf: { descripcion: 'resistencia en paralelo con C, R_f (Ω; sin ella, ninguna)', color: 'naranja' },
    v0: { descripcion: 'tensión de salida en t = 0, v₀ (V; sin ella, 0)' },
    ...piezasAO(),
  },
  observables: {
    ...observablesAO(),
    ic: { medida: 'i(vmi)', analisis: 'tran', unidad: 'A', descripcion: 'corriente por R (la que carga C) frente al tiempo' },
  },
  netlist(c, analisis) {
    const v0 = c.p('v0');
    return netlistAO(
      c,
      analisis,
      (fuente) => [fuente, 'VMI in a 0', `R1 a mn ${ng(c.p('r'))}`, `C1 mn out ${ng(c.p('c'))} IC=${num(-v0)}`, ...(c.tiene('rf') ? [`RF mn out ${ng(c.p('rf'))}`] : [])],
      { mas: '0', menos: 'mn', salida: 'out' },
      { inicio: v0 },
    );
  },
  tran: { bordes: bordesEntrada },
  describir: (c) =>
    `Integrador: ${describirEntrada(c)} por ${c.sim('r')} de ${c.val('r')} a la entrada −; ${c.sim('c')} de ${c.val('c')}${c.tiene('rf') ? ` con ${c.sim('rf')} de ${c.val('rf')} en paralelo` : ''} de la entrada − a la salida; entrada + a masa; ${describirAO(c)}${c.tiene('v0') ? `; la salida empieza en ${c.val('v0')}` : ''}`,
};
export default d;
