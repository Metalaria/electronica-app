// Schematic «par-diferencial» (1.2, esquemas12c; sección 43.6, figura 44.12): two NPN with their emitters joined to a
// tail — a resistor R_EE to −V_EE, or a current source I with its output resistance r_o — and R_C on each collector
// from +V_CC; a source on each base. The bases' DC levels `v1`, `v2` and, in AC (and the transient), a differential
// signal `ad` (+ad/2 on base 1, −ad/2 on base 2) and a common-mode one `acm` (on both), at the frequency `f`. Both
// transistors drop exactly vbe at the balanced operating point (comun.ts bjtEn: I_C = β/(β + 1)·I_cola/2), so in small
// signal, with g_m = I_C/V_T and r_π = β/g_m (no r_o of the transistors):
//   - differential: v_c2 = +g_m·R_C·ad/2, v_c1 = −g_m·R_C·ad/2 (the tail is a virtual ground);
//   - common mode: v_c = −β·R_C·acm/(r_π + 2·(β + 1)·R_EE) (R_EE: the tail's resistance, r_o with a current source; an
//     ideal source rejects it completely), so CMRR = (r_π + 2·(β + 1)·R_EE)/(2·r_π) ≈ g_m·R_EE;
//   - `drc`, a mismatch: R_C2 = R_C·(1 + drc), which turns some common mode into a differential output.
// With different DC levels on the bases and an ideal current source the split is the book's tanh:
// I_C1 = α·I/(1 + e^(−(v1 − v2)/V_T)).
import { bjtEn, ng, num, temperatura } from '../comun';
import { observablesCA } from '../comun-ca';
import type { ContextoNetlist, DefinicionEsquema } from '../tipos';

/** The balanced tail current the transistors are calibrated at. */
export function colaPD(c: ContextoNetlist): number {
  const ve = (c.p('v1') + c.p('v2')) / 2 - c.p('vbe');
  if (c.tiene('icola')) return c.p('icola') + (c.tiene('ro') ? (ve + c.p('vee')) / c.p('ro') : 0);
  return Math.max(0, (ve + c.p('vee')) / c.p('ree'));
}

/** A base source: DC level, and the signal `s` (V of peak, signed) in AC and in the transient. */
function base(nombre: string, nodo: string, dc: number, s: number, f: number, senal: boolean): string {
  if (!senal) return `${nombre} ${nodo} 0 DC ${num(dc)}`;
  return `${nombre} ${nodo} 0 DC ${num(dc)} AC ${num(Math.abs(s))} ${s < 0 ? 180 : 0} SIN(${num(dc)} ${num(s)} ${num(f)})`;
}

