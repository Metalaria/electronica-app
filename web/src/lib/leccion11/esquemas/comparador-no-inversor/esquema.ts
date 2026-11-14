// Schematic «comparador-no-inversor» (1.2, esquemas12c): the non-inverting comparator with hysteresis (problema 26.C,
// the thermostat: 3,9 kΩ, 100 kΩ and 2,5 V): the signal through R₁ to the + input, R₂ from the output back to it
// (positive feedback), the reference V_ref on the − input (ground without it). The + input is
// V₊ = (v_in·R₂ + v_o·R₁)/(R₁ + R₂), so the output goes high when the input rises above
// V_alto = V_ref·(1 + R₁/R₂) − V_bajo_sal·R₁/R₂ and low when it falls below V_bajo = V_ref·(1 + R₁/R₂) − V_alto_sal·R₁/R₂
// (with outputs 0 and 5 V: 2,5975 V and 2,4025 V, a window of V_sal·R₁/R₂ = 0,195 V). Unlike «comparador-schmitt»
// (the input on the − input) it does not invert. «alto» is where the output was before; the amplifier is the app's
// model (comun-ao.ts), with its edges as jumps (tran.bordes: ± 0,15 % of the axis).
import { ng, num } from '../comun';
import { datosAO, describirAO, describirEntrada, netlistAO, observablesAO, piezasAO, piezasEntrada } from '../comun-ao';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'comparador-no-inversor',
  titulo: 'Comparador no inversor con histéresis',
  resumen: 'La señal por R₁ a la entrada +, R₂ de la salida a ella (histéresis) y la referencia en la −; la salida no invierte.',
  piezas: {
    ...piezasEntrada(),
    r1: { obligatoria: true, descripcion: 'resistencia de la señal a la entrada +, R₁ (Ω)', color: 'azul' },
    r2: { obligatoria: true, descripcion: 'resistencia de realimentación positiva, de la salida a la entrada +, R₂ (Ω)', color: 'naranja' },
    ref: { descripcion: 'tensión de referencia en la entrada −, V_ref (V; sin ella, masa)' },
    alto: { interruptor: true, descripcion: 'estado de la salida antes (1 alto, 0 bajo; sin él, alto)' },
    ...piezasAO(),
    vsat: { obligatoria: true, descripcion: 'tensión de la salida en alto, +V_sat (V)', color: 'verde' },
  },
  observables: {
    ...observablesAO(),
    vmas: { medida: 'v(p)', analisis: 'op', unidad: 'V', descripcion: 'tensión de la entrada +' },
    mas: { medida: 'v(p)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la entrada + frente al tiempo' },
  },
  netlist(c, analisis) {
    const ref = c.tiene('ref') ? [`VREF m 0 DC ${num(c.p('ref'))}`] : ['VM m 0 0'];
    const d = datosAO(c);
    return netlistAO(
      c,
      analisis,
      (fuente) => [fuente, ...ref, `R1 in p ${ng(c.p('r1'))}`, `R2 p out ${ng(c.p('r2'))}`],
      { mas: 'p', menos: 'm', salida: 'out' },
      { biestable: true, comparador: true, ...(analisis === 'tran' ? { inicio: c.cerrado('alto') ? d.alto : d.bajo } : {}) },
    );
  },
  tran: { bordes: () => 0.0015 },
  describir: (c) =>
    `Comparador no inversor con histéresis: ${describirEntrada(c)} por ${c.sim('r1')} de ${c.val('r1')} a la entrada +, ${c.sim('r2')} de ${c.val('r2')} de la salida a la entrada + y ${c.tiene('ref') ? `una referencia de ${c.val('ref')}` : 'masa'} en la entrada −; ${describirAO(c)}`,
};
export default d;
