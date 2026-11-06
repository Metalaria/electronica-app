// 1.0 «Teoría que se mueve»: the places («<parte>:<índice de bloque>») of the equations that carry sliders, so the
// reader and the lessons mount the piece only there. Loaded the first time a part is rendered (teoria-viva.json is
// small); until then, and if it cannot be read, no equation carries one.
import { leerJSON } from './datos';
import type { DatosTeoriaViva } from './teoria-viva';

let carga: Promise<DatosTeoriaViva | null> | null = null;

/** The pieces (null if the file cannot be read: no equation carries sliders; tried again next time). */
export function cargarTeoriaViva(): Promise<DatosTeoriaViva | null> {
  carga ??= leerJSON<DatosTeoriaViva>('teoria-viva.json').catch(() => {
    carga = null;
    return null;
  });
  return carga;
}

export const lugaresTeoriaViva = $state({ lugares: new Set<string>(), cargado: false });

let pedido = false;
export function pedirLugaresTeoriaViva(): void {
  if (pedido) return;
  pedido = true;
  void cargarTeoriaViva().then((d) => {
    if (!d) {
      pedido = false;
      return;
    }
    const s = new Set<string>();
    for (const [parte, ps] of Object.entries(d.partes)) for (const p of ps) s.add(`${parte}:${p.bloque}`);
    lugaresTeoriaViva.lugares = s;
    lugaresTeoriaViva.cargado = true;
  });
}
