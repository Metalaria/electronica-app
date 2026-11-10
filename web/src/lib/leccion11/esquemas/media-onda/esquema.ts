// Schematic «media-onda»: a half-wave rectifier — one diode from the AC input to the output, an optional filter
// capacitor and an optional load (sección 5.6: 325 V of peak gives 104 V of mean without filter, Vp/π; with a
// capacitor the output stays near the peak; without load, a peak detector, sección 5.10). Diodes in the book's
// constant-drop model (piece «vd»).
import { diodoCaida, ng, num, temperatura } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'media-onda',
  titulo: 'Rectificador de media onda',
  resumen: 'Entrada alterna, un diodo, condensador de filtro y carga opcionales; la salida frente al tiempo.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'amplitud (pico) de la tensión alterna de entrada, V_p (V)' },
    f: { obligatoria: true, descripcion: 'frecuencia de la red (Hz)' },
    vd: { obligatoria: true, descripcion: 'caída de cada diodo cuando conduce (V): el modelo de caída constante' },
    c: { descripcion: 'condensador de filtro (F)', color: 'naranja' },
    carga: { descripcion: 'resistencia de carga (Ω)', color: 'verde' },
  },
  observables: {
    salida: { medida: 'v(s)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de salida, v_s(t)' },
    entrada: { medida: 'v(fte)', analisis: 'tran', unidad: 'V', descripcion: 'tensión alterna de entrada' },
    id: { medida: 'i(vdm)', analisis: 'tran', unidad: 'A', descripcion: 'corriente que entrega la entrada (la de los diodos que conducen)' },
  },
  // 0,2 V per diode: the simulator's diodes drop vd at 10 mA with n = 1, and the capacitor's recharge pulses reach
  // amperes (sección 5.6: about 8 A at the start, 4,4 A on average): n·VT·ln(800) = 0,17 V at 8 A
  noLineal: () => [{ pieza: 'vd', desviacion: 0.2, porque: 'diodos de caída vd a 10 mA, n = 1: + 0,17 V en los pulsos de 8 A del libro' }],
  validar: (tiene) => (!tiene('c') && !tiene('carga') ? ['falta la carga, el condensador o los dos (si no, la salida queda al aire)'] : []),
  // with a capacitor, it starts charged to the peak and four periods pass before the curve is compared (the ripple
  // settles in the first one or two)
  tran: { periodos: (c) => (c.tiene('c') ? 4 : 0) },
  netlist(c) {
    const vp = c.p('fuente');
    return [
      temperatura(),
      `VF fte 0 DC 0 SIN(0 ${num(vp)} ${num(c.p('f'))})`,
      'VDM fte a 0',
      'D1 a s DX',
      diodoCaida('DX', c.p('vd')),
      ...(c.tiene('c') ? [`C1 s 0 ${ng(c.p('c'))} IC=${num(Math.max(0, vp - c.p('vd')))}`] : []),
      ...(c.tiene('carga') ? [`RL s 0 ${ng(c.p('carga'))}`] : []),
      'RX s 0 1e9',
    ];
  },
  describir: (c) =>
    `Rectificador de media onda: entrada alterna de ${c.val('fuente')} de pico y ${c.val('f')}, un diodo${c.tiene('c') ? `, condensador de ${c.val('c')}` : ''}${c.tiene('carga') ? `, carga de ${c.val('carga')}` : ', sin carga'}`,
};
export default d;
