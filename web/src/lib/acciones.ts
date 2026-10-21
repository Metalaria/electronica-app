// Opening and closing the overlays, tied to the history so that «Atrás» closes them.

import { app, type FiguraAbierta } from './estado.svelte';
import { abrirCapa, cerrarCapa } from './ruta.svelte';

export function abrirLateral(): void {
  if (!app.movil || app.lateral) return;
  app.lateral = true;
  abrirCapa('lateral', () => (app.lateral = false));
}

export function cerrarLateral(): void {
  if (app.lateral) cerrarCapa('lateral');
}

export function abrirBuscador(): void {
  if (app.buscador) return;
  if (app.lateral) {
    // The drawer and the search never stack: close the drawer silently first.
    cerrarLateral();
    setTimeout(abrirBuscador, 60);
    return;
  }
  app.buscador = true;
  abrirCapa('buscador', () => (app.buscador = false));
}

export function cerrarBuscador(): void {
  if (app.buscador) cerrarCapa('buscador');
}

export function abrirFigura(f: FiguraAbierta): void {
  if (app.figura) return;
  app.figura = f;
  abrirCapa('figura', () => (app.figura = null));
}

export function cerrarFigura(): void {
  if (app.figura) cerrarCapa('figura');
}
