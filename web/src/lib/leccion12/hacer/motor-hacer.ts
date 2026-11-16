// 1.2.1 (piloto121): the rules of the cards answered by doing (GUIA §13) — their fresh state, when they can be
// checked, what a check concludes and says (the feedback is about what the reader DID: «la corriente que mide es la
// de R₂, no la de la carga»), «Volver a intentarlo» — and the goal («objetivo») of an explore, surprise or tuning
// card. lib/leccion11/motor.ts calls these, so the shell, the events, the XP and the requeue of missed cards work as
// for every other step. Pure.

import { enRango, formatear, type ModeloCompilado, type Valores } from '../../leccion11/modelo';
import { fraccionEje } from '../../leccion11/ejes';
import { textoPlano } from '../../leccion11/texto';
import type { Grafica, Magnitud, Tarjeta, Texto, WidgetCircuito } from '../../leccion11/tipos';
import { diagnosticar } from '../prediccion';
import type { Simular } from '../tipos';
import { describirMedida, lectura, medidaBien, medidaCompleta, porqueMedida, solucionWidget, unidadMedida } from './medir';
import type { ActividadHacer, Elegir, EstadoActividadHacer, EstadoElegir, EstadoMedida, Marcar } from './tipos';

const T = (s: string): Texto => [{ t: 'txt', s }];

export const TIPOS_HACER = ['medir', 'elegir', 'marcar', 'leer'] as const;

export function esActividadHacer(a: { tipo: string } | undefined): a is ActividadHacer {
  return !!a && (TIPOS_HACER as readonly string[]).includes(a.tipo);
}

/** A reading formatted in its unit («4,80 V», «3,60 mA»). */
export function formatoLectura(unidad: string, x: number | null | undefined): string {
  const mag: Magnitud = { sim: [], nombre: '', unidad, cifras: 3, recortar: false };
  return x == null ? '—' : formatear(mag, Math.abs(x) < 1e-12 ? 0 : x);
}

// ------------------------------------------------------------------ «marcar»: the graph and the marker

/** The graph a «marcar» card's marker lives on: a «grafica» widget or a circuit's graph. */
export function graficaDe(t: Tarjeta): Grafica | null {
  const w = t.widget;
  if (w?.tipo === 'grafica') return w;
  if (w?.tipo === 'circuito' && w.grafica) return w.grafica;
  return null;
}

/** The y of the marker: on its curve (modo x), else its own. */
export function yMarca(mc: ModeloCompilado, g: Grafica, a: Marcar, r: Valores, x: number, y: number): number {
  if (a.modo !== 'x') return y;
  const c = g.curvas[a.curva ?? 0];
  return c ? mc.funcion(c.expr)({ ...r, [g.x.id]: x }) : y;
}

/** The target point of a «marcar» card with the model's evaluation `r`. */
export function objetivoMarca(mc: ModeloCompilado, a: Marcar, r: Valores): { x: number | null; y: number | null } {
  return { x: a.x ? mc.funcion(a.x)(r) : null, y: a.y ? mc.funcion(a.y)(r) : null };
}

/** Signed distance from the target, as a fraction of each axis along its scale (+ = right of / above it). */
export function desviacionMarca(mc: ModeloCompilado, g: Grafica, a: Marcar, r: Valores, m: { x: number; y: number }): { dx: number | null; dy: number | null } {
  const o = objetivoMarca(mc, a, r);
  const y = yMarca(mc, g, a, r, m.x, m.y);
  return {
    dx: o.x != null && a.modo !== 'y' ? fraccionEje(g.x, m.x) - fraccionEje(g.x, o.x) : null,
    dy: o.y != null && a.modo !== 'x' ? fraccionEje(g.y, y) - fraccionEje(g.y, o.y) : null,
  };
}

export function marcaBien(mc: ModeloCompilado, g: Grafica, a: Marcar, r: Valores, m: { x: number; y: number }): boolean {
  const d = desviacionMarca(mc, g, a, r, m);
  return (d.dx == null || Math.abs(d.dx) <= a.tol + 1e-12) && (d.dy == null || Math.abs(d.dy) <= a.tol + 1e-12);
}

