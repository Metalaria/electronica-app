// Schematic «ao-estabilidad» (1.2, esquemas12c; secciones 27.8 to 27.10): an op-amp follower or non-inverting amplifier
// whose amplifier has two poles — A(s) = A₀/((1 + s/ω₁)(1 + s/ω₂)), ω₁ = 2π·GBW/A₀ (piece «gbw»), ω₂ = 2π·polo2 — and
// an open-loop output resistance R_o («rsal»), driving a capacitive load C_L, optionally through R_iso (the feedback
// taken before it, «outside the loop», or after it, «inside», with the switch «dentro») and with a snubber R_s–C_s from
// the output to ground. Linear (no rails, no slew rate): the step response's overshoot and ringing and, in AC, the
// closed-loop response and the loop gain T(jω) — measured on a copy of the circuit with the loop opened at the − input
// (no current flows into it, so the opening is exact): T = −v_fb/v_test. Its phase margin is 180° + arg T where
// |T| = 1. Two poles and R_o = 0 (sección 27.8, 10 Hz and 1 MHz with A₀ = 10⁵: a follower with 52° of margin): the
// closed loop is second order, ω_n² = ω₁ω₂(1 + A₀β), 2ζω_n = ω₁ + ω₂, β = R₁/(R₁ + R₂). R_o and C_L add a pole at
// 1/(2π·R_o·C_L) to T (50 Ω and 1 nF: 3,2 MHz, sección 27.10). The transient starts in the DC state of the input's
// value at t = 0 (every capacitor's «IC=» from that state).
import { ng, num } from '../comun';
import { A0, describirEntrada, entradaInicial, fuenteEntrada, piezasEntrada, bordesEntrada } from '../comun-ao';
import { observablesCA } from '../comun-ca';
import { resolverCC } from '../../../leccion12/cc';
import type { Analisis, ContextoDibujo, ContextoNetlist, DefinicionEsquema } from '../tipos';

const a0 = (c: ContextoNetlist) => (c.tiene('a0') && c.p('a0') > 0 ? c.p('a0') : A0);

/**
 * The circuit from the amplifier's inputs on (`s` suffixes every node: the loop-gain copy), its − input at `m` and the
 * amplifier driven by v(`mas`) − v(`menos`); `ic` gives each capacitor's initial voltage (null: none).
 */
function lazo(c: ContextoNetlist, s: string, mas: string, menos: string, ic: ((n: string) => number) | null): string[] {
  const n = (x: string) => (x === '0' ? '0' : `${x}${s}`);
  const A = a0(c);
  const w1 = (2 * Math.PI * c.p('gbw')) / A;
  const R = 1e6;
  const IC = (a: string, b: string) => (ic ? ` IC=${num(ic(a) - ic(b))}` : '');
  const fb = c.tiene('riso') && c.cerrado('dentro') ? 'out' : 'o';
  // (VCVS stages into RC poles: only R, C, E and V, so the living circuit solves its DC point — lib/leccion12/cc.ts)
  const lineas = [
    `EAX${s} ${n('x1a')} 0 ${mas} ${menos} ${num(A)}`,
    `RX1${s} ${n('x1a')} ${n('x1')} ${num(R)}`,
    `CX1${s} ${n('x1')} 0 ${ng(1 / (w1 * R))}${IC(n('x1'), '0')}`,
  ];
  if (c.tiene('polo2') && c.p('polo2') > 0) {
    lineas.push(`EX2${s} ${n('x2a')} 0 ${n('x1')} 0 1`, `RX2${s} ${n('x2a')} ${n('x2')} ${num(R)}`, `CX2${s} ${n('x2')} 0 ${ng(1 / (2 * Math.PI * c.p('polo2') * R))}${IC(n('x2'), '0')}`);
  } else lineas.push(`VX2${s} ${n('x1')} ${n('x2')} 0`);
  lineas.push(`EAO${s} ${n('o1')} 0 ${n('x2')} 0 1`);
  lineas.push(c.tiene('rsal') && c.p('rsal') > 0 ? `RO${s} ${n('o1')} ${n('o')} ${ng(c.p('rsal'))}` : `VO${s} ${n('o1')} ${n('o')} 0`);
  lineas.push(c.tiene('riso') ? `RISO${s} ${n('o')} ${n('out')} ${ng(c.p('riso'))}` : `VISO${s} ${n('o')} ${n('out')} 0`);
  if (c.tiene('cl')) lineas.push(`CL${s} ${n('out')} 0 ${ng(c.p('cl'))}${IC(n('out'), '0')}`);
  if (c.tiene('rsn') && c.tiene('csn')) lineas.push(`RSN${s} ${n('out')} ${n('sn')} ${ng(c.p('rsn'))}`, `CSN${s} ${n('sn')} 0 ${ng(c.p('csn'))}${IC(n('sn'), '0')}`);
  if (c.tiene('r2')) lineas.push(`R2${s} ${n(fb)} ${n('m')} ${ng(c.p('r2'))}`, `R1${s} ${n('m')} 0 ${ng(c.p('r1'))}`);
  else lineas.push(`VFB${s} ${n(fb)} ${n('m')} 0`);
  return lineas;
}

