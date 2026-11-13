// Schematic «motor-cc» (1.2, esquemas12d; sección 34.3 «La Máquina de Corriente Continua», figura 34.3a, bloques 39
// to 53): the DC motor as the book simulates it in ngspice (bloque 49, «la velocidad es la tensión de un nodo y la
// inercia, un condensador de J faradios»). Armature: the source V, R and L in series with the back-EMF E = k·ω, a
// voltage source controlled by the speed node: V = E + I·R + L·dI/dt (bloque 39). Mechanics: the torque k·I is a current
// source into the speed node ω, the inertia J a capacitor from it, the load torque a current source out of it and an
// optional viscous friction b a resistor of 1/b: J·dω/dt = k·I − T_carga − b·ω. In DC, I = T/k and ω = V/k − R/k²·T
// (bloque 41); the start from rest has the two time constants τ_e = L/R and τ_m = J·R/k² (bloque 47). Pieces for the
// book's cases: «rampa», the source rising linearly from 0 to V (bloque 47: 4,8 A); «carga» applied at «tcarga»
// (the load steps of bloque 49); «w0», the motor already turning (no load) at t = 0 — bajar a 12 V desde 480 rad/s,
// −24 A at once (bloque 53).
import { ng, num } from '../comun';
import type { DefinicionEsquema } from '../tipos';

const d: DefinicionEsquema = {
  nombre: 'motor-cc',
  titulo: 'Motor de corriente continua: inducido y mecánica',
  resumen: 'Inducido R + L con la fuerza electromotriz E = k·ω; la mecánica como un circuito: el par k·I una fuente de corriente, la inercia un condensador, el par de carga otra fuente.',
  piezas: {
    fuente: { obligatoria: true, descripcion: 'tensión del inducido, V (V; con «rampa», la final)' },
    r: { obligatoria: true, descripcion: 'resistencia del inducido, R (Ω)', color: 'azul' },
    l: { obligatoria: true, descripcion: 'inductancia del inducido, L (H)', color: 'azul' },
    k: { obligatoria: true, descripcion: 'constante del motor, k (V·s/rad = N·m/A): E = k·ω y T = k·I' },
    j: { obligatoria: true, descripcion: 'momento de inercia del rotor y la carga, J (kg·m²): el condensador de la mecánica', color: 'naranja' },
    carga: { descripcion: 'par de la carga (N·m; sin él, en vacío)', color: 'verde' },
    tcarga: { descripcion: 'en el transitorio, instante en que se aplica la carga (s; sin él, desde t = 0)' },
    b: { descripcion: 'rozamiento viscoso, b (N·m·s/rad; sin él, ninguno)', color: 'verde' },
    rampa: { descripcion: 'en el transitorio, la tensión sube en rampa de 0 a V en este tiempo (s; sin ella, un escalón en t = 0)' },
    w0: { descripcion: 'velocidad inicial (rad/s; sin ella, parado): el motor ya gira en vacío en t = 0' },
  },
  observables: {
    ia: { medida: 'i(vmi)', analisis: 'op', unidad: 'A', descripcion: 'corriente del inducido' },
    omega: { medida: 'v(w)', analisis: 'op', unidad: 'rad/s', descripcion: 'velocidad (la tensión del nodo ω)' },
    par: { medida: 'v(tq)', analisis: 'op', unidad: 'N·m', descripcion: 'par del motor, k·I' },
    fem: { medida: 'v(e)', analisis: 'op', unidad: 'V', descripcion: 'fuerza electromotriz E = k·ω' },
    corriente: { medida: 'i(vmi)', analisis: 'tran', unidad: 'A', descripcion: 'corriente del inducido frente al tiempo' },
    velocidad: { medida: 'v(w)', analisis: 'tran', unidad: 'rad/s', descripcion: 'velocidad frente al tiempo' },
    par_t: { medida: 'v(tq)', analisis: 'tran', unidad: 'N·m', descripcion: 'par del motor frente al tiempo' },
    fem_t: { medida: 'v(e)', analisis: 'tran', unidad: 'V', descripcion: 'fuerza electromotriz frente al tiempo' },
    inducido: { medida: 'v(in)', analisis: 'tran', unidad: 'V', descripcion: 'tensión aplicada al inducido frente al tiempo' },
  },
  validar: (tiene) => [...(tiene('tcarga') && !tiene('carga') ? ['«tcarga» es cuándo se aplica la carga: hace falta «carga»'] : [])],
  netlist(c) {
    const v = c.p('fuente');
    const k = c.p('k');
    const t = c.p('carga');
    const fuente = c.tiene('rampa') && c.p('rampa') > 0 ? `VA in 0 DC ${num(v)} PWL(0 0 ${num(c.p('rampa'))} ${num(v)})` : `VA in 0 DC ${num(v)}`;
    const tc = c.p('tcarga');
    const carga = c.tiene('carga') ? [`ICARGA w 0 DC ${num(t)}${c.tiene('tcarga') && tc > 0 ? ` PULSE(0 ${num(t)} ${num(tc)} ${num(tc * 1e-4)} ${num(tc * 1e-4)} 1e30 2e30)` : ''}`] : [];
    // (without friction, 10¹⁵ Ω keeps the speed node from floating in DC: 0,5 pN·m at 480 rad/s)
    return [
      fuente,
      'VMI in x 0',
      `RA x y ${ng(c.p('r'))}`,
      // (turning at w0 with no load: only the friction's current, b·ω₀/k)
      `LA y e ${ng(c.p('l'))} IC=${num(c.tiene('b') && k > 0 ? (c.p('b') * c.p('w0')) / k : 0)}`,
      `EFEM e 0 w 0 ${num(k)}`,
      `FPAR 0 w VMI ${num(k)}`,
      `CJ w 0 ${ng(c.p('j'))} IC=${num(c.p('w0'))}`,
      ...carga,
      `RB w 0 ${c.tiene('b') && c.p('b') > 0 ? ng(1 / c.p('b')) : '1e15'}`,
      // the torque k·I as a voltage, for the readings
      `FTQ 0 tq VMI ${num(k)}`,
      'RTQ tq 0 1',
    ];
  },
  describir: (c) =>
    `Motor de corriente continua: ${c.tiene('rampa') ? `una rampa de 0 a ${c.val('fuente')} en ${c.val('rampa')}` : `${c.val('fuente')}`} en el inducido, ${c.sim('r')} de ${c.val('r')} y ${c.sim('l')} de ${c.val('l')} en serie con la fuerza electromotriz E = k·ω, k ${c.val('k')}. La mecánica como un circuito: el par k·I es una fuente de corriente hacia el nodo de la velocidad ω, la inercia ${c.sim('j')} de ${c.val('j')} un condensador${c.tiene('carga') ? `, el par de carga de ${c.val('carga')} una fuente que saca corriente${c.tiene('tcarga') ? ` desde ${c.val('tcarga')}` : ''}` : ', en vacío'}${c.tiene('b') ? `, el rozamiento ${c.val('b')} una resistencia` : ''}${c.tiene('w0') ? `; en t = 0 ya gira a ${c.val('w0')}` : ''}`,
};
export default d;
