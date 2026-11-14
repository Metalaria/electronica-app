// 1.2 lessons: what the operational-amplifier schematics share (sallen-key, sallen-key-alto) — complex arithmetic for
// their steady state at t = 0, and the amplifier itself for the app's ngspice. Pure.
import { ng, num } from './comun';
import { observablesCA } from './comun-ca';
import { resolverCC } from '../../leccion12/cc';
import type { Analisis, ContextoDibujo, ContextoNetlist, Observable, Pieza } from './tipos';

export interface Complejo {
  re: number;
  im: number;
}
export const mas = (a: Complejo, b: Complejo): Complejo => ({ re: a.re + b.re, im: a.im + b.im });
export const menos = (a: Complejo, b: Complejo): Complejo => ({ re: a.re - b.re, im: a.im - b.im });
export const por = (a: Complejo, b: Complejo): Complejo => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export function entre(a: Complejo, b: Complejo): Complejo {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}

/** Open-loop DC gain of the amplifier with a finite gain-bandwidth product (10⁵, 100 dB, a general-purpose op-amp's). */
export const A0 = 1e5;

/**
 * A voltage follower from the + input `entrada` to `salida` (its − input is the output itself). Ideal (gain 10⁶, no
 * pole) without the pieces «gbw» and «rsal»; with «gbw», one pole at gbw/A0 (a transconductance into an RC, then a
 * unity buffer); with «rsal», that open-loop output resistance in series with the output. `inicio` is the output's
 * voltage at t = 0 (the internal pole's initial condition, so the transient starts in the steady state).
 */
export function seguidor(c: ContextoNetlist, entrada: string, salida: string, inicio: number): string[] {
  const conR = c.tiene('rsal') && c.p('rsal') > 0;
  const tras = conR ? 'aoo' : salida;
  const lineas: string[] = [];
  if (c.tiene('gbw')) {
    const R = 1e8;
    const C = A0 / (2 * Math.PI * c.p('gbw') * R);
    lineas.push(`GAO 0 aox ${entrada} ${salida} ${num(A0 / R)}`, `RAX aox 0 ${num(R)}`, `CAX aox 0 ${ng(C)} IC=${num(inicio)}`, `EAO ${tras} 0 aox 0 1`);
  } else lineas.push(`EAO ${tras} 0 ${entrada} ${salida} 1e6`);
  if (conR) lineas.push(`RAO aoo ${salida} ${ng(c.p('rsal'))}`);
  return lineas;
}

// ---------------------------------------------------------------------------------------------------------------------
// 1.2 (esquemas12): the operational amplifier of the op-amp family (ao-no-inversor, ao-inversor, ao-sumador,
// ao-integrador, comparador-schmitt, muestreo-retencion, regulador-lineal). One model, documented in
// contenido/lecciones11/GUIA.md §5 («El operacional de la app»):
//   - open-loop gain A₀ (piece «a0», default 10⁵) with one pole at GBW/A₀ (piece «gbw»; without it 1 GHz, which is
//     ideal for every signal of the app), an output that cannot leave [vsatneg, vsat] (pieces «vsat», «vsatneg»; without
//     them, no limit) and a slew rate (piece «sr», V/s; without it, none);
//   - transient: dx/dt = clamp(2π·GBW·(v₊ − v₋) − (2π·GBW/A₀)·x, ±SR), x held inside the rails without wind-up (a
//     saturated output leaves the rail as soon as the inputs cross; see `integrador`), and the output is x through an
//     ideal buffer; a comparator with positive feedback decides with a switch instead (`lineasComparador`);
//   - AC: the small-signal part, A₀ (no «gbw») or A₀/(1 + s·A₀/(2π·GBW));
//   - DC (.op, and the living circuit): a linear netlist for the region the amplifier is in — the VCVS of gain A₀ when
//     its output stays between the rails, else a source at the rail it sits on — chosen by solving the linear circuit
//     (lib/leccion12/cc.ts). With positive feedback (a Schmitt trigger) both rails can be consistent: the piece «alto»
//     (1 high, 0 low; default high) says where the output was. The result is the same as the clamped model's.

