// Full-text search over busqueda.json with MiniSearch: accent- and case-insensitive,
// prefix and fuzzy matching. The index is built on first use, in chunks, without blocking.

import MiniSearch, { type SearchResult } from 'minisearch';
import { cargarBusqueda, normalizar } from './datos';
import type { DocBusqueda } from './tipos';

export interface Resultado {
  doc: DocBusqueda;
  puntos: number;
  terminos: string[];
}

let motor: Promise<{ ms: MiniSearch<DocBusqueda>; docs: Map<string, DocBusqueda> }> | null = null;

// Short Spanish words that only add noise to the results.
const VACIAS = new Set(
  'a al con de del el en es la las lo los o para por que se su un una y e u ni no le les mas sus'.split(' '),
);

function procesar(termino: string): string | null {
  const t = normalizar(termino);
  return t.length < 2 && !/\d/.test(t) ? null : VACIAS.has(t) ? null : t;
}

export function prepararBuscador(): Promise<{ ms: MiniSearch<DocBusqueda>; docs: Map<string, DocBusqueda> }> {
  motor ??= (async () => {
    const lista = await cargarBusqueda();
    const ms = new MiniSearch<DocBusqueda>({
      idField: 'id',
      fields: ['titulo', 'texto'],
      storeFields: [],
      processTerm: procesar,
      tokenize: (s) => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean),
      searchOptions: {
        boost: { titulo: 4 },
        prefix: true,
        fuzzy: (term) => (term.length > 4 ? 0.2 : false),
        combineWith: 'AND',
      },
    });
    // Deduplicate ids defensively: MiniSearch refuses duplicates.
    const docs = new Map<string, DocBusqueda>();
    for (const d of lista) if (!docs.has(d.id)) docs.set(d.id, d);
    await ms.addAllAsync([...docs.values()], { chunkSize: 200 });
    return { ms, docs };
  })();
  return motor;
}

export async function buscar(consulta: string, limite = 60): Promise<Resultado[]> {
  const q = consulta.trim();
  if (!q) return [];
  const { ms, docs } = await prepararBuscador();
  let r: SearchResult[] = ms.search(q);
  // If every word must match and nothing does, fall back to any word.
  if (r.length === 0) r = ms.search(q, { combineWith: 'OR' });
  return r.slice(0, limite).flatMap((x) => {
    const doc = docs.get(String(x.id));
    return doc ? [{ doc, puntos: x.score, terminos: x.terms }] : [];
  });
}

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * HTML snippet of a text around the first match of the given (normalised) terms, with the
 * matches marked. Works on the normalised text and maps positions back to the original.
 */
export function fragmento(texto: string, terminos: string[], largo = 190): string {
  if (!texto) return '';
  // Normalise character by character, keeping a map to the original positions.
  let norm = '';
  const mapa: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    const n = normalizar(texto[i] ?? '');
    for (let k = 0; k < n.length; k++) mapa.push(i);
    norm += n;
  }
  const lista = [...new Set(terminos.map(normalizar))].filter((t) => t.length > 0).sort((a, b) => b.length - a.length);
  const rangos: [number, number][] = [];
  for (const t of lista) {
    let desde = 0;
    for (;;) {
      const p = norm.indexOf(t, desde);
      if (p < 0) break;
      // Only matches at the start of a word (prefix search).
      const antes = p === 0 ? ' ' : norm[p - 1] ?? ' ';
      if (!/[\p{L}\p{N}]/u.test(antes)) rangos.push([mapa[p] ?? 0, (mapa[p + t.length - 1] ?? 0) + 1]);
      desde = p + t.length;
    }
  }
  rangos.sort((a, b) => a[0] - b[0]);
  const unidos: [number, number][] = [];
  for (const r of rangos) {
    const u = unidos[unidos.length - 1];
    if (u && r[0] <= u[1]) u[1] = Math.max(u[1], r[1]);
    else unidos.push([r[0], r[1]]);
  }
  const primero = unidos[0]?.[0] ?? 0;
  let ini = Math.max(0, primero - Math.round(largo * 0.3));
  if (ini > 0) {
    const sp = texto.indexOf(' ', ini);
    if (sp > 0 && sp < primero) ini = sp + 1;
  }
  let fin = Math.min(texto.length, ini + largo);
  if (fin < texto.length) {
    const sp = texto.lastIndexOf(' ', fin);
    if (sp > ini + largo * 0.6) fin = sp;
  }
  let out = ini > 0 ? '… ' : '';
  let cursor = ini;
  for (const [a, b] of unidos) {
    if (b <= ini || a >= fin) continue;
    const aa = Math.max(a, ini);
    const bb = Math.min(b, fin);
    out += escapar(texto.slice(cursor, aa)) + '<mark>' + escapar(texto.slice(aa, bb)) + '</mark>';
    cursor = bb;
  }
  out += escapar(texto.slice(cursor, fin)) + (fin < texto.length ? ' …' : '');
  return out;
}
