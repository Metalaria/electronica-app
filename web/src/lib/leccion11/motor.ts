// 1.1 lessons: the rules of a card as the reader goes through it — when «Continuar» opens (gating), what the main
// button says and does, what a check concludes and which explanation or hint it shows, and the learning event each
// check reports. Pure (no DOM, no runes): componentes/leccion11/Leccion11.svelte holds the state and calls these, and
// the unit tests drive them directly.

import { compilarModelo, enRango, enSuSitio, objetivoEstimar, parejasBien, puntuarEstimacion, type Valores } from './modelo';
import type { EntradaIndice11, Leccion11, Tarjeta, Texto } from './tipos';
import type { OrigenRespuesta } from '../aprendizaje/eventos';
// 1.2: the learning-by-doing step types have their own rules; these functions delegate to them
import { comprobar12, esComprobable12, exploracion12, falta12, nuevoEstadoActividad, puedeComprobar12, reintentar12 } from '../leccion12/motor12';
import type { EstadoActividad12 } from '../leccion12/tipos';
// 1.2 (motor12c): the state of a figure or logic widget, and what its interaction counts as «moved»
import { nombreInteractivo, nuevoEstadoWidget } from '../leccion12/digital/motor-digital';
import type { EstadoWidget12 } from '../leccion12/digital/tipos';

export interface EstadoTarjeta {
  /** Values the reader moved on this card. */
  movidos: string[];
  /** Option chosen (index in the authored order), not yet checked or on show. */
  eleccion: number | null;
  /** Options already tried and wrong (they stay marked and cannot be chosen again). */
  descartadas: number[];
  /** A check is on show (the feedback banner). */
  comprobado: boolean;
  /** Outcome of the last check. */
  bien: boolean | null;
  /** Checks made on this card in this visit. */
  intentos: number;
  /** Right at some point: «Continuar» stays open. */
  resuelta: boolean;
  /** The slider of an estimate (null until it is moved: the start position counts as not answered). */
  estimacion: number | null;
  /** Order on show of an «ordenar» (indices of the right order). */
  orden: number[];
  /** Right-hand item placed on each left-hand item of an «emparejar». */
  puestas: (number | null)[];
  /** The answer's round already reported its final attempt (later checks report nothing). */
  cerrada: boolean;
  /** 1.2: the state of a learning-by-doing step (the estimate typed, the probes taken, the drawing, the query). */
  actividad?: EstadoActividad12;
  /** 1.2: steps of the hint ladder opened (pista 1, pista 2, the solution). */
  pistasVistas?: number;
  /** 1.2: the state of a «figura» or «logica» widget (the zone touched, the switches, the flip-flops). */
  widget12?: EstadoWidget12;
}

export function nuevoEstado(t: Tarjeta): EstadoTarjeta {
  return {
    movidos: [],
    eleccion: null,
    descartadas: [],
    comprobado: false,
    bien: null,
    intentos: 0,
    resuelta: false,
    estimacion: null,
    orden: t.ordenar ? [...t.ordenar.inicio] : [],
    puestas: t.emparejar ? t.emparejar.parejas.map(() => null) : [],
    cerrada: false,
    ...(t.actividad ? { actividad: nuevoEstadoActividad(t) } : {}),
    ...(t.widget?.tipo === 'figura' || t.widget?.tipo === 'logica' ? { widget12: nuevoEstadoWidget(t) } : {}),
    pistasVistas: 0,
  };
}

/** Whether the card has something to check (options, an estimate, an order, pairs, a challenge). */
export function esComprobable(t: Tarjeta): boolean {
  return !!(t.opciones || t.estimar || t.ordenar || t.emparejar || t.condiciones || (t.actividad && esComprobable12(t.actividad)));
}

/** Whether the explore gating is met with the current values. */
export function exploracionHecha(t: Tarjeta, e: EstadoTarjeta, v: Valores): boolean {
  if (t.actividad && !exploracion12(t, v)) return false;
  const r = t.requiere;
  if (!r) return true;
  if (r.mover.some((k) => !e.movidos.includes(k))) return false;
  if (e.movidos.length < r.minimo) return false;
  return r.conectar.every((k) => (v[k] ?? 0) !== 0);
}

