// Lazy registry of the architecture models: each machine's diagram and scenarios load only when its
// «Arquitectura» tab opens.
import type { IdMaquina } from '../datos';
import type { Maquina } from './diagrama';

const CARGADORES: Record<IdMaquina, () => Promise<Maquina>> = {
  nes: () => import('./nes').then((m) => m.NES),
  neogeo: () => import('./neogeo').then((m) => m.NEOGEO),
  sms: () => import('./sms').then((m) => m.SMS),
  megadrive: () => import('./megadrive').then((m) => m.MEGADRIVE),
  gb: () => import('./gb').then((m) => m.GB),
  gbc: () => import('./gbc').then((m) => m.GBC),
};

export function cargarArquitectura(id: IdMaquina): Promise<Maquina> {
  return CARGADORES[id]();
}
