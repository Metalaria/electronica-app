// Independent review 12i: scenarios on the REAL engine and modules (arnes.ts). Run from web/:
//   node --experimental-transform-types --no-warnings --import ./tests/motor-real/registrar.mjs tests/motor-real/revision12i.ts
// The last line is the JSON result.
//   i12·1  `sinc-enviado` (0.12): a run whose PUT FAILED (network error: nothing written) keeps its entries, and the next
//          run takes them as the record of the items. The pruned-elsewhere rule (sincronizar.svelte.ts: an unchanged item
//          absent from the file, recorded at t <= the file's `podado`, is dropped) then applies to an item that was
//          NEVER in the file: an item created offline long ago is deleted locally (data loss).
//   i12·1b control: the same without the failed PUT keeps the item.
import assert from 'node:assert/strict';
import { casos, correrCasos } from './escenarios.ts';
import { almacenamiento, errores, fallarEscritura, guardado, nuevoDisp, nuevoRepo, pasada, reloj, ultimoError } from './arnes.ts';

const M = 60_000;
const DIA = 24 * 60 * M;
const T0 = new Date(2026, 0, 5, 12).getTime();
const caso = (nombre: string, f: () => Promise<void>) => casos.push([nombre, f]);

async function i12x1(putFallido: boolean): Promise<void> {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [guardado('sin')]);
  const B = await nuevoDisp('B', [guardado('sin')]);
  // B creates and deletes z (a tombstone at ~T0): what will be pruned later
  reloj.ahora = T0;
  await B.pestanas[0]!.editar('sin', { z: { v: 'z' } });
  await pasada(B, repo, T0 + M);
  await pasada(A, repo, T0 + 2 * M);
  reloj.ahora = T0 + 3 * M;
  await B.pestanas[0]!.editar('sin', {}, ['z']);
  await pasada(B, repo, T0 + 4 * M);
  await pasada(A, repo, T0 + 5 * M);
  // A, offline, creates x on day 1
  reloj.ahora = T0 + DIA;
  await A.pestanas[0]!.editar('sin', { x: { v: 'de A, sin conexión' } });
  // day 100: B's run prunes z's tombstone (podado = day 10)
  await pasada(B, repo, T0 + 100 * DIA);
  assert.ok((repo.doc?.podado ?? 0) > T0 + DIA, `the file's prune horizon is past x's time (podado ${repo.doc?.podado})`);
  // A comes back: its first run's PUT fails with a network error (GitHub wrote nothing)
  if (putFallido) {
    repo.antesDePut = async () => {
      throw new TypeError('Failed to fetch');
    };
    const ok = await pasada(A, repo, T0 + 100 * DIA + M, { interrumpir: true });
    assert.equal(ok, false, 'the first run wrote nothing');
    console.error('i12·1: sinc-enviado =', almacenamiento(A).get('sinc-enviado'));
  }
  errores.length = 0;
  await pasada(A, repo, T0 + 100 * DIA + 5 * M);
  await pasada(B, repo, T0 + 100 * DIA + 6 * M);
  assert.deepEqual(A.almacen('sin').valores.x, { v: 'de A, sin conexión' }, 'A keeps x');
  assert.deepEqual(repo.vivos('sin').x, { v: 'de A, sin conexión' }, 'the file has x');
  assert.deepEqual(B.almacen('sin').valores.x, { v: 'de A, sin conexión' }, 'B has x');
}
caso('i12·1 · PUT fallido (red) tras más de 90 días sin conexión: lo creado sin conexión no se borra en la pasada siguiente', () => i12x1(true));
caso('i12·1b · control: lo mismo sin el PUT fallido', () => i12x1(false));

// i12·2: storage refuses the sinc-enviado key (quota full). In 0.11 a full storage still synchronised (the record kept in
// memory, estadoSinGuardar); here the write before the PUT is not caught and every run fails before sending.
caso('i12·2 · almacenamiento lleno para sinc-enviado: la pasada sigue enviando lo local (como en 0.11)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [guardado('sin')]);
  const B = await nuevoDisp('B', [guardado('sin')]);
  reloj.ahora = T0;
  await pasada(A, repo, T0 + M);
  await pasada(B, repo, T0 + 2 * M);
  reloj.ahora = T0 + 3 * M;
  await A.pestanas[0]!.editar('sin', { x: { v: 'de A' } });
  fallarEscritura(A, 'sinc-enviado');
  const ok = await pasada(A, repo, T0 + 4 * M, { interrumpir: true });
  console.error('i12·2: error =', ultimoError);
  fallarEscritura(A, 'sinc-enviado', false);
  errores.length = 0;
  assert.ok(ok, 'the run wrote the file');
  assert.deepEqual(repo.vivos('sin').x, { v: 'de A' }, 'the file has x');
});

// i12·3: A-B-A after a run cut after its PUT: the reader changes x away and back to the very value sent; the entry of
// sinc-enviado matches the hash and the later change is dated as the old one, so another device's change made in
// between wins over it.
caso('i12·3 · tras una pasada cortada después del PUT, volver a poner el valor enviado (A-B-A) no pierde frente al cambio intermedio de otro dispositivo', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [guardado('sin')]);
  const B = await nuevoDisp('B', [guardado('sin')]);
  reloj.ahora = T0;
  await A.pestanas[0]!.editar('sin', { x: { v: 'v1' } });
  await pasada(A, repo, T0 + M);
  await pasada(B, repo, T0 + 2 * M);
  reloj.ahora = T0 + 3 * M;
  await A.pestanas[0]!.editar('sin', { x: { v: 'a' } });
  await pasada(A, repo, T0 + 4 * M, { interrumpir: true });
  assert.deepEqual(repo.vivos('sin').x, { v: 'a' }, 'the file has a');
  await pasada(B, repo, T0 + 5 * M);
  reloj.ahora = T0 + 6 * M;
  await B.pestanas[0]!.editar('sin', { x: { v: 'b' } });
  await pasada(B, repo, T0 + 7 * M);
  // A's reader, later: x to «c» and back to «a» (the last change of all)
  reloj.ahora = T0 + 10 * M;
  await A.pestanas[0]!.editar('sin', { x: { v: 'c' } });
  reloj.ahora = T0 + 11 * M;
  await A.pestanas[0]!.editar('sin', { x: { v: 'a' } });
  errores.length = 0;
  await pasada(A, repo, T0 + 12 * M);
  await pasada(B, repo, T0 + 13 * M);
  assert.deepEqual(repo.vivos('sin').x, { v: 'a' }, 'the file ends with A’s later change');
  assert.deepEqual(A.almacen('sin').valores.x, { v: 'a' }, 'A keeps it');
});

const r = await correrCasos(process.argv[2] ?? 'i12·');
console.log(JSON.stringify(r));
if (r.some((x) => !x.ok)) process.exitCode = 1;
