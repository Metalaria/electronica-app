// The book's equations and figures (Typst and cairo SVG: `path`, `g`, `use`, `symbol`, `clipPath`, `rect`, `image`
// with transforms, strokes, dashes and opacity) turned into PDF drawing operators, so that the «modo docente» PDF
// keeps them as vectors, sharp at any zoom and identical on every platform. Pure (a small XML reader of its own, no
// DOM: the tests convert every SVG of the book in Node). What it cannot draw faithfully (patterns, masks, filters,
// other shapes) is reported in `noSoportado`, and the caller rasterises that figure instead.

// ------------------------------------------------------------------ XML

export interface Nodo {
  nombre: string;
  attrs: Record<string, string>;
  hijos: Nodo[];
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const desescapar = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTIDADES[e] ?? m),
  );

/** Reads an XML document into elements (text, comments, processing instructions and doctypes are skipped). */
export function leerXml(texto: string): Nodo {
  const raiz: Nodo = { nombre: '#doc', attrs: {}, hijos: [] };
  const pila: Nodo[] = [raiz];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  const reAttr = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    if (m[1]) {
      if (pila.length > 1) pila.pop();
      continue;
    }
    if (!m[2]) continue;
    const attrs: Record<string, string> = {};
    let a: RegExpExecArray | null;
    reAttr.lastIndex = 0;
    while ((a = reAttr.exec(m[3] ?? ''))) attrs[a[1]!] = desescapar(a[2] ?? a[3] ?? '');
    const n: Nodo = { nombre: m[2], attrs, hijos: [] };
    pila[pila.length - 1]!.hijos.push(n);
    if (!m[4]) pila.push(n);
  }
  return raiz;
}

// ------------------------------------------------------------------ numbers and matrices

export type Matriz = [number, number, number, number, number, number];
export const IDENTIDAD: Matriz = [1, 0, 0, 1, 0, 0];

/** A number as PDF writes it: at most 4 decimals, no exponent, no trailing zeros. */
export function num(x: number): string {
  if (!Number.isFinite(x)) return '0';
  const r = Math.round(x * 10_000) / 10_000;
  const s = (Object.is(r, -0) ? 0 : r).toFixed(4);
  return s.replace(/\.?0+$/, '') || '0';
}

