// Automatic schematic of a netlist: circuit model → connected parts → placement (annealing) → wires (router)
// → packing → geometry, topology in the format of the book's figure data («Datos de figuras») and SVG.
// Plain TypeScript, no DOM: runs in the app (main thread or worker) and in Node.

import { esTierra, leerCircuito, type Circuito, type Dispositivo, type OpcionesModelo, type Riel } from './modelo.ts';
import { ALTO_LINEA, Colocador, construirVariante, crearUnidades, semilla, TAM_ETQ, type Componente, type Reglas, type Unidad } from './colocacion.ts';
import { reglasDe } from './plantillas.ts';
import { enrutar, type PinRuta } from './rutas.ts';
import { anchoTexto, girar, girarRect, simboloDe, type Pt, type Rect } from './simbolos.ts';
import type { Correspondencia, Elemento, Esquema, Nodo, Tramo } from '../figuras-vivas/tipos';

// ------------------------------------------------------------------ result types

/** A placed unit in world coordinates (drawing units, y DOWN). */
export interface UnidadDibujada {
  u: Unidad;
  x: number;
  y: number;
  /** Element id of the main element of this unit in the topology («E3»). */
  el: string;
  /** Its label moved away from the wires (world coordinates); otherwise the variant's own place. */
  etq?: EtiquetaUnidad;
}

/** A unit's label in world coordinates: text box, anchor x, anchor and lines (one per ALTO_LINEA). */
export interface EtiquetaUnidad {
  rect: Rect;
  x: number;
  ancla: 'start' | 'middle' | 'end';
  lineas: string[];
}

/** The label of a drawn unit where it is drawn (world coordinates), or null. */
export function etiquetaMundo(ud: UnidadDibujada): EtiquetaUnidad | null {
  if (ud.etq) return ud.etq;
  const e = ud.u.vars[ud.u.v]!.etq;
  if (!e) return null;
  return { rect: [e.rect[0] + ud.x, e.rect[1] + ud.y, e.rect[2] + ud.x, e.rect[3] + ud.y], x: e.x + ud.x, ancla: e.ancla, lineas: e.lineas };
}

export interface CableRed {
  red: string;
  /** Straight runs [x0, y0, x1, y1] (world, y down). */
  runs: [number, number, number, number][];
}

export interface EtiquetaRed {
  red: string;
  /** Pin point, end of the stub and the stub direction. */
  pin: Pt;
  fin: Pt;
  dir: Pt;
  /** Where its text goes (baseline point) and how it is anchored. */
  tx: number;
  ty: number;
  ancla: 'start' | 'middle' | 'end';
}

/** Small name of a net written next to one of its wires (the names the plots use: v(out)…). */
export interface NombreRed {
  red: string;
  x: number;
  y: number;
  ancla: 'start' | 'middle' | 'end';
}

export interface Dibujo {
  unidades: UnidadDibujada[];
  cables: CableRed[];
  uniones: Pt[];
  etiquetas: EtiquetaRed[];
  nombres: NombreRed[];
  /** Bounds of everything drawn [x0, y0, x1, y1] (world, y down). */
  limites: Rect;
}

export interface Estadisticas {
  dispositivos: number;
  unidades: number;
  componentes: number;
  nodos: number;
  cruces: number;
  /** Overlapping symbol/label pairs after placement (should be 0). */
  solapes: number;
  etiquetasRed: number;
  /** Part labels moved away from wires, the smallest label–wire clearance, labels below the minimum. */
  etiquetasMovidas: number;
  holguraEtiquetas: number;
  etiquetasPegadas: number;
  longitud: number;
  codos: number;
  ms: number;
  ignoradas: number;
  /** 0.8: components laid out again from the previous layout of an edited circuit (incremental). */
  recolocadas: number;
}

export interface EsquemaAuto {
  circuito: Circuito;
  dibujo: Dibujo;
  esquema: Esquema;
  correspondencia: Correspondencia;
  /** SVG viewBox [0, 0, W, H] and the drawing → SVG scale. */
  vista: [number, number, number, number];
  escala: number;
  margen: number;
  /** Per wire segment of the topology: the terminal currents whose sum is its current (from «de» to «a»). */
  flujo: Record<string, { el: string; t: string; s: 1 | -1 }[]>;
  estadisticas: Estadisticas;
}

export interface OpcionesEsquema extends OpcionesModelo {
  /** Annealing effort (1 = default). */
  esfuerzo?: number;
  /** Wanted width/height of the sheet when the netlist holds several separate circuits. */
  aspecto?: number;
}

export const ESCALA = 24; // SVG units per drawing unit
export const MARGEN = 0.8; // drawing units around the drawing

// ------------------------------------------------------------------ components

function componentes(c: Circuito): { disps: Dispositivo[]; puertos: string[] }[] {
  const ds = c.dispositivos;
  const padre = ds.map((_, i) => i);
  const raiz = (i: number): number => {
    while (padre[i] !== i) {
      padre[i] = padre[padre[i]!]!;
      i = padre[i]!;
    }
    return i;
  };
  const primero = new Map<string, number>();
  ds.forEach((d, i) => {
    for (const p of d.pines) {
      if (esTierra(p.nodo) || c.rieles.has(p.nodo)) continue;
      const j = primero.get(p.nodo);
      if (j == null) primero.set(p.nodo, i);
      else {
        const a = raiz(i);
        const b = raiz(j);
        if (a !== b) padre[Math.max(a, b)] = Math.min(a, b);
      }
    }
  });
  const grupos = new Map<number, Dispositivo[]>();
  ds.forEach((d, i) => {
    const r = raiz(i);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r)!.push(d);
  });
  // Terminal markers: the drawn subcircuit's ports, and dangling nets (one pin) of the main circuit.
  const cuenta = new Map<string, number>();
  for (const d of ds) for (const p of d.pines) cuenta.set(p.nodo, (cuenta.get(p.nodo) ?? 0) + 1);
  const res: { disps: Dispositivo[]; puertos: string[] }[] = [];
  for (const f of c.fuentesRiel) res.push({ disps: [f], puertos: [] });
  for (const g of grupos.values()) {
    const nets = new Set(g.flatMap((d) => d.pines.map((p) => p.nodo)));
    const puertos = [...nets].filter((n) => !esTierra(n) && !c.rieles.has(n) && (c.puertos.includes(n) || (!c.subckt && cuenta.get(n) === 1)));
    res.push({ disps: g, puertos });
  }
  return res;
}

/** Structure of a component without names and values: identical structures get identical drawings. */
function firmaEstructura(comp: Componente): string {
  return comp.unidades
    .map((u) => {
      const s = u.disp ? `${u.disp.simbolo}${u.disp.pines.length}` : 'P';
      const ref = u.disp ? Math.min(6, u.disp.nombre.length) : u.puerto?.length ?? 0;
      return `${s}:${ref}:${u.pines.map((p) => (p.red >= 0 ? p.red : p.tipo === 'tierra' ? 'g' : `r${p.riel?.signo}${p.riel?.texto.length}`)).join(',')}`;
    })
    .join('|');
}

// ------------------------------------------------------------------ one component

interface Colocado {
  comp: Componente;
  rutas: ReturnType<typeof enrutar>;
  /** Pins given to the router (world, component coordinates). */
  pines: PinRuta[];
  /** Pin owner of each router pin: [unit, pin]. */
  duenos: [number, number][];
  limites: Rect;
  puntuacion: number;
  /** Topology families recognised in it (plantillas.ts). */
  familias: string[];
}

function limitesComponente(comp: Componente): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const u of comp.unidades) {
    const v = u.vars[u.v]!;
    const rs: Rect[] = [v.cuerpo, ...v.talones.map((t) => t.rect), ...v.talones.flatMap((t) => (t.etq ? [t.etq] : []))];
    if (v.etq) rs.push(v.etq.rect);
    for (const [a, b] of v.patas) rs.push([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]);
    for (const p of v.pines) rs.push([p.x, p.y, p.x, p.y]);
    for (const r of rs) {
      x0 = Math.min(x0, r[0] + u.x);
      y0 = Math.min(y0, r[1] + u.y);
      x1 = Math.max(x1, r[2] + u.x);
      y1 = Math.max(y1, r[3] + u.y);
    }
  }
  return [x0, y0, x1, y1];
}

