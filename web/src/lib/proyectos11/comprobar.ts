// 1.1 «Proyectos por etapas»: the checker of a stage. Pure (the simulator is passed in, as in lib/diseno-ejercicio.ts),
// so the app (the simulator's worker, lib/simular-diseno.ts) and the Node tests (the WebAssembly engine) run the same
// code. What is checked is the reader's drawing itself: the editor's own netlist (componentes/editor/netlist.ts) with
// its analyses and any `.control` block taken out and the stage's `.control` put in, so a design that differs from the
// starting circuit (two capacitors in parallel, another topology) is judged by what it measures, not by its values.
//
//   1. the design values: each part (by designator) or `.param` is there, readable, in its range and its series —
//      the first problem is the hint, before anything is simulated;
//   2. the netlist: the editor's own errors (no ground, a missing value…) stop it with their message;
//   3. the simulation: every condition on what it measured, with the hint of each one that fails (which value to
//      move, and which way, in the book's terms).

import { generarNetlist } from '../../componentes/editor/netlist';
import { deSpice, formatoValor as formatoEditor, leerValor } from '../../componentes/editor/valores';
import type { DocumentoEsquema } from '../../componentes/editor/tipos';
import { formatoValor } from '../../componentes/calculadoras/unidades';
import type { Simulador } from '../diseno-ejercicio';
import type { ComponenteEtapa, Etapa } from './tipos';

const SERIES: Record<'E12' | 'E24' | 'E96', number[]> = {
  E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
  E24: [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1],
  E96: [
    100, 102, 105, 107, 110, 113, 115, 118, 121, 124, 127, 130, 133, 137, 140, 143, 147, 150, 154, 158, 162, 165, 169, 174, 178, 182, 187, 191,
    196, 200, 205, 210, 215, 221, 226, 232, 237, 243, 249, 255, 261, 267, 274, 280, 287, 294, 301, 309, 316, 324, 332, 340, 348, 357, 365, 374,
    383, 392, 402, 412, 422, 432, 442, 453, 464, 475, 487, 499, 511, 523, 536, 549, 562, 576, 590, 604, 619, 634, 649, 665, 681, 698, 715, 732,
    750, 768, 787, 806, 825, 845, 866, 887, 909, 931, 953, 976,
  ].map((x) => x / 100),
};

/** Whether a value belongs to a standard series, in any decade. */
export function esDeSerie(v: number, serie: keyof typeof SERIES): boolean {
  if (!(v > 0) || !Number.isFinite(v)) return false;
  const d = Math.floor(Math.log10(v) + 1e-9);
  const m = v / 10 ** d;
  return SERIES[serie].some((b) => Math.abs(m - b) < 1e-6 * b) || Math.abs(m - 10) < 1e-6;
}

export const plano = (h: string): string =>
  h
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
/** «212 ns», «29,8 dB», «0,1 %» (3 significant digits, Spanish style). */
export const textoMedida = (v: number, u: string): string => (u === 'dB' || u === '%' ? `${formatoValor(v, '', 3, true).trim()} ${u}` : formatoValor(v, u, 3, true));
const texto = textoMedida;

// ------------------------------------------------------------------ the design values in the drawing

const PARAM = /^(\s*\.param\b)(.*)$/i;
const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The part of the drawing that holds a design value (by designator), or null. */
function piezaDe(c: ComponenteEtapa, doc: DocumentoEsquema) {
  return doc.componentes.find((x) => igual(x.nombre, c.id) && 'valor' in x.campos) ?? null;
}

/** «vsec=24» → its value text in the `.param` lines of the directives, or null. */
function valorParam(id: string, directivas: string): string | null {
  const re = new RegExp(`(?:^|[\\s,])${id}\\s*=\\s*([^\\s,]+)`, 'i');
  for (const l of directivas.split('\n')) {
    const m = PARAM.exec(l);
    const v = m && re.exec(m[2]!);
    if (v) return v[1]!;
  }
  return null;
}

/** The value of a design component as it is written in the drawing (a field, or a `.param`), or null if missing. */
export function textoEnDibujo(c: ComponenteEtapa, doc: DocumentoEsquema): string | null {
  if (c.tipo === 'param') {
    const v = valorParam(c.id, doc.directivas);
    return v == null ? null : deSpice(v);
  }
  const p = piezaDe(c, doc);
  return p ? (p.campos['valor'] ?? '') : null;
}

