// Independent review 12e: scenarios on the REAL engine and Guardado (arnes.ts). Run from web/:
//   node --experimental-transform-types --no-warnings --import ./tests/motor-real/registrar.mjs tests/motor-real/revision12e.ts
// The last line is the JSON result. Each scenario emulates what a tab whose cached view of localStorage lagged does
// (its write lands after another tab's without having seen it) by setting the stored text directly, as b12·16/17 do.
//   e12·1  a per-item `sinc-aplicados` entry is dated when it is written, not when the run read the store: another
//          tab's real change of an applied item made after that read, written over by the run's application (its
//          cached view lagged), loses to it — the applied value passes for evidence against it.
//   e12·2  `sinc-estado` as evidence compares the FILE's time of the item (another device's clock) with this tab's
//          change (this device's clock): with a device whose clock is ahead, a stale copy of the synchronised value
//          beats a later real change of another tab (e12·2b: the same without the skew, a control that passes).
//   e12·3  repaso-diario: «Reiniciar tarjetas» (every day deleted) and an answer the same day — the file's union (field
//          max, `unirDiasRepaso`) with the day as synchronised before the reset brings the old counts back (new cards of
//          the day included). e12·3b: the proposed fix (the reset marks each day as wholly undone) — passes.
// e12·1–3 fail on the 0.12 tree reviewed; e12·1 and e12·2 pass with the two changes to guardado.ts proposed in the
// review 12e report.
import assert from 'node:assert/strict';
import { casos, correrCasos } from './escenarios.ts';
import { efectivo, unirDiasRepaso } from '../../src/componentes/repaso/diario.ts';
import { almacenamiento, guardado, nuevaPestana, nuevoDisp, nuevoRepo, pasada, reloj, type Almacen, type Disp, type Pestana, type Repo } from './arnes.ts';

const M = 60_000;
const H = 60 * M;
const T0 = new Date(2026, 10, 4, 12).getTime();
const caso = (nombre: string, f: () => Promise<void>) => casos.push([nombre, f]);
// a store WITHOUT a time of its own (bookmarks-like): only the marks and the evidence decide
const almacenes = (): Almacen[] => [guardado('sin', { valido: (v) => typeof (v as { x?: unknown })?.x === 'string' })];
const tab = (d: Disp) => d.pestanas[0]!;
const G = (p: Pestana) => p.guardados.get('sin')! as unknown as { refrescar(): Promise<void>; volcar(): Promise<void> };
const valor = (d: Disp, id: string) => (d.almacen('sin').valores[id] as { x?: string } | undefined)?.x;
async function poner(p: Pestana, t: number, id: string, x: string): Promise<void> {
  reloj.ahora = t;
  await p.editar('sin', { [id]: { x } });
}
async function asentar(devs: Disp[], repo: Repo, t: number): Promise<void> {
  for (let r = 0; r < 8; r++) {
    const antes = repo.commits;
    for (const d of devs) for (const p of d.pestanas) await pasada(d, repo, (t += M), { pestana: p });
    if (repo.commits === antes) return;
  }
  assert.fail('los commits no paran');
}

