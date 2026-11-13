// Schematic «mosfet» (1.2, esquemas12): an N-channel enhancement MOSFET on the low side — V_DD, the load R_D to the
// drain, the gate driven from a source through R_G, an optional pull-down R_GS from the gate to ground and an optional
// source resistor R_S (degeneration: sección 7.11, problema 7.C). The book's square law (sección 7.2): in saturation
// I_D = ½·k·(V_GS − V_th)², in the triode region I_D = k·((V_GS − V_th)·V_DS − V_DS²/2), nothing below V_th — exactly
// ngspice's LEVEL=1 with KP = k, VTO = V_th and W = L (the body tied to the source, so no body effect); `lambda` adds
// the channel-length modulation (1 + λ·V_DS). The gate source is DC, or with `f` a PWM signal between `entrada` and
// 0 V (the duty cycle `ciclo`: sección 7.5, the load sees pulses). The body diode is drawn, and simulated only with
// `bv` (it only conducts with the drain below the source, which this circuit never does).
//
// esquemas12b: an inductive load (sección 4.5; sección 14.5, a motor switched by PWM). With `l` the load is R_D in
// series with a coil L; at switch-off the coil keeps its current, and it has to go somewhere:
//   - without a freewheel diode, through the MOSFET in avalanche: the drain clamps at `bv` (the body diode with its
//     breakdown, simulated then: a Zener at BV, comun.ts) and the current falls as L·di/dt = −(BV − V_DD + R·i);
//   - with the freewheel diode (`vf`, its constant drop; the switch `rueda` connects it), across the load: the drain
//     sits at V_DD + V_F and L·di/dt = −(V_F + R·i), the book's t = (L/R)·ln(1 + I·R/V_F) to reach zero.
// The coil starts (t = 0, the gate high) with the steady on-state current (solved here, the square law with R_D and
// R_S), so a transient shows the switch-off from rest. The freewheel diode returns to the supply side of the drain
// current's 0 V meter: `corriente` stays the MOSFET's drain current (avalanche included) and `icarga` is the coil's.
import { diodoCaida, ng, num, temperatura, zener } from '../comun';
import type { ContextoNetlist, DefinicionEsquema } from '../tipos';

/** I_D of ngspice's LEVEL=1 (KP = k, W = L) at (V_GS, V_DS ≥ 0). */
function idNivel1(k: number, vth: number, lambda: number, vgs: number, vds: number): number {
  const vov = vgs - vth;
  if (vov <= 0) return 0;
  const m = 1 + lambda * vds;
  return vds < vov ? k * (vov * vds - (vds * vds) / 2) * m : (k / 2) * vov * vov * m;
}

