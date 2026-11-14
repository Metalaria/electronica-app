// Schematic «puerta-transmision» (1.2, esquemas12c; sección 8.8 and figura 44.17, the CMOS analog switch): an NMOS and
// a PMOS in parallel between the input and the output, the load R_L to ground. The control «ctrl» on: the NMOS gate at
// V_DD and the PMOS gate at 0 (both on where they can be); off: the other way round. ngspice's LEVEL=1 (KP = k, VTO =
// ±vth, no body effect; bodies at 0 and V_DD). In the ohmic region each channel conducts k·(V_ov·V_DS − V_DS²/2): the
// NMOS with V_ov = V_DD − V_in − V_tn + V_DS, the PMOS with V_ov = V_in − |V_tp|; with k_n = k_p the V_DS² terms cancel
// while both conduct, so R_on = 1/(k·(V_DD − V_tn − |V_tp|)) does not depend on the input — and near the rails only one
// conducts, its R_on rising as V_ov falls (the curve of figura 44.17).
import { ng, num } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'puerta-transmision',
  titulo: 'Puerta de transmisión CMOS',
  resumen: 'NMOS y PMOS en paralelo entre la entrada y la salida, con sus puertas en contrafase; carga a masa.',
  piezas: {
    vdd: { obligatoria: true, descripcion: 'alimentación, V_DD (V): la puerta del NMOS encendida y el sustrato del PMOS' },
    entrada: { obligatoria: true, descripcion: 'tensión de entrada, V_in (V; entre 0 y V_DD)' },
    carga: { obligatoria: true, descripcion: 'resistencia de carga a masa, R_L (Ω)', color: 'naranja' },
    kn: { obligatoria: true, descripcion: 'parámetro de transconductancia del NMOS, k_n (A/V²)', color: 'azul' },
    vtn: { obligatoria: true, descripcion: 'umbral del NMOS, V_tn (V)', color: 'azul' },
    kp: { obligatoria: true, descripcion: 'parámetro de transconductancia del PMOS, k_p (A/V²)', color: 'verde' },
    vtp: { obligatoria: true, descripcion: 'umbral del PMOS en valor absoluto, |V_tp| (V)', color: 'verde' },
    ctrl: { interruptor: true, descripcion: 'control: cerrado, la puerta conduce (NMOS a V_DD, PMOS a 0); abierto, no (sin él, conduce)' },
  },
  observables: {
    vout: { medida: 'v(o)', analisis: 'op', unidad: 'V', descripcion: 'tensión de salida' },
    corriente: { medida: 'i(vmi)', analisis: 'op', unidad: 'A', descripcion: 'corriente de la entrada a la salida' },
    caida: { medida: 'v(in)-v(o)', analisis: 'op', unidad: 'V', descripcion: 'caída en la puerta, V_in − V_out' },
  },
  netlist: (c) => {
    const on = c.cerrado('ctrl');
    return [
      `VDD vdd 0 DC ${num(c.p('vdd'))}`,
      `VIN in 0 DC ${num(c.p('entrada'))}`,
      'VMI in a 0',
      `VGN gn 0 DC ${num(on ? c.p('vdd') : 0)}`,
      `VGP gp 0 DC ${num(on ? 0 : c.p('vdd'))}`,
      'MN a gn o 0 NM W=1 L=1',
      'MP a gp o vdd PM W=1 L=1',
      `RL o 0 ${ng(c.p('carga'))}`,
      `.model NM NMOS(LEVEL=1 KP=${ng(c.p('kn'))} VTO=${num(c.p('vtn'))})`,
      `.model PM PMOS(LEVEL=1 KP=${ng(c.p('kp'))} VTO=${num(-c.p('vtp'))})`,
    ];
  },
  describir: (c) =>
    `Puerta de transmisión CMOS: un NMOS y un PMOS en paralelo entre la entrada de ${c.val('entrada')} y la salida, con ${c.sim('carga')} de ${c.val('carga')} a masa; ${c.cerrado('ctrl') ? `conduce: la puerta del NMOS a ${c.val('vdd')} y la del PMOS a 0 V` : `abierta: la puerta del NMOS a 0 V y la del PMOS a ${c.val('vdd')}`}; k_n ${c.val('kn')}, V_tn ${c.val('vtn')}, k_p ${c.val('kp')}, |V_tp| ${c.val('vtp')}`,
};
export default d;