caso('e12·1 · un cambio de otra pestaña hecho tras la lectura de la pasada, pisado por la aplicación (vista retrasada), no se pierde', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const A2 = await nuevaPestana(A);
  const B = await nuevoDisp('B', almacenes());
  await poner(tab(A), T0, 'x', 'v1');
  await asentar([A, B], repo, T0 + M);
  await G(A2).refrescar();
  await poner(tab(B), T0 + H, 'x', 'de B');
  await pasada(B, repo, T0 + H + M);
  const ls = almacenamiento(A);
  let aplicado = '';
  let tPestana = 0;
  // (real time goes on during the run: every reading of the clock is 1 ms later)
  const ahoraFijo = Date.now;
  Date.now = () => ++reloj.ahora;
  await pasada(A, repo, T0 + H + 2 * M, {
    pestana: tab(A),
    durante: () => {
      // tab 2 changes x after the run read the store (the run then applies the file's «de B» to it)
      reloj.ahora += 1000;
      tPestana = reloj.ahora;
      void A2.editar('sin', { x: { x: 'de A2' } }).then(() => (reloj.ahora += 1000));
    },
  });
  await new Promise((r) => setTimeout(r, 0));
  await G(A2).volcar();
  Date.now = ahoraFijo;
  const ap = (JSON.parse(ls.get('sinc-aplicados') ?? '{}') as Record<string, Record<string, [string, number]>>).sin?.x;
  aplicado = JSON.stringify(ap);
  // what the run's application wrote, landing after tab 2's write without having seen it (its cached view lagged)
  const v = JSON.parse(ls.get('g:sin')!) as Record<string, unknown>;
  v.x = { x: 'de B' };
  ls.set('g:sin', JSON.stringify(v));
  reloj.ahora += 1000;
  await G(A2).refrescar();
  await G(A2).volcar();
  await G(tab(A)).refrescar();
  await G(tab(A)).volcar();
  const propio = JSON.stringify((A2.guardados.get('sin') as unknown as { propios: Map<string, unknown> }).propios.get('x'));
  assert.equal(valor(A, 'x'), 'de A2', `el cambio de la pestaña 2 (propios ${propio}, tras la lectura de la pasada a ${tPestana}) se pierde; sinc-aplicados.sin.x = ${aplicado}`);
  await asentar([A, B], repo, T0 + 2 * H);
  assert.equal(valor(B, 'x'), 'de A2', 'B');
});

caso('e12·2 · con el reloj de otro dispositivo adelantado, una copia desfasada no gana a un cambio real posterior de otra pestaña', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const A2 = await nuevaPestana(A);
  // B's clock is 2 hours ahead
  const B = await nuevoDisp('B', almacenes(), 2 * H);
  await poner(tab(A), T0, 'x', 'v1');
  await asentar([A, B], repo, T0 + M);
  await G(A2).refrescar();
  await poner(tab(B), T0 + H + 2 * H, 'x', 'de B');
  await pasada(B, repo, T0 + H + M);
  await pasada(A, repo, T0 + H + 2 * M, { pestana: tab(A) });
  assert.equal(valor(A, 'x'), 'de B', 'aplicado');
  const ls = almacenamiento(A);
  const despuesDeLaPasada = ls.get('g:sin')!;
  // later (real time), tab 2 — up to date — changes x for real
  await G(A2).refrescar();
  await poner(A2, T0 + H + 5 * M, 'x', 'de A2');
  assert.equal(valor(A, 'x'), 'de A2', 'guardado');
  // a stale tab (its cached view lagged) writes the key as it was after the run
  ls.set('g:sin', despuesDeLaPasada);
  reloj.ahora = T0 + H + 6 * M;
  await G(A2).refrescar();
  await G(A2).volcar();
  await G(tab(A)).refrescar();
  await G(tab(A)).volcar();
  const reg = JSON.stringify((JSON.parse(ls.get('sinc-estado')!) as { items: Record<string, Record<string, unknown>> }).items.sin?.x);
  assert.equal(valor(A, 'x'), 'de A2', `el cambio real de la pestaña 2 se pierde (registro sinc-estado ${reg}, cambio a ${T0 + H + 5 * M})`);
  await asentar([A, B], repo, T0 + 2 * H);
  assert.equal(valor(B, 'x'), 'de A2', 'B');
});

caso('e12·2b · lo mismo sin desfase de reloj (control: debe pasar)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const A2 = await nuevaPestana(A);
  const B = await nuevoDisp('B', almacenes());
  await poner(tab(A), T0, 'x', 'v1');
  await asentar([A, B], repo, T0 + M);
  await G(A2).refrescar();
  await poner(tab(B), T0 + H, 'x', 'de B');
  await pasada(B, repo, T0 + H + M);
  await pasada(A, repo, T0 + H + 2 * M, { pestana: tab(A) });
  const ls = almacenamiento(A);
  const despuesDeLaPasada = ls.get('g:sin')!;
  await G(A2).refrescar();
  await poner(A2, T0 + H + 5 * M, 'x', 'de A2');
  ls.set('g:sin', despuesDeLaPasada);
  reloj.ahora = T0 + H + 6 * M;
  await G(A2).refrescar();
  await G(A2).volcar();
  await G(tab(A)).refrescar();
  await G(tab(A)).volcar();
  assert.equal(valor(A, 'x'), 'de A2', 'el cambio real de la pestaña 2');
  await asentar([A, B], repo, T0 + 2 * H);
  assert.equal(valor(B, 'x'), 'de A2', 'B');
});

