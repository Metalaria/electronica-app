// 1.4: the real FNIRSI 2C53T as a meter and as an oscilloscope next to the simulated instruments. Its multimeter's
// reading can stand in for the real Brymen's (same PantallaReal) wherever a step or a check measures with a
// multimeter, but only a «fiable» one (multimetro.ts: the frame and the firmware agree, and the function is one that
// has been checked against the instrument's screen; since 1.4.2 that is every function the multimeter has, but °F
// and the capacitance ranges above µF). Only what the decoder establishes is said about a difference: what its
// display resolves (one unit of the last digit, or one sample of the oscilloscope, 1/25 of a division), which
// settings are not checked yet and, for the multimeter, how much of a difference the instrument itself may be off by.
// 1.4.2: that last figure comes from the same table as the recorder's FNIRSI–Brymen comparison and the simulated
// FNIRSI (registro-real/comparar.ts, exactitudFnirsi), so the panel no longer says the app does not have it.

import { formatoSI } from '../../componentes/grafica/formato.ts';
import type { PantallaReal } from '../brymen-real/protocolo.ts';
import { base } from '../brymen-real/lectura.ts';
import type { LecturaFnirsi } from './multimetro.ts';
import { exactitudFnirsi } from '../registro-real/comparar.ts';
import { CUENTAS_POR_DIVISION, medirTraza, type Traza } from './osciloscopio.ts';
import type { ModoFnirsi } from './protocolo.ts';

const ESCALA: Record<PantallaReal['prefijo'], number> = { '': 1, n: 1e-9, µ: 1e-6, m: 1e-3, k: 1e3, M: 1e6 };

/** What a check needs from the connection (fnirsiReal, or a test's stand-in). */
export interface EstadoFnirsiReal {
  estado: string;
  modo: ModoFnirsi;
  /** The multimeter's reading if it is fresh. */
  multimetroVigente(): LecturaFnirsi | null;
}

/** The simulated FNIRSI's values at the same point, for the panel (null: nothing to compare with). */
export interface SimuladoFnirsi {
  /** Its multimeter's display (only in multimeter mode). */
  multimetro: { texto: string; valor: number | null; unidad: string } | null;
  /** Its oscilloscope's measurements of each channel (only in oscilloscope mode, channel on). */
  canales: [{ vpp: number; f: number | null } | null, { vpp: number; f: number | null } | null];
}

/** The weight of the display's last digit (SI). */
export function resolucion(p: PantallaReal): number {
  return 10 ** -p.decimales * ESCALA[p.prefijo];
}

/** The display of a reading that may be used for a measurement in `unidad`, or null. */
export function pantallaFnirsiPara(l: LecturaFnirsi | null, unidad: string): PantallaReal | null {
  if (!l || !l.fiable || l.esperando) return null;
  const p = l.pantalla;
  return p.unidad === base(unidad) && p.valor !== null && !p.ol ? p : null;
}

/** Why the FNIRSI's reading cannot be used for a measurement in `unidad` (a sentence, «usted»). */
export function porQueNoFnirsi(c: EstadoFnirsiReal, unidad: string): string {
  if (c.estado !== 'conectado') return 'Su FNIRSI no está conectado.';
  if (c.modo !== 'multimetro') return 'Su FNIRSI no está en el multímetro: póngalo en multímetro (la aplicación vuelve a conectarse sola tras el cambio de modo).';
  const l = c.multimetroVigente();
  if (!l) return 'Su FNIRSI todavía no ha enviado ninguna lectura del multímetro.';
  if (l.esperando) return 'Su FNIRSI está en Auto y no detecta nada en las puntas: elija la función que pide la medida.';
  const p = l.pantalla;
  if (p.ol) return 'Su FNIRSI marca OL (fuera de escala): revise las puntas o la función.';
  if (p.unidad && p.unidad !== base(unidad))
    return `Su FNIRSI está midiendo en ${p.prefijo}${p.unidad} y esta medida va en ${unidad || 'un número sin unidad'}: elija la función que pide.`;
  if (!l.fiable) return `${l.motivo} Esta lectura no se usa para comprobar.`;
  return 'Su FNIRSI no muestra un número que se pueda usar.';
}

/** The FNIRSI's display for a measurement in `unidad`, or the reason it cannot be used. */
export function tomarFnirsi(c: EstadoFnirsiReal, unidad: string): { pantalla: PantallaReal; lectura: LecturaFnirsi } | { aviso: string } {
  const l = c.estado === 'conectado' && c.modo === 'multimetro' ? c.multimetroVigente() : null;
  const p = pantallaFnirsiPara(l, unidad);
  return l && p ? { pantalla: p, lectura: l } : { aviso: porQueNoFnirsi(c, unidad) };
}

const pc = (x: number) => (x > 0 && x < 0.0005 ? 'menos del 0,1 %' : `${(Math.round(x * 1000) / 10).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`);

