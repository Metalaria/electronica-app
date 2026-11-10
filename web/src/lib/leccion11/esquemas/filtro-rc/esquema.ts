// Schematic «filtro-rc»: R and C in series on a sine source (sección 3.3 reactance; 3.6 RC filters, f_c = 1/(2πRC):
// across C a low-pass, across R a high-pass). Curves against time (the steady state from t = 0) or against frequency
// (the AC sweep), and readings at the source's frequency.
import { ng, num } from '../comun';
import { div, fasor, fuenteSeno, observablesCA } from '../comun-ca';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'filtro-rc',
  titulo: 'RC en alterna (filtro paso bajo y paso alto)',
  resumen: 'Fuente senoidal, R y C en serie; v_C (paso bajo) y v_R (paso alto) frente al tiempo o a la frecuencia.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'amplitud (valor de pico) de la fuente senoidal, V_p (V)' },
    f: { obligatoria: true, descripcion: 'frecuencia de la fuente (Hz)' },
    fase: { descripcion: 'fase inicial de la fuente, φ (grados): v(t) = V_p·sen(2π·f·t + φ)' },
    r: { obligatoria: true, descripcion: 'resistencia (Ω)', color: 'azul' },
    c: { obligatoria: true, descripcion: 'capacidad (F)', color: 'naranja' },
  },
  observables: {
    entrada: { medida: 'v(fte)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la fuente' },
    vc: { medida: 'v(c)', analisis: 'tran', unidad: 'V', descripcion: 'tensión del condensador (salida paso bajo)' },
    vr: { medida: 'v(a)-v(c)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la resistencia (salida paso alto)' },
    i: { medida: 'i(vmed)', analisis: 'tran', unidad: 'A', descripcion: 'corriente' },
    ...observablesCA('vc', 'v(c)', 'V', 'la tensión del condensador'),
    ...observablesCA('vr', 'v(a)-v(c)', 'V', 'la tensión de la resistencia'),
    ...observablesCA('i', 'i(vmed)', 'A', 'la corriente'),
  },
  netlist(c) {
    // starting in the steady state at t = 0: v_C = Im(V/(1 + jωRC))
    const v = fasor(c);
    const vc = div(v, { re: 1, im: v.w * c.p('r') * c.p('c') });
    return [fuenteSeno(c), 'VMED fte a 0', `R1 a c ${ng(c.p('r'))}`, `C1 c 0 ${ng(c.p('c'))} IC=${num(vc.im)}`];
  },
  describir: (c) => `Circuito RC en alterna: fuente senoidal de ${c.val('fuente')} de pico y ${c.val('f')}; ${c.sim('r')} de ${c.val('r')} y ${c.sim('c')} de ${c.val('c')} en serie`,
};
export default d;
