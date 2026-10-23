// SPICE netlist from a schematic's topology (datos/NAME.json, «esquemas[]»), with the same rules as the book's
// generator (v3/figuras/simular_esquema.py, `netlist()`), so that the sliders of a live schematic can change a
// component value and re-run it in the app's ngspice worker. With the book's values the text is identical to
// `simulacion.netlist` (checked by tests/figuras-vivas.spec.ts).
//
// Every element terminal gets a 0 V source in series (its current, positive INTO the element at that terminal)
// and every wire segment another one (positive from its first point to its last). Ground symbols are tied to
// node 0 through a 0 V source; Vdd/Vss rails are DC sources from their point to 0.

import type { Elemento, Esquema } from '../tipos';

export const MODELOS: Record<string, string> = {
  D1N4148: '.model D1N4148 D(IS=2.52n RS=0.568 N=1.752 CJO=4p M=0.4 TT=20n BV=100 IBV=100u)',
  D1N4007:
    '.model D1N4007 D(IS=7.02767n RS=0.0341512 N=1.80803 EG=1.05743 XTI=5 BV=1000 IBV=5e-08 ' +
    'CJO=1e-11 VJ=0.7 M=0.5 FC=0.5 TT=1e-07)',
  DSCHOTTKY: '.model DSCHOTTKY D(IS=1u N=1.05 RS=0.05 BV=40 IBV=1m CJO=100p)',
  DLED: '.model DLED D(IS=1e-18 N=1.9 RS=5)',
  Q2N3904:
    '.model Q2N3904 NPN(IS=6.734f XTI=3 EG=1.11 VAF=74.03 BF=416.4 NE=1.259 ISE=6.734f IKF=66.78m ' +
    'XTB=1.5 BR=.7371 NC=2 ISC=0 IKR=0 RC=1 CJC=3.638p MJC=.3085 VJC=.75 FC=.5 CJE=4.493p MJE=.2593 ' +
    'VJE=.75 TR=239.5n TF=301.2p ITF=.4 VTF=4 XTF=2 RB=10)',
  Q2N3906:
    '.model Q2N3906 PNP(IS=1.41f XTI=3 EG=1.11 VAF=18.7 BF=180.7 NE=1.5 ISE=0 IKF=80m XTB=1.5 ' +
    'BR=4.977 NC=2 ISC=0 IKR=0 RC=2.5 CJC=9.728p MJC=.5776 VJC=.75 FC=.5 CJE=8.063p MJE=.3677 VJE=.75 ' +
    'TR=33.42n TF=179.3p ITF=.4 VTF=4 XTF=6 RB=10)',
  NGEN: '.model NGEN NMOS(LEVEL=1 VTO=2 KP=0.5)',
  PGEN: '.model PGEN PMOS(LEVEL=1 VTO=-2 KP=0.5)',
  JNGEN: '.model JNGEN NJF(VTO=-2 BETA=1m LAMBDA=0.01)',
  JPGEN: '.model JPGEN PJF(VTO=2 BETA=1m LAMBDA=0.01)',
};

export const FUENTES = new Set(['V', 'V?', 'BAT', 'I', 'VSIN', 'VPULSE', 'VTRI', 'RAIL']);
export const ONDAS = new Set(['VSIN', 'VPULSE', 'VTRI']);
/** Samples per period and periods kept of a transient (the last ones of 5 simulated). */
export const PUNTOS_PERIODO = 100;
export const PERIODOS = 2;

/** Python's `f'{v:.6g}'`: the number format of the generator. */
export function sp(v: number): string {
  if (v === 0 || Object.is(v, -0)) return '0';
  if (!Number.isFinite(v)) return String(v);
  const exp = v.toExponential(5);
  const [m, e] = exp.split('e') as [string, string];
  const ex = Number(e);
  if (ex >= -4 && ex < 6) {
    let t = v.toFixed(Math.max(0, 5 - ex));
    if (t.includes('.')) t = t.replace(/0+$/, '').replace(/\.$/, '');
    return t;
  }
  const mm = m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m;
  return `${mm}e${ex < 0 ? '-' : '+'}${String(Math.abs(ex)).padStart(2, '0')}`;
}

/** Values the sliders change: element id → value (in the element's unit), and source frequencies. */
export interface Cambios {
  valor?: Record<string, number>;
  frecuencia?: Record<string, number>;
  /** Current of a load labelled only with its current (A). */
  carga?: Record<string, number>;
}

