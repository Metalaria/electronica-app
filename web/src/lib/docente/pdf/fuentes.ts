// The fonts of the «modo docente» PDF: the app's own (Source Serif 4 for the text, Source Sans 3 for headings and
// labels, Source Code Pro for code; the woff2 files of @fontsource, split by Unicode subsets), embedded as subsets,
// with DejaVu Sans as the last resort for the symbols they lack (≈ √ → ≤ ∞, sub/superscript digits…). Every
// character gets the first font of its chain that has it; one that none has is reported (`faltan`), never silently
// dropped. The caller says how to read a font file (fetch in the app, the file system in the tests).

import type { PDFDocument, PDFFont } from 'pdf-lib';
import { sfntDeWoff } from '../../woff';

export type Familia = 'serif' | 'sans' | 'mono';

export interface EstiloFuente {
  familia: Familia;
  negrita: boolean;
  cursiva: boolean;
}

/** File id: «<paquete>/<subconjunto>-<peso>-<estilo>», e.g. «source-serif-4/latin-700-normal». */
export type IdFuente = string;

const PAQUETE: Record<Familia, string> = { serif: 'source-serif-4', sans: 'source-sans-3', mono: 'source-code-pro' };
const SUBCONJUNTOS = ['latin', 'latin-ext', 'greek'];
export const RESPALDO: IdFuente = 'dejavu-sans/latin-400-normal';

/** The fonts tried for a style, in order. */
export function cadena(e: EstiloFuente): IdFuente[] {
  const peso = e.negrita ? 700 : 400;
  const estilo = e.cursiva && e.familia !== 'mono' ? 'italic' : 'normal';
  const p = PAQUETE[e.familia];
  const pesoReal = e.familia === 'mono' ? 400 : peso;
  return [...SUBCONJUNTOS.map((s) => `${p}/${s}-${pesoReal}-${estilo}`), RESPALDO];
}

/** Every font file the PDF may use (the app bundles exactly these). */
export function todasLasFuentes(): IdFuente[] {
  const r = new Set<IdFuente>();
  for (const familia of ['serif', 'sans', 'mono'] as Familia[])
    for (const negrita of [false, true]) for (const cursiva of [false, true]) cadena({ familia, negrita, cursiva }).forEach((x) => r.add(x));
  return [...r].sort();
}

export type LeerFuente = (id: IdFuente) => Promise<Uint8Array>;

interface Fontkit {
  create(b: Uint8Array): { hasGlyphForCodePoint(cp: number): boolean };
}

const claveEstilo = (e: EstiloFuente) => `${e.familia}|${e.negrita ? 1 : 0}|${e.cursiva ? 1 : 0}`;

/** Characters drawn as a space of their own width (never looked up in a font). */
export const ESPACIOS: Record<string, number> = { ' ': 0.17, ' ': 0.17, ' ': 0.1, ' ': 0.5, ' ': 1, ' ': 0.5, ' ': 0.25 };
/** Invisible characters (dropped). */
export const INVISIBLES = /[­​-‍⁠﻿]/g;

export class Fuentes {
  private bytes = new Map<IdFuente, Uint8Array>();
  private cobertura = new Map<IdFuente, { hasGlyphForCodePoint(cp: number): boolean }>();
  private incrustadas = new Map<IdFuente, PDFFont>();
  private cache = new Map<string, IdFuente | null>();
  private anchos = new Map<string, number>();
  private hexes = new Map<string, string>();
  /** Characters no font has (shown as «?»). */
  readonly faltan = new Set<string>();

  constructor(
    private doc: PDFDocument,
    private fontkit: Fontkit,
    private leer: LeerFuente,
  ) {}

  private async archivo(id: IdFuente): Promise<boolean> {
    if (this.cobertura.has(id)) return true;
    try {
      // 1.0 performance: fontkit inflates a WOFF table again on every access (80 % of a PDF's time); the same font as
      // an sfnt is read straight from the buffer — same glyphs, same PDF bytes (lib/woff.ts)
      const b = await sfntDeWoff(await this.leer(id));
      this.bytes.set(id, b);
      this.cobertura.set(id, this.fontkit.create(b));
      return true;
    } catch (e) {
      console.warn('fuente no disponible', id, e);
      return false;
    }
  }

