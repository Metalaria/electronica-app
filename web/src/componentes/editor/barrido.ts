// Parameter sweep («.step», which ngspice's batch mode does not have): the circuit simulated once per value of
// one field of one part, and the results merged into one Simulacion whose plots carry the value in their id, so
// the results view overlays them (one curve per value, «v(out) · R1 = 2,2 kΩ» in the legend) and the operating
// point table gets one column per value.

import type { Simulacion } from '../../simulador/motor/simular.ts';
import type { Grafica } from '../../simulador/motor/nucleo.ts';
import { formatoCorto } from '../grafica/formato.ts';
import { tipoDe, type Campo } from './catalogo.ts';
import type { Barrido, Componente, DocumentoEsquema } from './tipos.ts';
import { formatoValor, leerValor } from './valores.ts';

export const MAX_VALORES = 8;

export function barridoPorDefecto(): Barrido {
  return { activo: false, comp: '', campo: '', modo: 'lista', lista: '', desde: '', hasta: '', pasos: '5', escala: 'lin' };
}

/** Fields of a part that can be swept: its numeric fields shown in the properties. */
export function camposBarribles(c: Componente): Campo[] {
  return tipoDe(c).campos.filter((f) => f.tipo === 'valor' && (!f.si || f.si(c)));
}

/** Parts with a field to sweep. */
export function partesBarribles(doc: DocumentoEsquema): Componente[] {
  return doc.componentes.filter((c) => c.tipo !== 'GEN' && camposBarribles(c).length);
}

export interface ValorBarrido {
  /** Field text written into the copy of the part. */
  texto: string;
  /** Legend label («R1 = 2,2 kΩ»). */
  etiqueta: string;
}

/** The values of a sweep, or an error in plain Spanish. */
export function valoresBarrido(doc: DocumentoEsquema, b: Barrido): { valores: ValorBarrido[] } | { error: string } {
  const c = doc.componentes.find((x) => x.id === b.comp);
  if (!c) return { error: 'Barrido: elija el componente cuyo valor cambia.' };
  const f = camposBarribles(c).find((x) => x.id === b.campo);
  if (!f) return { error: `Barrido: elija qué valor de ${c.nombre} cambia.` };
  const u = f.unidad ?? '';
  const etiqueta = (v: number | null, t: string) => `${c.nombre} = ${v != null ? formatoCorto(v, u === '%' ? '%' : u) : t}`;
  const valores: ValorBarrido[] = [];
  if (b.modo === 'lista') {
    // «1k; 2,2k; 4,7k», «1k 2k2 4k7» or «1k, 2,2k, 4,7k» (a comma followed by a space separates).
    const trozos = b.lista
      .split(/;|,\s+|\s+/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (trozos.length < 2) return { error: 'Barrido: escriba al menos dos valores separados por punto y coma (1k; 2,2k; 4,7k).' };
    for (const t of trozos) {
      const l = leerValor(t, u);
      if (!l.ok) return { error: `Barrido: «${t}» — ${l.error}` };
      valores.push({ texto: t, etiqueta: etiqueta(l.v, t) });
    }
  } else {
    const a = leerValor(b.desde, u);
    const z = leerValor(b.hasta, u);
    const n = Math.round(Number(b.pasos.replace(',', '.')));
    if (!a.ok || a.v == null) return { error: `Barrido: el valor inicial — ${a.ok ? 'escriba un número' : a.error}` };
    if (!z.ok || z.v == null) return { error: `Barrido: el valor final — ${z.ok ? 'escriba un número' : z.error}` };
    if (!Number.isFinite(n) || n < 2) return { error: 'Barrido: el número de valores debe ser 2 o más.' };
    if (b.escala === 'log' && (a.v <= 0 || z.v <= 0)) return { error: 'Barrido: en escala logarítmica los dos extremos deben ser positivos.' };
    for (let i = 0; i < Math.min(n, MAX_VALORES + 1); i++) {
      const t = i / (n - 1);
      const v = b.escala === 'log' ? a.v * Math.pow(z.v / a.v, t) : a.v + (z.v - a.v) * t;
      const r = Number(v.toPrecision(4));
      valores.push({ texto: formatoValor(r), etiqueta: etiqueta(r, String(r)) });
    }
  }
  if (valores.length > MAX_VALORES) return { error: `Barrido: como mucho ${MAX_VALORES} valores (para que las curvas se distingan).` };
  return { valores };
}

/** The drawing with the swept field set to one value (a copy). */
export function documentoConValor(doc: DocumentoEsquema, b: Barrido, texto: string): DocumentoEsquema {
  const d = JSON.parse(JSON.stringify(doc)) as DocumentoEsquema;
  const c = d.componentes.find((x) => x.id === b.comp);
  if (c) c.campos[b.campo] = texto;
  return d;
}

/**
 * One result from the runs of a sweep: every plot renamed «label» (or «label · tran2» when a run has several
 * plots of a class), measurements by run.
 */
export function unirBarrido(corridas: { etiqueta: string; sim: Simulacion }[]): Simulacion {
  const graficas: Grafica[] = [];
  const secciones: Simulacion['salida']['secciones'] = [];
  for (const { etiqueta, sim } of corridas) {
    const porClase = new Map<string, number>();
    for (const g of sim.ejecucion.graficas) {
      const clase = g.analisis.toLowerCase().split(/\s/)[0] ?? '';
      porClase.set(clase, (porClase.get(clase) ?? 0) + 1);
    }
    for (const g of sim.ejecucion.graficas) {
      const clase = g.analisis.toLowerCase().split(/\s/)[0] ?? '';
      graficas.push({ ...g, id: (porClase.get(clase) ?? 0) > 1 ? `${etiqueta} · ${g.id}` : etiqueta });
    }
    const medidas = sim.salida.secciones.flatMap((s) => s.medidas);
    if (medidas.length) secciones.push({ ...sim.salida.secciones[0]!, titulo: etiqueta, notas: [], medidas });
  }
  const primero = corridas[0]!.sim;
  return {
    ...primero,
    ejecucion: { ...primero.ejecucion, graficas, ms: corridas.reduce((a, c) => a + c.sim.ejecucion.ms, 0) },
    salida: { ...primero.salida, secciones },
  };
}
