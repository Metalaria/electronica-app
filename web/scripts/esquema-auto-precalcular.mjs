// Precomputes the automatic schematics of every book netlist at high effort and stores their layouts
// (per circuit structure) in src/componentes/esquema-auto/precalculado.json, which the app's worker loads,
// so the book's circuits open at once with the best layout. Netlists edited by the reader are laid out live.
//   node scripts/esquema-auto-precalcular.mjs [--esfuerzo 3]
// Run it again after changing the layout code (the app falls back to live layout when an entry no longer
// fits, so a stale file is harmless, only slower).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const esfuerzo = args.includes('--esfuerzo') ? Number(args[args.indexOf('--esfuerzo') + 1]) : 3;
const { generarEsquema, olvidarDibujos, dibujosRecordados } = await import(path.join(web, 'src/componentes/esquema-auto/generar.ts'));
const indice = JSON.parse(fs.readFileSync(path.join(web, 'public/libro/spice.json'), 'utf8'));
olvidarDibujos(true);
const t0 = performance.now();
let n = 0;
for (const nl of Object.values(indice.netlists)) {
  const texto = fs.readFileSync(path.join(web, 'public/libro', nl.fichero), 'utf8');
  generarEsquema(texto, { esfuerzo });
  n++;
}
const d = dibujosRecordados();
const destino = path.join(web, 'src/componentes/esquema-auto/precalculado.json');
fs.writeFileSync(destino, JSON.stringify(d));
console.log(`${n} netlists, ${Object.keys(d).length} estructuras, ${(fs.statSync(destino).size / 1024).toFixed(0)} kB, ${((performance.now() - t0) / 1000).toFixed(0)} s → ${path.relative(web, destino)}`);
