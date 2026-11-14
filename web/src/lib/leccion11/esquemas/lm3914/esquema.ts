// Schematic «lm3914» (1.2, esquemas12b): the LM3914 bar/dot display driver (sección 14.4) — a flash converter in
// miniature: a chain of ten equal resistors between V_LO and V_HI, ten comparators with their reference on the chain's
// taps (comparator k at V_LO + k·(V_HI − V_LO)/10) and the input buffered to all of them, and ten constant-current
// outputs into the LEDs, fed from their own supply V_LED. The resistor R_ref from the reference output to ground sets
// the LED current, about ten times its own: I_LED = factor·V_ref/R_ref (1 kΩ and 1,25 V give 12,5 mA, book 14.4). Bar mode
// lights every LED up to the level, dot mode only the top one (`barra`). Each output dissipates its current times
// V_LED − V_F inside the chip (10 LEDs at 10 mA with 4 V to spare: 400 mW).
//
// Simulated in DC: the comparators are steps u(v_in − V_k) (behavioural sources of the input, which an independent
// source fixes, so nothing feeds back), each output an ideal current sink of the LED's current, each LED a diode that
// drops `vf` exactly at that current (comun.ts). The chain is not loaded by anything (as the book's «factor ten»).
// Keep the input off a threshold: exactly at one the comparator counts as on, but a model's floor(10·v/V) may round
// either way there.
import { diodoCaida, ng, num, temperatura } from '../comun';
import type { ContextoNetlist, DefinicionEsquema } from '../tipos';

/** The thresholds V_LO + k·(V_HI − V_LO)/10, k = 1…10. */
export function umbrales(c: ContextoNetlist): number[] {
  const lo = c.tiene('vlo') ? c.p('vlo') : 0;
  const hi = c.tiene('vhi') ? c.p('vhi') : c.p('vref');
  return Array.from({ length: 10 }, (_, k) => lo + ((k + 1) * (hi - lo)) / 10);
}

/** Which LEDs are lit (index 0 the lowest), as the netlist decides it. */
export function encendidos(c: ContextoNetlist): boolean[] {
  const v = c.p('entrada');
  const u = umbrales(c);
  const sobre = u.map((x) => v >= x - 1e-9);
  if (c.cerrado('barra')) return sobre;
  return sobre.map((s, k) => s && !sobre[k + 1]);
}

/** The LED current, factor·V_ref/R_ref. */
export function corrienteLed(c: ContextoNetlist): number {
  return ((c.tiene('factor') ? c.p('factor') : 10) * c.p('vref')) / Math.max(c.p('rref'), 1e-9);
}

const d: DefinicionEsquema = {
  nombre: 'lm3914',
  titulo: 'Indicador de nivel LM3914: escalera, diez comparadores y diez LED',
  resumen: 'Entrada, escalera de diez resistencias entre V_LO y V_HI, diez comparadores y salidas de corriente constante (factor·V_ref/R_ref) a diez LED; modo barra o punto.',
  piezas: {
    entrada: { obligatoria: true, descripcion: 'tensión de entrada, v_in (V)' },
    vref: { obligatoria: true, descripcion: 'tensión de la referencia interna entre su salida y masa, V_ref (V; la del LM3914, unos 1,25 V)' },
    rref: { obligatoria: true, descripcion: 'resistencia de la salida de referencia a masa, R_ref (Ω): fija la corriente de los LED', color: 'azul' },
    vhi: { descripcion: 'tensión del extremo alto de la escalera, V_HI (V; sin ella, unida a la referencia: V_ref)' },
    vlo: { descripcion: 'tensión del extremo bajo de la escalera, V_LO (V; sin ella, 0)' },
    vled: { obligatoria: true, descripcion: 'alimentación de los LED, V_LED (V)' },
    vf: { obligatoria: true, descripcion: 'caída de cada LED encendido, V_F (V)', color: 'verde' },
    factor: { descripcion: 'factor entre la corriente de un LED y la de R_ref (sin él, 10: «unas diez veces»)' },
    barra: { interruptor: true, descripcion: 'modo: 1 barra (todos hasta el nivel), 0 punto (solo el último; sin él, barra)' },
  },
  observables: {
    encendidos: { medida: 'v(nled)', analisis: 'op', unidad: '', descripcion: 'número de LED encendidos' },
    iled: { medida: 'i(vml)', analisis: 'op', unidad: 'A', descripcion: 'corriente total de los LED (la que da V_LED)' },
    iref: { medida: 'i(vmr)', analisis: 'op', unidad: 'A', descripcion: 'corriente de R_ref' },
    p_chip: { medida: 'v(pch)', analisis: 'op', unidad: 'W', descripcion: 'potencia que disipan dentro del integrado sus salidas, Σ I_LED·(V_LED − V_F)' },
    vsalida: { medida: 'v(o1)', analisis: 'op', unidad: 'V', descripcion: 'tensión de la salida del primer LED (V_LED − V_F encendido)' },
  },
  netlist(c) {
    const u = umbrales(c);
    const iled = corrienteLed(c);
    // (exactly at a threshold the comparator counts as on, as in the drawing: u(0) would be ½)
    const vin = 'v(in) + 1e-9';
    const on = (k: number) => (c.cerrado('barra') || k === 9 ? `u(${vin} - ${num(u[k]!)})` : `(u(${vin} - ${num(u[k]!)}) - u(${vin} - ${num(u[k + 1]!)}))`);
    const lineas: string[] = [
      temperatura(),
      `VIN in 0 DC ${num(c.p('entrada'))}`,
      'RIN in 0 1e9',
      `VREF ref 0 DC ${num(c.p('vref'))}`,
      'VMR ref r 0',
      `RREF r 0 ${ng(c.p('rref'))}`,
      `VLED vl 0 DC ${num(c.p('vled'))}`,
      'VML vl a 0',
      // each LED drops vf exactly at the output's current
      diodoCaida('DLED', c.p('vf'), iled > 0 ? iled : 1e-3, 2),
    ];
    // (each output's node leaks 10⁻¹³ S to ground, so a dark LED's nanoamperes stay under the readings' floor)
    for (let k = 0; k < 10; k++) lineas.push(`DL${k + 1} a o${k + 1} DLED`, `BL${k + 1} o${k + 1} 0 I = ${num(iled)}*${on(k)}`, `RZ${k + 1} o${k + 1} 0 1e13`);
    lineas.push(
      `BMEDN nled 0 V = ${Array.from({ length: 10 }, (_, k) => on(k)).join(' + ')}`,
      `BMEDP pch 0 V = ${Array.from({ length: 10 }, (_, k) => `${num(iled)}*${on(k)}*v(o${k + 1})`).join(' + ')}`,
    );
    return lineas;
  },
  describir: (c) => {
    const n = encendidos(c).filter(Boolean).length;
    return `LM3914 en modo ${c.cerrado('barra') ? 'barra' : 'punto'}: entrada de ${c.val('entrada')}; escalera de diez resistencias de ${c.tiene('vlo') ? c.val('vlo') : '0 V'} a ${c.tiene('vhi') ? c.val('vhi') : `la referencia de ${c.val('vref')}`}; ${c.sim('rref')} de ${c.val('rref')} a masa; LED desde ${c.val('vled')}, ${n === 0 ? 'ninguno encendido' : n === 1 ? 'uno encendido' : `${n} encendidos`}`;
  },
};
export default d;
