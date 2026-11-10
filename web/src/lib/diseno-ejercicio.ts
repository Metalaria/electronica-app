// 1.1: open design questions of the new exercises (ejercicios.json `preguntas`, tipo «diseno»; written by
// contenido/ejercicios_nuevos.py): «a filter with f_c = 1 kHz ± 5 %» where ANY valid design is right. The reader
// gives the component values; the circuit is simulated with the app's ngspice (an .ac analysis and `meas` lines,
// the way the book's own netlists measure) and each condition is checked on what the simulation measured, with a
// hint that says which way to move the values.
//
// Pure (the simulator is passed in), so the same code runs in the app (the worker, simulador/cliente.svelte.ts) and
// in Node (the tests, with the WebAssembly engine). The stored answer — EstadoEjercicio.valores[p…], like every
// question — is «text|text|…» and, once simulated, «#» + the simulated SI values + «#» + the measurements:
//   «3,3 k|47 n#3300,4.7e-8#fc=1026.14»
// The measurements only count while they belong to the values written (the same numbers), so checking stays
// synchronous and an exam is graded on what was simulated when it was handed in, never by simulating again.

import { leer } from './magnitudes';
import type { PDiseno, VeredictoPregunta } from './preguntas-ejercicio';
import { formatoValor } from '../componentes/calculadoras/unidades';

const SERIES: Record<string, number[]> = {
  E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
  E24: [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1],
};

export interface Medicion {
  /** The SI values that were simulated, in the order of `componentes`. */
  valores: number[];
  /** Measurement id → value (NaN: the simulation could not measure it, e.g. outside the sweep). */
  medidas: Record<string, number>;
}

/** Whether a value belongs to a standard series, in any decade. */
export function esDeSerieDiseno(v: number, serie: string): boolean {
  if (!(v > 0) || !Number.isFinite(v)) return false;
  const d = Math.floor(Math.log10(v) + 1e-9);
  const m = v / 10 ** d;
  return (SERIES[serie] ?? []).some((b) => Math.abs(m - b) < 1e-6 * b) || Math.abs(m - 10) < 1e-6;
}

const limpio = (t: string) => t.replace(/[|#]/g, '');

/** «3,3 k|47 n#3300,4.7e-8#fc=1026.14» → its parts. */
export function leerDiseno(valor: string, n: number): { textos: string[]; medicion: Medicion | null } {
  const [a = '', b, c] = valor.split('#');
  const p = a.split('|');
  const textos = Array.from({ length: n }, (_, i) => p[i] ?? '');
  let medicion: Medicion | null = null;
  if (b != null && c != null) {
    const valores = b.split(',').map(Number);
    const medidas: Record<string, number> = {};
    for (const kv of c.split(';')) {
      const [k, v] = kv.split('=');
      if (k) medidas[k] = v === 'nan' ? Number.NaN : Number(v);
    }
    if (valores.length === n && valores.every((x) => Number.isFinite(x))) medicion = { valores, medidas };
  }
  return { textos, medicion };
}

export function escribirDiseno(textos: string[], medicion?: Medicion | null): string {
  const base = textos.map(limpio).join('|');
  if (!medicion) return base;
  const m = Object.entries(medicion.medidas)
    .map(([k, v]) => `${k}=${Number.isFinite(v) ? Number(v.toPrecision(7)) : 'nan'}`)
    .join(';');
  return `${base}#${medicion.valores.map((x) => Number(x.toPrecision(12))).join(',')}#${m}`;
}

const plano = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const texto = (v: number, u: string) => formatoValor(v, u, 3, true);

type Valores = { ok: true; valores: number[] } | { ok: false; veredicto: VeredictoPregunta };

/** The values written, read and checked against their unit, range and series (no simulation needed). */
export function valoresDiseno(p: PDiseno, textos: string[]): Valores {
  if (textos.every((t) => !t.trim())) return { ok: false, veredicto: { tipo: 'vacio' } };
  const faltan = p.componentes.filter((_, i) => !textos[i]?.trim());
  if (faltan.length) return { ok: false, veredicto: { tipo: 'ilegible', mensaje: `Escriba también el valor de ${faltan.map((c) => plano(c.nombre)).join(' y de ')}.` } };
  const valores: number[] = [];
  for (const [i, c] of p.componentes.entries()) {
    const l = leer(textos[i]!, c.unidad);
    if ('error' in l) {
      const ej = c.unidad === 'F' ? '«47 n»' : c.unidad === 'H' ? '«10 m»' : '«3,3 k»';
      const mensaje =
        l.error === 'unidad' ? `${plano(c.nombre)} va en ${c.unidad}: esa unidad no es de esta magnitud.` : `No se entiende el valor de ${plano(c.nombre)} (pruebe ${ej}).`;
      return { ok: false, veredicto: { tipo: 'ilegible', mensaje } };
    }
    valores.push(l.valor);
  }
  // Review 11c: a value outside its range or its series is told before simulating and is NOT an attempt (`ilegible`,
  // like a project stage's values, lib/proyectos11/comprobar.ts): nothing was simulated, so it neither counts as a
  // failure nor brings the solution closer (two typos had revealed the reference design). An exam still gives it 0.
  const aviso = ' Corríjalo antes de simular (no cuenta como intento).';
  for (const [i, c] of p.componentes.entries()) {
    const v = valores[i]!;
    if (v < c.min * (1 - 1e-9) || v > c.max * (1 + 1e-9)) {
      return { ok: false, veredicto: { tipo: 'ilegible', mensaje: `${plano(c.nombre)} = ${texto(v, c.unidad)} está fuera del margen pedido (de ${texto(c.min, c.unidad)} a ${texto(c.max, c.unidad)}).${aviso}` } };
    }
    if (!esDeSerieDiseno(v, c.serie)) {
      return { ok: false, veredicto: { tipo: 'ilegible', mensaje: `${texto(v, c.unidad)} no es un valor de la serie ${c.serie}: elija ${plano(c.nombre)} de esa serie.${aviso}` } };
    }
  }
  return { ok: true, valores };
}

/** The netlist that is simulated for some values: the circuit with the values put in and the .control block. */
export function netlistDiseno(p: PDiseno, valores: number[]): string {
  let t = p.circuito;
  p.componentes.forEach((c, i) => {
    t = t.split(`{${c.id}}`).join(String(Number(valores[i]!.toPrecision(12))));
  });
  return `${t.trimEnd()}\n.control\n${p.control.trimEnd()}\n.endc\n.end\n`;
}

/** Measurements of a run, from the «name = value» lines its `meas` commands print (simulador/motor/salida.ts). */
export function medidasDeSalida(p: PDiseno, medidas: { nombre: string; valor: number }[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const m of p.medidas) {
    const x = medidas.find((y) => y.nombre.toLowerCase() === m.id.toLowerCase());
    r[m.id] = x && Number.isFinite(x.valor) ? x.valor : Number.NaN;
  }
  return r;
}

export type Simulador = (netlist: string) => Promise<{ nombre: string; valor: number }[]>;

/**
 * The stored answer with the simulation of its values (or unchanged when the values cannot be simulated: the check
 * then says what is wrong with them, and an already simulated answer for the same values is not run again).
 */
export async function simularDiseno(p: PDiseno, valor: string, simular: Simulador): Promise<string> {
  const { textos, medicion } = leerDiseno(valor, p.componentes.length);
  const v = valoresDiseno(p, textos);
  if (!v.ok) return escribirDiseno(textos);
  if (medicion && mismos(medicion.valores, v.valores)) return valor;
  const medidas = medidasDeSalida(p, await simular(netlistDiseno(p, v.valores)));
  return escribirDiseno(textos, { valores: v.valores, medidas });
}

const mismos = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]!) <= 1e-9 * Math.abs(b[i]!));

