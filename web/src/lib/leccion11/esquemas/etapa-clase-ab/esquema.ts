// Schematic «etapa-clase-ab» (1.2, esquemas12c; secciones 43.7, 51.4, 51.5 and figura 52.12): the complementary output
// stage — Q₁ (NPN) from +V and Q₂ (PNP) from −V as emitter followers, each through its emitter resistor R_E to the
// output and the load R_L to ground — biased as in the book's figure: a current source I_B from +V into the base of Q₁
// and a V_BE multiplier (Q₃ with R₁ from collector to base and R₂ from base to emitter: V_BB = V_BE3·(1 + R₁/R₂) plus
// I_B3·R₁) between the two bases. The driver (the voltage-amplifier stage, here a source: `entrada` its DC level, a
// signal on it) holds the base of Q₂ and sinks I_B. A switch «puente» shorts the multiplier: class B, the crossover
// dead zone of ± V_BE. So:
//   - quiescent (no signal): V_BE1 + V_EB2 + I_Q·(R_E1 + R_E2) = V_BB; the output sits at entrada + V_EB2 + I_Q·R_E2
//     (entrada = −V_BB/2 centres it);
//   - the book's model: each output transistor drops vbe at the current iref — make iref the model's quiescent current
//     (a calculation, I_Q = (V_BB − 2·V_BE)/(R_E1 + R_E2)) and the simulator's quiescent point is the book's exactly;
//     with a signal its devices stay within ± 0,1 V of vbe from iref/50 to 50·iref (a 20 mA bias reaches 1 A). The
//     multiplier's Q₃ drops exactly vbem (default vbe) at its own current I_B − vbem/R₂ − iref/β (comun.ts bjtEn) and
//     has no base current to speak of (β of 10⁶ unless «betam»), as the book's V_BB = V_BE3·(1 + R₁/R₂) assumes: the
//     quiescent current is far too sensitive to V_BB (4,5 A/V with 0,22 Ω) for a base current's millivolts;
//   - thermal drift (sección 51.5): the output transistors' vbe falls 2 mV/°C as they heat; with the multiplier on the
//     heatsink vbem falls with them and I_Q stays put; off it, I_Q rises.
// Faults for an «averia» card (51.9, 51.10): an emitter resistor open (re or re2 at 1e9: half the waveform missing),
// R₁ or R₂ open or shorted (the bias drifts), the multiplier shorted (puente closed: crossover).
import { bjtEn, ng, num, temperatura } from '../comun';
import { describirEntrada, fuenteEntrada, piezasEntrada } from '../comun-ao';
import type { ContextoNetlist, DefinicionEsquema } from '../tipos';

const iref = (c: ContextoNetlist) => (c.tiene('iref') && c.p('iref') > 0 ? c.p('iref') : 1e-3);

/**
 * Whether Q₁ conducts at the DC point in the book's model (the driver's level plus V_BB above vbe; V_BB = 0 bridged):
 * when it does not (class B at rest) its drop means nothing, and the check reads a reference of vbe instead (like a
 * reversed diode's, comun-diodo.ts).
 */
function q1Conduce(c: ContextoNetlist): boolean {
  const vbem = c.tiene('vbem') ? c.p('vbem') : c.p('vbe');
  const vbb = c.tiene('puente') && c.cerrado('puente') ? 0 : vbem * (1 + c.p('r1') / c.p('r2'));
  return c.p('entrada') + vbb - c.p('vbe') > 1e-3;
}

