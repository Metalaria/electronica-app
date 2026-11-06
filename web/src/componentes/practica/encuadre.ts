// The crop of a book figure to one of its schematics for a challenge («reto») or a fault-finding case («avería»), and
// the texts of the figure to hide in it (QA 1.0, findings 2 and 3). Pure: the generators (retos10.mjs, averias10.mjs)
// run it in Node over the figure SVG, and the tests check every crop with it.
//
// The figure SVG (pdftocairo) draws its texts as glyph <use> elements and everything else as <path>s. A crop is the
// schematic's box plus a margin for its labels; then
//   - any drawn object that does not touch the schematic (another drawing, a graph, an explanation box, a formula)
//     and crosses the crop's edge pushes that edge back until it is out (never into the schematic);
//   - the texts that remain cut by the edge are hidden whole, and so are, inside the crop, the book's annotations: the
//     texts in an annotation colour (the readings, currents and results the book writes in red, blue, green… — they
//     give away the challenge's answer or, in a faulty circuit, show the healthy values) unless they label a part
//     drawn in that same colour (a highlighted «Rₓ 1010 Ω»), and the labels the schematic data marks as readings
//     («1,52 V» beside R₁): a part's label that is a voltage or current and not the part's own value.
// Hidden texts are painted over with the plate's colour by the app (`fuente.ocultar`, boxes in SVG units).

import { leerXml, leerTransform, multiplicar, trazado, IDENTIDAD, type Matriz, type Nodo } from '../../lib/docente/pdf/svg';

export type Caja = [number, number, number, number];

/** A run of glyphs on one baseline (a word or a short label). */
export interface TextoFigura {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  /** Visible glyphs. */
  n: number;
  /** Baseline (the glyphs' y). */
  base: number;
}

export interface ObjetosFigura {
  textos: TextoFigura[];
  /** Boxes of the drawn paths (not glyphs), with their stroke. */
  trazos: Caja[];
}

interface Glifo {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  base: number;
  ox: number;
  color: string;
}

const aplicar = (m: Matriz, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** Box of a path's `d` (control points included: a slightly larger box, never a smaller one). */
function cajaTrazado(d: string): Caja | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of trazado(d).split('\n')) {
    const v = l.trim().split(/\s+/).slice(0, -1).map(Number);
    for (let i = 0; i + 1 < v.length; i += 2) {
      x0 = Math.min(x0, v[i]!);
      x1 = Math.max(x1, v[i]!);
      y0 = Math.min(y0, v[i + 1]!);
      y1 = Math.max(y1, v[i + 1]!);
    }
  }
  return Number.isFinite(x0) ? [x0, y0, x1 - x0, y1 - y0] : null;
}

function transformarCaja(m: Matriz, c: Caja): Caja {
  const ps = [aplicar(m, c[0], c[1]), aplicar(m, c[0] + c[2], c[1]), aplicar(m, c[0], c[1] + c[3]), aplicar(m, c[0] + c[2], c[1] + c[3])];
  const xs = ps.map((p) => p[0]);
  const ys = ps.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
}

