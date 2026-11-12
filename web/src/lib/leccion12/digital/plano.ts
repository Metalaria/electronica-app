// 1.2 digital toolkit: the drawing of a logic circuit (lib/leccion12/digital/logica.ts), laid out automatically.
// Inputs on the left, LEDs on the right, each piece in the column after its latest source (a flip-flop's feedback is
// a back edge, routed along a track under the circuit), pieces of a column ordered by where their sources are. Every
// wire is orthogonal: horizontal out of its source, vertical in a channel between columns (one lane per signal, so a
// signal that feeds several pins is one trunk with junction dots), horizontal into its pin; a horizontal run that
// would cross a piece goes round underneath instead. Coordinates in SVG units; pure (the component draws it).

import { nombreSalida, pinesEntrada, salidasDe, type CircuitoLogico, type PiezaLogica } from './logica';

export type P = [number, number];

export interface CajaPlano {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PiezaPlano extends CajaPlano {
  tipo: PiezaLogica['tipo'];
  /** Input pins (left side), in pin order: position and name. */
  pinesE: { x: number; y: number; nombre: string }[];
  /** Output pins (right side): signal, position and name («Q», «Q̄», '' for a single output). */
  pinesS: { senal: string; x: number; y: number; nombre: string }[];
}

export interface HiloPlano {
  senal: string;
  /** Where it ends: an input pin of a piece, or an LED. */
  destino: { pieza: string; pin: number } | { salida: string };
  puntos: P[];
}

export interface Plano {
  ancho: number;
  alto: number;
  entradas: (CajaPlano & { pin: P })[];
  piezas: PiezaPlano[];
  salidas: { id: string; x: number; y: number; pin: P }[];
  hilos: HiloPlano[];
  uniones: { senal: string; x: number; y: number }[];
  /** Pins tied to a constant level («0» to ground, «1» to the supply). */
  constantes: { pieza: string; pin: number; x: number; y: number; nivel: 0 | 1 }[];
}

const PASO_PIN = 16;
const HUECO = 20;
const CARRIL = 7;
const MARGEN = 14;

function tamano(p: PiezaLogica): { w: number; h: number; ent: number[]; sal: number[] } {
  const nE = pinesEntrada(p).length;
  const nS = salidasDe(p).length;
  const reparto = (n: number, h: number) => Array.from({ length: n }, (_, k) => h / 2 + (k - (n - 1) / 2) * PASO_PIN);
  switch (p.tipo) {
    case 'd':
    case 't':
      return { w: 60, h: 60, ent: [16, 44], sal: [16, 44] };
    case 'jk':
      return { w: 60, h: 60, ent: [14, 46, 30], sal: [16, 44] };
    case 'contador': {
      const h = Math.max(52, PASO_PIN * nS + 12);
      return { w: 60, h, ent: nE > 1 ? [16, 36] : [16], sal: Array.from({ length: nS }, (_, k) => 14 + k * PASO_PIN) };
    }
    case 'mux':
    case 'decodificador': {
      const h = Math.max(44, PASO_PIN * Math.max(nE, nS) + 8);
      return { w: 56, h, ent: reparto(nE, h), sal: reparto(nS, h) };
    }
    default: {
      const h = Math.max(36, PASO_PIN * nE + 4);
      return { w: 56, h, ent: reparto(nE, h), sal: [h / 2] };
    }
  }
}

/** Lays the circuit out (deterministic: the same circuit always gives the same drawing). */
export function planoDe(c: CircuitoLogico): Plano {
  const conductor = new Map<string, number>();
  c.piezas.forEach((p, i) => salidasDe(p).forEach((s) => conductor.set(s, i)));
  const entradaIdx = new Map(c.entradas.map((e, i) => [e.id, i]));

  // columns: 1 + the latest source's column, back edges (feedback through flip-flops) ignored
  const col = new Array<number>(c.piezas.length).fill(-1);
  const enCurso = new Set<number>();
  const columna = (i: number): number => {
    if (col[i]! >= 0) return col[i]!;
    if (enCurso.has(i)) return -1;
    enCurso.add(i);
    let m = 0;
    for (const ref of c.piezas[i]!.entradas) {
      const j = conductor.get(ref);
      if (j != null) {
        const cj = columna(j);
        if (cj >= 0) m = Math.max(m, cj);
      }
    }
    enCurso.delete(i);
    col[i] = m + 1;
    return col[i]!;
  };
  c.piezas.forEach((_, i) => columna(i));
  const nCols = Math.max(0, ...col) + 2; // inputs (0), pieces, LEDs
  const tam = c.piezas.map(tamano);

  // rows: within a column, in order of the mean height of their sources (inputs first, by their order)
  const yCentro = new Map<string, number>();
  const entradas: Plano['entradas'] = [];
  // (the switches' boxes fit their label and their level, or the clock's symbol: all as wide as the widest)
  const anchoEntradas = Math.max(38, ...c.entradas.map((e) => 20 + e.rotulo.map((x) => (x.t === 'val' ? '' : x.s)).join('').length * 7 + (e.reloj ? 18 : 12)));
  c.entradas.forEach((e, k) => {
    const y = MARGEN + k * (28 + HUECO);
    entradas.push({ id: e.id, x: MARGEN, y, w: anchoEntradas, h: 28, pin: [MARGEN + anchoEntradas, y + 14] });
    yCentro.set(e.id, y + 14);
  });
  const yPieza = new Array<number>(c.piezas.length).fill(0);
  const colsPiezas: number[][] = Array.from({ length: nCols }, () => []);
  c.piezas.forEach((_, i) => colsPiezas[col[i]!]!.push(i));
  for (let k = 1; k < nCols - 1; k++) {
    const orden = colsPiezas[k]!.map((i) => {
      const ys = c.piezas[i]!.entradas.map((r) => yCentro.get(r)).filter((y): y is number => y != null);
      return { i, m: ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 1e6 + i };
    });
    orden.sort((a, b) => a.m - b.m || a.i - b.i);
    let y = MARGEN;
    for (const { i, m } of orden) {
      const h = tam[i]!.h;
      // (near its sources when there is room: fewer bends)
      if (m < 1e6) y = Math.max(y, m - h / 2);
      yPieza[i] = y;
      salidasDe(c.piezas[i]!).forEach((s, q) => yCentro.set(s, y + tam[i]!.sal[q]!));
      y += h + HUECO;
    }
    colsPiezas[k] = orden.map((o) => o.i);
  }
  const ledY = c.salidas.map((s) => yCentro.get(s.de) ?? MARGEN + 14);
  // LEDs must not overlap: push down in order
  const ordenLed = c.salidas.map((_, k) => k).sort((a, b) => ledY[a]! - ledY[b]! || a - b);
  let yl = 0;
  for (const k of ordenLed) {
    ledY[k] = Math.max(ledY[k]!, yl + 14);
    yl = ledY[k]! + 14 + 8;
  }

  // routes: which channel each wire's vertical runs in (channel k: between column k-1 and k) or the bottom track
  type Ruta = { senal: string; xs: number; ys: number; colS: number; colT: number; yt: number; destino: HiloPlano['destino'] };
  const rutas: Ruta[] = [];
  const colDe = (ref: string) => (entradaIdx.has(ref) ? 0 : col[conductor.get(ref) ?? -1] ?? 0);
  const yDe = (ref: string) => yCentro.get(ref) ?? 0;
  const constantes: Plano['constantes'] = [];
  c.piezas.forEach((p, i) => {
    p.entradas.forEach((ref, k) => {
      const yt = yPieza[i]! + tam[i]!.ent[k]!;
      if (ref === '0' || ref === '1') {
        constantes.push({ pieza: p.id, pin: k, x: 0, y: yt, nivel: ref === '1' ? 1 : 0 });
        return;
      }
      rutas.push({ senal: ref, xs: 0, ys: yDe(ref), colS: colDe(ref), colT: col[i]!, yt, destino: { pieza: p.id, pin: k } });
    });
  });
  c.salidas.forEach((s, k) => rutas.push({ senal: s.de, xs: 0, ys: yDe(s.de), colS: colDe(s.de), colT: nCols - 1, yt: ledY[k]!, destino: { salida: s.id } }));

  // column x positions need the channel widths, which need the lanes: count lanes per channel first
  const anchoCol = Array.from({ length: nCols }, (_, k) => (k === 0 ? anchoEntradas : k === nCols - 1 ? 22 : Math.max(0, ...colsPiezas[k]!.map((i) => tam[i]!.w))));
  const cajasCol = (k: number) => (k === 0 ? entradas.map((e) => ({ y: e.y, h: e.h })) : colsPiezas[k]!.map((i) => ({ y: yPieza[i]!, h: tam[i]!.h })));
  const cruza = (y: number, desde: number, hasta: number) => {
    for (let k = desde; k <= hasta; k++) if (cajasCol(k).some((b) => y > b.y - 3 && y < b.y + b.h + 3)) return true;
    return false;
  };
  type Decision = { r: Ruta; modo: 'destino' | 'origen' | 'abajo' };
  const decisiones: Decision[] = rutas.map((r) => {
    if (r.colT > r.colS) {
      if (!cruza(r.ys, r.colS + 1, r.colT - 1)) return { r, modo: 'destino' };
      if (!cruza(r.yt, r.colS + 1, r.colT - 1)) return { r, modo: 'origen' };
    }
    return { r, modo: 'abajo' };
  });
  // lanes: channel k has one lane per signal whose vertical runs in it
  const carriles = new Map<number, string[]>();
  const carril = (canal: number, senal: string) => {
    const l = carriles.get(canal) ?? [];
    if (!l.includes(senal)) l.push(senal);
    carriles.set(canal, l);
    return l.indexOf(senal);
  };
  const pistas: string[] = [];
  for (const d of decisiones) {
    if (d.modo === 'destino') carril(d.r.colT, d.r.senal);
    else if (d.modo === 'origen') carril(d.r.colS + 1, d.r.senal);
    else {
      carril(d.r.colS + 1, d.r.senal);
      carril(d.r.colT, `${d.r.senal}>${d.r.colT}`);
      if (!pistas.includes(d.r.senal)) pistas.push(d.r.senal);
    }
  }
  const anchoCanal = (k: number) => 2 * HUECO + Math.max(0, (carriles.get(k)?.length ?? 1) - 1) * CARRIL;
  const xCol: number[] = [];
  let x = MARGEN;
  for (let k = 0; k < nCols; k++) {
    if (k > 0) x += anchoCanal(k);
    xCol.push(x);
    x += anchoCol[k]!;
  }
  const xCarril = (canal: number, clave: string) => {
    const l = carriles.get(canal) ?? [clave];
    const n = l.length;
    const centro = xCol[canal]! - anchoCanal(canal) / 2;
    return centro + (l.indexOf(clave) - (n - 1) / 2) * CARRIL;
  };

  // boxes and pins
  const piezas: PiezaPlano[] = c.piezas.map((p, i) => {
    const t = tam[i]!;
    const px = xCol[col[i]!]! + (anchoCol[col[i]!]! - t.w) / 2;
    const py = yPieza[i]!;
    const nombres = pinesEntrada(p);
    return {
      id: p.id,
      tipo: p.tipo,
      x: px,
      y: py,
      w: t.w,
      h: t.h,
      pinesE: t.ent.map((yy, k) => ({ x: px, y: py + yy, nombre: nombres[k] ?? '' })),
      pinesS: salidasDe(p).map((s, k) => ({ senal: s, x: px + t.w, y: py + t.sal[k]!, nombre: nombreSalida(s) })),
    };
  });
  const xFuente = (ref: string) => {
    const e = entradas.find((q) => q.id === ref);
    if (e) return e.pin[0];
    const pp = piezas[conductor.get(ref) ?? -1];
    return pp?.pinesS.find((q) => q.senal === ref)?.x ?? 0;
  };
  const salidas = c.salidas.map((s, k) => {
    const cx = xCol[nCols - 1]! + 11;
    return { id: s.id, x: cx, y: ledY[k]!, pin: [cx - 11, ledY[k]!] as P };
  });
  for (const k of constantes) k.x = piezas.find((q) => q.id === k.pieza)!.x;

  let fondo = 0;
  for (const p of piezas) fondo = Math.max(fondo, p.y + p.h);
  for (const e of entradas) fondo = Math.max(fondo, e.y + e.h);
  for (const s of salidas) fondo = Math.max(fondo, s.y + 14);
  const yPista = (senal: string) => fondo + 14 + pistas.indexOf(senal) * CARRIL;

  const hilos: HiloPlano[] = decisiones.map(({ r, modo }) => {
    const xs = xFuente(r.senal);
    const xt = 'salida' in r.destino ? salidas.find((s) => s.id === (r.destino as { salida: string }).salida)!.pin[0] : piezas.find((q) => q.id === (r.destino as { pieza: string }).pieza)!.pinesE[(r.destino as { pin: number }).pin]!.x;
    let puntos: P[];
    if (modo === 'destino') {
      const xv = xCarril(r.colT, r.senal);
      puntos = [[xs, r.ys], [xv, r.ys], [xv, r.yt], [xt, r.yt]];
    } else if (modo === 'origen') {
      const xv = xCarril(r.colS + 1, r.senal);
      puntos = [[xs, r.ys], [xv, r.ys], [xv, r.yt], [xt, r.yt]];
    } else {
      const x1 = xCarril(r.colS + 1, r.senal);
      const x2 = xCarril(r.colT, `${r.senal}>${r.colT}`);
      const yb = yPista(r.senal);
      puntos = [[xs, r.ys], [x1, r.ys], [x1, yb], [x2, yb], [x2, r.yt], [xt, r.yt]];
    }
    return { senal: r.senal, destino: r.destino, puntos: limpiar(puntos) };
  });

  const uniones = unionesDe(hilos);
  const ancho = xCol[nCols - 1]! + 22 + MARGEN;
  const alto = (pistas.length ? yPista(pistas[pistas.length - 1]!) : fondo) + MARGEN;
  return { ancho, alto, entradas, piezas, salidas, hilos, uniones, constantes };
}

/** Drops repeated points and collinear middles. */
function limpiar(ps: P[]): P[] {
  const out: P[] = [];
  for (const p of ps) {
    const u = out[out.length - 1];
    if (u && u[0] === p[0] && u[1] === p[1]) continue;
    out.push(p);
  }
  for (let k = out.length - 2; k >= 1; k--) {
    const a = out[k - 1]!;
    const b = out[k]!;
    const c = out[k + 1]!;
    if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) out.splice(k, 1);
  }
  return out;
}

