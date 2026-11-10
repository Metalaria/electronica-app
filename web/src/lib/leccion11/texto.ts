// 1.1 lessons: the authors' short markup, turned into runs (tipos.ts Texto) that the app renders without HTML.
//   {{V_out}}   the live value of a quantity of the lesson's model (formatted with its unit)
//   _{salida}   subscript        ^{2}   superscript        **así**   bold
// Unicode subscripts (R₁, R₂) need nothing. Pure (no DOM): the generator, the validator and the app use it.

import type { Texto, Trozo } from './tipos';

/** Parses the markup; unknown or unbalanced marks stay as plain text (the validator reports them). */
export function analizarTexto(s: string): Texto {
  const out: Trozo[] = [];
  const poner = (t: Trozo) => {
    const ultimo = out[out.length - 1];
    if (t.t === 'txt' && ultimo?.t === 'txt') ultimo.s += t.s;
    else if (t.t !== 'txt' || t.s) out.push(t);
  };
  let i = 0;
  let negrita = false;
  let buf = '';
  const vaciar = () => {
    if (buf) poner(negrita ? { t: 'b', s: buf } : { t: 'txt', s: buf });
    buf = '';
  };
  while (i < s.length) {
    if (s.startsWith('{{', i)) {
      const f = s.indexOf('}}', i + 2);
      if (f > i + 2) {
        vaciar();
        poner({ t: 'val', id: s.slice(i + 2, f).trim() });
        i = f + 2;
        continue;
      }
    }
    if ((s[i] === '_' || s[i] === '^') && s[i + 1] === '{') {
      const f = s.indexOf('}', i + 2);
      if (f > i + 2) {
        vaciar();
        poner({ t: s[i] === '_' ? 'sub' : 'sup', s: s.slice(i + 2, f) });
        i = f + 1;
        continue;
      }
    }
    if (s.startsWith('**', i)) {
      vaciar();
      negrita = !negrita;
      i += 2;
      continue;
    }
    buf += s[i];
    i++;
  }
  vaciar();
  return out;
}

/** Plain text of runs; live values through `valor` (or «{id}» without it). */
export function textoPlano(t: Texto | undefined, valor?: (id: string) => string): string {
  if (!t) return '';
  return t
    .map((x) => (x.t === 'val' ? (valor ? valor(x.id) : `{${x.id}}`) : x.s))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ids of the live values a text uses. */
export function valoresDeTexto(t: Texto | undefined): string[] {
  return (t ?? []).filter((x): x is Extract<Trozo, { t: 'val' }> => x.t === 'val').map((x) => x.id);
}

/** Words of a text as a reader counts them (a live value is one word; signs and symbols alone are not). */
export function contarPalabras(t: Texto | undefined): number {
  if (!t) return 0;
  const s = t.map((x) => (x.t === 'val' ? ' valor ' : x.t === 'txt' || x.t === 'b' ? x.s : x.s)).join('');
  return s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * The numbers an author wrote in the plain runs of a text (not inside sub/superscripts nor live values): «4,00»,
 * «3,3», «25», «1 000 000» (thin or normal spaces between groups of three), «−6». Returned as written (decimal comma)
 * with their value.
 */
export function numerosDeTexto(t: Texto | undefined): { s: string; v: number; decimales: number }[] {
  if (!t) return [];
  const out: { s: string; v: number; decimales: number }[] = [];
  for (const x of t) {
    if (x.t !== 'txt' && x.t !== 'b') continue;
    out.push(...numerosDe(x.s));
  }
  return out;
}

/** The numbers of a plain string (also used on the book's text). */
export function numerosDe(s: string): { s: string; v: number; decimales: number }[] {
  const out: { s: string; v: number; decimales: number }[] = [];
  // groups of three digits joined by a space are one number («1 000 000»), never inside a word («R2», «E24», «x10»)
  const limpio = s.replace(/(\d)[    ](?=\d{3}(?!\d))/g, '$1');
  const re = /(?<![\p{L}\p{N}_.,])([-−]?)(\d+(?:[.,]\d+)?)(?![\p{N}])/gu;
  for (const m of limpio.matchAll(re)) {
    const ini = m.index ?? 0;
    // part numbers («2N3904», «74HC00») are names, not quantities
    if (/^[A-Z]{1,2}\d/.test(limpio.slice(ini + m[0].length))) continue;
    const num = m[2]!;
    const dec = num.includes(',') || num.includes('.') ? num.split(/[.,]/)[1]!.length : 0;
    const v = Number(num.replace(',', '.')) * (m[1] ? -1 : 1);
    out.push({ s: (m[1] ? '−' : '') + num, v, decimales: dec });
  }
  return out;
}

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Escaped HTML of runs, for the few reused components that take an HTML label (teoria/MandoValor.svelte). */
export function htmlDeTexto(t: Texto | undefined, valor?: (id: string) => string): string {
  return (t ?? [])
    .map((x) => {
      if (x.t === 'val') return escapar(valor ? valor(x.id) : `{${x.id}}`);
      if (x.t === 'sub') return `<sub>${escapar(x.s)}</sub>`;
      if (x.t === 'sup') return `<sup>${escapar(x.s)}</sup>`;
      if (x.t === 'b') return `<strong>${escapar(x.s)}</strong>`;
      return escapar(x.s);
    })
    .join('');
}
