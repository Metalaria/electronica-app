// Independent review 10b («data» block of 1.0, round 2): scenarios on the REAL engine and modules (arnes.ts). Run from
// web/:
//   node --experimental-transform-types --no-warnings --import ./tests/motor-real/registrar.mjs tests/motor-real/revision10b.ts
// The last line is the JSON result. Each case asserts the behaviour that keeps the reader's data (it FAILS while the
// finding is open).
//   r10b·1  exercises across the 0.12 → 1.0 transition, DIFFERENT fields: Y (1.0) rewrites field «texto»; later X (still
//           0.12, refused by the format-2 file) ticks «c1» of the same exercise — its item's `t` moves on, and so does
//           the time the migration gives to EVERY key of it, «texto» included (old text): at X's update its old
//           «texto» passes for newer and replaces Y's newer answer on both devices.
//   r10b·2  the same with a reset: Y resets the exercise; X (0.12) then ticks «c1»: the answer typed BEFORE the reset
//           comes back on both devices.
import assert from 'node:assert/strict';
import { casos, correrCasos } from './escenarios.ts';
import { cambiarVersion, guardado, nuevoDisp, nuevoRepo, pasada, reloj, type Disp, type Repo } from './arnes.ts';
import { unirEjercicios } from '../../src/lib/union-ejercicios.ts';

const M = 60_000;
const H = 60 * M;
const T0 = new Date(2026, 10, 6, 12).getTime();
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

async function transicion(reinicio: boolean): Promise<{ X: Disp; Y: Disp }> {
  const repo = nuevoRepo();
  const X = await nuevoDisp('X', [ejercicios()], 0, '0.12');
  const Y = await nuevoDisp('Y', [ejercicios()], 0, '0.12');
  reloj.ahora = T0;
  await tab(X).editar('ejercicios', { e: { ...base, intentos: 1, valores: { texto: 'antiguo' }, t: T0 } });
  await asentar([X, Y], repo, T0);
  await cambiarVersion(Y, '0.11');
  await asentar([Y], repo, T0 + 10 * M);
  const tY = T0 + H;
  reloj.ahora = tY;
  const deY = tab(Y).mem('ejercicios').e as Record<string, unknown>;
  if (reinicio) await tab(Y).editar('ejercicios', { e: { ...base, t: tY, r: tY } });
  else await tab(Y).editar('ejercicios', { e: { ...deY, valores: { texto: 'nuevo de Y' }, vt: { ...(deY.vt as object), texto: tY } } });
  await asentar([Y], repo, tY);
  // X (0.12) ticks another field of the same exercise one hour later (0.12 dates the item, no vt)
  const tX = T0 + 2 * H;
  reloj.ahora = tX;
  const deX = tab(X).mem('ejercicios').e as Record<string, unknown>;
  await tab(X).editar('ejercicios', { e: { ...deX, valores: { ...(deX.valores as object), c1: 'si' }, t: tX } });
  assert.equal(await pasada(X, repo, tX + M), false, 'la 0.12 no escribe el fichero de la 1.0');
  await cambiarVersion(X, '0.11');
  await asentar([X, Y], repo, T0 + 4 * H);
  return { X, Y };
}

// DOCUMENTED TRANSITION LIMIT (coordinator's decision after review 10b; ESQUEMA.md «Transition from 0.12», README «Paso a
// la 1.0»): 0.12 keeps no time per field, so when a device still on 0.12 changes an exercise after another device on
// 1.0 changed it, its update cannot tell which of its fields it changed: every field takes the item's time
// (lib/esquemas.ts migrarEjercicios) — its old «texto» passes for newer (r10b·1) and an answer from before a 1.0 reset
// comes back (r10b·2). No rule can tell them apart without losing the 0.12 device's real edits (r10a·2 needs its
// newer field to win). These cases assert the CURRENT behaviour, so that a change of it is noticed: the field the 0.12
// device did change is kept (c1), and the limit shows as described. Avoided by synchronising each device right
// before updating it and not editing exercises on a 0.12 device once another runs 1.0.
caso('r10b·1 · (límite documentado de la transición) la 0.12 marca OTRO campo después: su marca llega; su texto viejo pasa por nuevo', async () => {
  const { X, Y } = await transicion(false);
  for (const d of [X, Y]) {
    assert.equal(valoresDe(d, 'e')?.c1, 'si', `${d.nombre}: se ha perdido la marca de la 0.12`);
    assert.equal(valoresDe(d, 'e')?.texto, 'antiguo', `${d.nombre}: el límite documentado ya no se da («${valoresDe(d, 'e')?.texto}»): revise ESQUEMA.md y README`);
  }
});

caso('r10b·2 · (límite documentado de la transición) reinicio en la 1.0 y la 0.12 marca otro campo después: vuelve la respuesta de antes del reinicio', async () => {
  const { X, Y } = await transicion(true);
  for (const d of [X, Y]) {
    assert.equal(valoresDe(d, 'e')?.c1, 'si', `${d.nombre}: se ha perdido la marca de la 0.12`);
    assert.equal(valoresDe(d, 'e')?.texto, 'antiguo', `${d.nombre}: el límite documentado ya no se da: revise ESQUEMA.md y README`);
  }
});

const r = await correrCasos(process.argv[2] ?? 'r10b·');
console.log(JSON.stringify(r));
if (r.some((x) => !x.ok)) process.exitCode = 1;