function rutear(comp: Componente, reglas: Reglas | null = null): { rutas: ReturnType<typeof enrutar>; pines: PinRuta[]; duenos: [number, number][] } {
  const pines: PinRuta[] = [];
  const duenos: [number, number][] = [];
  const cuerpos: Rect[] = [];
  const blandos: Rect[] = [];
  for (const u of comp.unidades) {
    const v = u.vars[u.v]!;
    const mov = (r: Rect): Rect => [r[0] + u.x, r[1] + u.y, r[2] + u.x, r[3] + u.y];
    cuerpos.push(mov(v.cuerpo));
    for (const t of v.talones) {
      cuerpos.push(mov(t.rect));
      if (t.etq) blandos.push(mov(t.etq));
    }
    if (v.etq) blandos.push(mov(v.etq.rect));
    u.pines.forEach((p, i) => {
      if (p.red < 0) return;
      const g = v.pines[i]!;
      pines.push({ x: g.x + u.x, y: g.y + u.y, dx: g.dx, dy: g.dy, red: p.red });
      duenos.push([u.id, i]);
    });
  }
  const fijas = reglas?.etiquetarPines?.size ? new Set(duenos.flatMap(([u, i], k) => (reglas.etiquetarPines!.has(`${u},${i}`) ? [k] : []))) : undefined;
  let rutas = enrutar(pines, comp.redes.length, { cuerpos, blandos }, undefined, reglas?.etiquetar.size ? reglas.etiquetar : undefined, fijas);
  // Logic: where the router gives up on a pin (a long detour), the whole net is labelled instead, so a net
  // reads either as wires or as labels.
  if (reglas?.rangoU && rutas.etiquetas.length) {
    const todas = new Set(reglas.etiquetar);
    for (const i of rutas.etiquetas) if (!fijas?.has(i)) todas.add(pines[i]!.red);
    if (todas.size > reglas.etiquetar.size) rutas = enrutar(pines, comp.redes.length, { cuerpos, blandos }, undefined, todas, fijas);
  }
  return { rutas, pines, duenos };
}

function codos(r: ReturnType<typeof enrutar>): number {
  let n = 0;
  for (const runs of r.tramos) {
    const grado = new Map<string, { h: number; v: number }>();
    for (const [a, b, c, d] of runs) {
      const h = b === d;
      for (const k of [`${a},${b}`, `${c},${d}`]) {
        const g = grado.get(k) ?? { h: 0, v: 0 };
        if (h) g.h++;
        else g.v++;
        grado.set(k, g);
      }
    }
    for (const g of grado.values()) if (g.h && g.v) n++;
  }
  return n;
}

type Posiciones = [number, number, number][];
/** Layouts per structure; several when labels of different widths need different spacing. */
const cacheEstructura = new Map<string, Posiciones[]>();

/** Layouts computed ahead (high effort) for the book's netlists: structure signature → [x, y, variant] per unit. */
const precalculados = new Map<string, Posiciones[]>();

/** Forgets the drawings kept per circuit structure (tests and benchmarks); `todo` also the precomputed ones. */
export function olvidarDibujos(todo = false): void {
  cacheEstructura.clear();
  cacheReglas.clear();
  recientes.length = 0;
  if (todo) precalculados.clear();
}

/** Loads precomputed layouts (see scripts/esquema-auto-precalcular.mjs). */
export function sembrarDibujos(d: Record<string, Posiciones[]>): void {
  for (const [k, v] of Object.entries(d)) precalculados.set(k, v);
}

/** Layouts of the structures drawn since the last `olvidarDibujos` (for the precomputation script). */
export function dibujosRecordados(): Record<string, Posiciones[]> {
  return Object.fromEntries(cacheEstructura);
}

function recordar(firma: string, pos: Posiciones): void {
  const l = cacheEstructura.get(firma) ?? [];
  if (!l.includes(pos)) l.unshift(pos);
  if (l.length > 4) l.length = 4;
  cacheEstructura.delete(firma);
  cacheEstructura.set(firma, l);
  if (cacheEstructura.size > 2000) cacheEstructura.delete(cacheEstructura.keys().next().value!);
}

/** Topology rules per circuit structure (the recognisers run once per structural change): the rules, the
 *  variants they added and every variant's final cost. */
const cacheReglas = new Map<string, { reglas: Reglas | null; extra: [number, number, number][]; costes: number[][] }>();

function reglasCacheadas(comp: Componente, firma: string): Reglas | null {
  const c = cacheReglas.get(firma);
  if (c && c.costes.length === comp.unidades.length) {
    for (const [u, o, coste] of c.extra) {
      const un = comp.unidades[u]!;
      if (un.disp && !un.vars.some((v) => v.o === o)) un.vars.push(construirVariante(un, simboloDe(un.disp, 0), o, coste));
    }
    if (comp.unidades.every((u, i) => u.vars.length === c.costes[i]!.length)) {
      comp.unidades.forEach((u, i) => u.vars.forEach((v, j) => (v.coste = c.costes[i]![j]!)));
      return c.reglas;
    }
  }
  const n0 = comp.unidades.map((u) => u.vars.length);
  const reglas = reglasDe(comp);
  const extra: [number, number, number][] = [];
  comp.unidades.forEach((u, i) => u.vars.slice(n0[i]).forEach((v) => extra.push([i, v.o, v.coste])));
  cacheReglas.set(firma, { reglas, extra, costes: comp.unidades.map((u) => u.vars.map((v) => v.coste)) });
  if (cacheReglas.size > 500) cacheReglas.delete(cacheReglas.keys().next().value!);
  return reglas;
}

/**
 * 0.8: the last layouts drawn, by part (designator, symbol and pin count; ports by name): when an edit changes
 * a circuit's structure, the new layout starts from the old one (recolocar).
 */
const recientes: Map<string, readonly [number, number, number]>[] = [];
/** Components re-laid from a previous layout since the module loaded (statistics). */
let recolocaciones = 0;

function claveUnidad(u: Unidad): string {
  return u.disp ? `${u.disp.nombre}|${u.disp.simbolo}|${u.disp.pines.length}` : `P|${u.puerto}`;
}

function anotarReciente(comp: Componente): void {
  const m = new Map<string, readonly [number, number, number]>();
  for (const u of comp.unidades) m.set(claveUnidad(u), [u.x, u.y, u.v]);
  recientes.unshift(m);
  if (recientes.length > 6) recientes.length = 6;
}

/** The previous place of each unit in the recent layout that shares most parts with `comp` (or null when none
 *  shares at least 60 % of them, and three). */
function lugaresPrevios(comp: Componente): (readonly [number, number, number] | null)[] | null {
  let mejor: (readonly [number, number, number] | null)[] | null = null;
  let n = 0;
  for (const r of recientes) {
    const l = comp.unidades.map((u) => r.get(claveUnidad(u)) ?? null);
    const k = l.filter(Boolean).length;
    if (k > n) {
      n = k;
      mejor = l;
    }
  }
  return mejor && n >= 3 && n >= 0.6 * comp.unidades.length ? mejor : null;
}

function colocarComponente(comp: Componente, esfuerzo: number): Colocado {
  const r = colocarComponente0(comp, esfuerzo);
  anotarReciente(comp);
  return r;
}

