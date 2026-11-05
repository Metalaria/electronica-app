// Independent review 12f: scenarios on the REAL engine and Guardado (arnes.ts). Run from web/:
//   node --experimental-transform-types --no-warnings --import ./tests/motor-real/registrar.mjs tests/motor-real/revision12f.ts
// The last line is the JSON result. A tab whose cached view of localStorage lagged is emulated by setting the stored
// text directly (as b12·16/17 and e12·1–2 do).
//   f12·1  `propios` is pruned (PROPIOS_MAX 5000 → 4000, oldest first) in the very write that applies a synchronisation:
//          when one application brings more than ~4000 items of one key (the first synchronisation of a new device with
//          a big store), the entries just added are pruned at once, while another tab's stale copy is most likely. A
//          stale write of another tab (its cached view still without the applied items) then deletes the pruned items
//          in the tab that applied them, and that tab writes the deletion back. f12·1b: the same with 900 items
//          (control: nothing pruned, nothing lost).
//   f12·1c  the same with an import («unir») of a big backup on a device that never synchronised: nothing brings the
//          lost items back.
import assert from 'node:assert/strict';
import { casos, correrCasos } from './escenarios.ts';
import { almacenamiento, guardado, nuevaPestana, nuevoDisp, nuevoRepo, pasada, reloj, type Almacen, type Disp, type Pestana } from './arnes.ts';

const M = 60_000;
const T0 = new Date(2026, 10, 5, 12).getTime();
const caso = (nombre: string, f: () => Promise<void>) => casos.push([nombre, f]);
const almacenes = (): Almacen[] => [guardado('sin', { valido: (v) => typeof (v as { x?: unknown })?.x === 'string' })];
const tab = (d: Disp) => d.pestanas[0]!;
const G = (p: Pestana) => p.guardados.get('sin')! as unknown as { refrescar(): Promise<void>; volcar(): Promise<void>; propios: Map<string, unknown> };
const cuantos = (d: Disp) => Object.keys(d.almacen('sin').valores).length;

async function grande(n: number, conPasadaPrevia = true): Promise<void> {
  const repo = nuevoRepo();
  const B = await nuevoDisp('B', almacenes());
  reloj.ahora = T0;
  const items: Record<string, unknown> = {};
  for (let i = 0; i < n; i++) items[`d${String(i).padStart(5, '0')}`] = { x: `v${i}` };
  await tab(B).editar('sin', items);
  await pasada(B, repo, T0 + M);
  // a new device with two tabs, both open before its first synchronisation (empty)
  const A = await nuevoDisp('A', almacenes());
  const A2 = await nuevaPestana(A);
  void conPasadaPrevia;
  await pasada(A, repo, T0 + 2 * M, { pestana: tab(A) });
  assert.equal(cuantos(A), n, 'aplicado');
  const tamPropios = G(tab(A)).propios.size;
  // tab 2, whose cached view still lacks the applied items, writes the key (one change of its own) right after
  const ls = almacenamiento(A);
  reloj.ahora = T0 + 2 * M + 500;
  ls.set('g:sin', JSON.stringify({ y: { x: 'de A2' } }));
  await G(tab(A)).refrescar();
  await G(tab(A)).volcar();
  await G(A2).refrescar();
  await G(A2).volcar();
  await G(tab(A)).refrescar();
  const tras = cuantos(A);
  if (tras !== n + 1 && process.env.F12_SIGUIENTE) {
    await pasada(A, repo, T0 + 7 * M, { pestana: tab(A) });
    await G(A2).refrescar();
    console.error(`f12·1: tras la pasada siguiente, ${cuantos(A)} de ${n + 1}; en el repositorio ${Object.keys(repo.vivos('sin')).length}`);
  }
  assert.equal(tras, n + 1, `tras la copia desfasada de la pestaña 2 la clave tiene ${tras} elementos de ${n + 1} (propios de la pestaña 1 tras aplicar: ${tamPropios})`);
}

caso('f12·1 · primera sincronización con 5200 elementos de una clave y una copia desfasada de otra pestaña: no se pierde nada', () => grande(5200));
caso('f12·1b · lo mismo con 900 elementos (control: debe pasar)', () => grande(900));

