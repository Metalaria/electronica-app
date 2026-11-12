// 1.2 step types on the «figura» and «logica» widgets (GUIA §11): their fresh state, when they can be checked, what
// a check concludes and says, «Volver a intentarlo». lib/leccion12/motor12.ts delegates here for these activities, so
// the shell, the events, the XP and the requeue of missed cards work as for every other step. Pure.

import { textoPlano } from '../../leccion11/texto';
import type { Tarjeta, Texto } from '../../leccion11/tipos';
import { generador, semillaDe } from '../azar';
import { cronograma, filaEntradas, iniciar, leer, NOMBRE_PIEZA, sondear, tablaVerdad, type CircuitoLogico, type FalloLogico, type Lectura, type Nivel, type PiezaLogica, type Punto } from './logica';
import type {
  ActividadDigital, AveriaLogica, DisenoLogico, EstadoActividadDigital, EstadoAveriaLogica, EstadoDisenoLogico, EstadoTocar, EstadoWidget12, Tocar,
  WidgetFigura, WidgetLogica,
} from './tipos';

const T = (s: string): Texto => [{ t: 'txt', s }];

export const TIPOS_DIGITALES = ['tocar', 'tabla', 'averia-logica', 'diseno-logico', 'dibujar-digital'] as const;

export function esActividadDigital(a: { tipo: string } | undefined): a is ActividadDigital {
  return !!a && (TIPOS_DIGITALES as readonly string[]).includes(a.tipo);
}

export const NOMBRE_FALLO_LOGICO: Record<string, string> = {
  'atascada-0': 'salida atascada a 0',
  'atascada-1': 'salida atascada a 1',
  'sin-conexion': 'entrada sin conectar',
};

// ------------------------------------------------------------------ widget state

export function nuevoEstadoWidget(t: Tarjeta): EstadoWidget12 | undefined {
  const w = t.widget;
  if (w?.tipo !== 'figura' && w?.tipo !== 'logica') return undefined;
  const niveles: Record<string, Nivel> = {};
  if (w.tipo === 'logica') for (const e of w.circuito.entradas) niveles[e.id] = e.valor;
  return { zona: null, niveles, logica: null, pulsos: 0, tramo: 0 };
}

/** The ids a widget's interaction marks as «moved» (an explore card's `requiere.mover`): zones, switches or the cursor. */
export function interactivos(w: WidgetFigura | WidgetLogica): string[] {
  if (w.tipo === 'figura') return w.zonas.map((z) => z.id);
  if (w.cronograma) return ['tramo'];
  return w.circuito.entradas.map((e) => e.id);
}

/** A readable name of an interactive id (the «what is left to do» line). */
export function nombreInteractivo(w: WidgetFigura | WidgetLogica, id: string): string {
  if (w.tipo === 'figura') return textoPlano(w.zonas.find((z) => z.id === id)?.rotulo) || id;
  if (id === 'tramo') return 'el cursor del cronograma';
  const e = w.circuito.entradas.find((x) => x.id === id);
  return e ? (e.reloj ? `el reloj ${textoPlano(e.rotulo)}` : `el interruptor ${textoPlano(e.rotulo)}`) : id;
}

/** The circuit on show: the widget's, or the reader's design (its gates and the LED wired where they chose). */
export function circuitoEnUso(w: WidgetLogica, a: ActividadDigital | undefined, ea: EstadoActividadDigital | undefined): CircuitoLogico {
  if (a?.tipo === 'diseno-logico' && ea?.tipo === 'diseno-logico') return circuitoDiseno(w.circuito, a, ea);
  return w.circuito;
}

export function circuitoDiseno(base: CircuitoLogico, a: DisenoLogico, ea: EstadoDisenoLogico): CircuitoLogico {
  const piezas: PiezaLogica[] = ea.puertas.map((p, k) => ({ id: `p${k + 1}`, tipo: p.tipo, entradas: [...p.entradas] }));
  return {
    entradas: base.entradas,
    piezas,
    salidas: base.salidas.map((s) => (s.id === a.salida ? { ...s, de: ea.salida ?? '0' } : s)),
  };
}

