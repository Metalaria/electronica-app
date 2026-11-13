// esquemas12 (1.2): the schematics the lesson authors asked for (mosfet, the op-amp family, regulador-lineal,
// ne555-astable, muestreo-retencion, rlc-escalon, trifasica, transformador-real and the |Z| of rlc-serie; esquemas12b:
// mosfet with an inductive load, rectificador-toma-media and lm3914; esquemas12c: fuente-controlada inverted,
// bjt-interruptor with a LED and iref, LED/diode reversed, the ramp-and-noise input, comparador-no-inversor,
// emisor-comun, par-diferencial, etapa-clase-ab, ao-estabilidad, ao-instrumentacion, transimpedancia, mosfet-p,
// puerta-transmision, mosfet with R_DS(on), lm317, sonda-x10, the divisor's crossing and net label), in Node with
// the app's ngspice: each one's netlist against the book's analytic values (DC, AC and transient), the op-amp model
// (A₀, rails without wind-up, GBW, slew rate, the DC region the living circuit solves), the power meter the living
// circuit skips, and the edge tolerance of the comparison. The catalogue lesson (lecciones11-esquemas.spec.ts) checks
// each one's catalogue card against its model; the browser test (lecciones12-fix12.spec.ts) draws them.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones12.config.ts tests/lecciones12-esquemas12.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilar } from '../src/simulador/motor/nucleo.ts';
import { simular } from '../src/simulador/motor/simular.ts';
import { esquemaDe } from '../src/lib/leccion11/esquemas/registro.ts';
import { lineasCC } from '../src/lib/leccion11/esquemas/comun-ao.ts';
import type { Analisis, ContextoNetlist } from '../src/lib/leccion11/esquemas/tipos.ts';
import { compararSimulacion, montarNetlist, type CurvaEsperada } from '../src/lib/leccion11/spice.ts';
import { esLineal, resolverCC } from '../src/lib/leccion12/cc.ts';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';

await cargarEsquemas11();
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modulo = await compilar(fs.readFileSync(path.join(web, 'public', 'ngspice', 'ngspice-xspice.wasm')));

type Piezas = Record<string, number>;
const ctx = (p: Piezas): ContextoNetlist => ({ p: (k) => p[k] ?? 0, tiene: (k) => k in p, cerrado: (k) => !(k in p) || p[k] !== 0 });
interface Vectores {
  eje: number[];
  v: (nombre: string) => number[];
  im: (nombre: string) => number[];
}
/** Simulates a schematic with these pieces; the vectors of the analysis asked for. */
async function sim(esquema: string, an: Analisis, p: Piezas, tarjeta: string): Promise<Vectores> {
  const def = esquemaDe(esquema)!;
  const r = await simular(modulo, montarNetlist(def, ctx(p), an, tarjeta), undefined, 'xspice');
  const patron = { op: /operating/i, tran: /transient/i, ac: /\bac\b/i }[an];
  const g = r.ejecucion.graficas.find((x) => patron.test(x.analisis));
  expect(g, `${esquema} ${an}: ${r.salida.errores.join(' | ')}`).toBeTruthy();
  const vec = (n: string) => g!.vectores.find((x) => x.nombre.toLowerCase() === n.toLowerCase());
  return {
    eje: Array.from(g!.vectores[0]!.re),
    v: (n) => {
      expect(vec(n), `${esquema}: falta ${n}`).toBeTruthy();
      return Array.from(vec(n)!.re);
    },
    im: (n) => Array.from(vec(n)?.im ?? []),
  };
}
const op = async (e: string, p: Piezas) => {
  const s = await sim(e, 'op', p, '.op');
  return (n: string) => s.v(n)[0]!;
};
/** Amplitude of an AC vector at the sweep's only point. */
const amp = (s: Vectores, n: string) => Math.hypot(s.v(n)[0]!, s.im(n)[0] ?? 0);
const cerca = (a: number, b: number, rel: number, abs = 0) => expect(Math.abs(a - b), `${a} frente a ${b}`).toBeLessThanOrEqual(rel * Math.abs(b) + abs);
/** The times at which a vector crosses `nivel` (linear interpolation). */
function cruces(t: number[], y: number[], nivel: number, subiendo: boolean): number[] {
  const out: number[] = [];
  for (let k = 1; k < y.length; k++) {
    const a = y[k - 1]! - nivel;
    const b = y[k]! - nivel;
    if (subiendo ? a < 0 && b >= 0 : a > 0 && b <= 0) out.push(t[k - 1]! + ((t[k]! - t[k - 1]!) * a) / (a - b));
  }
  return out;
}

