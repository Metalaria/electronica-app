// Lazy loading of the figure data and shared viewport observers: one IntersectionObserver for «near the
// viewport» (start loading the JSON) and one for «on screen» (run animations), whatever the number of figures.

import { SvelteMap } from 'svelte/reactivity';
import { leerJSON } from '../../lib/datos';
import type { DatosFigura } from './tipos';

// A few recent figures are kept parsed; the browser's HTTP cache keeps the rest cheap to fetch again.
const MAX_CACHE = 24;
const cache = new Map<string, Promise<DatosFigura>>();
/**
 * The ones already arrived (a figure that mounts after them takes them at once, before its first paint). Reactive:
 * a figure already on the page takes them as soon as the reader has them (moving to it within the part).
 */
const llegados = new SvelteMap<string, DatosFigura>();

export function cargarDatos(ruta: string): Promise<DatosFigura> {
  let p = cache.get(ruta);
  if (p) {
    cache.delete(ruta);
    cache.set(ruta, p);
    return p;
  }
  p = leerJSON<DatosFigura>(ruta);
  p.then((d) => cache.get(ruta) === p && llegados.set(ruta, d)).catch(() => cache.delete(ruta));
  cache.set(ruta, p);
  while (cache.size > MAX_CACHE) {
    const k = cache.keys().next().value!;
    cache.delete(k);
    llegados.delete(k);
  }
  return p;
}

/**
 * A figure's data if they have already arrived (0.11 final QA: a figure opened by its link loaded them after its
 * first paint and its panels pushed the caption and the text 350 px down; the reader now asks for them first).
 */
export function datosYa(ruta: string): DatosFigura | undefined {
  return llegados.get(ruta);
}

type Aviso = (dentro: boolean) => void;

function observador(margen: string): { observar: (el: Element, fn: Aviso) => () => void } {
  let io: IntersectionObserver | null = null;
  const avisos = new Map<Element, Aviso>();
  return {
    observar(el, fn) {
      if (typeof IntersectionObserver === 'undefined') {
        fn(true);
        return () => {};
      }
      io ??= new IntersectionObserver(
        (entradas) => {
          for (const e of entradas) avisos.get(e.target)?.(e.isIntersecting);
        },
        { rootMargin: margen },
      );
      avisos.set(el, fn);
      io.observe(el);
      return () => {
        avisos.delete(el);
        io?.unobserve(el);
      };
    },
  };
}

/** Within about a screen of the viewport: time to fetch the data. */
export const cerca = observador('600px 0px 600px 0px');
/** Actually on screen: animations run only then. */
export const enPantalla = observador('0px');

/** Shared page visibility (animations stop while the window is hidden). */
export const pagina = $state({ visible: typeof document === 'undefined' || document.visibilityState !== 'hidden' });
if (typeof document !== 'undefined')
  document.addEventListener('visibilitychange', () => (pagina.visible = document.visibilityState !== 'hidden'));

/** prefers-reduced-motion, live. */
export const movimiento = $state({ reducido: false });
if (typeof matchMedia !== 'undefined') {
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  movimiento.reducido = mq.matches;
  mq.addEventListener?.('change', (e) => (movimiento.reducido = e.matches));
}

/** Coarse pointer (touch screens): larger hit areas. */
export const tactil = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
