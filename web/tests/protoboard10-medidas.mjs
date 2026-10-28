// Compares the measurements of the book's netlists with those of their breadboards (tests/protoboard10.mjs
// --escribir dir, then scripts/validar-spice.mjs on dir/original and dir/montaje):
//   node tests/protoboard10-medidas.mjs dir
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const a = JSON.parse(fs.readFileSync(path.join(dir, 'original.json'), 'utf8'));
const b = JSON.parse(fs.readFileSync(path.join(dir, 'montaje.json'), 'utf8'));
const ra = a.netlists ?? a;
const rb = b.netlists ?? b;
let iguales = 0;
const distintos = [];
for (const [id, x] of Object.entries(ra)) {
  const y = rb[id];
  if (!y) {
    distintos.push(`${id}: falta el montaje`);
    continue;
  }
  if (x.estado !== y.estado) {
    distintos.push(`${id}: ${x.estado} → ${y.estado} ${(y.errores ?? []).slice(0, 2).join(' | ')}`);
    continue;
  }
  // Measurements repeat their names (loops of .control): compared by name and order of appearance.
  const mb = new Map();
  for (const [n, v] of y.medidas ?? []) (mb.get(n) ?? mb.set(n, []).get(n)).push(v);
  const usadas = new Map();
  const malas = [];
  for (const [n, v] of x.medidas ?? []) {
    const k = usadas.get(n) ?? 0;
    usadas.set(n, k + 1);
    const w = mb.get(n)?.[k];
    if (w == null) malas.push(`${n} no está`);
    else if (Math.abs(v - w) > 1e-3 * Math.max(Math.abs(v), Math.abs(w)) + 1e-9) malas.push(`${n}: ${v} → ${w}`);
  }
  if (malas.length) distintos.push(`${id}: ${malas.slice(0, 3).join('; ')}`);
  else iguales++;
}
console.log(`Medidas iguales en ${iguales} de ${Object.keys(ra).length} netlists.`);
for (const d of distintos) console.log(' ', d);
