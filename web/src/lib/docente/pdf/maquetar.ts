// A small page-layout engine for the «modo docente» PDF (1.0): paragraphs of the book's inline HTML (strong, em, sub,
// sup, code, br, links, inline formulas), lists, tables, display equations, figures, ruled answer space and page
// furniture, laid out on A4 pages and written with pdf-lib. Text is real text in embedded font subsets (it can be
// searched and copied); formulas and vector figures are drawn as vectors (svg.ts); photos are embedded as they are.
// Deterministic: the same document model gives the same bytes (fixed dates, seeded names, no clock).

import type { PDFDocument } from 'pdf-lib';
import { colocar, convertirSvg, num, operadorMatriz, type SvgConvertido } from './svg';
import { Fuentes, type EstiloFuente, type IdFuente, type LeerFuente } from './fuentes';

// ------------------------------------------------------------------ model

export interface EstiloTexto extends EstiloFuente {
  tam: number;
  /** Baseline shift (pt, up). */
  sube: number;
  color: [number, number, number];
}

export type Trozo =
  | { t: 'texto'; s: string; e: EstiloTexto }
  /** An inline formula: SVG path under libro/, height and vertical-align in em of the text around it. */
  | { t: 'mate'; src: string; alto: number; va: number; tam: number; alt: string }
  | { t: 'br' };

export type BloquePdf =
  | {
      k: 'parrafo';
      trozos: Trozo[];
      /** Left indent (pt). */
      sangria?: number;
      /** Hanging label (list bullet or number) drawn in the indent. */
      etiqueta?: Trozo[];
      alinear?: 'izq' | 'centro' | 'der';
      antes?: number;
      conSiguiente?: boolean;
      interlinea?: number;
    }
  | { k: 'ecuacion'; src: string; w: number; h: number; etiqueta?: Trozo[]; sangria?: number }
  | { k: 'figura'; src: string; ancho: number; pie: Trozo[]; vista?: [number, number, number, number]; tam?: [number, number] }
  | { k: 'tabla'; filas: Trozo[][][]; align: ('left' | 'center' | 'right')[]; cabecera: boolean; pie?: Trozo[]; sangria?: number }
  /** Room to answer: `lineas` ruled lines (or a blank area of that height). */
  | { k: 'espacio'; lineas: number; reglado: boolean; sangria?: number }
  | { k: 'regla'; antes?: number }
  | { k: 'salto' }
  /** Preformatted lines (code), in the monospaced font. */
  | { k: 'codigo'; lineas: string[] }
  /** A field to fill in on paper: «Nombre: ________». */
  | { k: 'campos'; campos: { rotulo: string; ancho: number }[] };

export interface Documento {
  titulo: string;
  /** Running header (left) and footer text. */
  cabecera: string;
  bloques: BloquePdf[];
  /** Fixed metadata date (ms) — never «now»: the same exam gives the same bytes. */
  fecha: number;
  asunto?: string;
}

/** Reads the book's files (equations, figures, photos) and the fonts. */
export interface Recursos {
  texto(ruta: string): Promise<string>;
  binario(ruta: string): Promise<Uint8Array>;
  fuente: LeerFuente;
  /** Optional: a PNG of an SVG the vector converter cannot draw (patterns, masks); in the app, through a canvas. */
  rasterizar?(svg: string, ancho: number, alto: number): Promise<Uint8Array | null>;
}

export interface InformePdf {
  bytes: Uint8Array;
  paginas: number;
  /** Characters no font had (drawn as «?»). Must be empty. */
  faltan: string[];
  /** Formulas and figures: drawn as vectors, rasterised, approximated (vector with an unsupported part) or missing. */
  graficos: { vector: number; raster: number; aproximados: number; fotos: number; fallidos: string[] };
  /** The text drawn, in order (for checks). */
  texto: string;
}

// ------------------------------------------------------------------ book HTML → runs

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', thinsp: ' ', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»' };
const entidades = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENT[e] ?? m),
  );

export const TEXTO: EstiloTexto = { familia: 'serif', negrita: false, cursiva: false, tam: 10.5, sube: 0, color: [0, 0, 0] };