const d: DefinicionEsquema = {
  nombre: 'par-diferencial',
  titulo: 'Par diferencial con fuente de cola',
  resumen: 'Dos NPN con los emisores unidos a una cola (R_EE o fuente de corriente con r_o) y R_C en cada colector; ganancia diferencial, de modo común y CMRR.',
  piezas: {
    vcc: { obligatoria: true, descripcion: 'alimentación positiva, +V_CC (V)' },
    vee: { obligatoria: true, descripcion: 'alimentación negativa, su valor absoluto: la cola va a −V_EE (V)' },
    rc: { obligatoria: true, descripcion: 'resistencia de cada colector, R_C (Ω)', color: 'naranja' },
    drc: { descripcion: 'desajuste de R_C2: R_C2 = R_C·(1 + drc) (sin él, iguales)', color: 'naranja' },
    ree: { descripcion: 'resistencia de cola a −V_EE, R_EE (Ω)', color: 'verde' },
    icola: { descripcion: 'fuente de corriente de cola, I (A), en lugar de R_EE', color: 'verde' },
    ro: { descripcion: 'resistencia de salida de la fuente de cola, r_o (Ω; sin ella, ideal)', color: 'verde' },
    beta: { obligatoria: true, descripcion: 'ganancia de corriente β de los dos' },
    vbe: { obligatoria: true, descripcion: 'V_BE en el punto de trabajo (V; el libro: 0,7 V)' },
    v1: { obligatoria: true, descripcion: 'tensión continua de la base 1 (V)', color: 'azul' },
    v2: { obligatoria: true, descripcion: 'tensión continua de la base 2 (V)', color: 'azul' },
    ad: { descripcion: 'señal diferencial de pico, v_d (V): +v_d/2 en la base 1 y −v_d/2 en la base 2', color: 'azul' },
    acm: { descripcion: 'señal de modo común de pico, v_cm (V): en las dos bases', color: 'azul' },
    f: { descripcion: 'frecuencia de las señales (Hz; obligatoria con «ad» o «acm»)' },
  },
  observables: {
    ic1: { medida: 'i(vcm1)', analisis: 'op', unidad: 'A', descripcion: 'corriente de colector de Q₁' },
    ic2: { medida: 'i(vcm2)', analisis: 'op', unidad: 'A', descripcion: 'corriente de colector de Q₂' },
    icola: { medida: 'i(vcola)', analisis: 'op', unidad: 'A', descripcion: 'corriente de la cola' },
    vc1: { medida: 'v(c1)', analisis: 'op', unidad: 'V', descripcion: 'tensión de colector de Q₁' },
    vc2: { medida: 'v(c2)', analisis: 'op', unidad: 'V', descripcion: 'tensión de colector de Q₂' },
    ve: { medida: 'v(e)', analisis: 'op', unidad: 'V', descripcion: 'tensión de los emisores (la cola)' },
    salida1: { medida: 'v(c1)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de colector de Q₁ frente al tiempo' },
    salida2: { medida: 'v(c2)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de colector de Q₂ frente al tiempo' },
    dif: { medida: 'v(c2)-v(c1)', analisis: 'tran', unidad: 'V', descripcion: 'salida diferencial v_c2 − v_c1 frente al tiempo' },
    entrada1: { medida: 'v(b1)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la base 1 frente al tiempo' },
    entrada2: { medida: 'v(b2)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la base 2 frente al tiempo' },
    ...observablesCA('salida1', 'v(c1)', 'V', 'la señal en el colector de Q₁'),
    ...observablesCA('salida2', 'v(c2)', 'V', 'la señal en el colector de Q₂'),
    ...observablesCA('dif', 'v(c2)-v(c1)', 'V', 'la salida diferencial v_c2 − v_c1'),
    ...observablesCA('cola', 'v(e)', 'V', 'la señal en la cola'),
  },
  validar: (tiene) => {
    const e: string[] = [];
    if (tiene('ree') === tiene('icola')) e.push('«piezas»: una cola, «ree» (resistencia) o «icola» (fuente de corriente)');
    if (tiene('ro') && !tiene('icola')) e.push('«ro» es la resistencia de salida de «icola»');
    if ((tiene('ad') || tiene('acm')) && !tiene('f')) e.push('con «ad» o «acm» hace falta «f»');
    return e;
  },
  netlist: (c) => {
    const ic = (c.p('beta') / (c.p('beta') + 1)) * (colaPD(c) / 2);
    const senal = (c.tiene('ad') || c.tiene('acm')) && c.p('f') > 0;
    const s1 = c.p('acm') + c.p('ad') / 2;
    const s2 = c.p('acm') - c.p('ad') / 2;
    const cola = c.tiene('icola')
      ? [`ICOLA t vee DC ${num(c.p('icola'))}`, ...(c.tiene('ro') ? [`RO t vee ${ng(c.p('ro'))}`] : [])]
      : [`REE t vee ${ng(c.p('ree'))}`];
    return [
      temperatura(),
      `VCC vcc 0 DC ${num(c.p('vcc'))}`,
      `VEE vee 0 DC ${num(-c.p('vee'))}`,
      base('V1', 'b1', c.p('v1'), s1, c.p('f'), senal),
      base('V2', 'b2', c.p('v2'), s2, c.p('f'), senal),
      'VCM1 vcc x1 0',
      `RC1 x1 c1 ${ng(c.p('rc'))}`,
      'VCM2 vcc x2 0',
      `RC2 x2 c2 ${ng(c.p('rc') * (1 + c.p('drc')))}`,
      'Q1 c1 b1 e QN',
      'Q2 c2 b2 e QN',
      'VCOLA e t 0',
      ...cola,
      bjtEn('QN', 'NPN', c.p('beta'), c.p('vbe'), ic),
    ];
  },
  describir: (c) => {
    const cola = c.tiene('icola') ? `una fuente de corriente de ${c.val('icola')}${c.tiene('ro') ? ` con ${c.sim('ro')} de ${c.val('ro')}` : ''}` : `${c.sim('ree')} de ${c.val('ree')}`;
    const senal = [c.tiene('ad') ? `señal diferencial de ${c.val('ad')}` : '', c.tiene('acm') ? `de modo común de ${c.val('acm')}` : ''].filter(Boolean).join(' y ');
    return `Par diferencial entre ${c.val('vcc')} y −${c.val('vee')}: ${c.sim('rc')} de ${c.val('rc')} en cada colector${c.tiene('drc') && c.p('drc') ? ` (la segunda desajustada)` : ''}; emisores unidos a ${cola}; β ${c.val('beta')}; bases a ${c.val('v1')} y ${c.val('v2')}${senal ? `, ${senal}${c.tiene('f') ? ` a ${c.val('f')}` : ''}` : ''}`;
  },
};
export default d;