/** The pieces of the amplifier a widget may give (all optional). */
export function piezasAO(): Record<string, Pieza> {
  return {
    vsat: { descripcion: 'tensión de saturación positiva de la salida, +V_sat (V); sin ella, sin límite', color: 'verde' },
    vsatneg: { descripcion: 'tensión de saturación negativa, −V_sat (V; sin ella, −vsat; 0 con alimentación simple)', color: 'verde' },
    a0: { descripcion: 'ganancia en lazo abierto A₀ (sin ella, 10⁵)', color: 'verde' },
    gbw: { descripcion: 'producto ganancia-ancho de banda (Hz); sin él, 1 GHz: ideal', color: 'verde' },
    sr: { descripcion: 'velocidad de subida, slew rate (V/s); sin ella, sin límite', color: 'verde' },
  };
}

/** What the amplifier's pieces say: gain, rails, GBW and slew rate. */
export function datosAO(c: ContextoNetlist): { a0: number; alto: number; bajo: number; gbw: number; sr: number } {
  const a0 = c.tiene('a0') && c.p('a0') > 0 ? c.p('a0') : A0;
  const alto = c.tiene('vsat') ? c.p('vsat') : Infinity;
  const bajo = c.tiene('vsatneg') ? c.p('vsatneg') : c.tiene('vsat') ? -c.p('vsat') : -Infinity;
  return { a0, alto, bajo, gbw: c.tiene('gbw') && c.p('gbw') > 0 ? c.p('gbw') : 1e9, sr: c.tiene('sr') && c.p('sr') > 0 ? c.p('sr') : Infinity };
}

/** The amplifier's terminals in a netlist. */
export interface Operacional {
  mas: string;
  menos: string;
  salida: string;
}

const lim = (v: number) => num(Number.isFinite(v) ? v : Math.sign(v) * 1e12);

/**
 * The amplifier's lines for a transient or an AC analysis (DC: `lineasCC`). `inicio`: the output's voltage at t = 0.
 */
export function lineasAO(c: ContextoNetlist, analisis: Analisis, ao: Operacional, inicio: number): string[] {
  const d = datosAO(c);
  const { mas: p, menos: m, salida: o } = ao;
  if (analisis === 'ac') {
    if (!c.tiene('gbw')) return [`EAO ${o} 0 ${p} ${m} ${num(d.a0)}`];
    const R = 1e8;
    const C = d.a0 / (2 * Math.PI * d.gbw * R);
    return [`GAO 0 aox ${p} ${m} ${num(d.a0 / R)}`, `RAX aox 0 ${num(R)}`, `CAX aox 0 ${ng(C)}`, `EAO ${o} 0 aox 0 1`];
  }
  const wt = 2 * Math.PI * d.gbw;
  const f = `${num(wt)}*(v(${p})-v(${m})) - ${num(wt / d.a0)}*v(aox)`;
  return integrador(d, f, wt, inicio, o);
}

/**
 * The state x of the amplifier as a 1 F capacitor charged by a behavioural current dx/dt = `f` (V/s), limited to the
 * slew rate and held inside the rails by two steep clamps (10⁴·2π·GBW per volt beyond a rail: x stops within a
 * millivolt of it and leaves it as soon as `f` turns): an integrator without wind-up whose initial value is an ordinary
 * «IC=» (ngspice keeps it with «uic»; the XSPICE «int» model does not). The output is x through an ideal buffer.
 */
function integrador(d: ReturnType<typeof datosAO>, f: string, wt: number, inicio: number, o: string): string[] {
  const x0 = Math.min(d.alto, Math.max(d.bajo, inicio));
  let i = Number.isFinite(d.sr) ? `max(${num(-d.sr)}, min(${num(d.sr)}, ${f}))` : f;
  const k = num(1e4 * wt);
  if (Number.isFinite(d.alto)) i = `min(${k}*(${lim(d.alto)}-v(aox)), ${i})`;
  if (Number.isFinite(d.bajo)) i = `max(${k}*(${lim(d.bajo)}-v(aox)), ${i})`;
  return [`BAOI 0 aox I = ${i}`, `CAX aox 0 1 IC=${num(x0)}`, `EAO ${o} 0 aox 0 1`];
}