/** The keyboard positions of the marker along an axis (evenly spaced on its scale). */
export function posicionesMarca(e: Grafica['x'] | Grafica['y'], pasos: number): number[] {
  const out: number[] = [];
  for (let k = 0; k <= pasos; k++) out.push(e.escala === 'log' ? e.min * (e.max / e.min) ** (k / pasos) : e.min + ((e.max - e.min) * k) / pasos);
  return out;
}

// ------------------------------------------------------------------ state, checks

export function nuevoEstadoHacer(a: ActividadHacer): EstadoActividadHacer {
  switch (a.tipo) {
    case 'medir':
      return { tipo: 'medir' };
    case 'elegir':
      return { tipo: 'elegir', elegidas: [], descartadas: [] };
    case 'marcar':
      return { tipo: 'marcar', x: a.inicio.x, y: a.inicio.y, movida: false };
    case 'leer':
      return { tipo: 'leer', texto: '', valor: null };
  }
}

/** What a card's state needs for these checks: the activity's own and the instrument's placement. */
export interface EstadoHacer {
  actividad?: { tipo: string };
  medida?: EstadoMedida;
}

export function puedeComprobarHacer(a: ActividadHacer, e: EstadoHacer): boolean {
  const ea = e.actividad as EstadoActividadHacer | undefined;
  switch (a.tipo) {
    case 'medir':
      return medidaCompleta(a, e.medida);
    case 'elegir':
      return ea?.tipo === 'elegir' && ea.elegidas.length > 0;
    case 'marcar':
      return ea?.tipo === 'marcar' && ea.movida;
    case 'leer':
      return ea?.tipo === 'leer' && ea.valor != null && Number.isFinite(ea.valor);
  }
}

export interface VeredictoHacer {
  bien: boolean;
  textos: Texto[];
  estado?: EstadoActividadHacer;
  medida?: EstadoMedida;
}

/** The first hint whose condition holds on these variables (one without condition always does). */
function pista(t: Tarjeta, vars: Valores): Texto | undefined {
  return (t.pistas ?? []).find((p) => !p.cuando || enRango(p.cuando, vars))?.texto;
}

/** Checks the card with the card's values `v` (the model's inputs). */
export function comprobarHacer(mc: ModeloCompilado, t: Tarjeta, a: ActividadHacer, e: EstadoHacer, v: Valores): VeredictoHacer {
  const exito = t.exito ? [t.exito] : [];
  const r = mc.evaluar(v);
  const ea = e.actividad as EstadoActividadHacer | undefined;
  if (a.tipo === 'medir') {
    const w = t.widget as WidgetCircuito;
    const i = w.instrumento!;
    const m = e.medida!;
    const x = lectura(i, m, solucionWidget(w, r));
    const leido = i.tipo === 'multimetro' ? `: ${formatoLectura(unidadMedida(m), x)}` : '';
    if (medidaBien(a, m)) return { bien: true, textos: [T(`Así se mide: ${describirMedida(i, m)}${leido}.`), ...exito] };
    // (the wrong mode is said first: the probes left from the other mode do not count)
    const modo =
      a.magnitud === 'tension' && m.modo === 'A'
        ? T('Una tensión se mide en paralelo: pase el multímetro a voltios y ponga las dos puntas.')
        : a.magnitud === 'corriente' && m.modo === 'V'
          ? T('Una corriente se mide en serie: pase el multímetro a amperios y abra una rama.')
          : null;
    const propia = modo ? undefined : porqueMedida(a, m);
    const p = pista(t, r);
    return { bien: false, textos: [T(`Ha puesto ${describirMedida(i, m)}${leido}.`), propia ?? modo ?? T('Eso no es lo que se pide medir.'), ...(p ? [p] : [])] };
  }
  if (a.tipo === 'elegir' && ea?.tipo === 'elegir') return comprobarElegir(t, a, ea, exito, r);
  if (a.tipo === 'marcar' && ea?.tipo === 'marcar') {
    const g = graficaDe(t);
    if (!g) return { bien: false, textos: [] };
    const d = desviacionMarca(mc, g, a, r, ea);
    const ok = marcaBien(mc, g, a, r, ea);
    if (ok) return { bien: true, textos: exito };
    const y = yMarca(mc, g, a, r, ea.x, ea.y);
    const p = pista(t, { ...r, marca_x: ea.x, marca_y: y });
    const lados: string[] = [];
    if (d.dx != null && Math.abs(d.dx) > a.tol) lados.push(d.dx > 0 ? 'demasiado a la derecha' : 'demasiado a la izquierda');
    if (d.dy != null && Math.abs(d.dy) > a.tol) lados.push(d.dy > 0 ? 'demasiado arriba' : 'demasiado abajo');
    return { bien: false, textos: [p ?? T(`Su marca está ${lados.join(' y ')}.`)] };
  }
  if (a.tipo === 'leer' && ea?.tipo === 'leer') {
    const x = ea.valor ?? NaN;
    const s: Simular = { tipo: 'simular', objetivo: a.objetivo, unidad: a.unidad, cifras: a.cifras, tol: a.tol, rotulo: a.rotulo, errores: a.errores };
    const d = diagnosticar(mc, s, v, x);
    if (d.bien) return { bien: true, textos: exito };
    const p = pista(t, { ...r, lectura: x });
    return { bien: false, textos: [d.texto ?? p ?? T('No es lo que marca: vuelva a mirar el instrumento y fíjese en la unidad.')] };
  }
  return { bien: false, textos: [] };
}