function colocarComponente0(comp: Componente, esfuerzo: number): Colocado {
  const U = comp.unidades.length;
  // Recognised topologies (H bridge, converters, Wien oscillator, regulators, logic, rectifiers): their rules
  // shape the annealing and the choice of the best run, and they are part of the cache key.
  const reglas = reglasCacheadas(comp, firmaEstructura(comp));
  const firma = firmaEstructura(comp) + (reglas ? `#${reglas.familias.join('+')}` : '');
  const previos = [...(cacheEstructura.get(firma) ?? []), ...(precalculados.get(firma) ?? [])];
  const evaluar = (): Colocado => {
    const { rutas, pines, duenos } = rutear(comp, reglas);
    const lim = limitesComponente(comp);
    let p = 0;
    for (const u of comp.unidades) p += u.vars[u.v]!.coste;
    p += rutas.longitud + 2.6 * codos(rutas) + 9 * rutas.cruces + 14 * (rutas.etiquetas.length - etiquetasForzadas);
    p += 0.15 * (lim[2] - lim[0] + lim[3] - lim[1]);
    // The topology's rules weigh double here: a run that draws it the textbook way wins.
    if (reglas) p += 2 * new Colocador(comp, 1, reglas).costeDeReglas();
    return { comp, rutas, pines, duenos, limites: lim, puntuacion: p, familias: reglas?.familias ?? [] };
  };
  let etiquetasForzadas = 0;
  if (reglas) for (const k of reglas.etiquetar) etiquetasForzadas += comp.pinesRed[k]!.length > 1 ? comp.pinesRed[k]!.length : 0;
  if (reglas?.etiquetarPines) etiquetasForzadas += reglas.etiquetarPines.size;
  for (const pos of previos) {
    if (pos.length !== comp.unidades.length) continue;
    comp.unidades.forEach((u, i) => {
      [u.x, u.y, u.v] = pos[i]!;
    });
    const col = new Colocador(comp, 1, reglas);
    if (comp.unidades.every((u) => u.v < u.vars.length && col.valida(u))) {
      recordar(firma, pos);
      return evaluar();
    }
  }
  if (U === 1 && comp.unidades[0]!.vars.length === 1) {
    comp.unidades[0]!.x = 0;
    comp.unidades[0]!.y = 0;
    return evaluar();
  }
  // Live layout (an edited netlist, effort ≤ 1) must answer fast: fewer, shorter runs that stop when they
  // settle, the topology's own start first, and no more runs once one is flawless. The precomputed layouts
  // of the book (effort 3) keep the full search.
  const vivo = esfuerzo <= 1;
  const intentos = (U <= 3 ? 1 : U <= 8 ? 3 : U <= 16 ? 2 : 1) + (esfuerzo > 1 ? Math.round(esfuerzo) + 1 : 0) + (reglas && !vivo ? 5 : 0);
  const iter = Math.round(Math.min(vivo ? 12000 : 30000, 600 * U + 1500) * Math.min(esfuerzo, 2) * (U > 30 ? 0.6 : 1));
  let mejor: Colocado | null = null;
  let mejorPos: [number, number, number][] = [];
  const base = semilla(firma);
  let perfecto = false;
  const probar = (k: number, T0: number, desde: (readonly [number, number, number] | null)[] | null = null) => {
    if (vivo && perfecto) return;
    const col = new Colocador(comp, base + k * 7919, reglas);
    if (desde) col.inicialDesde(desde);
    else col.inicial(T0 < 1);
    col.recocer(desde ? Math.round(iter * 0.4) : iter, T0, 0.03, vivo);
    col.compactar();
    const r = evaluar();
    perfecto = !r.rutas.cruces && r.rutas.etiquetas.length <= etiquetasForzadas && (!reglas || col.costeDeReglas() < 1e-6);
    // With a recognised topology, crossings and fallback labels decide first (the rules must not cost
    // readability), then the score.
    const clave = (x: Colocado) => (reglas ? 1000 * (x.rutas.cruces + x.rutas.etiquetas.length - etiquetasForzadas) : 0) + x.puntuacion + 25 * (x.rutas.etiquetas.length - etiquetasForzadas) + 10 * x.rutas.cruces;
    if (!mejor || clave(r) < clave(mejor)) {
      mejor = r;
      mejorPos = comp.unidades.map((u) => [u.x, u.y, u.v]);
    }
  };
  // Many multi-pin blocks (logic, subcircuits): also refine the layered start without scrambling it (live:
  // first, when it is the topology's own drawing).
  const bloques = comp.unidades.filter((u) => u.pines.length > 3).length;
  const capas = bloques >= 3 || U > 16 || !!reglas?.rangoU || !!reglas?.anclas?.length;
  const propia = !!(reglas?.fila || reglas?.anclas?.length);
  // An edited circuit (live, 0.8): first from its previous layout — the parts still there in their places, the
  // new ones next to their neighbours, one short low-temperature run. When that drawing is flawless (no
  // crossing, no fallback label, rules met) it is kept: recognisable and several times faster than a layout
  // from scratch; otherwise it competes with the usual runs.
  const antes = vivo && U > 3 ? lugaresPrevios(comp) : null;
  if (antes) {
    probar(intentos + 1, 0.6, antes);
    if (perfecto) recolocaciones++;
  }
  if (vivo && capas && propia) probar(intentos, 0.6);
  for (let k = 0; k < intentos; k++) probar(k, 3.5);
  if (capas && !(vivo && propia)) probar(intentos, 0.6);
  comp.unidades.forEach((u, i) => {
    [u.x, u.y, u.v] = mejorPos[i]!;
  });
  recordar(firma, mejorPos);
  // The winner was routed when it was found (routing is deterministic): no second routing of the same layout.
  return (mejor as Colocado | null) ?? evaluar();
}

// ------------------------------------------------------------------ packing

/** Shelf packing in reading order; the row width is chosen so the whole sheet is close to `aspecto` (w/h). */
function empaquetar(cs: Colocado[], aspecto: number): [number, number][] {
  const tam = cs.map((c) => [c.limites[2] - c.limites[0], c.limites[3] - c.limites[1]] as const);
  const GX = 2.2;
  const GY = 2;
  const colocar = (maxW: number) => {
    const res: [number, number][] = [];
    let x = 0;
    let y = 0;
    let alto = 0;
    let ancho = 0;
    cs.forEach((c, i) => {
      const [w, h] = tam[i]!;
      if (x > 0 && x + w > maxW) {
        x = 0;
        y += alto + GY;
        alto = 0;
      }
      res.push([Math.round(x - c.limites[0]), Math.round(y - c.limites[1])]);
      x += w + GX;
      ancho = Math.max(ancho, x - GX);
      alto = Math.max(alto, h);
    });
    return { res, ancho, alto: y + alto };
  };
  const minW = Math.max(...tam.map(([w]) => w));
  const total = tam.reduce((s, [w]) => s + w + GX, 0);
  let mejor = colocar(total);
  let nota = Infinity;
  for (let k = 0; k <= 24; k++) {
    const maxW = minW + ((total - minW) * k) / 24;
    const r = colocar(maxW);
    const asp = r.ancho / Math.max(1, r.alto);
    // Distance to the wanted shape (log scale) and the area a fit-to-box view would waste.
    const n = Math.abs(Math.log(asp / aspecto)) + 0.15 * Math.log((r.ancho * r.alto) / Math.max(1, tam.reduce((s, [w, h]) => s + w * h, 0)));
    if (n < nota - 1e-9) {
      nota = n;
      mejor = r;
    }
  }
  return mejor.res;
}

/** Grid packing: every circuit in a cell as large as the largest, row by row in reading order, with the
 *  number of columns that brings the sheet nearest to `aspecto`; each circuit at the top left of its cell. */
function empaquetarRejilla(cs: Colocado[], aspecto: number): [number, number][] {
  const GX = 2.2;
  const GY = 2;
  const W = Math.max(...cs.map((c) => c.limites[2] - c.limites[0])) + GX;
  const H = Math.max(...cs.map((c) => c.limites[3] - c.limites[1])) + GY;
  let cols = 1;
  let nota = Infinity;
  for (let k = 1; k <= cs.length; k++) {
    const filas = Math.ceil(cs.length / k);
    const n = Math.abs(Math.log((k * W) / (filas * H) / aspecto));
    if (n < nota - 1e-9) {
      nota = n;
      cols = k;
    }
  }
  return cs.map((c, i) => [Math.round((i % cols) * W - c.limites[0]), Math.round(Math.floor(i / cols) * H - c.limites[1])]);
}

// ------------------------------------------------------------------ topology

function redondo(v: number): number {
  return Math.round(v * 1e4) / 1e4 + 0;
}

