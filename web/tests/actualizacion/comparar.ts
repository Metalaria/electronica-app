// Loads a localStorage fixture, imports the stores of the given source tree, reads every synchronised store.
// Prints JSON: per store id → hash, keys written during load+read, and the stored texts afterwards.
import { datos, escrituras } from './navegador.ts';
import { readFileSync, writeFileSync } from 'node:fs';
setTimeout(() => { console.error('TIMEOUT'); process.exit(3); }, 60000).unref?.();
const [raiz, fixture, salida] = process.argv.slice(2);
let t = 1_770_000_000_000;
Date.now = () => (t += 1000);
const fx = JSON.parse(readFileSync(fixture, 'utf8')) as Record<string, string>;
for (const [k, v] of Object.entries(fx)) datos.set(k, v);
escrituras.length = 0;
const { huella } = await import('../../src/lib/sincronizacion/fusion.ts');
const R = await import(`file://${raiz}/lib/sincronizacion/registro.svelte.ts`);
await (await import(`file://${raiz}/lib/usuario.svelte.ts`)).cargarUsuario();
const leido: Record<string, Record<string, string>> = {};
const valores: Record<string, Record<string, unknown>> = {};
for (const s of R.sincronizables()) {
  const v = (await s.leer()) as Record<string, unknown>;
  valores[s.clave] = v;
  leido[s.clave] = Object.fromEntries(Object.entries(v).map(([id, x]) => [id, huella(x)]));
}
await new Promise((r) => setTimeout(r, 1500));
const despues: Record<string, string> = {};
for (const [k, v] of datos) despues[k] = v;
const cambiadas = [...new Set([...Object.keys(fx), ...Object.keys(despues)])].filter((k) => fx[k] !== despues[k]);
writeFileSync(salida, JSON.stringify({ leido, valores, escrituras: [...new Set(escrituras)], cambiadas, despues }, null, 1));
console.log('escrituras', [...new Set(escrituras)].join(' ') || '(ninguna)', '| claves cambiadas', cambiadas.join(' ') || '(ninguna)');
process.exit(0);
