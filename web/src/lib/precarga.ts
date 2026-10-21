// Idle-time work that makes the next jump instant: the parts the reader is likely to open next (those
// referenced from the section on screen, and the next part) are fetched and parsed, chunked, and the HTML of
// the target section is prepared, all in small slices while the main thread is idle.

import type { Bloque, Parte } from './tipos';
import { cargarParte, candidatosDeRef, obtenerRefs, prepararHtml } from './datos';
import { anchoColumna, trozoDe, trozosDe } from './trozos';

type Cancelar = () => void;

/** requestIdleCallback with a fallback (WebKit before 18 has none). */
export function alInactivo(fn: (quedan: () => number) => void, espera = 1500): Cancelar {
  const w = window as Window & {
    requestIdleCallback?: (cb: (d: { timeRemaining(): number }) => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (h: number) => void;
  };
  if (w.requestIdleCallback) {
    const h = w.requestIdleCallback((d) => fn(() => d.timeRemaining()), { timeout: espera });
    return () => w.cancelIdleCallback?.(h);
  }
  const h = window.setTimeout(() => {
    const t0 = performance.now();
    fn(() => Math.max(0, 8 - (performance.now() - t0)));
  }, 50);
  return () => clearTimeout(h);
}

const RE_REF = /data-ref="([^"]+)"/g;

function htmlDe(b: Bloque, out: string[]): void {
  const o = b as unknown as Record<string, unknown>;
  for (const k of ['html', 'pie', 'credito', 'titulo', 'etiqueta']) {
    const v = o[k];
    if (typeof v === 'string') out.push(v);
  }
  if (b.t === 'lista') out.push(...b.items);
  if (b.t === 'tabla') for (const f of b.filas) out.push(...f);
  if ('bloques' in b && Array.isArray(b.bloques)) for (const x of b.bloques) htmlDe(x, out);
  if (b.t === 'ejercicios') {
    for (const it of b.items) {
      for (const x of it.bloques) htmlDe(x, out);
      for (const x of it.solucion ?? []) htmlDe(x, out);
    }
  }
}

/** Reference keys cited by some blocks. */
export function refsCitadas(bloques: Bloque[]): string[] {
  const html: string[] = [];
  for (const b of bloques) htmlDe(b, html);
  const out = new Set<string>();
  for (const h of html) for (const m of h.matchAll(RE_REF)) out.add(m[1]!);
  return [...out];
}

interface Tarea {
  parte: string;
  /** Reference key whose section should be made ready, or null for the start of the part. */
  clave: string | null;
}

let cola: Tarea[] = [];
const hechas = new Set<string>();
let cancelar: Cancelar | null = null;
let entorno = { tam: 18, movil: false };

/**
 * Prepares the targets of some references and the next part, in idle time. A new call replaces the pending
 * work of the previous one (the reader moved on).
 */
export function precargar(claves: string[], siguiente: string | null, desde: string, tam: number, movil: boolean): void {
  entorno = { tam, movil };
  const refs = obtenerRefs();
  const nuevas: Tarea[] = [];
  const vistas = new Set<string>();
  for (const c of claves) {
    const r = refs[c];
    if (!r || r.parte === desde) continue;
    const k = `${r.parte}|${c}`;
    if (hechas.has(k) || vistas.has(k)) continue;
    vistas.add(k);
    nuevas.push({ parte: r.parte, clave: c });
  }
  if (siguiente && !hechas.has(`${siguiente}|`)) nuevas.push({ parte: siguiente, clave: null });
  cola = nuevas.slice(0, 8);
  programar();
}

function programar(): void {
  cancelar?.();
  if (!cola.length) {
    cancelar = null;
    return;
  }
  cancelar = alInactivo((quedan) => {
    cancelar = null;
    void paso(quedan);
  });
}

async function paso(quedan: () => number): Promise<void> {
  const t = cola[0];
  if (!t) return;
  let p: Parte;
  try {
    // Fetch and JSON parse run off the main thread or in one short task; the result is cached.
    p = await cargarParte(t.parte);
  } catch {
    cola.shift();
    programar();
    return;
  }
  if (quedan() < 4) return programar();
  // Chunking of the whole part (cheap, but not free on a slow phone), then the HTML of the target chunk.
  const trozos = trozosDe(p.bloques, anchoColumna(entorno.tam, entorno.movil), entorno.tam);
  const k = t.clave ? (trozoDe(trozos, { ids: candidatosDeRef(t.clave) }) ?? 0) : 0;
  const html: string[] = [];
  for (const b of trozos[k]?.bloques ?? []) htmlDe(b, html);
  for (const h of html) prepararHtml(h);
  hechas.add(`${t.parte}|${t.clave ?? ''}`);
  cola.shift();
  programar();
}
