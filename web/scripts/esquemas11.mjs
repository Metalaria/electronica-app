// 1.1 lessons in Node: registers every circuit schematic (web/src/lib/leccion11/esquemas/<nombre>/esquema.ts) the way
// the app's import.meta.glob does (lib/leccion11/esquemas/definiciones.ts), so the generator (lecciones11.mjs) and the
// unit tests know the same schematics. A schematic is a folder: nothing to list here.
// The «.ts» imports need Node ≥ 22.6 and the resolver that libro-node.mjs registers (or Playwright's loader).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'leccion11', 'esquemas');

/** The schematic folders (those with an esquema.ts), sorted. */
export function carpetasEsquemas11() {
  return fs
    .readdirSync(dir)
    .filter((f) => fs.existsSync(path.join(dir, f, 'esquema.ts')))
    .sort();
}

let hecho = null;
/** Imports and registers every schematic (once); returns the registry module. */
export function cargarEsquemas11() {
  hecho ??= (async () => {
    const registro = await import(pathToFileURL(path.join(dir, 'registro.ts')).href);
    const defs = [];
    for (const c of carpetasEsquemas11()) defs.push([c, (await import(pathToFileURL(path.join(dir, c, 'esquema.ts')).href)).default]);
    registro.registrarEsquemas(defs);
    return registro;
  })();
  return hecho;
}