/** The fault laid over the circuit on show (the hidden fault of a fault-finding card). */
export function falloEnUso(a: ActividadDigital | undefined, ea: EstadoActividadDigital | undefined): FalloLogico | null {
  if (a?.tipo === 'averia-logica' && ea?.tipo === 'averia-logica') return a.fallos[ea.fallo]?.fallo ?? null;
  return null;
}

// ------------------------------------------------------------------ steps

function falloDeRonda(n: number, eleccion: 'fija' | 'azar', id: string, ronda: number, semilla = semillaDe(id)): number {
  if (eleccion === 'fija' || n < 2) return ronda % n;
  const rnd = generador(semilla);
  let k = Math.floor(rnd() * n);
  for (let j = 0; j < ronda; j++) {
    const s = Math.floor(rnd() * (n - 1));
    k = s >= k ? s + 1 : s;
  }
  return k;
}

export function nuevoEstadoDigital(t: Tarjeta, a: ActividadDigital, semilla?: number): EstadoActividadDigital {
  switch (a.tipo) {
    case 'tocar':
      return { tipo: 'tocar', elegidas: [], descartadas: [] };
    case 'tabla':
      return { tipo: 'tabla', celdas: a.esperado.map((f) => f.map(() => null)), mal: [] };
    case 'averia-logica':
      return { tipo: 'averia-logica', fallo: falloDeRonda(a.fallos.length, a.eleccion, t.id, 0, a.eleccion === 'azar' ? semilla : undefined), ronda: 0, medidas: [], sospechoso: null, tipoElegido: null, descartados: [] };
    case 'diseno-logico':
      return { tipo: 'diseno-logico', puertas: [], salida: null };
    case 'dibujar-digital':
      return { tipo: 'dibujar-digital', niveles: a.esperado.map(() => null), mal: [] };
  }
}

export function otraAveriaLogica(t: Tarjeta, a: AveriaLogica, e: EstadoAveriaLogica, semilla?: number): EstadoAveriaLogica {
  const ronda = e.ronda + 1;
  return { tipo: 'averia-logica', fallo: falloDeRonda(a.fallos.length, a.eleccion, t.id, ronda, semilla), ronda, medidas: [], sospechoso: null, tipoElegido: null, descartados: [] };
}

export function puedeComprobarDigital(a: ActividadDigital, e: EstadoActividadDigital | undefined): boolean {
  if (!e || e.tipo !== a.tipo) return false;
  switch (e.tipo) {
    case 'tocar':
      return e.elegidas.length > 0;
    case 'tabla':
      return e.celdas.every((f) => f.every((x) => x !== null));
    case 'averia-logica':
      return e.sospechoso != null && (!(a as AveriaLogica).preguntarTipo || e.tipoElegido != null);
    case 'diseno-logico':
      return e.puertas.length > 0 && e.salida != null;
    case 'dibujar-digital':
      return e.niveles.every((x) => x !== null);
  }
}

export interface VeredictoDigital {
  bien: boolean;
  textos: Texto[];
  estado?: EstadoActividadDigital;
}

/** The first hint whose condition holds on these variables (a hint without condition always does). */
function pistaDe(t: Tarjeta, vars: Record<string, number>): Texto | undefined {
  return (t.pistas ?? []).find((p) => {
    if (!p.cuando) return true;
    const v = vars[p.cuando.valor];
    if (v == null) return false;
    return (p.cuando.min == null || v >= p.cuando.min) && (p.cuando.max == null || v <= p.cuando.max);
  })?.texto;
}

const nivelTexto = (x: Lectura) => (x === 'aire' ? 'ningún nivel (al aire)' : x === 1 ? 'nivel alto (1)' : 'nivel bajo (0)');

