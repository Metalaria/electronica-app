// Schematic «bjt-interruptor»: an NPN with its collector resistor from V_CC and its base resistor from a drive
// voltage (sección 6.2: 12 V, 1 kΩ, base from 5 V, β = 100 — R_B = 100 kΩ in the active region, 7,7 V; R_B = 10 kΩ
// saturated, 11,8 mA with V_CE = 0,2 V; sección 6.7 the switch and the forced β). The book's model: V_BE = 0,7 V,
// I_C = β·I_B in the active region, V_CE(sat) = 0,2 V; the simulator's transistor has the lesson's β and drops vbe
// at 1 mA (comun.ts npn).
// 1.2 (esquemas12c): an optional LED in the collector, in series with R_C (piece «vf», its constant drop: sección 22.8,
// Práctica 8, a LED and 330 Ω), and the current «iref» at which V_BE = vbe (default 1 mA), so a power switch (sección
// 26.3: 500 mA with I_B of 20 to 40 mA) or a starved base (R_B = 1 MΩ, a few µA) keeps the book's 0,7 V within ± 0,1 V:
// the band is iref/50 to 50·iref.
import { diodoCaida, isCalibrada, ng, num, temperatura } from '../comun';
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
    vf: { descripcion: 'caída del LED en el colector, en serie con R_C (V; sin ella, sin LED)', color: 'naranja' },
    iref: { descripcion: 'corriente de colector a la que V_BE vale vbe (A; sin ella, 1 mA): ± 0,1 V entre iref/50 y 50·iref' },
  },
  observables: {
    ib: { medida: 'i(vbm)', analisis: 'op', unidad: 'A', descripcion: 'corriente de base' },
    ic: { medida: 'i(vcm)', analisis: 'op', unidad: 'A', descripcion: 'corriente de colector' },
    vce: { medida: 'v(c)', analisis: 'op', unidad: 'V', descripcion: 'tensión colector-emisor' },
    vbe: { medida: 'v(b)', analisis: 'op', unidad: 'V', descripcion: 'tensión base-emisor' },
    vled: { medida: 'v(k)-v(c)', analisis: 'op', unidad: 'V', descripcion: 'tensión del LED del colector', requiere: ['vf'] },
  },
  // V_BE ± 0,1 V: the simulator's transistor drops vbe at 1 mA with n = 1, so within ± 0,1 V from 20 µA to 50 mA;
  // V_CE(sat) ± 0,2 V: with Ebers–Moll (β_R = 1) and a forced β between 3 and 10 (sección 6.7) the real one is 0,05
  // to 0,15 V, against the book's 0,2 V
  // (esquemas12c: the LED drops vf at 20 mA with n = 2, like «led»: ± 0,2 V from 0,4 mA to 1 A; in cut-off it carries
  // almost nothing and drops far less, so cut-off cards read the currents)
  noLineal: (tiene) => [
    { pieza: 'vbe', desviacion: 0.1, porque: 'transistor de V_BE = vbe a iref (1 mA sin ella): ± 0,1 V entre iref/50 y 50·iref', medida: () => 'v(b)' },
    ...(tiene('vcesat') ? [{ pieza: 'vcesat', desviacion: 0.2, porque: 'V_CE(sat) real de 0,05 a 0,15 V con β forzada de 3 a 10', medida: () => 'v(c)' }] : []),
    ...(tiene('vf') ? [{ pieza: 'vf', desviacion: 0.2, porque: 'LED de caída vf a 20 mA, n = 2: la dispersión de 1,8 a 2,2 V del libro', medida: () => 'v(k)-v(c)' }] : []),
  ],
  netlist: (c) => {
    const iref = c.tiene('iref') && c.p('iref') > 0 ? c.p('iref') : 1e-3;
    const led = c.tiene('vf');
    return [
      `VCC vcc 0 DC ${c.p('vcc')}`,
      'VCM vcc x 0',
      `RC x ${led ? 'k' : 'c'} ${ng(c.p('rc'))}`,
      ...(led ? ['DL k c DLED', temperatura(), diodoCaida('DLED', c.p('vf'), 20e-3, 2)] : []),
      `VIN in 0 DC ${c.p('entrada')}`,
      'VBM in y 0',
      `RB y b ${ng(c.p('rb'))}`,
      'Q1 c b 0 QN',
      // (the book's NPN: β, BR = 1, no Early effect; V_BE = vbe at the collector current iref)
      `.model QN NPN(BF=${num(c.p('beta'))} BR=1 IS=${isCalibrada(Math.max(c.p('vbe'), 0.3), iref).toPrecision(8)})`,
    ];
  },
  describir: (c) =>
    `Transistor NPN como interruptor: colector con ${c.sim('rc')} de ${c.val('rc')}${c.tiene('vf') ? ` y un LED de ${c.val('vf')}` : ''} desde ${c.val('vcc')}; base con ${c.sim('rb')} de ${c.val('rb')} desde ${c.val('entrada')}; β ${c.val('beta')}`,
};
export default d;
