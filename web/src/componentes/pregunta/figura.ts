// The book's figure that goes with a question's quote, when there is one we can find reliably.
//
// The quote of a Repaso question is literal text of the book inside the section of its `ref` (checked by
// contenido/repaso.py). We look for its longest fragment in the text of the blocks of that section (or of the
// problem/subsection the `ref` names) and then take, in this order:
//   1. a figure the quoted block itself cites («figura 5.1» as a reference), if it is in the same part;
//   2. else the figure nearest to the quoted block (at most two top-level blocks away) without crossing a
//      subsection heading.
// Anything else (quote not found, no figure close by) gives null: better no figure than a wrong one.

import type { BFigura, Bloque } from '../../lib/tipos';
import { cargarParte, normalizar, obtenerRefs, textoPlano } from '../../lib/datos';

/** Comparable text: plain, lower case, no accents, no quotes, single spaces. */
function plano(html: string): string {
  return normalizar(textoPlano(html))
    .replace(/[«»"“”‘’'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** All the text of a block, nested blocks, list items and table cells included. */
function textoDe(b: Bloque): string {
  switch (b.t) {
    case 'p':
    case 'centrado':
    case 'h3':
    case 'h4':
      return b.html;
    case 'lista':
      return b.items.join(' ');
    case 'tabla':
      return `${b.pie ?? ''} ${b.filas.map((f) => f.join(', ')).join(' ')}`;
    case 'figura':
      return b.pie ?? '';
    case 'caja':
    case 'tarjeta':
      return b.bloques.map(textoDe).join(' ');
    case 'deduccion':
      return `${b.titulo} ${b.bloques.map(textoDe).join(' ')}`;
    case 'ejercicios':
      return b.items.map((it) => it.bloques.map(textoDe).join(' ')).join(' ');
    default:
      return '';
  }
}

/** Labels of the figures a block cites. */
function figurasCitadas(b: Bloque): string[] {
  const r: string[] = [];
  for (const m of textoDe(b).matchAll(/data-ref="(fig-[^"]+)"/g)) r.push(m[1]!);
  return r;
}

function buscarFigura(bloques: Bloque[], label: string): BFigura | null {
  for (const b of bloques) {
    if (b.t === 'figura' && b.label === label) return b;
    if ('bloques' in b && Array.isArray(b.bloques)) {
      const f = buscarFigura(b.bloques, label);
      if (f) return f;
    }
  }
  return null;
}

/** Top-level range [desde, hasta) of the block labelled `ref`: a section to the next h2, a subsection or problem to the next h3/h2. */
function tramo(bloques: Bloque[], ref: string): [number, number] | null {
  const i = bloques.findIndex((b) => b.label === ref);
  if (i < 0) return null;
  const nivel = bloques[i]!.t;
  let fin = bloques.length;
  for (let k = i + 1; k < bloques.length; k++) {
    const t = bloques[k]!.t;
    if (t === 'h2' || (nivel !== 'h2' && t === 'h3')) {
      fin = k;
      break;
    }
  }
  return [i, fin];
}

const cache = new Map<string, Promise<BFigura | null>>();

/** The figure for a question's quote, or null. */
export function figuraDeCita(parte: string, ref: string, cita: string): Promise<BFigura | null> {
  const clave = `${parte}|${ref}|${cita}`;
  let p = cache.get(clave);
  if (!p) {
    p = cargarParte(parte)
      .then((d) => buscar(d.bloques, parte, ref, cita))
      .catch(() => null);
    cache.set(clave, p);
  }
  return p;
}

function buscar(bloques: Bloque[], parte: string, ref: string, cita: string): BFigura | null {
  const r = tramo(bloques, ref);
  if (!r) return null;
  const [desde, hasta] = r;
  // The longest fragment of the quote («[…]» separates fragments), cut to a safe length.
  const trozos = cita
    .split(/\[…\]|\[\.\.\.\]/)
    .map((x) => plano(x))
    .sort((a, b) => b.length - a.length);
  const aguja = (trozos[0] ?? '').slice(0, 60);
  if (aguja.length < 16) return null;
  let j = -1;
  for (let k = desde; k < hasta; k++) {
    if (plano(textoDe(bloques[k]!)).includes(aguja)) {
      j = k;
      break;
    }
  }
  if (j < 0) return null;
  // The quote is the caption of a figure.
  const citado = bloques[j]!;
  if (citado.t === 'figura') return citado;

  // 1. A figure the quoted block cites.
  const refs = obtenerRefs();
  for (const f of figurasCitadas(bloques[j]!)) {
    if (refs[f]?.parte !== parte) continue;
    const fig = buscarFigura(bloques, f);
    if (fig) return fig;
  }
  // 2. The nearest figure, within two blocks, not across a heading.
  for (const d of [1, -1, 2, -2]) {
    const k = j + d;
    if (k < desde || k >= hasta) continue;
    const entre = d > 0 ? bloques.slice(j + 1, k) : bloques.slice(k + 1, j);
    if (entre.some((b) => b.t === 'h2' || b.t === 'h3') || (d > 0 && ['h2', 'h3'].includes(bloques[k]!.t))) continue;
    if (d < 0 && ['h2', 'h3'].includes(bloques[j]!.t)) continue;
    const b = bloques[k]!;
    if (b.t === 'figura') return b;
  }
  return null;
}