export function multiplicar(a: Matriz, b: Matriz): Matriz {
  // a then b (b applied after a): [a] × [b] in the PDF's row-vector convention
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

const NUMERO = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
const numeros = (s: string): number[] => (s.match(NUMERO) ?? []).map(Number);

/** An SVG `transform` attribute as one matrix. */
export function leerTransform(t: string | undefined): Matriz {
  let m: Matriz = IDENTIDAD;
  if (!t) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let x: RegExpExecArray | null;
  const pasos: Matriz[] = [];
  while ((x = re.exec(t))) {
    const v = numeros(x[2]!);
    let p: Matriz = IDENTIDAD;
    switch (x[1]) {
      case 'matrix':
        if (v.length >= 6) p = [v[0]!, v[1]!, v[2]!, v[3]!, v[4]!, v[5]!];
        break;
      case 'translate':
        p = [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0];
        break;
      case 'scale':
        p = [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0];
        break;
      case 'rotate': {
        const a = ((v[0] ?? 0) * Math.PI) / 180;
        const c = Math.cos(a);
        const s = Math.sin(a);
        p = [c, s, -s, c, 0, 0];
        if (v.length >= 3) p = multiplicar(multiplicar([1, 0, 0, 1, -v[1]!, -v[2]!], p), [1, 0, 0, 1, v[1]!, v[2]!]);
        break;
      }
      case 'skewX':
        p = [1, 0, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
        break;
      case 'skewY':
        p = [1, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
        break;
    }
    pasos.push(p);
  }
  // SVG: «translate(…) scale(…)» applies the last one first
  for (let i = pasos.length - 1; i >= 0; i--) m = multiplicar(m, pasos[i]!);
  return m;
}

// ------------------------------------------------------------------ paths

/** An SVG path's `d` as PDF path operators (m l c h; quadratic curves and arcs become cubic curves). */
export function trazado(d: string): string {
  const out: string[] = [];
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let x0 = 0;
  let y0 = 0;
  let cx = 0;
  let cy = 0;
  let previo = '';
  const esNum = (t: string | undefined) => t != null && !/^[A-Za-z]$/.test(t);
  const n = () => Number(tokens[i++]);
  // an arc's flags may be written together («a1 1 0 01 2 2»): read one digit at a time
  const bandera = (): number => {
    const t = tokens[i]!;
    if (t.length > 1 && (t[0] === '0' || t[0] === '1') && !t.startsWith('0.') && !t.startsWith('1.')) {
      tokens[i] = t.slice(1);
      return Number(t[0]);
    }
    i++;
    return Number(t);
  };
  const c3 = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
    out.push(`${num(x1)} ${num(y1)} ${num(x2)} ${num(y2)} ${num(x3)} ${num(y3)} c`);
  };
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (!esNum(t)) {
      cmd = t;
      i++;
      if (cmd === 'Z' || cmd === 'z') {
        out.push('h');
        x = x0;
        y = y0;
        previo = 'Z';
        continue;
      }
    } else if (!cmd) {
      i++;
      continue;
    }
    const rel = cmd === cmd.toLowerCase();
    const bx = rel ? x : 0;
    const by = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case 'M': {
        x = bx + n();
        y = by + n();
        x0 = x;
        y0 = y;
        out.push(`${num(x)} ${num(y)} m`);
        // further pairs are line-tos
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L':
        x = bx + n();
        y = by + n();
        out.push(`${num(x)} ${num(y)} l`);
        break;
      case 'H':
        x = bx + n();
        out.push(`${num(x)} ${num(y)} l`);
        break;
      case 'V':
        y = by + n();
        out.push(`${num(x)} ${num(y)} l`);
        break;
      case 'C': {
        const x1 = bx + n();
        const y1 = by + n();
        const x2 = bx + n();
        const y2 = by + n();
        x = bx + n();
        y = by + n();
        c3(x1, y1, x2, y2, x, y);
        cx = x2;
        cy = y2;
        break;
      }
      case 'S': {
        const x1 = 'CS'.includes(previo) ? 2 * x - cx : x;
        const y1 = 'CS'.includes(previo) ? 2 * y - cy : y;
        const x2 = bx + n();
        const y2 = by + n();
        x = bx + n();
        y = by + n();
        c3(x1, y1, x2, y2, x, y);
        cx = x2;
        cy = y2;
        break;
      }
      case 'Q': {
        const qx = bx + n();
        const qy = by + n();
        const ex = bx + n();
        const ey = by + n();
        c3(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey);
        x = ex;
        y = ey;
        cx = qx;
        cy = qy;
        break;
      }
      case 'T': {
        const qx = 'QT'.includes(previo) ? 2 * x - cx : x;
        const qy = 'QT'.includes(previo) ? 2 * y - cy : y;
        const ex = bx + n();
        const ey = by + n();
        c3(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey);
        x = ex;
        y = ey;
        cx = qx;
        cy = qy;
        break;
      }
      case 'A': {
        const rx = Math.abs(n());
        const ry = Math.abs(n());
        const rot = n();
        const grande = bandera();
        const barrido = bandera();
        const ex = bx + n();
        const ey = by + n();
        arco(x, y, rx, ry, rot, grande, barrido, ex, ey, c3, () => out.push(`${num(ex)} ${num(ey)} l`));
        x = ex;
        y = ey;
        break;
      }
      default:
        i++;
    }
    previo = cmd.toUpperCase();
  }
  return out.join('\n');
}

/** An elliptical arc as cubic curves (SVG implementation notes, F.6). */
function arco(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  rotGrados: number,
  grande: number,
  barrido: number,
  x2: number,
  y2: number,
  c3: (a: number, b: number, c: number, d: number, e: number, f: number) => void,
  recta: () => void,
): void {
  if (!rx || !ry || (x1 === x2 && y1 === y2)) {
    recta();
    return;
  }
  const phi = (rotGrados * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const xp = cos * dx + sin * dy;
  const yp = -sin * dx + cos * dy;
  const l = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (l > 1) {
    rx *= Math.sqrt(l);
    ry *= Math.sqrt(l);
  }
  const s = (grande === barrido ? -1 : 1) * Math.sqrt(Math.max(0, (rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp) / (rx * rx * yp * yp + ry * ry * xp * xp)));
  const cxp = (s * rx * yp) / ry;
  const cyp = (-s * ry * xp) / rx;
  const ccx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const ccy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!barrido && dt > 0) dt -= 2 * Math.PI;
  else if (barrido && dt < 0) dt += 2 * Math.PI;
  const trozos = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
  const d = dt / trozos;
  const k = (4 / 3) * Math.tan(d / 4);
  const punto = (t: number): [number, number] => [ccx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, ccy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
  const deriv = (t: number): [number, number] => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
  for (let j = 0; j < trozos; j++) {
    const a = t1 + j * d;
    const b = a + d;
    const [ax, ay] = punto(a);
    const [bx2, by2] = punto(b);
    const [dax, day] = deriv(a);
    const [dbx, dby] = deriv(b);
    c3(ax + k * dax, ay + k * day, bx2 - k * dbx, by2 - k * dby, bx2, by2);
  }
}

// ------------------------------------------------------------------ colours

/** «#1a3a5c», «#fff», «rgb(…)», a few names → [r, g, b] in 0–1; null: none. */
export function color(v: string | undefined, actual: [number, number, number]): [number, number, number] | null | undefined {
  if (v == null) return undefined;
  const s = v.trim().toLowerCase();
  if (s === 'none' || s === 'transparent') return null;
  if (s === 'currentcolor') return actual;
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return [0, 1, 2].map((i) => parseInt(m![1]![i]! + m![1]![i]!, 16) / 255) as [number, number, number];
  m = /^#([0-9a-f]{6})$/.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m![1]!.slice(i, i + 2), 16) / 255) as [number, number, number];
  m = /^rgb\(([^)]*)\)$/.exec(s);
  if (m) {
    const p = m[1]!.split(',').map((x) => x.trim());
    return p.map((x) => (x.endsWith('%') ? Number(x.slice(0, -1)) / 100 : Number(x) / 255)) as [number, number, number];
  }
  const nombres: Record<string, [number, number, number]> = { black: [0, 0, 0], white: [1, 1, 1], red: [1, 0, 0], blue: [0, 0, 1], green: [0, 0.5, 0], gray: [0.5, 0.5, 0.5], grey: [0.5, 0.5, 0.5] };
  return nombres[s] ?? undefined;
}

const tresNum = (c: [number, number, number]) => c.map(num).join(' ');

// ------------------------------------------------------------------ drawing

export interface EstiloSvg {
  fill: [number, number, number] | null;
  stroke: [number, number, number] | null;
  strokeWidth: number;
  linecap: string;
  linejoin: string;
  miter: number;
  dash: number[] | null;
  dashOffset: number;
  fillOpacity: number;
  strokeOpacity: number;
  fillRule: string;
  clipRule: string;
  color: [number, number, number];
}

export interface DestinoSvg {
  /** Name of an ExtGState with these alphas (registered by the caller). */
  transparencia(relleno: number, trazo: number): string;
  /** Name of an image XObject for a data: URI (null: cannot embed it). */
  imagen?(uri: string): string | null;
}

export interface SvgConvertido {
  /** PDF operators, in the SVG's own user space (y down): the caller sets the placement matrix first. */
  ops: string;
  /** viewBox [x, y, w, h] (or the width and height). */
  caja: [number, number, number, number];
  /** Elements or features not drawn (the caller rasterises the picture instead). */
  noSoportado: string[];
  /** Number of painted shapes (an empty conversion means a broken picture). */
  pintados: number;
}

const ESTILO_INICIAL = (colorTexto: [number, number, number]): EstiloSvg => ({
  fill: [0, 0, 0],
  stroke: null,
  strokeWidth: 1,
  linecap: 'butt',
  linejoin: 'miter',
  miter: 4,
  dash: null,
  dashOffset: 0,
  fillOpacity: 1,
  strokeOpacity: 1,
  fillRule: 'nonzero',
  clipRule: 'nonzero',
  color: colorTexto,
});

const CAP: Record<string, number> = { butt: 0, round: 1, square: 2 };
const JOIN: Record<string, number> = { miter: 0, round: 1, bevel: 2 };

function heredar(e: EstiloSvg, a: Record<string, string>, noSoportado: Set<string>): EstiloSvg {
  const r = { ...e };
  // a style attribute's declarations override presentation attributes
  const attrs: Record<string, string> = { ...a };
  if (a.style) for (const d of a.style.split(';')) {
    const [k, v] = d.split(':').map((x) => x?.trim());
    if (k && v) attrs[k] = v;
  }
  if (attrs.color) r.color = color(attrs.color, r.color) ?? r.color;
  const relleno = attrs.fill;
  if (relleno != null) {
    if (/^url\(/.test(relleno)) {
      noSoportado.add('pattern');
      r.fill = null;
    } else {
      const c = color(relleno, r.color);
      if (c !== undefined) r.fill = c;
    }
  }
  const trazo = attrs.stroke;
  if (trazo != null) {
    if (/^url\(/.test(trazo)) {
      noSoportado.add('pattern');
      r.stroke = null;
    } else {
      const c = color(trazo, r.color);
      if (c !== undefined) r.stroke = c;
    }
  }
  if (attrs['stroke-width'] != null) r.strokeWidth = Number.parseFloat(attrs['stroke-width']) || 0;
  if (attrs['stroke-linecap']) r.linecap = attrs['stroke-linecap'];
  if (attrs['stroke-linejoin']) r.linejoin = attrs['stroke-linejoin'];
  if (attrs['stroke-miterlimit']) r.miter = Number(attrs['stroke-miterlimit']) || 4;
  if (attrs['stroke-dasharray']) r.dash = attrs['stroke-dasharray'] === 'none' ? null : numeros(attrs['stroke-dasharray']);
  if (attrs['stroke-dashoffset']) r.dashOffset = Number.parseFloat(attrs['stroke-dashoffset']) || 0;
  if (attrs['fill-opacity']) r.fillOpacity = Number(attrs['fill-opacity']);
  if (attrs['stroke-opacity']) r.strokeOpacity = Number(attrs['stroke-opacity']);
  if (attrs['fill-rule']) r.fillRule = attrs['fill-rule'];
  if (attrs['clip-rule']) r.clipRule = attrs['clip-rule'];
  if (attrs.opacity && Number(attrs.opacity) < 1) {
    // group opacity needs a transparency group; applied to fill and stroke alike (close enough for line art)
    r.fillOpacity *= Number(attrs.opacity);
    r.strokeOpacity *= Number(attrs.opacity);
  }
  return r;
}

const matrizOp = (m: Matriz) => `${m.map(num).join(' ')} cm`;

/**
 * Converts an SVG document. `colorTexto` replaces currentColor (the equations use it: black on paper).
 */
export function convertirSvg(texto: string, destino: DestinoSvg, colorTexto: [number, number, number] = [0, 0, 0]): SvgConvertido {
  const doc = leerXml(texto);
  const svg = doc.hijos.find((n) => n.nombre === 'svg');
  const noSoportado = new Set<string>();
  if (!svg) return { ops: '', caja: [0, 0, 0, 0], noSoportado: ['svg'], pintados: 0 };
  const ids = new Map<string, Nodo>();
  const indexar = (n: Nodo) => {
    if (n.attrs.id) ids.set(n.attrs.id, n);
    n.hijos.forEach(indexar);
  };
  indexar(svg);
  const vb = numeros(svg.attrs.viewBox ?? '');
  const caja: [number, number, number, number] =
    vb.length === 4 ? [vb[0]!, vb[1]!, vb[2]!, vb[3]!] : [0, 0, Number.parseFloat(svg.attrs.width ?? '0') || 0, Number.parseFloat(svg.attrs.height ?? '0') || 0];
  const out: string[] = [];
  let pintados = 0;
  let profundidad = 0;

  const href = (n: Nodo) => (n.attrs['xlink:href'] ?? n.attrs.href ?? '').replace(/^#/, '');

  /**
   * A clip path as operators. A clip cannot be built under a «q … cm … Q» of its own (Q would undo it), so the
   * matrices of the clip's children are applied to the path's coordinates.
   */
  const recorte = (id: string, regla: string): string | null => {
    const cp = ids.get(id);
    if (!cp || cp.nombre !== 'clipPath') return null;
    if (cp.attrs.clipPathUnits === 'objectBoundingBox') {
      noSoportado.add('clipPathUnits');
      return null;
    }
    const partes: string[] = [];
    const recoger = (n: Nodo, m: Matriz) => {
      const t = multiplicar(leerTransform(n.attrs.transform), m);
      if (n.nombre === 'path' && n.attrs.d) partes.push(transformarTrazado(trazado(n.attrs.d), t));
      else if (n.nombre === 'rect') {
        const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((k) => Number.parseFloat(n.attrs[k] ?? '0') || 0);
        partes.push(transformarTrazado(`${x} ${y} m\n${x! + w!} ${y} l\n${x! + w!} ${y! + h!} l\n${x} ${y! + h!} l\nh`, t));
      } else if (n.nombre === 'use') {
        const ref = ids.get(href(n));
        const tr: Matriz = [1, 0, 0, 1, Number.parseFloat(n.attrs.x ?? '0') || 0, Number.parseFloat(n.attrs.y ?? '0') || 0];
        if (ref) recoger(ref, multiplicar(tr, t));
      } else for (const h of n.hijos) recoger(h, t);
    };
    for (const h of cp.hijos) recoger(h, IDENTIDAD);
    if (!partes.length) return null;
    const r = cp.hijos.find((h) => h.attrs['clip-rule'])?.attrs['clip-rule'] ?? regla;
    return `${partes.join('\n')}\n${r === 'evenodd' ? 'W*' : 'W'} n`;
  };

  const pintar = (geom: string, e: EstiloSvg) => {
    const relleno = e.fill && e.fillOpacity > 0;
    const trazo = e.stroke && e.strokeOpacity > 0 && e.strokeWidth > 0;
    if (!relleno && !trazo) return;
    const ops: string[] = ['q'];
    if (relleno) ops.push(`${tresNum(e.fill!)} rg`);
    if (trazo) {
      ops.push(`${tresNum(e.stroke!)} RG`, `${num(e.strokeWidth)} w`, `${CAP[e.linecap] ?? 0} J`, `${JOIN[e.linejoin] ?? 0} j`, `${num(e.miter)} M`);
      if (e.dash && e.dash.length && e.dash.some((x) => x > 0)) ops.push(`[${e.dash.map(num).join(' ')}] ${num(e.dashOffset)} d`);
    }
    const fa = relleno ? e.fillOpacity : 1;
    const sa = trazo ? e.strokeOpacity : 1;
    if (fa < 1 || sa < 1) ops.push(`/${destino.transparencia(Math.max(0, Math.min(1, fa)), Math.max(0, Math.min(1, sa)))} gs`);
    ops.push(geom);
    const par = e.fillRule === 'evenodd';
    ops.push(relleno && trazo ? (par ? 'B*' : 'B') : relleno ? (par ? 'f*' : 'f') : 'S');
    ops.push('Q');
    out.push(ops.join('\n'));
    pintados++;
  };

  const dibujar = (n: Nodo, e0: EstiloSvg) => {
    if (profundidad > 40) return;
    const nombre = n.nombre;
    if (nombre === 'defs' || nombre === 'clipPath' || nombre === 'symbol' || nombre === 'title' || nombre === 'desc' || nombre === 'metadata' || nombre === 'style') return;
    if (nombre === 'pattern' || nombre === 'mask' || nombre === 'filter' || nombre === 'linearGradient' || nombre === 'radialGradient' || nombre === 'text') {
      noSoportado.add(nombre);
      return;
    }
    if (n.attrs.mask) noSoportado.add('mask');
    if (n.attrs.filter) noSoportado.add('filter');
    if (n.attrs.display === 'none' || n.attrs.visibility === 'hidden') return;
    const e = heredar(e0, n.attrs, noSoportado);
    const t = leerTransform(n.attrs.transform);
    const conT = n.attrs.transform != null;
    const clip = n.attrs['clip-path'] ? /url\(#([^)]+)\)/.exec(n.attrs['clip-path'])?.[1] : undefined;
    profundidad++;
    out.push('q');
    if (conT) out.push(matrizOp(t));
    if (clip) {
      const r = recorte(clip, e.clipRule);
      if (r) out.push(r);
    }
    switch (nombre) {
      case 'svg':
      case 'g':
      case 'a':
      case 'switch':
        for (const h of n.hijos) dibujar(h, e);
        break;
      case 'use': {
        const ref = ids.get(href(n));
        const x = Number.parseFloat(n.attrs.x ?? '0') || 0;
        const y = Number.parseFloat(n.attrs.y ?? '0') || 0;
        if (x || y) out.push(matrizOp([1, 0, 0, 1, x, y]));
        if (ref) {
          if (ref.nombre === 'symbol') for (const h of ref.hijos) dibujar(h, e);
          else dibujar(ref, e);
        }
        break;
      }
      case 'path':
        if (n.attrs.d) pintar(trazado(n.attrs.d), e);
        break;
      case 'rect': {
        const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((k) => Number.parseFloat(n.attrs[k] ?? '0') || 0);
        if (n.attrs.rx || n.attrs.ry) noSoportado.add('rect-redondeado');
        if (w! > 0 && h! > 0) pintar(`${num(x!)} ${num(y!)} ${num(w!)} ${num(h!)} re`, e);
        break;
      }
      case 'line': {
        const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((k) => Number.parseFloat(n.attrs[k] ?? '0') || 0);
        pintar(`${num(x1!)} ${num(y1!)} m\n${num(x2!)} ${num(y2!)} l`, { ...e, fill: null });
        break;
      }
      case 'polyline':
      case 'polygon': {
        const p = numeros(n.attrs.points ?? '');
        if (p.length >= 4) {
          const ops = [`${num(p[0]!)} ${num(p[1]!)} m`];
          for (let k = 2; k + 1 < p.length; k += 2) ops.push(`${num(p[k]!)} ${num(p[k + 1]!)} l`);
          if (nombre === 'polygon') ops.push('h');
          pintar(ops.join('\n'), nombre === 'polyline' ? { ...e, fill: null } : e);
        }
        break;
      }
      case 'circle':
      case 'ellipse': {
        const cx = Number.parseFloat(n.attrs.cx ?? '0') || 0;
        const cy = Number.parseFloat(n.attrs.cy ?? '0') || 0;
        const rx = Number.parseFloat(n.attrs.rx ?? n.attrs.r ?? '0') || 0;
        const ry = Number.parseFloat(n.attrs.ry ?? n.attrs.r ?? '0') || 0;
        if (rx > 0 && ry > 0) {
          const k = 0.5522847498;
          pintar(
            [
              `${num(cx + rx)} ${num(cy)} m`,
              `${num(cx + rx)} ${num(cy + k * ry)} ${num(cx + k * rx)} ${num(cy + ry)} ${num(cx)} ${num(cy + ry)} c`,
              `${num(cx - k * rx)} ${num(cy + ry)} ${num(cx - rx)} ${num(cy + k * ry)} ${num(cx - rx)} ${num(cy)} c`,
              `${num(cx - rx)} ${num(cy - k * ry)} ${num(cx - k * rx)} ${num(cy - ry)} ${num(cx)} ${num(cy - ry)} c`,
              `${num(cx + k * rx)} ${num(cy - ry)} ${num(cx + rx)} ${num(cy - k * ry)} ${num(cx + rx)} ${num(cy)} c`,
              'h',
            ].join('\n'),
            e,
          );
        }
        break;
      }
      case 'image': {
        const real = n.attrs['xlink:href'] ?? n.attrs.href ?? '';
        const nombreImg = /^data:image\/(png|jpe?g);base64,/.test(real) ? (destino.imagen?.(real) ?? null) : null;
        if (!nombreImg) {
          noSoportado.add('image');
          break;
        }
        const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((k) => Number.parseFloat(n.attrs[k] ?? '0') || 0);
        // image space is the unit square with y up; in this y-down space it must be flipped
        out.push(`q ${matrizOp([w!, 0, 0, -h!, x!, y! + h!])} /${nombreImg} Do Q`);
        pintados++;
        break;
      }
      default:
        noSoportado.add(nombre);
    }
    out.push('Q');
    profundidad--;
  };

  dibujar(svg, ESTILO_INICIAL(colorTexto));
  return { ops: out.join('\n'), caja, noSoportado: [...noSoportado].sort(), pintados };
}

/** Applies a matrix to the coordinates of PDF path operators (m l c re are all that trazado() writes). */
function transformarTrazado(ops: string, m: Matriz): string {
  const p = (x: number, y: number) => `${num(m[0] * x + m[2] * y + m[4])} ${num(m[1] * x + m[3] * y + m[5])}`;
  return ops
    .split('\n')
    .map((l) => {
      const t = l.trim().split(/\s+/);
      const op = t[t.length - 1];
      const v = t.slice(0, -1).map(Number);
      if (op === 'm' || op === 'l') return `${p(v[0]!, v[1]!)} ${op}`;
      if (op === 'c') return `${p(v[0]!, v[1]!)} ${p(v[2]!, v[3]!)} ${p(v[4]!, v[5]!)} c`;
      return l;
    })
    .join('\n');
}

/**
 * The matrix that places an SVG of box `caja` in the PDF rectangle (x, y bottom, w, h), y up as PDF has it.
 */
export function colocar(caja: [number, number, number, number], x: number, y: number, w: number, h: number): Matriz {
  const sx = w / (caja[2] || 1);
  const sy = h / (caja[3] || 1);
  return [sx, 0, 0, -sy, x - caja[0] * sx, y + h + caja[1] * sy];
}

export const operadorMatriz = matrizOp;
