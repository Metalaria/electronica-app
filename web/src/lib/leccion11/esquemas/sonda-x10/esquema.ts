// Schematic «sonda-x10» (1.2, esquemas12c; secciones 20.5 and 22.11, figura 20.8): the ×10 probe as a compensated
// divider — R₁ = 9 MΩ ∥ C₁ in the tip, in series with R₂ = 1 MΩ ∥ C₂ at the scope's input (the cable, the input and the
// trimmer: C₂ is the trimmer). A square of `entrada` volts (high the first half of each period, from rest at t = 0) at
// `f`: at each edge the capacitors divide first, K₀ = C₁/(C₁ + C₂), then the resistors, K∞ = R₂/(R₁ + R₂), with
// τ = (R₁ ∥ R₂)·(C₁ + C₂); compensated (R₁·C₁ = R₂·C₂) both are equal and the square comes out square, ×10 smaller.
// First half: v_o = V·(K∞ + (K₀ − K∞)·e^(−t/τ)); second: (v_o(T/2) − V·K₀)·e^(−(t − T/2)/τ). In AC, |Z₂/(Z₁ + Z₂)|,
// flat when compensated.
import { ng, num } from '../comun';
import { observablesCA } from '../comun-ca';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'sonda-x10',
  titulo: 'Sonda ×10 y su compensación',
  resumen: 'Divisor compensado: 9 MΩ ∥ C₁ en la punta y 1 MΩ ∥ C₂ (con el trimmer) en la entrada; la cuadrada de calibración sub-, bien o sobrecompensada.',
  piezas: {
    entrada: { obligatoria: true, descripcion: 'nivel alto de la cuadrada de calibración (V; el bajo, 0 V)' },
    f: { obligatoria: true, descripcion: 'frecuencia de la cuadrada (Hz)' },
    r1: { obligatoria: true, descripcion: 'resistencia de la punta, R₁ (Ω; 9 MΩ)', color: 'azul' },
    c1: { obligatoria: true, descripcion: 'condensador de la punta, en paralelo con R₁, C₁ (F)', color: 'azul' },
    r2: { obligatoria: true, descripcion: 'resistencia de entrada del osciloscopio, R₂ (Ω; 1 MΩ)', color: 'naranja' },
    c2: { obligatoria: true, descripcion: 'capacidad de la entrada con el cable y el trimmer, C₂ (F): el ajuste', color: 'naranja' },
  },
  observables: {
    entrada: { medida: 'v(in)', analisis: 'tran', unidad: 'V', descripcion: 'la cuadrada en la punta frente al tiempo' },
    salida: { medida: 'v(out)', analisis: 'tran', unidad: 'V', descripcion: 'lo que ve el osciloscopio frente al tiempo' },
    ...observablesCA('salida', 'v(out)', 'V', 'la tensión en la entrada del osciloscopio'),
  },
  netlist: (c) => {
    const v = c.p('entrada');
    const T = 1 / c.p('f');
    const tr = T * 1e-4;
    return [
      `VIN in 0 DC 0 AC ${num(v)} PULSE(0 ${num(v)} 0 ${num(tr)} ${num(tr)} ${num(T / 2 - tr)} ${num(T)})`,
      `R1 in out ${ng(c.p('r1'))}`,
      `C1 in out ${ng(c.p('c1'))} IC=0`,
      `R2 out 0 ${ng(c.p('r2'))}`,
      `C2 out 0 ${ng(c.p('c2'))} IC=0`,
    ];
  },
  tran: { bordes: () => 0.0015 },
  describir: (c) =>
    `Sonda ×10: cuadrada de ${c.val('entrada')} y ${c.val('f')} en la punta; ${c.sim('r1')} de ${c.val('r1')} en paralelo con ${c.sim('c1')} de ${c.val('c1')} en serie con la entrada del osciloscopio, ${c.sim('r2')} de ${c.val('r2')} en paralelo con ${c.sim('c2')} de ${c.val('c2')}, el trimmer`,
};
export default d;
