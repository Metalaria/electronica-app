// 1.2.1 (motor121, request of autor121-fund): frozen copies of lessons of 1.2.0 that specs walk card by card — the two
// reference lessons cap01/sec-1.4 and cap00/sec-0.3, and cap02/sec-2.2 (two of its option questions, in the practice
// spec) — as tests/lecciones11-congeladas/<parte>/<label>.yaml and the .json published from it (commit 62fd250).
// Those specs (their options, estimates, orderings, ids, numbers of cards) use these instead of the published ones,
// so the authors can rewrite the published lessons («aprender haciendo») freely:
//   - in Node: `leccionCongelada(id)` (the JSON), `fuenteCongelada(id)` (the parsed YAML), `rutaFuenteCongelada(id)`;
//   - in the browser: `servirCongeladas(ctx)` serves the frozen lessons and their index entries in place of the build's;
//     a spec that serves its own lessons too merges `entradasCongeladas()` into its index and calls `rutasCongeladas`
//     before routing its own (the route registered last wins).
// lecciones11-unidad checks that each JSON is what the generator gives from its YAML today; when an engine change
// alters the output, EPA_CONGELAR=1 on that test rewrites the JSON (the YAML never changes).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { BrowserContext } from '@playwright/test';
import { entradaIndice } from '../src/lib/leccion11/motor.ts';
import type { EntradaIndice11, Leccion11 } from '../src/lib/leccion11/tipos.ts';

export const CONGELADAS = ['cap01/sec-1.4', 'cap00/sec-0.3', 'cap02/sec-2.2'] as const;
export const DIR_CONGELADAS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'lecciones11-congeladas');

export const esCongelada = (id: string): boolean => (CONGELADAS as readonly string[]).includes(id);
export const rutaFuenteCongelada = (id: string): string => path.join(DIR_CONGELADAS, `${id}.yaml`);
export const rutaLeccionCongelada = (id: string): string => path.join(DIR_CONGELADAS, `${id}.json`);
export const fuenteCongelada = (id: string): Record<string, unknown> => parse(fs.readFileSync(rutaFuenteCongelada(id), 'utf8')) as Record<string, unknown>;

const cache = new Map<string, Leccion11>();
/** The frozen lesson (a fresh copy each time: callers may change it). */
export function leccionCongelada(id: string): Leccion11 {
  if (!cache.has(id)) cache.set(id, JSON.parse(fs.readFileSync(rutaLeccionCongelada(id), 'utf8')) as Leccion11);
  return structuredClone(cache.get(id)!);
}

/** The index entries of the frozen lessons (as lecciones11.mjs writes them). */
export function entradasCongeladas(): Record<string, EntradaIndice11> {
  return Object.fromEntries(CONGELADAS.map((id) => [id, entradaIndice(leccionCongelada(id))]));
}

/** Routes the frozen lessons' JSON in place of the build's (not the index). */
export async function rutasCongeladas(ctx: BrowserContext): Promise<void> {
  for (const id of CONGELADAS) {
    const cuerpo = fs.readFileSync(rutaLeccionCongelada(id), 'utf8');
    await ctx.route(`**/libro/lecciones11/${id}.json`, (x) => x.fulfill({ contentType: 'application/json', body: cuerpo }));
  }
}

/** Serves the frozen lessons and their index entries in place of the build's. */
export async function servirCongeladas(ctx: BrowserContext): Promise<void> {
  await ctx.route('**/libro/lecciones11/indice.json', async (x) => {
    const real = await x.fetch().then((y) => y.json()).catch(() => ({ version: 1, total: 0, lecciones: {} }));
    const lecciones = { ...(real.lecciones ?? {}), ...entradasCongeladas() };
    await x.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...real, version: real.version ?? 1, total: Object.keys(lecciones).length, lecciones }) });
  });
  await rutasCongeladas(ctx);
}
