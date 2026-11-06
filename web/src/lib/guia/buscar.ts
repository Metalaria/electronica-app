// 1.0 «Guía de uso»: the filter of the guide. A small, synchronous search over lib/guia/contenido.ts (a few hundred
// sentences): accent- and case-insensitive, every word of the query must start a word of the subsection (its title,
// its text, or its section's title and keywords). No index, no network.

import { GUIA, type ApartadoGuia, type BloqueGuia, type SeccionGuia } from './contenido';

export interface ResultadoGuia {
  seccion: SeccionGuia;
  apartado: ApartadoGuia;
  /** Higher is better: words in titles count more. */
  puntos: number;
  /** Plain-text snippet around the first match in the text (or the start of the text). */
  fragmento: string;
}

/** Lowercase, without accents (ñ becomes n, as in the book's search). */
export function normalizarGuia(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function palabras(s: string): string[] {
  return normalizarGuia(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** The words of a query worth matching: one-letter words (without digits) add nothing. */
export function terminosConsulta(consulta: string): string[] {
  return [...new Set(palabras(consulta).filter((p) => p.length > 1 || /\d/.test(p)))];
}

/** All the text of a block, as plain text. */
export function textoBloque(b: BloqueGuia): string {
  switch (b.t) {
    case 'p':
    case 'consejo':
    case 'aviso':
      return b.texto;
    case 'lista':
    case 'pasos':
      return b.items.join(' ');
    case 'teclas':
      return b.filas.map(([k, v]) => `${k} ${v}`).join(' ');
  }
}

export function textoApartado(a: ApartadoGuia): string {
  return a.bloques.map(textoBloque).join(' ');
}

function empiezaAlguna(lista: string[], t: string): boolean {
  return lista.some((p) => p.startsWith(t));
}

/** A snippet of `texto` around the first word that starts with one of the terms. */
function fragmentoDe(texto: string, terminos: string[], largo = 170): string {
  const norm = normalizarGuia(texto);
  let primero = -1;
  for (const t of terminos) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u');
    const m = re.exec(norm);
    if (m) {
      const p = m.index + m[1]!.length;
      if (primero < 0 || p < primero) primero = p;
    }
  }
  // NFD normalisation keeps the length of these texts' letters once the marks are removed only approximately: the
  // snippet is cut on the original text at the same offset, which is close enough for a preview.
  let ini = Math.max(0, (primero < 0 ? 0 : primero) - Math.round(largo * 0.3));
  if (ini > 0) {
    const sp = texto.indexOf(' ', ini);
    if (sp > 0 && sp - ini < 20) ini = sp + 1;
  }
  let fin = Math.min(texto.length, ini + largo);
  if (fin < texto.length) {
    const sp = texto.lastIndexOf(' ', fin);
    if (sp > ini + largo * 0.6) fin = sp;
  }
  return `${ini > 0 ? '… ' : ''}${texto.slice(ini, fin)}${fin < texto.length ? ' …' : ''}`;
}

/** The subsections that match every word of the query, best first (the guide's order on ties). */
export function buscarEnGuia(consulta: string, guia: SeccionGuia[] = GUIA): ResultadoGuia[] {
  const terminos = terminosConsulta(consulta);
  if (!terminos.length) return [];
  const salida: (ResultadoGuia & { orden: number })[] = [];
  let orden = 0;
  for (const seccion of guia) {
    const pSeccion = palabras(`${seccion.titulo} ${(seccion.claves ?? []).join(' ')}`);
    const pResumen = palabras(seccion.resumen);
    for (const apartado of seccion.apartados) {
      orden++;
      const texto = textoApartado(apartado);
      const pTitulo = palabras(apartado.titulo);
      const pTexto = palabras(texto);
      let puntos = 0;
      let todas = true;
      for (const t of terminos) {
        const enTitulo = empiezaAlguna(pTitulo, t);
        const enSeccion = empiezaAlguna(pSeccion, t);
        const enTexto = empiezaAlguna(pTexto, t);
        const enResumen = empiezaAlguna(pResumen, t);
        if (!enTitulo && !enSeccion && !enTexto && !enResumen) {
          todas = false;
          break;
        }
        puntos += (enTitulo ? 4 : 0) + (enSeccion ? 2 : 0) + (enTexto ? 1 : 0) + (enResumen ? 0.5 : 0);
      }
      if (!todas) continue;
      salida.push({ seccion, apartado, puntos, fragmento: fragmentoDe(texto, terminos), orden });
    }
  }
  salida.sort((a, b) => b.puntos - a.puntos || a.orden - b.orden);
  return salida.map(({ orden: _o, ...r }) => r);
}