/**
 * The transient of a comparator (comparador-schmitt): with positive feedback the amplifier's regenerative loop is far
 * faster than any time step, and an implicit integration step settles on a spurious middle state; so the decision is
 * an ngspice voltage-controlled switch with memory on v₊ − v₋ (it turns at 0, ± 1 µV), started in the state `alto`,
 * and the output goes to the rail it chooses through the integrator above — at once, or at the slew rate «sr» (GBW
 * does not apply: a comparator's edges are its slew rate).
 */
export function lineasComparador(c: ContextoNetlist, ao: Operacional, alto: boolean): string[] {
  const d = datosAO(c);
  const { mas: p, menos: m, salida: o } = ao;
  const wt = 2 * Math.PI * d.gbw;
  const objetivo = `${lim(d.bajo)} + ${lim(d.alto - d.bajo)}*v(aoq)`;
  return [
    'VAOU aou 0 DC 1',
    `SAO aou aoq ${p} ${m} aosw ${alto ? 'ON' : 'OFF'}`,
    'RAOQ aoq 0 1e6',
    '.model aosw SW(VT=0 VH=1e-6 RON=1e-3 ROFF=1e15)',
    ...integrador(d, `${num(1e4 * wt)}*(${objetivo} - v(aox))`, wt, alto ? d.alto : d.bajo, o),
  ];
}

/** Where the amplifier is in DC: linear, or saturated at a rail. */
export type RegionAO = 'lineal' | 'alto' | 'bajo';

/**
 * The DC netlist: the rest of the circuit (`resto`, without the amplifier) and the amplifier as the linear part of the
 * region it is in (see above). `biestable`: positive feedback — the linear solution is the unstable middle one, never
 * taken; the piece «alto» chooses between two consistent rails.
 */
export function lineasCC(c: ContextoNetlist, resto: string[], ao: Operacional, biestable = false): { lineas: string[]; region: RegionAO } {
  const d = datosAO(c);
  const { mas: p, menos: m, salida: o } = ao;
  const lineal = [...resto, `EAO ${o} 0 ${p} ${m} ${num(d.a0)}`];
  const sol = resolverCC(lineal);
  const vo = sol?.nodos[o.toLowerCase()];
  if (!biestable && vo != null && vo <= d.alto && vo >= d.bajo) return { lineas: lineal, region: 'lineal' };
  const en = (v: number) => [...resto, `VAO ${o} 0 DC ${num(v)}`];
  /** Whether the output at rail `v` is what A₀·(v₊ − v₋) asks for. */
  const cabe = (v: number, alto: boolean) => {
    if (!Number.isFinite(v)) return false;
    const s = resolverCC(en(v));
    if (!s) return false;
    const x = d.a0 * ((s.nodos[p.toLowerCase()] ?? 0) - (s.nodos[m.toLowerCase()] ?? 0));
    return alto ? x >= v : x <= v;
  };
  const a = cabe(d.alto, true);
  const b = cabe(d.bajo, false);
  const prefiereAlto = !c.tiene('alto') || c.cerrado('alto');
  if (a && (!b || prefiereAlto)) return { lineas: en(d.alto), region: 'alto' };
  if (b) return { lineas: en(d.bajo), region: 'bajo' };
  return { lineas: lineal, region: 'lineal' };
}

/** The amplifier's output in DC (V) for the rest of the circuit `resto` (NaN if it cannot be solved). */
export function salidaCC(c: ContextoNetlist, resto: string[], ao: Operacional, biestable = false): number {
  const s = resolverCC(lineasCC(c, resto, ao, biestable).lineas);
  return s?.nodos[ao.salida.toLowerCase()] ?? NaN;
}

/**
 * A whole op-amp schematic's netlist for each analysis: `resto(fuente)` gives every line but the amplifier's, with the
 * input source line `fuente`; the transient starts in the DC state of the input's value at t = 0 (or at `inicio`).
 */