test.describe('esquemas12 frente a ngspice', () => {
  test.setTimeout(120_000);

  test('mosfet: ley cuadrática del libro en saturación, zona óhmica y corte (LEVEL=1, KP = k, VTO = V_th)', async () => {
    const base = { vdd: 12, rd: 470, k: 0.002, vth: 2 };
    // saturation: I_D = ½·k·(V_GS − V_th)² = 9 mA
    let m = await op('mosfet', { ...base, entrada: 5 });
    cerca(m('i(vmd)'), 0.5 * 0.002 * 9, 1e-6);
    cerca(m('v(d)'), 12 - 470 * 0.009, 1e-6);
    // triode: k·(V_ov·V_DS − V_DS²/2) = (V_DD − V_DS)/R_D
    m = await op('mosfet', { ...base, rd: 2200, entrada: 8 });
    const vds = m('v(d)');
    expect(vds).toBeLessThan(6);
    cerca(0.002 * (6 * vds - (vds * vds) / 2), (12 - vds) / 2200, 1e-6);
    // cut-off and the gate divider R_G–R_GS
    m = await op('mosfet', { ...base, entrada: 1.5 });
    expect(Math.abs(m('i(vmd)'))).toBeLessThan(1e-9);
    m = await op('mosfet', { ...base, entrada: 10, rg: 10000, rgs: 10000 });
    cerca(m('v(g)'), 5, 1e-6);
    // degeneration (problema 7.C): V_GS = V_G − I_D·R_S with I_D = ½k(V_GS − V_th)²
    m = await op('mosfet', { ...base, entrada: 6, rs: 500 });
    const id = m('i(vmd)');
    cerca(id, 0.001 * (6 - id * 500 - 2) ** 2, 1e-6);
    // channel-length modulation: (1 + λ·V_DS)
    m = await op('mosfet', { ...base, entrada: 5, lambda: 0.02 });
    cerca(m('i(vmd)'), 0.009 * (1 + 0.02 * m('v(d)')), 1e-6);
    // PWM: the drain sees pulses, low a quarter of each period
    const s = await sim('mosfet', 'tran', { ...base, rd: 1000, entrada: 10, f: 1000, ciclo: 0.25 }, '.tran 1e-6 2e-3 0 1e-6 uic');
    const d = s.v('v(d)');
    const t = s.eje;
    const bajo = t.filter((x, k) => x > 1e-3 && d[k]! < 6).length / t.filter((x) => x > 1e-3).length;
    cerca(bajo, 0.25, 0, 0.01);
  });

  test('operacional: ganancia con A₀ finito, saturación sin «wind-up», GBW y slew rate', async () => {
    // inverting, DC: −(R₂/R₁)/(1 + (1 + R₂/R₁)/A₀)
    let m = await op('ao-inversor', { entrada: 1, r1: 1000, r2: 10000 });
    cerca(m('v(out)'), -10 / (1 + 11 / 1e5), 1e-9);
    cerca(m('v(mn)'), 10 / (1 + 11 / 1e5) / 1e5, 1e-3);
    // saturated at the rail, the − input no longer a virtual ground: (V_in·R₂ + V_sat·R₁)/(R₁ + R₂)
    m = await op('ao-inversor', { entrada: 2, r1: 1000, r2: 10000, vsat: 12 });
    expect(m('v(out)')).toBe(-12);
    cerca(m('v(mn)'), (2 * 10000 - 12 * 1000) / 11000, 1e-9);
    // a single supply: the output stops at 0
    m = await op('ao-no-inversor', { entrada: -1, r1: 1000, r2: 1000, vsat: 5, vsatneg: 0 });
    expect(m('v(out)')).toBe(0);
    // non-inverting with GBW: |G| = A₀/√((1 + A₀β)² + (f/f_p)²), f_p = GBW/A₀
    const ac = await sim('ao-no-inversor', 'ac', { entrada: 0, amplitud: 1, f: 100000, r1: 1000, r2: 9000, gbw: 1e6 }, '.ac lin 1 100000 100000');
    cerca(amp(ac, 'v(out)'), 1e5 / Math.hypot(1 + 1e5 / 10, 1e5 / 10), 1e-4);
    // transient clipping at the rails, and no wind-up: back in the linear region at once when the input turns
    let s = await sim('ao-inversor', 'tran', { entrada: 0, amplitud: 3, f: 1000, r1: 1000, r2: 5000, vsat: 12 }, '.tran 1e-6 2e-3 0 1e-6 uic');
    const vo = s.v('v(out)');
    expect(Math.max(...vo)).toBeLessThanOrEqual(12.001);
    expect(Math.min(...vo)).toBeGreaterThanOrEqual(-12.001);
    for (const [k, t] of s.eje.entries()) {
      const ideal = Math.max(-12, Math.min(12, -5 * 3 * Math.sin(2 * Math.PI * 1000 * t)));
      expect(Math.abs(vo[k]! - ideal), `t = ${t}`).toBeLessThan(0.02);
    }
    // slew rate: a follower with a 0,5 V/µs amplifier on a ±1 V square falls from 0,5 V to −0,5 V in 2 µs
    s = await sim('ao-no-inversor', 'tran', { entrada: 0, amplitud: 1, f: 10000, forma: 1, sr: 5e5, vsat: 12 }, '.tran 1e-8 1e-4 0 1e-8 uic');
    const desde = cruces(s.eje, s.v('v(out)'), 0.5, false)[0]!;
    const hasta = cruces(s.eje, s.v('v(out)'), -0.5, false)[0]!;
    cerca(hasta - desde, 1 / 5e5, 0.02);
    // integrator: a ramp of −V/(RC) from v₀
    s = await sim('ao-integrador', 'tran', { entrada: 1, r: 10000, c: 1e-7, v0: 2, vsat: 12 }, '.tran 1e-5 2e-3 0 1e-5 uic');
    const t1 = s.eje.findIndex((x) => x >= 1e-3);
    cerca(s.v('v(out)')[t1]!, 2 - s.eje[t1]! / 1e-3, 1e-3, 1e-3);
    // and it stops at the rail (−12 V at 14 ms) without passing it
    s = await sim('ao-integrador', 'tran', { entrada: 1, r: 10000, c: 1e-7, vsat: 12 }, '.tran 1e-4 0.02 0 1e-4 uic');
    expect(Math.min(...s.v('v(out)'))).toBeGreaterThan(-12.01);
    cerca(s.v('v(out)').at(-1)!, -12, 1e-3);
  });

  test('operacional en continua: la región se elige resolviendo el circuito lineal (el circuito vivo lo colorea)', () => {
    const c = ctx({ entrada: 3, r1: 1000, r2: 10000, vsat: 12 });
    const resto = ['VIN in 0 DC 3', 'R1 in mn 1000', 'R2 mn out 10000'];
    const r = lineasCC(c, resto, { mas: '0', menos: 'mn', salida: 'out' });
    expect(r.region).toBe('bajo');
    expect(r.lineas.some((l) => /^VAO out 0 DC -12$/.test(l))).toBe(true);
    // the inverting amplifier's DC netlist is linear: the living circuit solves it
    const lin = esquemaDe('ao-inversor')!.netlist(ctx({ entrada: 0.5, r1: 1000, r2: 10000, vsat: 12 }), 'op');
    expect(esLineal(lin)).toBe(true);
    expect(resolverCC(lin)!.nodos.out).toBeCloseTo(-5 / (1 + 11 / 1e5), 6);
    // Schmitt (positive feedback): inside the window both rails hold; «alto» says which one
    const sch = (alto: number, v: number) => resolverCC(esquemaDe('comparador-schmitt')!.netlist(ctx({ entrada: v, r1: 10000, r2: 100000, vsat: 12, alto }), 'op'))!;
    expect(sch(1, 0.5).nodos.out).toBe(12);
    expect(sch(0, 0.5).nodos.out).toBe(-12);
    expect(sch(1, 1.2).nodos.out).toBe(-12);
    expect(sch(0, -1.2).nodos.out).toBe(12);
    cerca(sch(1, 0).nodos.p!, (12 * 10000) / 110000, 1e-6);
  });

  test('comparador-schmitt: conmuta en ±V_sat·R₁/(R₁ + R₂) (±1,09 V con 10 kΩ, 100 kΩ y ±12 V)', async () => {
    const s = await sim('comparador-schmitt', 'tran', { entrada: 0, amplitud: 5, f: 100, r1: 10000, r2: 100000, vsat: 12 }, '.tran 1e-6 0.03 0 1e-6 uic');
    const vin = s.v('v(in)');
    const baja = cruces(s.eje, s.v('v(out)'), 0, false);
    const sube = cruces(s.eje, s.v('v(out)'), 0, true);
    expect(baja.length).toBe(3);
    expect(sube.length).toBe(3);
    const en = (t: number) => vin[s.eje.findIndex((x) => x >= t)]!;
    for (const t of baja) cerca(en(t), 12 / 11, 0.01);
    for (const t of sube) cerca(en(t), -12 / 11, 0.01);
  });

  test('regulador-lineal: V_ref·(1 + R₁/R₂), dropout, la corriente de entrada igual a la de salida y P = (V_in − V_out)·I', async () => {
    const p = { entrada: 12, ref: 1.25, r1: 3000, r2: 1000, dropout: 2, carga: 5 };
    let m = await op('regulador-lineal', p);
    cerca(m('v(out)'), 5, 1e-4);
    cerca(m('i(vmi)'), 1 + 5 / 4000, 1e-4);
    cerca(m('i(vmi)'), m('i(vmo)'), 1e-9);
    cerca(m('v(pp)'), 7 * (1 + 5 / 4000), 1e-4);
    // below the dropout the output follows the input
    m = await op('regulador-lineal', { ...p, entrada: 6 });
    cerca(m('v(out)'), 4, 1e-9);
    // the power meter is skipped by the living circuit, which solves the rest exactly
    const lin = esquemaDe('regulador-lineal')!.netlist(ctx(p), 'op');
    expect(lin.some((l) => /^BMEDP /.test(l))).toBe(true);
    expect(esLineal(lin)).toBe(true);
    cerca(resolverCC(lin)!.nodos.out!, 5, 1e-4);
  });

  test('ne555-astable: t_alto = ln 2·(R_a + R_b)·C, t_bajo = ln 2·R_b·C (687 Hz con 1 kΩ, 10 kΩ y 100 nF)', async () => {
    const s = await sim('ne555-astable', 'tran', { vcc: 9, ra: 1000, rb: 10000, c: 1e-7 }, '.tran 2e-7 6e-3 0 2e-7 uic');
    const out = s.v('v(out)');
    const baja = cruces(s.eje, out, 4.5, false);
    const sube = cruces(s.eje, out, 4.5, true);
    cerca(baja[0]!, Math.LN2 * 11000 * 1e-7, 0.005);
    cerca(sube[0]! - baja[0]!, Math.LN2 * 10000 * 1e-7, 0.005);
    cerca(1 / (baja[2]! - baja[1]!), 1 / (Math.LN2 * 21000 * 1e-7), 0.005);
    const vc = s.v('v(c)').filter((_, k) => s.eje[k]! > 1e-3);
    cerca(Math.max(...vc), 6, 0.01);
    cerca(Math.min(...vc), 3, 0.01);
  });

  test('muestreo-retencion: adquisición con R_on·C_h, pedestal Q/C y caída I/C', async () => {
    const s = await sim('muestreo-retencion', 'tran', { entrada: 2, ron: 100, ch: 1e-9, tm: 1e-6, carga: 1e-11, fuga: 1e-6 }, '.tran 1e-9 3e-6 0 1e-9 uic');
    const v = (t: number) => s.v('v(out)')[s.eje.findIndex((x) => x >= t)]!;
    cerca(v(1e-7), 2 * (1 - Math.exp(-1)), 2e-3);
    // just after the opening: the sample plus Q/C (10 mV); then −I/C (1 mV per µs)
    cerca(v(1.05e-6) - v(0.99e-6), 0.01 - 0.05e-3, 0.05);
    cerca(v(2e-6) - v(3e-6), 1e-3, 0.02);
  });

  test('rlc-escalon: sobreoscilación e^(−πζ/√(1 − ζ²)) y amortiguamiento crítico sin ella', async () => {
    const zeta = (r: number) => (r / 2) * Math.sqrt(1e-6 / 0.01);
    let s = await sim('rlc-escalon', 'tran', { fuente: 10, r: 20, l: 0.01, c: 1e-6 }, '.tran 1e-6 2e-3 0 1e-6 uic');
    const z = zeta(20);
    cerca(Math.max(...s.v('v(c)')), 10 * (1 + Math.exp((-Math.PI * z) / Math.sqrt(1 - z * z))), 2e-3);
    s = await sim('rlc-escalon', 'tran', { fuente: 10, r: 200, l: 0.01, c: 1e-6 }, '.tran 1e-6 5e-3 0 1e-6 uic');
    expect(Math.max(...s.v('v(c)'))).toBeLessThanOrEqual(10.001);
    // the ringing of a charged capacitor through the short
    s = await sim('rlc-escalon', 'tran', { fuente: 10, r: 20, l: 0.01, c: 1e-6, v0: 5, interruptor: 0 }, '.tran 1e-6 2e-3 0 1e-6 uic');
    expect(Math.min(...s.v('v(c)'))).toBeLessThan(-3);
  });

  test('trifasica: el libro (neutro cortado 139, 263 y 331 V a 112,7 V; neutro de 7,50 A; estrella 4,33 A y triángulo 12,99 A)', async () => {
    const ac = '.ac lin 1 50 50';
    const base = { fuente: 230.9, f: 50 };
    let s = await sim('trifasica', 'ac', { ...base, r1: 26.45, r2: 52.9, r3: 264.5, neutro: 0 }, ac);
    const V = (a: string, b: string) => Math.hypot(s.v(a)[0]! - s.v(b)[0]!, (s.im(a)[0] ?? 0) - (s.im(b)[0] ?? 0));
    cerca(V('v(p1)', 'v(q1)'), 139, 0.005);
    cerca(V('v(p2)', 'v(q2)'), 263, 0.005);
    cerca(V('v(p3)', 'v(q3)'), 331, 0.005);
    cerca(amp(s, 'v(s)'), 112.7, 0.002);
    expect(amp(s, 'i(vmn)')).toBeLessThan(1e-9);
    // (2 kW and 1 kW at 230,9 V: 8,66 A and 4,33 A)
    s = await sim('trifasica', 'ac', { ...base, r1: 230.9 ** 2 / 2000, r2: 230.9 ** 2 / 1000, r3: 1e12, neutro: 1 }, ac);
    cerca(amp(s, 'i(vmn)'), 7.5, 0.002);
    s = await sim('trifasica', 'ac', { ...base, r1: 53.3, r2: 53.3, r3: 53.3 }, ac);
    cerca(amp(s, 'i(vm1)'), 4.33, 0.002);
    s = await sim('trifasica', 'ac', { ...base, r1: 53.3, r2: 53.3, r3: 53.3, triangulo: 1 }, ac);
    cerca(amp(s, 'i(vm1)'), 12.99, 0.002);
    cerca(amp(s, 'i(vj1)'), 7.5, 0.002);
  });

  test('transformador-real: banda pasante entre L_m (abajo) y L_d (arriba)', async () => {
    const p = { fuente: 1, rs: 50, lm: 1, ld: 0.001, n1: 100, n2: 200, carga: 2400 };
    // mid band: R'_L/(R_s + R'_L) times the ratio (R'_L = 600 Ω)
    let s = await sim('transformador-real', 'ac', { ...p, f: 3000 }, '.ac lin 1 3000 3000');
    cerca(amp(s, 'v(s)'), (2 * 600) / 650, 0.01);
    // the low corner: (R_s ‖ R'_L)/(2π·L_m), −3 dB
    const fb = (50 * 600) / 650 / (2 * Math.PI);
    s = await sim('transformador-real', 'ac', { ...p, f: fb }, `.ac lin 1 ${fb} ${fb}`);
    cerca(amp(s, 'v(s)'), (2 * 600) / 650 / Math.SQRT2, 0.01);
    // the magnetising current is the primary's with the load open… almost: here, through L_m at that corner
    expect(amp(s, 'i(vmm)')).toBeGreaterThan(0);
  });

  test('rlc-serie: |Z| = √(R² + (ωL − 1/(ωC))²), solo R en resonancia (un desacoplo con ESR y ESL)', async () => {
    const f0 = 1 / (2 * Math.PI * Math.sqrt(1e-9 * 1e-7));
    const p = { fuente: 1, r: 0.05, l: 1e-9, c: 1e-7 };
    let s = await sim('rlc-serie', 'ac', { ...p, f: f0 }, `.ac lin 1 ${f0} ${f0}`);
    cerca(amp(s, 'v(zx)'), 0.05, 1e-6);
    s = await sim('rlc-serie', 'ac', { ...p, f: 1e5 }, '.ac lin 1 100000 100000');
    const w = 2 * Math.PI * 1e5;
    cerca(amp(s, 'v(zx)'), Math.hypot(0.05, w * 1e-9 - 1 / (w * 1e-7)), 1e-6);
    // the meter does not touch the circuit: the current is still V/|Z|
    cerca(amp(s, 'i(vmed)'), 1 / Math.hypot(0.05, w * 1e-9 - 1 / (w * 1e-7)), 1e-6);
  });

  // esquemas12b
  test('mosfet con carga inductiva: al apagar, avalancha a BV sin diodo; con diodo, V_DD + V_F y t = (L/R)·ln(1 + I·R/V_F)', async () => {
    // 12 V, 10 Ω and 1 mH (τ = 100 µs) switched off at 0,5 ms; the coil starts with the on-state current
    const p = { vdd: 12, rd: 10, l: 1e-3, entrada: 5, k: 20, vth: 1.5, f: 1000, bv: 60, vf: 0.7 };
    const tarjeta = '.tran 1e-6 9.5e-4 0 1e-6 uic';
    const fin = (s: Vectores) => cruces(s.eje, s.v('i(ld)'), 1e-3, false).find((t) => t > 5e-4)!;
    let s = await sim('mosfet', 'tran', { ...p, rueda: 1 }, tarjeta);
    const i0 = s.v('i(ld)')[0]!;
    // (the square law in triode: V_DS(on) = 17 mV)
    cerca(i0, (12 - 0.01714) / 10, 1e-3);
    const vd = s.v('v(d)');
    // the drain during the freewheel: V_DD plus the diode's drop (0,7 V at 0,1 A; ± 0,15 V over the decay)
    cerca(vd[s.eje.findIndex((t) => t >= 6e-4)]!, 12.7, 0, 0.15);
    // the book's extinction time (sección 4.5), to 1 mA
    cerca(fin(s) - 5e-4, 1e-4 * Math.log(1 + (i0 * 10) / 0.7), 0.03);
    // the drain current stops at once: the coil's goes on through the diode
    expect(Math.abs(s.v('i(vmd)')[s.eje.findIndex((t) => t >= 5.5e-4)]!)).toBeLessThan(1e-3);
    s = await sim('mosfet', 'tran', { ...p, rueda: 0 }, tarjeta);
    // the plateau: BV plus the Zener's VT·ln(I/5 mA), 0,14 V at 1,2 A (the noLineal allowance of «bv»)
    const t5 = s.eje.findIndex((t) => t >= 5.05e-4);
    cerca(s.v('v(d)')[t5]!, 60 + 0.02585 * Math.log(s.v('i(ld)')[t5]! / 5e-3), 0, 0.02);
    cerca(fin(s) - 5e-4, 1e-4 * Math.log(1 + (i0 * 10) / (60 - 12)), 0.03);
    // after it, the drain settles at V_DD without ringing (the order-1 Gear of the netlist)
    const tras = s.v('v(d)').filter((_, k) => s.eje[k]! > 5.4e-4);
    expect(Math.max(...tras.map((v) => Math.abs(v - 12)))).toBeLessThan(0.05);
    // without the coil, the netlist is the one the lessons already use (no Gear, no avalanche, no leak)
    const sin = esquemaDe('mosfet')!.netlist(ctx({ vdd: 12, rd: 10, entrada: 5, k: 20, vth: 1.5 }), 'op');
    expect(sin.some((l) => /gear|^RDX|^DAV/.test(l))).toBe(false);
  });

  test('rectificador-toma-media: un solo diodo por rama (21,2 → 20,5 V), rizado a 2f por debajo de I/(2f·C) y ±V simétrica', async () => {
    const p = { fuente: 21.21, f: 50, vd: 0.7, c: 2200e-6, i: 0.5 };
    let s = await sim('rectificador-toma-media', 'tran', p, '.tran 1e-5 0.12 0.08 1e-5 uic');
    const vp = s.v('v(p)');
    const vn = s.v('v(n)');
    // the peak: one diode's drop (0,7 V at 10 mA; + 0,17 V in the recharge pulses of amperes)
    cerca(Math.max(...vp), 20.51, 0, 0.2);
    // the ripple: under the book's linear estimate 2,27 V (the recharge starts before the next peak), not far
    const rizado = Math.max(...vp) - Math.min(...vp);
    expect(rizado).toBeLessThan(0.5 / (100 * 2200e-6));
    expect(rizado).toBeGreaterThan(1.6);
    // symmetric rails
    cerca(Math.min(...vn), -Math.max(...vp), 2e-3);
    // two recharges per period of the mains (100 Hz): 4 pulses in 40 ms
    expect(cruces(s.eje, s.v('i(vdp)'), 1, true)).toHaveLength(4);
    // with a 7812/7912 and 2 V of dropout: ±12 V flat; with 8 V the valleys fall out of regulation
    s = await sim('rectificador-toma-media', 'tran', { ...p, reg: 12, dropout: 2 }, '.tran 1e-5 0.12 0.08 1e-5 uic');
    expect(Math.min(...s.v('v(op)'))).toBeCloseTo(12, 6);
    expect(Math.max(...s.v('v(on)'))).toBeCloseTo(-12, 6);
    // the regulator takes from its capacitor the current its load takes: the same ripple
    cerca(Math.max(...s.v('v(p)')) - Math.min(...s.v('v(p)')), rizado, 0.01);
    s = await sim('rectificador-toma-media', 'tran', { ...p, reg: 12, dropout: 8 }, '.tran 1e-5 0.12 0.08 1e-5 uic');
    cerca(Math.min(...s.v('v(op)')), Math.min(...s.v('v(p)')) - 8, 1e-6);
  });

  test('lm3914: un comparador por escalón de V_ref/10, LED de 10·V_ref/R_ref, barra frente a punto y 400 mW en el integrado', async () => {
    const p = { vref: 1.25, rref: 1250, vled: 6, vf: 2 };
    // 0,56 V: four steps of 125 mV passed
    let v = await op('lm3914', { ...p, entrada: 0.56 });
    expect(v('v(nled)')).toBeCloseTo(4, 9);
    cerca(v('i(vml)'), 4 * 0.01, 1e-6);
    cerca(v('i(vmr)'), 1e-3, 1e-9);
    // dot mode: a tenth of it
    v = await op('lm3914', { ...p, entrada: 0.56, barra: 0 });
    expect(v('v(nled)')).toBeCloseTo(1, 9);
    cerca(v('i(vml)'), 0.01, 1e-6);
    // the book: 10 LED at 10 mA with 4 V to spare, 400 mW inside the chip; the LED drops V_F at its current
    v = await op('lm3914', { ...p, entrada: 1.3 });
    expect(v('v(nled)')).toBeCloseTo(10, 9);
    // (the diode's I_S is written with eight digits: 10⁻⁵ of the drop)
    cerca(v('v(pch)'), 0.4, 1e-4);
    cerca(v('v(o1)'), 4, 1e-4);
    // 1 kΩ: about 12 mA per LED; the chain between V_LO and V_HI moves the thresholds
    v = await op('lm3914', { ...p, rref: 1000, entrada: 2.55, vlo: 2, vhi: 3 });
    expect(v('v(nled)')).toBeCloseTo(5, 9);
    cerca(v('i(vml)'), 5 * 0.0125, 1e-6);
    // exactly at a threshold (2,5 V: the fifth), the comparator counts as on, in the netlist and in the drawing
    v = await op('lm3914', { ...p, entrada: 2.5, vlo: 2, vhi: 3 });
    expect(v('v(nled)')).toBeCloseTo(5, 9);
    // the drawing lights what the netlist lights
    const { encendidos } = await import('../src/lib/leccion11/esquemas/lm3914/esquema.ts');
    expect(encendidos(ctx({ ...p, entrada: 0.56, barra: 0 }))).toEqual([false, false, false, true, false, false, false, false, false, false]);
  });
});

