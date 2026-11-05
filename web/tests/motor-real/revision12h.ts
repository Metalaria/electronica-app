// Independent review 12h: scenarios on the REAL engine and modules (arnes.ts). Run from web/:
//   node --experimental-transform-types --no-warnings --import ./tests/motor-real/registrar.mjs tests/motor-real/revision12h.ts
// The last line is the JSON result.
//   h12·1  `sinc-aplicados` entry [hash, t, hash read] (0.12g): `atestiguado` accepts it by `ap[2] === hp` whatever the
//          time of this tab's change. The entry lives 30 minutes. A later change of that tab back to the very value (or
//          deletion) the merge had read (an A-B-A: a favourite removed again, a setting set back) matches it too, so a
//          stale tab's copy of the applied value written over it is taken as evidence-backed: the later change is lost
//          (a deletion resurrected).
import assert from 'node:assert/strict';
import { casos, correrCasos } from './escenarios.ts';
import { almacenamiento, guardado, nuevaPestana, nuevoDisp, nuevoRepo, pasada, reloj, type Pestana } from './arnes.ts';

const M = 60_000;
const T0 = new Date(2026, 10, 5, 12).getTime();
const caso = (nombre: string, f: () => Promise<void>) => casos.push([nombre, f]);
const G = (p: Pestana) => p.guardados.get('sin')! as unknown as { refrescar(): Promise<void>; volcar(): Promise<void> };

async function h12x1(borrar: boolean, sinTercero = false): Promise<void> {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [guardado('sin')]);
  const A2 = await nuevaPestana(A);
  const B = await nuevoDisp('B', [guardado('sin')]);
  const A1 = A.pestanas[0]!;
  reloj.ahora = T0;
  await A1.editar('sin', { x: { x: 'v1' } });
  await pasada(A, repo, T0 + M, { pestana: A1 });
  await pasada(B, repo, T0 + 2 * M);
  reloj.ahora = T0 + 3 * M;
  await G(A2).refrescar();
  // tab 2 makes its change (a deletion, or the value «a»); B then changes x (newer) and synchronises
  reloj.ahora = T0 + 10 * M;
  if (borrar) await A2.editar('sin', {}, ['x']);
  else await A2.editar('sin', { x: { x: 'a' } });
  reloj.ahora = T0 + 11 * M;
  await B.pestanas[0]!.editar('sin', { x: { x: 'de B' } });
  await pasada(B, repo, T0 + 11 * M + 1000);
  // A's run (tab 1) reads tab 2's change and applies B's newer version over it: entry [h(de B), t, h(tab 2's)]
  await pasada(A, repo, T0 + 12 * M, { pestana: A1 });
  const ls = almacenamiento(A);
  const ap = JSON.parse(ls.get('sinc-aplicados') ?? '{}') as Record<string, Record<string, unknown[]>>;
  console.error('h12·1: sinc-aplicados.sin.x =', JSON.stringify(ap.sin?.x));
  reloj.ahora = T0 + 12 * M + 5000;
  await G(A2).refrescar();
  assert.equal((A2.mem('sin').x as { x?: string } | undefined)?.x, 'de B', 'tab 2 takes the applied version');
  const trasPasada = ls.get('g:sin')!;
  // a minute later, tab 2 changes x again, back to what it had (removes it again / sets «a» again): a real change
  reloj.ahora = T0 + 13 * M;
  if (borrar) await A2.editar('sin', {}, ['x']);
  else await A2.editar('sin', { x: { x: 'a' } });
  // (control: the same entry without its third element, the hash read, as before 0.12g)
  if (sinTercero) {
    const v = JSON.parse(ls.get('sinc-aplicados')!) as Record<string, Record<string, unknown[]>>;
    v.sin!.x = v.sin!.x!.slice(0, 2);
    ls.set('sinc-aplicados', JSON.stringify(v));
  }
  // a stale tab (its cached view of localStorage lagged) writes the key as it was after the run
  ls.set('g:sin', trasPasada);
  reloj.ahora = T0 + 13 * M + 5000;
  await G(A2).refrescar();
  await G(A2).volcar();
  const esperado = borrar ? undefined : 'a';
  assert.equal((A2.mem('sin').x as { x?: string } | undefined)?.x, esperado, 'tab 2 keeps its later change against the stale copy');
  await G(A1).refrescar();
  for (let r = 0, t = T0 + 20 * M; r < 3; r++, t += 4 * M) {
    await pasada(A, repo, t, { pestana: A1 });
    await pasada(B, repo, t + M);
  }
  assert.equal((repo.vivos('sin').x as { x?: string } | undefined)?.x, esperado, 'the file ends with tab 2’s later change');
}
caso('h12·1 · una pestaña vuelve a borrar lo que la fusión vio borrado: la copia desfasada de lo aplicado no lo resucita (A-B-A)', () => h12x1(true));
caso('h12·1b · una pestaña vuelve a poner el valor que la fusión vio: la copia desfasada de lo aplicado no lo pisa (A-B-A)', () => h12x1(false));

caso('h12·1c · control: lo mismo sin el tercer elemento de la anotación (como antes de 0.12g): se conserva', () => h12x1(true, true));
caso('h12·1d · control: lo mismo (valor) sin el tercer elemento', () => h12x1(false, true));

const r = await correrCasos(process.argv[2] ?? 'h12·');
console.log(JSON.stringify(r));
if (r.some((x) => !x.ok)) process.exitCode = 1;