export function comprobarDigital(t: Tarjeta, a: ActividadDigital, e: EstadoActividadDigital | undefined): VeredictoDigital {
  const exito = t.exito ? [t.exito] : [];
  if (a.tipo === 'tocar' && e?.tipo === 'tocar') return comprobarTocar(t, a, e, exito);
  if (a.tipo === 'tabla' && e?.tipo === 'tabla') {
    const mal = a.esperado.map((f, r) => (f.every((x, k) => e.celdas[r]?.[k] === x) ? -1 : r)).filter((r) => r >= 0);
    if (!mal.length) return { bien: true, textos: exito, estado: { ...e, mal: [] } };
    const p = pistaDe(t, { error: mal.length / a.esperado.length, filas_mal: mal.length });
    return { bien: false, textos: [T(`${a.esperado.length - mal.length} de ${a.esperado.length} filas bien; las que no, están marcadas.`), ...(p ? [p] : [])], estado: { ...e, mal } };
  }
  if (a.tipo === 'averia-logica' && e?.tipo === 'averia-logica') return comprobarAveria(t, a, e, exito);
  if (a.tipo === 'diseno-logico' && e?.tipo === 'diseno-logico') return comprobarDiseno(t, a, e, exito);
  if (a.tipo === 'dibujar-digital' && e?.tipo === 'dibujar-digital') {
    const mal = a.esperado.map((x, k) => (e.niveles[k] === x ? -1 : k)).filter((k) => k >= 0);
    if (!mal.length) return { bien: true, textos: exito, estado: { ...e, mal: [] } };
    const p = pistaDe(t, { error: mal.length / a.esperado.length, tramos_mal: mal.length });
    const ciclo = Math.floor(mal[0]! / 2) + 1;
    return { bien: false, textos: [T(`${mal.length} de ${a.esperado.length} tramos no coinciden (marcados); el primero, en el ciclo ${ciclo}.`), ...(p ? [p] : [])], estado: { ...e, mal } };
  }
  return { bien: false, textos: [] };
}

function comprobarTocar(t: Tarjeta, a: Tocar, e: EstadoTocar, exito: Texto[]): VeredictoDigital {
  const malas = e.elegidas.filter((z) => !a.bien.includes(z));
  const faltan = a.bien.filter((z) => !e.elegidas.includes(z));
  const bien = a.todas ? !malas.length && !faltan.length : !malas.length && e.elegidas.some((z) => a.bien.includes(z));
  if (bien) return { bien: true, textos: exito };
  const textos: Texto[] = malas.map((z) => a.porque[z] ?? T('No es esa.'));
  if (a.todas && !malas.length && faltan.length) textos.push(T(faltan.length === 1 ? 'Le falta una.' : `Le faltan ${faltan.length}.`));
  const p = pistaDe(t, { mal: malas.length, faltan: faltan.length });
  if (p) textos.push(p);
  return { bien: false, textos, estado: { ...e, descartadas: [...new Set([...e.descartadas, ...malas])], elegidas: e.elegidas.filter((z) => !malas.includes(z)) } };
}

/** What the probe would read at a point with fault `f`, for the switches of a measurement (combinational). */
export function lecturaCon(c: CircuitoLogico, niveles: Record<string, Nivel>, punto: Punto, f: FalloLogico | null): Lectura {
  return sondear(c, iniciar(c, f, niveles), punto, f);
}

export function puntoDe(a: AveriaLogica, id: string): Punto | null {
  return a.puntos.find((p) => p.id === id)?.punto ?? null;
}

