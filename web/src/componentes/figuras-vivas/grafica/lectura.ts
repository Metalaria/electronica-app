// Readout of the book's plots: groups of Axes that share a plotting box (an Axes and its twins), the series
// that can be read (curves, points, bars) and the values under the pointer.

import { interpolar, monotona } from '../../grafica/escalas';
import { dentro, mapa, type Mapa } from '../geometria';
import { ejeNumerico, nombreEje } from '../formato';
import type { Caja, DatosFigura, EjeDatos, Ejes, Serie } from '../tipos';

export interface SerieLeible {
  nombre: string;
  html: string | null;
  color: string;
  tipo: 'curva' | 'puntos' | 'barras';
  /** Index of the Axes it belongs to (its own y axis). */
  ejes: number;
  x: Float64Array;
  y: Float64Array;
  orden: 1 | -1 | 0;
  escalon: string | null;
  barras?: { x0: number; x1: number; y0: number; y1: number; valor: number }[];
}

export interface Grupo {
  /** Main Axes index (the one whose x axis is read) and every Axes drawn in the same box. */
  principal: number;
  ejes: number[];
  caja: Caja;
  mapas: Map<number, Mapa>;
  ejeX: EjeDatos;
  xNumerico: boolean;
  series: SerieLeible[];
  /** An inset drawn inside another Axes (takes the pointer first). */
  inset: boolean;
}

const COLOR_DEFECTO = '#1a3a5c';

function arr(v: (number | null)[]): Float64Array {
  const r = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) r[i] = v[i] ?? NaN;
  return r;
}

function finitos(x: Float64Array, y: Float64Array): number {
  let n = 0;
  for (let i = 0; i < x.length; i++) if (Number.isFinite(x[i]!) && Number.isFinite(y[i]!)) n++;
  return n;
}

/** Monotonic order ignoring gaps (NaN). */
function orden(x: Float64Array): 1 | -1 | 0 {
  const f = x.filter((v) => Number.isFinite(v));
  if (f.length !== x.length) return 0;
  return monotona(x);
}

function leibles(ej: Ejes, k: number): SerieLeible[] {
  const res: SerieLeible[] = [];
  const nombres = new Map<number, { t: string; h: string | null }>();
  for (const l of ej.leyenda ?? []) nombres.set(l.serie, { t: l.etiqueta, h: l.html ?? null });
  let anonimas = 0;
  (ej.series ?? []).forEach((s: Serie, i) => {
    const ley = nombres.get(i);
    const etiqueta = ley?.t ?? s.etiqueta ?? null;
    const html = ley?.h ?? s.etiqueta_html ?? null;
    const color = s.color || COLOR_DEFECTO;
    if (s.tipo === 'linea' || s.tipo === 'escalon') {
      const x = arr(s.x);
      const y = arr(s.y);
      const n = finitos(x, y);
      if (n >= 3) {
        res.push({
          nombre: etiqueta ?? '',
          html,
          color,
          tipo: 'curva',
          ejes: k,
          x,
          y,
          orden: orden(x),
          escalon: s.tipo === 'escalon' ? (s.trazado ?? 'steps-pre') : null,
        });
        if (!etiqueta) anonimas++;
      } else if (n === 1) {
        // A single marked point (an operating point, a highlighted value).
        res.push({ nombre: etiqueta ?? '', html, color, tipo: 'puntos', ejes: k, x, y, orden: 0, escalon: null });
      }
    } else if (s.tipo === 'dispersion' || s.tipo === 'tallos' || s.tipo === 'errores') {
      const x = arr(s.x);
      const y = arr(s.y);
      if (finitos(x, y)) res.push({ nombre: etiqueta ?? '', html, color, tipo: 'puntos', ejes: k, x, y, orden: 0, escalon: null });
    } else if (s.tipo === 'barras' && s.barras.length) {
      const barras = s.barras.map((b) => ({
        x0: Math.min(b.x, b.x + b.ancho),
        x1: Math.max(b.x, b.x + b.ancho),
        y0: Math.min(b.y, b.y + b.alto),
        y1: Math.max(b.y, b.y + b.alto),
        valor: b.valor ?? (s.orientacion === 'h' ? b.ancho : b.alto),
      }));
      res.push({
        nombre: etiqueta ?? '',
        html,
        color: s.color || s.barras[0]?.color || COLOR_DEFECTO,
        tipo: 'barras',
        ejes: k,
        x: new Float64Array(0),
        y: new Float64Array(0),
        orden: 0,
        escalon: s.orientacion,
        barras,
      });
    }
  });
  // Unnamed curves: the quantity of the y axis when alone, numbered otherwise.
  let k2 = 0;
  for (const s of res) {
    if (s.nombre) continue;
    if (s.tipo === 'curva') {
      k2++;
      s.nombre = anonimas === 1 ? nombreEje(ej.y) || 'curva' : `curva ${k2}`;
    } else if (s.tipo === 'puntos') s.nombre = 'punto';
    else s.nombre = 'barra';
  }
  return res;
}

