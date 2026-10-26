// The consoles with «Un fotograma»: every adapter file maquinas/<maquina>.ts is found at build time (one file per
// console, so each agent or console adds its own without touching a shared list) and loaded only when the tab opens.

import type { IdMaquina } from '../datos';
import type { Adaptador } from './tipos';

const modulos = import.meta.glob<{ default?: Adaptador; adaptador?: Adaptador }>('./maquinas/*.ts');

const porMaquina = new Map<string, () => Promise<{ default?: Adaptador; adaptador?: Adaptador }>>();
for (const [ruta, carga] of Object.entries(modulos)) {
  const id = /\/([a-z0-9]+)\.ts$/.exec(ruta)?.[1];
  if (id) porMaquina.set(id, carga);
}

export function tieneFotograma(m: IdMaquina): boolean {
  return porMaquina.has(m);
}

export async function cargarAdaptador(m: IdMaquina): Promise<Adaptador> {
  const carga = porMaquina.get(m);
  if (!carga) throw new Error(`No hay animación de un fotograma para ${m}`);
  const mod = await carga();
  const a = mod.default ?? mod.adaptador;
  if (!a) throw new Error(`maquinas/${m}.ts no exporta el adaptador`);
  return a;
}