/** Pin index of a terminal on the netlist line. */
function indicePin(d: Dispositivo, t: string): number | null {
  const p = d.pines.find((x) => x.nombre === t);
  if (p?.indice != null) return p.indice;
  switch (d.letra) {
    case 'R':
    case 'C':
    case 'L':
    case 'D':
    case 'S':
    case 'W':
    case 'I':
    case 'G':
    case 'F':
      return t === 'start' ? 0 : t === 'end' ? 1 : null;
    case 'V':
    case 'H':
    case 'E':
    case 'B':
      if (d.simbolo === 'DEPI') return t === 'start' ? 0 : t === 'end' ? 1 : null;
      return t === 'end' ? 0 : t === 'start' ? 1 : null;
    case 'Q':
      return { collector: 0, base: 1, emitter: 2 }[t] ?? null;
    case 'M':
      return { drain: 0, gate: 1, source: 2, bulk: 3 }[t] ?? null;
    case 'J':
    case 'Z':
      return { drain: 0, gate: 1, source: 2 }[t] ?? null;
    case 'T':
    case 'O':
    case 'U':
      return { a: 0, a_ref: 1, b: 2, b_ref: 3 }[t] ?? null;
    default: {
      const m = /^p(\d+)$/.exec(t);
      return m ? Number(m[1]) - 1 : null;
    }
  }
}

interface Constructor {
  puntos: Map<string, { id: string; xy: Pt; nodo: string }>;
  elementos: Elemento[];
  tramos: Tramo[];
  /** Terminal currents feeding each tramo. */
  flujo: Record<string, { el: string; t: string; s: 1 | -1 }[]>;
}