caso('e12·3 · «Reiniciar tarjetas» y volver a repasar el mismo día: las cuentas del día no vuelven a las de antes del reinicio', async () => {
  const repo = nuevoRepo();
  const diarioRepaso = () => guardado('repaso-diario', { unir: (a, b) => unirDiasRepaso(a as never, b as never), valido: (v) => typeof (v as { r?: unknown })?.r === 'number' });
  const X = await nuevoDisp('X', [diarioRepaso()]);
  const D = '2026-11-04';
  // 10 new cards answered today, synchronised
  reloj.ahora = T0;
  await tab(X).editar('repaso-diario', { [D]: { r: 10, n: 10, b: 8 } });
  await pasada(X, repo, T0 + M);
  // «Reiniciar tarjetas» and then one card answered again, today. (Round 5 of fixes: what estado.svelte.ts
  // `reiniciarTarjetas` now stores for today — the day kept, wholly undone, dr = r, dn = n, db = b — and the answer on
  // top; the review's version deleted the day, as the module did then: { r: 1, n: 1, b: 1 } after it. The real module
  // is checked in tests/actualizacion/escenario.ts, steps 43–55.)
  reloj.ahora = T0 + 2 * M;
  await tab(X).editar('repaso-diario', { [D]: { r: 10, n: 10, b: 8, dr: 10, dn: 10, db: 8 } });
  reloj.ahora = T0 + 3 * M;
  await tab(X).editar('repaso-diario', { [D]: { r: 11, n: 11, b: 9, dr: 10, dn: 10, db: 8 } });
  await pasada(X, repo, T0 + 4 * M);
  const v = X.almacen('repaso-diario').valores[D] as { r: number; n: number; b: number };
  const e = efectivo(v);
  assert.deepEqual([e.r, e.n, e.b], [1, 1, 1], `tras reiniciar y responder una, el día queda en ${JSON.stringify(v)} (nuevas de hoy: ${e.n})`);
});

caso('e12·3b · control del arreglo propuesto: el reinicio marca el día como deshecho entero (dr=r, dn=n, db=b) en vez de borrarlo', async () => {
  const repo = nuevoRepo();
  const diarioRepaso = () => guardado('repaso-diario', { unir: (a, b) => unirDiasRepaso(a as never, b as never), valido: (v) => typeof (v as { r?: unknown })?.r === 'number' });
  const X = await nuevoDisp('X', [diarioRepaso()]);
  const Y = await nuevoDisp('Y', [diarioRepaso()]);
  const D = '2026-11-04';
  reloj.ahora = T0;
  await tab(X).editar('repaso-diario', { [D]: { r: 10, n: 10, b: 8 } });
  await pasada(X, repo, T0 + M);
  await pasada(Y, repo, T0 + M + 1000);
  reloj.ahora = T0 + 2 * M;
  await tab(X).editar('repaso-diario', { [D]: { r: 10, n: 10, b: 8, dr: 10, dn: 10, db: 8 } });
  reloj.ahora = T0 + 3 * M;
  await tab(X).editar('repaso-diario', { [D]: { r: 11, n: 11, b: 9, dr: 10, dn: 10, db: 8 } });
  for (let i = 0; i < 3; i++) {
    await pasada(X, repo, T0 + (4 + 2 * i) * M);
    await pasada(Y, repo, T0 + (5 + 2 * i) * M);
  }
  for (const d of [X, Y]) {
    const e = efectivo(d.almacen('repaso-diario').valores[D] as never);
    assert.deepEqual([e.r, e.n, e.b], [1, 1, 1], `${d.nombre}: ${JSON.stringify(d.almacen('repaso-diario').valores[D])}`);
  }
});

const r = await correrCasos('e12·');
console.log(JSON.stringify(r));
if (r.some((x) => !x.ok)) process.exitCode = 1;