/** What still has to be done before «Continuar» on an explore card (spoken next to the disabled button). */
export function faltaPorExplorar(l: Leccion11, t: Tarjeta, e: EstadoTarjeta, v: Valores): string {
  if (t.actividad && !exploracion12(t, v)) return falta12(t);
  const r = t.requiere;
  if (!r) return '';
  const w12 = t.widget?.tipo === 'figura' || t.widget?.tipo === 'logica' ? t.widget : null;
  const nombre = (k: string) => l.modelo.valores[k]?.nombre ?? (w12 ? nombreInteractivo(w12, k) : k);
  const verbo = w12?.tipo === 'figura' ? 'toque' : 'mueva';
  const sin = r.mover.filter((k) => !e.movidos.includes(k));
  if (sin.length) return `Para seguir, ${verbo}: ${sin.map(nombre).join(', ')}.`;
  if (e.movidos.length < r.minimo)
    return w12?.tipo === 'figura' ? 'Para seguir, toque una zona de la figura.' : w12?.tipo === 'logica' ? (w12.cronograma ? 'Para seguir, mueva el cursor del cronograma.' : 'Para seguir, cambie una entrada del circuito.') : 'Para seguir, mueva uno de los mandos.';
  const abiertos = r.conectar.filter((k) => (v[k] ?? 0) === 0);
  if (abiertos.length) return 'Para seguir, conecte la carga.';
  return '';
}

/** Whether the answer on show can be checked (something chosen, moved, placed). */
export function puedeComprobar(t: Tarjeta, e: EstadoTarjeta): boolean {
  if (t.actividad && esComprobable12(t.actividad)) return puedeComprobar12(t, e.actividad);
  if (t.opciones) return e.eleccion !== null;
  if (t.estimar) return e.estimacion !== null;
  if (t.emparejar) return e.puestas.every((x) => x !== null);
  return true;
}

export type Accion = 'continuar' | 'comprobar' | 'reintentar';

/** The main button of a card. */
export function botonPrincipal(t: Tarjeta, e: EstadoTarjeta, v: Valores): { texto: string; accion: Accion; bloqueado: boolean } {
  if (t.tipo === 'resumen') return { texto: 'Terminar', accion: 'continuar', bloqueado: false };
  if (esComprobable(t)) {
    // (1.2: a «simular» estimate is committed once: right or wrong, the simulation is shown and the card goes on)
    if (e.resuelta && (!e.comprobado || e.bien || t.actividad?.tipo === 'simular')) return { texto: 'Continuar', accion: 'continuar', bloqueado: false };
    if (e.comprobado && !e.bien) return { texto: 'Volver a intentarlo', accion: 'reintentar', bloqueado: false };
    return { texto: 'Comprobar', accion: 'comprobar', bloqueado: !puedeComprobar(t, e) };
  }
  return { texto: 'Continuar', accion: 'continuar', bloqueado: !exploracionHecha(t, e, v) };
}

export interface Aviso {
  bien: boolean;
  titulo: string;
  textos: Texto[];
}

const T = (s: string): Texto => [{ t: 'txt', s }];

/**
 * Checks the answer on show. Returns the new state and the feedback (the explanation of the option chosen — every
 * option has one —, the challenge's or the estimate's success text, or the first hint that applies; after two failed
 * checks, the card's extra help too).
 */