/** Whether the stored answer still has to be simulated before it can be checked. */
export function faltaSimular(p: PDiseno, valor: string): boolean {
  const { textos, medicion } = leerDiseno(valor, p.componentes.length);
  const v = valoresDiseno(p, textos);
  return v.ok && !(medicion && mismos(medicion.valores, v.valores));
}

/** Checks a design: its values, then each condition on the simulated measurements, with a hint for what fails. */
export function comprobarDiseno(p: PDiseno, valor: string): VeredictoPregunta {
  const { textos, medicion } = leerDiseno(valor, p.componentes.length);
  const v = valoresDiseno(p, textos);
  if (!v.ok) return v.veredicto;
  if (!medicion || !mismos(medicion.valores, v.valores)) return { tipo: 'ilegible', mensaje: 'Falta simular este diseño: pulse «Comprobar».' };
  const bien: string[] = [];
  const mal: string[] = [];
  for (const c of p.condiciones) {
    const m = p.medidas.find((x) => x.id === c.medida)!;
    const x = medicion.medidas[c.medida];
    const nombre = plano(m.nombre);
    if (x == null || !Number.isFinite(x)) {
      mal.push(`En la simulación, ${nombre} queda fuera del barrido de frecuencias: el diseño está muy lejos de ${plano(c.texto)}`);
      continue;
    }
    const leido = `${nombre} = ${texto(x, m.unidad)}`;
    if (x < c.min) mal.push(`El circuito simulado da ${leido}, por debajo de ${plano(c.texto)}: ${plano(c.siBaja)}`);
    else if (x > c.max) mal.push(`El circuito simulado da ${leido}, por encima de ${plano(c.texto)}: ${plano(c.siAlta)}`);
    else bien.push(`${leido} (${plano(c.texto)})`);
  }
  if (mal.length) return { tipo: 'mal', mensaje: `${mal.join('. ')}.` };
  return { tipo: 'bien', mensaje: `Correcto: simulado, ${bien.join('; ')}.` };
}

/** «f<sub>c</sub>: 1 kHz ± 5 %; Q: entre 0,65 y 0,75» (HTML). */
export function textoCondiciones(p: PDiseno): string {
  return p.condiciones.map((c) => `${p.medidas.find((m) => m.id === c.medida)?.nombre ?? c.medida}: ${c.texto}`).join('; ');
}

/** «R = 3,3 kΩ y C = 47 nF» (the worked solution's design). */
export function textoReferencia(p: PDiseno): string {
  const partes = p.componentes.map((c) => `${c.nombre} = ${p.referencia[c.id]?.texto ?? ''}`);
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : (partes[0] ?? '');
}