export function generarEsquema(texto: string, opciones: OpcionesEsquema = {}): EsquemaAuto | null {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const circuito = leerCircuito(texto, opciones);
  if (!circuito.dispositivos.length && !circuito.fuentesRiel.length) return null;
  const grupos = componentes(circuito);
  const recolocaciones0 = recolocaciones;
  const colocados: Colocado[] = [];
  for (const g of grupos) {
    const comp = crearUnidades(g.disps, circuito.rieles, g.puertos);
    colocados.push(colocarComponente(comp, opciones.esfuerzo ?? 1));
  }
  // Several separate rectifiers (variants of one example): a grid of equal cells in netlist order.
  const propios = colocados.filter((c) => !(c.comp.unidades.length === 1 && c.comp.unidades[0]!.disp && circuito.fuentesRiel.includes(c.comp.unidades[0]!.disp)));
  const rejilla = propios.length >= 2 && propios.every((c) => c.familias.includes('rectificador'));
  const desp = rejilla ? empaquetarRejilla(colocados, opciones.aspecto ?? 1.8) : empaquetar(colocados, opciones.aspecto ?? 1.8);

  // ---------------------------------------------------------------- world geometry
  const unidades: UnidadDibujada[] = [];
  const cables: CableRed[] = [];
  const etiquetas: EtiquetaRed[] = [];
  const uniones: Pt[] = [];
  let cruces = 0;
  let longitud = 0;
  let nCodos = 0;
  colocados.forEach((c, ci) => {
    const [ox, oy] = desp[ci]!;
    for (const u of c.comp.unidades) unidades.push({ u, x: u.x + ox, y: u.y + oy, el: '' });
    c.rutas.tramos.forEach((runs, k) => {
      if (!runs.length) return;
      cables.push({ red: c.comp.redes[k]!, runs: runs.map(([a, b, cc, d]) => [a + ox, b + oy, cc + ox, d + oy]) });
    });
    for (const i of c.rutas.etiquetas) {
      const p = c.pines[i]!;
      const fin: Pt = [p.x + ox + p.dx * 0.9, p.y + oy + p.dy * 0.9];
      etiquetas.push({ red: c.comp.redes[p.red]!, pin: [p.x + ox, p.y + oy], fin, dir: [p.dx, p.dy], tx: fin[0], ty: fin[1], ancla: 'start' });
    }
    cruces += c.rutas.cruces;
    longitud += c.rutas.longitud;
    nCodos += codos(c.rutas);
  });

  const holgura = separarEtiquetas(unidades, cables, etiquetas);
  const nombres = rotular(unidades, cables, etiquetas, circuito);

  // Overlap audit (placement guarantees none inside a component; packing keeps components apart).
  let solapes = 0;
  {
    const rs: { r: Rect; u: number }[] = [];
    unidades.forEach((ud, i) => {
      const v = ud.u.vars[ud.u.v]!;
      const mov = (r: Rect): Rect => [r[0] + ud.x, r[1] + ud.y, r[2] + ud.x, r[3] + ud.y];
      rs.push({ r: mov(v.cuerpo), u: i });
      const e = etiquetaMundo(ud);
      if (e) rs.push({ r: e.rect, u: i });
      for (const t of v.talones) rs.push({ r: mov(t.rect), u: i });
    });
    for (let a = 0; a < rs.length; a++)
      for (let b = a + 1; b < rs.length; b++) {
        if (rs[a]!.u === rs[b]!.u) continue;
        const p = rs[a]!.r;
        const q = rs[b]!.r;
        if (p[0] < q[2] - 0.02 && q[0] < p[2] - 0.02 && p[1] < q[3] - 0.02 && q[1] < p[3] - 0.02) solapes++;
      }
  }

  // ---------------------------------------------------------------- topology
  const nombresNodo: string[] = [];
  const idNodo = new Map<string, string>();
  const hayTierra = unidades.some((ud) => ud.u.pines.some((p) => p.tipo === 'tierra'));
  if (hayTierra) idNodo.set('0', 'N0');
  const nodoDe = (n: string): string => {
    const k = esTierra(n) ? '0' : n;
    if (!idNodo.has(k)) {
      idNodo.set(k, `N${idNodo.size + (hayTierra ? 0 : 1)}`);
      nombresNodo.push(k);
    }
    return idNodo.get(k)!;
  };
  for (const n of circuito.nodos) nodoDe(n);

  const K: Constructor = { puntos: new Map(), elementos: [], tramos: [], flujo: {} };
  const punto = (xy: Pt, nodo: string): string => {
    const k = `${redondo(xy[0])},${redondo(xy[1])}`;
    const e = K.puntos.get(k);
    if (e) return e.id;
    const id = `P${K.puntos.size}`;
    K.puntos.set(k, { id, xy: [redondo(xy[0]), redondo(-xy[1])], nodo });
    return id;
  };
  const D = (p: Pt): [number, number] => [redondo(p[0]), redondo(-p[1])];
  const cajaD = (r: Rect): [number, number, number, number] => [redondo(r[0]), redondo(-r[3]), redondo(r[2]), redondo(-r[1])];
  const corr: Correspondencia = { nodos: {}, elementos: {} };
  let ne = 0;
  const nuevoId = () => `E${++ne}`;
  /** Attachments per net for the current bookkeeping: point key → [element, terminal]. */
  const terminalesEn = new Map<string, { el: string; t: string }[]>();
  const anotarTerminal = (xy: Pt, el: string, t: string) => {
    const k = `${redondo(xy[0])},${redondo(xy[1])}`;
    if (!terminalesEn.has(k)) terminalesEn.set(k, []);
    terminalesEn.get(k)!.push({ el, t });
  };
  /** Points where the current leaves the drawn piece of a net (ground symbols, rails, labels). */
  const salidas = new Set<string>();
  const extraTramos: { nodo: string; pts: Pt[] }[] = [];

  for (const ud of unidades) {
    const u = ud.u;
    const v = u.vars[u.v]!;
    const W = (p: Pt): Pt => [p[0] + ud.x, p[1] + ud.y];
    const pinW = (i: number): Pt => W([v.pines[i]!.x, v.pines[i]!.y]);
    const d = u.disp;
    const caja = cajaD([v.cuerpo[0] + ud.x, v.cuerpo[1] + ud.y, v.cuerpo[2] + ud.x, v.cuerpo[3] + ud.y]);
    if (d && d.simbolo === 'TRAFO') {
      // Coils as inductors, plus the coupling.
      for (const b of d.bobinas ?? []) {
        const id = nuevoId();
        const iS = u.pines.findIndex((p) => p.nombre === `${b.clave}.start`);
        const iE = u.pines.findIndex((p) => p.nombre === `${b.clave}.end`);
        const ps = pinW(iS);
        const pe = pinW(iE);
        const xs = [ps[0], pe[0]];
        const cx = (ps[0] + pe[0]) / 2;
        const izq = cx < ud.x + 1.5;
        const bx0 = izq ? ud.x + 0.85 : ud.x + 1.75;
        const el: Elemento = {
          id,
          clase: 'Inductor2',
          rol: 'L',
          designador: b.nombre,
          etiquetas: [`${b.nombre}\n${b.valor}`],
          etiquetas_html: [`${htmlRef(b.nombre)}<br>${esc(b.valor)}`],
          valor: b.numero,
          unidad: 'H',
          valor_texto: b.valor || null,
          anclas: { start: D(ps), end: D(pe), center: D([bx0 + 0.2, (ps[1] + pe[1]) / 2]) },
          caja: cajaD([bx0, Math.min(ps[1], pe[1]), bx0 + 0.4, Math.max(ps[1], pe[1])]),
          terminales: { start: nodoDe(u.pines[iS]!.nodo), end: nodoDe(u.pines[iE]!.nodo) },
          puntos_terminal: { start: punto(ps, nodoDe(u.pines[iS]!.nodo)), end: punto(pe, nodoDe(u.pines[iE]!.nodo)) },
          invertido: false,
          discontinuo: false,
          color: null,
        };
        void xs;
        K.elementos.push(el);
        anotarTerminal(ps, id, 'start');
        anotarTerminal(pe, id, 'end');
        corr.elementos[id] = { nombre: b.clave, pines: { start: 0, end: 1 } };
        if (!ud.el) ud.el = id;
      }
      const idK = nuevoId();
      K.elementos.push({
        id: idK,
        clase: 'Transformer',
        rol: 'K',
        designador: d.nombre,
        etiquetas: [`${d.nombre} ${d.valor}`],
        etiquetas_html: [`${esc(d.nombre)} ${esc(d.valor)}`],
        valor: d.numero,
        anclas: { center: D([ud.x + 1.5, ud.y + 1]) },
        caja: cajaD([ud.x + 1.35, ud.y, ud.x + 1.65, ud.y + Math.max(2, v.cuerpo[3])]),
        invertido: false,
        discontinuo: false,
        color: null,
      });
      ud.el = idK;
    } else if (d && d.simbolo === 'PUENTE') {
      // The four diodes of the bridge, each one its own element on the diamond's sides.
      for (const x of d.diodos ?? []) {
        const id = nuevoId();
        const iA = u.pines.findIndex((p) => p.nombre === x.anodo);
        const iK = u.pines.findIndex((p) => p.nombre === x.catodo);
        const A = pinW(iA);
        const Kc = pinW(iK);
        const nA = nodoDe(u.pines[iA]!.nodo);
        const nK = nodoDe(u.pines[iK]!.nodo);
        const M: Pt = [(A[0] + Kc[0]) / 2, (A[1] + Kc[1]) / 2];
        K.elementos.push({
          id,
          clase: x.d.clase,
          rol: x.d.rol,
          designador: x.d.nombre,
          etiquetas: [x.d.nombre],
          etiquetas_html: [htmlRef(x.d.nombre)],
          valor: null,
          referencia: x.d.modelo,
          anclas: { start: D(A), end: D(Kc), center: D(M) },
          caja: cajaD([M[0] - 0.35, M[1] - 0.35, M[0] + 0.35, M[1] + 0.35]),
          terminales: { start: nA, end: nK },
          puntos_terminal: { start: punto(A, nA), end: punto(Kc, nK) },
          polaridad: { anodo: 'start', catodo: 'end' },
          invertido: false,
          discontinuo: false,
          color: null,
        });
        anotarTerminal(A, id, 'start');
        anotarTerminal(Kc, id, 'end');
        corr.elementos[id] = { nombre: x.d.clave, pines: { start: 0, end: 1 } };
        if (!ud.el) ud.el = id;
      }
    } else if (d) {
      const id = nuevoId();
      ud.el = id;
      const anclas: Record<string, [number, number]> = {};
      const terminales: Record<string, string> = {};
      const pt: Record<string, string> = {};
      const pinesCorr: Record<string, number> = {};
      u.pines.forEach((p, i) => {
        const w = pinW(i);
        anclas[p.nombre] = D(w);
        const nd = nodoDe(p.nodo);
        terminales[p.nombre] = nd;
        pt[p.nombre] = punto(w, nd);
        anotarTerminal(w, id, p.nombre);
        const ix = indicePin(d, p.nombre);
        if (ix != null) pinesCorr[p.nombre] = ix;
      });
      anclas['center'] = D([(v.cuerpo[0] + v.cuerpo[2]) / 2 + ud.x, (v.cuerpo[1] + v.cuerpo[3]) / 2 + ud.y]);
      const lineas = v.etq?.lineas ?? [d.nombre];
      const el: Elemento = {
        id,
        clase: d.clase,
        rol: d.rol,
        designador: d.nombre,
        etiquetas: [lineas.join('\n')],
        etiquetas_html: [lineas.map((l, k) => (k === 0 ? htmlLinea(l, d.nombre) : esc(l))).join('<br>')],
        valor: d.numero,
        unidad: d.unidad || null,
        valor_texto: d.valor || null,
        origen_valor: d.valor ? 'netlist' : null,
        referencia: d.modelo,
        anclas,
        caja,
        terminales,
        puntos_terminal: pt,
        invertido: false,
        discontinuo: false,
        color: null,
      };
      if (d.polaridad) el.polaridad = d.polaridad;
      if (d.letra === 'S' || d.letra === 'W') el.estado = d.extra.toLowerCase() === 'on' ? 'cerrado' : 'abierto';
      K.elementos.push(el);
      corr.elementos[id] = { nombre: d.clave, pines: pinesCorr };
    } else if (u.puerto) {
      const id = nuevoId();
      ud.el = id;
      const w = pinW(0);
      const nd = nodoDe(u.puerto);
      K.elementos.push({
        id,
        clase: 'Terminal',
        rol: 'DOT',
        designador: null,
        etiquetas: [u.puerto],
        etiquetas_html: [esc(u.puerto)],
        anclas: { start: D(w) },
        caja,
        terminales: { start: nd },
        puntos_terminal: { start: punto(w, nd) },
        invertido: false,
        discontinuo: false,
        color: null,
      });
    }
    // Ground and supply symbols with their leads.
    for (const t of v.talones) {
      const p = u.pines[t.pin]!;
      const nd = nodoDe(p.nodo);
      const pw = pinW(t.pin);
      const at = W(t.punto);
      const id = nuevoId();
      const riel: Riel | null = p.riel;
      const rect = W([t.rect[0], t.rect[1]]);
      const rect2 = W([t.rect[2], t.rect[3]]);
      K.elementos.push({
        id,
        clase: t.tipo === 'tierra' ? 'Ground' : riel && riel.signo < 0 ? 'Vss' : 'Vdd',
        rol: t.tipo === 'tierra' ? 'GND' : 'RAIL',
        designador: null,
        etiquetas: riel ? [riel.texto] : [],
        etiquetas_html: riel ? [riel.html] : [],
        anclas: { start: D(at) },
        caja: cajaD([rect[0], rect[1], rect2[0], rect2[1]]),
        terminales: { start: nd },
        puntos_terminal: { start: punto(at, nd) },
        invertido: false,
        discontinuo: false,
        color: null,
      });
      punto(pw, nd);
      extraTramos.push({ nodo: nd, pts: t.pata.map(W) });
      anotarTerminal(at, id, 'start');
      salidas.add(`${redondo(at[0])},${redondo(at[1])}`);
    }
  }

  // Wires: split every net's graph at attachment points into tramos.
  const tramosRed: { nodo: string; pts: Pt[] }[] = [];
  for (const c of cables) {
    const nd = nodoDe(c.red);
    const ady = new Map<string, Pt[]>();
    const xy = new Map<string, Pt>();
    const k = (p: Pt) => `${redondo(p[0])},${redondo(p[1])}`;
    for (const [a, b, cc, dd] of c.runs) {
      const p: Pt = [a, b];
      const q: Pt = [cc, dd];
      xy.set(k(p), p);
      xy.set(k(q), q);
      if (!ady.has(k(p))) ady.set(k(p), []);
      if (!ady.has(k(q))) ady.set(k(q), []);
      ady.get(k(p))!.push(q);
      ady.get(k(q))!.push(p);
    }
    const esAnclaje = (key: string) => (ady.get(key)?.length ?? 0) !== 2 || terminalesEn.has(key);
    const vistas = new Set<string>();
    const arista = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    for (const [key, vecinos] of ady) {
      if (!esAnclaje(key)) continue;
      // Junction dot: three or more wire ends, or a wire meeting at least two pins, or a T on a pin.
      const g = vecinos.length + (terminalesEn.get(key)?.length ?? 0);
      if (g >= 3) uniones.push(xy.get(key)!);
      for (const v0 of vecinos) {
        if (vistas.has(arista(key, k(v0)))) continue;
        const pts: Pt[] = [xy.get(key)!];
        let prev = key;
        let cur = v0;
        vistas.add(arista(prev, k(cur)));
        pts.push(cur);
        while (!esAnclaje(k(cur))) {
          const sig = ady.get(k(cur))!.find((p) => k(p) !== prev)!;
          prev = k(cur);
          cur = sig;
          vistas.add(arista(prev, k(cur)));
          pts.push(cur);
        }
        tramosRed.push({ nodo: nd, pts: simplificar(pts) });
      }
    }
    // Loops without anchors (cannot happen with trees) are ignored.
  }
  // Coincident pins with no wire are a junction too when three or more meet.
  for (const [key, ts] of terminalesEn) {
    if (ts.length >= 3 && !uniones.some((u) => `${redondo(u[0])},${redondo(u[1])}` === key)) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      uniones.push([x, y]);
    }
  }
  for (const u of uniones) {
    const id = nuevoId();
    const key = `${redondo(u[0])},${redondo(u[1])}`;
    const nd = K.puntos.get(key)?.nodo ?? nodoCercano(u);
    K.elementos.push({
      id,
      clase: 'Dot',
      rol: 'DOT',
      designador: null,
      etiquetas: [],
      anclas: { start: D(u) },
      caja: cajaD([u[0] - 0.1, u[1] - 0.1, u[0] + 0.1, u[1] + 0.1]),
      terminales: { start: nd },
      puntos_terminal: { start: punto(u, nd) },
      invertido: false,
      discontinuo: false,
      color: null,
    });
  }
  function nodoCercano(p: Pt): string {
    for (const t of tramosRed) if (t.pts.some((q) => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6)) return t.nodo;
    return 'N0';
  }
  // Net labels.
  for (const e of etiquetas) {
    const nd = nodoDe(e.red);
    const id = nuevoId();
    K.elementos.push({
      id,
      clase: 'Label',
      rol: 'DOT',
      designador: null,
      etiquetas: [e.red],
      etiquetas_html: [esc(e.red)],
      anclas: { start: D(e.fin) },
      caja: cajaD([Math.min(e.pin[0], e.fin[0]) - 0.1, Math.min(e.pin[1], e.fin[1]) - 0.1, Math.max(e.pin[0], e.fin[0]) + 0.1, Math.max(e.pin[1], e.fin[1]) + 0.1]),
      terminales: { start: nd },
      puntos_terminal: { start: punto(e.fin, nd) },
      invertido: false,
      discontinuo: false,
      color: null,
    });
    extraTramos.push({ nodo: nd, pts: [e.pin, e.fin] });
    salidas.add(`${redondo(e.fin[0])},${redondo(e.fin[1])}`);
  }

  for (const t of [...tramosRed, ...extraTramos]) {
    const id = `T${K.tramos.length + 1}`;
    const de = punto(t.pts[0]!, t.nodo);
    const a = punto(t.pts[t.pts.length - 1]!, t.nodo);
    let L = 0;
    for (let i = 1; i < t.pts.length; i++) L += Math.abs(t.pts[i]![0] - t.pts[i - 1]![0]) + Math.abs(t.pts[i]![1] - t.pts[i - 1]![1]);
    K.tramos.push({ id, elemento: null, origen: 'auto', nodo: t.nodo, de, a, puntos: t.pts.map(D), longitud: redondo(L) });
  }

  // Current bookkeeping: each tramo carries the sum of the terminal currents on one side of it.
  calcularFlujo(K, terminalesEn, salidas);

  // Nodes.
  const nodos: Nodo[] = [];
  const porNodo = new Map<string, Nodo>();
  for (const [nombre, id] of idNodo) {
    const n: Nodo = { id, tierra: id === 'N0' && hayTierra, puntos: [], terminales: [], etiquetas: [nombre] };
    porNodo.set(id, n);
    nodos.push(n);
    corr.nodos[id] = nombre;
  }
  for (const p of K.puntos.values()) porNodo.get(p.nodo)?.puntos.push(p.id);
  for (const e of K.elementos) for (const [t, n] of Object.entries(e.terminales ?? {})) porNodo.get(n)?.terminales.push(`${e.id}.${t}`);
  const nodosUsados = nodos.filter((n) => n.puntos.length || n.terminales.length);

  // ---------------------------------------------------------------- bounds and transform
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const ampliar = (r: Rect) => {
    x0 = Math.min(x0, r[0]);
    y0 = Math.min(y0, r[1]);
    x1 = Math.max(x1, r[2]);
    y1 = Math.max(y1, r[3]);
  };
  colocados.forEach((c, i) => {
    const [ox, oy] = desp[i]!;
    ampliar([c.limites[0] + ox, c.limites[1] + oy, c.limites[2] + ox, c.limites[3] + oy]);
  });
  for (const c of cables) for (const [a, b, cc, dd] of c.runs) ampliar([Math.min(a, cc), Math.min(b, dd), Math.max(a, cc), Math.max(b, dd)]);
  const cajaTexto = (x: number, y: number, ancla: string, w: number, tam: number): Rect => {
    const xa = ancla === 'start' ? x : ancla === 'end' ? x - w : x - w / 2;
    return [xa, y - tam, xa + w, y + tam * 0.3];
  };
  for (const e of etiquetas) {
    ampliar([Math.min(e.pin[0], e.fin[0]), Math.min(e.pin[1], e.fin[1]), Math.max(e.pin[0], e.fin[0]), Math.max(e.pin[1], e.fin[1])]);
    ampliar(cajaTexto(e.tx, e.ty, e.ancla, anchoTexto(e.red, TAM_ETQ), TAM_ETQ));
  }
  for (const m of nombres) ampliar(cajaTexto(m.x, m.y, m.ancla, anchoTexto(m.red, TAM_NOMBRE), TAM_NOMBRE));
  for (const ud of unidades) {
    const e = etiquetaMundo(ud);
    if (e) ampliar(e.rect);
  }
  const limites: Rect = [x0, y0, x1, y1];
  const S = ESCALA;
  const M = MARGEN;
  const vista: [number, number, number, number] = [0, 0, Math.ceil((x1 - x0 + 2 * M) * S), Math.ceil((y1 - y0 + 2 * M) * S)];
  const esquema: Esquema = {
    eje: -1,
    tolerancia: 0.02,
    dibujo_a_svg: { sx: S, tx: redondo(S * (M - x0)), sy: -S, ty: redondo(S * (M - y0)) },
    puntos: [...K.puntos.values()],
    elementos: K.elementos,
    nodos: nodosUsados,
    tramos: K.tramos,
  };
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    circuito,
    dibujo: { unidades, cables, uniones, etiquetas, nombres, limites },
    esquema,
    correspondencia: corr,
    vista,
    escala: S,
    margen: M,
    flujo: K.flujo,
    estadisticas: {
      dispositivos: circuito.dispositivos.length + circuito.fuentesRiel.length,
      unidades: unidades.length,
      componentes: colocados.length,
      nodos: circuito.nodos.length,
      cruces,
      solapes,
      etiquetasRed: etiquetas.length,
      etiquetasMovidas: holgura.movidas,
      holguraEtiquetas: Math.round(holgura.minima * 100) / 100,
      etiquetasPegadas: holgura.pegadas,
      longitud,
      codos: nCodos,
      ms: Math.round((t1 - t0) * 10) / 10,
      ignoradas: circuito.ignoradas.length,
      recolocadas: recolocaciones - recolocaciones0,
    },
  };
}