function comprobarElegir(t: Tarjeta, a: Elegir, e: EstadoElegir, exito: Texto[], r: Valores): VeredictoHacer {
  const malas = e.elegidas.filter((z) => !a.bien.includes(z));
  const faltan = a.bien.filter((z) => !e.elegidas.includes(z));
  const bien = a.todas ? !malas.length && !faltan.length : !malas.length && e.elegidas.some((z) => a.bien.includes(z));
  if (bien) return { bien: true, textos: exito };
  const nombre = (z: string) => textoPlano(a.zonas.find((x) => x.id === z)?.rotulo) || z;
  const textos: Texto[] = malas.map((z) => a.porque[z] ?? T(`«${nombre(z)}» no es.`));
  if (a.todas && !malas.length && faltan.length) textos.push(T(faltan.length === 1 ? 'Le falta una.' : `Le faltan ${faltan.length}.`));
  const p = pista(t, { ...r, mal: malas.length, faltan: faltan.length });
  if (p) textos.push(p);
  return { bien: false, textos, estado: { ...e, descartadas: [...new Set([...e.descartadas, ...malas])], elegidas: e.elegidas.filter((z) => !malas.includes(z)) } };
}

/** «Volver a intentarlo»: what stays (the marker, the text, the placement) and what goes. */
export function reintentarHacer(e: EstadoActividadHacer): EstadoActividadHacer {
  return e;
}

/** A tap on a zone of the schematic: chosen, or taken back (a crossed-out one cannot be chosen again). */
export function tocarZona(a: Elegir, e: EstadoElegir, id: string): EstadoElegir {
  if (e.descartadas.includes(id) || !a.zonas.some((z) => z.id === id)) return e;
  if (e.elegidas.includes(id)) return { ...e, elegidas: e.elegidas.filter((z) => z !== id) };
  return { ...e, elegidas: a.todas ? [...e.elegidas, id] : [id] };
}

// ------------------------------------------------------------------ «objetivo» of an explore, surprise or tuning card

/** Whether the goal holds for the model's evaluation `r`. */
export function objetivoCumplido(t: Tarjeta, r: Valores): boolean {
  return !!t.objetivo && t.objetivo.condiciones.every((c) => enRango(c, r));
}

/** The live advice while the goal is not reached (the first hint whose «cuando» holds). */
export function consejoObjetivo(t: Tarjeta, r: Valores): Texto | undefined {
  if (!t.objetivo || objetivoCumplido(t, r)) return undefined;
  return t.objetivo.pistas.find((p) => !p.cuando || enRango(p.cuando, r))?.texto;
}