test('la comparación admite un borde a ± dx del salto del modelo, y nada más', () => {
  // a step at t = 0,5 in the model; the simulator's edge 0,002 late
  const t = Array.from({ length: 1001 }, (_, k) => k / 1000);
  const y = t.map((x) => (x < 0.502 ? 0 : 1));
  const curva = (dx?: number): CurvaEsperada => ({
    medida: 'v(o)', nombre: 'la curva 1', eje: 't', min: 0, max: 1, desfase: 0, modelo: (x) => (x < 0.5 ? 0 : 1), tol: () => 0.01, ...(dx ? { dx } : {}),
  });
  const g = [{ analisis: 'Transient Analysis', vectores: [{ nombre: 'time', re: t, im: null }, { nombre: 'v(o)', re: y, im: null }] }];
  const c = (dx?: number) => compararSimulacion({ donde: 'x', netlist: '', analisis: 'tran', valores: [], curvas: [curva(dx)] }, g);
  expect(c()).toHaveLength(1);
  expect(c(0.003)).toEqual([]);
  expect(c(0.001)).toHaveLength(1);
});

// ------------------------------------------------------------------------------------------------ esquemas12c
test.describe('esquemas12c frente a ngspice', () => {
  test.setTimeout(180_000);
  // the book's V_T at 300 K, the simulator's temperature (comun.ts VT_LIBRO)
  const VT = (1.380649e-23 * 300) / 1.602176634e-19;

  test('fuente-controlada invertida, bjt-interruptor con LED e iref, LED y diodo al revés', async () => {
    // the common emitter's sign: v_o = −g_m·v·(r_o ∥ R_L)
    let m = await op('fuente-controlada', { control: 0.01, gm: 0.04, ro: 100000, carga: 4700, invierte: 1 });
    cerca(m('v(s)'), -0.04 * 0.01 * ((100000 * 4700) / 104700), 1e-9);
    m = await op('fuente-controlada', { control: 0.01, av: 50, carga: 4700, invierte: 1 });
    cerca(m('v(s)'), -0.5, 1e-9);
    // Práctica 8 (sección 22.8): saturated, the LED drops about 2 V at 8,5 mA and V_CE(sat) is small
    m = await op('bjt-interruptor', { vcc: 5, rc: 330, vf: 2, entrada: 5, rb: 10000, beta: 100, vbe: 0.7, vcesat: 0.2 });
    const vled = m('v(k)') - m('v(c)');
    expect(Math.abs(vled - 2)).toBeLessThan(0.1);
    expect(m('v(c)')).toBeLessThan(0.2);
    cerca(m('i(vcm)'), (5 - vled - m('v(c)')) / 330, 1e-6);
    // a power switch (sección 26.3): V_BE = 0,7 V at iref = 0,5 A, so within ± 0,1 V at 30 mA of base current
    m = await op('bjt-interruptor', { vcc: 12, rc: 24, entrada: 5, rb: 150, beta: 25, vbe: 0.7, iref: 0.5 });
    expect(Math.abs(m('v(b)') - 0.7)).toBeLessThan(0.1);
    // the default (1 mA) would have been 0,1 V above at those currents
    const sin = await op('bjt-interruptor', { vcc: 12, rc: 24, entrada: 5, rb: 150, beta: 25, vbe: 0.7 });
    expect(sin('v(b)') - 0.7).toBeGreaterThan(0.1);
    // reversed: it blocks, the whole source across it
    m = await op('led', { fuente: 5, r: 150, vf: 2, reves: 1 });
    expect(Math.abs(m('i(vmed)'))).toBeLessThan(1e-9);
    cerca(m('v(an)'), 5, 1e-6);
    cerca(m('v(zrev)'), 2, 0);
    m = await op('diodo', { fuente: 5, r: 150, vd: 0.7, reves: 0 });
    expect(m('i(vmed)')).toBeGreaterThan(0.025);
  });

  test('entrada en rampa con ruido: e − A + 2A·(f·t − ⌊f·t⌋) más las tres senoidales a 37, 61 y 97·f', async () => {
    const p = { entrada: 0, amplitud: 2, f: 10, forma: 3, ruido: 0.3, r1: 10000, ref: 0.5, vsat: 12 };
    const s = await sim('comparador-schmitt', 'tran', p, '.tran 1e-5 0.1 0 1e-5 uic');
    const v = s.v('v(in)');
    for (const t of [0.013, 0.037, 0.061, 0.088]) {
      const k = s.eje.findIndex((x) => x >= t);
      const x = s.eje[k]!;
      const w = 2 * Math.PI * 10 * x;
      const esperado = -2 + 4 * (10 * x - Math.floor(10 * x)) + (0.3 * (Math.sin(37 * w) + Math.sin(61 * w) + Math.sin(97 * w))) / 3;
      cerca(v[k]!, esperado, 0, 2e-3);
    }
    // without hysteresis the noise makes the output chatter near the threshold: more than one edge per ramp
    expect(cruces(s.eje, s.v('v(out)'), 0, false).length).toBeGreaterThan(1);
  });

  test('comparador-no-inversor (problema 26.C): sube en 2,5975 V y baja en 2,4025 V', async () => {
    const s = await sim('comparador-no-inversor', 'tran', { entrada: 2.5, amplitud: 0.3, f: 1, forma: 2, r1: 3900, r2: 100000, ref: 2.5, vsat: 5, vsatneg: 0, alto: 0 }, '.tran 1e-4 2 0 1e-4 uic');
    const vin = s.v('v(in)');
    const en = (t: number) => vin[s.eje.findIndex((x) => x >= t)]!;
    const sube = cruces(s.eje, s.v('v(out)'), 2.5, true);
    const baja = cruces(s.eje, s.v('v(out)'), 2.5, false);
    expect(sube.length).toBe(2);
    expect(baja.length).toBe(2);
    for (const t of sube) cerca(en(t), 2.5975, 0, 2e-3);
    for (const t of baja) cerca(en(t), 2.4025, 0, 2e-3);
  });

  test('emisor-comun (sección 6.5 en alterna): I_C del libro, ganancia g_m·(R_C ∥ R_L) con C_E y ≈ (R_C ∥ R_L)/R_E sin él', async () => {
    const p = { vcc: 12, r1: 47000, r2: 10000, rc: 3300, re: 1000, ce: 100e-6, desvio: 1, beta: 100, vbe: 0.7, fuente: 0.01, f: 100000, carga: 10000 };
    const m = await op('emisor-comun', p);
    const ib = (12 * 10 / 57 - 0.7) / ((47000 * 10000) / 57000 + 101 * 1000);
    // (ngspice's own convergence: some 10⁻⁵)
    cerca(m('i(vcm)'), 100 * ib, 1e-4);
    cerca(m('v(b)') - m('v(e)'), 0.7, 0, 1e-4);
    const gm = (100 * ib) / VT;
    const rl = (3300 * 10000) / 13300;
    let ac = await sim('emisor-comun', 'ac', p, '.ac lin 1 100000 100000');
    // mid-band: |Z_E| of C_E is 16 mΩ, so the gain is g_m·R_L' within 0,1 %
    cerca(amp(ac, 'v(out)') / 0.01, gm * rl, 1e-3);
    ac = await sim('emisor-comun', 'ac', { ...p, desvio: 0 }, '.ac lin 1 100000 100000');
    cerca(amp(ac, 'v(out)') / 0.01, (100 * rl) / (100 / gm + 101 * 1000), 1e-4);
    // and inverting: 180°
    const fase = (Math.atan2(ac.im('v(out)')[0]!, ac.v('v(out)')[0]!) * 180) / Math.PI;
    expect(Math.abs(Math.abs(fase) - 180)).toBeLessThan(0.01);
  });

  test('par-diferencial: A_d = g_m·R_C/2, A_cm = β·R_C/(r_π + 2(β + 1)·R_EE) y el reparto tanh de la cola', async () => {
    const p = { vcc: 12, vee: 12, rc: 10000, ree: 10000, beta: 100, vbe: 0.7, v1: 0, v2: 0, ad: 0.01, f: 1000 };
    const ic = (100 / 101) * ((12 - 0.7) / 10000 / 2);
    const gm = ic / VT;
    let ac = await sim('par-diferencial', 'ac', p, '.ac lin 1 1000 1000');
    cerca(amp(ac, 'v(c2)'), (gm * 10000 * 0.01) / 2, 1e-6);
    ac = await sim('par-diferencial', 'ac', { ...p, ad: 0, acm: 1 }, '.ac lin 1 1000 1000');
    const acm = (100 * 10000) / (100 / gm + 2 * 101 * 10000);
    cerca(amp(ac, 'v(c1)'), acm, 1e-6);
    // CMRR ≈ g_m·R_EE (figura 44.12)
    cerca((gm * 10000) / 2 / acm, gm * 10000, 0.02);
    // an ideal tail: I_C1 = α·I/(1 + e^(−Δv/V_T))
    const m = await op('par-diferencial', { vcc: 12, vee: 12, rc: 1000, icola: 0.001, beta: 100, vbe: 0.7, v1: 0.03, v2: 0 });
    cerca(m('i(vcm1)'), ((100 / 101) * 0.001) / (1 + Math.exp(-0.03 / VT)), 1e-6);
  });

  test('etapa-clase-ab: reposo del libro con V_BB = V_BE·(1 + R₁/R₂), zona muerta de ±V_BE puenteado y la deriva térmica', async () => {
    const vbb = 0.65 * (1 + 659 / 650);
    const ie = (vbb - 1.3) / 0.44;
    const iq = (100 / 101) * ie;
    const p = { vcc: 35, entrada: -vbb / 2, ib: 0.015, r1: 659, r2: 650, re: 0.22, carga: 8, beta: 100, vbe: 0.65, iref: iq };
    let m = await op('etapa-clase-ab', p);
    cerca(m('v(b1)') - m('v(b2)'), vbb, 1e-5);
    cerca(m('i(vc1)'), iq, 2e-3);
    expect(Math.abs(m('v(out)'))).toBeLessThan(1e-3);
    // heated output transistors (−2 mV/°C, 30 °C: 60 mV less) with the multiplier off the heatsink: I_Q climbs
    m = await op('etapa-clase-ab', { ...p, vbe: 0.59, vbem: 0.65 });
    expect(m('i(vc1)')).toBeGreaterThan(3 * iq);
    // bridged (class B): nothing comes out while |v_in| < V_BE
    const s = await sim('etapa-clase-ab', 'tran', { ...p, entrada: 0, puente: 1, amplitud: 2, f: 1000 }, '.tran 1e-6 1e-3 0 1e-6 uic');
    const vo = s.v('v(out)');
    const vin = s.v('v(b2)');
    for (const [k, x] of vin.entries()) if (Math.abs(x) < 0.45) expect(Math.abs(vo[k]!), `v_in = ${x}`).toBeLessThan(0.02);
    expect(Math.max(...vo)).toBeGreaterThan(1.1);
  });

  test('ao-estabilidad (sección 27.8): 10 Hz y 1 MHz, seguidor con 52° de margen y un 16 % de sobreoscilación; C_L con R_o', async () => {
    const p = { entrada: 0, amplitud: 0.5, f: 10000, forma: 1, gbw: 1e6, polo2: 1e6 };
    const s = await sim('ao-estabilidad', 'tran', p, '.tran 2e-9 6e-5 0 2e-9 uic');
    const tras = s.eje.map((t, k) => [t, s.v('v(out)')[k]!] as const).filter(([t]) => t > 5e-5);
    const minimo = Math.min(...tras.map(([, v]) => v));
    // the step of −1 V from +0,5: overshoot below −0,5
    const z = (2 * Math.PI * 1e6 + 2 * Math.PI * 10) / (2 * Math.sqrt(2 * Math.PI * 10 * 2 * Math.PI * 1e6 * 100001));
    cerca((-0.5 - minimo) / 1, Math.exp((-Math.PI * z) / Math.sqrt(1 - z * z)), 0.01);
    // the loop gain: |T| = 1 near 786 kHz, phase margin 180° + arg T ≈ 52°
    const ac = await sim('ao-estabilidad', 'ac', p, '.ac dec 200 1e5 1e7');
    const mags = ac.eje.map((_, k) => Math.hypot(-ac.v('v(m_l)')[k]!, -(ac.im('v(m_l)')[k] ?? 0)));
    const k1 = mags.findIndex((x) => x < 1);
    const fase = (Math.atan2(-(ac.im('v(m_l)')[k1] ?? 0), -ac.v('v(m_l)')[k1]!) * 180) / Math.PI;
    cerca(180 + fase, 51.8, 0, 0.5);
    // R_o = 50 Ω with C_L = 1 nF: a third pole at 3,2 MHz (sección 27.10) that takes margin away
    const ac2 = await sim('ao-estabilidad', 'ac', { ...p, rsal: 50, cl: 1e-9 }, '.ac lin 1 3183098.86 3183098.86');
    const T = (f: number) => 1e5 / Math.sqrt((1 + (f / 10) ** 2) * (1 + (f / 1e6) ** 2) * 2);
    cerca(amp(ac2, 'v(m_l)'), T(3183098.86), 1e-3);
  });

  test('ao-instrumentacion, transimpedancia, mosfet-p, puerta-transmision, R_DS(on), lm317, sonda ×10 y la etiqueta de red', async () => {
    // G = 1 + 2R/R_G = 101 (sección 27.7), and ε/(2 + ε) of the common mode with a mismatch
    let m = await op('ao-instrumentacion', { v1: 2.5, v2: 2.51, r: 25000, rg: 500, r3: 10000, r4: 10000 });
    cerca(m('v(out)'), 1.01, 1e-4);
    const ac = await sim('ao-instrumentacion', 'ac', { v1: 0, v2: 0, acm: 1, f: 50, r: 25000, rg: 500, r3: 10000, r4: 10000, desajuste: 0.01 }, '.ac lin 1 50 50');
    cerca(amp(ac, 'v(out)'), 0.01 / 2.01, 1e-4);
    // transimpedance: −R_f·I
    m = await op('transimpedancia', { entrada: 1e-5, rf: 100000, cin: 1e-10, gbw: 1e6 });
    cerca(m('v(out)'), -1, 1e-4);
    // P channel: |V_GS| = 5 V, 2 mA/V², |V_th| = 2 V: 9 mA in saturation
    m = await op('mosfet-p', { vdd: 12, rd: 470, entrada: 7, k: 0.002, vth: 2 });
    cerca(m('i(vmd)'), 0.009, 1e-6);
    // the transmission gate's R_on with k_n = k_p: 1/(k·(V_DD − 2V_t)) wherever both conduct
    for (const vin of [1.5, 2.5, 3.5]) {
      m = await op('puerta-transmision', { vdd: 5, entrada: vin, carga: 10000, kn: 0.001, vtn: 1, kp: 0.001, vtp: 1 });
      cerca((vin - m('v(o)')) / m('i(vmi)'), 1 / (0.001 * 3), 1e-6);
    }
    // R_DS(on) from the table: 12 V, 10 Ω, 36 mΩ
    m = await op('mosfet', { vdd: 12, rd: 10, entrada: 4.5, k: 20, vth: 2, rdson: 0.036 });
    cerca(m('v(d)'), (12 * 0.036) / 10.036, 1e-6);
    // LM317: 1,25·(1 + 720/240) + 50 µA·720 Ω = 5,036 V; in dropout, V_in − 2 V
    m = await op('lm317', { entrada: 9, r1: 240, r2: 720, iadj: 5e-5, dropout: 2, carga: 50 });
    cerca(m('v(out)'), 5.036, 1e-4);
    m = await op('lm317', { entrada: 6, r1: 240, r2: 720, iadj: 5e-5, dropout: 2, carga: 50 });
    cerca(m('v(out)'), 4, 1e-4);
    // the ×10 probe compensated (R₁·C₁ = R₂·C₂): a flat 0,1 V right after the edge
    const s = await sim('sonda-x10', 'tran', { entrada: 1, f: 1000, r1: 9e6, c1: 11e-12, r2: 1e6, c2: 99e-12 }, '.tran 1e-7 4e-4 0 1e-7 uic');
    for (const [k, t] of s.eje.entries()) if (t > 1e-6) cerca(s.v('v(out)')[k]!, 0.1, 0, 1e-3);
    // a misspelt net label leaves the load out
    m = await op('divisor', { fuente: 12, arriba: 10000, abajo: 10000, carga: 10000, etiqueta: 0 });
    cerca(m('v(salida)'), 6, 1e-6);
    m = await op('divisor', { fuente: 12, arriba: 10000, abajo: 10000, carga: 10000, union: 1 });
    cerca(m('v(salida)'), 4, 1e-6);
  });
});
