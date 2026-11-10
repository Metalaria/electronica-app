// 1.1: the deep links of the printed book. The new layout prints a QR per section with
//   epa://leccion/<parte>/<label>        e.g. epa://leccion/cap01/sec-1.4
// The app opens it as the lesson route #/leccion/<parte>/<label> (componentes/leccion11/ElegirLeccion.svelte: the 1.1
// lesson when the section has one, the classic lesson otherwise, «no encontrada» for a part or section the book does
// not have). Pure (the tests run it in Node). Where links come from: Tauri on Windows/macOS/Android (src-tauri/src/
// lib.rs, module `enlaces`, through lib/enlaces-app.ts) and, in a browser, the same link as a hash
// (#epa://leccion/… or #/epa://leccion/…: lib/ruta.svelte.ts).
//
// Validation is strict, so a link can never take the app anywhere else: the whole text must be the scheme `epa://`,
// the one known prefix `leccion`, and two segments of [a-z0-9.-] (compared in lower case: some readers and platforms
// change the case of a URL; the index gives back the book's own spelling, apA / sec-A.1). The part must look like a
// chapter or an appendix (cap<NN>, ap<letter>, or the expansions' new chapters cap-new-<name>: review 11c) and the
// label like a section (sec-…, or the part's generated labels
// <parte>-<n>). No query, fragment, escapes, «..» or extra segments; at most LONGITUD_MAXIMA characters. The result
// is only ever a hash route of this app.

export interface EnlaceLeccion {
  parte: string;
  label: string;
}

/** Longer than any real link (the longest label of the book has 25 characters, the longest part 17). */
export const LONGITUD_MAXIMA = 120;

const SEGMENTO = /^[a-z0-9.-]{1,40}$/;
const PARTE = /^(cap\d{2}|ap[a-z]|cap-new-[a-z0-9]+)$/;
const ENLACE = /^epa:\/\/leccion\/([^/]+)\/([^/]+)\/?$/;

/** The lesson a deep link names, or null when it is not a valid one (anything else: null, never thrown). */
export function leerEnlace(texto: unknown): EnlaceLeccion | null {
  if (typeof texto !== 'string') return null;
  const t = texto.trim().toLowerCase();
  if (!t || t.length > LONGITUD_MAXIMA) return null;
  const m = ENLACE.exec(t);
  if (!m) return null;
  const [, parte, label] = m as unknown as [string, string, string];
  if (!SEGMENTO.test(parte) || !SEGMENTO.test(label)) return null;
  if (!PARTE.test(parte)) return null;
  if (label.includes('..') || !(label.startsWith('sec-') || label.startsWith(`${parte}-`)) || !/[a-z0-9]$/.test(label)) return null;
  return { parte, label };
}

/** What the app needs of the book's index: its parts and their sections (lib/tipos.ts Indice). */
export interface IndiceEnlaces {
  partes: Record<string, { secciones?: { label: string }[] } | undefined>;
}

/**
 * The part and section of the book a link names, in the book's own spelling (apA, sec-A.1), or null when the book
 * does not have them.
 */
export function resolverEnlace(e: EnlaceLeccion, indice: IndiceEnlaces | null | undefined): EnlaceLeccion | null {
  if (!indice) return null;
  const parte = Object.keys(indice.partes).find((k) => k.toLowerCase() === e.parte);
  if (!parte) return null;
  const s = indice.partes[parte]?.secciones?.find((x) => x.label.toLowerCase() === e.label);
  return s ? { parte, label: s.label } : null;
}

/**
 * The hash route a deep link opens: #/leccion/<parte>/<label> (resolved through the index when it is given: the
 * book's spelling), or #/leccion — the lesson page's «no encontrada» — when the link is not valid.
 */
export function rutaDeEnlace(texto: unknown, indice?: IndiceEnlaces | null): string {
  const e = leerEnlace(texto);
  if (!e) return '#/leccion';
  const r = (indice && resolverEnlace(e, indice)) || e;
  return `#/leccion/${r.parte}/${r.label}`;
}

/**
 * A browser's hash that carries a deep link (#epa://…, #/epa://…, also percent-encoded as a browser may leave it):
 * the route it opens (rutaDeEnlace); null for any other hash (the app's own routes are left alone).
 */
export function rutaDeHashEnlace(hash: string, indice?: IndiceEnlaces | null): string | null {
  let h = hash.replace(/^#\/?/, '');
  if (/^epa%3a/i.test(h)) {
    try {
      h = decodeURIComponent(h);
    } catch {
      return '#/leccion';
    }
  }
  if (!/^epa:/i.test(h)) return null;
  return rutaDeEnlace(h, indice);
}
