// Schematic «bjt-interruptor»: an NPN with its collector resistor from V_CC and its base resistor from a drive
// voltage (sección 6.2: 12 V, 1 kΩ, base from 5 V, β = 100 — R_B = 100 kΩ in the active region, 7,7 V; R_B = 10 kΩ
// saturated, 11,8 mA with V_CE = 0,2 V; sección 6.7 the switch and the forced β). The book's model: V_BE = 0,7 V,
// I_C = β·I_B in the active region, V_CE(sat) = 0,2 V; the simulator's transistor has the lesson's β and drops vbe
// at 1 mA (comun.ts npn).
import { ng, npn } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'bjt-interruptor',
  titulo: 'Transistor como interruptor',
  resumen: 'NPN con R_C desde V_CC y R_B desde la tensión de mando; corte, activa o saturación.',
  piezas: {
    vcc: { obligatoria: true, descripcion: 'alimentación del colector, V_CC (V)' },
    rc: { obligatoria: true, descripcion: 'resistencia de colector o carga (Ω)', color: 'naranja' },
    entrada: { obligatoria: true, descripcion: 'tensión de mando de la base (V; 0 = apagado)' },
    rb: { obligatoria: true, descripcion: 'resistencia de base (Ω)', color: 'azul' },
    beta: { obligatoria: true, descripcion: 'ganancia de corriente β' },
    vbe: { obligatoria: true, descripcion: 'V_BE cuando conduce (V; el libro: 0,7 V)' },
    vcesat: { descripcion: 'V_CE de saturación (V; el libro: 0,2 V)' },
  },
  observables: {
    ib: { medida: 'i(vbm)', analisis: 'op', unidad: 'A', descripcion: 'corriente de base' },
    ic: { medida: 'i(vcm)', analisis: 'op', unidad: 'A', descripcion: 'corriente de colector' },
    vce: { medida: 'v(c)', analisis: 'op', unidad: 'V', descripcion: 'tensión colector-emisor' },
    vbe: { medida: 'v(b)', analisis: 'op', unidad: 'V', descripcion: 'tensión base-emisor' },
  },
  // V_BE ± 0,1 V: the simulator's transistor drops vbe at 1 mA with n = 1, so within ± 0,1 V from 20 µA to 50 mA;
  // V_CE(sat) ± 0,2 V: with Ebers–Moll (β_R = 1) and a forced β between 3 and 10 (sección 6.7) the real one is 0,05
  // to 0,15 V, against the book's 0,2 V
  noLineal: (tiene) => [
    { pieza: 'vbe', desviacion: 0.1, porque: 'transistor de V_BE = vbe a 1 mA: ± 0,1 V entre 20 µA y 50 mA', medida: () => 'v(b)' },
    ...(tiene('vcesat') ? [{ pieza: 'vcesat', desviacion: 0.2, porque: 'V_CE(sat) real de 0,05 a 0,15 V con β forzada de 3 a 10', medida: () => 'v(c)' }] : []),
  ],
  netlist: (c) => [
    `VCC vcc 0 DC ${c.p('vcc')}`,
    'VCM vcc x 0',
    `RC x c ${ng(c.p('rc'))}`,
    `VIN in 0 DC ${c.p('entrada')}`,
    'VBM in y 0',
    `RB y b ${ng(c.p('rb'))}`,
    'Q1 c b 0 QN',
    npn('QN', c.p('beta'), c.p('vbe')),
  ],
  describir: (c) =>
    `Transistor NPN como interruptor: colector con ${c.sim('rc')} de ${c.val('rc')} desde ${c.val('vcc')}; base con ${c.sim('rb')} de ${c.val('rb')} desde ${c.val('entrada')}; β ${c.val('beta')}`,
};
export default d;
