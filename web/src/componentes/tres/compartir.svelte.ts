// The 2D/3D choice of the «Componentes» pages (remembered per reader in the app's store) and the context
// through which an animated scene shares its parameters with the 3D model shown in its place.

import { getContext, setContext, untrack } from 'svelte';
import { obtenerAlmacen } from '../../lib/almacen';

const CLAVE_ALMACEN = 'componentes-vista';

export const vista3d = $state({ modo: '2d' as '2d' | '3d', cargada: false });

let carga: Promise<void> | null = null;

/** Reads the remembered choice once (the pages render 2D until it arrives, a few ms after start-up). */
export function cargarVista(): Promise<void> {
  carga ??= obtenerAlmacen()
    .then((a) => a.leer<string>(CLAVE_ALMACEN))
    .then((v) => {
      if (v === '3d' || v === '2d') vista3d.modo = v;
    })
    .catch(() => {})
    .finally(() => {
      vista3d.cargada = true;
    });
  return carga;
}

export function ponerVista(modo: '2d' | '3d'): void {
  vista3d.modo = modo;
  void obtenerAlmacen()
    .then((a) => a.escribir(CLAVE_ALMACEN, modo))
    .catch(() => {});
}

// ------------------------------------------------------------------ scene ↔ 3D model

const CLAVE = Symbol('componentes-3d');

export interface Contexto3D {
  /** The page shows the 3D model instead of the canvas scene. */
  activo: boolean;
  /** Animation id (key of ESCENAS_3D). */
  escena: string;
  /** What the scene shares (its sliders and modes), read by the 3D model. */
  parametros: Record<string, unknown>;
  /** The 3D view failed (no WebGL2): the page goes back to 2D and says why. */
  fallo: string;
}

/** Called by the animation page before the scene mounts. */
export function crearContexto3D(escena: string): Contexto3D {
  const c = $state<Contexto3D>({ activo: false, escena, parametros: {}, fallo: '' });
  setContext(CLAVE, c);
  return c;
}

export function contexto3D(): Contexto3D | undefined {
  return getContext<Contexto3D | undefined>(CLAVE);
}

/**
 * One line in a scene: `compartir3d(() => ({ valor, bandas }))`. Whatever the function reads is copied into
 * the page context whenever it changes, so the 3D model follows the scene's controls.
 */
export function compartir3d(f: () => Record<string, unknown>): void {
  const c = getContext<Contexto3D | undefined>(CLAVE);
  if (!c) return;
  $effect(() => {
    const v = f();
    untrack(() => {
      for (const [k, x] of Object.entries(v)) if (c.parametros[k] !== x) c.parametros[k] = x;
    });
  });
}
