// 1.3.0: the release builds on macOS and Windows failed because Montar.svelte imported '../protoboard/guia.svelte'
// (meaning guia.svelte.ts): on Linux that resolves to the module, but on the case-insensitive file systems of the
// macOS and Windows runners it matches Guia.svelte, the component, which exports no `Guia`. This test fails
// on any relative import whose last segment equals, ignoring case only, another file of its folder, or that
// matches no file with its exact case. Runs without a browser:
//   EPA_SIN_SERVIDOR=1 npx playwright test tests/importes-mayusculas-unidad.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSIONES = ['', '.ts', '.js', '.mjs', '.mts', '.json', '.svelte', '/index.ts', '/index.js'];

function ficheros(dir: string, salida: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, salida);
    else if (/\.(ts|js|mjs|svelte)$/.test(e.name)) salida.push(p);
  }
  return salida;
}

/** Relative specifiers of a source file (static imports, re-exports and dynamic imports). */
function especificadores(texto: string): string[] {
  const res: string[] = [];
  const re = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
  for (let m = re.exec(texto); m; m = re.exec(texto)) res.push(m[1]!.replace(/\?.*$/, ''));
  return res;
}

function problema(desde: string, esp: string): string | null {
  const objetivo = path.resolve(path.dirname(desde), esp);
  const dir = path.dirname(objetivo);
  const base = path.basename(objetivo);
  if (!fs.existsSync(dir)) return null;
  const entradas = fs.readdirSync(dir);
  const otra = entradas.find((e) => e !== base && e.toLowerCase() === base.toLowerCase());
  if (otra) return `«${esp}» coincide, sin distinguir mayúsculas, con ${otra}`;
  const exacta = EXTENSIONES.some((x) => {
    const p = objetivo + x;
    const d = path.dirname(p);
    return fs.existsSync(d) && fs.readdirSync(d).includes(path.basename(p));
  });
  return exacta ? null : `«${esp}» no coincide con ningún fichero con sus mayúsculas exactas`;
}

test('las importaciones relativas se resuelven igual sin distinguir mayúsculas (macOS, Windows)', () => {
  const fallos: string[] = [];
  for (const f of [...ficheros(path.join(raiz, 'src')), ...ficheros(path.join(raiz, 'scripts'))]) {
    for (const esp of especificadores(fs.readFileSync(f, 'utf8'))) {
      const p = problema(f, esp);
      if (p) fallos.push(`${path.relative(raiz, f)}: ${p}`);
    }
  }
  expect(fallos).toEqual([]);
});
