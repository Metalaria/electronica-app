// 2.2: «what is open on top» — the one stack that the system's back closes first (Android's hardware or gesture back
// in the Tauri app, the browser's back elsewhere, Alt+← too). It is the router's overlay stack (lib/ruta.svelte.ts
// abrirCapa): each open thing pushes a history entry, so «Atrás» lands on it and the router calls its `cerrar`
// instead of changing the page. Tauri's Android shell (AppPlugin.kt, no back-button listener registered) turns the
// back press into the WebView's goBack, i.e. that same history step, and closes the app when there is no history.
//
//   const quitar = abrirEncima('recorrido', () => (abierto = false));   // when it opens
//   quitar();                                                            // when it closes from its own UI (Salir, Esc)
//
// Rules:
//   - `cerrar` is called at most once, when the overlay is closed from outside it: by «Atrás», or when a link is
//     followed from inside it. `quitar()` (the UI closed it itself) does not call it.
//   - `quitar()` goes back over the entry (asynchronously). Never set location.hash right after it: to go somewhere
//     from inside the overlay, call `irDesdeEncima(href)` (or just let an <a href="#/…"> be followed: the router
//     replaces the overlay's entry with the destination, lib/ruta.svelte.ts), or `await despuesDeCerrar()` first.
//   - Opening one while another's step back is on its way (one replacing another) is queued until it arrives.
//   - Ids are unique per kind: opening an id that is already open does nothing (and returns a no-op).
//   - `encima.n` / `encima.arriba` are reactive (how many, the id on top): e.g. not to offer a tour over a menu.
import { untrack } from 'svelte';
import { abrirCapa, capaAbierta, capas, cerrarCapa, esperarAtras, hayCapas, navegarDesdeCapa } from './ruta.svelte';

/** Reactive: n = how many things are open on top, arriba = the id of the top one ('' when none). */
export const encima = capas;

/** Registers something open on top; returns the function to call once its own UI has closed it. */
export function abrirEncima(id: string, cerrar: () => void): () => void {
  // (untracked: called from an $effect, its reads and writes of the stack must not become the effect's dependencies)
  return untrack(() => abrir(id, cerrar));
}

function abrir(id: string, cerrar: () => void): () => void {
  if (capaAbierta(id)) return () => {};
  let hecho = false;
  const una = () => {
    if (hecho) return;
    hecho = true;
    cerrar();
  };
  abrirCapa(id, una);
  return () =>
    untrack(() => {
      if (hecho) return;
      // the UI has closed it already (its own state says so): only its history entry goes — `cerrar` is not called,
      // so a component that swaps one open thing for another (one lead's editor for the next) keeps the new one
      hecho = true;
      cerrarCapa(id);
    });
}

/** Whether `id` is open (anywhere in the stack). */
export const hayAbierto = capaAbierta;

/** Closes everything open on top and goes to `href` (the overlays' entry becomes the destination). */
export function irDesdeEncima(href: string): void {
  navegarDesdeCapa(href);
}

export { hayCapas as hayEncima };

/**
 * Resolves once the history has settled after `quitar()` (its step back arrived): code that changes the route right
 * after closing something waits for it — `quitar(); await despuesDeCerrar(); location.hash = …`.
 */
export const despuesDeCerrar = esperarAtras;