/** The book's inline HTML (strong em sub sup code br a span img) as runs. */
export function deHtml(html: string, base: EstiloTexto = TEXTO): Trozo[] {
  const r: Trozo[] = [];
  const pila: EstiloTexto[] = [base];
  const re = /<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  const actual = () => pila[pila.length - 1]!;
  while ((m = re.exec(html))) {
    if (m[4] != null) {
      const s = entidades(m[4]).replace(/[\n\r\t]+/g, ' ');
      if (s) r.push({ t: 'texto', s, e: actual() });
      continue;
    }
    const cierra = m[1] === '/';
    const tag = m[2]!.toLowerCase();
    const attrs = m[3] ?? '';
    if (tag === 'br') {
      r.push({ t: 'br' });
      continue;
    }
    if (tag === 'img') {
      const src = /src="([^"]+)"/.exec(attrs)?.[1] ?? '';
      const alt = entidades(/alt="([^"]*)"/.exec(attrs)?.[1] ?? '');
      const estilo = /style="([^"]*)"/.exec(attrs)?.[1] ?? '';
      const alto = Number(/height:\s*([\d.]+)em/.exec(estilo)?.[1] ?? '1');
      const va = Number(/vertical-align:\s*(-?[\d.]+)em/.exec(estilo)?.[1] ?? '0');
      if (src) r.push({ t: 'mate', src, alto, va, tam: actual().tam, alt });
      continue;
    }
    if (cierra) {
      if (['strong', 'b', 'em', 'i', 'sub', 'sup', 'code', 'span', 'a', 'small'].includes(tag) && pila.length > 1) pila.pop();
      continue;
    }
    const e = { ...actual() };
    if (tag === 'strong' || tag === 'b') e.negrita = true;
    else if (tag === 'em' || tag === 'i') e.cursiva = !e.cursiva;
    else if (tag === 'sub') {
      e.sube = e.sube - e.tam * 0.18;
      e.tam = e.tam * 0.72;
    } else if (tag === 'sup') {
      e.sube = e.sube + e.tam * 0.36;
      e.tam = e.tam * 0.72;
    } else if (tag === 'code') {
      e.familia = 'mono';
      e.tam = e.tam * 0.92;
    } else if (tag === 'small') e.tam = e.tam * 0.85;
    else if (!['span', 'a'].includes(tag)) continue;
    pila.push(e);
  }
  return r;
}

/**
 * Plain text as runs. Review 10c (r10c·1): a text typed by the reader (the notes of an exam or a course) may hold line
 * breaks and tabs: a line break becomes a `br` (the lines stay apart), a tab a space, other control characters go —
 * no font has them («?»). A text without them gives exactly one run, as before (the same PDF bytes).
 */
export const texto = (s: string, e: Partial<EstiloTexto> = {}): Trozo[] => {
  const est = { ...TEXTO, ...e };
  if (!/[\u0000-\u001f\u007f]/.test(s)) return [{ t: 'texto', s, e: est }];
  const r: Trozo[] = [];
  s.replace(/\t/g, ' ')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .split(/\r\n|\r|\n/)
    .forEach((linea, i) => {
      if (i) r.push({ t: 'br' });
      if (linea) r.push({ t: 'texto', s: linea, e: est });
    });
  return r;
};

// ------------------------------------------------------------------ page

export const A4: [number, number] = [595.28, 841.89];
const MARGEN = { izq: 62, der: 62, sup: 64, inf: 64 };
const ASCENSO = 0.9;
const DESCENSO = 0.26;

interface Caja {
  w: number;
  asc: number;
  desc: number;
  /** Draws at (x, baseline) in PDF coordinates (y up). */
  dibujar(l: Lienzo, x: number, base: number): void;
  /** Breakable space after it. */
  espacio: number;
  /** Text it carries (checks and extraction order). */
  texto: string;
}

interface Renglon {
  h: number;
  antes: number;
  conSiguiente?: boolean;
  salto?: boolean;
  dibujar(l: Lienzo, x: number, yArriba: number): void;
  texto: string;
}

class Lienzo {
  ops: string[] = [];
  fuentes = new Map<IdFuente, string>();
  /** XObject name → key of the embedded image. */
  xobjetos = new Map<string, string>();
  estados = new Set<string>();
}