export const TAM_NOMBRE = 0.34;

/** Minimum clearance between a part's label and any wire (drawing units). */
export const HOLGURA_ETIQUETA = 0.15;

/** Axis-aligned distance between two rectangles (0 when they touch or overlap). */
function distancia(a: Rect, b: Rect): number {
  const dx = Math.max(0, a[0] - b[2], b[0] - a[2]);
  const dy = Math.max(0, a[1] - b[3], b[1] - a[3]);
  return Math.hypot(dx, dy);
}

/**
 * Part labels too close to a wire (closer than HOLGURA_ETIQUETA, or crossed by it) move to the free place
 * around their symbol with the largest clearance: beside, above or below the body, centred or shifted, never
 * over a symbol, a lead, a ground or supply symbol, a net-label stub or another label. Returns how many moved,
 * the smallest clearance left and how many labels stay below the minimum.
 */
function separarEtiquetas(unidades: UnidadDibujada[], cables: CableRed[], etiquetas: EtiquetaRed[]): { movidas: number; minima: number; pegadas: number } {
  const cablesR: Rect[] = [];
  for (const cb of cables) for (const [a, b, x, y] of cb.runs) cablesR.push([Math.min(a, x), Math.min(b, y), Math.max(a, x), Math.max(b, y)]);
  const duros: Rect[] = [];
  for (const ud of unidades) {
    const v = ud.u.vars[ud.u.v]!;
    const m = (r: Rect): Rect => [r[0] + ud.x, r[1] + ud.y, r[2] + ud.x, r[3] + ud.y];
    duros.push(m(v.cuerpo));
    for (const [a, b] of v.patas) duros.push(m([Math.min(a[0], b[0]) - 0.03, Math.min(a[1], b[1]) - 0.03, Math.max(a[0], b[0]) + 0.03, Math.max(a[1], b[1]) + 0.03]));
    for (const t of v.talones) {
      duros.push(m(t.rect));
      if (t.etq) duros.push(m(t.etq));
    }
  }
  for (const e of etiquetas) duros.push([Math.min(e.pin[0], e.fin[0]) - 0.05, Math.min(e.pin[1], e.fin[1]) - 0.05, Math.max(e.pin[0], e.fin[0]) + 0.05, Math.max(e.pin[1], e.fin[1]) + 0.05]);
  const textos = unidades.map((ud) => etiquetaMundo(ud));
  const holguraDe = (r: Rect) => {
    let d = Infinity;
    for (const c of cablesR) {
      const x = distancia(r, c);
      if (x < d) d = x;
      if (d === 0) break;
    }
    return d;
  };
  const choca = (r: Rect, yo: number) => {
    const ri: Rect = [r[0] - 0.01, r[1] - 0.01, r[2] + 0.01, r[3] + 0.01];
    const cruza = (o: Rect) => ri[0] < o[2] && o[0] < ri[2] && ri[1] < o[3] && o[1] < ri[3];
    if (duros.some(cruza)) return true;
    return textos.some((t, i) => i !== yo && t && cruza(t.rect));
  };
  let movidas = 0;
  let minima = Infinity;
  let pegadas = 0;
  unidades.forEach((ud, i) => {
    const e = textos[i];
    if (!e || !ud.u.disp) return;
    const h0 = holguraDe(e.rect);
    if (h0 >= HOLGURA_ETIQUETA) {
      minima = Math.min(minima, h0);
      return;
    }
    const v = ud.u.vars[ud.u.v]!;
    const B: Rect = [v.cuerpo[0] + ud.x, v.cuerpo[1] + ud.y, v.cuerpo[2] + ud.x, v.cuerpo[3] + ud.y];
    const cx = (B[0] + B[2]) / 2;
    const cy = (B[1] + B[3]) / 2;
    const cand: EtiquetaUnidad[] = [];
    // The label as it is, and «R1 10 kΩ» also as two lines (narrower, it fits between close wires).
    const formas: { lineas: string[]; w: number; h: number }[] = [{ lineas: e.lineas, w: e.rect[2] - e.rect[0], h: e.rect[3] - e.rect[1] }];
    if (e.lineas.length === 1 && e.lineas[0]!.includes(' ')) {
      const k = e.lineas[0]!.indexOf(' ');
      const dos = [e.lineas[0]!.slice(0, k), e.lineas[0]!.slice(k + 1)];
      formas.push({ lineas: dos, w: Math.max(...dos.map((l) => anchoTexto(l.replace(/[0-9]+(?:[,.][0-9]+)?/g, '8,88'), TAM_ETQ))), h: 2 * ALTO_LINEA });
    }
    let w = 0;
    let h = 0;
    let lineas = e.lineas;
    let lejania = 0;
    const claves: number[] = [];
    const poner = (x0: number, y0: number, ancla: EtiquetaUnidad['ancla']) => {
      cand.push({ rect: [x0, y0, x0 + w, y0 + h], x: ancla === 'start' ? x0 : ancla === 'end' ? x0 + w : x0 + w / 2, ancla, lineas });
      claves.push(lejania);
    };
    // Every place around the body (beside, above, below, centred or shifted, near or a little further out,
    // corners), in both shapes; tried nearest first (the two-line shape counts as a little further).
    formas.forEach((f, k) => {
      ({ w, h, lineas } = f);
      for (const g of [0.14, 0.45, 0.9, 1.4, 2])
        for (const d of [0, -0.5, 0.5, -1, 1, -1.5, 1.5, -2, 2, -2.5, 2.5, -3, 3, -4, 4]) {
          lejania = g + 0.6 * Math.abs(d) + 0.3 * k;
          poner(B[2] + g, cy - h / 2 + d, 'start');
          poner(B[0] - g - w, cy - h / 2 + d, 'end');
          poner(cx - w / 2 + d, B[1] - g - h, 'middle');
          poner(cx - w / 2 + d, B[3] + g, 'middle');
        }
      for (const g of [0.14, 0.45]) {
        lejania = g + 0.8 + 0.3 * k;
        poner(B[2] + g, B[1] - g - h, 'start');
        poner(B[0] - g - w, B[1] - g - h, 'end');
        poner(B[2] + g, B[3] + g, 'start');
        poner(B[0] - g - w, B[3] + g, 'end');
      }
    });
    const orden = cand.map((_, j) => j).sort((x, y) => claves[x]! - claves[y]! || x - y);
    let mejor: EtiquetaUnidad | null = null;
    let hMejor = h0;
    for (const j of orden) {
      const c = cand[j]!;
      if (choca(c.rect, i)) continue;
      const hc = holguraDe(c.rect);
      // The first place (nearest the usual one) that is clear enough, else the clearest.
      if (hc > hMejor + 1e-9) {
        mejor = c;
        hMejor = hc;
        if (hc >= HOLGURA_ETIQUETA) break;
      }
    }
    if (mejor) {
      ud.etq = mejor;
      textos[i] = mejor;
      movidas++;
    }
    minima = Math.min(minima, hMejor);
    if (hMejor < HOLGURA_ETIQUETA) pegadas++;
  });
  return { movidas, minima: Number.isFinite(minima) ? minima : 99, pegadas };
}

