// Formula catalogue for the calculators: the small map «equation SVG → formulas» that the reader needs for its
// «Calcular» buttons (formulas-ec.json, fetched once in idle time when the first equation is shown), and the
// full catalogue (formulas.json), fetched only when a calculator or the «Calculadoras» page opens.

import type { CatalogoFormulas, Formula } from './tipos';
import { anotarBorrado, anotarCambio } from '../../lib/sincronizacion/marcas';
import { Guardado } from '../../lib/sincronizacion/guardado';

const BASE = 'libro/';

export const calc = $state({
  /** svg path of an equation → ids of its formulas. */
  porSvg: {} as Record<string, string[]>,
  mapaListo: false,
  favoritos: [] as string[],
  favoritosListos: false,
  /** The catalogue did not arrive (no network): the page offers «Reintentar» (it is not kept as missing). */
  falloRed: false,
});

class SinRed extends Error {}

/** A content file, or null when it is not there (content not generated); SinRed when the network fails. */
async function leer<T>(ruta: string): Promise<T | null> {
  let r: Response;
  try {
    r = await fetch(BASE + ruta);
  } catch (e) {
    throw new SinRed(String(e));
  }
  if (!r.ok || (r.headers.get('content-type') ?? '').includes('text/html')) return null;
  return (await r.json()) as T;
}

let promesaMapa: Promise<void> | null = null;

/** The equation map at once (the reader waits for it before showing its first part: see Lector.svelte). */
export function cargarMapa(): Promise<void> {
  promesaMapa ??= leer<Record<string, string[]>>('formulas-ec.json')
    .then((m) => {
      if (m && !calc.mapaListo) calc.porSvg = m;
      calc.mapaListo = true;
    })
    .catch(() => {
      // asked again by the next page that needs it
      promesaMapa = null;
    });
  return promesaMapa;
}

/** Asks for the equation map when the browser is idle (called by the first «Calcular» button). */
export function pedirMapa(): void {
  if (promesaMapa) return;
  promesaMapa = new Promise<void>((hecho) => {
    const ir = () => {
      void leer<Record<string, string[]>>('formulas-ec.json')
        .then((m) => {
          if (m && !calc.mapaListo) calc.porSvg = m;
          calc.mapaListo = true;
        })
        .catch(() => (promesaMapa = null))
        .finally(hecho);
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
    calc.falloRed = false;
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
  }, () => {
    // no network: not kept, so that «Reintentar» asks again
    promesaCatalogo = null;
    calc.falloRed = true;
    return null;
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

const comoMapa = (l: unknown): Record<string, 1> => (Array.isArray(l) ? Object.fromEntries(l.filter((x) => typeof x === 'string').map((x: string) => [x, 1 as const])) : {});
/** The list in its order (`orden`), without what is gone, with what is new at the end. */
function enOrden(m: Record<string, 1>, orden: unknown): string[] {
  const previa = Array.isArray(orden) ? orden.filter((x): x is string => typeof x === 'string' && x in m) : [];
  const nuevas = Object.keys(m)
    .filter((x) => !previa.includes(x))
    .sort();
  return [...new Set([...previa, ...nuevas])];
}
// Read-merge-write (lib/sincronizacion/guardado.ts): a list stored as is, synchronised as «id → 1».
export const guardadoFavoritos = new Guardado<1>({
  claveAlmacen: CLAVE,
  claveSinc: CLAVE,
  deAlmacen: comoMapa,
  aAlmacen: (m) => enOrden(m, calc.favoritos),
  leerMemoria: () => comoMapa(calc.favoritos),
  cambiarMemoria: (poner, quitar) => {
    const fuera = new Set(quitar);
    const lista = calc.favoritos.filter((id) => !fuera.has(id));
    for (const id of Object.keys(poner).sort()) if (!lista.includes(id)) lista.push(id);
    calc.favoritos = lista;
  },
});

export function cargarFavoritos(): Promise<void> {
  promesaFav ??= guardadoFavoritos
    // (adopted in the load's step, in the stored order; what was added before it stays)
    .cargar((m) => (calc.favoritos = [...new Set([...Object.keys(m), ...calc.favoritos])]))
    .then(() => {
      calc.favoritosListos = true;
    })
    .catch(() => {
      // (shown as they are; the next call loads again)
      calc.favoritosListos = true;
      promesaFav = null;
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
  void guardadoFavoritos.escribir().catch((e: unknown) => console.warn('No se pudieron guardar las favoritas', e));
}

/** Route of a calculator page. */
export function rutaCalculadora(id: string): string {
  return `#/calculadoras/${id}`;
}