export function comprobar(l: Leccion11, t: Tarjeta, e: EstadoTarjeta, v: Valores): { estado: EstadoTarjeta; aviso: Aviso } {
  const mc = compilarModelo(l.modelo);
  const r = mc.evaluar(v);
  const intentos = e.intentos + 1;
  let bien = false;
  let textos: Texto[] = [];
  let resuelta12 = false;
  let actividad = e.actividad;
  if (t.actividad && esComprobable12(t.actividad)) {
    const r12 = comprobar12(mc, t, e.actividad, v);
    bien = r12.bien;
    textos = r12.textos;
    resuelta12 = !!r12.resuelta;
    if (r12.estado) actividad = r12.estado;
  } else if (t.opciones) {
    const o = t.opciones[e.eleccion ?? -1];
    bien = !!o?.bien;
    if (o) textos = [o.porque];
  } else {
    let estadoPistas: Valores = r;
    if (t.estimar) {
      const obj = objetivoEstimar(mc, t.estimar, v);
      bien = puntuarEstimacion(e.estimacion ?? t.estimar.inicio, obj, t.estimar.tol).bien;
      estadoPistas = { ...r, estimacion: e.estimacion ?? t.estimar.inicio };
    } else if (t.ordenar) bien = enSuSitio(e.orden) === e.orden.length;
    else if (t.emparejar) bien = parejasBien(e.puestas) === e.puestas.length;
    else if (t.condiciones) bien = t.condiciones.every((c) => enRango(c, r));
    if (bien) textos = t.exito ? [t.exito] : [];
    else {
      const p = (t.pistas ?? []).find((x) => !x.cuando || enRango(x.cuando, estadoPistas));
      if (p) textos = [p.texto];
      if (t.ordenar) textos.push(T(`${enSuSitio(e.orden)} de ${e.orden.length} en su sitio.`));
      if (t.emparejar) textos.push(T(`${parejasBien(e.puestas)} de ${e.puestas.length} bien emparejadas.`));
    }
  }
  if (!bien && intentos >= 2 && t.ayuda) textos.push(t.ayuda);
  // 1.2: after two failed checks the ladder's last step, the solution (counted as help, as «ayuda»)
  if (!bien && intentos >= 2 && t.solucion && !resuelta12) textos.push(t.solucion);
  const titulo = bien ? (t.condiciones ? '¡Conseguido!' : 'Eso es.') : t.opciones ? 'Por qué no.' : 'Todavía no.';
  const estado: EstadoTarjeta = {
    ...e,
    comprobado: true,
    bien,
    intentos,
    resuelta: e.resuelta || bien || resuelta12,
    ...(actividad ? { actividad } : {}),
    descartadas: t.opciones && !bien && e.eleccion !== null && !e.descartadas.includes(e.eleccion) ? [...e.descartadas, e.eleccion] : e.descartadas,
  };
  return { estado, aviso: { bien, titulo, textos } };
}

/**
 * Review 11c: a card answered in an earlier visit (in the stored `h`, the cards passed) shows as answered when the
 * reader goes back to it after a reload — not blank with «Continuar» locked again. An option, an order or a pairing
 * shows its right answer with its explanation; an estimate or a challenge, whose answer depends on values not kept,
 * just opens «Continuar» (and the hidden reading). The round is closed: nothing is reported again (no XP).
 */
export function estadoRespondido(t: Tarjeta): { estado: EstadoTarjeta; aviso: Aviso | null } {
  const e: EstadoTarjeta = { ...nuevoEstado(t), resuelta: true, cerrada: true };
  const ok = (estado: EstadoTarjeta, textos: Texto[]) => ({ estado: { ...estado, comprobado: true, bien: true, intentos: 1 }, aviso: { bien: true, titulo: 'La respuesta.', textos } });
  if (t.opciones) {
    const k = t.opciones.findIndex((o) => o.bien);
    if (k >= 0) return ok({ ...e, eleccion: k }, [t.opciones[k]!.porque]);
  } else if (t.ordenar) {
    return ok({ ...e, orden: t.ordenar.inicio.map((_, k) => k) }, t.exito ? [t.exito] : []);
  } else if (t.emparejar) {
    return ok({ ...e, puestas: t.emparejar.parejas.map((_, k) => k) }, t.exito ? [t.exito] : []);
  }
  return { estado: e, aviso: null };
}

/** «Volver a intentarlo»: the feedback goes, the values stay (a wrong option stays marked and cannot be chosen). */
export function reintentar(t: Tarjeta, e: EstadoTarjeta): EstadoTarjeta {
  const actividad = reintentar12(e.actividad);
  return { ...e, comprobado: false, bien: null, eleccion: t.opciones ? null : e.eleccion, ...(actividad ? { actividad } : {}) };
}

/** Id under which a card's answers are recorded (XP once per id, mastery of the section). */
export function idRespuesta(l: Leccion11, t: Tarjeta): string {
  return idRespuestaDe(l.parte, l.seccion, t.id);
}

