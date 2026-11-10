// Schematic «espejo»: the simple current mirror (sección 6.11 «El espejo simple»; problema 6.B: a 1 mA source). Q1
// has collector and base joined (a diode) and takes the reference current through R_ref from V_CC; Q2 shares its base
// and copies the current into a load from V_CC. Optionally a mismatch ΔV_BE between the two («La sensibilidad al
// apareamiento»: 5 mV give 21 %), drawn as a small source in series with Q2's base, so I_C2 = I_C1·e^(ΔV/V_T).
// The book's model: V_BE = 0,7 V, I_out = I_ref/(1 + 2/β) with identical transistors (error 2/(β + 2)); the simulator's
// transistors have the lesson's β and drop vbe at 1 mA (comun.ts npn, no Early effect), at the temperature that gives
// the book's V_T = 25,85 mV, so the mismatch's exponential is exact.
import { ng, npn, num, temperatura } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'espejo',
  titulo: 'Espejo de corriente simple',
  resumen: 'Dos NPN con las bases unidas: Q1 en diodo con R_ref desde V_CC, Q2 copia la corriente en la carga.',
  piezas: {
    vcc: { obligatoria: true, descripcion: 'alimentación, V_CC (V)' },
    rref: { obligatoria: true, descripcion: 'resistencia de referencia, de V_CC al colector y la base de Q1 (Ω)', color: 'azul' },
    carga: { obligatoria: true, descripcion: 'carga, de V_CC al colector de Q2 (Ω)', color: 'naranja' },
    beta: { obligatoria: true, descripcion: 'ganancia de corriente β de los dos transistores' },
    vbe: { obligatoria: true, descripcion: 'V_BE cuando conduce (V; el libro: 0,7 V)' },
    dvbe: { descripcion: 'desapareamiento: V_BE de más que recibe Q2 a la misma corriente (V); sin ella, idénticos' },
  },
  observables: {
    iref: { medida: 'i(vrm)', analisis: 'op', unidad: 'A', descripcion: 'corriente de referencia (por R_ref)' },
    iout: { medida: 'i(vom)', analisis: 'op', unidad: 'A', descripcion: 'corriente copiada (por la carga, al colector de Q2)' },
    vout: { medida: 'v(c2)', analisis: 'op', unidad: 'V', descripcion: 'tensión de colector de Q2' },
    vbe: { medida: 'v(c1)', analisis: 'op', unidad: 'V', descripcion: 'tensión base-emisor de Q1' },
  },
  // V_BE ± 0,1 V: the simulator's transistors drop vbe at 1 mA with n = 1 (± 0,1 V from 20 µA to 50 mA)
  noLineal: () => [{ pieza: 'vbe', desviacion: 0.1, porque: 'transistor de V_BE = vbe a 1 mA: ± 0,1 V entre 20 µA y 50 mA', medida: () => 'v(c1)' }],
  netlist: (c) => [
    `VCC vcc 0 DC ${c.p('vcc')}`,
    'VRM vcc x 0',
    `RREF x c1 ${ng(c.p('rref'))}`,
    'Q1 c1 c1 0 QN',
    // the base currents of both transistors leave Q1's collector node: Q2's through this source (its mismatch)
    // (V(b2) = V(c1) + dvbe: Q2's base sits dvbe above Q1's)
    `VOS b2 c1 DC ${num(c.p('dvbe'))}`,
    'Q2 c2 b2 0 QN',
    'VOM vcc y 0',
    `RL y c2 ${ng(c.p('carga'))}`,
    npn('QN', c.p('beta'), c.p('vbe')),
    temperatura(),
  ],
  describir: (c) =>
    `Espejo de corriente simple con ${c.val('vcc')}: ${c.sim('rref')} de ${c.val('rref')} hacia Q1, con colector y base unidos; Q2 comparte la base y alimenta una carga de ${c.val('carga')}; β ${c.val('beta')}` +
    (c.tiene('dvbe') ? `; Q2 recibe ${c.val('dvbe')} más de tensión base-emisor` : ''),
};
export default d;
