// Lazy registry of the «Un fotograma» data: each console's steps load only when its tab opens.
import type { IdMaquina } from '../datos';
import type { FotogramaMaquina } from './tipos';

const CARGADORES: Record<IdMaquina, () => Promise<FotogramaMaquina>> = {
  nes: () => import('./maquinas/nes').then((m) => m.NES),
  neogeo: () => import('./maquinas/neogeo').then((m) => m.NEOGEO),
  sms: () => import('./maquinas/sms').then((m) => m.SMS),
  megadrive: () => import('./maquinas/megadrive').then((m) => m.MEGADRIVE),
  gb: () => import('./maquinas/gb').then((m) => m.GB),
  gbc: () => import('./maquinas/gbc').then((m) => m.GBC),
  snes: () => import('./maquinas/snes').then((m) => m.SNES),
};

export function cargarFotograma(id: IdMaquina): Promise<FotogramaMaquina> {
  return CARGADORES[id]();
}
