// Schematic «filtro-rl»: R and L in series on a sine source (sección 4.3 inductive reactance: X_L = 2πfL, 3,1 Ω at
// 50 Hz for 10 mH; across L a high-pass, across R a low-pass).
import { ng, num } from '../comun';
import { div, fasor, fuenteSeno, observablesCA } from '../comun-ca';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'filtro-rl',
  titulo: 'RL en alterna',
  resumen: 'Fuente senoidal, R y L en serie; v_L, v_R y la corriente frente al tiempo o a la frecuencia.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'amplitud (valor de pico) de la fuente senoidal, V_p (V)' },
    f: { obligatoria: true, descripcion: 'frecuencia de la fuente (Hz)' },
    fase: { descripcion: 'fase inicial de la fuente, φ (grados): v(t) = V_p·sen(2π·f·t + φ)' },
    r: { obligatoria: true, descripcion: 'resistencia (Ω)', color: 'azul' },
    l: { obligatoria: true, descripcion: 'inductancia (H)', color: 'naranja' },
  },
  observables: {
    entrada: { medida: 'v(fte)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la fuente' },
    vl: { medida: 'v(l)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la bobina (salida paso alto)' },
    vr: { medida: 'v(a)-v(l)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la resistencia (salida paso bajo)' },
    i: { medida: 'i(vmed)', analisis: 'tran', unidad: 'A', descripcion: 'corriente' },
    ...observablesCA('vl', 'v(l)', 'V', 'la tensión de la bobina'),
    ...observablesCA('vr', 'v(a)-v(l)', 'V', 'la tensión de la resistencia'),
    ...observablesCA('i', 'i(vmed)', 'A', 'la corriente'),
  },
  netlist(c) {
    // starting in the steady state at t = 0: i = Im(V/(R + jωL))
    const v = fasor(c);
    const i = div(v, { re: c.p('r'), im: v.w * c.p('l') });
    return [fuenteSeno(c), 'VMED fte a 0', `R1 a l ${ng(c.p('r'))}`, `L1 l 0 ${ng(c.p('l'))} IC=${num(i.im)}`];
  },
  describir: (c) => `Circuito RL en alterna: fuente senoidal de ${c.val('fuente')} de pico y ${c.val('f')}; ${c.sim('r')} de ${c.val('r')} y ${c.sim('l')} de ${c.val('l')} en serie`,
};
export default d;
