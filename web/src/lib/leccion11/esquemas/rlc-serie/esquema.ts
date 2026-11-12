// Schematic «rlc-serie»: R, L and C in series on a sine source (sección 1.7 resonance, f₀ = 1/(2π√(LC)),
// Q = √(L/C)/R, bandwidth f₀/Q; 4.7 «en resonancia las reactancias se anulan y solo queda la resistencia»).
import { ng, num } from '../comun';
import { div, fasor, fuenteSeno, observablesCA } from '../comun-ca';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'rlc-serie',
  titulo: 'RLC en serie (resonancia)',
  resumen: 'Fuente senoidal, R, L y C en serie; corriente y tensiones frente al tiempo o a la frecuencia.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'amplitud (valor de pico) de la fuente senoidal, V_p (V)' },
    f: { obligatoria: true, descripcion: 'frecuencia de la fuente (Hz)' },
    fase: { descripcion: 'fase inicial de la fuente, φ (grados): v(t) = V_p·sen(2π·f·t + φ)' },
    r: { obligatoria: true, descripcion: 'resistencia (Ω)', color: 'azul' },
    l: { obligatoria: true, descripcion: 'inductancia (H)', color: 'naranja' },
    c: { obligatoria: true, descripcion: 'capacidad (F)', color: 'verde' },
  },
  observables: {
    entrada: { medida: 'v(fte)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la fuente' },
    i: { medida: 'i(vmed)', analisis: 'tran', unidad: 'A', descripcion: 'corriente' },
    vr: { medida: 'v(a)-v(b)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la resistencia' },
    vl: { medida: 'v(b)-v(c)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la bobina' },
    vc: { medida: 'v(c)', analisis: 'tran', unidad: 'V', descripcion: 'tensión del condensador' },
    ...observablesCA('i', 'i(vmed)', 'A', 'la corriente'),
    ...observablesCA('vr', 'v(a)-v(b)', 'V', 'la tensión de la resistencia'),
    ...observablesCA('vl', 'v(b)-v(c)', 'V', 'la tensión de la bobina'),
    ...observablesCA('vc', 'v(c)', 'V', 'la tensión del condensador'),
    // 1.2 (esquemas12): the impedance Z = R + j(ωL − 1/(ωC)) the source sees, measured on a copy of the three parts
    // driven by a 1 A AC current source (its voltage is Z, in ohms): |Z| and its phase («z_amp», «z_fase», «z_db»), the
    // curve of a decoupling capacitor with its ESR and ESL (sección 41.8)
    ...observablesCA('z', 'v(zx)', 'Ω', 'la impedancia (la tensión que da una corriente de 1 A)'),
  },
  netlist(c) {
    // starting in the steady state at t = 0: I = V/(R + j(ωL − 1/(ωC))), v_C = I/(jωC)
    const v = fasor(c);
    const i = div(v, { re: c.p('r'), im: v.w * c.p('l') - 1 / (v.w * c.p('c')) });
    return [
      fuenteSeno(c),
      'VMED fte a 0',
      `R1 a b ${ng(c.p('r'))}`,
      `L1 b c ${ng(c.p('l'))} IC=${num(i.im)}`,
      `C1 c 0 ${ng(c.p('c'))} IC=${num(-i.re / (v.w * c.p('c')))}`,
      // (the impedance meter: a copy of R, L and C fed with 1 A in AC, nothing in DC or in the transient)
      'IZ 0 zx DC 0 AC 1',
      `RZ zx zb ${ng(c.p('r'))}`,
      `LZ zb zc ${ng(c.p('l'))} IC=0`,
      `CZ zc 0 ${ng(c.p('c'))} IC=0`,
    ];
  },
  describir: (c) =>
    `Circuito RLC en serie: fuente senoidal de ${c.val('fuente')} de pico y ${c.val('f')}; ${c.sim('r')} de ${c.val('r')}, ${c.sim('l')} de ${c.val('l')} y ${c.sim('c')} de ${c.val('c')}`,
};
export default d;