export function netlistAO(
  c: ContextoNetlist,
  analisis: Analisis,
  resto: (fuente: string) => string[],
  ao: Operacional,
  opciones: { biestable?: boolean; inicio?: number; comparador?: boolean } = {},
): string[] {
  const fuente = fuenteEntrada(c, 'VIN', 'in', analisis);
  if (analisis === 'op') return lineasCC(c, resto(fuente), ao, opciones.biestable).lineas;
  if (analisis === 'ac') return [...resto(fuente), ...lineasAO(c, 'ac', ao, 0)];
  const inicio = opciones.inicio ?? salidaCC(c, resto(`VIN in 0 DC ${num(entradaInicial(c))}`), ao, opciones.biestable);
  const x0 = Number.isFinite(inicio) ? inicio : 0;
  if (opciones.comparador) {
    const d = datosAO(c);
    return [...resto(fuente), ...lineasComparador(c, ao, x0 >= (d.alto + d.bajo) / 2)];
  }
  return [...resto(fuente), ...lineasAO(c, 'tran', ao, x0)];
}

/** The readings every op-amp schematic has: the output in DC (`vo`), against time (`entrada`, `salida`) and in AC. */
export function observablesAO(): Record<string, Observable> {
  return {
    vo: { medida: 'v(out)', analisis: 'op', unidad: 'V', descripcion: 'tensión de salida en continua' },
    entrada: { medida: 'v(in)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de entrada frente al tiempo' },
    salida: { medida: 'v(out)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de salida frente al tiempo' },
    ...observablesCA('salida', 'v(out)', 'V', 'la tensión de salida'),
  };
}

// ------------------------------------------------------------------------------------------------ the input signal
/**
 * The input of an op-amp schematic: a DC level `entrada` plus, optionally, a sine, a square or a triangle of
 * amplitude `amplitud` and frequency `f` (piece «forma»: 0 sine, 1 square, 2 triangle):
 *   - sine: v(t) = entrada + amplitud·sen(2π·f·t + fase);
 *   - square: entrada + amplitud during the first half period, entrada − amplitud during the second;
 *   - triangle: from entrada − amplitud at t = 0 up to entrada + amplitud at T/2 and back at T.
 * DC (.op) sees `entrada`; AC (.ac) sees `amplitud` with phase `fase`.
 * 1.2 (esquemas12c, the comparator's window of sección 8.3):
 *   - forma 3, a ramp (sawtooth): from entrada − amplitud at t = 0 up to entrada + amplitud at T, then back at once:
 *     entrada − amplitud + 2·amplitud·(f·t − floor(f·t));
 *   - «ruido»: a repeatable «noise» added in the transient only, three sines at 37, 61 and 97 times f, zero at t = 0:
 *     ruido·(sen(2π·37·f·t) + sen(2π·61·f·t) + sen(2π·97·f·t))/3 — the model writes the same sum, so the chatter of a
 *     comparator without hysteresis is checked edge by edge.
 */
export function piezasEntrada(): Record<string, Pieza> {
  return {
    entrada: { obligatoria: true, descripcion: 'tensión de entrada en continua (V; con una señal, su valor medio)' },
    amplitud: { descripcion: 'amplitud de pico de la señal de entrada (V); sin ella, solo continua' },
    f: { descripcion: 'frecuencia de la señal de entrada (Hz)' },
    forma: { descripcion: 'forma de la señal: 0 senoidal, 1 cuadrada, 2 triangular, 3 rampa en diente de sierra (sin ella, senoidal)' },
    ruido: { descripcion: 'amplitud del «ruido» sumado a la señal en el transitorio (V): tres senoidales a 37, 61 y 97 veces f, divididas entre 3' },
    fase: { descripcion: 'fase inicial de la senoidal, φ (grados)' },
  };
}

/**
 * The input source line (`nombre`, from `nodo` to ground) for every analysis. (esquemas12c: in a transient with
 * «ruido», two lines in one string — the source to `nodo`_r and the noise in series up to `nodo`; only the transient,
 * which nothing parses line by line, gets it.)
 */