export async function generarPdf(docModelo: Documento, rec: Recursos): Promise<InformePdf> {
  const [{ PDFDocument, PDFName }, fontkitMod] = await Promise.all([import('pdf-lib'), import('@pdf-lib/fontkit')]);
  const fontkit = (fontkitMod as unknown as { default: unknown }).default ?? fontkitMod;
  const doc: PDFDocument = await PDFDocument.create({ updateMetadata: false });
  doc.registerFontkit(fontkit as Parameters<PDFDocument['registerFontkit']>[0]);
  const fecha = new Date(docModelo.fecha);
  doc.setTitle(docModelo.titulo);
  doc.setSubject(docModelo.asunto ?? '');
  doc.setCreator('Electrónica Práctica Avanzada');
  doc.setProducer('Electrónica Práctica Avanzada (pdf-lib)');
  doc.setCreationDate(fecha);
  doc.setModificationDate(fecha);
  doc.setLanguage('es-ES');

  const fuentes = new Fuentes(doc, fontkit as never, rec.fuente);
  const informe: InformePdf['graficos'] = { vector: 0, raster: 0, aproximados: 0, fotos: 0, fallidos: [] };

  // ---------------------------------------------------------------- resources (fonts, SVGs, images)
  const usos = new Map<string, { estilo: EstiloFuente; caracteres: Set<string> }>();
  const svgs = new Map<string, SvgConvertido | null>();
  const pngRaster = new Map<string, Uint8Array>();
  const imagenes = new Map<string, Uint8Array | null>();
  const trozosDe = (b: BloquePdf): Trozo[][] => {
    switch (b.k) {
      case 'parrafo':
        return [b.trozos, b.etiqueta ?? []];
      case 'ecuacion':
        return [b.etiqueta ?? []];
      case 'figura':
        return [b.pie];
      case 'tabla':
        return [...b.filas.flat(), b.pie ?? []];
      case 'campos':
        return [texto(b.campos.map((c) => c.rotulo).join(' '), { familia: 'sans', negrita: true, tam: 10 })];
      case 'codigo':
        return b.lineas.map((l) => texto(l, { familia: 'mono', tam: 8.8 }));
      default:
        return [];
    }
  };
  const fuentesExtra: EstiloTexto[] = [
    { ...TEXTO, familia: 'sans', tam: 8.5 },
    { ...TEXTO, familia: 'sans', negrita: true, tam: 8.5 },
  ];
  for (const e of fuentesExtra) Fuentes.anotar(usos, e, `${docModelo.cabecera} Página 0123456789 de`);
  const pendientesSvg = new Set<string>();
  for (const b of docModelo.bloques) {
    for (const ts of trozosDe(b))
      for (const t of ts) {
        if (t.t === 'texto') Fuentes.anotar(usos, t.e, t.s);
        else if (t.t === 'mate') pendientesSvg.add(t.src);
      }
    if (b.k === 'ecuacion') pendientesSvg.add(b.src);
    if (b.k === 'figura' && b.src.endsWith('.svg')) pendientesSvg.add(b.src);
    if (b.k === 'figura' && !b.src.endsWith('.svg')) imagenes.set(b.src, null);
  }
  await fuentes.preparar(usos);
  // the fonts actually drawn with
  const ids = new Set<IdFuente>();
  for (const { estilo, caracteres } of usos.values()) for (const tz of fuentes.trozos(estilo, [...caracteres].join(''))) if (tz.id) ids.add(tz.id);
  fuentes.faltan.clear();
  await fuentes.incrustar([...ids].sort());

  const transparencias = new Map<string, unknown>();
  const imagenesSvg = new Map<string, string>();
  const imagenesSvgPend: [string, string][] = [];
  const destino = {
    transparencia: (a: number, s: number) => {
      const n = `Ga${Math.round(a * 1000)}s${Math.round(s * 1000)}`;
      if (!transparencias.has(n)) transparencias.set(n, doc.context.obj({ Type: 'ExtGState', ca: a, CA: s }));
      return n;
    },
    imagen: (uri: string) => {
      let n = imagenesSvg.get(uri);
      if (!n) {
        n = `Is${imagenesSvg.size + 1}`;
        imagenesSvg.set(uri, n);
        imagenesSvgPend.push([uri, n]);
      }
      return n;
    },
  };
  for (const src of [...pendientesSvg].sort()) {
    try {
      const t = await rec.texto(src);
      const c = convertirSvg(t, destino);
      if (!c.pintados) throw new Error('vacío');
      if (c.noSoportado.length && rec.rasterizar) {
        const w = c.caja[2];
        const h = c.caja[3];
        const png = await rec.rasterizar(t, Math.round(w * 3), Math.round(h * 3)).catch(() => null);
        if (png) pngRaster.set(src, png);
      }
      svgs.set(src, c);
    } catch (e) {
      svgs.set(src, null);
      informe.fallidos.push(`${src}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const xobjetos = new Map<string, { ref: unknown; w: number; h: number }>();
  const incrustarImagen = async (clave: string, bytes: Uint8Array) => {
    const esPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    const img = esPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    xobjetos.set(clave, { ref: img.ref, w: img.width, h: img.height });
  };
  for (const [uri, n] of imagenesSvgPend) {
    const b64 = uri.slice(uri.indexOf(',') + 1);
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    await incrustarImagen(n, bin);
  }
  for (const [src, png] of pngRaster) await incrustarImagen(`R:${src}`, png);
  for (const src of [...imagenes.keys()].sort()) {
    try {
      await incrustarImagen(`F:${src}`, await rec.binario(src));
    } catch (e) {
      informe.fallidos.push(`${src}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ---------------------------------------------------------------- drawing helpers
  const nombreFuente = (l: Lienzo, id: IdFuente) => {
    let n = l.fuentes.get(id);
    if (!n) {
      n = `F${[...ids].sort().indexOf(id) + 1}`;
      l.fuentes.set(id, n);
    }
    return n;
  };
  const dibujarTexto = (l: Lienzo, id: IdFuente, s: string, e: EstiloTexto, x: number, base: number) => {
    const hex = fuentes.hex(id, s);
    l.ops.push(`BT ${num(e.color[0])} ${num(e.color[1])} ${num(e.color[2])} rg /${nombreFuente(l, id)} ${num(e.tam)} Tf 1 0 0 1 ${num(x)} ${num(base + e.sube)} Tm ${hex} Tj ET`);
  };
  const dibujarSvg = (l: Lienzo, src: string, x: number, yAbajo: number, w: number, h: number) => {
    const c = svgs.get(src);
    if (!c) return;
    const r = xobjetos.get(`R:${src}`);
    if (r) {
      l.xobjetos.set(`Ir${[...xobjetos.keys()].indexOf(`R:${src}`)}`, `R:${src}`);
      l.ops.push(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(yAbajo)} cm /Ir${[...xobjetos.keys()].indexOf(`R:${src}`)} Do Q`);
      return;
    }
    for (const n of imagenesSvg.values()) if (c.ops.includes(`/${n} Do`)) l.xobjetos.set(n, n);
    for (const n of transparencias.keys()) if (c.ops.includes(`/${n} gs`)) l.estados.add(n);
    l.ops.push(`q ${operadorMatriz(colocar(c.caja, x, yAbajo, w, h))}\n${c.ops}\nQ`);
  };
  const contarSvg = (src: string) => {
    const c = svgs.get(src);
    if (!c) return;
    if (xobjetos.has(`R:${src}`)) informe.raster++;
    else if (c.noSoportado.length) informe.aproximados++;
    else informe.vector++;
  };
  const linea = (l: Lienzo, x1: number, y1: number, x2: number, y2: number, grosor = 0.5, gris = 0.55) => {
    l.ops.push(`q ${num(gris)} G ${num(grosor)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S Q`);
  };

  // ---------------------------------------------------------------- inline boxes and line breaking
  const cajasDe = (trozos: Trozo[]): (Caja | 'br')[] => {
    const r: (Caja | 'br')[] = [];
    for (const t of trozos) {
      if (t.t === 'br') {
        r.push('br');
        continue;
      }
      if (t.t === 'mate') {
        const c = svgs.get(t.src);
        const h = t.alto * t.tam;
        const w = c && c.caja[3] ? (h * c.caja[2]) / c.caja[3] : h;
        const bajo = -t.va * t.tam;
        contarSvg(t.src);
        r.push({
          w,
          asc: Math.max(0, h - bajo),
          desc: Math.max(0, bajo),
          espacio: 0,
          texto: '',
          dibujar: (l, x, base) => dibujarSvg(l, t.src, x, base - bajo, w, h),
        });
        continue;
      }
      // words: split at breakable spaces; a non-breaking space stays inside the word
      const partes = t.s.split(/( +)/);
      for (const p of partes) {
        if (!p) continue;
        if (/^ +$/.test(p)) {
          const u = r[r.length - 1];
          const ancho = 0.25 * t.e.tam * p.length;
          if (u && u !== 'br') u.espacio = Math.max(u.espacio, ancho);
          continue;
        }
        const runs = fuentes.trozos(t.e, p.replace(/ /g, ' '));
        let w = 0;
        const piezas: { id: IdFuente | null; s: string; x: number }[] = [];
        for (const run of runs) {
          piezas.push({ id: run.id, s: run.texto, x: w });
          w += fuentes.ancho(run.id, run.texto, t.e.tam);
        }
        const e = t.e;
        r.push({
          w,
          asc: e.tam * ASCENSO + Math.max(0, e.sube),
          desc: e.tam * DESCENSO + Math.max(0, -e.sube),
          espacio: 0,
          texto: p,
          dibujar: (l, x, base) => {
            for (const pz of piezas) if (pz.id) dibujarTexto(l, pz.id, pz.s, e, x + pz.x, base);
          },
        });
      }
    }
    return r;
  };

  /** Lines of a paragraph inside width `ancho`: each [boxes, width]. Words longer than a line are split. */
  const romper = (cajas: (Caja | 'br')[], ancho: number): Caja[][] => {
    const lineas: Caja[][] = [];
    let actual: Caja[] = [];
    let w = 0;
    for (const c of cajas) {
      if (c === 'br') {
        lineas.push(actual);
        actual = [];
        w = 0;
        continue;
      }
      const prev = actual[actual.length - 1];
      const hueco = prev ? prev.espacio : 0;
      if (actual.length && w + hueco + c.w > ancho + 0.01 && hueco > 0) {
        lineas.push(actual);
        actual = [c];
        w = c.w;
      } else if (actual.length && w + hueco + c.w > ancho + 0.01 && hueco === 0) {
        // glued to the previous box (a formula after a word, a subscript…): break before the glued group only if it
        // fits on a line of its own; otherwise let it overflow at the right margin (rare)
        let k = actual.length - 1;
        while (k > 0 && actual[k - 1]!.espacio === 0) k--;
        const grupo = actual.slice(k);
        const wGrupo = grupo.reduce((a, x, i) => a + x.w + (i < grupo.length - 1 ? x.espacio : 0), 0) + c.w;
        if (k > 0 && wGrupo <= ancho) {
          lineas.push(actual.slice(0, k));
          actual = [...grupo, c];
          w = wGrupo;
        } else {
          actual.push(c);
          w += hueco + c.w;
        }
      } else {
        actual.push(c);
        w += hueco + c.w;
      }
    }
    if (actual.length) lineas.push(actual);
    return lineas;
  };

  const anchoLinea = (l: Caja[]) => l.reduce((a, c, i) => a + c.w + (i < l.length - 1 ? c.espacio : 0), 0);

  const renglonesParrafo = (trozos: Trozo[], ancho: number, o: { alinear?: 'izq' | 'centro' | 'der'; antes?: number; conSiguiente?: boolean; etiqueta?: Trozo[]; sangria?: number; interlinea?: number }): Renglon[] => {
    const sangria = o.sangria ?? 0;
    const lineas = romper(cajasDe(trozos), ancho - sangria);
    const etiqueta = o.etiqueta?.length ? romper(cajasDe(o.etiqueta), 1e6)[0] ?? [] : [];
    const tamBase = trozos.find((t): t is Extract<Trozo, { t: 'texto' }> => t.t === 'texto')?.e.tam ?? TEXTO.tam;
    const inter = o.interlinea ?? 1.32;
    return lineas.map((l, i) => {
      const asc = Math.max(tamBase * ASCENSO, ...l.map((c) => c.asc), ...(i === 0 ? etiqueta.map((c) => c.asc) : []));
      const desc = Math.max(tamBase * DESCENSO, ...l.map((c) => c.desc));
      const h = Math.max(tamBase * inter, asc + desc + tamBase * 0.12);
      const extra = h - (asc + desc);
      return {
        h,
        antes: i === 0 ? (o.antes ?? 0) : 0,
        conSiguiente: o.conSiguiente || (i < lineas.length - 1 && (i === 0 || i === lineas.length - 2)),
        texto: l.map((c) => c.texto).join(' '),
        dibujar: (lz, x, yArriba) => {
          const base = yArriba - extra / 2 - asc;
          const w = anchoLinea(l);
          let x0 = x + sangria;
          if (o.alinear === 'centro') x0 = x + sangria + (ancho - sangria - w) / 2;
          else if (o.alinear === 'der') x0 = x + ancho - w;
          if (i === 0 && etiqueta.length) {
            const we = anchoLinea(etiqueta);
            let xe = x + sangria - we - 4;
            for (const c of etiqueta) {
              c.dibujar(lz, xe, base);
              xe += c.w + c.espacio;
            }
          }
          for (const c of l) {
            c.dibujar(lz, x0, base);
            x0 += c.w + c.espacio;
          }
        },
      };
    });
  };

  // ---------------------------------------------------------------- blocks → rows
  const [anchoPag, altoPag] = A4;
  const anchoCol = anchoPag - MARGEN.izq - MARGEN.der;
  const altoUtil = altoPag - MARGEN.sup - MARGEN.inf;
  const renglones: Renglon[] = [];

  // 1.0 performance: the page gets the thread back every ~30 ms of layout or drawing (a long exam's solutions kept
  // it 2–5 s in one task on a tablet-like CPU); the order of the work, and so the PDF's bytes, does not change
  let corte = performance.now();
  const quizaCeder = async () => {
    if (performance.now() - corte < 30) return;
    await new Promise<void>((r) => setTimeout(r, 0));
    corte = performance.now();
  };

  for (const b of docModelo.bloques) {
    await quizaCeder();
    switch (b.k) {
      case 'parrafo':
        renglones.push(...renglonesParrafo(b.trozos, anchoCol, b));
        break;
      case 'ecuacion': {
        const c = svgs.get(b.src);
        contarSvg(b.src);
        const sangria = b.sangria ?? 0;
        const etiqueta = b.etiqueta?.length ? romper(cajasDe(b.etiqueta), 1e6)[0] ?? [] : [];
        const we = etiqueta.length ? anchoLinea(etiqueta) + 12 : 0;
        let esc = TEXTO.tam / 10.5;
        const libre = anchoCol - sangria - 2 * we;
        if (b.w * esc > libre) esc = libre / b.w;
        const w = b.w * esc;
        const h = b.h * esc;
        renglones.push({
          h: h + 8,
          antes: 3,
          texto: '',
          dibujar: (l, x, yArriba) => {
            if (c) dibujarSvg(l, b.src, x + sangria + (anchoCol - sangria - w) / 2, yArriba - 4 - h, w, h);
            if (etiqueta.length) {
              let xe = x + anchoCol - anchoLinea(etiqueta);
              for (const k of etiqueta) {
                k.dibujar(l, xe, yArriba - 4 - h / 2 - 3);
                xe += k.w + k.espacio;
              }
            }
          },
        });
        break;
      }
      case 'figura': {
        const esSvg = b.src.endsWith('.svg');
        const c = esSvg ? svgs.get(b.src) : null;
        const img = esSvg ? null : xobjetos.get(`F:${b.src}`);
        const prop = c ? c.caja[3] / (c.caja[2] || 1) : img ? img.h / (img.w || 1) : b.tam ? b.tam[1] / b.tam[0] : b.vista ? b.vista[3] / b.vista[2] : 0.6;
        let w = Math.min(1, b.ancho || 0.8) * anchoCol;
        let h = w * prop;
        const maxH = altoUtil * 0.55;
        if (h > maxH) {
          h = maxH;
          w = h / prop;
        }
        if (esSvg) contarSvg(b.src);
        else if (img) informe.fotos++;
        renglones.push({
          h: h + 8,
          antes: 6,
          conSiguiente: true,
          texto: '',
          dibujar: (l, x, yArriba) => {
            const x0 = x + (anchoCol - w) / 2;
            if (esSvg) dibujarSvg(l, b.src, x0, yArriba - 4 - h, w, h);
            else if (img) {
              const n = `Ifig${[...xobjetos.keys()].indexOf(`F:${b.src}`)}`;
              l.xobjetos.set(n, `F:${b.src}`);
              l.ops.push(`q ${num(w)} 0 0 ${num(h)} ${num(x0)} ${num(yArriba - 4 - h)} cm /${n} Do Q`);
            }
          },
        });
        renglones.push(...renglonesParrafo(b.pie, anchoCol, { alinear: 'centro', antes: 2 }));
        break;
      }
      case 'tabla': {
        const sangria = b.sangria ?? 0;
        const n = Math.max(...b.filas.map((f) => f.length), 1);
        const pad = 3;
        const celdas = b.filas.map((f) => f.map((t) => cajasDe(t)));
        const maxC = new Array<number>(n).fill(0);
        const minC = new Array<number>(n).fill(0);
        for (const f of celdas)
          f.forEach((cs, j) => {
            const lineas = romper(cs, 1e6);
            maxC[j] = Math.max(maxC[j]!, ...lineas.map(anchoLinea), 0) + 2 * pad;
            minC[j] = Math.max(minC[j]!, ...cs.filter((c): c is Caja => c !== 'br').map((c) => c.w), 0) + 2 * pad;
          });
        const disponible = anchoCol - sangria;
        const sumMax = maxC.reduce((a, x) => a + x, 0);
        const sumMin = minC.reduce((a, x) => a + x, 0);
        let anchos: number[];
        if (sumMax <= disponible) anchos = maxC;
        else if (sumMin >= disponible) anchos = minC.map((x) => (x * disponible) / sumMin);
        else anchos = maxC.map((x, j) => minC[j]! + ((x - minC[j]!) * (disponible - sumMin)) / (sumMax - sumMin));
        const total = anchos.reduce((a, x) => a + x, 0);
        celdas.forEach((f, i) => {
          const lineasCelda = f.map((cs, j) => romper(cs, anchos[j]! - 2 * pad));
          const altos = lineasCelda.map((ls) => ls.reduce((a, l) => a + Math.max(TEXTO.tam * 1.25, Math.max(0, ...l.map((c) => c.asc)) + Math.max(0, ...l.map((c) => c.desc)) + 1), 0));
          const h = Math.max(TEXTO.tam * 1.25, ...altos) + 2 * pad;
          const cab = b.cabecera && i === 0;
          renglones.push({
            h,
            antes: i === 0 ? 6 : 0,
            conSiguiente: cab,
            texto: lineasCelda.map((ls) => ls.map((l) => l.map((c) => c.texto).join(' ')).join(' ')).join(' | '),
            dibujar: (l, x, yArriba) => {
              let xc = x + sangria;
              if (i === 0) linea(l, x + sangria, yArriba, x + sangria + total, yArriba, cab ? 0.9 : 0.5, 0.3);
              lineasCelda.forEach((ls, j) => {
                let y = yArriba - pad;
                const al = b.align[j] ?? 'left';
                for (const ln of ls) {
                  const asc = Math.max(TEXTO.tam * ASCENSO * 0.95, ...ln.map((c) => c.asc));
                  const desc = Math.max(TEXTO.tam * DESCENSO, ...ln.map((c) => c.desc));
                  const hl = Math.max(TEXTO.tam * 1.25, asc + desc + 1);
                  const wl = anchoLinea(ln);
                  let x0 = xc + pad;
                  if (al === 'center') x0 = xc + (anchos[j]! - wl) / 2;
                  else if (al === 'right') x0 = xc + anchos[j]! - pad - wl;
                  const base = y - (hl - asc - desc) / 2 - asc;
                  for (const c of ln) {
                    c.dibujar(l, x0, base);
                    x0 += c.w + c.espacio;
                  }
                  y -= hl;
                }
                xc += anchos[j]!;
              });
              linea(l, x + sangria, yArriba - h, x + sangria + total, yArriba - h, cab || i === celdas.length - 1 ? 0.9 : 0.4, cab || i === celdas.length - 1 ? 0.3 : 0.7);
            },
          });
        });
        if (b.pie?.length) renglones.push(...renglonesParrafo(b.pie, anchoCol, { alinear: 'centro', antes: 3 }));
        break;
      }
      case 'espacio': {
        const paso = 22;
        const sangria = b.sangria ?? 0;
        for (let k = 0; k < b.lineas; k++)
          renglones.push({
            h: paso,
            antes: k === 0 ? 4 : 0,
            texto: '',
            dibujar: (l, x, yArriba) => {
              if (b.reglado) linea(l, x + sangria, yArriba - paso + 4, x + anchoCol, yArriba - paso + 4, 0.4, 0.72);
            },
          });
        break;
      }
      case 'regla':
        renglones.push({ h: 8, antes: b.antes ?? 6, texto: '', dibujar: (l, x, y) => linea(l, x, y - 4, x + anchoCol, y - 4, 0.6, 0.5) });
        break;
      case 'codigo':
        b.lineas.forEach((ln, k) => {
          const cs = cajasDe(texto(ln.replace(/\t/g, '    ').replace(/ /g, '\u00a0') || '\u00a0', { familia: 'mono', tam: 8.8 }));
          renglones.push({
            h: 11.5,
            antes: k === 0 ? 5 : 0,
            texto: ln,
            dibujar: (l, x, y) => {
              let x0 = x + 10;
              for (const c of cs) if (c !== 'br') {
                c.dibujar(l, x0, y - 9);
                x0 += c.w + c.espacio;
              }
            },
          });
        });
        break;
      case 'salto':
        renglones.push({ h: 0, antes: 0, salto: true, texto: '', dibujar: () => undefined });
        break;
      case 'campos': {
        const e: EstiloTexto = { ...TEXTO, familia: 'sans', negrita: true, tam: 10 };
        const items = b.campos.map((c) => ({ cajas: romper(cajasDe(texto(c.rotulo, e)), 1e6)[0] ?? [], ancho: c.ancho }));
        renglones.push({
          h: 26,
          antes: 6,
          texto: b.campos.map((c) => c.rotulo).join(' '),
          dibujar: (l, x, yArriba) => {
            let x0 = x;
            const base = yArriba - 18;
            const libre = anchoCol - items.reduce((a, it) => a + anchoLinea(it.cajas) + 6, 0) - (items.length - 1) * 14;
            const pesos = items.reduce((a, it) => a + it.ancho, 0) || 1;
            for (const it of items) {
              let xc = x0;
              for (const c of it.cajas) {
                c.dibujar(l, xc, base);
                xc += c.w + c.espacio;
              }
              const wl = (libre * it.ancho) / pesos;
              linea(l, xc + 4, base - 2, xc + 4 + wl, base - 2, 0.6, 0.35);
              x0 = xc + 4 + wl + 14;
            }
          },
        });
        break;
      }
    }
  }

  // ---------------------------------------------------------------- pagination
  const paginas: Renglon[][] = [[]];
  let usado = 0;
  for (let i = 0; i < renglones.length; i++) {
    const r = renglones[i]!;
    if (r.salto) {
      if (paginas[paginas.length - 1]!.length) {
        paginas.push([]);
        usado = 0;
      }
      continue;
    }
    const antes = usado === 0 ? 0 : r.antes;
    // keep a heading (or a table head, a figure and its caption) with what follows
    let bloque = r.h + antes;
    for (let k = i; renglones[k]?.conSiguiente && k + 1 < renglones.length && k < i + 6; k++) bloque += renglones[k + 1]!.h + renglones[k + 1]!.antes;
    if (usado > 0 && (usado + antes + r.h > altoUtil || usado + antes + Math.min(bloque, altoUtil * 0.4) > altoUtil)) {
      paginas.push([]);
      usado = 0;
    }
    paginas[paginas.length - 1]!.push({ ...r, antes: usado === 0 ? 0 : r.antes });
    usado += (usado === 0 ? 0 : r.antes) + r.h;
  }
  if (!paginas[paginas.length - 1]!.length && paginas.length > 1) paginas.pop();

  const pie: EstiloTexto = { ...TEXTO, familia: 'sans', tam: 8.5, color: [0.33, 0.33, 0.33] };
  const textos: string[] = [];
  for (const [p, rs] of paginas.entries()) {
    await quizaCeder();
    const pagina = doc.addPage(A4);
    const l = new Lienzo();
    let y = altoPag - MARGEN.sup;
    for (const r of rs) {
      y -= r.antes;
      r.dibujar(l, MARGEN.izq, y);
      if (r.texto) textos.push(r.texto);
      y -= r.h;
    }
    // furniture: running title on top (not on the first page, which has its own heading) and «Página n de N»
    const cajasPie = romper(cajasDe(texto(`Página ${p + 1} de ${paginas.length}`, pie)), 1e6)[0] ?? [];
    let xp = anchoPag - MARGEN.der - anchoLinea(cajasPie);
    for (const c of cajasPie) {
      c.dibujar(l, xp, MARGEN.inf - 28);
      xp += c.w + c.espacio;
    }
    if (p > 0) {
      const cajasCab = romper(cajasDe(texto(docModelo.cabecera, pie)), 1e6)[0] ?? [];
      let xc = MARGEN.izq;
      for (const c of cajasCab) {
        c.dibujar(l, xc, altoPag - MARGEN.sup + 26);
        xc += c.w + c.espacio;
      }
      linea(l, MARGEN.izq, altoPag - MARGEN.sup + 20, anchoPag - MARGEN.der, altoPag - MARGEN.sup + 20, 0.4, 0.7);
    }
    // resources of the page
    for (const [id, n] of [...l.fuentes].sort((a, b) => a[1].localeCompare(b[1]))) {
      const f = fuentes.pdf(id);
      if (f) pagina.node.setFontDictionary(PDFName.of(n), f.ref);
    }
    for (const [n, clave] of [...l.xobjetos].sort((a, b) => a[0].localeCompare(b[0]))) {
      const x = xobjetos.get(clave);
      if (x) pagina.node.setXObject(PDFName.of(n), x.ref as never);
    }
    for (const n of [...l.estados].sort()) pagina.node.setExtGState(PDFName.of(n), transparencias.get(n) as never);
    const flujo = doc.context.flateStream(l.ops.join('\n'));
    pagina.node.addContentStream(doc.context.register(flujo));
  }

  const bytes = await doc.save({ useObjectStreams: false });
  return { bytes, paginas: paginas.length, faltan: [...fuentes.faltan].sort(), graficos: informe, texto: textos.join('\n') };
}
