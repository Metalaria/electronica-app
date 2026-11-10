// Schematic «carga-rl»: a coil's current building up (or dying away) through a resistor from t = 0 (sección 4.3:
// i(t) = V/R·(1 − e^(−t/τ)), τ = L/R; 10 mH with 100 Ω, τ = 100 µs). The switch piece chooses connection (1: to the
// source) or the decay through the resistor (0: to ground); «i0» is the current at t = 0.
import { ng, num } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'carga-rl',
  titulo: 'Transitorio de una bobina (RL)',
  resumen: 'Fuente, conmutador, R y L desde t = 0; corriente y tensiones de la bobina y la resistencia frente al tiempo.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de la fuente (V)' },
    r: { obligatoria: true, descripcion: 'resistencia (Ω)', color: 'azul' },
    l: { obligatoria: true, descripcion: 'inductancia (H)', color: 'naranja' },
    i0: { descripcion: 'corriente de la bobina en t = 0 (A); sin ella, cero' },
    interruptor: { interruptor: true, descripcion: 'conmutador: 1 conectada a la fuente, 0 descarga por la resistencia (sin él, conectada)' },
  },
  observables: {
    i: { medida: 'i(vmed)', analisis: 'tran', unidad: 'A', descripcion: 'corriente del lazo, i(t)' },
    vl: { medida: 'v(c)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la bobina' },
    vr: { medida: 'v(a)-v(c)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la resistencia' },
  },
  netlist: (c) => [
    `VF fte 0 DC ${c.cerrado('interruptor') ? num(c.p('fuente')) : 0}`,
    'VMED fte a 0',
    `R1 a c ${ng(c.p('r'))}`,
    `L1 c 0 ${ng(c.p('l'))} IC=${num(c.p('i0'))}`,
  ],
  describir: (c) =>
    `Circuito RL: ${c.cerrado('interruptor') ? `conectado a una fuente de ${c.val('fuente')}` : 'la bobina se descarga por la resistencia'}; ${c.sim('r')} de ${c.val('r')} y bobina ${c.sim('l')} de ${c.val('l')}`,
};
export default d;
