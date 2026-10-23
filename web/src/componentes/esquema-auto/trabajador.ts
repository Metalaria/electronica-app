// Web Worker of the automatic schematics: the annealing of a large netlist takes tens to hundreds of
// milliseconds, so it never runs on the page's thread. It keeps the drawings per circuit structure, so a
// slider move (same parts, other values) is redrawn at once with the same layout, and it starts from the
// layouts precomputed for the book's netlists (precalculado.json, scripts/esquema-auto-precalcular.mjs).

import { generarEsquema, sembrarDibujos } from './generar.ts';
import { construirResultado } from './construir.ts';
import type { PeticionEsquema, RespuestaEsquema } from './resultado.ts';
import urlPrecalculado from './precalculado.json?url';

let listo: Promise<void> | null = null;
function preparar(): Promise<void> {
  listo ??= fetch(urlPrecalculado)
    .then((r) => r.json() as Promise<Record<string, [number, number, number][][]>>)
    .then(sembrarDibujos)
    .catch(() => {
      /* without it every layout is computed live */
    });
  return listo;
}

let cola: Promise<void> = Promise.resolve();

self.onmessage = (ev: MessageEvent<PeticionEsquema>) => {
  const p = ev.data;
  cola = cola.then(async () => {
    await preparar();
    let r: RespuestaEsquema;
    try {
      const a = generarEsquema(p.texto, { subckt: p.subckt ?? null, aspecto: p.aspecto ?? 1.8 });
      r = { id: p.id, ok: true, resultado: a ? construirResultado(a) : null };
    } catch (e) {
      r = { id: p.id, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    (self as unknown as Worker).postMessage(r);
  });
};
