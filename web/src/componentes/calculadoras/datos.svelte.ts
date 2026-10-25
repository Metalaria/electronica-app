// Formula catalogue for the calculators: the small map «equation SVG → formulas» that the reader needs for its
// «Calcular» buttons (formulas-ec.json, fetched once in idle time when the first equation is shown), and the
// full catalogue (formulas.json), fetched only when a calculator or the «Calculadoras» page opens.

import type { CatalogoFormulas, Formula } from './tipos';
import { obtenerAlmacen } from '../../lib/almacen';
import { anotarBorrado, anotarCambio } from '../../lib/sincronizacion/marcas';

const BASE = 'libro/';

export const calc = $state({
  /** svg path of an equation → ids of its formulas. */
  porSvg: {} as Record<string, string[]>,
  mapaListo: false,
  favoritos: [] as string[],
  favoritosListos: false,
});

async function leer<T>(ruta: string): Promise<T | null> {
  try {
    const r = await fetch(BASE + ruta);
    if (!r.ok || (r.headers.get('content-type') ?? '').includes('text/html')) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

let promesaMapa: Promise<void> | null = null;

/** Asks for the equation map when the browser is idle (called by the first «Calcular» button). */
export function pedirMapa(): void {
  if (promesaMapa) return;
  promesaMapa = new Promise<void>((hecho) => {
    const ir = () => {
      void leer<Record<string, string[]>>('formulas-ec.json').then((m) => {
        if (m && !calc.mapaListo) calc.porSvg = m;
        calc.mapaListo = true;
        hecho();
      });
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(ir, { timeout: 2500 });
    else setTimeout(ir, 600);
  });
}

let promesaCatalogo: Promise<CatalogoFormulas | null> | null = null;
let porId: Map<string, Formula> | null = null;

/** The whole catalogue (cached). */
export function cargarCatalogo(): Promise<CatalogoFormulas | null> {
  promesaCatalogo ??= leer<CatalogoFormulas>('formulas.json').then((c) => {
    if (c) {
      porId = new Map(c.formulas.map((f) => [f.id, f]));
      if (!calc.mapaListo) {
        // The catalogue holds everything the map has: no need to fetch it as well.
        const m: Record<string, string[]> = {};
        for (const f of c.formulas) (m[f.svg] ??= []).push(f.id);
        calc.porSvg = { ...m, ...calc.porSvg };
      }
    }
    return c;
  });
  return promesaCatalogo;
}

export async function formulasPorId(ids: string[]): Promise<Formula[]> {
  await cargarCatalogo();
  return ids.map((i) => porId?.get(i)).filter((f): f is Formula => !!f);
}

// ------------------------------------------------------------------ favourites (stored like the bookmarks)

const CLAVE = 'calc-favoritos';
let promesaFav: Promise<void> | null = null;

export function cargarFavoritos(): Promise<void> {
  promesaFav ??= obtenerAlmacen()
    .then((a) => a.leer<string[]>(CLAVE))
    .then((v) => {
      if (Array.isArray(v)) calc.favoritos = v.filter((x) => typeof x === 'string');
      calc.favoritosListos = true;
    })
    .catch(() => {
      calc.favoritosListos = true;
    });
  return promesaFav;
}

export function esFavorita(id: string): boolean {
  return calc.favoritos.includes(id);
}

export function alternarFavorita(id: string): void {
  const quitar = esFavorita(id);
  calc.favoritos = quitar ? calc.favoritos.filter((x) => x !== id) : [...calc.favoritos, id];
  if (quitar) anotarBorrado('calc-favoritos', id);
  else anotarCambio('calc-favoritos', id);
  void obtenerAlmacen().then((a) => a.escribir(CLAVE, $state.snapshot(calc.favoritos)));
}

/** Route of a calculator page. */
export function rutaCalculadora(id: string): string {
  return `#/calculadoras/${id}`;
}
