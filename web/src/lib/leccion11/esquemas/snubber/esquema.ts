// Schematic «snubber» (1.2, esquemas12d; sección 10.6 «Snubbers», bloques 137 to 140 and 153, figura 10.11): the
// clamped inductive turn-off of a MOSFET as the book's figure computes it — a bus V_B, the load current I₀ (a large
// load inductance: constant during the transient), the MOSFET whose channel opens at t = 0, its output capacitance
// C_oss, and the clamp (freewheel) diode back to the bus through the stray loop inductance L, with the loop's losses
// R_p across L. At t = 0 I₀ moves into C_oss, which charges linearly (dv/dt = I₀/C_oss) until the drain reaches the
// bus; then the diode conducts through L, which rings with C_oss: Z₀ = √(L/C_oss), an ideal overshoot I₀·Z₀ (bloque
// 137: «una oscilación amortiguada que radia interferencia»). The RC snubber across the switch (bloques 139, 140: C a
// few times C_oss, R = Z₀; the switch «snubber» connects it) damps it. The figure's case: 400 V, 10 A, 100 nH, 250 pF,
// 200 Ω: 585 V peak without the snubber, under 480 V with 1 nF and 20 Ω. Transient from t = 0; the clamp diode drops
// 0,8 V at I₀ (the book's is ideal: a fraction of a percent of the bus).
import { diodoCaida, ng, num, temperatura } from '../comun';
import type { ContextoNetlist, DefinicionEsquema } from '../tipos';

/** The snubber is in the circuit: its two pieces, and its switch closed (or absent). */
export const conSnubber = (c: ContextoNetlist): boolean => c.tiene('rsn') && c.tiene('csn') && c.cerrado('snubber');

const d: DefinicionEsquema = {
  nombre: 'snubber',
  titulo: 'Apagado de una carga inductiva con snubber RC',
  resumen: 'Bus, corriente de carga I₀, MOSFET que se abre en t = 0 con su C_oss, diodo de libre circulación por la inductancia parásita L y una red R–C en paralelo con el interruptor.',
  piezas: {
    vb: { obligatoria: true, descripcion: 'tensión del bus, V_B (V)' },
    i0: { obligatoria: true, descripcion: 'corriente de la carga que se corta, I₀ (A)', color: 'verde' },
    l: { obligatoria: true, descripcion: 'inductancia parásita del lazo de conmutación, L (H; decenas o cientos de nanohenrios)', color: 'naranja' },
    rp: { descripcion: 'pérdidas del lazo, una resistencia R_p en paralelo con L (Ω; sin ella, ninguna)', color: 'naranja' },
    coss: { obligatoria: true, descripcion: 'capacidad de salida del transistor, C_oss (F)', color: 'naranja' },
    rsn: { descripcion: 'resistencia del snubber, R_s (Ω)', color: 'azul' },
    csn: { descripcion: 'condensador del snubber, C_s (F)', color: 'azul' },
    snubber: { interruptor: true, descripcion: 'conecta el snubber (sin él, conectado si hay «rsn» y «csn»)', color: 'azul' },
  },
  observables: {
    drenador: { medida: 'v(d)', analisis: 'tran', unidad: 'V', descripcion: 'tensión del drenador frente al tiempo' },
    bobina: { medida: 'i(vml)', analisis: 'tran', unidad: 'A', descripcion: 'corriente del diodo y la inductancia parásita frente al tiempo' },
    isnubber: { medida: 'i(vmsn)', analisis: 'tran', unidad: 'A', descripcion: 'corriente del snubber frente al tiempo', requiere: ['rsn', 'csn'] },
  },
  validar: (tiene) => [
    ...(tiene('rsn') !== tiene('csn') ? ['el snubber necesita las dos piezas, «rsn» y «csn»'] : []),
    ...(tiene('snubber') && !tiene('rsn') ? ['«snubber» lo conecta: hacen falta «rsn» y «csn»'] : []),
  ],
  netlist(c) {
    const sn = conSnubber(c);
    return [
      `VB bus 0 DC ${num(c.p('vb'))}`,
      `ILOAD bus d DC ${num(c.p('i0'))}`,
      `COSS d 0 ${ng(c.p('coss'))} IC=0`,
      'DCL d x DCL',
      temperatura(),
      diodoCaida('DCL', 0.8, Math.max(1e-3, c.p('i0'))),
      'VML x y 0',
      `LS y bus ${ng(c.p('l'))} IC=0`,
      ...(c.tiene('rp') ? [`RP y bus ${ng(c.p('rp'))}`] : []),
      ...(c.tiene('rsn') && c.tiene('csn') ? ['VMSN d s1 0', `RSN s1 s2 ${sn ? ng(c.p('rsn')) : '1e12'}`, `CSN s2 0 ${ng(c.p('csn'))} IC=0`] : []),
    ];
  },
  describir: (c) =>
    `Apagado con carga inductiva: bus de ${c.val('vb')}, corriente de carga de ${c.val('i0')} que, al abrirse el MOSFET en t = 0, pasa a su capacidad de salida de ${c.val('coss')} y luego, por el diodo, a la inductancia parásita de ${c.val('l')}${c.tiene('rp') ? ` con ${c.val('rp')} de pérdidas en paralelo` : ''}${c.tiene('rsn') ? (conSnubber(c) ? `; en paralelo con el interruptor, el snubber de ${c.val('rsn')} y ${c.val('csn')}` : '; el snubber, desconectado') : ''}`,
};
export default d;