/** A copy of the drawing with one design value written (as the editor writes values: «4,7k», «10m», «30»). */
export function conValor(doc: DocumentoEsquema, c: ComponenteEtapa, v: number): DocumentoEsquema {
  const d = JSON.parse(JSON.stringify(doc)) as DocumentoEsquema;
  if (c.tipo === 'param') {
    const re = new RegExp(`((?:^|[\\s,])${c.id}\\s*=\\s*)([^\\s,]+)`, 'i');
    let hecho = false;
    const lineas = d.directivas.split('\n').map((l) => {
      const m = PARAM.exec(l);
      if (hecho || !m || !re.test(m[2]!)) return l;
      hecho = true;
      return m[1]! + m[2]!.replace(re, `$1${Number(v.toPrecision(12))}`);
    });
    d.directivas = hecho ? lineas.join('\n') : `.param ${c.id}=${Number(v.toPrecision(12))}\n${d.directivas}`;
  } else {
    const p = d.componentes.find((x) => igual(x.nombre, c.id) && 'valor' in x.campos);
    if (p) p.campos['valor'] = formatoEditor(v);
  }
  return d;
}

export type Valores = { ok: true; valores: Record<string, number> } | { ok: false; mensaje: string };

/** Reads one typed or drawn value for a component: its number, or what is wrong with it. */
export function leerComponente(c: ComponenteEtapa, t: string): { ok: true; v: number } | { ok: false; mensaje: string } {
  const nombre = plano(c.nombre);
  const l = leerValor(t, c.unidad);
  if (!l.ok || l.v == null) {
    const ej = c.unidad === 'F' ? '«47n» o «10m»' : c.unidad === 'H' ? '«10m»' : c.unidad === 'V' ? '«30»' : '«4,7k»';
    return { ok: false, mensaje: `No se entiende el valor de ${nombre} («${t.trim()}»): escríbalo como ${ej}.` };
  }
  const v = l.v;
  if (v < c.min * (1 - 1e-9) || v > c.max * (1 + 1e-9))
    return { ok: false, mensaje: `${nombre} = ${texto(v, c.unidad)} está fuera de lo razonable para esta etapa (de ${texto(c.min, c.unidad)} a ${texto(c.max, c.unidad)}).` };
  if (c.series.length && !c.series.some((s) => esDeSerie(v, s)))
    return { ok: false, mensaje: `${texto(v, c.unidad)} no es un valor comercial de la serie ${c.series.join(' ni de la ')}: elija ${nombre} de esa serie.` };
  return { ok: true, v };
}

