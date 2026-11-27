// 2.2: the Material window size classes of the shell, by the window's width in CSS px (= dp in the Android WebView):
//   compact  < 600   → the bottom navigation bar and the phone header (the Pixel 8 Pro, 412)
//   medium   600–839 → the navigation rail; the book index opens as a drawer (the Pad 6 in portrait, 800)
//   expanded ≥ 840   → the rail and the book index panel beside the reader (the Pad 6 in landscape, the computer)
// The pages keep their own narrow layouts below 1024 px (app.movil).
import { app } from './estado.svelte';

export const COMPACTA_HASTA = 599;
export const MEDIA_HASTA = 839;

export function claseVentana(ancho: number): 'compacta' | 'media' | 'expandida' {
  return ancho <= COMPACTA_HASTA ? 'compacta' : ancho <= MEDIA_HASTA ? 'media' : 'expandida';
}

/** Keeps app.ventana / app.compacta / app.cajon up to date; returns the remover. */
export function vigilarVentana(): () => void {
  const mqC = window.matchMedia(`(max-width: ${COMPACTA_HASTA}px)`);
  const mqM = window.matchMedia(`(max-width: ${MEDIA_HASTA}px)`);
  const leer = () => {
    app.ventana = mqC.matches ? 'compacta' : mqM.matches ? 'media' : 'expandida';
    app.compacta = mqC.matches;
    app.cajon = mqM.matches;
  };
  leer();
  mqC.addEventListener('change', leer);
  mqM.addEventListener('change', leer);
  return () => {
    mqC.removeEventListener('change', leer);
    mqM.removeEventListener('change', leer);
  };
}
