// Schematic «rectificador-toma-media» (1.2, esquemas12b): a symmetric ±V supply — a transformer whose secondary has a
// centre tap at ground (15-0-15 V: each half gives its own peak), a bridge of four diodes in which, the tap being
// ground, each branch crosses a single diode (sección 5.6), and a reservoir capacitor on each rail; full-wave ripple at
// 2f on both. Optionally a 78xx/79xx pair as ideal clamps with a dropout (sección 8.4): the output is ±reg, or the
// capacitor's voltage minus the dropout when it is short of it, and the regulator takes from its capacitor the current
// it gives its load. The load of each rail is a resistor, a constant current (what a regulator with a steady load
// draws: the book's linear discharge ΔV = I/(2f·C), sección 14.2), or both. Diodes in the constant-drop model («vd»).
import { diodoCaida, ng, num, temperatura } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'rectificador-toma-media',
  titulo: 'Fuente simétrica: secundario con toma media, puente y dos condensadores',
  resumen: 'Secundario con toma media a masa, puente de cuatro diodos (un diodo por rama), un condensador por raíl para ±V; reguladores 78xx/79xx opcionales.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión de pico de cada mitad del secundario, V_p (V)' },
    f: { obligatoria: true, descripcion: 'frecuencia de la red (Hz); el rizado va a 2f' },
    vd: { obligatoria: true, descripcion: 'caída de cada diodo cuando conduce (V): el modelo de caída constante' },
    c: { descripcion: 'condensador de filtro de cada raíl (F)', color: 'naranja' },
    carga: { descripcion: 'resistencia de carga de cada raíl, a masa (Ω)', color: 'verde' },
    i: { descripcion: 'corriente constante que consume cada raíl (A): la de un regulador con su carga fija', color: 'verde' },
    reg: { descripcion: 'tensión de los reguladores, ±V_reg (V; un 7812 y un 7912: 12): la carga cuelga de su salida' },
    dropout: { descripcion: 'diferencia mínima entre entrada y salida de cada regulador (V; sin ella, 0; un 78xx, unos 2 V)' },
  },
  observables: {
    positivo: { medida: 'v(p)', analisis: 'tran', unidad: 'V', descripcion: 'tensión del condensador del raíl positivo' },
    negativo: { medida: 'v(n)', analisis: 'tran', unidad: 'V', descripcion: 'tensión del condensador del raíl negativo' },
    salida_pos: { medida: 'v(op)', analisis: 'tran', unidad: 'V', descripcion: 'salida del regulador positivo', requiere: ['reg'] },
    salida_neg: { medida: 'v(on)', analisis: 'tran', unidad: 'V', descripcion: 'salida del regulador negativo', requiere: ['reg'] },
    entrada: { medida: 'v(a)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la mitad superior del secundario, frente a la toma media' },
    id_pos: { medida: 'i(vdp)', analisis: 'tran', unidad: 'A', descripcion: 'corriente de los diodos al raíl positivo (los pulsos de recarga)' },
    id_neg: { medida: 'i(vdn)', analisis: 'tran', unidad: 'A', descripcion: 'corriente de los diodos desde el raíl negativo (en magnitud)' },
    icarga: { medida: 'i(vmlp)', analisis: 'tran', unidad: 'A', descripcion: 'corriente de la carga del raíl positivo' },
  },
  // 0,2 V per diode, as in «puente»: diodes that drop vd at 10 mA with n = 1, and recharge pulses of amperes
  noLineal: () => [{ pieza: 'vd', desviacion: 0.2, porque: 'diodos de caída vd a 10 mA, n = 1: + 0,17 V en pulsos de recarga de 8 A' }],
  validar: (tiene) => [
    ...(!tiene('carga') && !tiene('i') && !tiene('c') ? ['falta la carga, la corriente, el condensador o varios (si no, la salida queda al aire)'] : []),
    ...(tiene('i') && !tiene('c') ? ['una corriente constante («i») necesita el condensador «c»: sin él, entre pulsos nadie la da'] : []),
    ...(tiene('dropout') && !tiene('reg') ? ['«dropout» solo con los reguladores («reg»)'] : []),
  ],
  // with capacitors, they start charged to the peak and four periods pass before the curve is compared
  tran: { periodos: (c) => (c.tiene('c') ? 4 : 0) },
  netlist(c) {
    const vp = c.p('fuente');
    const vd = c.p('vd');
    const reg = c.tiene('reg');
    const v0 = Math.max(0, vp - vd);
    // each rail's load, on the node `x` (the capacitor, or the regulator's output), through its 0 V meter; the
    // negative rail mirrors the positive one (currents counted as magnitudes)
    const cargas = (x: string, l: string, med: string, pos: boolean): string[] => [
      pos ? `${med} ${x} ${l} 0` : `${med} ${l} ${x} 0`,
      ...(c.tiene('carga') ? [`RC${med.slice(3)} ${l} 0 ${ng(c.p('carga'))}`] : []),
      ...(c.tiene('i') ? [pos ? `IC${med.slice(3)} ${l} 0 DC ${num(c.p('i'))}` : `IC${med.slice(3)} 0 ${l} DC ${num(c.p('i'))}`] : []),
      // (keeps the meter's node tied when there is no resistor)
      `RZ${med.slice(3)} ${l} 0 1e9`,
    ];
    const dropout = c.p('dropout');
    return [
      temperatura(),
      // the centre tap is ground: the two halves in antiphase
      `VA a 0 DC 0 SIN(0 ${num(vp)} ${num(c.p('f'))})`,
      'EB b 0 a 0 -1',
      'D1 a pp DX',
      'D2 b pp DX',
      'VDP pp p 0',
      'D3 nn a DX',
      'D4 nn b DX',
      'VDN n nn 0',
      diodoCaida('DX', vd),
      ...(c.tiene('c') ? [`C1 p 0 ${ng(c.p('c'))} IC=${num(v0)}`, `C2 n 0 ${ng(c.p('c'))} IC=${num(-v0)}`] : []),
      'RXP p 0 1e9',
      'RXN n 0 1e9',
      ...(reg
        ? [
            // ideal clamps: ±reg, or the capacitor minus the dropout; each takes from its capacitor what its load takes
            `BRP op 0 V = min(${num(c.p('reg'))}, max(0, v(p) - ${num(dropout)}))`,
            `BRN on 0 V = max(${num(-c.p('reg'))}, min(0, v(n) + ${num(dropout)}))`,
            'BIP p 0 I = i(vmlp)',
            'BIN 0 n I = i(vmln)',
            ...cargas('op', 'lp', 'VMLP', true),
            ...cargas('on', 'ln', 'VMLN', false),
          ]
        : [...cargas('p', 'lp', 'VMLP', true), ...cargas('n', 'ln', 'VMLN', false)]),
    ];
  },
  describir: (c) =>
    `Fuente simétrica: secundario con toma media a masa, ${c.val('fuente')} de pico en cada mitad a ${c.val('f')}; puente de cuatro diodos de ${c.val('vd')}, un diodo por rama${c.tiene('c') ? `; un condensador de ${c.val('c')} en cada raíl` : ''}${c.tiene('reg') ? `; reguladores de más y menos ${c.val('reg')}${c.tiene('dropout') ? ` con ${c.val('dropout')} de dropout` : ''}` : ''}; en cada raíl, ${[c.tiene('carga') ? `carga de ${c.val('carga')}` : '', c.tiene('i') ? `consumo constante de ${c.val('i')}` : ''].filter(Boolean).join(' y ') || 'sin carga'}`,
};
export default d;
