// Automatic schematics of netlists (see ESQUEMA.md, «Esquemas automáticos»).
//
// Contracts used by other parts of the app (looked up lazily with import.meta.glob):
//   generarDibujo(netlist)    → DibujoConNetlist for the live layer (figuras-vivas/circuito/CircuitoVivo.svelte)
//   esquemaDeNetlist(netlist) → Esquema (topology only) for the instrument bench
//   esquemaAutomatico(netlist, { subckt }) → everything (SVGs, topology, mapping, statistics)
// The layout runs in a Web Worker; results are kept per netlist text, and the worker keeps the layouts per
// circuit structure, so value changes (sliders) redraw at once with the same layout.

import type { DibujoConNetlist, Esquema } from '../figuras-vivas/tipos';
import { HUECO_FUENTES, type PeticionEsquema, type RespuestaEsquema, type ResultadoEsquema } from './resultado.ts';
import latin from '@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff2?url';
import griego from '@fontsource/source-sans-3/files/source-sans-3-greek-400-normal.woff2?url';
import urlPrecalculado from './precalculado.json?url';

export type { ResultadoEsquema } from './resultado.ts';
export { HUECO_FUENTES } from './resultado.ts';

// ------------------------------------------------------------------ worker

let trabajador: Worker | null = null;
let siguiente = 1;
const pendientes = new Map<number, { ok: (r: ResultadoEsquema | null) => void; mal: (e: Error) => void }>();

function crearTrabajador(): Worker | null {
  if (trabajador) return trabajador;
  if (typeof Worker === 'undefined') return null;
  try {
    const w = new Worker(new URL('./trabajador.ts', import.meta.url), { type: 'module', name: 'esquema-auto' });
    w.onmessage = (ev: MessageEvent<RespuestaEsquema>) => {
      const r = ev.data;
      const p = pendientes.get(r.id);
      if (!p) return;
      pendientes.delete(r.id);
      if (r.ok) p.ok(r.resultado);
      else p.mal(new Error(r.error));
    };
    w.onerror = () => {
      // A broken worker: fail what is pending and fall back to the page's thread from now on.
      for (const p of pendientes.values()) p.mal(new Error('El generador de esquemas no está disponible.'));
      pendientes.clear();
      trabajador = null;
      sinTrabajador = true;
    };
    trabajador = w;
    return w;
  } catch {
    return null;
  }
}

let sinTrabajador = false;
let semilla: Promise<void> | null = null;

async function enHilo(texto: string, subckt: string | null, aspecto: number): Promise<ResultadoEsquema | null> {
  const [{ generarEsquema, sembrarDibujos }, { construirResultado }] = await Promise.all([import('./generar.ts'), import('./construir.ts')]);
  semilla ??= fetch(urlPrecalculado)
    .then((r) => r.json() as Promise<Record<string, [number, number, number][][]>>)
    .then(sembrarDibujos)
    .catch(() => {});
  await semilla;
  const a = generarEsquema(texto, { subckt, aspecto });
  return a ? construirResultado(a) : null;
}

/** Sheet shape for netlists with several circuits: wide on wide screens, squarer on phones in portrait. */
function aspectoPantalla(): number {
  if (typeof innerWidth === 'undefined') return 1.8;
  return innerWidth < 700 ? 1.1 : innerWidth < 1100 ? 1.5 : 2;
}

const MAX_CACHE = 16;
const cache = new Map<string, Promise<ResultadoEsquema | null>>();

/** The automatic schematic of a netlist (or of the body of one of its subcircuits). */
export function esquemaAutomatico(texto: string, opciones: { subckt?: string | null } = {}): Promise<ResultadoEsquema | null> {
  const subckt = opciones.subckt ?? null;
  const aspecto = aspectoPantalla();
  const clave = `${subckt ?? ''}\u0000${aspecto}\u0000${texto}`;
  const hit = cache.get(clave);
  if (hit) {
    cache.delete(clave);
    cache.set(clave, hit);
    return hit;
  }
  const w = sinTrabajador ? null : crearTrabajador();
  const p: Promise<ResultadoEsquema | null> = w
    ? new Promise((ok, mal) => {
        const id = siguiente++;
        pendientes.set(id, { ok, mal });
        const pet: PeticionEsquema = { id, texto, subckt, aspecto };
        w.postMessage(pet);
      })
    : enHilo(texto, subckt, aspecto);
  p.catch(() => cache.delete(clave));
  cache.set(clave, p);
  while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
  return p;
}

// ------------------------------------------------------------------ fonts for pictures

let fuentes: Promise<string> | null = null;

/** @font-face rules with Source Sans 3 embedded (an SVG shown as an image cannot use the page's fonts). */
export function reglasFuentes(): Promise<string> {
  fuentes ??= (async () => {
    const base64 = async (u: string) => {
      const b = new Uint8Array(await (await fetch(u)).arrayBuffer());
      let s = '';
      for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
      return btoa(s);
    };
    try {
      const [a, b] = await Promise.all([base64(latin), base64(griego)]);
      const f = (d: string, r: string) => `@font-face{font-family:'Source Sans 3';src:url(data:font/woff2;base64,${d}) format('woff2');unicode-range:${r}}`;
      return f(a, 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212') + f(b, 'U+0370-03FF');
    } catch {
      return '';
    }
  })();
  return fuentes;
}

/** The book-palette SVG with its fonts embedded, ready for an <img>. */
export async function svgConFuentes(r: ResultadoEsquema): Promise<string> {
  return r.svgLibro.replace(HUECO_FUENTES, await reglasFuentes());
}

// ------------------------------------------------------------------ contracts

/** For the live layer (figuras-vivas): the drawing, its topology and the netlist mapping, or null. */
export async function generarDibujo(netlist: string): Promise<DibujoConNetlist | null> {
  const r = await esquemaAutomatico(netlist);
  if (!r) return null;
  return {
    origen: 'auto',
    svg: await svgConFuentes(r),
    vista: r.vista,
    esquemas: [r.esquema],
    correspondencia: [r.correspondencia],
  };
}

/** For the instrument bench: the topology alone, or null. */
export async function esquemaDeNetlist(netlist: string): Promise<Esquema | null> {
  return (await esquemaAutomatico(netlist))?.esquema ?? null;
}
