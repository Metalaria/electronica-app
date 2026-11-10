// 1.1 lessons: the registry of circuit schematics (tipos.ts). It starts empty and is filled by whoever runs the
// lessons: the app with definiciones.ts (import.meta.glob of every <nombre>/esquema.ts), Node with
// web/scripts/esquemas11.mjs (the same folders, read from disk). The generator and the drawing look schematics up here
// by name, so adding one is adding a folder. Pure.

import type { DefinicionEsquema } from './tipos';

const registro = new Map<string, DefinicionEsquema>();

/** Registers definitions (the module's default export of each folder); a repeated name or a malformed one throws. */
export function registrarEsquemas(defs: Iterable<[string, DefinicionEsquema]>): void {
  for (const [carpeta, d] of defs) {
    if (!d || typeof d !== 'object' || typeof d.netlist !== 'function') throw new Error(`esquemas11: ${carpeta}/esquema.ts no exporta por defecto una definición`);
    if (d.nombre !== carpeta) throw new Error(`esquemas11: la carpeta «${carpeta}» declara el nombre «${d.nombre}» (deben coincidir)`);
    const previo = registro.get(d.nombre);
    if (previo && previo !== d) throw new Error(`esquemas11: dos esquemas con el nombre «${d.nombre}»`);
    for (const [k, p] of Object.entries(d.piezas)) if (p.seVeCon && !d.piezas[p.seVeCon]?.interruptor) throw new Error(`esquemas11: ${d.nombre}.${k}.seVeCon debe ser una pieza interruptor`);
    registro.set(d.nombre, d);
  }
}

export function esquemaDe(nombre: string): DefinicionEsquema | undefined {
  return registro.get(nombre);
}

/** Registered names, sorted. */
export function nombresEsquemas(): string[] {
  return [...registro.keys()].sort();
}

/** Folder name of a module path («./divisor/esquema.ts» → «divisor»). */
export function carpetaDe(ruta: string): string {
  const partes = ruta.replace(/\\/g, '/').split('/');
  return partes[partes.length - 2] ?? '';
}
