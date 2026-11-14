// Schematic «muestreo-retencion» (1.2, esquemas12): the sample-and-hold of sección 8.9: an analog switch with its
// R_on from the input to the hold capacitor C_h, read by a follower (the app's op-amp, comun-ao.ts). The switch is
// closed (sampling: C_h follows the input through R_on, the acquisition, sección 8.8) until `tm` and open after it
// (holding). At the opening its gate injects the charge `carga` (Q, C) into C_h: the pedestal ΔV = Q/C_h (10 pC on
// 1 nF, 10 mV); during the hold a leakage `fuga` (I, A: the switch's and the follower's input current) discharges it,
// the droop dV/dt = I/C_h (1 nA on 1 nF, 1 mV per ms). C_h starts at `v0`. With a DC input V:
// v_C = V + (v₀ − V)·e^(−t/(R_on·C_h)) until t_m, then v_C(t_m) + Q/C_h − I·(t − t_m)/C_h. The pedestal is a current
// pulse of area Q lasting t_m/10⁴; the model draws it as a jump (tran.bordes).
import { ng, num } from '../comun';
import { describirAO, describirEntrada, fuenteEntrada, lineasAO, piezasAO, piezasEntrada } from '../comun-ao';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'muestreo-retencion',
  titulo: 'Muestreo y retención',
  resumen: 'Interruptor con R_on, condensador de retención y seguidor; adquisición hasta t_m, luego el pedestal Q/C y la caída I/C.',
  piezas: {
    ...piezasEntrada(),
    ron: { obligatoria: true, descripcion: 'resistencia del interruptor cerrado, R_on (Ω)', color: 'azul' },
    ch: { obligatoria: true, descripcion: 'condensador de retención, C_h (F)', color: 'naranja' },
    tm: { obligatoria: true, descripcion: 'instante en que el interruptor se abre y empieza la retención, t_m (s)' },
    carga: { descripcion: 'carga que inyecta la puerta al abrir, Q (C; positiva: sube la tensión retenida)' },
    fuga: { descripcion: 'corriente de fuga que descarga C_h, I (A)' },
    v0: { descripcion: 'tensión de C_h en t = 0 (V; sin ella, 0)' },
    ...piezasAO(),
  },
  observables: {
    entrada: { medida: 'v(in)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de entrada' },
    vc: { medida: 'v(c)', analisis: 'tran', unidad: 'V', descripcion: 'tensión del condensador de retención' },
    salida: { medida: 'v(out)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de salida del seguidor' },
  },
  netlist(c) {
    const tm = Math.max(c.p('tm'), 1e-15);
    const tw = tm * 1e-4;
    const q = c.p('carga');
    return [
      fuenteEntrada(c),
      `VCTL ctl 0 DC 1 PULSE(1 0 ${num(tm)} ${num(tw / 10)} ${num(tw / 10)} ${num(1e6 * tm)} ${num(2e6 * tm)})`,
      'SSH in c ctl 0 ssh ON',
      `.model ssh SW(VT=0.5 VH=0 RON=${ng(c.p('ron'))} ROFF=1e15)`,
      `C1 c 0 ${ng(c.p('ch'))} IC=${num(c.p('v0'))}`,
      ...(c.tiene('carga') && q !== 0 ? [`IQ 0 c DC 0 PULSE(0 ${num(q / tw)} ${num(tm + tw / 10)} ${num(tw / 10)} ${num(tw / 10)} ${num(0.9 * tw)} ${num(2e6 * tm)})`] : []),
      ...(c.tiene('fuga') ? [`IF c 0 DC ${num(c.p('fuga'))}`] : []),
      ...lineasAO(c, 'tran', { mas: 'c', menos: 'out', salida: 'out' }, c.p('v0')),
    ];
  },
  tran: { bordes: () => 0.0015 },
  describir: (c) =>
    `Muestreo y retención: ${describirEntrada(c)}; interruptor de ${c.val('ron')} cerrado hasta ${c.val('tm')} hacia el condensador ${c.sim('ch')} de ${c.val('ch')}${c.tiene('carga') ? `; al abrir inyecta ${c.val('carga')}` : ''}${c.tiene('fuga') ? `; fuga de ${c.val('fuga')}` : ''}; ${describirAO(c)} como seguidor`,
};
export default d;
