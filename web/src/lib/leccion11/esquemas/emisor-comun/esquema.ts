// Schematic «emisor-comun» (1.2, esquemas12c; secciones 43.3 a 43.5): the complete common-emitter stage in AC — the
// divider R₁–R₂ on the base, R_C, the emitter resistor R_E with its bypass capacitor C_E (a switch connects it) and,
// optionally, an unbypassed R_E1 above it, the input coupling C_in from a sine source with its resistance R_S, the
// output coupling C_out to the load R_L. The transistor drops exactly vbe at the operating point the schematic works out
// from its pieces (comun.ts bjtEn: I_B = (V_Th − V_BE)/(R_Th + (β + 1)·(R_E1 + R_E)), I_C = β·I_B), so the DC readings
// are the book's and the small-signal ones those of the hybrid-π model with g_m = I_C/V_T (V_T = 25,85 mV), r_π = β/g_m
// and no r_o: with ideal coupling,
//   v_o/v_s = −β·(R_C ∥ R_L)/(r_π + (β + 1)·Z_E), Z_E = R_E1 + R_E ∥ 1/(jω·C_E)
// (with C_E the mid-band gain is g_m·(R_C ∥ R_L) when R_E1 = 0; without it, about (R_C ∥ R_L)/R_E: the inversion is
// the phase of 180°). A missing C_in or C_out is an ideal coupling (1 F). The transient starts at the DC point (each
// capacitor's «IC=») after `periodos` whole periods that let the coupling settle: the curves are the steady state.
import { bjtEn, ng, num, temperatura } from '../comun';
import { fuenteSeno, observablesCA } from '../comun-ca';
import type { ContextoNetlist, DefinicionEsquema } from '../tipos';

const VT = 0.02585;

/** The DC operating point the schematic is calibrated at (the book's constant-drop model). */
export function puntoEC(c: ContextoNetlist): { ib: number; ic: number; vb: number; ve: number; vc: number } {
  const vcc = c.p('vcc');
  const r1 = c.p('r1');
  const r2 = c.p('r2');
  const beta = c.p('beta');
  const vth = (vcc * r2) / (r1 + r2);
  const rth = (r1 * r2) / (r1 + r2);
  const re = c.p('re') + c.p('re1');
  const ib = Math.max(0, (vth - c.p('vbe')) / (rth + (beta + 1) * re));
  const ic = beta * ib;
  return { ib, ic, vb: vth - ib * rth, ve: (beta + 1) * ib * re, vc: vcc - ic * c.p('rc') };
}

