// Schematic «induccion» (1.2, esquemas12d; sección 34.4 «El Motor de Inducción», figura 34.5, bloques 64 to 76): the
// per-phase equivalent circuit of the induction motor, in equivalent star and referred to the stator, as the book
// solves it in ngspice (bloque 72, «un análisis de alterna a 50 Hz para cada deslizamiento»): the phase voltage, the
// stator R₁ + jX₁, the parallel branch R_Fe ∥ jX_m at the air gap, and the rotor jX₂′ + R₂′/s split as the book
// splits it — R₂′, the rotor's copper, and R₂′·(1 − s)/s, the fictitious resistor whose power is the mechanical one.
// The slip «s» is a piece (0 < s ≤ 1; 1 at standstill). The reactances are given at «fn» (the nominal frequency;
// without it, at «f») and scale with f, as in a V/f drive (sección 34.6). AC only. The torque is not a phasor: the
// card's model works it out from the rotor current the simulator checks, T = 3·I₂′²·(R₂′/s)/ω_s (Ec. 2).
import { ng, num } from '../comun';
import { observablesCA } from '../comun-ca';
import type { ContextoNetlist, DefinicionEsquema } from '../tipos';

/** The inductance of a reactance given at the nominal frequency. */
const ind = (c: ContextoNetlist, x: string) => c.p(x) / (2 * Math.PI * (c.tiene('fn') ? c.p('fn') : c.p('f')));
/** The slip, kept off zero (the rotor branch would be open). */
export const deslizamiento = (c: ContextoNetlist): number => Math.min(1, Math.max(1e-6, c.p('s')));

const d: DefinicionEsquema = {
  nombre: 'induccion',
  titulo: 'Motor de inducción: circuito equivalente por fase',
  resumen: 'Tensión de fase, R₁ + jX₁ del estátor, la rama paralelo R_Fe ∥ jX_m y el rotor jX₂′ + R₂′ + R₂′·(1 − s)/s; el deslizamiento como mando.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de fase (V eficaces: las corrientes salen eficaces), en estrella equivalente' },
    f: { obligatoria: true, descripcion: 'frecuencia de la alimentación (Hz)' },
    fn: { descripcion: 'frecuencia a la que se dan las reactancias (Hz; sin ella, «f»): con un variador, X = X_n·f/f_n' },
    r1: { obligatoria: true, descripcion: 'resistencia del estátor, R₁ (Ω)', color: 'azul' },
    x1: { obligatoria: true, descripcion: 'reactancia de dispersión del estátor, X₁ (Ω a «fn»)', color: 'azul' },
    xm: { obligatoria: true, descripcion: 'reactancia magnetizante, X_m (Ω a «fn»)', color: 'naranja' },
    rfe: { descripcion: 'resistencia de pérdidas del hierro, R_Fe (Ω; sin ella, ninguna)', color: 'naranja' },
    x2: { obligatoria: true, descripcion: 'reactancia del rotor referida al estátor, X₂′ (Ω a «fn»)', color: 'verde' },
    r2: { obligatoria: true, descripcion: 'resistencia del rotor referida al estátor, R₂′ (Ω)', color: 'verde' },
    s: { obligatoria: true, descripcion: 'deslizamiento s = (n_s − n)/n_s (de 0 a 1; 1 parado): la carga mecánica R₂′·(1 − s)/s', color: 'verde' },
  },
  observables: {
    ...observablesCA('linea', 'i(vmi)', 'A', 'la corriente de línea (del estátor), I₁'),
    ...observablesCA('rotor', 'i(vm2)', 'A', 'la corriente del rotor referida al estátor, I₂′'),
    ...observablesCA('magnetizante', 'i(vmm)', 'A', 'la corriente magnetizante'),
    ...observablesCA('entrehierro', 'v(g)', 'V', 'la tensión del entrehierro, E'),
    ...observablesCA('eje', 'v(u)', 'V', 'la tensión en R₂′·(1 − s)/s, la carga mecánica'),
  },
  netlist(c) {
    const s = deslizamiento(c);
    return [
      `VF fte 0 DC 0 AC ${num(c.p('fuente'))} 0`,
      'VMI fte a 0',
      `R1 a b ${ng(c.p('r1'))}`,
      `L1 b g ${ng(ind(c, 'x1'))}`,
      ...(c.tiene('rfe') ? [`RFE g 0 ${ng(c.p('rfe'))}`] : []),
      'VMM g m 0',
      `LM m 0 ${ng(ind(c, 'xm'))}`,
      'VM2 g r 0',
      `L2 r q ${ng(ind(c, 'x2'))}`,
      `R2 q u ${ng(c.p('r2'))}`,
      `RMEC u 0 ${ng((c.p('r2') * (1 - s)) / s)}`,
    ];
  },
  describir: (c) =>
    `Motor de inducción, circuito equivalente por fase: ${c.val('fuente')} de fase a ${c.val('f')}; estátor ${c.sim('r1')} de ${c.val('r1')} y ${c.sim('x1')} de ${c.val('x1')}; en el entrehierro, ${c.sim('xm')} de ${c.val('xm')}${c.tiene('rfe') ? ` en paralelo con ${c.sim('rfe')} de ${c.val('rfe')}` : ''}; rotor ${c.sim('x2')} de ${c.val('x2')}, ${c.sim('r2')} de ${c.val('r2')} y la carga mecánica R₂′·(1 − s)/s con un deslizamiento de ${(deslizamiento(c) * 100).toLocaleString('es-ES', { maximumSignificantDigits: 3 })} %${c.tiene('fn') ? `; reactancias dadas a ${c.val('fn')}` : ''}`,
};
export default d;
