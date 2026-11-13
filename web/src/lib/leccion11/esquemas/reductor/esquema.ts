// Schematic «reductor» (1.2, esquemas12d; sección 33.2 «El Reductor (Buck) en Detalle», bloques 38 to 66): the buck
// converter with ideal switches — V_in, the high-side switch S driven by a PWM of frequency f and duty cycle D (closed
// first in each period), the low side a freewheel diode (`vf`, its drop at the load current) or a synchronous switch
// (without `vf`, or with `sincrono` closed: closed while S is open, no dead time), the coil L with its DCR?, the output
// capacitor C with its ESR? and the load R. Switches of 1 µΩ (the book's are ideal).
//
// The transient starts in the periodic steady state of continuous conduction, as the book draws it: the coil at its
// valley I − ΔI/2 and the capacitor at V_out − ΔI·(1 − 2D)/(12·f·C) (the mean of the ripple's parabolas is V_out),
// with V_out = (D·V_in − (1 − D)·V_F)/(1 + DCR/R), I = V_out/R, ΔI = (V_in − V_out − I·DCR)·D/(L·f) (bloque 53 with
// the diode's drop and the DCR). In discontinuous conduction (a diode and a light load, bloque 60) that start is not
// periodic: «asentar» periods are simulated before the axis (tran.periodos), at most 2 000.
import { diodoCaida, ng, num, temperatura } from '../comun';
import type { ContextoNetlist, DefinicionEsquema } from '../tipos';

/** A diode on the low side (`vf`), unless `sincrono` is closed. */
export const conDiodo = (c: ContextoNetlist): boolean => c.tiene('vf') && !(c.tiene('sincrono') && c.cerrado('sincrono'));

/** The steady state of continuous conduction the transient starts from. */
export function regimen(c: ContextoNetlist): { vo: number; i: number; di: number; i0: number; vc0: number } {
  const d = Math.min(0.999, Math.max(0.001, c.p('ciclo')));
  const f = c.p('f');
  const r = Math.max(1e-9, c.p('carga'));
  const dcr = c.p('dcr');
  const vd = conDiodo(c) ? c.p('vf') : 0;
  const vo = (d * c.p('vin') - (1 - d) * vd) / (1 + dcr / r);
  const i = vo / r;
  const di = ((c.p('vin') - vo - i * dcr) * d) / (c.p('l') * f);
  const i0 = conDiodo(c) ? Math.max(0, i - di / 2) : i - di / 2;
  return { vo, i, di, i0, vc0: vo - (di * (1 - 2 * d)) / (12 * f * c.p('c')) };
}

