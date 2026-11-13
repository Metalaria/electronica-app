// Schematic «wien» (1.2, esquemas12d; secciones 27.1 and 27.4 «Osciladores RC», bloques 10, 202, 205): the Wien-bridge
// oscillator's feedback network — R₁ in series with C₁ from the input (the amplifier's output) to the output node, R₂ ∥ C₂
// to ground. β = Z₂/(Z₁ + Z₂); with R₁ = R₂ = R and C₁ = C₂ = C, at f₀ = 1/(2π·R·C) the phase is zero and |β| = 1/3
// («su red tiene desfase cero a esa frecuencia y atenúa por 3»): 10 kΩ and 10 nF give 1 592 Hz. AC only.
import { ng, num } from '../comun';
import { observablesCA } from '../comun-ca';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'wien',
  titulo: 'Red de Wien (oscilador de puente de Wien)',
  resumen: 'R₁ y C₁ en serie de la entrada a la salida, R₂ ∥ C₂ de la salida a masa: fase nula y 1/3 en f₀ = 1/(2πRC).',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'amplitud de la entrada (V de pico: la salida del amplificador)' },
    f: { descripcion: 'frecuencia de una lectura (Hz; las curvas barren la frecuencia)' },
    r1: { obligatoria: true, descripcion: 'resistencia en serie, R₁ (Ω)', color: 'azul' },
    c1: { obligatoria: true, descripcion: 'condensador en serie, C₁ (F)', color: 'azul' },
    r2: { descripcion: 'resistencia en paralelo, R₂ (Ω; sin ella, R₁)', color: 'naranja' },
    c2: { descripcion: 'condensador en paralelo, C₂ (F; sin él, C₁)', color: 'naranja' },
  },
  observables: { ...observablesCA('salida', 'v(o)', 'V', 'la salida de la red (β por la amplitud de la entrada)') },
  netlist: (c) => [
    `VF in 0 DC 0 AC ${num(c.p('fuente'))} 0`,
    `R1 in m ${ng(c.p('r1'))}`,
    `C1 m o ${ng(c.p('c1'))}`,
    `R2 o 0 ${ng(c.tiene('r2') ? c.p('r2') : c.p('r1'))}`,
    `C2 o 0 ${ng(c.tiene('c2') ? c.p('c2') : c.p('c1'))}`,
  ],
  describir: (c) =>
    `Red de Wien: entrada de ${c.val('fuente')}; ${c.sim('r1')} de ${c.val('r1')} y ${c.sim('c1')} de ${c.val('c1')} en serie hasta la salida; ${c.tiene('r2') ? `${c.sim('r2')} de ${c.val('r2')}` : 'otra resistencia igual'} y ${c.tiene('c2') ? `${c.sim('c2')} de ${c.val('c2')}` : 'otro condensador igual'} en paralelo de la salida a masa`,
};
export default d;
