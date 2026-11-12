// 1.1 lessons: the cross-check of a circuit widget against the app's ngspice. The generator (generar.ts) builds, for
// each state it checks (the card's start, both ends of every control, every `comprobar`), one netlist per analysis the
// widget needs and what the lesson's model says each measure must give; web/scripts/lecciones11.mjs runs them and
// `compararSimulacion` says what does not match. Pure.
//
// Tolerances (contenido/lecciones11/GUIA.md §5, «Cómo se comprueba con el simulador»):
//   - a DC reading (op) and an AC reading at one frequency: 0,1 % of the value (as 1.0);
//   - a curve against time (tran): 1 % of the height of the graph's y axis — the simulator's time step is a
//     thousandth of the axis, so its own error is far smaller; what is left is the model's;
//   - a curve against frequency (ac): amplitude 0,1 % (+ 0,01 % of the axis), phase 0,1°, dB 0,01 dB;
//   - plus, for each piece in the book's constant-drop approximation (esquemas/tipos.ts NoLineal), its deviation
//     (volts) times the reading's sensitivity to that piece, computed from the author's model by finite differences;
//   - and never less than 1 nA or 1 µV: ngspice puts GMIN (10⁻¹² S) across every junction, so a diode that the
//     model says carries nothing (reverse biased, a Zener below V_Z) leaks picoamperes in the simulator.

import { num } from './esquemas/comun';
import type { Analisis, ContextoNetlist, DefinicionEsquema } from './esquemas/tipos';
import type { ModeloCompilado, Valores } from './modelo';
import type { WidgetCircuito } from './tipos';

export const TOL_OP = 1e-3;
export const TOL_TRAN = 0.01;
export const TOL_AC = 1e-3;
export const TOL_AC_FASE = 0.1;
export const TOL_AC_DB = 0.01;
/** Absolute floor of a tolerance by unit (GMIN leakage). */
export const PISO: Record<string, number> = { A: 1e-9, V: 1e-6 };

export interface ValorEsperado {
  /** «v(salida)», «v(a)-v(b)», «i(vmed)». */
  medida: string;
  ac?: 'mag' | 'fase' | 'db';
  esperado: number;
  /** Absolute tolerance. */
  tol: number;
  /** Constant drops the reading depends on: expected += pendiente·(simulated drop − base); |drop − base| ≤ max. */
  correcciones?: Correccion[];
}

export interface Correccion {
  pieza: string;
  medida: string;
  base: number;
  pendiente: number;
  max: number;
}

export interface CurvaEsperada {
  medida: string;
  ac?: 'mag' | 'fase' | 'db';
  /** «la curva 1 (v_C)». */
  nombre: string;
  /** The axis' variable («t», «f») and its range: points outside are not compared. */
  eje: string;
  min: number;
  max: number;
  /** Simulated time before the axis starts (whole periods): the model is compared at t − desfase. */
  desfase: number;
  modelo: (x: number) => number;
  tol: (x: number) => number;
  /**
   * 1.2 (esquemas12): how far along the axis a switching edge may be (tipos.ts tran.bordes): the simulator's value is
   * compared with the range the model covers within ± dx (sampled at nine points), so a jump the model draws at x
   * matches the simulator's edge a step or two away; 0 or absent, a point-by-point comparison.
   */
  dx?: number;
}

export interface ComprobacionSpice {
  donde: string;
  netlist: string;
  analisis: Analisis;
  valores: ValorEsperado[];
  curvas: CurvaEsperada[];
}

/** What the comparison needs of a simulator plot (simulador/motor/nucleo.ts Grafica). */
export interface GraficaSim {
  analisis: string;
  vectores: { nombre: string; re: ArrayLike<number>; im: ArrayLike<number> | null }[];
}