/** «una diferencia de 12,00 mV (0,3 %)» or «coinciden». */
function diferencia(real: number, ref: number, unidad: string): { d: number; texto: string } {
  const d = real - ref;
  const rel = ref !== 0 ? Math.abs(d / ref) : null;
  return { d, texto: d === 0 ? 'coinciden' : `una diferencia de ${formatoSI(Math.abs(d), unidad, 4)}${rel !== null ? ` (${pc(rel)})` : ''}` };
}

/**
 * The FNIRSI multimeter's reading against `ref` (the simulated one, or the expected one), in words. `referencia` names
 * it («el simulado», «lo esperado (libro)»). With the reading (`l`), a difference larger than the last digit is set
 * against what the instrument may be off on that range, when the table has it.
 */
export function explicarDiferenciaFnirsi(p: PantallaReal, ref: number, referencia: string, unidad: string, l?: LecturaFnirsi): string {
  const real = p.valor!;
  const f = (v: number) => formatoSI(v, unidad, 4);
  const { d, texto } = diferencia(real, ref, unidad);
  const t = `Su circuito da ${f(real)} en el FNIRSI; ${referencia}, ${f(ref)}: ${texto}.`;
  if (d === 0) return t;
  const r = resolucion(p);
  if (Math.abs(d) <= r * 1.0001) return `${t} Es una unidad de la última cifra de su pantalla (${f(r)}) o menos: el FNIRSI no distingue más.`;
  const ex = l ? exactitudFnirsi({ ...l, pantalla: p }) : null;
  if (ex && ex.incertidumbre !== null) {
    const u = ex.incertidumbre;
    if (Math.abs(d) <= u) return `${t} Cabe en lo que el propio FNIRSI puede equivocarse en la escala de ${ex.escala} (± ${f(u)}, según su fabricante): las dos medidas son la misma.`;
    return `${t} Es mayor que lo que el FNIRSI puede equivocarse en la escala de ${ex.escala} (± ${f(u)}, según su fabricante): la diferencia es del circuito real —los valores de sus piezas dentro de su tolerancia, la fuente—, no del instrumento.`;
  }
  const cual = l ? 'de esta escala del FNIRSI' : 'del multímetro del FNIRSI';
  return `${t} La aplicación no tiene la exactitud ${cual}, así que no puede decir cuánto de la diferencia es del instrumento y cuánto del circuito real; su pantalla resuelve ${f(r)}.`;
}

/** One channel of the real FNIRSI's oscilloscope against the simulated one's measurements, in words. */
export function compararTraza(t: Traza, sim: { vpp: number; f: number | null }): string {
  const m = medirTraza(t);
  const c = t.ajustes.canales[t.canal];
  const ch = `CH${t.canal + 1}`;
  const partes: string[] = [];
  if (t.saturada) partes.push(`${ch}: la señal se sale de la escala del FNIRSI, así que su Vpp real es mayor que el que se ve: suba los V/div antes de comparar.`);
  else {
    const { d, texto } = diferencia(m.picoPico, sim.vpp, 'V');
    let s = `${ch}: Vpp de ${formatoSI(m.picoPico, 'V', 3)} en el FNIRSI; el simulado, ${formatoSI(sim.vpp, 'V', 3)}: ${texto}.`;
    const muestra = c.voltiosDiv / CUENTAS_POR_DIVISION;
    // (the peak to peak is a maximum minus a minimum: one sample of error at each end)
    if (d !== 0 && Math.abs(d) <= 2 * muestra * 1.0001)
      s += ` Cada muestra del FNIRSI vale 1/${CUENTAS_POR_DIVISION} de división (${formatoSI(muestra, 'V', 3)} en esta escala): una diferencia de hasta dos muestras es de la resolución de su pantalla.`;
    else if (d !== 0) s += ` Cada muestra del FNIRSI vale ${formatoSI(muestra, 'V', 3)} en esta escala.`;
    if (!c.comprobado) s += ` La escala de ${ch} todavía no está comprobada en la aplicación: tome su Vpp con reserva.`;
    partes.push(s);
  }
  if (m.frecuencia !== null && sim.f !== null) {
    // (the two agree to the four figures shown: a smaller difference is below what the record resolves)
    const texto = formatoSI(m.frecuencia, 'Hz', 4) === formatoSI(sim.f, 'Hz', 4) ? 'coinciden' : diferencia(m.frecuencia, sim.f, 'Hz').texto;
    let s = `Frecuencia de ${formatoSI(m.frecuencia, 'Hz', 4)} en el FNIRSI; el simulado, ${formatoSI(sim.f, 'Hz', 4)}: ${texto}.`;
    if (!t.ajustes.tiempoComprobado) s += ' Esta base de tiempos todavía no está comprobada en la aplicación: tome la frecuencia con reserva.';
    partes.push(s);
  }
  return partes.join(' ');
}