caso('f12·1c · importar («unir») una copia con 5200 elementos y una copia desfasada de otra pestaña: no se pierde nada', async () => {
  const n = 5200;
  const A = await nuevoDisp('A', almacenes());
  const A2 = await nuevaPestana(A);
  reloj.ahora = T0;
  const almacenesCopia: Record<string, Record<string, { t: number; v: unknown }>> = { sin: {} };
  for (let i = 0; i < n; i++) almacenesCopia.sin![`d${String(i).padStart(5, '0')}`] = { t: T0 - 1000 + i, v: { x: `v${i}` } };
  const texto = JSON.stringify({ formato: 'epa-copia-seguridad', version: 1, app: '0.12.0', exportado: T0 - 500, dispositivo: 'Otro', almacenes: almacenesCopia });
  const copia = (await tab(A).copia()) as unknown as Record<string, (...a: unknown[]) => any>;
  reloj.ahora = T0 + M;
  const r = await copia.importar!(copia.leerFicheroCopia!(texto) as never, 'unir');
  void r;
  assert.equal(cuantos(A), n, `importado (${JSON.stringify(r).slice(0, 300)})`);
  const ls = almacenamiento(A);
  reloj.ahora = T0 + M + 500;
  ls.set('g:sin', JSON.stringify({ y: { x: 'de A2' } }));
  await G(tab(A)).refrescar();
  await G(tab(A)).volcar();
  await G(A2).refrescar();
  await G(A2).volcar();
  await G(tab(A)).refrescar();
  const tras = cuantos(A);
  if (tras !== n + 1 && process.env.F12_SIGUIENTE) {
    const repo = nuevoRepo();
    await pasada(A, repo, T0 + 7 * M, { pestana: tab(A) });
    await pasada(A, repo, T0 + 9 * M, { pestana: A2 });
    console.error(`f12·1c: tras sincronizar después, ${cuantos(A)} de ${n + 1}; en el repositorio ${Object.keys(repo.vivos('sin')).length}`);
  }
  assert.equal(tras, n + 1, `tras la copia desfasada la clave tiene ${tras} elementos de ${n + 1}`);
});

caso('f12·1d · (medida) tras f12·1, la pasada siguiente devuelve lo perdido', async () => {
  try {
    await grande(5200);
  } catch {
    // (expected while f12·1 fails)
  }
});

// f12·2: the per-item `sinc-aplicados` entry is dated `leidoEn`, taken right before the run's SECOND read of the store
// (the `tocado` check), while what it applies was merged from the FIRST read (`leerLocales`, at `inicio`). Another tab's
// real change made between the two reads and not yet visible to the running tab at the second (its cached view lagged
// by a few ms) is written over by the application, and that entry, dated after the change, is then taken by the other
// tab as evidence: the change is lost for good (its mark is for a value no store holds). Emulated after the run: the
// change of tab 2 is dated 5 ms before the entry and its write is overwritten by the application's text.
async function f12x2(margen: number): Promise<void> {
  const H = 60 * M;
  const sin = () => [guardado('sin', { valido: (v) => typeof (v as { x?: unknown })?.x === 'string' })];
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', sin());
  const A2 = await nuevaPestana(A);
  const B = await nuevoDisp('B', sin());
  reloj.ahora = T0;
  await tab(A).editar('sin', { x: { x: 'v1' } });
  await pasada(A, repo, T0 + M);
  await pasada(B, repo, T0 + 2 * M);
  await G(A2).refrescar();
  reloj.ahora = T0 + H;
  await tab(B).editar('sin', { x: { x: 'de B' } });
  await pasada(B, repo, T0 + H + M);
  const ahoraFijo = Date.now;
  // (real time goes on during the run: 10 ms per reading of the clock)
  Date.now = () => (reloj.ahora += 10);
  await pasada(A, repo, T0 + H + 2 * M, { pestana: tab(A) });
  Date.now = ahoraFijo;
  const ls = almacenamiento(A);
  const despues = ls.get('g:sin')!;
  const ap = (JSON.parse(ls.get('sinc-aplicados') ?? '{}') as Record<string, Record<string, [string, number]>>).sin?.x;
  const iniciada = (JSON.parse(ls.get('sinc-estado')!) as { iniciada: number }).iniciada;
  assert.ok(ap, 'aplicado');
  // tab 2 changed x `margen` ms after the run started (its first read of the stores), before the application; its write
  // was unseen by the running tab, whose application overwrote it
  reloj.ahora = iniciada + margen;
  await A2.editar('sin', { x: { x: 'de A2' } });
  ls.set('g:sin', despues);
  reloj.ahora = ap![1] + 1000;
  await G(A2).refrescar();
  await G(A2).volcar();
  await G(tab(A)).refrescar();
  await G(tab(A)).volcar();
  const valor = () => (A.almacen('sin').valores.x as { x?: string } | undefined)?.x;
  assert.equal(valor(), 'de A2', `el cambio de la pestaña 2 (hecho a ${iniciada + margen}, ${margen} ms tras el inicio de la pasada; entrada de sinc-aplicados ${JSON.stringify(ap)}) se pierde`);
  for (let r = 0, t = ap![1] + 2 * M; r < 4; r++, t += 4 * M) {
    await pasada(A, repo, t, { pestana: tab(A) });
    await pasada(B, repo, t + M);
  }
  assert.equal((B.almacen('sin').valores.x as { x?: string }).x, 'de A2', 'B');
}
caso('f12·2 · un cambio de otra pestaña entre las dos lecturas de la pasada, no visto en la segunda y pisado por la aplicación, no se pierde', () => f12x2(5).catch((e) => { console.error('PILA', e.stack); throw e; }));

const r = await correrCasos('f12·');
console.log(JSON.stringify(r));
if (r.some((x) => !x.ok)) process.exitCode = 1;