export function fuenteEntrada(c: ContextoNetlist, nombre = 'VIN', nodo = 'in', analisis?: Analisis): string {
  const f = c.p('f');
  if (analisis === 'tran' && c.tiene('ruido') && c.p('ruido') !== 0 && f > 0) {
    const w = 2 * Math.PI * f;
    const r = c.p('ruido') / 3;
    return `${fuenteEntrada(c, nombre, `${nodo}_r`)}\nB${nombre}R ${nodo} ${nodo}_r V = ${num(r)}*(sin(${num(37 * w)}*time) + sin(${num(61 * w)}*time) + sin(${num(97 * w)}*time))`;
  }
  const e = c.p('entrada');
  const a = c.p('amplitud');
  const base = `${nombre} ${nodo} 0 DC ${num(e)}`;
  if (!c.tiene('amplitud') || !(f > 0)) return base;
  const T = 1 / f;
  const forma = Math.round(c.p('forma'));
  if (forma === 3) return `${base} AC ${num(a)} PULSE(${num(e - a)} ${num(e + a)} 0 ${num(T * (1 - 1e-4))} ${num(T * 1e-4)} 0 ${num(T)})`;
  if (forma === 1) return `${base} AC ${num(a)} PULSE(${num(e + a)} ${num(e - a)} ${num(T / 2 - T * 5e-5)} ${num(T * 1e-4)} ${num(T * 1e-4)} ${num(T / 2 - T * 1e-4)} ${num(T)})`;
  if (forma === 2) return `${base} AC ${num(a)} PULSE(${num(e - a)} ${num(e + a)} 0 ${num(T / 2)} ${num(T / 2)} ${num(T * 1e-9)} ${num(T)})`;
  return `${base} AC ${num(a)} ${num(c.p('fase'))} SIN(${num(e)} ${num(a)} ${num(f)} 0 0 ${num(c.p('fase'))})`;
}

/** The input's value at t = 0 (the transient's initial state). */
export function entradaInicial(c: ContextoNetlist): number {
  const e = c.p('entrada');
  if (!c.tiene('amplitud') || !(c.p('f') > 0)) return e;
  const forma = Math.round(c.p('forma'));
  if (forma === 1) return e + c.p('amplitud');
  if (forma === 2 || forma === 3) return e - c.p('amplitud');
  return e + c.p('amplitud') * Math.sin((c.p('fase') * Math.PI) / 180);
}

/** The input described for screen readers. */
export function describirEntrada(c: ContextoDibujo): string {
  if (!c.tiene('amplitud') || !c.tiene('f')) return `entrada de ${c.val('entrada')}`;
  const forma = ['senoidal', 'cuadrada', 'triangular', 'en rampa'][Math.round(c.p('forma'))] ?? 'senoidal';
  return `entrada ${forma} de ${c.val('amplitud')} de pico y ${c.val('f')}${c.p('entrada') ? ` sobre ${c.val('entrada')}` : ''}${c.tiene('ruido') && c.p('ruido') ? ` con ruido de ${c.val('ruido')}` : ''}`;
}

/** The amplifier described for screen readers («operacional ideal», «… saturado a ±12 V, …»). */
export function describirAO(c: ContextoDibujo): string {
  const partes: string[] = [];
  if (c.tiene('vsat')) partes.push(c.tiene('vsatneg') ? `salida entre ${c.val('vsatneg')} y ${c.val('vsat')}` : `salida hasta ± ${c.val('vsat')}`);
  if (c.tiene('a0')) partes.push(`ganancia en lazo abierto ${c.val('a0')}`);
  if (c.tiene('gbw')) partes.push(`${c.val('gbw')} de producto ganancia-ancho de banda`);
  if (c.tiene('sr')) partes.push(`velocidad de subida de ${c.val('sr')}`);
  return partes.length ? `operacional con ${partes.join(', ')}` : 'operacional ideal';
}

/** A square input has jumps the model draws at the half periods (tipos.ts tran.bordes: ± 0,15 % of the axis, a step and a half). */
export const bordesEntrada = (c: ContextoNetlist): number => (c.tiene('amplitud') && [1, 3].includes(Math.round(c.p('forma'))) ? 0.0015 : 0);