const d: DefinicionEsquema = {
  nombre: 'emisor-comun',
  titulo: 'Etapa en emisor común en alterna',
  resumen: 'Divisor de base, R_C, R_E con condensador de desvío, acoplos de entrada y salida y carga; ganancia, Z_in y corte inferior.',
  piezas: {
    vcc: { obligatoria: true, descripcion: 'alimentación, V_CC (V)' },
    r1: { obligatoria: true, descripcion: 'resistencia de arriba del divisor de base (Ω)', color: 'azul' },
    r2: { obligatoria: true, descripcion: 'resistencia de abajo del divisor de base (Ω)', color: 'azul' },
    rc: { obligatoria: true, descripcion: 'resistencia de colector, R_C (Ω)', color: 'naranja' },
    re: { obligatoria: true, descripcion: 'resistencia de emisor, R_E, la que puentea C_E (Ω)', color: 'verde' },
    re1: { descripcion: 'resistencia de emisor sin desacoplar, R_E1, entre el emisor y R_E (Ω)', color: 'verde' },
    ce: { descripcion: 'condensador de desvío del emisor, C_E, en paralelo con R_E (F)', color: 'verde' },
    desvio: { interruptor: true, descripcion: 'conecta C_E (sin él, conectado)', color: 'verde' },
    beta: { obligatoria: true, descripcion: 'ganancia de corriente β' },
    vbe: { obligatoria: true, descripcion: 'V_BE en el punto de trabajo (V; el libro: 0,7 V)' },
    fuente: { obligatoria: true, descripcion: 'amplitud de pico de la señal (V)' },
    f: { obligatoria: true, descripcion: 'frecuencia de la señal (Hz)' },
    fase: { descripcion: 'fase inicial de la señal (°)' },
    rs: { descripcion: 'resistencia de la fuente de señal, R_S (Ω; la de la medida de Z_in)', color: 'azul' },
    cin: { descripcion: 'condensador de acoplo de entrada, C_in (F; sin él, acoplo ideal)', color: 'azul' },
    cout: { descripcion: 'condensador de acoplo de salida, C_out (F; sin él, acoplo ideal)', color: 'naranja' },
    carga: { descripcion: 'resistencia de carga, R_L (Ω; sin ella, en vacío)', color: 'naranja' },
  },
  observables: {
    ib: { medida: 'i(vbm)', analisis: 'op', unidad: 'A', descripcion: 'corriente de base' },
    ic: { medida: 'i(vcm)', analisis: 'op', unidad: 'A', descripcion: 'corriente de colector' },
    vb: { medida: 'v(b)', analisis: 'op', unidad: 'V', descripcion: 'tensión de base' },
    ve: { medida: 'v(e)', analisis: 'op', unidad: 'V', descripcion: 'tensión de emisor' },
    vc: { medida: 'v(c)', analisis: 'op', unidad: 'V', descripcion: 'tensión de colector' },
    entrada: { medida: 'v(s)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la fuente de señal frente al tiempo' },
    base: { medida: 'v(b)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de base frente al tiempo (continua más señal)' },
    colector: { medida: 'v(c)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de colector frente al tiempo (continua más señal)' },
    salida: { medida: 'v(out)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de salida (tras C_out) frente al tiempo' },
    ...observablesCA('salida', 'v(out)', 'V', 'la tensión de salida (en la carga)'),
    ...observablesCA('base', 'v(b)', 'V', 'la señal en la base'),
    ...observablesCA('ientrada', 'i(vmi)', 'A', 'la corriente que entrega la fuente de señal'),
  },
  validar: (tiene) => (tiene('desvio') && !tiene('ce') ? ['«desvio» conecta «ce»: hace falta el condensador'] : []),
  netlist: (c) => {
    const q = puntoEC(c);
    const conCE = c.tiene('ce') && c.cerrado('desvio');
    const re1 = c.tiene('re1') && c.p('re1') > 0;
    const cin = c.tiene('cin') ? c.p('cin') : 1;
    const cout = c.tiene('cout') ? c.p('cout') : 1;
    const ve2 = re1 ? (c.p('beta') + 1) * q.ib * c.p('re') : q.ve;
    return [
      temperatura(),
      fuenteSeno(c, 's0'),
      c.tiene('rs') ? `RS s0 s ${ng(c.p('rs'))}` : 'VRS s0 s 0',
      'VMI s i 0',
      `CIN i b ${ng(cin)} IC=${num(-q.vb)}`,
      `VCC vcc 0 DC ${num(c.p('vcc'))}`,
      `R1 vcc b ${ng(c.p('r1'))}`,
      `R2 b 0 ${ng(c.p('r2'))}`,
      'VBM b bq 0',
      'VCM vcc x 0',
      `RC x c ${ng(c.p('rc'))}`,
      'Q1 c bq e QN',
      ...(re1 ? [`RE1 e e2 ${ng(c.p('re1'))}`] : []),
      `RE ${re1 ? 'e2' : 'e'} 0 ${ng(c.p('re'))}`,
      ...(conCE ? [`CE ${re1 ? 'e2' : 'e'} 0 ${ng(c.p('ce'))} IC=${num(ve2)}`] : []),
      `COUT c out ${ng(cout)} IC=${num(q.vc)}`,
      `RL out 0 ${c.tiene('carga') ? ng(c.p('carga')) : '1e12'}`,
      bjtEn('QN', 'NPN', c.p('beta'), c.p('vbe'), q.ic),
    ];
  },
  tran: {
    // whole periods that let the couplings settle (ten of their slowest time constant, at most 400)
    periodos(c) {
      const f = c.p('f');
      const q = puntoEC(c);
      const gm = q.ic / VT;
      const rpi = gm > 0 ? c.p('beta') / gm : 1e9;
      const zin = 1 / (1 / c.p('r1') + 1 / c.p('r2') + 1 / (rpi + (c.p('beta') + 1) * c.p('re1')));
      const taus = [
        c.tiene('cin') ? c.p('cin') * (c.p('rs') + zin) : 0,
        c.tiene('cout') ? c.p('cout') * (c.p('rc') + (c.tiene('carga') ? c.p('carga') : 0)) : 0,
        c.tiene('ce') && c.cerrado('desvio') ? c.p('ce') * Math.min(c.p('re'), c.p('re1') + rpi / (c.p('beta') + 1) + 1 / gm) : 0,
      ];
      return Math.min(400, Math.ceil(10 * Math.max(...taus) * f));
    },
  },
  describir: (c) => {
    const ce = c.tiene('ce') ? (c.cerrado('desvio') ? `, desacoplada por ${c.sim('ce')} de ${c.val('ce')}` : `, con ${c.sim('ce')} desconectado`) : '';
    return `Etapa en emisor común con ${c.val('vcc')}: divisor de ${c.sim('r1')} ${c.val('r1')} y ${c.sim('r2')} ${c.val('r2')} en la base; ${c.sim('rc')} de ${c.val('rc')} en el colector; ${c.tiene('re1') ? `${c.sim('re1')} de ${c.val('re1')} y ` : ''}${c.sim('re')} de ${c.val('re')} en el emisor${ce}; β ${c.val('beta')}; señal de ${c.val('fuente')} de pico y ${c.val('f')}${c.tiene('rs') ? ` con ${c.sim('rs')} de ${c.val('rs')}` : ''}${c.tiene('cin') ? `, acoplada por ${c.sim('cin')} de ${c.val('cin')}` : ''}; salida${c.tiene('cout') ? ` por ${c.sim('cout')} de ${c.val('cout')}` : ''} ${c.tiene('carga') ? `a ${c.sim('carga')} de ${c.val('carga')}` : 'en vacío'}`;
  },
};
export default d;
