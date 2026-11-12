// Schematic «sallen-key-alto» (1.2): the unity-gain Sallen-Key high-pass (sección 24.5 «Filtros Activos»), the
// low-pass «sallen-key» with resistors and capacitors swapped: C₁ and C₂ in series from the sine source to the + input,
// R₁ from their junction to the output (the positive feedback), R₂ from the + input to ground, the operational
// amplifier as a follower. H(s) = s²·R₁·R₂·C₁·C₂ / (1 + s·R₁·(C₁ + C₂) + s²·R₁·R₂·C₁·C₂): with C₁ = C₂ = C,
// f₀ = 1/(2π·C·√(R₁·R₂)) and Q = ½·√(R₂/R₁). The amplifier as in «sallen-key» (ideal, or `gbw` and `rsal`: the
// gain falls at high frequency, so the pass band ends). Curves against frequency or time (steady state from t = 0).
import { ng, num } from '../comun';
import { fasor, fuenteSeno, observablesCA } from '../comun-ca';
import { entre, menos, por, seguidor } from '../comun-ao';
import type { ContextoNetlist, DefinicionEsquema } from '../tipos';

/** The capacitors' voltages at t = 0 in the steady state (ideal amplifier): v_C1 = v − v_a, v_C2 = v_a − v_b. */
function inicio(c: ContextoNetlist): { c1: number; c2: number; out: number } {
  const v = fasor(c);
  const [r1, r2, c1, c2] = [c.p('r1'), c.p('r2'), c.p('c1'), c.p('c2')];
  const w = v.w;
  const t = w * w * r1 * r2 * c1 * c2;
  // v_b = v·(−ω²R₁R₂C₁C₂) / (1 − ω²R₁R₂C₁C₂ + jωR₁(C₁ + C₂))
  const vb = entre(por(v, { re: -t, im: 0 }), { re: 1 - t, im: w * r1 * (c1 + c2) });
  // v_a = v_b·(1 + 1/(jωR₂C₂)) = v_b·(1 − j/(ωR₂C₂))
  const va = por(vb, { re: 1, im: -1 / (w * r2 * c2) });
  return { c1: menos(v, va).im, c2: menos(va, vb).im, out: vb.im };
}

const d: DefinicionEsquema = {
  nombre: 'sallen-key-alto',
  titulo: 'Filtro activo Sallen-Key paso alto de ganancia unidad',
  resumen: 'Fuente senoidal, C₁ y C₂ en serie hacia la entrada +, R₁ a la salida, R₂ a masa y el operacional como seguidor; la salida frente a la frecuencia o al tiempo.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'amplitud (valor de pico) de la fuente senoidal, V_p (V)' },
    f: { obligatoria: true, descripcion: 'frecuencia de la fuente (Hz)' },
    fase: { descripcion: 'fase inicial de la fuente, φ (grados): v(t) = V_p·sen(2π·f·t + φ)' },
    c1: { obligatoria: true, descripcion: 'condensador desde la fuente, C₁ (F)', color: 'naranja' },
    c2: { obligatoria: true, descripcion: 'condensador hacia la entrada +, C₂ (F)', color: 'naranja' },
    r1: { obligatoria: true, descripcion: 'resistencia de la unión de C₁ y C₂ a la salida, R₁ (Ω)', color: 'azul' },
    r2: { obligatoria: true, descripcion: 'resistencia de la entrada + a masa, R₂ (Ω)', color: 'azul' },
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
      `C1 fte a ${ng(c.p('c1'))} IC=${num(ic.c1)}`,
      `C2 a b ${ng(c.p('c2'))} IC=${num(ic.c2)}`,
      `R1 a out ${ng(c.p('r1'))}`,
      `R2 b 0 ${ng(c.p('r2'))}`,
      ...seguidor(c, 'b', 'out', ic.out),
    ];
  },
  describir: (c) => {
    const ao =
      (c.tiene('gbw') ? `operacional de ${c.val('gbw')} de producto ganancia-ancho de banda` : 'operacional ideal') +
      (c.tiene('rsal') ? ` con ${c.val('rsal')} de resistencia de salida` : '');
    return `Filtro Sallen-Key paso alto: fuente senoidal de ${c.val('fuente')} de pico y ${c.val('f')}; ${c.sim('c1')} de ${c.val('c1')} y ${c.sim('c2')} de ${c.val('c2')} en serie hasta la entrada +; ${c.sim('r1')} de ${c.val('r1')} de su unión a la salida y ${c.sim('r2')} de ${c.val('r2')} de la entrada + a masa; ${ao} como seguidor`;
  },
};
export default d;
