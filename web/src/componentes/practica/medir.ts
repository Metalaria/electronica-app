// Runs the circuits of «Predice y comprueba» and the slider questions in the app's simulator worker
// (simulador/cliente.svelte.ts): one run at a time (the worker supersedes a running job), results cached per
// circuit and value, a run cancelled by another part of the page is repeated once.

import { url } from '../../lib/datos';
import type { DatosFigura, Esquema, ResultadoOp } from '../figuras-vivas/tipos';
import { leerEnFigura, leerEnNetlist, netlistFigura, netlistFiguraCon, netlistLibroOp, resultadoFigura, graficaOp, vectoresOp } from './circuito';
import type { FuenteCircuito, Observable } from './tipos';

export interface Medida {
  valor: number | null;
  /** Operating point of a figure's schematic (for the live drawing). */
  op?: ResultadoOp | null;
  error?: string;
}

let cola: Promise<unknown> = Promise.resolve();
const cache = new Map<string, Promise<Medida>>();
const textos = new Map<string, Promise<string>>();

function enCola<T>(fn: () => Promise<T>): Promise<T> {
  const r = cola.then(fn, fn);
  cola = r.catch(() => undefined);
  return r;
}

export async function datosFigura(ruta: string): Promise<DatosFigura> {
  const { cargarDatos } = await import('../figuras-vivas/carga.svelte');
  return cargarDatos(ruta);
}

export async function esquemaDe(f: Extract<FuenteCircuito, { k: 'figura' }>): Promise<{ datos: DatosFigura; esq: Esquema }> {
  const datos = await datosFigura(f.datos);
  const esq = datos.esquemas?.[f.esquema];
  if (!esq) throw new Error('La figura no tiene ese esquema.');
  return { datos, esq };
}

function textoNetlist(fichero: string): Promise<string> {
  let p = textos.get(fichero);
  if (!p) {
    p = fetch(url(fichero)).then((r) => {
      if (!r.ok) throw new Error(`No se pudo leer la netlist (${r.status}).`);
      return r.text();
    });
    p.catch(() => textos.delete(fichero));
    textos.set(fichero, p);
  }
  return p;
}

/** The observed quantity of a circuit of the book with one value changed (null: the book's values). */
export function medir(fuente: FuenteCircuito, cambio: { id: string; valor: number } | null, o: Observable): Promise<Medida> {
  const clave = `${fuente.k === 'figura' ? `${fuente.datos}#${fuente.esquema}` : fuente.id}|${cambio ? `${cambio.id}=${cambio.valor}` : '-'}|${o.k}:${o.id}`;
  let p = cache.get(clave);
  if (!p) {
    p = enCola(() => correr(fuente, cambio, o));
    p.then((m) => {
      if (m.error) cache.delete(clave);
    });
    cache.set(clave, p);
  }
  return p;
}

async function correr(fuente: FuenteCircuito, cambio: { id: string; valor: number } | null, o: Observable): Promise<Medida> {
  const { simularTexto, SimulacionCancelada } = await import('../../simulador/cliente.svelte');
  for (let vez = 0; vez < 2; vez++) {
    try {
      if (fuente.k === 'figura') {
        const { esq } = await esquemaDe(fuente);
        const { texto, meta } = netlistFigura(esq, cambio);
        const sim = await simularTexto(texto);
        const op = resultadoFigura(esq, meta, sim);
        if (!op) return { valor: null, error: 'ngspice no encuentra el punto de trabajo.' };
        return { valor: leerEnFigura(op, o), op };
      }
      const texto = await textoNetlist(fuente.fichero);
      const sim = await simularTexto(netlistLibroOp(texto, cambio));
      const g = graficaOp(sim);
      if (!g) return { valor: null, error: sim.salida.errores[0] ?? 'ngspice no encuentra el punto de trabajo.' };
      return { valor: leerEnNetlist(vectoresOp(g), o) };
    } catch (e) {
      if (e instanceof SimulacionCancelada && vez === 0) continue;
      return { valor: null, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return { valor: null, error: 'La simulación se canceló.' };
}

/**
 * 1.0 (challenges): a figure's observed quantity with several values changed (the knobs of a «reto»), and its
 * operating point for the live drawing. Same queue and cache as `medir`.
 */
export function medirCon(fuente: Extract<FuenteCircuito, { k: 'figura' }>, valores: Record<string, number>, o: Observable): Promise<Medida> {
  const ks = Object.keys(valores).sort();
  const clave = `${fuente.datos}#${fuente.esquema}|${ks.map((k) => `${k}=${valores[k]}`).join(',')}|${o.k}:${o.id}`;
  let p = cache.get(clave);
  if (!p) {
    p = enCola(async (): Promise<Medida> => {
      const { simularTexto, SimulacionCancelada } = await import('../../simulador/cliente.svelte');
      for (let vez = 0; vez < 2; vez++) {
        try {
          const { esq } = await esquemaDe(fuente);
          const { texto, meta } = netlistFiguraCon(esq, valores);
          const op = resultadoFigura(esq, meta, await simularTexto(texto));
          if (!op) return { valor: null, error: 'ngspice no encuentra el punto de trabajo.' };
          return { valor: leerEnFigura(op, o), op };
        } catch (e) {
          if (e instanceof SimulacionCancelada && vez === 0) continue;
          return { valor: null, error: e instanceof Error ? e.message : String(e) };
        }
      }
      return { valor: null, error: 'La simulación se canceló.' };
    });
    p.then((m) => {
      if (m.error) cache.delete(clave);
    });
    cache.set(clave, p);
  }
  return p;
}

/**
 * 1.0 «Encuentre la avería»: the operating point of a figure's circuit with one faulty part (averias.ts), in the
 * simulator's worker. One run per case (cached): every reading of the multimeter comes from it.
 */
export function medirAveria(fuente: Extract<FuenteCircuito, { k: 'figura' }>, averia: { elemento: string; tipo: string }): Promise<Medida> {
  const clave = `${fuente.datos}#${fuente.esquema}|averia:${averia.elemento}:${averia.tipo}`;
  let p = cache.get(clave);
  if (!p) {
    p = enCola(async (): Promise<Medida> => {
      const [{ simularTexto, SimulacionCancelada }, { netlistAveria }] = await Promise.all([import('../../simulador/cliente.svelte'), import('./averias')]);
      for (let vez = 0; vez < 2; vez++) {
        try {
          const { esq } = await esquemaDe(fuente);
          const { texto, meta } = netlistAveria(esq, averia as Parameters<typeof netlistAveria>[1]);
          const op = resultadoFigura(esq, meta, await simularTexto(texto));
          if (!op) return { valor: null, error: 'ngspice no encuentra el punto de trabajo.' };
          return { valor: 0, op };
        } catch (e) {
          if (e instanceof SimulacionCancelada && vez === 0) continue;
          return { valor: null, error: e instanceof Error ? e.message : String(e) };
        }
      }
      return { valor: null, error: 'La simulación se canceló.' };
    });
    p.then((m) => {
      if (m.error) cache.delete(clave);
    });
    cache.set(clave, p);
  }
  return p;
}

/** Route of a book netlist in the simulator. */
export function rutaSimulador(id: string): string {
  return `#/simulador/${id.split('/').map(encodeURIComponent).join('/')}`;
}

