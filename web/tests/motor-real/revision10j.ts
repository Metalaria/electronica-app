// Independent review 10j (exceptional 4th review of the exercises' merge, lib/union-ejercicios.ts): scenarios on the REAL
// engine and Guardado (arnes.ts). Run from web/:
//   node --experimental-transform-types --no-warnings --import ./tests/motor-real/registrar.mjs tests/motor-real/revision10j.ts
// The last line is the JSON result. Each case asserts what the reader expects (it FAILS while the finding is open).
//   r10j·1  ONE device: «Ocultar solución» of a problem (taparProblema: `tapada`, no new `t`) after the item was already
//           synchronised: the next run merges the file's older copy with it (fusion.ts fusionarColecciones always joins two
//           live versions) and the whole-item fields of equal `t` are decided by canonical text — the old copy wins, the
//           analysis is shown again (r10j·1b: the reverse, «Ver solución» comes back hidden).
//   r10j·2  A solves a two-part exercise offline; B, which had not received it, checks only the first part later (a
//           check of a partial answer counts as a failed attempt). After synchronising, the exercise is no longer solved
//           on either device — locally a failed check never undoes «resuelto» (registrarIntento), the merge does.
import assert from 'node:assert/strict';
import { casos, correrCasos } from './escenarios.ts';
import { guardado, nuevoDisp, nuevoRepo, pasada, reloj, type Disp, type Repo } from './arnes.ts';
import { unirEjercicios } from '../../src/lib/union-ejercicios.ts';
import { marcarResuelto, marcarTapada, ponerValores } from '../../src/lib/valores-ejercicio.ts';
import type { EstadoEjercicio } from '../../src/lib/aprendizaje.svelte.ts';

const M = 60_000;
const H = 60 * M;
const T0 = new Date(2026, 10, 6, 12).getTime();
const caso = (nombre: string, f: () => Promise<void>) => casos.push([nombre, f]);
const tiempoT = (v: unknown) => (typeof (v as { t?: unknown })?.t === 'number' ? (v as { t: number }).t : undefined);
const ejercicios = () =>
  guardado('ejercicios', { tiempo: tiempoT, valido: (v) => typeof (v as { intentos?: unknown })?.intentos === 'number', unir: (a, b) => unirEjercicios(a as never, b as never) });
const tab = (d: Disp) => d.pestanas[0]!;
const guardadoDe = (d: Disp, id: string) => d.almacen('ejercicios').valores[id] as EstadoEjercicio | undefined;

async function asentar(devs: Disp[], repo: Repo, t: number): Promise<void> {
  for (let r = 0; r < 6; r++) {
    const antes = repo.commits;
    for (const d of devs) for (const p of d.pestanas) await pasada(d, repo, (t += M), { pestana: p });
    if (repo.commits === antes) return;
  }
  throw new Error('los commits no paran');
}

/** A check exactly as lib/aprendizaje.svelte.ts registrarIntento writes it. */
function comprobado(previo: EstadoEjercicio | undefined, valores: Record<string, string>, bien: string[], completo: boolean, ahora: number): EstadoEjercicio {
  const e: EstadoEjercicio = structuredClone(previo) ?? { intentos: 0, fallos: 0, resuelto: false, pistas: 0, solucion: false, t: 0 };
  e.intentos++;
  if (!completo) e.fallos++;
  ponerValores(e, { ...valores, _c: String(ahora) }, ahora, true);
  // (since the fix of review 10j: only the solving check writes «resuelto», with its own time)
  if (completo) marcarResuelto(e, true, ahora);
  e.bien = bien;
  e.t = ahora;
  return e;
}

caso('r10j·1 · un solo dispositivo: «Ocultar solución» de un problema ya sincronizado sigue oculto tras sincronizar (y «Ver solución», visible)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [ejercicios()]);
  reloj.ahora = T0;
  // a first (failed) check of prob-3.A, synchronised
  await tab(A).editar('ejercicios', { 'prob-3.A': comprobado(undefined, { r1: '4 V' }, [], false, T0) });
  await asentar([A], repo, T0);
  // the reader hides the book's analysis to try again (taparProblema: tapada true, `t` unchanged; since the fix, with
  // its own time — marcarTapada, as taparProblema)
  reloj.ahora = T0 + 10 * M;
  const oculto = structuredClone(tab(A).mem('ejercicios')['prob-3.A'] as EstadoEjercicio);
  marcarTapada(oculto, true, reloj.ahora);
  await tab(A).editar('ejercicios', { 'prob-3.A': oculto });
  await asentar([A], repo, T0 + 10 * M);
  assert.equal(guardadoDe(A, 'prob-3.A')?.tapada, true, 'A: «Ocultar solución» deshecho por la sincronización (el análisis vuelve a verse)');
});

caso('r10j·1b · un solo dispositivo: «Ver solución» de un problema oculto y ya sincronizado sigue visible tras sincronizar', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [ejercicios()]);
  reloj.ahora = T0;
  // hidden from the start (taparProblema on a new item: estadoDeBorrador, t 0), then a failed check; synchronised
  const nuevo = comprobado(undefined, { r1: '4 V' }, [], false, T0);
  marcarTapada(nuevo, true, T0);
  await tab(A).editar('ejercicios', { 'prob-3.A': nuevo });
  await asentar([A], repo, T0);
  // «Ver solución»: verSolucion (solucion true) and taparProblema(false); `t` unchanged
  reloj.ahora = T0 + 10 * M;
  const visto = { ...structuredClone(tab(A).mem('ejercicios')['prob-3.A'] as EstadoEjercicio), solucion: true };
  marcarTapada(visto, false, reloj.ahora);
  await tab(A).editar('ejercicios', { 'prob-3.A': visto });
  await asentar([A], repo, T0 + 10 * M);
  assert.equal(guardadoDe(A, 'prob-3.A')?.solucion, true, 'A: se ha perdido «solución vista»');
  assert.equal(guardadoDe(A, 'prob-3.A')?.tapada, false, 'A: «Ver solución» deshecho por la sincronización (el análisis vuelve a ocultarse)');
});

caso('r10j·2 · A lo resuelve sin conexión; B, sin haberlo recibido, comprueba solo el primer apartado después: sigue resuelto en los dos', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [ejercicios()]);
  const B = await nuevoDisp('B', [ejercicios()]);
  reloj.ahora = T0;
  await asentar([A, B], repo, T0);
  // A (offline): both parts right, solved
  reloj.ahora = T0 + 10 * M;
  await tab(A).editar('ejercicios', { 'ej-4.2': comprobado(undefined, { r1: '2 mA', r2: '6 V' }, ['r1', 'r2'], true, T0 + 10 * M) });
  // B (offline too, had not received it): types the first part only and presses «Comprobar» to see whether it is right
  reloj.ahora = T0 + 30 * M;
  await tab(B).editar('ejercicios', { 'ej-4.2': comprobado(undefined, { r1: '2 mA' }, ['r1'], false, T0 + 30 * M) });
  await asentar([A, B], repo, T0 + H);
  for (const d of [A, B]) {
    const e = guardadoDe(d, 'ej-4.2');
    assert.equal(e?.valores?.r2, '6 V', `${d.nombre}: se ha perdido la respuesta del segundo apartado`);
    assert.equal(e?.resuelto, true, `${d.nombre}: el ejercicio resuelto en A ya no cuenta como resuelto (sale como fallado en «Repasar los fallados» y baja el recuento de resueltos)`);
  }
});

const r = await correrCasos(process.argv[2] ?? 'r10j·');
console.log(JSON.stringify(r));
if (r.some((x) => !x.ok)) process.exitCode = 1;