const NO_DIBUJADO = new Set(['defs', 'clipPath', 'mask', 'pattern', 'symbol', 'filter', 'title', 'desc']);
const blanco = (c: string | undefined) => !!c && /^(#fff(fff)?|white|rgb\(100%,\s*100%,\s*100%\))$/i.test(c.trim());

/** The texts (glyph runs) and drawn paths of a figure SVG, in SVG units of its viewBox. */
export function objetosDeSvg(texto: string): ObjetosFigura {
  const raiz = leerXml(texto);
  const porId = new Map<string, Nodo>();
  const indexar = (n: Nodo) => {
    if (n.attrs.id) porId.set(n.attrs.id, n);
    for (const h of n.hijos) indexar(h);
  };
  indexar(raiz);
  const cajasGlifo = new Map<string, Caja | null>();
  const cajaGlifo = (id: string): Caja | null => {
    if (cajasGlifo.has(id)) return cajasGlifo.get(id)!;
    let caja: Caja | null = null;
    const juntar = (n: Nodo) => {
      if (n.nombre === 'path' && n.attrs.d) {
        const c = cajaTrazado(n.attrs.d);
        if (c) caja = caja ? unirCajas(caja, c) : c;
      }
      for (const h of n.hijos) juntar(h);
    };
    const g = porId.get(id);
    if (g) juntar(g);
    cajasGlifo.set(id, caja);
    return caja;
  };
  const glifos: Glifo[] = [];
  const trazos: Caja[] = [];
  const recorrer = (n: Nodo, m: Matriz, relleno: string | undefined, trazo: string | undefined, grosor: number) => {
    if (NO_DIBUJADO.has(n.nombre)) return;
    const local = n.attrs.transform ? multiplicar(leerTransform(n.attrs.transform), m) : m;
    const f = n.attrs.fill ?? relleno;
    const s = n.attrs.stroke ?? trazo;
    const sw = n.attrs['stroke-width'] != null ? Number(n.attrs['stroke-width']) || 0 : grosor;
    if (n.nombre === 'use') {
      const id = (n.attrs['xlink:href'] ?? n.attrs.href ?? '').replace(/^#/, '');
      const x = Number(n.attrs.x ?? 0);
      const y = Number(n.attrs.y ?? 0);
      const mu = multiplicar([1, 0, 0, 1, x, y], local);
      const c = cajaGlifo(id);
      if (c && (c[2] > 0 || c[3] > 0)) {
        const b = transformarCaja(mu, c);
        const [ox, base] = aplicar(mu, 0, 0);
        glifos.push({ x0: b[0], y0: b[1], x1: b[0] + b[2], y1: b[1] + b[3], base, ox, color: (f ?? '#000000').toLowerCase() });
      }
      return;
    }
    if (n.nombre === 'path' && n.attrs.d) {
      const conTrazo = !!s && s !== 'none';
      const visible = conTrazo || (f !== 'none' && !blanco(f));
      const c = visible ? cajaTrazado(n.attrs.d) : null;
      if (c) {
        const b = transformarCaja(local, c);
        const e = conTrazo ? sw / 2 : 0;
        trazos.push([b[0] - e, b[1] - e, b[2] + 2 * e, b[3] + 2 * e]);
      }
      return;
    }
    for (const h of n.hijos) recorrer(h, local, f, s, sw);
  };
  recorrer(raiz, IDENTIDAD, undefined, undefined, 1);
  return { textos: renglones(glifos), trazos };
}

function unirCajas(a: Caja, b: Caja): Caja {
  const x0 = Math.min(a[0], b[0]);
  const y0 = Math.min(a[1], b[1]);
  return [x0, y0, Math.max(a[0] + a[2], b[0] + b[2]) - x0, Math.max(a[1] + a[3], b[1] + b[3]) - y0];
}

/**
 * Glyphs in document order grouped into runs: same colour, the next one close after the previous, on the run's
 * baseline (counted in `n`) or a little above or below it (a subscript or superscript: inside the run, not counted).
 */
function renglones(gs: Glifo[]): TextoFigura[] {
  const r: TextoFigura[] = [];
  let a: Glifo[] = [];
  let n = 0;
  const cerrar = () => {
    if (!a.length) return;
    const x0 = Math.min(...a.map((g) => g.x0));
    const y0 = Math.min(...a.map((g) => g.y0));
    const x1 = Math.max(...a.map((g) => g.x1));
    const y1 = Math.max(...a.map((g) => g.y1));
    r.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, color: a[0]!.color, n, base: a[0]!.base });
    a = [];
    n = 0;
  };
  for (const g of gs) {
    const p = a[0];
    const u = a[a.length - 1];
    const alto = p ? Math.max(p.y1 - p.y0, 4) : 0;
    const d = p ? Math.abs(g.base - p.base) : 0;
    const cerca = !!u && g.color === u.color && g.ox > u.ox && g.x0 - Math.max(...a.map((q) => q.x1)) < 0.9 * alto;
    if (cerca && d < 0.3) {
      a.push(g);
      n++;
    } else if (cerca && d <= 0.7 * alto) a.push(g);
    else {
      cerrar();
      a = [g];
      n = 1;
    }
  }
  cerrar();
  return r;
}

