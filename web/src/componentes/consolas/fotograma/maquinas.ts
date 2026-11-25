// Lazy registry of the «Un fotograma» data: each console's steps load only when its tab opens. (2.0: Partial — a
// machine without steps has no «Un fotograma» tab, see tieneFotograma)
import type { IdMaquina } from '../datos';
import type { FotogramaMaquina } from './tipos';

const CARGADORES: Partial<Record<IdMaquina, () => Promise<FotogramaMaquina>>> = {
  nes: () => import('./maquinas/nes').then((m) => m.NES),
  neogeo: () => import('./maquinas/neogeo').then((m) => m.NEOGEO),
  sms: () => import('./maquinas/sms').then((m) => m.SMS),
  megadrive: () => import('./maquinas/megadrive').then((m) => m.MEGADRIVE),
  gb: () => import('./maquinas/gb').then((m) => m.GB),
  gbc: () => import('./maquinas/gbc').then((m) => m.GBC),
  snes: () => import('./maquinas/snes').then((m) => m.SNES),
  n64: () => import('./maquinas/n64').then((m) => m.N64),
  ps1: () => import('./maquinas/ps1').then((m) => m.PS1),
  gamecube: () => import('./maquinas/gamecube').then((m) => m.GAMECUBE),
  saturn: () => import('./maquinas/saturn').then((m) => m.SATURN),
};

export function tieneFotograma(id: IdMaquina): boolean {
  return !!CARGADORES[id];
}

export function cargarFotograma(id: IdMaquina): Promise<FotogramaMaquina> {
  const c = CARGADORES[id];
  return c ? c() : Promise.reject(new Error(`La consola ${id} no tiene «Un fotograma»`));
}