const d: DefinicionEsquema = {
  nombre: 'ao-estabilidad',
  titulo: 'Estabilidad del operacional: segundo polo, carga capacitiva, R_iso y red snubber',
  resumen: 'Seguidor o no inversor con un operacional de dos polos y resistencia de salida, carga capacitiva, R_iso dentro o fuera del lazo y snubber; respuesta al escalón y ganancia de lazo.',
  piezas: {
    ...piezasEntrada(),
    r1: { descripcion: 'resistencia de la entrada − a masa, R₁ (Ω; sin R₁ ni R₂, seguidor)', color: 'azul' },
    r2: { descripcion: 'resistencia de realimentación, R₂ (Ω)', color: 'naranja' },
    a0: { descripcion: 'ganancia en lazo abierto A₀ (sin ella, 10⁵)', color: 'verde' },
    gbw: { obligatoria: true, descripcion: 'producto ganancia-ancho de banda (Hz): el primer polo en GBW/A₀', color: 'verde' },
    polo2: { descripcion: 'segundo polo del operacional (Hz; sin él, uno solo)', color: 'verde' },
    rsal: { descripcion: 'resistencia de salida en lazo abierto, R_o (Ω)', color: 'verde' },
    cl: { descripcion: 'condensador de carga, C_L (F)', color: 'naranja' },
    riso: { descripcion: 'resistencia de aislamiento entre la salida y C_L, R_iso (Ω)', color: 'azul' },
    dentro: { interruptor: true, descripcion: 'realimentación tomada tras R_iso (dentro del lazo; sin él o abierto, antes: fuera)', color: 'azul' },
    rsn: { descripcion: 'resistencia de la red snubber, R_s (Ω; con «csn»)', color: 'verde' },
    csn: { descripcion: 'condensador de la red snubber, C_s (F; con «rsn»)', color: 'verde' },
  },
  observables: {
    vo: { medida: 'v(out)', analisis: 'op', unidad: 'V', descripcion: 'tensión de salida en continua' },
    entrada: { medida: 'v(in)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de entrada frente al tiempo' },
    salida: { medida: 'v(out)', analisis: 'tran', unidad: 'V', descripcion: 'tensión de salida (en la carga) frente al tiempo' },
    patilla: { medida: 'v(o)', analisis: 'tran', unidad: 'V', descripcion: 'tensión en la patilla de salida del operacional (antes de R_iso) frente al tiempo' },
    ...observablesCA('salida', 'v(out)', 'V', 'la tensión de salida'),
    ...observablesCA('lazo', '-v(m_l)', '', 'la ganancia de lazo T'),
  },
  validar: (tiene) => {
    const e: string[] = [];
    if (tiene('r1') !== tiene('r2')) e.push('«r1» y «r2» van juntas (sin ninguna, seguidor)');
    if (tiene('rsn') !== tiene('csn')) e.push('la red snubber necesita «rsn» y «csn»');
    if (tiene('dentro') && !tiene('riso')) e.push('«dentro» elige dónde se toma la realimentación respecto de «riso»');
    return e;
  },
  netlist(c, analisis: Analisis) {
    const fuente = fuenteEntrada(c, 'VIN', 'in', analisis);
    if (analisis === 'op') return [fuente, ...lazo(c, '', 'in', 'm', null)];
    if (analisis === 'ac') return [fuente, ...lazo(c, '', 'in', 'm', null), 'VTEST t_l 0 DC 0 AC 1', ...lazo(c, '_l', '0', 't_l', null)];
    // the DC state at the input's initial value: every capacitor starts there
    const sol = resolverCC([`VIN in 0 DC ${num(entradaInicial(c))}`, ...lazo(c, '', 'in', 'm', null)]);
    const v = (x: string) => (x === '0' ? 0 : (sol?.nodos[x.toLowerCase()] ?? 0));
    return [fuente, ...lazo(c, '', 'in', 'm', v)];
  },
  tran: { bordes: bordesEntrada },
  describir: (c: ContextoDibujo) => {
    const partes = [`operacional de ${c.val('gbw')} de producto ganancia-ancho de banda`];
    if (c.tiene('polo2')) partes.push(`segundo polo en ${c.val('polo2')}`);
    if (c.tiene('rsal')) partes.push(`${c.sim('rsal')} de ${c.val('rsal')} de salida`);
    const carga = [c.tiene('riso') ? `${c.sim('riso')} de ${c.val('riso')} ${c.tiene('dentro') && c.cerrado('dentro') ? 'dentro del lazo' : 'fuera del lazo'}` : '', c.tiene('cl') ? `${c.sim('cl')} de ${c.val('cl')} de carga` : '', c.tiene('rsn') ? `red snubber de ${c.val('rsn')} y ${c.val('csn')}` : ''].filter(Boolean);
    return `${c.tiene('r2') ? `Amplificador no inversor con ${c.sim('r2')} de ${c.val('r2')} y ${c.sim('r1')} de ${c.val('r1')}` : 'Seguidor'}: ${describirEntrada(c)}; ${partes.join(', ')}${carga.length ? `; ${carga.join(', ')}` : ''}`;
  },
};
export default d;