const d: DefinicionEsquema = {
  nombre: 'reductor',
  titulo: 'Convertidor reductor (buck)',
  resumen: 'V_in, el interruptor con PWM de frecuencia f y ciclo D, diodo de libre circulación o rectificador síncrono, L con su DCR, C con su ESR y la carga; en régimen permanente.',
  piezas: {
    vin: { obligatoria: true, descripcion: 'tensión de entrada, V_in (V)' },
    f: { obligatoria: true, descripcion: 'frecuencia de conmutación, f (Hz)' },
    ciclo: { obligatoria: true, descripcion: 'ciclo de trabajo D, de 0 a 1 (el interruptor cerrado al principio de cada periodo)', color: 'azul' },
    l: { obligatoria: true, descripcion: 'inductancia, L (H)', color: 'naranja' },
    dcr: { descripcion: 'resistencia del devanado de la bobina, DCR (Ω; sin ella, 0)', color: 'naranja' },
    c: { obligatoria: true, descripcion: 'condensador de salida, C (F)', color: 'verde' },
    esr: { descripcion: 'resistencia serie del condensador, ESR (Ω; sin ella, 0)', color: 'verde' },
    carga: { obligatoria: true, descripcion: 'resistencia de la carga, R (Ω)', color: 'verde' },
    vf: { descripcion: 'caída del diodo de libre circulación a la corriente de salida (V; sin ella, rectificador síncrono)' },
    sincrono: { interruptor: true, descripcion: 'con «vf»: cerrado, el rectificador síncrono en lugar del diodo' },
    asentar: { descripcion: 'periodos que se simulan antes del eje (sin ella, 0: se parte del régimen permanente continuo)' },
  },
  observables: {
    nodo: { medida: 'v(sw)', analisis: 'tran', unidad: 'V', descripcion: 'tensión del nodo de conmutación frente al tiempo' },
    il: { medida: 'i(vml)', analisis: 'tran', unidad: 'A', descripcion: 'corriente de la bobina frente al tiempo' },
    salida: { medida: 'v(o)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de salida frente al tiempo' },
    entrada: { medida: 'i(vmin)', analisis: 'tran', unidad: 'A', descripcion: 'corriente de la entrada frente al tiempo' },
    bajo: { medida: 'i(vmd)', analisis: 'tran', unidad: 'A', descripcion: 'corriente del diodo o del interruptor síncrono frente al tiempo' },
  },
  validar: (tiene) => [...(tiene('sincrono') && !tiene('vf') ? ['«sincrono» elige entre el diodo y el síncrono: hace falta «vf», la caída del diodo'] : [])],
  netlist(c) {
    const D = Math.min(0.999, Math.max(0.001, c.p('ciclo')));
    const T = 1 / c.p('f');
    const tr = T * 1e-4;
    const e = regimen(c);
    const diodo = conDiodo(c);
    return [
      `VIN vin 0 DC ${num(c.p('vin'))}`,
      'VMIN vin a 0',
      'S1 a sw g 0 swb',
      `VG g 0 DC 0 PULSE(1 0 ${num(D * T - tr / 2)} ${num(tr)} ${num(tr)} ${num((1 - D) * T - tr)} ${num(T)})`,
      '.model swb SW(VT=0.5 VH=0 RON=1e-6 ROFF=1e9)',
      'VMD 0 lo 0',
      ...(diodo
        ? ['DF lo sw DFW', temperatura(), diodoCaida('DFW', c.p('vf'), Math.max(1e-3, e.i))]
        : ['S2 lo sw gn 0 swb', `VGN gn 0 DC 0 PULSE(0 1 ${num(D * T - tr / 2)} ${num(tr)} ${num(tr)} ${num((1 - D) * T - tr)} ${num(T)})`]),
      'VML sw x 0',
      ...(c.p('dcr') > 0 ? [`RDCR x y ${ng(c.p('dcr'))}`, `LB y o ${ng(c.p('l'))} IC=${num(e.i0)}`] : [`LB x o ${ng(c.p('l'))} IC=${num(e.i0)}`]),
      ...(c.p('esr') > 0 ? [`RESR o z ${ng(c.p('esr'))}`, `CB z 0 ${ng(c.p('c'))} IC=${num(e.vc0)}`] : [`CB o 0 ${ng(c.p('c'))} IC=${num(e.vc0)}`]),
      `RCARGA o 0 ${ng(c.p('carga'))}`,
    ];
  },
  tran: {
    periodos: (c) => Math.min(2000, Math.max(0, Math.round(c.p('asentar')))),
    bordes: () => 0.0015,
  },
  describir: (c) =>
    `Convertidor reductor: entrada de ${c.val('vin')}, interruptor con PWM de ${c.val('f')} y ciclo de trabajo ${(c.p('ciclo') * 100).toLocaleString('es-ES', { maximumSignificantDigits: 3 })} %, ${conDiodo(c) ? `diodo de libre circulación de ${c.val('vf')}` : 'rectificador síncrono'}, ${c.sim('l')} de ${c.val('l')}${c.tiene('dcr') ? ` con ${c.val('dcr')} de devanado` : ''}, ${c.sim('c')} de ${c.val('c')}${c.tiene('esr') ? ` con ${c.val('esr')} de ESR` : ''} y la carga ${c.sim('carga')} de ${c.val('carga')}`,
};
export default d;
