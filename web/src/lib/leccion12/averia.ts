// 1.2 «Busque la avería»: a lesson circuit with one hidden fault (a fault is the model's values with that part
// broken: an open resistor 1e9 Ω, a short 1e-3 Ω, a wrong value, a reversed or failed device), probes read by a
// virtual multimeter (and an oscilloscope for AC) with the fault applied, and the reasoning that explains a wrong
// suspect from the reader's own measurements: «If it were R₁ (open), at A you would read 0 V; you read 6,00 V».
// The same functions check, in the generator, that the probes can tell the faults apart. Pure.

import { formatear, type ModeloCompilado, type Valores } from '../leccion11/modelo';
import { textoPlano } from '../leccion11/texto';
import type { Texto } from '../leccion11/tipos';
import { NOMBRE_AVERIA } from '../../componentes/practica/averias';
import { generador, semillaDe } from './azar';
import type { Averia, Fallo } from './tipos';

/** Two readings tell two states apart when they differ by more than 2 % (and the meter's resolution). */
export function distintas(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.isFinite(a) !== Number.isFinite(b);
  return Math.abs(a - b) > Math.max(0.02 * Math.max(Math.abs(a), Math.abs(b)), 1e-9);
}

/** Resolution of the virtual meter on a probe: a thousandth of the largest reading it can show on this board. */
export const RESOLUCION = 1e-3;

/** The raw model values each probe reads with fault `f` (null: the healthy circuit). */
function crudas(mc: ModeloCompilado, a: Averia, v: Valores, f: Fallo | null): Record<string, number> {
  // (the healthy values first: `v` may already carry the hidden fault, laid over the widget)
  const r = mc.evaluar({ ...v, ...a.sano, ...(f?.con ?? {}) });
  return Object.fromEntries(a.sondas.map((s) => [s.id, r[s.valor]!]));
}

/**
 * What each probe reads with fault `f` (null: the healthy circuit), as a meter shows it: anything below its
 * resolution on that probe (a thousandth of the largest value the probe takes over the healthy board and every fault)
 * reads 0 — the 60 µV left at the output of a divider with its top resistor open is «0» on a multimeter.
 */
export function lecturas(mc: ModeloCompilado, a: Averia, v: Valores, f: Fallo | null): Record<string, number> {
  const todas = [null, ...a.fallos].map((g) => crudas(mc, a, v, g));
  const r = crudas(mc, a, v, f);
  return Object.fromEntries(
    a.sondas.map((s) => {
      const escala = Math.max(...todas.map((x) => Math.abs(x[s.id]!)).filter(Number.isFinite), 0);
      const x = r[s.id]!;
      return [s.id, Number.isFinite(x) && Math.abs(x) < RESOLUCION * escala ? 0 : x];
    }),
  );
}

/** The fault of a round: the list's order (fija) or a seeded draw (azar) that never repeats the previous round's. */
export function falloDeRonda(a: Averia, id: string, ronda: number, semilla = semillaDe(id)): number {
  const n = a.fallos.length;
  if (a.eleccion === 'fija' || n < 2) return ronda % n;
  const rnd = generador(semilla);
  let k = Math.floor(rnd() * n);
  for (let j = 0; j < ronda; j++) {
    const s = Math.floor(rnd() * (n - 1));
    k = s >= k ? s + 1 : s;
  }
  return k;
}

/** The faults no probe set of at most `pasos` probes separates from a fault of another suspect (generator). */
export function faltaSeparar(mc: ModeloCompilado, a: Averia, v: Valores): { pares: [string, string][]; sano: string[]; minimo: number | null } {
  const lec = a.fallos.map((f) => lecturas(mc, a, v, f));
  const sana = lecturas(mc, a, v, null);
  const ids = a.sondas.map((s) => s.id);
  const pares: [string, string][] = [];
  a.fallos.forEach((f, i) =>
    a.fallos.forEach((g, j) => {
      if (j <= i || f.pieza === g.pieza) return;
      if (!ids.some((s) => distintas(lec[i]![s]!, lec[j]![s]!))) pares.push([f.id, g.id]);
    }),
  );
  const sano = a.fallos.filter((_, i) => !ids.some((s) => distintas(lec[i]![s]!, sana[s]!))).map((f) => f.id);
  // the smallest fixed set of probes that tells every pair apart (≤ 10 probes: every subset)
  let minimo: number | null = null;
  if (!pares.length && ids.length <= 10) {
    for (let m = 1; m < 1 << ids.length; m++) {
      const usa = ids.filter((_, k) => (m >> k) & 1);
      if (minimo != null && usa.length >= minimo) continue;
      const ok = a.fallos.every((f, i) => a.fallos.every((g, j) => j <= i || f.pieza === g.pieza || usa.some((s) => distintas(lec[i]![s]!, lec[j]![s]!))));
      if (ok) minimo = usa.length;
    }
  }
  return { pares, sano, minimo };
}

const T = (s: string): Texto => [{ t: 'txt', s }];

/**
 * Why a suspect is not the faulty part, from what the reader measured: the first probe where every fault of that
 * suspect would read clearly different from what was read. Without such a probe, what to do next.
 */
export function porQueNo(mc: ModeloCompilado, a: Averia, v: Valores, real: Fallo, sospechoso: string, medidas: readonly string[]): Texto {
  const nombre = textoPlano(a.sospechosos.find((s) => s.id === sospechoso)?.rotulo);
  const leido = lecturas(mc, a, v, real);
  const suyos = a.fallos.filter((f) => f.pieza === sospechoso);
  const mag = (s: string) => mc.magnitud(a.sondas.find((x) => x.id === s)!.valor);
  for (const s of medidas) {
    const sonda = a.sondas.find((x) => x.id === s)!;
    if (suyos.length && suyos.every((f) => distintas(lecturas(mc, a, v, f)[s]!, leido[s]!))) {
      const f = suyos[0]!;
      const de = suyos.length === 1 ? ` (${(f.tipo === 'valor' ? 'con otro valor' : NOMBRE_AVERIA[f.tipo].toLowerCase())})` : '';
      return T(`Si fuera ${nombre}${de}, en «${textoPlano(sonda.rotulo)}» mediría ${formatear(mag(s), lecturas(mc, a, v, f)[s])}; usted ha medido ${formatear(mag(s), leido[s])}.`);
    }
  }
  if (!medidas.length) return T(`Todavía no ha medido nada que señale a ${nombre}. Mida primero.`);
  return T(`Lo que ha medido no descarta ${nombre}, pero tampoco lo señala: mida en otro punto antes de decidir.`);
}

/** Whether the suspect (and the kind, if asked) is the hidden fault. */
export function acierta(a: Averia, real: Fallo, sospechoso: string | null, tipo: string | null): boolean {
  if (sospechoso !== real.pieza) return false;
  return !a.preguntarTipo || tipo === real.tipo;
}

/** The kinds a reader can choose from when the card also asks what is wrong (those of the card's faults, in order). */
export function tiposDe(a: Averia): { id: string; nombre: string }[] {
  const out: { id: string; nombre: string }[] = [];
  for (const f of a.fallos)
    if (!out.some((x) => x.id === f.tipo)) out.push({ id: f.tipo, nombre: f.tipo === 'valor' ? 'Tiene otro valor' : NOMBRE_AVERIA[f.tipo] });
  return out;
}