/** The load current with the gate source at `entrada` (the coil's initial current): bisection on I. */
export function corrienteConduccion(c: ContextoNetlist): number {
  const vdd = c.p('vdd');
  const rd = Math.max(c.p('rd'), 1e-9);
  const rs = c.p('rs');
  const vg = c.tiene('rgs') ? (c.p('entrada') * c.p('rgs')) / (c.p('rg') + c.p('rgs')) : c.p('entrada');
  let a = 0;
  let b = Math.max(0, vdd) / (rd + rs);
  for (let i = 0; i < 200; i++) {
    const m = (a + b) / 2;
    if (idNivel1(c.p('k'), c.p('vth'), c.p('lambda'), vg - m * rs, vdd - m * (rd + rs)) > m) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

/**
 * 1.2 (esquemas12c; secciones 12.3, 12.10, tabla 12.A: 20 / 36 / 70 mΩ at 10 / 4,5 / 3,3 V): with «rdson», the channel
 * is that resistance while V_GS ≥ V_th (and off below), not the square law — a datasheet's R_DS(on)(V_GS) fits no single
 * k and V_th, so the model looks it up (a list control with the table's gate voltages) or scales it with temperature
 * and gives the piece the value. DC: a resistor or nothing, from the gate's voltage (the divider R_G–R_GS, minus R_S's
 * drop at the on-state current), so the living circuit solves it; transient (a PWM): a voltage-controlled switch.
 */
function canal(c: ContextoNetlist): string[] {
  if (!c.tiene('rdson')) return ['M1 d g s s NM W=1 L=1'];
  if (c.tiene('f') && c.p('f') > 0) return ['S1 d s g s SWDS', `.model SWDS SW(VT=${num(c.p('vth'))} VH=0 RON=${ng(c.p('rdson'))} ROFF=1e12)`];
  const vg = c.tiene('rgs') ? (c.p('entrada') * c.p('rgs')) / (c.p('rgs') + c.p('rg')) : c.p('entrada');
  const ion = c.p('vdd') / (c.p('rd') + c.p('rdson') + c.p('rs'));
  return vg - ion * c.p('rs') >= c.p('vth') ? [`RDS d s ${ng(c.p('rdson'))}`] : [];
}

const d: DefinicionEsquema = {
  nombre: 'mosfet',
  titulo: 'MOSFET de canal N con carga en el drenador',
  resumen: 'V_DD, R_D al drenador, la puerta desde una fuente por R_G (con R_GS a masa y R_S en la fuente opcionales); corte, saturación o zona óhmica.',
  piezas: {
    vdd: { obligatoria: true, descripcion: 'alimentación del drenador, V_DD (V)' },
    rd: { obligatoria: true, descripcion: 'resistencia de drenador o carga, R_D (Ω)', color: 'naranja' },
    entrada: { obligatoria: true, descripcion: 'tensión de la fuente de puerta (V; con «f», el nivel alto del PWM)' },
    rg: { descripcion: 'resistencia de puerta, R_G (Ω; sin ella, la fuente va directa a la puerta)', color: 'azul' },
    rgs: { descripcion: 'resistencia de la puerta a masa, R_GS (Ω; sin ella, ninguna)', color: 'azul' },
    rs: { descripcion: 'resistencia de fuente, R_S (Ω; sin ella, la fuente a masa)', color: 'verde' },
    k: { obligatoria: true, descripcion: 'parámetro de transconductancia k (A/V²): I_D = ½·k·(V_GS − V_th)²' },
    vth: { obligatoria: true, descripcion: 'tensión umbral V_th (V)' },
    lambda: { descripcion: 'modulación de la longitud del canal λ (1/V; sin ella, 0)' },
    f: { descripcion: 'frecuencia del PWM de la puerta (Hz; sin ella, continua)' },
    ciclo: { descripcion: 'ciclo de trabajo del PWM, de 0 a 1 (sin él, 0,5): en alto al principio de cada periodo' },
    l: { descripcion: 'carga inductiva: bobina L en serie con R_D (H; R_D es entonces la resistencia del devanado)', color: 'naranja' },
    bv: { descripcion: 'tensión de avalancha del MOSFET, BV_DSS (V): adonde sube el drenador al apagar sin diodo (obligatoria con «l»)' },
    vf: { descripcion: 'caída del diodo de rueda libre en paralelo con la carga (V; sin ella, no hay diodo)', color: 'verde' },
    rueda: { interruptor: true, descripcion: 'conecta el diodo de rueda libre (sin él, conectado si hay «vf»)', color: 'verde' },
    rdson: { descripcion: 'canal como una resistencia R_DS(on) cuando V_GS ≥ V_th (Ω; la tabla de la hoja de datos o su valor a una temperatura: el modelo la calcula), en lugar de la ley cuadrática' },
  },
  observables: {
    id: { medida: 'i(vmd)', analisis: 'op', unidad: 'A', descripcion: 'corriente de drenador' },
    vds: { medida: 'v(d)-v(s)', analisis: 'op', unidad: 'V', descripcion: 'tensión drenador-fuente' },
    vgs: { medida: 'v(g)-v(s)', analisis: 'op', unidad: 'V', descripcion: 'tensión puerta-fuente' },
    vs: { medida: 'v(s)', analisis: 'op', unidad: 'V', descripcion: 'tensión de la fuente (la de R_S)' },
    vd: { medida: 'v(d)', analisis: 'op', unidad: 'V', descripcion: 'tensión del drenador' },
    corriente: { medida: 'i(vmd)', analisis: 'tran', unidad: 'A', descripcion: 'corriente de drenador frente al tiempo' },
    drenador: { medida: 'v(d)', analisis: 'tran', unidad: 'V', descripcion: 'tensión del drenador frente al tiempo' },
    puerta: { medida: 'v(g)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de la puerta frente al tiempo' },
    icarga: { medida: 'i(ld)', analisis: 'tran', unidad: 'A', descripcion: 'corriente de la bobina (de la carga) frente al tiempo', requiere: ['l'] },
  },
  validar: (tiene) => [
    ...(tiene('ciclo') && !tiene('f') ? ['«ciclo» solo con «f» (el PWM)'] : []),
    ...(tiene('l') && !tiene('bv') ? ['con «l» hace falta «bv»: sin diodo, al apagar la corriente de la bobina sigue por la avalancha del MOSFET'] : []),
    ...(tiene('vf') && !tiene('l') ? ['«vf» (el diodo de rueda libre) solo con la carga inductiva «l»'] : []),
    ...(tiene('rueda') && !tiene('vf') ? ['«rueda» conecta el diodo de rueda libre: hace falta su caída «vf»'] : []),
  ],
  // the freewheel diode drops vf at 0,1 A (n = 1), and its current runs from the on-state current (an ampere or so)
  // down to zero: ± 0,12 V between 10 mA and 1 A; the avalanche is a Zener at BV at 5 mA: + 0,2 V at 10 A
  noLineal: (tiene) => [
    ...(tiene('vf') ? [{ pieza: 'vf', desviacion: 0.15, porque: 'diodo de caída vf a 0,1 A, n = 1: ± 0,12 V entre 10 mA y 1 A' }] : []),
    ...(tiene('bv') ? [{ pieza: 'bv', desviacion: 0.25, porque: 'avalancha como un Zener a BV con 5 mA, n = 1: + 0,2 V a 10 A' }] : []),
  ],
  netlist(c) {
    const e = c.p('entrada');
    let vg = `VG in 0 DC ${num(e)}`;
    if (c.tiene('f') && c.p('f') > 0) {
      const T = 1 / c.p('f');
      const k = c.tiene('ciclo') ? Math.min(0.999, Math.max(0.001, c.p('ciclo'))) : 0.5;
      const tr = T * 1e-4;
      vg += ` PULSE(${num(e)} 0 ${num(k * T - tr / 2)} ${num(tr)} ${num(tr)} ${num((1 - k) * T - tr)} ${num(T)})`;
    }
    const bobina = c.tiene('l');
    return [
      `VDD vdd 0 DC ${num(c.p('vdd'))}`,
      'VMD vdd x 0',
      ...(bobina
        ? [
            `RD x y ${ng(c.p('rd'))}`,
            `LD y d ${ng(c.p('l'))} IC=${num(corrienteConduccion(c))}`,
            // (the drain node floats once the coil's current is gone: this leak settles it at V_DD. The trapezoidal
            // rule rings on it, 7 and 17 V every other step; second-order Gear undershoots to 4 V once as the
            // avalanche lets go; backward Euler, Gear of order 1, falls to V_DD smoothly)
            'RDX d x 1e6',
            '.options method=gear maxord=1',
            ...(c.tiene('vf') && c.cerrado('rueda') ? ['DRL d x DRL', temperatura(), diodoCaida('DRL', c.p('vf'), 0.1)] : []),
          ]
        : [`RD x d ${ng(c.p('rd'))}`]),
      ...(c.tiene('bv') ? ['DAV s d DAV', zener('DAV', c.p('bv'), 0)] : []),
      vg,
      `RG in g ${ng(c.p('rg'))}`,
      ...(c.tiene('rgs') ? [`RGS g 0 ${ng(c.p('rgs'))}`] : []),
      ...canal(c),
      `RS s 0 ${ng(c.p('rs'))}`,
      `.model NM NMOS(LEVEL=1 KP=${ng(c.p('k'))} VTO=${num(c.p('vth'))} LAMBDA=${num(c.p('lambda'))})`,
    ];
  },
  tran: { bordes: () => 0.0015 },
  describir: (c) =>
    `MOSFET de canal N: drenador con ${c.sim('rd')} de ${c.val('rd')} desde ${c.val('vdd')}; puerta ${c.tiene('f') ? `con un PWM de ${c.val('entrada')} y ${c.val('f')}${c.tiene('ciclo') ? `, en alto ${Math.round(c.p('ciclo') * 100)} % del periodo` : ''}` : `desde ${c.val('entrada')}`}${c.tiene('rg') ? ` por ${c.sim('rg')} de ${c.val('rg')}` : ''}${c.tiene('rgs') ? `, con ${c.sim('rgs')} de ${c.val('rgs')} a masa` : ''}; fuente ${c.tiene('rs') ? `con ${c.sim('rs')} de ${c.val('rs')} a masa` : 'a masa'}; k ${c.val('k')}, umbral ${c.val('vth')}; con su diodo interno${c.tiene('bv') ? ` (avalancha a ${c.val('bv')})` : ''}${c.tiene('l') ? `; la carga es una bobina de ${c.val('l')} en serie con ${c.sim('rd')}${c.tiene('vf') ? (c.cerrado('rueda') ? ', con diodo de rueda libre en paralelo' : ', con el diodo de rueda libre desconectado') : ', sin diodo de rueda libre'}` : ''}`,
};
export default d;
