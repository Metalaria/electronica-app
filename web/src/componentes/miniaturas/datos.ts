// Data of the list thumbnails, all pre-rendered by scripts/miniaturas.mjs into public/miniaturas/:
// the index of book figures (section id or exercise label → figure), the schematics of the book's netlists
// (one small JSON per chapter, requested when its first thumbnail is about to be seen) and the image paths.
// Everything is fetched once and kept for the session.

import type { TrazosMiniatura } from '../esquema-auto/miniatura';

const BASE = 'miniaturas/';

interface Indice {
  version: number;
  w: number;
  h: number;
  figuras: Record<string, string>;
}

let indice: Promise<Record<string, string>> | null = null;
let indiceListo: Record<string, string> | null = null;

async function json<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    // A missing file in the dev server or an SPA host comes back as the HTML page.
    if (!r.ok || (r.headers.get('content-type') ?? '').includes('text/html')) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** Figure thumbnails by label (sections, exercises, problems). */
export function cargarIndiceFiguras(): Promise<Record<string, string>> {
  indice ??= json<Indice>(BASE + 'indice.json').then((d) => (indiceListo = d?.figuras ?? {}));
  return indice;
}

/** The figure thumbnail of a label, when the index is already loaded (undefined: not loaded yet). */
export function figuraYa(clave: string): string | null | undefined {
  return indiceListo ? (indiceListo[clave] ?? null) : undefined;
}

export function urlFigura(ruta: string): string {
  return `${BASE}${ruta}.webp`;
}

export function urlModelo3d(tipo: string): string {
  return `${BASE}3d/${tipo}.webp`;
}

const capitulos = new Map<string, Promise<Record<string, TrazosMiniatura>>>();
const capitulosListos = new Map<string, Record<string, TrazosMiniatura>>();

function partesId(id: string): [string, string] {
  const i = id.indexOf('/');
  return [id.slice(0, i), id.slice(i + 1)];
}

/** Schematic of a netlist id («cap42/fig-42.5_filtro_rc») if its chapter file is already loaded. */
export function esquemaYa(id: string): TrazosMiniatura | null | undefined {
  const [parte, nombre] = partesId(id);
  const c = capitulosListos.get(parte);
  return c ? (c[nombre] ?? null) : undefined;
}

export async function esquemaDe(id: string): Promise<TrazosMiniatura | null> {
  const [parte, nombre] = partesId(id);
  let p = capitulos.get(parte);
  if (!p) {
    p = json<{ esquemas: Record<string, TrazosMiniatura> }>(`${BASE}esquemas/${parte}.json`).then((d) => {
      const e = d?.esquemas ?? {};
      capitulosListos.set(parte, e);
      return e;
    });
    capitulos.set(parte, p);
  }
  return (await p)[nombre] ?? null;
}

/** Glossary term → symbol key (glosario-imagenes.json «s»), loaded with the first glossary thumbnail. */
let simbolos: Promise<Record<string, string>> | null = null;
export function simboloDeTermino(id: string): Promise<string | null> {
  simbolos ??= json<{ terminos: Record<string, { s?: string }> }>('libro/glosario-imagenes.json').then((d) => {
    const m: Record<string, string> = {};
    for (const [k, v] of Object.entries(d?.terminos ?? {})) if (v.s) m[k] = v.s;
    return m;
  });
  return simbolos.then((m) => m[id] ?? null);
}
