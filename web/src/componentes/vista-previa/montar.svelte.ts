// The preview card's lazy chunk: one card mounted on <body> the first time, driven by `vista`.
// The controller (lib/vistaPrevia.ts) calls abrir/cerrar; the card calls cerrar itself (× button).

import { mount } from 'svelte';
import type { PeticionVista } from '../../lib/vistaPrevia';
import Tarjeta from './Tarjeta.svelte';

export const vista = $state({ peticion: null as PeticionVista | null, n: 0 });

let alCerrar: (() => void) | null = null;
let montada = false;

export function abrir(p: PeticionVista, cb: () => void): void {
  if (!montada) {
    mount(Tarjeta, { target: document.body });
    montada = true;
  }
  const previo = alCerrar;
  alCerrar = cb;
  if (previo && vista.peticion?.a !== p.a) previo();
  vista.peticion = p;
  vista.n++;
}

export function cerrar(): void {
  if (!vista.peticion) return;
  vista.peticion = null;
  const cb = alCerrar;
  alCerrar = null;
  cb?.();
}
