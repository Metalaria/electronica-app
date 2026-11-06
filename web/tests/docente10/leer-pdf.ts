// Reads a PDF back with pdf.js (pdfjs-dist, legacy build for Node): pages, text per page, fonts (embedded or not) and
// the drawing operators that are not text (formulas and figures are paths).
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface PdfLeido {
  paginas: number;
  texto: string[];
  /** Fonts used, by name, with whether they are embedded (a missing glyph would need a non-embedded font). */
  fuentes: { nombre: string; incrustada: boolean }[];
  /** Filled shapes per page (fill operators): the glyphs of formulas, figures. */
  rellenos: number[];
  /** Images drawn per page. */
  imagenes: number[];
  titulo: string;
}

export async function leerPdf(bytes: Uint8Array): Promise<PdfLeido> {
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, disableFontFace: true, isEvalSupported: false }).promise;
  const texto: string[] = [];
  const rellenos: number[] = [];
  const RELLENOS = new Set([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke]);
  const imagenes: number[] = [];
  const fuentes = new Map<string, boolean>();
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const t = await p.getTextContent();
    texto.push(t.items.map((x) => ('str' in x ? x.str + (x.hasEOL ? '\n' : '') : '')).join(''));
    const ops = await p.getOperatorList();
    rellenos.push(ops.fnArray.filter((f) => RELLENOS.has(f)).length);
    imagenes.push(ops.fnArray.filter((f) => f === OPS.paintImageXObject).length);
    for (const [k, f] of ops.fnArray.entries()) {
      if (f !== OPS.setFont) continue;
      const id = (ops.argsArray[k] as [string])[0];
      const obj = p.commonObjs.has(id) ? (p.commonObjs.get(id) as { name?: string; missingFile?: boolean }) : null;
      if (obj) fuentes.set(obj.name ?? id, !obj.missingFile);
    }
  }
  const meta = await doc.getMetadata();
  const info = meta.info as { Title?: string };
  await doc.destroy();
  return { paginas: doc.numPages, texto, fuentes: [...fuentes].map(([nombre, incrustada]) => ({ nombre, incrustada })), rellenos, imagenes, titulo: info.Title ?? '' };
}

/** Text without line breaks or repeated spaces (pdf.js splits lines and runs), NFKC (pdf.js reads µ as μ). */
export const plano = (s: string) => s.normalize('NFKC').replace(/\s+/g, ' ').trim();
