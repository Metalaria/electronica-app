// Lazy registry of the architecture models: each machine's diagram and scenarios load only when its
// «Arquitectura» tab opens. (2.0: Partial — a machine without a model has no «Arquitectura» tab, see tieneArquitectura)
import type { IdMaquina } from '../datos';
import type { Maquina } from './diagrama';

const CARGADORES: Partial<Record<IdMaquina, () => Promise<Maquina>>> = {
  nes: () => import('./nes').then((m) => m.NES),
  neogeo: () => import('./neogeo').then((m) => m.NEOGEO),
  sms: () => import('./sms').then((m) => m.SMS),
  megadrive: () => import('./megadrive').then((m) => m.MEGADRIVE),
  gb: () => import('./gb').then((m) => m.GB),
  gbc: () => import('./gbc').then((m) => m.GBC),
  snes: () => import('./snes').then((m) => m.SNES),
  n64: () => import('./n64').then((m) => m.N64),
  ps1: () => import('./ps1').then((m) => m.PS1),
  gamecube: () => import('./gamecube').then((m) => m.GAMECUBE),
  saturn: () => import('./saturn').then((m) => m.SATURN),
};

export function tieneArquitectura(id: IdMaquina): boolean {
  return !!CARGADORES[id];
}

export function cargarArquitectura(id: IdMaquina): Promise<Maquina> {
  const c = CARGADORES[id];
  return c ? c() : Promise.reject(new Error(`La consola ${id} no tiene arquitectura`));
}