/** The design values of the drawing, checked (the first problem is the message). */
export function valoresEtapa(e: Etapa, doc: DocumentoEsquema): Valores {
  const valores: Record<string, number> = {};
  for (const c of e.componentes) {
    const nombre = plano(c.nombre);
    const t = c.tipo === 'param' ? valorParam(c.id, doc.directivas) : (piezaDe(c, doc)?.campos['valor'] ?? null);
    if (t == null)
      return {
        ok: false,
        mensaje:
          c.tipo === 'param'
            ? `Falta el parámetro «${c.id}» en las directivas del esquema: «Restaurar la etapa» lo vuelve a poner.`
            : `No encuentro ${nombre} (${c.id}) en el esquema: ¿lo ha borrado o le ha cambiado el nombre? «Restaurar la etapa» lo vuelve a poner.`,
      };
    if (/^\s*\{/.test(t)) return { ok: false, mensaje: `${nombre} es una expresión («${t.trim()}»): escriba un valor.` };
    const l = leerComponente(c, t);
    if (!l.ok) return l;
    valores[c.id] = l.v;
  }
  return { ok: true, valores };
}

// ------------------------------------------------------------------ the netlist that is simulated

const ANALISIS = /^\s*\.(op|tran|ac|dc|noise|tf|disto|pz|sens|four|meas|measure|print|plot|probe|save|end)\b/i;

/**
 * The editor's netlist of the drawing with the stage's measurements: the drawing's analyses, `.control` blocks and
 * output lines out (the stage decides what is simulated), the stage's `.control` in.
 */
export function netlistEtapa(e: Etapa, doc: DocumentoEsquema): { ok: true; texto: string } | { ok: false; mensaje: string } {
  const nl = generarNetlist(doc);
  if (nl.errores.length) return { ok: false, mensaje: `El esquema tiene un error que impide simularlo: ${nl.errores[0]!.texto}` };
  const lineas: string[] = [];
  let enControl = false;
  for (const l of nl.texto.split('\n')) {
    if (/^\s*\.control\b/i.test(l)) enControl = true;
    else if (/^\s*\.endc\b/i.test(l)) enControl = false;
    else if (!enControl && !ANALISIS.test(l) && l.trim() !== '* análisis elegidos en el editor') lineas.push(l);
  }
  while (lineas.length && !lineas[lineas.length - 1]!.trim()) lineas.pop();
  return { ok: true, texto: `${lineas.join('\n')}\n.control\n${e.control.trimEnd()}\n.endc\n.end\n` };
}

// ------------------------------------------------------------------ the conditions

export interface ResultadoCondicion {
  medida: string;
  /** «tiempo de subida (30–70 %)» (HTML). */
  nombre: string;
  medido: number;
  /** «212 ns» (plain text), or «no se pudo medir». */
  leido: string;
  texto: string;
  ok: boolean;
  /** What to change (HTML), when not ok. */
  pista?: string;
}

export interface ResultadoEtapa {
  /** `ilegible`: nothing was simulated (a value is missing or wrong, the drawing has an error): not an attempt. */
  tipo: 'bien' | 'mal' | 'ilegible';
  /** Plain text for the live region. */
  mensaje: string;
  condiciones: ResultadoCondicion[];
  /** Measured but not checked. */
  informativas: { nombre: string; leido: string }[];
  valores?: Record<string, number>;
  medidas?: Record<string, number>;
}

/** Measurement id → value (NaN when the run did not print it), with the stage's derived values. */
export function medidasEtapa(e: Etapa, salida: { nombre: string; valor: number }[], valores: Record<string, number>): Record<string, number> {
  const m: Record<string, number> = {};
  for (const x of salida) if (Number.isFinite(x.valor)) m[x.nombre.toLowerCase()] = x.valor;
  const r: Record<string, number> = {};
  for (const [k, v] of Object.entries(m)) r[k] = v;
  if (e.derivadas) for (const [k, v] of Object.entries(e.derivadas(r, valores))) r[k.toLowerCase()] = v;
  const fuera: Record<string, number> = {};
  for (const md of e.medidas) fuera[md.id] = r[md.id.toLowerCase()] ?? Number.NaN;
  for (const c of e.condiciones) fuera[c.medida] ??= r[c.medida.toLowerCase()] ?? Number.NaN;
  return fuera;
}

/** Each condition on the measurements. */
export function evaluarEtapa(e: Etapa, medidas: Record<string, number>): ResultadoCondicion[] {
  return e.condiciones.map((c) => {
    const md = e.medidas.find((x) => x.id === c.medida)!;
    const x = medidas[c.medida] ?? Number.NaN;
    const base = { medida: c.medida, nombre: md.nombre, medido: x, texto: c.texto };
    if (!Number.isFinite(x))
      return {
        ...base,
        leido: 'no se pudo medir',
        ok: false,
        pista: 'la simulación no llega a medirlo: el diseño está muy lejos de lo pedido, o falta en el esquema una red con el nombre que se mide (no cambie los nombres de las redes de la etapa)',
      };
    const leido = texto(x, md.unidad);
    if (c.min != null && x < c.min) return { ...base, leido, ok: false, pista: c.siBaja ?? c.siAlta };
    if (c.max != null && x > c.max) return { ...base, leido, ok: false, pista: c.siAlta ?? c.siBaja };
    return { ...base, leido, ok: true };
  });
}

/** Checks the reader's drawing for a stage: values, netlist, simulation, conditions. */
export async function comprobarEtapa(e: Etapa, doc: DocumentoEsquema, simular: Simulador): Promise<ResultadoEtapa> {
  const vacio = { condiciones: [], informativas: [] };
  const v = valoresEtapa(e, doc);
  if (!v.ok) return { tipo: 'ilegible', mensaje: v.mensaje, ...vacio };
  const n = netlistEtapa(e, doc);
  if (!n.ok) return { tipo: 'ilegible', mensaje: n.mensaje, ...vacio };
  let salida: { nombre: string; valor: number }[];
  try {
    salida = await simular(n.texto);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    return { tipo: 'ilegible', mensaje: `La simulación no terminó (${m}). Revise el esquema y vuelva a comprobar.`, ...vacio };
  }
  const medidas = medidasEtapa(e, salida, v.valores);
  const condiciones = evaluarEtapa(e, medidas);
  const informativas = e.medidas
    .filter((m) => m.informativa)
    .map((m) => ({ nombre: m.nombre, leido: Number.isFinite(medidas[m.id]!) ? texto(medidas[m.id]!, m.unidad) : 'no se pudo medir' }));
  const mal = condiciones.filter((c) => !c.ok);
  const mensaje = mal.length
    ? `Aún no: ${mal.map((c) => `${plano(c.nombre)} = ${c.leido} (se pide ${plano(c.texto)}); ${plano(c.pista ?? '')}`).join('. ')}.`
    : `Etapa superada: ${condiciones.map((c) => `${plano(c.nombre)} = ${c.leido}`).join('; ')}.`;
  return { tipo: mal.length ? 'mal' : 'bien', mensaje, condiciones, informativas, valores: v.valores, medidas };
}
