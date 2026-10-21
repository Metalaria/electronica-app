// The book's netlists: spice.json (loaded once, lazily) and the text of each netlist.

import type { IndiceSpice, NetlistSpice } from './tipos';
import { obtenerRefs } from '../lib/datos';

const BASE = 'libro/';

let promesa: Promise<IndiceSpice | null> | null = null;
let promesaRefs: Promise<void> | null = null;

/** Reactive view for the reader's «Simular» buttons (filled when spice-refs.json or spice.json arrives). */
export const spice = $state({ porRef: {} as Record<string, string[]>, listo: false });

/** The reader's map label → netlists (spice-refs.json, a few tens of kB instead of the whole index). */
export function cargarRefsSpice(): Promise<void> {
  promesaRefs ??= fetch(BASE + 'spice-refs.json')
    .then(async (r) => {
      if (!r.ok || (r.headers.get('content-type') ?? '').includes('text/html')) return;
      if (!spice.listo) spice.porRef = (await r.json()) as Record<string, string[]>;
      spice.listo = true;
    })
    .catch(() => {});
  return promesaRefs;
}

/** spice.json, or null when the book has no netlists (sample content, or the pipeline step not run). */
export function cargarIndiceSpice(): Promise<IndiceSpice | null> {
  promesa ??= fetch(BASE + 'spice.json')
    .then(async (r) => {
      if (!r.ok || (r.headers.get('content-type') ?? '').includes('text/html')) return null;
      const d = (await r.json()) as IndiceSpice;
      spice.porRef = d.porRef;
      spice.listo = true;
      return d;
    })
    .catch(() => null);
  return promesa;
}

const textos = new Map<string, Promise<string>>();

export function cargarNetlist(n: NetlistSpice): Promise<string> {
  let p = textos.get(n.fichero);
  if (!p) {
    p = fetch(BASE + n.fichero).then((r) => {
      if (!r.ok) throw new Error(`No se pudo cargar ${n.fichero} (${r.status})`);
      return r.text();
    });
    p.catch(() => textos.delete(n.fichero));
    textos.set(n.fichero, p);
  }
  return p;
}

const NOMBRES: Record<string, string> = {
  fig: 'Figura',
  sec: 'Sección',
  subsec: 'Apartado',
  prob: 'Problema',
  ej: 'Ejercicio',
  tab: 'Tabla',
  cap: 'Capítulo',
  ap: 'Apéndice',
};

/** «Figura 41.5» for a label, with the printed number from refs.json. */
export function rotuloRef(label: string | null): string {
  if (!label) return '';
  const r = obtenerRefs()[label];
  if (!r) return label;
  return `${NOMBRES[r.tipo] ?? r.tipo} ${r.num}`;
}

/** Route of the simulator page of a netlist. */
export function rutaSimulacion(id: string): string {
  return `#/simulador/${id}`;
}