// ------------------------------------------------------------------ the crop

/** The schematic as the data describes it (figuras-vivas Esquema, only what the crop needs). */
export interface EsquemaEncuadre {
  dibujo_a_svg: { sx: number; tx: number; sy: number; ty: number };
  puntos: { xy: [number, number] }[];
  elementos: {
    id: string;
    rol: string;
    caja?: number[] | null;
    anclas?: Record<string, [number, number]>;
    color?: string | null;
    etiquetas?: string[];
    valor_texto?: string | null;
  }[];
}

export interface Encuadre {
  recorte: Caja;
  /** Texts to paint over (SVG units), each box slightly larger than its glyphs. */
  ocultar: Caja[];
}

/** Colours of the schematic's own lines and labels; any other colour on a text is an annotation of the book. */
// (the grey #5d6d7e is the book's colour for side notes such as «V_R = 3 V»: an annotation)
const NEUTROS = new Set(['#1a3a5c', '#000000', '#000']);
/** A reading written as a label: «1,52 V», «I = 15,2 mA», «2,8 V / 50 mA» (a part's own value is not one). */
const LECTURA = /\d\s*(?:[munµpk]|µ)?(?:V|A)\b/;
const sinBlancos = (t: string) => t.replace(/[\s  $]/g, '');
/** Glyphs a label line draws on its baseline: no blanks, no math delimiters, subscripts and superscripts left out. */
const glifosDe = (t: string) => [...sinBlancos(t.replace(/[_^](\{[^}]*\}|\S)/g, ''))].length;

const corta = (t: Caja, r: Caja) => {
  const dentro = t[0] >= r[0] && t[1] >= r[1] && t[0] + t[2] <= r[0] + r[2] && t[1] + t[3] <= r[1] + r[3];
  const fuera = t[0] >= r[0] + r[2] || t[0] + t[2] <= r[0] || t[1] >= r[1] + r[3] || t[1] + t[3] <= r[1];
  return !dentro && !fuera;
};
const toca = (t: Caja, r: Caja, holgura = 0) =>
  !(t[0] > r[0] + r[2] + holgura || t[0] + t[2] < r[0] - holgura || t[1] > r[1] + r[3] + holgura || t[1] + t[3] < r[1] - holgura);
const cajaTexto = (t: TextoFigura): Caja => [t.x, t.y, t.w, t.h];
const dentroDe = (t: Caja, c: Caja) => t[0] >= c[0] - 1 && t[1] >= c[1] - 1 && t[0] + t[2] <= c[0] + c[2] + 1 && t[1] + t[3] <= c[1] + c[3] + 1;
const distancia = (t: Caja, c: Caja) => {
  const cx = t[0] + t[2] / 2;
  const cy = t[1] + t[3] / 2;
  return Math.hypot(Math.max(c[0] - cx, 0, cx - (c[0] + c[2])), Math.max(c[1] - cy, 0, cy - (c[1] + c[3])));
};

/** Box of a schematic in SVG units (its points, parts' boxes and anchors), or null when it has nothing drawn. */
export function cajaEsquema(esq: EsquemaEncuadre): Caja | null {
  const A = esq.dibujo_a_svg;
  const xs: number[] = [];
  const ys: number[] = [];
  const poner = (p: number[]) => {
    xs.push(A.sx * p[0]! + A.tx);
    ys.push(A.sy * p[1]! + A.ty);
  };
  for (const p of esq.puntos) poner(p.xy);
  for (const e of esq.elementos) {
    if (e.caja) {
      poner([e.caja[0]!, e.caja[1]!]);
      poner([e.caja[2]!, e.caja[3]!]);
    }
    for (const a of Object.values(e.anclas ?? {})) poner(a);
  }
  if (!xs.length) return null;
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  return [x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0];
}