function comprobarAveria(t: Tarjeta, a: AveriaLogica, e: EstadoAveriaLogica, exito: Texto[]): VeredictoDigital {
  const real = a.fallos[e.fallo]!;
  const w = t.widget as WidgetLogica;
  const c = w.circuito;
  if (e.sospechoso === real.pieza && (!a.preguntarTipo || e.tipoElegido === real.tipo)) return { bien: true, textos: [real.texto, ...exito] };
  if (e.sospechoso === real.pieza) return { bien: false, textos: [T('La pieza es esa, pero su avería es otra: mida sus entradas y su salida con varias combinaciones.')], estado: { ...e, tipoElegido: null } };
  const nombre = textoPlano(a.sospechosos.find((s) => s.id === e.sospechoso)?.rotulo) || e.sospechoso || '';
  let por: Texto | null = null;
  for (const f of a.fallos.filter((x) => x.pieza === e.sospechoso)) {
    for (const m of e.medidas) {
      const pt = puntoDe(a, m.punto);
      if (!pt) continue;
      const hip = lecturaCon(c, m.niveles, pt, f.fallo);
      if (hip !== m.lectura) {
        const rot = textoPlano(a.puntos.find((p) => p.id === m.punto)?.rotulo);
        const ent = Object.entries(m.niveles).map(([k, v]) => `${k} = ${v}`).join(', ');
        por = T(`Si fuera ${nombre} (${NOMBRE_FALLO_LOGICO[f.tipo]}), con ${ent} la sonda en «${rot}» marcaría ${nivelTexto(hip)}; usted midió ${nivelTexto(m.lectura)}.`);
        break;
      }
    }
    if (por) break;
  }
  por ??= T(`Sus medidas todavía no descartan ${nombre}, pero no es ella: pruebe otras combinaciones y mida a la entrada y a la salida de cada sospechosa.`);
  const p = pistaDe(t, { medidas: e.medidas.length });
  return {
    bien: false,
    textos: [por, ...(p ? [p] : [])],
    estado: { ...e, descartados: e.sospechoso && !e.descartados.includes(e.sospechoso) ? [...e.descartados, e.sospechoso] : e.descartados, sospechoso: null, tipoElegido: null },
  };
}

function comprobarDiseno(t: Tarjeta, a: DisenoLogico, e: EstadoDisenoLogico, exito: Texto[]): VeredictoDigital {
  const w = t.widget as WidgetLogica;
  const c = circuitoDiseno(w.circuito, a, e);
  const tv = tablaVerdad(c, [a.salida]);
  const n = e.puertas.length;
  const fila = tv.filas.findIndex((f, r) => f.s[0] !== a.objetivo[r]);
  if (fila >= 0) {
    const ent = tv.entradas.map((id, k) => `${id} = ${tv.filas[fila]!.e[k]}`).join(', ');
    const p = pistaDe(t, { puertas: n });
    return { bien: false, textos: [T(`Con ${ent} su circuito da ${tv.filas[fila]!.s[0]} y debe dar ${a.objetivo[fila]}.`), ...(p ? [p] : [])] };
  }
  if (n > a.minimo && a.exigirMinimo) {
    const p = pistaDe(t, { puertas: n });
    return { bien: false, textos: [T(`Funciona, con ${n} puertas: se puede con ${a.minimo}.`), ...(p ? [p] : [])] };
  }
  return { bien: true, textos: [T(n > a.minimo ? `Funciona, con ${n} puertas (se puede con ${a.minimo}).` : `Funciona, con ${n} ${n === 1 ? 'puerta' : 'puertas'}: el mínimo.`), ...exito] };
}

export function reintentarDigital(e: EstadoActividadDigital): EstadoActividadDigital {
  if (e.tipo === 'averia-logica') return { ...e, sospechoso: null, tipoElegido: null };
  return e;
}

// ------------------------------------------------------------------ helpers for the generator and the components

/** The right column of a truth table step, from the circuit. */
export function esperadoTabla(c: CircuitoLogico, salidas: string[]): Nivel[][] {
  return tablaVerdad(c, salidas).filas.map((f) => f.s);
}

/** The levels of a signal (or LED id) in every slot of the widget's timing diagram. */
export function ondaDe(w: WidgetLogica, senal: string, f?: FalloLogico | null): Nivel[] {
  if (!w.cronograma) return [];
  const c = w.circuito;
  const s = c.salidas.find((x) => x.id === senal)?.de ?? senal;
  return cronograma(c, w.cronograma.ciclos, w.cronograma.estimulo, f).tramos.map((x) => leer({ senales: x, internos: {}, relojes: {}, estable: true }, s));
}

/** «A = 1, B = 0» for row r of a truth table over `entradas`. */
export function textoFila(entradas: string[], r: number): string {
  return filaEntradas(entradas.length, r).map((v, k) => `${entradas[k]} = ${v}`).join(', ');
}

export function nombrePieza(c: CircuitoLogico, id: string): string {
  const p = c.piezas.find((x) => x.id === id);
  return p ? (p.rotulo ? textoPlano(p.rotulo) : `${NOMBRE_PIEZA[p.tipo]} ${p.id}`) : id;
}

