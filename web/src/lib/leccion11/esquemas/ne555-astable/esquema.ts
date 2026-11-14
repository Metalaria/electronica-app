// Schematic «ne555-astable» (1.2, esquemas12): the NE555 in astable mode (sección 8.5): R_a from V_CC to the discharge
// pin, R_b from there to the capacitor C, which goes to the threshold and trigger pins. Inside, two comparators watch
// v_C against ⅓ and ⅔ of V_CC, a flip-flop keeps the state and the discharge transistor shorts the R_a–R_b node to
// ground while the output is low: C charges through R_a + R_b from ⅓ to ⅔ (t_alto = ln 2·(R_a + R_b)·C) and discharges
// through R_b alone (t_bajo = ln 2·R_b·C); 1 kΩ, 10 kΩ and 100 nF give 0,762 ms and 0,693 ms, 687 Hz (sección 8.5).
// In ngspice the comparators and the flip-flop are one voltage-controlled switch with hysteresis on v_C (on above ⅔,
// off below ⅓: exactly the 555's two thresholds and its memory), the discharge transistor is that switch (1 mΩ) and
// the output is V_CC while it is open, 0 V while it is closed (a second switch, the same thresholds). C starts at
// `v0` (default ⅓·V_CC, the steady oscillation from t = 0; 0 V for the first, longer charge from power-up), the
// output high. The model draws the edges as jumps; the switch turns at the first time step past a threshold, so the
// edges drift by up to a step per crossing (tran.bordes: ± 0,4 % of the axis, a few periods).
import { ng, num } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'ne555-astable',
  titulo: 'Temporizador NE555 en modo astable',
  resumen: 'V_CC, R_a, R_b y C con el 555 (dos comparadores a ⅓ y ⅔ de V_CC, biestable y transistor de descarga); v_C(t) y la salida.',
  piezas: {
    vcc: { obligatoria: true, descripcion: 'alimentación, V_CC (V)' },
    ra: { obligatoria: true, descripcion: 'resistencia de V_CC a la patilla de descarga, R_a (Ω)', color: 'azul' },
    rb: { obligatoria: true, descripcion: 'resistencia de la patilla de descarga al condensador, R_b (Ω)', color: 'azul' },
    c: { obligatoria: true, descripcion: 'condensador de temporización, C (F)', color: 'naranja' },
    v0: { descripcion: 'tensión del condensador en t = 0 (V; sin ella, ⅓·V_CC; menos de ⅔·V_CC)' },
  },
  observables: {
    vc: { medida: 'v(c)', analisis: 'tran', unidad: 'V', descripcion: 'tensión del condensador, v_C(t)' },
    salida: { medida: 'v(out)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de salida (V_CC en alto, 0 en bajo)' },
    i: { medida: 'i(vmb)', analisis: 'tran', unidad: 'A', descripcion: 'corriente por R_b hacia el condensador (positiva al cargar)' },
    descarga: { medida: 'v(dis)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la patilla de descarga' },
  },
  netlist(c) {
    const vcc = c.p('vcc');
    const v0 = c.tiene('v0') ? c.p('v0') : vcc / 3;
    return [
      `VCC vcc 0 DC ${num(vcc)}`,
      `RA vcc dis ${ng(c.p('ra'))}`,
      'VMB dis y 0',
      `RB y c ${ng(c.p('rb'))}`,
      `C1 c 0 ${ng(c.p('c'))} IC=${num(v0)}`,
      'SDIS dis 0 c 0 s555 OFF',
      'VQ1 q1 0 DC 1',
      'SQ q1 q c 0 s555 OFF',
      'RQ q 0 1e6',
      `EOUT out vcc q 0 ${num(-vcc)}`,
      `.model s555 SW(VT=${num(vcc / 2)} VH=${num(vcc / 6)} RON=1e-3 ROFF=1e15)`,
    ];
  },
  tran: { bordes: () => 0.004 },
  describir: (c) =>
    `Temporizador 555 en modo astable con ${c.val('vcc')}: ${c.sim('ra')} de ${c.val('ra')} de la alimentación a la patilla de descarga, ${c.sim('rb')} de ${c.val('rb')} de ella al condensador ${c.sim('c')} de ${c.val('c')}, unido a las patillas de umbral y disparo; dentro, dos comparadores a un tercio y dos tercios de la alimentación, un biestable y el transistor de descarga`,
};
export default d;
