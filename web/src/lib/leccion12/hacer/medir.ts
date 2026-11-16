// 1.2.1 (piloto121): what the virtual instrument of a live circuit reads (GUIA §13.1). The multimeter reads the DC
// operating point of the schematic's own netlist, solved in the page (lib/leccion12/cc.ts) with the card's values —
// the same circuit the generator checks against ngspice —: a voltage between the red and the black probe's nodes, or
// the current of the branch the ammeter is in (the branch's 0 V meter source, in the direction the drawing gives a
// positive current). The oscilloscope shows the widget's graph curve of the probed point. Pure.

import { resolverCC, type SolucionCC } from '../cc';
import { medicionCacheada, peticionMedida } from './punto-trabajo';
import { esquemaDe } from '../../leccion11/esquemas/registro';
import { contextoNetlist } from '../../leccion11/spice';
import type { Valores } from '../../leccion11/modelo';
import type { Texto, WidgetCircuito } from '../../leccion11/tipos';
import { textoPlano } from '../../leccion11/texto';
import type { EstadoMedida, Instrumento, Medir } from './tipos';

/**
 * What the instrument reads on the widget's circuit with the model's evaluation `r`: a linear DC circuit is solved
 * here (cc.ts); any other one (motor121: non-linear, or changing with time) comes from the app's ngspice once it has
 * run (punto-trabajo.ts keeps it), null until then.
 */
export function solucionWidget(w: WidgetCircuito, r: Valores): SolucionCC | null {
  const def = esquemaDe(w.esquema);
  if (!def) return null;
  const p = peticionMedida(w, r, def);
  if (p) return medicionCacheada(p)?.solucion ?? null;
  try {
    return resolverCC(def.netlist(contextoNetlist(w, r), 'op'));
  } catch {
    return null;
  }
}

/** A fresh placement: the first mode, no probe placed but the black one on its start (ground by default). */
export function nuevaMedida(i: Instrumento): EstadoMedida {
  const negra = i.negra ?? (i.puntos.some((p) => p.id === '0') ? '0' : null);
  return { modo: i.modos[0] ?? 'V', roja: null, negra: i.tipo === 'osciloscopio' ? null : negra, rama: null, activa: negra ? 'roja' : 'roja' };
}

/** What the instrument reads in that placement: volts or amperes; null while the placement is not complete. */
export function lectura(i: Instrumento, m: EstadoMedida, s: SolucionCC | null): number | null {
  if (!s || i.tipo !== 'multimetro') return null;
  if (m.modo === 'A') {
    if (!m.rama) return null;
    const x = s.corrientes[m.rama.toLowerCase()];
    return x == null || !Number.isFinite(x) ? null : x;
  }
  if (!m.roja || !m.negra) return null;
  const a = s.nodos[m.roja.toLowerCase()];
  const b = s.nodos[m.negra.toLowerCase()];
  return a == null || b == null ? null : a - b;
}

/** The unit of the reading in that placement. */
export const unidadMedida = (m: EstadoMedida): string => (m.modo === 'A' ? 'A' : 'V');

const nombre = (lista: { id: string; rotulo: Texto }[], id: string | null) => textoPlano(lista.find((p) => p.id === id)?.rotulo) || id || '';

/** The placement in words («entre «Nodo de la carga» y «Masa»», «en la rama de R₃»). */
export function describirMedida(i: Instrumento, m: EstadoMedida): string {
  if (i.tipo === 'osciloscopio') return m.roja ? `la sonda en «${nombre(i.puntos, m.roja)}»` : 'la sonda sin poner';
  if (m.modo === 'A') return m.rama ? `el amperímetro en «${nombre(i.ramas, m.rama)}»` : 'el amperímetro sin poner';
  const r = m.roja ? `la punta roja en «${nombre(i.puntos, m.roja)}»` : 'la punta roja sin poner';
  const n = m.negra ? `la negra en «${nombre(i.puntos, m.negra)}»` : 'la negra sin poner';
  return `${r} y ${n}`;
}

/** The «medir» step can be checked: the instrument is placed for the kind of quantity asked. */
export function medidaCompleta(a: Medir, m: EstadoMedida | undefined): boolean {
  if (!m) return false;
  if (a.magnitud === 'corriente') return m.modo === 'A' && !!m.rama;
  if (a.magnitud === 'senal') return !!m.roja;
  return m.modo === 'V' && !!m.roja && !!m.negra;
}

/** Whether the placement measures what the card asks. */
export function medidaBien(a: Medir, m: EstadoMedida): boolean {
  if (a.magnitud === 'corriente') return m.modo === 'A' && m.rama === a.rama;
  if (a.magnitud === 'senal') return m.roja === a.punto;
  const [x, y] = a.entre ?? ['', ''];
  if (m.modo !== 'V') return false;
  if (m.roja === x && m.negra === y) return true;
  return !a.polaridad && m.roja === y && m.negra === x;
}

/** The author's explanation of a wrong placement, if any: by branch, by the pair «roja/negra», or by a probe's point. */
export function porqueMedida(a: Medir, m: EstadoMedida): Texto | undefined {
  if (a.magnitud === 'corriente') return m.rama ? a.porque[m.rama] : undefined;
  if (a.magnitud === 'senal') return m.roja ? a.porque[m.roja] : undefined;
  const [x, y] = a.entre ?? ['', ''];
  const par = a.porque[`${m.roja}/${m.negra}`] ?? a.porque[`${m.negra}/${m.roja}`];
  if (par) return par;
  // (the probe that is off target: the red one first)
  if (m.roja && m.roja !== x && m.roja !== y && a.porque[m.roja]) return a.porque[m.roja];
  if (m.negra && m.negra !== x && m.negra !== y && a.porque[m.negra]) return a.porque[m.negra];
  return undefined;
}