export interface MetaNetlist {
  /** [element id, terminal] → name of its 0 V ammeter. */
  term: Map<string, string>;
  tramo: Map<string, string>;
  gnd: [string | null, string][];
  rail: Map<string, string>;
  /** Lowest source frequency (Hz), when there is a sine, square or triangle source. */
  freq: number | null;
}

export const claveTerm = (id: string, n: string) => `${id}|${n}`;

const nombre = (e: Elemento) => e.id.toLowerCase();
const nodo = (pid: string) => pid.toLowerCase();
const T = (e: Elemento, n: string) => `${nombre(e)}_${n.toLowerCase()}`;

/** Elements that go into the netlist (no wires, dots, annotations or dashed optional parts). */
export function elementosCircuito(esq: Esquema): Elemento[] {
  return esq.elementos.filter(
    (e) => !['ANOT', 'WIRE', 'DOT'].includes(e.rol) && !(e.discontinuo && e.rol !== 'GND' && e.rol !== 'RAIL'),
  );
}

/** Current of a load drawn as a resistor and labelled only with its current («carga 100 mA»). */
export function cargaDe(e: Elemento): number | null {
  if (e.carga_corriente != null) return e.carga_corriente;
  if (e.rol === 'R' && e.valor == null && e.valores && 'A' in e.valores) return e.valores['A']!;
  return null;
}

/** Frequency of a sine/square/triangle source as the generator reads it (1 kHz, or 50 Hz for mains). */
export function frecuenciaOriginal(e: Elemento): number {
  const f = e.valores?.['Hz'];
  if (f != null) return f;
  return Math.abs(e.valor ?? 0) >= 100 ? 50 : 1000;
}

/**
 * Peak amplitude per unit of the labelled value: «pp» halves it, «ef»/«rms» and mains voltages (≥ 100 V at
 * 50/60 Hz) are RMS. Decided from the book's value, so a slider never flips the interpretation.
 */
export function factorAmplitud(e: Elemento): number {
  const mod = (e.modificador ?? '').toLowerCase();
  if (mod === 'pp') return 0.5;
  if (mod === 'ef' || mod === 'rms') return Math.SQRT2;
  if (mod === 'p' || mod === 'pk' || mod === 'pico') return 1;
  if (Math.abs(e.valor ?? 0) >= 100 && [50, 60].includes(frecuenciaOriginal(e))) return Math.SQRT2;
  return 1;
}

function onda(e: Elemento, v: number, cambios: Cambios): [number, number] {
  const f = cambios.frecuencia?.[e.id] ?? frecuenciaOriginal(e);
  const k = factorAmplitud(e);
  // Same arithmetic as the generator (v / 2, v * sqrt(2)) so the text matches it with the book's values.
  const amp = k === 0.5 ? v / 2 : k === 1 ? v : v * Math.SQRT2;
  return [amp, f];
}

function modeloDiodo(e: Elemento, modelos: Set<string>): string {
  const ref = (e.referencia ?? '').toUpperCase();
  if (e.rol === 'DZ') {
    const bv = e.valor!;
    const m = `DZ${sp(bv).replace('.', 'V')}`;
    modelos.add(`.model ${m} D(IS=1e-14 N=1 BV=${sp(bv)} IBV=1m NBV=0.02 RS=0)`);
    return m;
  }
  const m = e.rol === 'LED' ? 'DLED' : ref.startsWith('1N400') ? 'D1N4007' : e.clase === 'Schottky' ? 'DSCHOTTKY' : 'D1N4148';
  modelos.add(m);
  return m;
}

/**
 * The netlist of a simulable schematic, optionally with changed values. Throws (Error with a Spanish message)
 * when the topology cannot be translated.
 */
