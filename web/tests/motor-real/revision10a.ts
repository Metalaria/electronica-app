// Independent review 10a («data» block of 1.0): scenarios on the REAL engine and modules (arnes.ts). Run from web/:
//   node --experimental-transform-types --no-warnings --import ./tests/motor-real/registrar.mjs tests/motor-real/revision10a.ts
// The last line is the JSON result. Each case asserts the behaviour that keeps the reader's data (it FAILS while the
// finding is open).
//   r10a·1  exercises (union-ejercicios.ts): «Reiniciar» on A, then B — which had not synchronised since before the
//           reset — types an answer LATER in real time. The larger `r` wins whole, so B's later answer is lost (0.12:
//           the reset was a tombstone and B's newer item won by last write).
//   r10a·2  exercises across the 0.12 → 1.0 transition: a 0.12 device (no `vt`) types a field one hour after a 1.0
//           device typed the same field; on its upgrade the 1.0 merge takes a missing `vt` as 0, so the OLDER text wins
//           (0.12: the newer item won by last write). Its pending change is lost.
//   r10a·2b control: the same field typed on the 0.12 device BEFORE the 1.0 one — the 1.0 text wins (as it should).
import assert from 'node:assert/strict';
import { casos, correrCasos } from './escenarios.ts';
import { cambiarVersion, guardado, nuevoDisp, nuevoRepo, pasada, reloj, type Disp, type Repo } from './arnes.ts';
import { unirEjercicios } from '../../src/lib/union-ejercicios.ts';

const M = 60_000;
const H = 60 * M;
const T0 = new Date(2026, 10, 4, 12).getTime();
const caso = (nombre: string, f: () => Promise<void>) => casos.push([nombre, f]);
const tiempoT = (v: unknown) => (typeof (v as { t?: unknown })?.t === 'number' ? (v as { t: number }).t : undefined);
const ejercicios = () =>
  guardado('ejercicios', { tiempo: tiempoT, valido: (v) => typeof (v as { intentos?: unknown })?.intentos === 'number', unir: (a, b) => unirEjercicios(a as never, b as never) });
const base = { intentos: 0, fallos: 0, resuelto: false, pistas: 0, solucion: false };
const tab = (d: Disp) => d.pestanas[0]!;

async function asentar(devs: Disp[], repo: Repo, t: number): Promise<void> {
  for (let r = 0; r < 6; r++) {
    const antes = repo.commits;
    for (const d of devs) for (const p of d.pestanas) await pasada(d, repo, (t += M), { pestana: p });
    if (repo.commits === antes) return;
  }
  throw new Error('los commits no paran');
}
const valoresDe = (d: Disp, id: string) => (d.almacen('ejercicios').valores[id] as { valores?: Record<string, string> } | undefined)?.valores;

caso('r10a·1 · un reinicio en A no borra lo que B escribió DESPUÉS sin haberlo visto', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [ejercicios()]);
  const B = await nuevoDisp('B', [ejercicios()]);
  reloj.ahora = T0;
  await tab(A).editar('ejercicios', { e: { ...base, intentos: 1, valores: { texto: 'primer intento' }, vt: { texto: T0 }, t: T0 } });
  await asentar([A, B], repo, T0);
  // A resets the exercise (aprendizaje.svelte.ts reiniciarEjercicio) and synchronises
  reloj.ahora = T0 + 10 * M;
  await tab(A).editar('ejercicios', { e: { ...base, t: T0 + 10 * M, r: T0 + 10 * M } });
  await asentar([A], repo, T0 + 10 * M);
  // B, offline since before the reset, writes a long answer 20 minutes later
  reloj.ahora = T0 + 30 * M;
  const deB = tab(B).mem('ejercicios').e as Record<string, unknown>;
  await tab(B).editar('ejercicios', { e: { ...deB, intentos: 2, valores: { texto: 'respuesta escrita después del reinicio' }, vt: { texto: T0 + 30 * M }, t: T0 + 30 * M } });
  await asentar([B, A], repo, T0 + H);
  for (const d of [A, B]) assert.equal(valoresDe(d, 'e')?.texto, 'respuesta escrita después del reinicio', `${d.nombre}: la respuesta posterior al reinicio se ha perdido`);
});

async function transicion(ceroDoceDespues: boolean): Promise<{ X: Disp; Y: Disp }> {
  const repo = nuevoRepo();
  const X = await nuevoDisp('X', [ejercicios()], 0, '0.12');
  const Y = await nuevoDisp('Y', [ejercicios()], 0, '0.12');
  reloj.ahora = T0;
  await tab(X).editar('ejercicios', { e: { ...base, intentos: 1, valores: { texto: 'inicial' }, t: T0 } });
  await asentar([X, Y], repo, T0);
  // Y is updated (its storage migrated) and writes the file in format 2
  await cambiarVersion(Y, '0.11');
  await asentar([Y], repo, T0 + 10 * M);
  const tY = ceroDoceDespues ? T0 + H : T0 + 3 * H;
  const tX = ceroDoceDespues ? T0 + 2 * H : T0 + 2 * H - 30 * M;
  // Y (1.0) types the field (vt stamped); X (0.12, refused by the file) types the same field — no vt in 0.12
  reloj.ahora = tY;
  const deY = tab(Y).mem('ejercicios').e as Record<string, unknown>;
  await tab(Y).editar('ejercicios', { e: { ...deY, valores: { texto: 'de Y (1.0)' }, vt: { texto: tY }, t: tY } });
  await asentar([Y], repo, tY);
  reloj.ahora = tX;
  const deX = tab(X).mem('ejercicios').e as Record<string, unknown>;
  await tab(X).editar('ejercicios', { e: { ...deX, valores: { texto: 'de X (0.12)' }, t: tX } });
  assert.equal(await pasada(X, repo, tX + M), false, 'la 0.12 no escribe el fichero de la 1.0');
  // X is updated: its pending change is sent
  await cambiarVersion(X, '0.11');
  await asentar([X, Y], repo, T0 + 4 * H);
  return { X, Y };
}

caso('r10a·2 · la respuesta escrita en la 0.12 DESPUÉS que la de la 1.0 gana al actualizarse (sin vt = su t)', async () => {
  const { X, Y } = await transicion(true);
  for (const d of [X, Y]) assert.equal(valoresDe(d, 'e')?.texto, 'de X (0.12)', `${d.nombre}: el texto más nuevo (de la 0.12) se ha perdido`);
});

caso('r10a·2b · control: la respuesta de la 0.12 ANTERIOR a la de la 1.0 pierde', async () => {
  const { X, Y } = await transicion(false);
  for (const d of [X, Y]) assert.equal(valoresDe(d, 'e')?.texto, 'de Y (1.0)', d.nombre);
});

const r = await correrCasos(process.argv[2] ?? 'r10a·');
console.log(JSON.stringify(r));
if (r.some((x) => !x.ok)) process.exitCode = 1;
