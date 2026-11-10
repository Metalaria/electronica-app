// Schematic «bjt-polarizacion»: the common-emitter stage biased by a divider with emitter resistor (sección 6.5 «El
// divisor con emisor, analizado»: V_CC = 12 V, R₁ = 47 kΩ, R₂ = 10 kΩ, R_E = 1 kΩ, R_C = 3,3 kΩ; V_Th = 2,105 V,
// R_Th = 8,25 kΩ; I_C from 1,186 mA at β = 50). The book's model: V_BE = 0,7 V, I_C = β·I_B (active region).
import { ng, npn } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'bjt-polarizacion',
  titulo: 'Polarización por divisor con resistencia de emisor',
  resumen: 'NPN en emisor común: divisor R₁–R₂ en la base, R_C y R_E; el punto de trabajo.',
  piezas: {
    vcc: { obligatoria: true, descripcion: 'alimentación, V_CC (V)' },
    r1: { obligatoria: true, descripcion: 'resistencia de arriba del divisor (Ω)', color: 'azul' },
    r2: { obligatoria: true, descripcion: 'resistencia de abajo del divisor (Ω)', color: 'azul' },
    rc: { obligatoria: true, descripcion: 'resistencia de colector (Ω)', color: 'naranja' },
    re: { obligatoria: true, descripcion: 'resistencia de emisor (Ω)', color: 'verde' },
    beta: { obligatoria: true, descripcion: 'ganancia de corriente β' },
    vbe: { obligatoria: true, descripcion: 'V_BE cuando conduce (V; el libro: 0,7 V)' },
  },
  observables: {
    ib: { medida: 'i(vbm)', analisis: 'op', unidad: 'A', descripcion: 'corriente de base' },
    ic: { medida: 'i(vcm)', analisis: 'op', unidad: 'A', descripcion: 'corriente de colector' },
    vb: { medida: 'v(b)', analisis: 'op', unidad: 'V', descripcion: 'tensión de base' },
    ve: { medida: 'v(e)', analisis: 'op', unidad: 'V', descripcion: 'tensión de emisor' },
    vc: { medida: 'v(c)', analisis: 'op', unidad: 'V', descripcion: 'tensión de colector' },
    vce: { medida: 'v(c)-v(e)', analisis: 'op', unidad: 'V', descripcion: 'tensión colector-emisor' },
  },
  // V_BE ± 0,1 V: the simulator's transistor drops vbe at 1 mA with n = 1 (± 0,1 V from 20 µA to 50 mA)
  noLineal: () => [{ pieza: 'vbe', desviacion: 0.1, porque: 'transistor de V_BE = vbe a 1 mA: ± 0,1 V entre 20 µA y 50 mA', medida: () => 'v(b)-v(e)' }],
  netlist: (c) => [
    `VCC vcc 0 DC ${c.p('vcc')}`,
    `R1 vcc d ${ng(c.p('r1'))}`,
    `R2 d 0 ${ng(c.p('r2'))}`,
    'VBM d b 0',
    'VCM vcc x 0',
    `RC x c ${ng(c.p('rc'))}`,
    'Q1 c b e QN',
    `RE e 0 ${ng(c.p('re'))}`,
    npn('QN', c.p('beta'), c.p('vbe')),
  ],
  describir: (c) =>
    `Etapa en emisor común con ${c.val('vcc')}: divisor de ${c.sim('r1')} ${c.val('r1')} y ${c.sim('r2')} ${c.val('r2')} en la base; ${c.sim('rc')} de ${c.val('rc')} en el colector y ${c.sim('re')} de ${c.val('re')} en el emisor; β ${c.val('beta')}`,
};
export default d;
