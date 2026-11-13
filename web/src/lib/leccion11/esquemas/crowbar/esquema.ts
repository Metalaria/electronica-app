// Schematic «crowbar» (1.2, esquemas12d; sección 10.9 «Crowbar y Fusibles Electrónicos», bloques 207 to 210): a supply
// rail protected by a crowbar — the source (V, and at «t0» the failure: the regulator's input reaching the rail, «falla»
// volts) with its resistance R_s, the fuse, the load R_L, and across the rail the classic three parts (bloque 210): a
// Zener that sets the threshold, a resistor R_G that takes the current to the gate, and the SCR. When the rail passes
// V_Z + V_GT the SCR fires and short-circuits it, and since it latches (sección 10.1) it holds the short «hasta que
// alguien intervenga» (bloque 209); the short current (V − V_T)/(R_s + R_f + R_on) blows the fuse once its I²t is
// spent. In ngspice: the Zener and R_G are drawn, and their effect is the ideal threshold V_Z + V_GT on the rail; the
// SCR a switch with memory (closed by the gate, held while it carries over 1 µA) with its on-state drop V_T («vt»,
// 1 V without it: «una caída de uno o dos voltios», bloque 5) and R_on; the fuse a switch of R_f that opens when
// ∫(i² − I_n²)·dt reaches its I²t («i2t»; I_n, «inom», the current it carries for ever). Transient from the normal
// state; DC, the normal state.
import { ng, num } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'crowbar',
  titulo: 'Crowbar con SCR y fusible',
  resumen: 'Raíl con fusible y carga; un Zener, R_G y un SCR que, ante una sobretensión, cortocircuitan el raíl hasta que funde el fusible.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión normal de la entrada (V)' },
    falla: { obligatoria: true, descripcion: 'tensión de la entrada tras la avería, desde «t0» (V)', color: 'naranja' },
    t0: { obligatoria: true, descripcion: 'instante de la avería (s)' },
    rs: { descripcion: 'resistencia de la fuente y los cables, R_s (Ω; sin ella, 1 mΩ)' },
    rf: { obligatoria: true, descripcion: 'resistencia del fusible, R_f (Ω)', color: 'azul' },
    i2t: { obligatoria: true, descripcion: 'integral de fusión del fusible, I²t (A²·s)', color: 'azul' },
    inom: { descripcion: 'corriente que el fusible aguanta sin fundir, I_n (A; sin ella, 0)' },
    carga: { obligatoria: true, descripcion: 'resistencia de la carga, R_L (Ω)', color: 'verde' },
    vz: { obligatoria: true, descripcion: 'tensión del Zener que fija el umbral, V_Z (V)', color: 'naranja' },
    vgt: { descripcion: 'tensión de disparo de la puerta, V_GT (V; sin ella, 0,7 V)' },
    rg: { descripcion: 'resistencia de puerta, R_G (Ω): se dibuja; el disparo se simula como el umbral ideal V_Z + V_GT', color: 'naranja' },
    vt: { descripcion: 'caída del SCR en conducción, V_T (V; sin ella, 1 V)' },
    ron: { descripcion: 'resistencia del SCR en conducción (Ω; sin ella, 1 mΩ)' },
  },
  observables: {
    vo: { medida: 'v(r)', analisis: 'op', unidad: 'V', descripcion: 'tensión del raíl en funcionamiento normal' },
    ifus: { medida: 'i(vmf)', analisis: 'op', unidad: 'A', descripcion: 'corriente del fusible en funcionamiento normal' },
    entrada: { medida: 'v(in)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la entrada frente al tiempo' },
    salida: { medida: 'v(r)', analisis: 'tran', unidad: 'V', descripcion: 'tensión del raíl (la de la carga) frente al tiempo' },
    fusible: { medida: 'i(vmf)', analisis: 'tran', unidad: 'A', descripcion: 'corriente del fusible frente al tiempo' },
    scr: { medida: 'i(vms)', analisis: 'tran', unidad: 'A', descripcion: 'corriente del SCR frente al tiempo' },
    energia: { medida: 'v(q)', analisis: 'tran', unidad: 'A²·s', descripcion: 'I²t acumulada en el fusible frente al tiempo' },
  },
  netlist(c) {
    const v = c.p('fuente');
    const t0 = c.p('t0');
    const tr = Math.max(1e-9, t0 * 1e-4);
    const umbral = c.p('vz') + (c.tiene('vgt') ? c.p('vgt') : 0.7);
    const inom = c.p('inom');
    return [
      `VIN in 0 DC ${num(v)} PULSE(${num(v)} ${num(c.p('falla'))} ${num(t0)} ${num(tr)} ${num(tr)} 1e30 2e30)`,
      `RS in f1 ${c.tiene('rs') ? ng(c.p('rs')) : '1e-3'}`,
      // the fuse: closed until ∫(i² − I_n²)·dt reaches I²t (only in the transient: u(time) is 0 in DC)
      'SF f1 f2 cf 0 swf ON',
      `.model swf SW(VT=0 VH=1e-3 RON=${ng(c.p('rf'))} ROFF=1e9)`,
      `BQ 0 q I = u(time)*max(i(vmf)*i(vmf) - ${num(inom * inom)}, 0)`,
      'CQ q 0 1 IC=0',
      'RQ q 0 1e15',
      `BF cf 0 V = 1 - v(q)/${num(c.p('i2t'))}`,
      'VMF f2 r 0',
      `RL r 0 ${ng(c.p('carga'))}`,
      // the SCR across the rail
      'SC r x cs 0 swt OFF',
      `.model swt SW(VT=1.25 VH=0.25 RON=${c.tiene('ron') ? ng(c.p('ron')) : '1e-3'} ROFF=1e9)`,
      'VMS x y 0',
      `VTS y 0 DC ${num(c.tiene('vt') ? c.p('vt') : 1)}`,
      `BCS cs 0 V = 2*u(v(r)-${num(umbral)}) + i(vms)/1e-6`,
    ];
  },
  tran: { bordes: () => 0.0015 },
  describir: (c) =>
    `Crowbar: la entrada de ${c.val('fuente')} pasa a ${c.val('falla')} en ${c.val('t0')}; fusible ${c.sim('rf')} de ${c.val('rf')} con una I²t de ${c.val('i2t')}; la carga ${c.sim('carga')} de ${c.val('carga')}; sobre el raíl, un Zener de ${c.val('vz')} con ${c.tiene('rg') ? `${c.sim('rg')} de ${c.val('rg')}` : 'su resistencia'} a la puerta de un SCR que cortocircuita el raíl cuando la tensión pasa del umbral, y se queda conduciendo hasta que funde el fusible`,
};
export default d;
