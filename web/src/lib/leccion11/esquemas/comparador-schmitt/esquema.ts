// Schematic «comparador-schmitt» (1.2, esquemas12): the comparator and the Schmitt trigger (sección 8.3): the input to
// the − input; the + input through R₁ to a reference V_ref (ground without it) and, for the Schmitt trigger, through
// R₂ to the output (positive feedback). The output sits at +V_sat or −V_sat (pieces «vsat», «vsatneg»); with R₂ the
// threshold is V₊ = (V_ref·R₂ ± V_sat·R₁)/(R₁ + R₂) (with V_ref = 0, ±V_sat·R₁/(R₁ + R₂): ±1,09 V with 10 kΩ, 100 kΩ
// and ±12 V), so it switches low when the input rises above the upper one and high when it falls below the lower
// one. Without R₂ it is a plain comparator at V_ref. «alto» (1 high, 0 low; default high) is where the output was
// before: in DC, inside the hysteresis window, both states are possible; in the transient, the state at t = 0. The
// amplifier is the app's model (comun-ao.ts); the model draws the edges as jumps (tran.bordes: ± 0,15 % of the axis).
import { ng, num } from '../comun';
import { describirAO, describirEntrada, netlistAO, observablesAO, piezasAO, piezasEntrada, datosAO } from '../comun-ao';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'comparador-schmitt',
  titulo: 'Comparador y disparador de Schmitt',
  resumen: 'La entrada a la entrada −, la + por R₁ a una referencia y por R₂ a la salida (histéresis); la salida en ±V_sat.',
  piezas: {
    ...piezasEntrada(),
    r1: { descripcion: 'resistencia de la entrada + a la referencia, R₁ (Ω)', color: 'azul' },
    r2: { descripcion: 'resistencia de realimentación positiva, de la salida a la entrada +, R₂ (Ω; sin ella, comparador simple)', color: 'naranja' },
    ref: { descripcion: 'tensión de referencia, V_ref (V; sin ella, masa)' },
    alto: { interruptor: true, descripcion: 'estado de la salida antes (1 alto, 0 bajo; sin él, alto)' },
    ...piezasAO(),
    vsat: { obligatoria: true, descripcion: 'tensión de saturación positiva de la salida, +V_sat (V)', color: 'verde' },
  },
  observables: {
    ...observablesAO(),
    vmas: { medida: 'v(p)', analisis: 'op', unidad: 'V', descripcion: 'tensión de la entrada + (el umbral)' },
    umbral: { medida: 'v(p)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la entrada + (el umbral) frente al tiempo' },
  },
  validar: (tiene) => (tiene('r2') && !tiene('r1') ? ['con «r2» (histéresis) hace falta «r1»'] : []),
  netlist(c, analisis) {
    const histeresis = c.tiene('r2');
    const ref = c.tiene('ref') ? [`VREF ref 0 DC ${num(c.p('ref'))}`] : [];
    const nodoRef = c.tiene('ref') ? 'ref' : '0';
    const d = datosAO(c);
    return netlistAO(
      c,
      analisis,
      (fuente) => [fuente, ...ref, ...(c.tiene('r1') ? [`R1 p ${nodoRef} ${ng(c.p('r1'))}`] : [`VP p ${nodoRef} 0`]), ...(histeresis ? [`R2 p out ${ng(c.p('r2'))}`] : [])],
      { mas: 'p', menos: 'in', salida: 'out' },
      { biestable: histeresis, comparador: true, ...(histeresis && analisis === 'tran' ? { inicio: c.cerrado('alto') ? d.alto : d.bajo } : {}) },
    );
  },
  tran: { bordes: () => 0.0015 },
  describir: (c) =>
    `${c.tiene('r2') ? 'Disparador de Schmitt' : 'Comparador'}: ${describirEntrada(c)} a la entrada −; la entrada + ${c.tiene('r1') ? `por ${c.sim('r1')} de ${c.val('r1')} ` : ''}a ${c.tiene('ref') ? `una referencia de ${c.val('ref')}` : 'masa'}${c.tiene('r2') ? ` y por ${c.sim('r2')} de ${c.val('r2')} a la salida` : ''}; ${describirAO(c)}`,
};
export default d;
