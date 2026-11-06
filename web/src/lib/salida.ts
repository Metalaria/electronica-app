// 1.0 (review 10c): a page with unsaved changes (the teacher-mode editor) may ask before the app navigates away or
// reloads. One guard at a time: the page on screen. The question is the app's own dialog (lib/confirmar.ts). Review 10f:
// the router asks it on EVERY route change — links, buttons that set location.hash («Libro» of the rail), the search's
// result (navegarDesdeCapa) and the browser's or Android's «Atrás» (ruta.svelte.ts puts the page's address back and
// asks) —, and so do the failure notice («Ver el informe», «Recargar la página»), the paused tab's «Usar aquí» and
// «Reiniciar para terminar» after an update. Only closing the window cannot be held.

type Guarda = () => Promise<boolean>;
let guarda: Guarda | null = null;
let pendiente: () => boolean = () => false;
let preguntando: Promise<boolean> | null = null;
/**
 * Review 10h (r10h·5): the reader said «yes» (performance.now of it): the route change that follows is not asked again
 * (the page is still mounted until the router reads the new route). Spent by the next route read, and good for 3 s.
 */
let permiso = -Infinity;

/**
 * Registers the guard of the page on screen; returns its remover. `hay`: whether it has something to lose now (the
 * router asks only then, synchronously, at the route change).
 */
export function registrarGuardaSalida(fn: Guarda, hay: () => boolean = () => true): () => void {
  guarda = fn;
  pendiente = hay;
  return () => {
    if (guarda === fn) {
      guarda = null;
      pendiente = () => false;
    }
  };
}

/** A question of the guard is open now (the router only puts the page's address back). */
export function preguntandoSalida(): boolean {
  return !!preguntando;
}

/** Whether the page on screen has unsaved changes (a route change must ask first). */
export function hayCambiosSinGuardar(): boolean {
  if (performance.now() - permiso < 3000) return false;
  return !!guarda && pendiente();
}

/** The router read a new route: a «yes» given before is spent. */
export function olvidarPermiso(): void {
  permiso = -Infinity;
}

/** Whether the app may leave the page now (asks the page's guard, if there is one; one question at a time). */
export function puedeSalir(): Promise<boolean> {
  if (!hayCambiosSinGuardar()) return Promise.resolve(true);
  // (review 10h: one question at a time — the guards' dialogs stay open across route changes, `seguirEnRuta` —; a second
  // request while it is open waits for its answer)
  if (preguntando) return preguntando;
  preguntando = guarda!()
    .then((ok) => {
      if (ok) permiso = performance.now();
      return ok;
    })
    .finally(() => (preguntando = null));
  return preguntando;
}