function cajaElemento(esq: EsquemaEncuadre, e: EsquemaEncuadre['elementos'][number]): Caja | null {
  if (!e.caja) return null;
  const A = esq.dibujo_a_svg;
  const xs = [A.sx * e.caja[0]! + A.tx, A.sx * e.caja[2]! + A.tx];
  const ys = [A.sy * e.caja[1]! + A.ty, A.sy * e.caja[3]! + A.ty];
  return [Math.min(...xs), Math.min(...ys), Math.abs(xs[1]! - xs[0]!), Math.abs(ys[1]! - ys[0]!)];
}

/**
 * The crop of figure box `vista` to the schematic `esq` and the texts to hide in it (see the head of this file).
 * `todos` are all the schematics of the figure (a part's highlighted colour may belong to any of them).
 */
export function encuadre(vista: Caja, esq: EsquemaEncuadre, objetos: ObjetosFigura): Encuadre | null {
  const C = cajaEsquema(esq);
  if (!C) return null;
  const lejos = (c: Caja) => Math.max(30, 1.6 * Math.max(c[2], c[3]));
  const cercanos = (k: number, c: Caja) =>
    objetos.textos.filter((t) => t.n === k && distancia(cajaTexto(t), c) <= lejos(c)).sort((x, y) => distancia(cajaTexto(x), c) - distancia(cajaTexto(y), c));
  // the labels the data marks as readings («1,52 V» beside R1): for each, the nearest run with as many glyphs
  const lecturas = new Set<TextoFigura>();
  // the parts' own labels (name and value, line by line): the nearest run with as many glyphs; the crop keeps them
  const rotulos = new Set<TextoFigura>();
  for (const e of esq.elementos) {
    const c = cajaElemento(esq, e);
    if (!c) continue;
    const v = sinBlancos(e.valor_texto ?? '');
    for (const et of e.etiquetas ?? []) {
      const a = sinBlancos(et);
      if ((v && (a.includes(v) || v.includes(a))) || !LECTURA.test(et)) continue;
      const mejor = cercanos(glifosDe(et), c).find((t) => !lecturas.has(t));
      if (mejor) lecturas.add(mejor);
    }
    // (the value alone only when the part has no label: «300 Ω» inside «R = 300 Ω» would pick another run)
    const propias = (e.etiquetas ?? []).filter((et) => !LECTURA.test(et) || (v && sinBlancos(et).includes(v)));
    const lineas = propias.length ? propias.flatMap((et) => et.split('\n')) : e.valor_texto ? [e.valor_texto] : [];
    // a label is written in the part's colour, or in the schematic's (a red «I₁» is not R₁'s name)
    const color = e.color?.toLowerCase();
    for (const l of lineas) {
      const mejor = cercanos(glifosDe(l), c).find((t) => !lecturas.has(t) && !rotulos.has(t) && (t.color === color || NEUTROS.has(t.color)));
      if (mejor) rotulos.add(mejor);
    }
  }
  // the schematic with its labels: the crop never cuts into it (a label wholly outside the first margin is not one)
  const m = Math.max(22, 0.14 * Math.max(C[2], C[3]));
  const margen: Caja = [C[0] - m, C[1] - m, C[2] + 2 * m, C[3] + 2 * m];
  for (const t of [...rotulos]) if (!toca(cajaTexto(t), margen)) rotulos.delete(t);
  let K = C;
  for (const t of rotulos) K = unirCajas(K, cajaTexto(t));
  let x0 = Math.max(vista[0], Math.min(C[0] - m, K[0] - 2));
  let y0 = Math.max(vista[1], Math.min(C[1] - m, K[1] - 2));
  let x1 = Math.min(vista[0] + vista[2], Math.max(C[0] + C[2] + m, K[0] + K[2] + 2));
  let y1 = Math.min(vista[1] + vista[3], Math.max(C[1] + C[3] + m, K[1] + K[3] + 2));
  // objects of the schematic touch its box or are its labels; the rest (another drawing, a graph, a note…) is foreign
  const ajenos = [...objetos.trazos, ...objetos.textos.filter((t) => !rotulos.has(t)).map(cajaTexto)].filter((t) => !toca(t, C, 1.5));
  // a symbol's own glyphs (the «V» of a meter, drawn in the part's colour) are not annotations
  const simbolos = esq.elementos.map((e) => cajaElemento(esq, e)).filter((c): c is Caja => !!c && c[2] > 4 && c[3] > 4);
  const esAnotacion = (t: TextoFigura) => !NEUTROS.has(t.color) && !rotulos.has(t) && !simbolos.some((c) => dentroDe(cajaTexto(t), c));
  // the book's notes beside the schematic are left out of the crop too when they can be (else hidden below)
  const notas = objetos.textos.filter((t) => esAnotacion(t) && !toca(cajaTexto(t), C, 1.5)).map(cajaTexto);
  for (let vuelta = 0; vuelta < 80; vuelta++) {
    const R: Caja = [x0, y0, x1 - x0, y1 - y0];
    const cortados = [...ajenos.filter((t) => corta(t, R)), ...notas.filter((t) => toca(t, R))];
    if (!cortados.length) break;
    // push back an edge on the side where the object lies beyond the schematic, removing the least area
    const opciones: [number, () => void][] = [];
    const holgura = 1.5;
    for (const t of cortados) {
      const [tx0, ty0, tx1, ty1] = [t[0], t[1], t[0] + t[2], t[1] + t[3]];
      const kx1 = K[0] + K[2];
      const ky1 = K[1] + K[3];
      if (tx0 >= kx1 && tx0 - holgura < x1) opciones.push([(x1 - Math.max(tx0 - holgura, kx1)) * (y1 - y0), () => (x1 = Math.max(tx0 - holgura, kx1))]);
      if (tx1 <= K[0] && tx1 + holgura > x0) opciones.push([(Math.min(tx1 + holgura, K[0]) - x0) * (y1 - y0), () => (x0 = Math.min(tx1 + holgura, K[0]))]);
      if (ty0 >= ky1 && ty0 - holgura < y1) opciones.push([(y1 - Math.max(ty0 - holgura, ky1)) * (x1 - x0), () => (y1 = Math.max(ty0 - holgura, ky1))]);
      if (ty1 <= K[1] && ty1 + holgura > y0) opciones.push([(Math.min(ty1 + holgura, K[1]) - y0) * (x1 - x0), () => (y0 = Math.min(ty1 + holgura, K[1]))]);
    }
    // an object beside the schematic's own extent cannot be cut away: its text is hidden below
    const utiles = opciones.filter((o) => o[0] > 1e-9);
    if (!utiles.length) break;
    utiles.sort((a, b) => a[0] - b[0])[0]![1]();
  }
  const recorte: Caja = [x0, y0, x1 - x0, y1 - y0].map((v) => Number(v.toFixed(2))) as Caja;
  const ocultar: Caja[] = [];
  for (const t of objetos.textos) {
    const b = cajaTexto(t);
    if (!toca(b, recorte)) continue;
    if (corta(b, recorte) || lecturas.has(t) || esAnotacion(t)) ocultar.push([t.x - 1, t.y - 1, t.w + 2, t.h + 2].map((v) => Number(v.toFixed(2))) as Caja);
  }
  return { recorte, ocultar };
}

/** Texts of the figure that the crop cuts and that are not hidden (the tests' check: must be none). */
export function textosCortados(objetos: ObjetosFigura, e: Encuadre): TextoFigura[] {
  const cubierto = (b: Caja) => e.ocultar.some((o) => o[0] <= b[0] && o[1] <= b[1] && o[0] + o[2] >= b[0] + b[2] && o[1] + o[3] >= b[1] + b[3]);
  return objetos.textos.filter((t) => corta(cajaTexto(t), e.recorte) && !cubierto(cajaTexto(t)));
}
