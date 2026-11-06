// «Modo docente» in the app: loads the book data the bank, the exams and the PDFs need (ejercicios.json, the Repaso
// questions, the practice items with changing values, the parts with the statements and solutions) and gives them
// synchronously to the pure modules (banco.ts, examen.ts, pdf/documento.ts). Everything is the app's own offline
// content; nothing is fetched from outside.

import { cargarParte, leerJSON, obtenerIndice, rotuloParte, url } from '../datos';
import { cargarEjercicios, ejercicios } from '../ejercicios.svelte';
import type { BEjercicios, Bloque, Parte } from '../tipos';
import type { IndiceRepaso, Pregunta } from '../../componentes/repaso/datos';
import { cargarCuestionario } from '../../componentes/repaso/datos';
import { cargarIndicePractica, cargarPractica } from '../../componentes/practica/datos';
import type { ItemNumerico } from '../../componentes/practica/tipos';
import type { DatosBanco } from './banco';
import type { LibroPdf } from './pdf/documento';
import type { Recursos } from './pdf/maquetar';
import type { IdFuente } from './pdf/fuentes';

const preguntas = new Map<string, Pregunta>();
const porParte: Record<string, Pregunta[]> = {};
const numericos = new Map<string, ItemNumerico>();
const partes = new Map<string, Parte>();
let variables: Record<string, string> = {};
let todasCargadas: Promise<void> | null = null;

/** The bank's data: every exercise and every Repaso question (all the quiz files, ~1 MB, once). */
export async function cargarBanco(): Promise<DatosBanco> {
  const datos = await cargarEjercicios();
  if (!datos) throw new Error(ejercicios.error || 'No se pudieron cargar los ejercicios');
  todasCargadas ??= (async () => {
    const ind = await leerJSON<IndiceRepaso>('repaso/indice.json');
    await Promise.all(
      ind.partes.map(async (e) => {
        const c = await cargarCuestionario(e.parte);
        porParte[e.parte] = c.preguntas;
        for (const p of c.preguntas) preguntas.set(p.id, p);
      }),
    );
    const ip = await cargarIndicePractica();
    variables = ip?.ejercicios ?? {};
  })().catch((e: unknown) => {
    todasCargadas = null;
    throw e;
  });
  await todasCargadas;
  return { indice: obtenerIndice(), ejercicios: datos, preguntas: porParte, variables };
}

const parteDePregunta = (id: string) => id.replace(/-\d+$/, '');

/**
 * Loads what a set of items needs (their parts, quizzes and practice items) so that `libro` answers synchronously.
 */
export async function prepararItems(items: { k: 'ejercicio' | 'pregunta' | 'seccion'; ref: string; parte?: string }[]): Promise<void> {
  const datos = await cargarEjercicios();
  if (!datos) throw new Error(ejercicios.error || 'No se pudieron cargar los ejercicios');
  const ip = await cargarIndicePractica();
  // (review 10h, r10h·2: without the practice index the exercises with changing values cannot be shown as their
  // variant — never fall back silently to the book's values: the caller says it could not load)
  if (!ip) throw new ErrorCarga('el índice de la práctica');
  variables = ip.ejercicios;
  const necesarias = new Set<string>();
  const quizzes = new Set<string>();
  const practicas = new Set<string>();
  for (const it of items) {
    if (it.k === 'ejercicio') {
      const e = datos.items[it.ref];
      if (!e) continue;
      necesarias.add(e.parte);
      if (variables[it.ref]) practicas.add(e.parte);
    } else if (it.k === 'pregunta') quizzes.add(parteDePregunta(it.ref));
  }
  await Promise.all([
    ...[...necesarias].map(async (p) => {
      if (!partes.has(p)) partes.set(p, await cargarParte(p));
    }),
    ...[...quizzes].map(async (p) => {
      if (porParte[p]) return;
      const c = await cargarCuestionario(p);
      porParte[p] = c.preguntas;
      for (const q of c.preguntas) preguntas.set(q.id, q);
    }),
    ...[...practicas].map(async (p) => {
      const d = await cargarPractica(p);
      for (const it of d?.items ?? []) if (it.tipo === 'numerico') numericos.set(it.id, it);
    }),
  ]);
}