export function idRespuestaDe(parte: string, seccion: string, tarjeta: string): string {
  return `${parte}-l11-${seccion}-${tarjeta}`;
}

/**
 * Cards that «Práctica inteligente» and the section's spaced review also ask on their own (motor fixes 1.1):
 * predictions, questions (options, estimate, order, pairs) and challenges. They make sense out of the lesson because
 * each one carries its own widget and the state the generator checked (the model's values with the starting values
 * of the cards before it). A «por qué» card is left out: it asks about the surprise of the card before it.
 */
export function esPracticable(t: Tarjeta): boolean {
  // (1.2: the step types that are answered too; «ajuste» and the optional «banco» are not questions)
  return (t.tipo === 'predecir' || t.tipo === 'pregunta' || t.tipo === 'reto' || t.tipo === 'simular' || t.tipo === 'diseno' || t.tipo === 'averia' || t.tipo === 'dibujar' || t.tipo === 'sql' || t.tipo === 'tocar' || t.tipo === 'tabla') && esComprobable(t);
}

/** A lesson's entry in libro/lecciones11/indice.json: its number of cards and the cards that can be practised. */
export function entradaIndice(l: Leccion11): EntradaIndice11 {
  return { tarjetas: l.tarjetas.length, preguntas: l.tarjetas.filter(esPracticable).map((t) => ({ id: t.id, tipo: t.tipo })) };
}

/**
 * The reader's values when a card is opened on its own (a deep link, «Práctica inteligente»): the model's values with
 * the starting values of every card up to it, as if the reader had come through them — the state the generator
 * checks each card in.
 */
export function valoresSueltos(l: Leccion11, k: number): Valores {
  let v: Valores = {};
  for (const [id, x] of Object.entries(l.modelo.valores)) v[id] = x.valor;
  for (let j = 0; j <= k && j < l.tarjetas.length; j++) v = { ...v, ...l.tarjetas[j]!.inicio };
  return v;
}

/** The learning event of a check (lib/aprendizaje/eventos.ts), or null once its round is closed. */
export function eventoDeComprobacion(
  l: Leccion11,
  t: Tarjeta,
  antes: EstadoTarjeta,
  despues: EstadoTarjeta,
  /** «inteligente» when the card is asked by «Práctica inteligente» (same id: XP once, the same mastery rounds). */
  origen: Extract<OrigenRespuesta, 'leccion' | 'inteligente'> = 'leccion',
): { evento: { tipo: 'respuesta'; id: string; clase: 'practica'; origen: 'leccion' | 'inteligente'; correcta: boolean; intento: number; pistas: number; final: boolean; parte: string; seccion: string; subtipo: string }; cerrada: boolean } | null {
  if (antes.cerrada || antes.resuelta) return null;
  const correcta = !!despues.bien;
  // two attempts per round, as the 1.0 practice: the second wrong one closes it (later attempts still teach, but
  // report nothing)
  const final = correcta || despues.intentos >= 2;
  return {
    evento: {
      tipo: 'respuesta',
      id: idRespuesta(l, t),
      clase: 'practica',
      origen,
      correcta,
      intento: despues.intentos,
      // (1.2: the steps of the hint ladder opened count as help too)
      pistas: Math.max(despues.intentos >= 2 && (t.ayuda || t.solucion) ? 1 : 0, despues.pistasVistas ?? 0),
      final,
      parte: l.parte,
      seccion: l.seccion,
      subtipo: `leccion11-${t.tipo}`,
    },
    cerrada: final,
  };
}

/** The reader's values at the start of a card (the card's starting values on top of the ones carried over). */
export function valoresAlEntrar(t: Tarjeta, propios: Valores, primeraVez: boolean): Valores {
  return primeraVez ? { ...propios, ...t.inicio } : propios;
}

/** Summary line of the attempts («Todo a la primera.», «Con 2 intentos fallidos: lo repasará antes.»). */
export function resumenIntentos(fallos: number): string {
  if (fallos === 0) return 'Todo a la primera.';
  return `Con ${fallos} ${fallos === 1 ? 'intento fallido' : 'intentos fallidos'}: lo repasará antes.`;
}
