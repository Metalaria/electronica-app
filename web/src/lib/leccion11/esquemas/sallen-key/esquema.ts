// Schematic «sallen-key» (1.2): the unity-gain Sallen-Key low-pass (sección 24.5 «Filtros Activos»; problema 24.11 of
// the 1.1, now the book's ej-25.11): R₁ and R₂ in series from the sine source to the + input, C₁ from their junction to
// the output (the positive feedback that makes the Q), C₂ from the + input to ground, the operational amplifier as a
// follower. H(s) = 1/(1 + s·C₂·(R₁ + R₂) + s²·R₁·R₂·C₁·C₂): with R₁ = R₂ = R, f₀ = 1/(2π·R·√(C₁·C₂)) and
// Q = ½·√(C₁/C₂). The amplifier is ideal unless the widget gives its gain-bandwidth product `gbw` (one pole, open-loop
// gain 10⁵) and its open-loop output resistance `rsal`: then, far above the cut-off, the signal that C₁ carries from
// the input reaches the output through `rsal` once the amplifier runs out of gain (the high-frequency feedthrough of
// sección 24.5). Curves against frequency (the AC sweep) or time (the steady state from t = 0).
import { ng, num } from '../comun';
import { fasor, fuenteSeno, observablesCA } from '../comun-ca';
import type { ContextoNetlist, DefinicionEsquema } from '../tipos';
import { entre, menos, por, seguidor } from '../comun-ao';

/** The capacitors' voltages at t = 0 in the steady state (ideal amplifier): v_C1 = v_a − v_o, v_C2 = v_b = v_o. */
function inicio(c: ContextoNetlist): { c1: number; c2: number } {
  const v = fasor(c);
  const [r1, r2, c1, c2] = [c.p('r1'), c.p('r2'), c.p('c1'), c.p('c2')];
  const w = v.w;
  // H = 1 / (1 − ω²R₁R₂C₁C₂ + jωC₂(R₁ + R₂))
  const vb = entre(v, { re: 1 - w * w * r1 * r2 * c1 * c2, im: w * c2 * (r1 + r2) });
  // v_a = v_b·(1 + jωR₂C₂)
  const va = por(vb, { re: 1, im: w * r2 * c2 });
  return { c1: menos(va, vb).im, c2: vb.im };
}

const d: DefinicionEsquema = {
  nombre: 'sallen-key',
  titulo: 'Filtro activo Sallen-Key paso bajo de ganancia unidad',
  resumen: 'Fuente senoidal, R₁ y R₂ en serie hacia la entrada +, C₁ a la salida, C₂ a masa y el operacional como seguidor; la salida frente a la frecuencia o al tiempo.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'amplitud (valor de pico) de la fuente senoidal, V_p (V)' },
    f: { obligatoria: true, descripcion: 'frecuencia de la fuente (Hz)' },
    fase: { descripcion: 'fase inicial de la fuente, φ (grados): v(t) = V_p·sen(2π·f·t + φ)' },
    r1: { obligatoria: true, descripcion: 'resistencia desde la fuente, R₁ (Ω)', color: 'azul' },
    r2: { obligatoria: true, descripcion: 'resistencia hacia la entrada +, R₂ (Ω)', color: 'azul' },
    c1: { obligatoria: true, descripcion: 'condensador de la unión de R₁ y R₂ a la salida, C₁ (F)', color: 'naranja' },
    c2: { obligatoria: true, descripcion: 'condensador de la entrada + a masa, C₂ (F)', color: 'naranja' },
    gbw: { descripcion: 'producto ganancia-ancho de banda del operacional (Hz); sin él, ideal', color: 'verde' },
    rsal: { descripcion: 'resistencia de salida en lazo abierto del operacional (Ω); sin ella, 0', color: 'verde' },
  },
  observables: {
    entrada: { medida: 'v(fte)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la fuente' },
    salida: { medida: 'v(out)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de salida' },
    ...observablesCA('salida', 'v(out)', 'V', 'la tensión de salida'),
  },
  netlist(c) {
    const ic = inicio(c);
    return [
      fuenteSeno(c),
      `R1 fte a ${ng(c.p('r1'))}`,
      `R2 a b ${ng(c.p('r2'))}`,
      `C1 a out ${ng(c.p('c1'))} IC=${num(ic.c1)}`,
      `C2 b 0 ${ng(c.p('c2'))} IC=${num(ic.c2)}`,
      ...seguidor(c, 'b', 'out', ic.c2),
    ];
  },
  describir: (c) => {
    const ao =
      (c.tiene('gbw') ? `operacional de ${c.val('gbw')} de producto ganancia-ancho de banda` : 'operacional ideal') +
      (c.tiene('rsal') ? ` con ${c.val('rsal')} de resistencia de salida` : '');
    return `Filtro Sallen-Key paso bajo: fuente senoidal de ${c.val('fuente')} de pico y ${c.val('f')}; ${c.sim('r1')} de ${c.val('r1')} y ${c.sim('r2')} de ${c.val('r2')} en serie hasta la entrada +; ${c.sim('c1')} de ${c.val('c1')} de su unión a la salida y ${c.sim('c2')} de ${c.val('c2')} de la entrada + a masa; ${ao} como seguidor`;
  },
};
export default d;