export function generarNetlist(esq: Esquema, cambios: Cambios = {}): { texto: string; meta: MetaNetlist } {
  const els = elementosCircuito(esq);
  const val = (e: Elemento): number => cambios.valor?.[e.id] ?? e.valor!;
  const lineas = [`* esquema generado automáticamente desde el dibujo (eje ${esq.eje})`];
  const meta: MetaNetlist = { term: new Map(), tramo: new Map(), gnd: [], rail: new Map(), freq: null };
  const modelos = new Set<string>();

  const gnds = els.filter((e) => e.rol === 'GND' && e.puntos_terminal && 'start' in e.puntos_terminal);
  for (const e of gnds) {
    const n = `vg_${nombre(e)}`;
    lineas.push(`${n} ${nodo(e.puntos_terminal!['start']!)} 0 0`);
    meta.gnd.push([e.id, n]);
  }
  if (!gnds.length) {
    const rails = els.filter((e) => e.rol === 'RAIL');
    const src = els.find((e) => ['V', 'V?', 'BAT', 'VSIN', 'VPULSE', 'VTRI'].includes(e.rol));
    const isrc = els.find((e) => e.rol === 'I');
    if (!rails.length) {
      if (src || isrc) {
        const ref = (src ?? isrc)!;
        const term = src ? src.polaridad!['negativo']! : isrc!.polaridad!['entra']!;
        lineas.push(`vg_ref ${nodo(ref.puntos_terminal![term]!)} 0 0`);
        meta.gnd.push([null, 'vg_ref']);
      } else throw new Error('sin masa: no hay símbolo de masa ni fuente que la defina');
    }
  }

  // Wire segments: 0 V ammeters; a series resistance (1 µΩ per unit) only where wires form a loop.
  const padre = new Map<string, string>();
  const raiz = (a: string): string => {
    if (!padre.has(a)) padre.set(a, a);
    while (padre.get(a) !== a) {
      padre.set(a, padre.get(padre.get(a)!)!);
      a = padre.get(a)!;
    }
    return a;
  };
  const lazo = new Set<string>();
  for (const t of esq.tramos) {
    const ra = raiz(t.de);
    const rb = raiz(t.a);
    if (ra === rb) lazo.add(t.nodo);
    else padre.set(ra, rb);
  }
  for (const t of esq.tramos) {
    const n = `vt_${t.id.toLowerCase()}`;
    if (lazo.has(t.nodo)) {
      const mid = `${t.id.toLowerCase()}_r`;
      lineas.push(`${n} ${nodo(t.de)} ${mid} 0`);
      lineas.push(`rt_${t.id.toLowerCase()} ${mid} ${nodo(t.a)} ${sp(Math.max(1e-7, 1e-6 * (t.longitud || 0)))}`);
    } else lineas.push(`${n} ${nodo(t.de)} ${nodo(t.a)} 0`);
    meta.tramo.set(t.id, n);
  }

  for (const e of els) {
    const r = e.rol;
    if (r === 'GND') continue;
    const tp = e.puntos_terminal ?? {};
    if (r === 'RAIL') {
      const n = `vr_${nombre(e)}`;
      lineas.push(`${n} ${nodo(tp['start']!)} 0 DC ${sp(val(e))}`);
      meta.rail.set(e.id, n);
      continue;
    }
    for (const [n, pid] of Object.entries(tp)) {
      const nm = `va_${nombre(e)}_${n.toLowerCase()}`;
      lineas.push(`${nm} ${nodo(pid)} ${T(e, n)} 0`);
      meta.term.set(claveTerm(e.id, n), nm);
    }
    const x = nombre(e);
    const pol = e.polaridad ?? {};
    const carga = cargaDe(e);
    if (r === 'R' && carga != null) {
      lineas.push(`i_${x} ${T(e, 'start')} ${T(e, 'end')} DC ${sp(cambios.carga?.[e.id] ?? carga)}`);
    } else if (r === 'R') lineas.push(`r_${x} ${T(e, 'start')} ${T(e, 'end')} ${sp(val(e))}`);
    else if (r === 'POT') {
      lineas.push(`r_${x}a ${T(e, 'start')} ${T(e, 'tap')} ${sp(val(e) / 2)}`);
      lineas.push(`r_${x}b ${T(e, 'tap')} ${T(e, 'end')} ${sp(val(e) / 2)}`);
    } else if (r === 'C' || r === 'VAR') lineas.push(`c_${x} ${T(e, 'start')} ${T(e, 'end')} ${sp(val(e))}`);
    else if (r === 'L') lineas.push(`l_${x} ${T(e, 'start')} ${T(e, 'end')} ${sp(val(e))}`);
    else if (r === 'V' || r === 'V?' || r === 'BAT')
      lineas.push(`v_${x} ${T(e, pol['positivo']!)} ${T(e, pol['negativo']!)} DC ${sp(val(e))}`);
    else if (r === 'I') lineas.push(`i_${x} ${T(e, pol['entra']!)} ${T(e, pol['sale']!)} DC ${sp(val(e))}`);
    else if (ONDAS.has(r)) {
      const [amp, f] = onda(e, val(e), cambios);
      meta.freq = meta.freq == null ? f : Math.min(meta.freq, f);
      const per = 1 / f;
      let w: string;
      if (r === 'VSIN') w = `SIN(0 ${sp(amp)} ${sp(f)})`;
      else if (r === 'VPULSE')
        w = `PULSE(0 ${sp(amp)} 0 ${sp(per / 1000)} ${sp(per / 1000)} ${sp(per / 2 - per / 1000)} ${sp(per)})`;
      else w = `PULSE(${sp(-amp)} ${sp(amp)} 0 ${sp(per / 2)} ${sp(per / 2)} 0 ${sp(per)})`;
      lineas.push(`v_${x} ${T(e, pol['positivo']!)} ${T(e, pol['negativo']!)} DC 0 ${w}`);
    } else if (r === 'D' || r === 'DZ' || r === 'LED') {
      const m = modeloDiodo(e, modelos);
      lineas.push(`d_${x} ${T(e, pol['anodo']!)} ${T(e, pol['catodo']!)} ${m}`);
    } else if (r === 'QN' || r === 'QP') {
      const m = r === 'QN' ? 'Q2N3904' : 'Q2N3906';
      modelos.add(m);
      lineas.push(`q_${x} ${T(e, 'collector')} ${T(e, 'base')} ${T(e, 'emitter')} ${m}`);
    } else if (r === 'MN' || r === 'MP') {
      const m = r === 'MN' ? 'NGEN' : 'PGEN';
      modelos.add(m);
      lineas.push(`m_${x} ${T(e, 'drain')} ${T(e, 'gate')} ${T(e, 'source')} ${T(e, 'source')} ${m}`);
    } else if (r === 'JN' || r === 'JP') {
      const m = r === 'JN' ? 'JNGEN' : 'JPGEN';
      modelos.add(m);
      lineas.push(`j_${x} ${T(e, 'drain')} ${T(e, 'gate')} ${T(e, 'source')} ${m}`);
    } else if (r === 'OA') {
      for (const n of ['in1', 'in2', 'out'])
        if (!(n in tp)) throw new Error(`amplificador operacional ${e.id} sin el terminal ${n} conectado`);
      lineas.push(`e_${x}d ${x}_x 0 ${T(e, 'in2')} ${T(e, 'in1')} 1`);
      lineas.push(`r_${x}p ${x}_x ${x}_y 1k`);
      lineas.push(`c_${x}p ${x}_y 0 ${sp(1 / (2 * Math.PI * 1e3 * 10))}`);
      let expr: string;
      if ('vd' in tp && 'vs' in tp) {
        const vp = `v(${T(e, 'vd')})`;
        const vn = `v(${T(e, 'vs')})`;
        const half = `((${vp}-${vn}-1)/2)`;
        expr = `(${vp}+${vn})/2 + ${half}*tanh(1e5*v(${x}_y)/${half})`;
      } else expr = `14*tanh(1e5*v(${x}_y)/14)`;
      lineas.push(`b_${x} ${x}_z 0 V = ${expr}`);
      lineas.push(`r_${x}o ${x}_z ${T(e, 'out')} 10`);
    } else if (r === 'SW') {
      const cerrado = e.estado === 'cerrado';
      lineas.push(`r_${x} ${T(e, 'start')} ${T(e, 'end')} ${cerrado ? '1m' : '1e12'}`);
    } else if (r === 'LAMP' || r === 'SPK') {
      lineas.push(
        `r_${x} ${T(e, r === 'LAMP' ? 'start' : 'in1')} ${T(e, r === 'LAMP' ? 'end' : 'in2')} ${sp(val(e))}`,
      );
    } else if (r === 'FUSE') lineas.push(`r_${x} ${T(e, 'start')} ${T(e, 'end')} 10m`);
    else if (r === 'AM') lineas.push(`r_${x} ${T(e, 'start')} ${T(e, 'end')} 1m`);
    else if (r === 'VM') lineas.push(`r_${x} ${T(e, 'start')} ${T(e, 'end')} 10Meg`);
    else throw new Error(`rol sin traducir ${r} (${e.id})`);
  }
  const cab = ['.options rshunt=1e12', ...[...modelos].sort().map((m) => MODELOS[m] ?? m)];
  const texto = [lineas[0]!, ...cab, ...lineas.slice(1)].join('\n') + '\n';
  return { texto, meta };
}

/** The analyses the generator runs: operating point, and the transient of 5 periods for AC/square sources. */
export function bloqueControl(meta: MetaNetlist): string {
  const ctl = ['.control', 'op'];
  if (meta.freq) {
    const per = 1 / meta.freq;
    const paso = per / PUNTOS_PERIODO;
    ctl.push(`tran ${sp(paso / 4)} ${sp(5 * per)} ${sp((5 - PERIODOS) * per)} ${sp(paso / 4)}`);
  }
  ctl.push('.endc', '.end');
  return ctl.join('\n') + '\n';
}
