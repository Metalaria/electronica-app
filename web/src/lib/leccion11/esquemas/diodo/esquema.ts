// Schematic «diodo»: a source, a resistor and a diode in series (sección 5.3: the operating point; the table of
// voltages for IS = 10⁻¹² A and n = 1; «el diodo cae 0,7 V»). The diode is in the book's constant-drop model (piece
// «vd») or in Shockley's (pieces «is», «n», «vt»): comun-diodo.ts. A negative source biases it in reverse.
import { ng } from '../comun';
import { alReves, lineasReves, modeloDiodo, noLinealDiodoReves, piezaReves, piezasDiodo, validarDiodo } from '../comun-diodo';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'diodo',
  titulo: 'Diodo con resistencia (punto de trabajo)',
  resumen: 'Fuente, resistencia y diodo en serie; corriente y tensión del diodo, con el modelo de caída constante o el de Shockley.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de la fuente (V; negativa, polarización inversa)' },
    r: { obligatoria: true, descripcion: 'resistencia en serie (Ω)', color: 'azul' },
    ...piezasDiodo('vd', 'diodo'),
    // (esquemas12c: mounted the wrong way round, sección 11.2: it blocks)
    reves: piezaReves(),
  },
  observables: {
    corriente: { medida: 'i(vmed)', analisis: 'op', unidad: 'A', descripcion: 'corriente del diodo (de ánodo a cátodo)' },
    vd: { medida: 'v(an)', analisis: 'op', unidad: 'V', descripcion: 'tensión del diodo (ánodo menos cátodo)' },
    vr: { medida: 'v(a)-v(an)', analisis: 'op', unidad: 'V', descripcion: 'tensión de la resistencia' },
  },
  validar: validarDiodo('vd'),
  // 0,1 V: the simulator's diode drops vd at 10 mA with n = 1, so it stays within vd ± 0,1 V from 0,2 mA to 500 mA
  // (n·VT·ln 50 = 0,10 V), the currents of the book's examples; the book itself says the constant drop's error «es
  // menor que la dispersión entre unidades del mismo modelo».
  noLineal: noLinealDiodoReves('vd', 0.1, 'diodo de caída vd a 10 mA, n = 1: vd ± 0,1 V entre 0,2 mA y 500 mA', 'v(an)'),
  netlist: (c) => [`VF fte 0 DC ${c.p('fuente')}`, 'VMED fte a 0', `R1 a an ${ng(c.p('r'))}`, alReves(c) ? 'D1 0 an DX' : 'D1 an 0 DX', ...lineasReves(c, 'vd'), ...modeloDiodo(c, 'DX', 'vd', 10e-3, 1)],
  describir: (c) =>
    `Fuente de ${c.val('fuente')}, ${c.sim('r')} de ${c.val('r')} y un diodo en serie${c.tiene('vd') ? `, que cae ${c.val('vd')} cuando conduce` : `, con la ecuación de Shockley (I_S ${c.val('is')}, n ${c.val('n')})`}${alReves(c) ? '; montado al revés' : ''}`,
};
export default d;
