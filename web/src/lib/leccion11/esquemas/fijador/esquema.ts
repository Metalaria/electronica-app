// Schematic «fijador»: a diode clamper (sección 5.9: a capacitor in series and a diode to ground; in steady state the
// capacitor holds V_p − vd and the whole signal is shifted, its maximum fixed at +vd or its minimum at −vd), and with
// a second diode and capacitor the Greinacher voltage doubler (sección 5.10: a clamper followed by a peak detector,
// V_out = 2·V_p − 2·V_f). No load: the capacitors start charged to their steady state (the transient's «IC»), so the
// curves are the steady ones from t = 0. Diodes in the book's constant-drop model (piece «vd»).
import { diodoCaida, ng, num, temperatura } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'fijador',
  titulo: 'Fijador y doblador con diodos',
  resumen: 'Entrada senoidal, condensador en serie y diodo a masa (fijador); con un segundo diodo y condensador, el doblador de Greinacher. Sin carga.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'amplitud (pico) de la tensión senoidal de entrada, V_p (V)' },
    f: { obligatoria: true, descripcion: 'frecuencia de la entrada (Hz)' },
    c: { obligatoria: true, descripcion: 'condensador en serie del fijador (F)', color: 'azul' },
    vd: { obligatoria: true, descripcion: 'caída de cada diodo cuando conduce (V): el modelo de caída constante' },
    sube: {
      interruptor: true,
      descripcion: 'sentido del diodo a masa: cerrado, cátodo en el nodo (la señal sube y su mínimo queda en −vd); abierto, ánodo en el nodo (baja y su máximo queda en +vd). Sin él, cerrado',
      color: 'naranja',
    },
    c2: { descripcion: 'condensador del detector de pico (F): con él, el doblador de Greinacher', color: 'verde' },
  },
  observables: {
    salida: { medida: 'v(s)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de salida: la del nodo en el fijador; la del condensador del detector en el doblador' },
    nodo: { medida: 'v(n)', analisis: 'tran', unidad: 'V', descripcion: 'tensión del nodo del diodo a masa: la señal desplazada' },
    entrada: { medida: 'v(fte)', analisis: 'tran', unidad: 'V', descripcion: 'tensión senoidal de entrada' },
  },
  // 0,2 V per diode: the simulator's diodes drop vd at 10 mA with n = 1; without load they only conduct at the peaks
  // to make up the simulator's own leakage, so their real drop there is lower (and the shift a little larger) than
  // the book's constant drop.
  noLineal: () => [{ pieza: 'vd', desviacion: 0.2, porque: 'diodos de caída vd a 10 mA, n = 1; sin carga solo conducen en los picos, con poca corriente' }],
  netlist(c) {
    const vp = c.p('fuente');
    const vd = c.p('vd');
    const sube = c.cerrado('sube');
    const s = sube ? 1 : -1;
    const lineas = [
      temperatura(),
      `VF fte 0 DC 0 SIN(0 ${num(vp)} ${num(c.p('f'))})`,
      // steady state from t = 0: the node is the input shifted by ±(V_p − vd), so the capacitor holds ∓(V_p − vd)
      `C1 fte n ${ng(c.p('c'))} IC=${num(-s * Math.max(0, vp - vd))}`,
      sube ? 'D1 0 n DX' : 'D1 n 0 DX',
      'RX n 0 1e9',
      diodoCaida('DX', vd),
    ];
    if (c.tiene('c2')) lineas.push(sube ? 'D2 n s DX' : 'D2 s n DX', `C2 s 0 ${ng(c.p('c2'))} IC=${num(s * Math.max(0, 2 * vp - 2 * vd))}`, 'RS s 0 1e9');
    else lineas.push('VS n s 0');
    return lineas;
  },
  describir: (c) =>
    `${c.tiene('c2') ? 'Doblador de Greinacher' : 'Fijador'}: entrada senoidal de ${c.val('fuente')} de pico y ${c.val('f')}, condensador de ${c.val('c')} en serie y un diodo a masa con el ${c.cerrado('sube') ? 'cátodo' : 'ánodo'} en el nodo${c.tiene('c2') ? `, seguido de un diodo y un condensador de ${c.val('c2')} que guardan el pico` : ''}; cada diodo cae ${c.val('vd')} cuando conduce; sin carga`,
};
export default d;