/** «v(a)-v(b)» → [+1 v(a)], [−1 v(b)]; «v(s)-7*i(vz)» → [+1 v(s)], [−7 i(vz)]; null if it is not a sum of vectors. */
export function terminos(medida: string): { signo: number; vector: string }[] | null {
  const s = medida.replace(/\s+/g, '').toLowerCase();
  const out: { signo: number; vector: string }[] = [];
  const re = /([+-]?)(?:(\d+(?:\.\d*)?(?:e[+-]?\d+)?)\*)?([vi]\([a-z0-9_#.]+\))/gy;
  let m: RegExpExecArray | null;
  let fin = 0;
  while ((m = re.exec(s))) {
    if (out.length && !m[1]) return null;
    out.push({ signo: (m[1] === '-' ? -1 : 1) * (m[2] ? Number(m[2]) : 1), vector: m[3]! });
    fin = re.lastIndex;
  }
  return out.length && fin === s.length ? out : null;
}

const PATRON: Record<Analisis, RegExp> = { op: /operating/i, tran: /transient/i, ac: /\bac\b/i };

/** The value of a measure at point k of a plot (null if a vector is missing). */
function medir(g: GraficaSim, medida: string, ac: ValorEsperado['ac'], k: number): number | null {
  const ts = terminos(medida);
  if (!ts) return null;
  let re = 0;
  let im = 0;
  for (const t of ts) {
    const v = g.vectores.find((x) => x.nombre.toLowerCase() === t.vector);
    if (!v) return null;
    re += t.signo * (v.re[k] ?? NaN);
    im += t.signo * (v.im?.[k] ?? 0);
  }
  if (!ac) return re;
  if (ac === 'fase') return (Math.atan2(im, re) * 180) / Math.PI;
  const mag = Math.hypot(re, im);
  return ac === 'db' ? 20 * Math.log10(mag) : mag;
}

const etiqueta = (medida: string, ac: ValorEsperado['ac']) => (ac ? `${ac}(${medida})` : medida);
const p4 = (x: number) => Number(x.toPrecision(4));

/** The errors of one check (empty when the simulator agrees with the model). */
export function compararSimulacion(c: ComprobacionSpice, graficas: readonly GraficaSim[]): string[] {
  const g = graficas.find((x) => PATRON[c.analisis].test(x.analisis));
  if (!g) return [`${c.donde}: el simulador no ha hecho el análisis ${c.analisis} (¿netlist mal formada?)`];
  const out: string[] = [];
  const avisadas = new Set<string>();
  for (const v of c.valores) {
    const real = medir(g, v.medida, v.ac, 0);
    if (real == null || !Number.isFinite(real)) {
      out.push(`${c.donde}: el simulador no da ${etiqueta(v.medida, v.ac)}`);
      continue;
    }
    // the book's constant drops: the model corrected by what the simulator's device really drops
    let esperado = v.esperado;
    let roto = false;
    for (const k of v.correcciones ?? []) {
      const caida = medir(g, k.medida, undefined, 0);
      if (caida == null || !Number.isFinite(caida)) {
        out.push(`${c.donde}: el simulador no da ${k.medida}`);
        roto = true;
        continue;
      }
      esperado += k.pendiente * (caida - k.base);
      if (Math.abs(caida - k.base) > k.max && !avisadas.has(k.pieza)) {
        avisadas.add(k.pieza);
        out.push(`${c.donde}: «${k.pieza}» supone ${k.base} V y el dispositivo del simulador cae ${p4(caida)} V: más de los ${k.max} V que admite la aproximación del libro (¿un punto de trabajo con muy poca o demasiada corriente, o en el borde entre dos regiones?)`);
      }
    }
    if (roto) continue;
    if (Math.abs(real - esperado) > v.tol)
      out.push(`${c.donde}: el modelo da ${v.esperado}${esperado !== v.esperado ? ` (${p4(esperado)} con la caída real del simulador)` : ''} y el simulador ${etiqueta(v.medida, v.ac)} = ${real}`);
  }
  const escala = g.vectores[0];
  for (const cv of c.curvas) {
    if (!escala) {
      out.push(`${c.donde}: el análisis ${c.analisis} no tiene eje`);
      break;
    }
    let peor: { x: number; m: number; s: number; tol: number; d: number } | null = null;
    let puntos = 0;
    for (let k = 0; k < escala.re.length; k++) {
      const x = escala.re[k]! - cv.desfase;
      const eps = 1e-9 * Math.max(Math.abs(cv.max), Math.abs(cv.min), 1e-30);
      if (x < cv.min - eps || x > cv.max + eps) continue;
      const s = medir(g, cv.medida, cv.ac, k);
      if (s == null) {
        out.push(`${c.donde}: el simulador no da ${etiqueta(cv.medida, cv.ac)}`);
        peor = null;
        puntos = -1;
        break;
      }
      puntos++;
      const m = cv.modelo(x);
      let d = Math.abs(m - s);
      if (cv.ac === 'fase') d = Math.abs(((m - s + 540) % 360) - 180);
      else if (cv.dx && cv.dx > 0 && d > cv.tol(x)) {
        // an edge: the distance to the range the model covers within ± dx
        let lo = m;
        let hi = m;
        for (let j = -4; j <= 4; j++) {
          const v = cv.modelo(x + (cv.dx * j) / 4);
          if (Number.isFinite(v)) {
            lo = Math.min(lo, v);
            hi = Math.max(hi, v);
          }
        }
        d = s < lo ? lo - s : s > hi ? s - hi : 0;
      }
      const tol = cv.tol(x);
      if (!(d <= tol) && (!peor || d / tol > peor.d / peor.tol)) peor = { x, m, s, tol, d };
    }
    if (puntos === 0) out.push(`${c.donde}: ${cv.nombre}: el simulador no da ningún punto entre ${cv.eje} = ${cv.min} y ${cv.max}`);
    else if (peor) out.push(`${c.donde}: ${cv.nombre}: en ${cv.eje} = ${p4(peor.x)} el modelo da ${p4(peor.m)} y el simulador ${etiqueta(cv.medida, cv.ac)} = ${p4(peor.s)} (tolerancia ${p4(peor.tol)})`);
  }
  return out;
}

// ------------------------------------------------------------------ the checks of a circuit widget

/** The netlist context of a state: the pieces' values in the model's evaluation `r`. */
export function contextoNetlist(w: Pick<WidgetCircuito, 'piezas'>, r: Valores): ContextoNetlist {
  const id = (q: string) => w.piezas[q];
  return {
    p: (q) => {
      const k = id(q);
      return k ? (r[k] ?? 0) : 0;
    },
    tiene: (q) => q in w.piezas,
    cerrado: (q) => {
      const k = id(q);
      return !k || (r[k] ?? 0) !== 0;
    },
  };
}

/** A whole netlist: title, the schematic's lines, the analysis card. */
export function montarNetlist(def: DefinicionEsquema, c: ContextoNetlist, analisis: Analisis, tarjeta: string): string {
  return [`* leccion11 ${def.nombre}`, ...def.netlist(c, analisis), tarjeta, '.end'].join('\n');
}

/**
 * The ngspice checks of a circuit widget in each state: the readings `mide` (DC, or AC at the piece «f») and the
 * curves of its graph that measure the schematic (transient or AC sweep), with the tolerances above.
 */
export function comprobacionesCircuito(def: DefinicionEsquema, w: WidgetCircuito, mide: Record<string, string>, mc: ModeloCompilado, estados: readonly Valores[], donde: string): ComprobacionSpice[] {
  const out: ComprobacionSpice[] = [];
  const nl = (def.noLineal?.((k) => k in w.piezas) ?? []).filter((n) => w.piezas[n.pieza]);
  estados.forEach((st, k) => {
    const r = mc.evaluar(st);
    const c = contextoNetlist(w, r);
    const dk = `${donde} (estado ${k + 1})`;
    // the model with each constant drop moved by ±h: a reading's sensitivity to the approximation
    const h = 1e-3;
    const movidos = nl.map((n) => {
      const id = w.piezas[n.pieza]!;
      const v0 = st[id] ?? r[id] ?? 0;
      return { n, mas: mc.evaluar({ ...st, [id]: v0 + h }), menos: mc.evaluar({ ...st, [id]: v0 - h }) };
    });
    const pendiente = (m: (typeof movidos)[number], f: (e: Valores) => number) => (f(m.mas) - f(m.menos)) / (2 * h);
    const holgura = (f: (e: Valores) => number, sinMedida = false) =>
      movidos.reduce((a, m) => a + (sinMedida && m.n.medida ? 0 : Math.abs(pendiente(m, f)) * m.n.desviacion), 0);
    for (const an of ['op', 'ac'] as const) {
      const lecturas = Object.entries(mide).filter(([o]) => def.observables[o]?.analisis === an);
      if (!lecturas.length) continue;
      const valores = lecturas.map(([o, q]): ValorEsperado => {
        const ob = def.observables[o]!;
        const esperado = r[q]!;
        const base = ob.ac === 'fase' ? TOL_AC_FASE : ob.ac === 'db' ? TOL_AC_DB : (an === 'op' ? TOL_OP : TOL_AC) * Math.max(Math.abs(esperado), 1e-9);
        // a DC reading corrects for the devices whose real drop the simulator reads; the others leave room
        const corregir = an === 'op';
        const correcciones: Correccion[] = corregir
          ? movidos
              .filter((m) => m.n.medida && Math.abs(pendiente(m, (e) => e[q]!)) > 1e-12)
              .map((m) => ({ pieza: m.n.pieza, medida: m.n.medida!(c), base: st[w.piezas[m.n.pieza]!] ?? r[w.piezas[m.n.pieza]!] ?? 0, pendiente: pendiente(m, (e) => e[q]!), max: m.n.desviacion }))
          : [];
        const tol = Math.max(base + holgura((e) => e[q]!, corregir), ob.ac === 'fase' ? 0 : (PISO[ob.unidad] ?? 0));
        return { medida: ob.medida, ...(ob.ac ? { ac: ob.ac } : {}), esperado, tol, ...(correcciones.length ? { correcciones } : {}) };
      });
      const f = c.p('f');
      out.push({ donde: dk, analisis: an, netlist: montarNetlist(def, c, an, an === 'op' ? '.op' : `.ac lin 1 ${num(f)} ${num(f)}`), valores, curvas: [] });
    }
    const g = w.grafica;
    const medidas = (g?.curvas ?? []).map((cv, j) => ({ cv, j, ob: cv.mide ? def.observables[cv.mide] : undefined })).filter((x) => x.ob);
    if (!g || !medidas.length) return;
    const an = medidas[0]!.ob!.analisis as 'tran' | 'ac';
    const xid = g.x.id;
    const ancho = g.x.max - g.x.min;
    const alto = g.y.max - g.y.min;
    let tarjeta: string;
    let desfase = 0;
    if (an === 'tran') {
      const periodos = def.tran?.periodos?.(c) ?? 0;
      const f = c.p('f');
      desfase = periodos > 0 && f > 0 ? periodos / f : 0;
      const paso = ancho / 1000;
      tarjeta = `.tran ${num(paso)} ${num(desfase + g.x.max)} ${num(desfase + g.x.min)} ${num(paso)} uic`;
    } else tarjeta = g.x.escala === 'log' ? `.ac dec 40 ${num(g.x.min)} ${num(g.x.max)}` : `.ac lin 400 ${num(g.x.min)} ${num(g.x.max)}`;
    const curvas = medidas.map(({ cv, j, ob }): CurvaEsperada => {
      const fn = mc.funcion(cv.expr);
      const en = (e: Valores, x: number) => fn({ ...e, [xid]: x });
      const base = (m: number) =>
        an === 'tran'
          ? TOL_TRAN * alto
          : ob!.ac === 'fase'
            ? TOL_AC_FASE
            : ob!.ac === 'db'
              ? TOL_AC_DB
              : // (esquemas12: on a log y axis the floor is 0,01 % of its bottom, not of its height — 0,01 to 10 kΩ of an
                // impedance made the floor 1 Ω, more than the whole dip of a decoupling capacitor)
                TOL_AC * Math.abs(m) + 1e-4 * (g.y.escala === 'log' ? Math.max(g.y.min, 0) : alto);
      return {
        medida: ob!.medida,
        ...(ob!.ac ? { ac: ob!.ac } : {}),
        nombre: `la curva ${j + 1} (${cv.mide})`,
        eje: xid,
        min: g.x.min,
        max: g.x.max,
        desfase,
        modelo: (x) => en(r, x),
        tol: (x) => Math.max(base(en(r, x)) + holgura((e) => en(e, x)), ob!.ac === 'fase' ? 0 : (PISO[ob!.unidad] ?? 0)),
        ...(an === 'tran' && def.tran?.bordes?.(c) ? { dx: def.tran.bordes(c) * ancho } : {}),
      };
    });
    out.push({ donde: dk, analisis: an, netlist: montarNetlist(def, c, an, tarjeta), valores: [], curvas });
  });
  return out;
}