  /** Loads what the texts need: for each style, the fonts of its chain until every character has one. */
  async preparar(usos: Map<string, { estilo: EstiloFuente; caracteres: Set<string> }>): Promise<void> {
    for (const { estilo, caracteres } of usos.values()) {
      let pendientes = [...caracteres].filter((c) => !(c in ESPACIOS) && c !== ' ');
      for (const id of cadena(estilo)) {
        if (!pendientes.length) break;
        if (!(await this.archivo(id))) continue;
        const f = this.cobertura.get(id)!;
        pendientes = pendientes.filter((c) => !f.hasGlyphForCodePoint(c.codePointAt(0)!));
      }
    }
  }

  /** The font of a character in a style (null: none has it). Only fonts prepared before are consulted. */
  idPara(e: EstiloFuente, c: string): IdFuente | null {
    const k = `${claveEstilo(e)}|${c}`;
    const enCache = this.cache.get(k);
    if (enCache !== undefined) return enCache;
    let r: IdFuente | null = null;
    for (const id of cadena(e)) {
      const f = this.cobertura.get(id);
      if (f?.hasGlyphForCodePoint(c.codePointAt(0)!)) {
        r = id;
        break;
      }
    }
    this.cache.set(k, r);
    return r;
  }

  /** The embedded font (embedded on first use, so the PDF only carries the fonts it draws with). */
  async incrustar(ids: Iterable<IdFuente>): Promise<void> {
    for (const id of ids) {
      if (this.incrustadas.has(id)) continue;
      const b = this.bytes.get(id);
      if (!b) continue;
      const nombre = id.replace(/[^A-Za-z0-9]+/g, '');
      this.incrustadas.set(id, await this.doc.embedFont(b, { subset: true, customName: nombre }));
    }
  }

  pdf(id: IdFuente): PDFFont | undefined {
    return this.incrustadas.get(id);
  }

  /** Splits a text into runs of one font each («?» for what no font has). */
  trozos(e: EstiloFuente, texto: string): { id: IdFuente | null; texto: string }[] {
    const r: { id: IdFuente | null; texto: string }[] = [];
    for (const c of texto.replace(INVISIBLES, '')) {
      let id: IdFuente | null;
      let t = c;
      if (c === ' ' || c in ESPACIOS) id = null;
      else {
        id = this.idPara(e, c);
        if (!id) {
          this.faltan.add(c);
          id = this.idPara(e, '?');
          t = '?';
        }
      }
      const u = r[r.length - 1];
      if (u && u.id === id && id !== null) u.texto += t;
      else r.push({ id, texto: t });
    }
    return r;
  }

  /** Width of a run in points. */
  ancho(id: IdFuente | null, texto: string, tam: number): number {
    if (id === null) {
      let w = 0;
      for (const c of texto) w += c === ' ' ? 0.25 * tam : (ESPACIOS[c] ?? 0.25) * tam;
      return w;
    }
    const f = this.incrustadas.get(id);
    if (!f) return texto.length * tam * 0.5;
    // 1.0 performance: fontkit shapes the text again on every call (half of a PDF's time went to measuring the same
    // words over and over); the width of a run in a font at a size never changes
    const k = `${id}\u0001${tam}\u0001${texto}`;
    let w = this.anchos.get(k);
    if (w === undefined) {
      w = f.widthOfTextAtSize(texto, tam);
      this.anchos.set(k, w);
    }
    return w;
  }

  /**
   * The run as the hex string of the embedded subset's glyph ids, remembered per font and text (1.0 performance:
   * `encodeText` shapes it again each time; once its glyphs are in the subset the same text always gives the same ids).
   */
  hex(id: IdFuente, texto: string): string {
    const k = `${id}\u0001${texto}`;
    let h = this.hexes.get(k);
    if (h === undefined) {
      h = (this.incrustadas.get(id) as PDFFont).encodeText(texto).toString();
      this.hexes.set(k, h);
    }
    return h;
  }

  /** Records the characters a text needs in a style (for `preparar`). */
  static anotar(usos: Map<string, { estilo: EstiloFuente; caracteres: Set<string> }>, e: EstiloFuente, texto: string): void {
    const k = claveEstilo(e);
    let u = usos.get(k);
    if (!u) usos.set(k, (u = { estilo: e, caracteres: new Set() }));
    for (const c of texto.replace(INVISIBLES, '')) u.caracteres.add(c);
    u.caracteres.add('?');
  }
}