/** Readable plot regions of a figure. Qualitative sketches (no numeric axes) give none. */
export function grupos(d: DatosFigura): Grupo[] {
  const res: Grupo[] = [];
  d.ejes.forEach((ej, k) => {
    if (ej.clase !== 'datos' || ej.proyeccion !== 'rectilinear' || ej.gemelo_de != null) return;
    const m = mapa(ej);
    if (!m || !ej.x) return;
    const ejes = [k];
    d.ejes.forEach((o, j) => {
      if (o.gemelo_de === k && o.clase === 'datos') ejes.push(j);
    });
    const mapas = new Map<number, Mapa>([[k, m]]);
    let series: SerieLeible[] = [];
    for (const j of ejes) {
      const mj = j === k ? m : mapa(d.ejes[j]!);
      if (!mj) continue;
      mapas.set(j, mj);
      // Values on a non-numeric y axis cannot be read; their x still can.
      series = series.concat(leibles(d.ejes[j]!, j));
    }
    const xNumerico = ejeNumerico(ej.x);
    const yNumerico = ejes.some((j) => ejeNumerico(d.ejes[j]!.y));
    if (!xNumerico && !yNumerico) return;
    res.push({ principal: k, ejes, caja: ej.pos_svg, mapas, ejeX: ej.x, xNumerico, series, inset: ej.padre != null });
  });
  // Insets first: they sit on top of their parent.
  return res.sort((a, b) => Number(b.inset) - Number(a.inset));
}

/** The group under an SVG point (an inset before its parent). */
export function grupoEn(gs: Grupo[], X: number, Y: number, margen = 0): Grupo | null {
  return gs.find((g) => dentro(g.caja, X, Y, margen)) ?? null;
}

export interface ValorLeido {
  serie: SerieLeible;
  /** Data coordinates of the value (the point on the curve). */
  x: number;
  y: number;
  /** SVG position. */
  X: number;
  Y: number;
  /** Bar value (bars only). */
  valor?: number;
}

export interface Lectura {
  grupo: Grupo;
  /** x of the crosshair (data units) and its SVG abscissa. */
  x: number;
  X: number;
  /** Values of every series at x, the snapped one first. */
  valores: ValorLeido[];
  /** The series the crosshair snapped to (nearest), if any. */
  cerca: ValorLeido | null;
}

function yEscalon(s: SerieLeible, x: number): number {
  const n = s.x.length;
  // Increasing x assumed (step plots are always so in the book).
  let i = 0;
  while (i < n - 1 && s.x[i + 1]! <= x) i++;
  if (x < s.x[0]! || x > s.x[n - 1]!) return NaN;
  if (s.escalon === 'steps-post') return s.y[i]!;
  if (s.escalon === 'steps-mid') return x - s.x[i]! < (s.x[Math.min(n - 1, i + 1)]! - s.x[i]!) / 2 ? s.y[i]! : s.y[Math.min(n - 1, i + 1)]!;
  return s.x[i] === x ? s.y[i]! : s.y[Math.min(n - 1, i + 1)]!;
}

/** Nearest sample of a series to an SVG point (screen distance). */
function masCercano(s: SerieLeible, m: Mapa, X: number, Y: number): { i: number; d: number } {
  let mejor = -1;
  let d = Infinity;
  for (let i = 0; i < s.x.length; i++) {
    const xv = s.x[i]!;
    const yv = s.y[i]!;
    if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue;
    const e = Math.hypot(m.x(xv) - X, m.y(yv) - Y);
    if (e < d) {
      d = e;
      mejor = i;
    }
  }
  return { i: mejor, d };
}