/** Junction dots: where three or more pieces of one signal's wiring meet (a T or a cross of the same net). */
function unionesDe(hilos: HiloPlano[]): Plano['uniones'] {
  const out: Plano['uniones'] = [];
  const porSenal = new Map<string, [P, P][]>();
  for (const h of hilos) {
    const l = porSenal.get(h.senal) ?? [];
    for (let k = 0; k + 1 < h.puntos.length; k++) l.push([h.puntos[k]!, h.puntos[k + 1]!]);
    porSenal.set(h.senal, l);
  }
  for (const [senal, segs] of porSenal) {
    // the shared trunk of several wires overlaps: cut every segment at every point of the net, keep each piece once,
    // and a dot goes where three or more pieces meet
    const puntos = new Map<string, P>();
    for (const [a, b] of segs) for (const p of [a, b]) puntos.set(p.join(','), p);
    const trozos = new Set<string>();
    for (const [a, b] of segs) {
      const en = [a, b, ...[...puntos.values()].filter((p) => sobre(p, a, b))].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      for (let k = 0; k + 1 < en.length; k++) trozos.add(`${en[k]!.join(',')};${en[k + 1]!.join(',')}`);
    }
    const grado = new Map<string, number>();
    for (const t of trozos) for (const p of t.split(';')) grado.set(p, (grado.get(p) ?? 0) + 1);
    for (const [k, g] of grado) if (g >= 3) out.push({ senal, x: puntos.get(k)![0], y: puntos.get(k)![1] });
  }
  return out;
}

function sobre(p: P, a: P, b: P): boolean {
  if (a[0] === b[0] && p[0] === a[0]) return p[1] > Math.min(a[1], b[1]) && p[1] < Math.max(a[1], b[1]);
  if (a[1] === b[1] && p[1] === a[1]) return p[0] > Math.min(a[0], b[0]) && p[0] < Math.max(a[0], b[0]);
  return false;
}