function rotulo(parte: string): string {
  try {
    const i = obtenerIndice().partes[parte];
    const r = rotuloParte(parte);
    return i && r !== i.titulo ? `${r} · ${i.titulo}` : r;
  } catch {
    return parte;
  }
}

/** A part of the book's content did not load (network, a damaged install): the pages say so in their own words. */
export class ErrorCarga extends Error {
  constructor(que: string) {
    super(`No se ha podido cargar ${que}`);
    this.name = 'ErrorCarga';
  }
}

/** The book data, synchronously (after prepararItems / cargarBanco). */
export const libro: LibroPdf = {
  variable: (label) => !!variables[label],
  ejercicio: (label) => ejercicios.datos?.items[label],
  pregunta: (id) => preguntas.get(id),
  numerico: (label) => {
    const id = variables[label];
    return id ? numericos.get(id) : undefined;
  },
  bloques: (label) => {
    const it = ejercicios.datos?.items[label];
    const p = it ? partes.get(it.parte) : undefined;
    if (!it || !p) return undefined;
    if (it.tipo === 'ej') {
      const b = p.bloques[it.pos[0] ?? -1] as BEjercicios | undefined;
      const e = b?.t === 'ejercicios' ? b.items[it.pos[1] ?? -1] : undefined;
      return e ? { enunciado: e.bloques, solucion: e.solucion ?? [] } : undefined;
    }
    const [h, pide, fin] = it.pos as [number, number, number];
    return { enunciado: p.bloques.slice(h + 1, pide + 1) as Bloque[], solucion: p.bloques.slice(pide + 1, fin) as Bloque[] };
  },
  rotulo,
  seccion: (parte, label) => {
    try {
      const s = obtenerIndice().partes[parte]?.secciones?.find((x) => x.label === label);
      return s ? { num: s.num ?? null, titulo: s.titulo } : undefined;
    } catch {
      return undefined;
    }
  },
};

// ------------------------------------------------------------------ PDF resources

// The font files the PDF can use (lib/docente/pdf/fuentes.ts `todasLasFuentes`), bundled as assets: .woff, because
// @pdf-lib/fontkit 1.1.1 crashes subsetting fonts read from .woff2 (an asynchronous RangeError in TTFSubset).
const URLS_FUENTES = import.meta.glob<string>(
  [
    '/node_modules/@fontsource/source-serif-4/files/source-serif-4-{latin,latin-ext,greek}-{400,700}-{normal,italic}.woff',
    '/node_modules/@fontsource/source-sans-3/files/source-sans-3-{latin,latin-ext,greek}-{400,700}-{normal,italic}.woff',
    '/node_modules/@fontsource/source-code-pro/files/source-code-pro-{latin,latin-ext,greek}-400-normal.woff',
    '/node_modules/@fontsource/dejavu-sans/files/dejavu-sans-latin-400-normal.woff',
  ],
  { query: '?url', import: 'default', eager: true },
);

export function urlFuente(id: IdFuente): string | undefined {
  const [paquete, nombre] = id.split('/');
  return URLS_FUENTES[`/node_modules/@fontsource/${paquete}/files/${paquete}-${nombre}.woff`];
}

async function bytes(u: string): Promise<Uint8Array> {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return new Uint8Array(await r.arrayBuffer());
}

/** Draws an SVG on a canvas (figures with patterns or masks, which the vector converter does not draw). */
async function rasterizar(svg: string, ancho: number, alto: number): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') return null;
  const w = Math.max(1, Math.min(2400, ancho));
  const h = Math.max(1, Math.min(2400, Math.round((alto * w) / Math.max(1, ancho))));
  const u = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'sync';
    img.src = u;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    if (!g) return null;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.drawImage(img, 0, 0, w, h);
    const b = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'));
    return b ? new Uint8Array(await b.arrayBuffer()) : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(u);
  }
}

export const recursos: Recursos = {
  texto: async (ruta) => {
    const r = await fetch(url(ruta));
    if (!r.ok) throw new Error(`${r.status} ${ruta}`);
    return r.text();
  },
  binario: (ruta) => bytes(url(ruta)),
  fuente: async (id) => {
    const u = urlFuente(id);
    if (!u) throw new Error(`fuente ${id} no incluida`);
    return bytes(u);
  },
  rasterizar,
};
