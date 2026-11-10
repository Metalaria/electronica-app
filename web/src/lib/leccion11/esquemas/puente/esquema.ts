// Schematic «puente»: a full-wave bridge rectifier — four diodes, two in each half cycle, an optional filter capacitor
// and an optional load (sección 5.6: a 12 V transformer, 16,97 V of peak, 15,57 V after the bridge's 1,4 V; the
// ripple ΔV = I/(f_rizado·C), 100 Hz from 50 Hz). Diodes in the book's constant-drop model (piece «vd»).
import { diodoCaida, ng, num, temperatura } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'puente',
  titulo: 'Rectificador en puente',
  resumen: 'Entrada alterna, puente de cuatro diodos, condensador de filtro y carga opcionales; la salida frente al tiempo.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'amplitud (pico) de la tensión alterna de entrada, V_p (V)' },
    f: { obligatoria: true, descripcion: 'frecuencia de la red (Hz)' },
    vd: { obligatoria: true, descripcion: 'caída de cada diodo cuando conduce (V): el modelo de caída constante' },
    c: { descripcion: 'condensador de filtro (F)', color: 'naranja' },
    carga: { descripcion: 'resistencia de carga (Ω)', color: 'verde' },
  },
  observables: {
    salida: { medida: 'v(s)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de salida, v_s(t)' },
    entrada: { medida: 'v(p)-v(q)', analisis: 'tran', unidad: 'V', descripcion: 'tensión alterna de entrada' },
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
      `VF p q DC 0 SIN(0 ${num(vp)} ${num(c.p('f'))})`,
      'VDM p a 0',
      'D1 a s DX',
      'D2 q s DX',
      'D3 0 a DX',
      'D4 0 q DX',
      diodoCaida('DX', c.p('vd')),
      // (the source floats: these keep its nodes tied to ground for the simulator, and take nothing)
      'RA a 0 1e9',
      'RQ q 0 1e9',
      ...(c.tiene('c') ? [`C1 s 0 ${ng(c.p('c'))} IC=${num(Math.max(0, vp - 2 * c.p('vd')))}`] : []),
      ...(c.tiene('carga') ? [`RL s 0 ${ng(c.p('carga'))}`] : []),
      'RX s 0 1e9',
    ];
  },
  describir: (c) =>
    `Rectificador en puente de cuatro diodos: entrada alterna de ${c.val('fuente')} de pico y ${c.val('f')}${c.tiene('c') ? `, condensador de ${c.val('c')}` : ''}${c.tiene('carga') ? `, carga de ${c.val('carga')}` : ', sin carga'}`,
};
export default d;