/**
 * Texts of net labels and net-name tags, placed where they collide with nothing drawn (symbols, labels,
 * ground and supply symbols, wires, other texts). A tag is left out when no free place is found.
 */
function rotular(unidades: UnidadDibujada[], cables: CableRed[], etiquetas: EtiquetaRed[], c: Circuito): NombreRed[] {
  const ocupado: Rect[] = [];
  for (const ud of unidades) {
    const v = ud.u.vars[ud.u.v]!;
    const m = (r: Rect): Rect => [r[0] + ud.x, r[1] + ud.y, r[2] + ud.x, r[3] + ud.y];
    ocupado.push(m(v.cuerpo));
    const e = etiquetaMundo(ud);
    if (e) ocupado.push(e.rect);
    for (const t of v.talones) {
      ocupado.push(m(t.rect));
      if (t.etq) ocupado.push(m(t.etq));
    }
    for (const [a, b] of v.patas) ocupado.push(m([Math.min(a[0], b[0]) - 0.05, Math.min(a[1], b[1]) - 0.05, Math.max(a[0], b[0]) + 0.05, Math.max(a[1], b[1]) + 0.05]));
  }
  for (const cb of cables) for (const [a, b, x, y] of cb.runs) ocupado.push([Math.min(a, x) - 0.06, Math.min(b, y) - 0.06, Math.max(a, x) + 0.06, Math.max(b, y) + 0.06]);
  for (const e of etiquetas) ocupado.push([Math.min(e.pin[0], e.fin[0]) - 0.06, Math.min(e.pin[1], e.fin[1]) - 0.06, Math.max(e.pin[0], e.fin[0]) + 0.06, Math.max(e.pin[1], e.fin[1]) + 0.06]);
  const libre = (r: Rect) => !ocupado.some((o) => r[0] < o[2] && o[0] < r[2] && r[1] < o[3] && o[1] < r[3]);
  /** Text box for a baseline point and anchor. */
  const caja = (x: number, y: number, ancla: 'start' | 'middle' | 'end', w: number, tam: number): Rect => {
    const x0 = ancla === 'start' ? x : ancla === 'end' ? x - w : x - w / 2;
    return [x0 - 0.04, y - tam * 0.86, x0 + w + 0.04, y + tam * 0.24];
  };
  // Net labels: beyond the stub, else above or below it (horizontal stubs) or beside it (vertical).
  for (const e of etiquetas) {
    const w = anchoTexto(e.red, TAM_ETQ);
    const [dx, dy] = e.dir;
    const [fx, fy] = e.fin;
    const cand: [number, number, 'start' | 'middle' | 'end'][] =
      dx !== 0
        ? [
            [fx + dx * 0.15, fy + 0.15, dx > 0 ? 'start' : 'end'],
            [(e.pin[0] + fx) / 2, fy - 0.14, 'middle'],
            [(e.pin[0] + fx) / 2, fy + 0.5, 'middle'],
            [fx + dx * 0.15, fy - 0.3, dx > 0 ? 'start' : 'end'],
            [fx + dx * 0.15, fy + 0.6, dx > 0 ? 'start' : 'end'],
          ]
        : [
            [fx, dy < 0 ? fy - 0.18 : fy + 0.5, 'middle'],
            [fx + 0.16, (e.pin[1] + fy) / 2 + 0.15, 'start'],
            [fx - 0.16, (e.pin[1] + fy) / 2 + 0.15, 'end'],
          ];
    let elegido = cand[0]!;
    for (const k of cand) {
      if (libre(caja(k[0], k[1], k[2], w, TAM_ETQ))) {
        elegido = k;
        break;
      }
    }
    [e.tx, e.ty, e.ancla] = elegido;
    ocupado.push(caja(e.tx, e.ty, e.ancla, w, TAM_ETQ));
  }
  // Net-name tags: one per wired net, next to its longest run.
  const res: NombreRed[] = [];
  for (const cb of cables) {
    // (A net with labels at some pins still gets its name on the wired part.)
    if (c.rieles.has(cb.red) || esTierra(cb.red)) continue;
    const w = anchoTexto(cb.red, TAM_NOMBRE);
    const runs = mezclarRuns(cb.runs).sort((a, b) => Math.abs(b[2] - b[0]) + Math.abs(b[3] - b[1]) - (Math.abs(a[2] - a[0]) + Math.abs(a[3] - a[1])));
    let hecho = false;
    for (const [a, b, x, y] of runs) {
      const largo = Math.abs(x - a) + Math.abs(y - b);
      if (largo < w * 0.6 + 0.4) continue;
      const cand: [number, number, 'start' | 'middle' | 'end'][] =
        b === y
          ? [
              [(a + x) / 2, b - 0.1, 'middle'],
              [(a + x) / 2, b + 0.36, 'middle'],
              [Math.min(a, x) + 0.25, b - 0.1, 'start'],
              [Math.max(a, x) - 0.25, b - 0.1, 'end'],
            ]
          : [
              [a + 0.1, (b + y) / 2 + 0.12, 'start'],
              [a - 0.1, (b + y) / 2 + 0.12, 'end'],
            ];
      for (const k of cand) {
        const r = caja(k[0], k[1], k[2], w, TAM_NOMBRE);
        // Next to the wire, never on it: shrink the test box away from the run it names.
        if (libre(r)) {
          res.push({ red: cb.red, x: k[0], y: k[1], ancla: k[2] });
          ocupado.push(r);
          hecho = true;
          break;
        }
      }
      if (hecho) break;
    }
  }
  return res;
}