/**
 * Values under the SVG point (X, Y) of a group. `radio` is the snapping distance in SVG units (points and
 * non-monotonic curves snap within it).
 */
export function leer(g: Grupo, X: number, Y: number, radio: number, xFijo?: number): Lectura {
  const m0 = g.mapas.get(g.principal)!;
  let x = xFijo ?? m0.xi(X);
  // Points (scatter, single markers) snap the crosshair to them when close.
  let cercaPunto: ValorLeido | null = null;
  if (xFijo == null) {
    let dmin = radio;
    for (const s of g.series) {
      if (s.tipo !== 'puntos') continue;
      const m = g.mapas.get(s.ejes)!;
      const c = masCercano(s, m, X, Y);
      if (c.i >= 0 && c.d < dmin) {
        dmin = c.d;
        cercaPunto = { serie: s, x: s.x[c.i]!, y: s.y[c.i]!, X: m.x(s.x[c.i]!), Y: m.y(s.y[c.i]!) };
      }
    }
    if (cercaPunto) x = cercaPunto.x;
  }
  const Xc = m0.x(x);
  const valores: ValorLeido[] = [];
  for (const s of g.series) {
    const m = g.mapas.get(s.ejes)!;
    if (s.tipo === 'curva') {
      let y: number;
      let xs = x;
      if (s.orden !== 0) y = s.escalon ? yEscalon(s, x) : interpolar(s.orden === 1 ? s.x : s.x, s.y, x, s.orden === 1 ? 1 : 0, m.logX);
      else {
        // Closed or folded curves (hysteresis, phasor loci): the nearest sample to the pointer.
        const c = masCercano(s, m, xFijo != null ? Xc : X, Y);
        if (c.i < 0 || (xFijo == null && c.d > radio * 3)) continue;
        xs = s.x[c.i]!;
        y = s.y[c.i]!;
      }
      if (!Number.isFinite(y)) continue;
      valores.push({ serie: s, x: xs, y, X: m.x(xs), Y: m.y(y) });
    } else if (s.tipo === 'puntos') {
      if (cercaPunto?.serie === s) valores.push(cercaPunto);
    } else if (s.tipo === 'barras' && s.barras) {
      const yv = m.yi(Y);
      const b = s.barras.find((b) =>
        s.escalon === 'h' ? yv >= b.y0 && yv <= b.y1 && x >= Math.min(0, b.x0) && x <= b.x1 : x >= b.x0 && x <= b.x1,
      );
      if (b) {
        const top = s.escalon === 'h' ? (b.y0 + b.y1) / 2 : b.y1;
        const xb = s.escalon === 'h' ? b.x1 : (b.x0 + b.x1) / 2;
        valores.push({ serie: s, x: xb, y: top, X: m.x(xb), Y: m.y(top), valor: b.valor });
      }
    }
  }
  // Snap: the value nearest to the pointer in screen y (points already chosen win).
  let cerca: ValorLeido | null = cercaPunto;
  if (!cerca) {
    let d = Infinity;
    for (const v of valores) {
      const e = Math.abs(v.Y - Y) + Math.abs(v.X - Xc) * 0.25;
      if (e < d) {
        d = e;
        cerca = v;
      }
    }
  }
  if (cerca) {
    const i = valores.indexOf(cerca);
    if (i > 0) {
      valores.splice(i, 1);
      valores.unshift(cerca);
    }
  }
  return { grupo: g, x, X: Xc, valores, cerca };
}

/** Value of each curve at a fixed x (A/B cursors). */
export function valoresEn(g: Grupo, x: number): { serie: SerieLeible; y: number }[] {
  const res: { serie: SerieLeible; y: number }[] = [];
  for (const s of g.series) {
    if (s.tipo !== 'curva' || s.orden === 0) continue;
    const m = g.mapas.get(s.ejes)!;
    const y = s.escalon ? yEscalon(s, x) : interpolar(s.x, s.y, x, s.orden === 1 ? 1 : 0, m.logX);
    res.push({ serie: s, y });
  }
  return res;
}
