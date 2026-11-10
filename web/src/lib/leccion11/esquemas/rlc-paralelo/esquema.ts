// Schematic «rlc-paralelo»: a tank, L and C in parallel (and R, its losses, if given), fed from a sine source through
// a series resistor (sección 4.7 «Serie y paralelo se comportan al revés»: the tank's impedance is maximum at f₀, so
// its voltage peaks and the source's current dips; Q = R/√(L/C) in parallel; sección 1.7).
import { ng, num } from '../comun';
import { div, fasor, fuenteSeno, observablesCA } from '../comun-ca';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'rlc-paralelo',
  titulo: 'Tanque LC en paralelo',
  resumen: 'Fuente senoidal con resistencia en serie sobre L ‖ C (‖ R); tensión del tanque y corrientes.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'amplitud (valor de pico) de la fuente senoidal, V_p (V)' },
    f: { obligatoria: true, descripcion: 'frecuencia de la fuente (Hz)' },
    fase: { descripcion: 'fase inicial de la fuente, φ (grados): v(t) = V_p·sen(2π·f·t + φ)' },
    rs: { obligatoria: true, descripcion: 'resistencia en serie de la fuente (Ω)', color: 'azul' },
    l: { obligatoria: true, descripcion: 'inductancia del tanque (H)', color: 'naranja' },
    c: { obligatoria: true, descripcion: 'capacidad del tanque (F)', color: 'verde' },
    r: { descripcion: 'resistencia en paralelo del tanque, sus pérdidas (Ω)', color: 'azul' },
  },
  observables: {
    entrada: { medida: 'v(fte)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la fuente' },
    vt: { medida: 'v(t)', analisis: 'tran', unidad: 'V', descripcion: 'tensión del tanque' },
    i: { medida: 'i(vmed)', analisis: 'tran', unidad: 'A', descripcion: 'corriente de la fuente' },
    ...observablesCA('vt', 'v(t)', 'V', 'la tensión del tanque'),
    ...observablesCA('i', 'i(vmed)', 'A', 'la corriente de la fuente'),
    ...observablesCA('il', 'i(vl)', 'A', 'la corriente de la bobina'),
  },
  netlist(c) {
    // starting in the steady state at t = 0: V_t = V/(1 + R_s·Y), Y = 1/R + j(ωC − 1/(ωL)); I_L = V_t/(jωL)
    const v = fasor(c);
    const rs = c.p('rs');
    const vt = div(v, { re: 1 + (c.tiene('r') ? rs / c.p('r') : 0), im: rs * (v.w * c.p('c') - 1 / (v.w * c.p('l'))) });
    return [
      fuenteSeno(c),
      'VMED fte a 0',
      `RS a t ${ng(c.p('rs'))}`,
      'VL t x 0',
      `L1 x 0 ${ng(c.p('l'))} IC=${num(-vt.re / (v.w * c.p('l')))}`,
      `C1 t 0 ${ng(c.p('c'))} IC=${num(vt.im)}`,
      ...(c.tiene('r') ? [`RP t 0 ${ng(c.p('r'))}`] : []),
    ];
  },
  describir: (c) =>
    `Tanque en paralelo: fuente senoidal de ${c.val('fuente')} de pico y ${c.val('f')} con ${c.sim('rs')} de ${c.val('rs')} en serie; ${c.sim('l')} de ${c.val('l')} y ${c.sim('c')} de ${c.val('c')} en paralelo${c.tiene('r') ? `, y ${c.sim('r')} de ${c.val('r')}` : ''}`,
};
export default d;