/** Joins collinear touching unit runs of a net into maximal straight runs. */
function mezclarRuns(runs: [number, number, number, number][]): [number, number, number, number][] {
  const h = new Map<number, [number, number][]>();
  const v = new Map<number, [number, number][]>();
  for (const [a, b, c, d] of runs) {
    if (b === d) {
      if (!h.has(b)) h.set(b, []);
      h.get(b)!.push([Math.min(a, c), Math.max(a, c)]);
    } else {
      if (!v.has(a)) v.set(a, []);
      v.get(a)!.push([Math.min(b, d), Math.max(b, d)]);
    }
  }
  const res: [number, number, number, number][] = [];
  const unir = (m: Map<number, [number, number][]>, horiz: boolean) => {
    for (const [k, l] of m) {
      l.sort((p, q) => p[0] - q[0]);
      let [s, e] = l[0]!;
      for (const [p, q] of l.slice(1)) {
        if (p <= e) e = Math.max(e, q);
        else {
          res.push(horiz ? [s, k, e, k] : [k, s, k, e]);
          [s, e] = [p, q];
        }
      }
      res.push(horiz ? [s, k, e, k] : [k, s, k, e]);
    }
  };
  unir(h, true);
  unir(v, false);
  return res;
}

/** Removes collinear interior points of a polyline. */
function simplificar(p: Pt[]): Pt[] {
  if (p.length < 3) return p;
  const r: Pt[] = [p[0]!];
  for (let i = 1; i < p.length - 1; i++) {
    const a = r[r.length - 1]!;
    const b = p[i]!;
    const c = p[i + 1]!;
    if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) continue;
    r.push(b);
  }
  r.push(p[p.length - 1]!);
  return r;
}

/**
 * For every tramo, the terminals whose currents add up to its current from `de` to `a`: the terminals on the
 * far side of the tramo in its piece of net (or minus those on the near side when the far side leaves the
 * drawing through a ground, supply or label symbol).
 */
function calcularFlujo(K: Constructor, terminalesEn: Map<string, { el: string; t: string }[]>, salidas: Set<string>): void {
  const clave = new Map<string, string>(); // point id → coordinate key
  for (const [k, p] of K.puntos) clave.set(p.id, k);
  const ady = new Map<string, { tramo: string; otro: string }[]>();
  for (const t of K.tramos) {
    for (const [a, b] of [
      [t.de, t.a],
      [t.a, t.de],
    ] as const) {
      if (!ady.has(a)) ady.set(a, []);
      ady.get(a)!.push({ tramo: t.id, otro: b });
    }
  }
  const lado = (inicio: string, prohibido: string): { terms: { el: string; t: string }[]; sale: boolean } => {
    const visto = new Set([inicio]);
    const pila = [inicio];
    const terms: { el: string; t: string }[] = [];
    let sale = false;
    while (pila.length) {
      const p = pila.pop()!;
      const k = clave.get(p)!;
      for (const x of terminalesEn.get(k) ?? []) {
        if (salidas.has(k) && x.t === 'start' && K.elementos.find((e) => e.id === x.el && (e.rol === 'GND' || e.rol === 'RAIL'))) sale = true;
        else terms.push(x);
      }
      if (salidas.has(k)) sale = true;
      for (const a of ady.get(p) ?? []) {
        if (a.tramo === prohibido || visto.has(a.otro)) continue;
        visto.add(a.otro);
        pila.push(a.otro);
      }
    }
    return { terms, sale };
  };
  for (const t of K.tramos) {
    const B = lado(t.a, t.id);
    if (!B.sale) {
      K.flujo[t.id] = B.terms.map((x) => ({ ...x, s: 1 as const }));
    } else {
      const A = lado(t.de, t.id);
      K.flujo[t.id] = A.terms.map((x) => ({ ...x, s: -1 as const }));
    }
  }
}

// ------------------------------------------------------------------ text helpers

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function htmlRef(n: string): string {
  const m = /^([A-Za-z])([A-Za-z0-9_]{1,5})$/.exec(n);
  return m ? `${esc(m[1]!)}<sub>${esc(m[2]!)}</sub>` : esc(n);
}

function htmlLinea(l: string, ref: string): string {
  if (l === ref) return htmlRef(ref);
  if (l.startsWith(ref + ' ')) return `${htmlRef(ref)} ${esc(l.slice(ref.length + 1))}`;
  return esc(l);
}

/** Used by the renderer and the hit tests: transformed copy of a rectangle for a placed unit. */
export function rectMundo(ud: UnidadDibujada, r: Rect): Rect {
  return [r[0] + ud.x, r[1] + ud.y, r[2] + ud.x, r[3] + ud.y];
}

export { girar, girarRect };