const d: DefinicionEsquema = {
  nombre: 'etapa-clase-ab',
  titulo: 'Etapa de salida complementaria (clase AB) con multiplicador de V_BE',
  resumen: 'NPN y PNP seguidores con R_E y carga; la fuente de bias y el multiplicador de V_BE entre las bases; un puente lo cortocircuita (clase B, distorsión de cruce).',
  piezas: {
    vcc: { obligatoria: true, descripcion: 'alimentación simétrica, ±V_CC (V)' },
    ...piezasEntrada(),
    ib: { obligatoria: true, descripcion: 'corriente de la fuente de bias, de +V a la base de Q₁, I_B (A)', color: 'azul' },
    r1: { obligatoria: true, descripcion: 'resistencia del multiplicador de colector a base, R₁ (Ω; el ajuste del bias)', color: 'azul' },
    r2: { obligatoria: true, descripcion: 'resistencia del multiplicador de base a emisor, R₂ (Ω)', color: 'azul' },
    puente: { interruptor: true, descripcion: 'cortocircuita el multiplicador (cerrado: clase B, sin bias)', color: 'azul' },
    re: { obligatoria: true, descripcion: 'resistencia de emisor de Q₁, R_E (Ω; también la de Q₂ sin «re2»)', color: 'verde' },
    re2: { descripcion: 'resistencia de emisor de Q₂ (Ω; sin ella, la de Q₁)', color: 'verde' },
    carga: { obligatoria: true, descripcion: 'resistencia de carga, R_L (Ω)', color: 'naranja' },
    beta: { obligatoria: true, descripcion: 'ganancia de corriente β de los tres transistores' },
    vbe: { obligatoria: true, descripcion: 'V_BE de los transistores de salida a la corriente iref (V; el libro: 0,6 a 0,7 V)' },
    iref: { descripcion: 'corriente a la que los transistores de salida caen vbe (A; sin ella, 1 mA): la de reposo' },
    vbem: { descripcion: 'V_BE del transistor del multiplicador a su corriente (V; sin ella, vbe)' },
    betam: { descripcion: 'β del transistor del multiplicador (sin ella, 10⁶: sin corriente de base, como el libro)' },
  },
  observables: {
    iq: { medida: 'i(vc1)', analisis: 'op', unidad: 'A', descripcion: 'corriente de colector de Q₁ (en reposo, la de reposo)' },
    iq2: { medida: 'i(vc2)', analisis: 'op', unidad: 'A', descripcion: 'corriente de colector de Q₂ (hacia −V)' },
    vbb: { medida: 'v(b1)-v(b2)', analisis: 'op', unidad: 'V', descripcion: 'tensión de bias entre las bases, V_BB' },
    vo: { medida: 'v(out)', analisis: 'op', unidad: 'V', descripcion: 'tensión continua de la salida' },
    il: { medida: 'i(vl)', analisis: 'op', unidad: 'A', descripcion: 'corriente continua por la carga' },
    vbe1: { medida: 'v(b1)-v(e1)', analisis: 'op', unidad: 'V', descripcion: 'V_BE de Q₁' },
    entrada: { medida: 'v(b2)', analisis: 'tran', unidad: 'V', descripcion: 'tensión del driver (la base de Q₂) frente al tiempo' },
    salida: { medida: 'v(out)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de salida frente al tiempo' },
    ic1: { medida: 'i(vc1)', analisis: 'tran', unidad: 'A', descripcion: 'corriente de Q₁ frente al tiempo' },
    ic2: { medida: 'i(vc2)', analisis: 'tran', unidad: 'A', descripcion: 'corriente de Q₂ frente al tiempo' },
    carga: { medida: 'i(vl)', analisis: 'tran', unidad: 'A', descripcion: 'corriente por la carga frente al tiempo' },
  },
  // the output transistors drop vbe at iref (the book's 0,6–0,7 V at the quiescent current): ± 0,1 V over two decades
  // either side; the DC readings are corrected by Q₁'s real drop
  noLineal: () => [{ pieza: 'vbe', desviacion: 0.1, porque: 'transistores de salida de V_BE = vbe a iref: ± 0,1 V entre iref/50 y 50·iref', medida: (c) => (q1Conduce(c) ? 'v(b1)-v(e1)' : 'v(zbe)') }],
  netlist: (c, analisis) => {
    const puente = c.tiene('puente') && c.cerrado('puente');
    const vbem = c.tiene('vbem') ? c.p('vbem') : c.p('vbe');
    const ic3 = c.p('ib') - vbem / c.p('r2') - iref(c) / c.p('beta');
    return [
      temperatura(),
      `VCC vcc 0 DC ${num(c.p('vcc'))}`,
      `VEE vee 0 DC ${num(-c.p('vcc'))}`,
      `IB vcc b1 DC ${num(c.p('ib'))}`,
      ...(puente ? ['VPUENTE b1 b2 0'] : [`R1 b1 bm ${ng(c.p('r1'))}`, `R2 bm b2 ${ng(c.p('r2'))}`, 'Q3 b1 bm b2 QM']),
      fuenteEntrada(c, 'VIN', 'b2', analisis),
      'VC1 vcc k1 0',
      'Q1 k1 b1 e1 QN',
      `RE1 e1 out ${ng(c.p('re'))}`,
      `RE2 out e2 ${ng(c.tiene('re2') ? c.p('re2') : c.p('re'))}`,
      'Q2 k2 b2 e2 QP',
      'VC2 k2 vee 0',
      'VL out l 0',
      `RL l 0 ${ng(c.p('carga'))}`,
      ...(q1Conduce(c) ? [] : [`VZBE zbe 0 DC ${num(c.p('vbe'))}`]),
      bjtEn('QN', 'NPN', c.p('beta'), c.p('vbe'), iref(c)),
      bjtEn('QP', 'PNP', c.p('beta'), c.p('vbe'), iref(c)),
      bjtEn('QM', 'NPN', c.tiene('betam') ? c.p('betam') : 1e6, vbem, ic3 > 0 ? ic3 : 1e-3),
    ];
  },
  describir: (c) => {
    const bias = c.tiene('puente') && c.cerrado('puente') ? 'el multiplicador puenteado (clase B, sin bias)' : `un multiplicador de V_BE con ${c.sim('r1')} de ${c.val('r1')} y ${c.sim('r2')} de ${c.val('r2')}`;
    return `Etapa de salida complementaria entre ±${c.val('vcc')}: NPN arriba y PNP abajo como seguidores, ${c.sim('re')} de ${c.val('re')} en cada emisor${c.tiene('re2') ? ` (la de abajo de ${c.val('re2')})` : ''} y carga ${c.sim('carga')} de ${c.val('carga')}; fuente de bias de ${c.val('ib')} y ${bias} entre las bases; el driver en la base de abajo con ${describirEntrada(c)}; β ${c.val('beta')}`;
  },
};
export default d;
