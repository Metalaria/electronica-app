// 1.0 exercises (review 10g) on the REAL engine (arnes.ts): drafts typed on a device that did not have the exercise yet,
// merged by the synchronisation with another device's solved state (lib/union-ejercicios.ts through the real Guardado).
// Added to the cases by correr.ts; the names start with «e10·» and ejercicios10-r10g.spec.ts runs them.
import assert from 'node:assert/strict';
import { casos } from './escenarios.ts';
import { guardado, nuevoDisp, nuevoRepo, pasada, reloj, type Disp, type Repo } from './arnes.ts';
import { unirEjercicios } from '../../src/lib/union-ejercicios.ts';
import { estadoDeBorrador, limpiarValorEjercicio, ponerValores, valorComprobado } from '../../src/lib/valores-ejercicio.ts';
import type { EstadoEjercicio } from '../../src/lib/aprendizaje.svelte.ts';

const M = 60_000;
const T0 = new Date(2026, 10, 6, 12).getTime();
const caso = (nombre: string, f: () => Promise<void>) => casos.push([nombre, f]);
const tiempoT = (v: unknown) => (v as { t?: number })?.t;
const ejercicios = () => guardado('ejercicios', { tiempo: tiempoT, valido: (v) => typeof (v as { intentos?: unknown })?.intentos === 'number', unir: (a, b) => unirEjercicios(a as never, b as never) });

async function asentar(devs: Disp[], repo: Repo, t: number): Promise<void> {
  for (let r = 0; r < 6; r++) {
    const antes = repo.commits;
    for (const d of devs) for (const p of d.pestanas) await pasada(d, repo, (t += M), { pestana: p });
    if (repo.commits === antes) return;
  }
  throw new Error('los commits no paran');
}

/** A check as lib/aprendizaje.svelte.ts registrarIntento writes it (every checked value stamped with `_c`). */
function comprobado(previo: EstadoEjercicio | undefined, valores: Record<string, string>, bien: string[], completo: boolean, ahora: number): EstadoEjercicio {
  const e: EstadoEjercicio = structuredClone(previo) ?? { intentos: 0, fallos: 0, resuelto: false, pistas: 0, solucion: false, t: ahora };
  e.intentos++;
  if (!completo) e.fallos++;
  if (completo) e.resuelto = true;
  ponerValores(e, { ...valores, _c: String(ahora) }, ahora, true);
  e.bien = bien;
  e.t = ahora;
  return e;
}

/** A draft as guardarRespuestaEscrita writes it (an item it creates is estadoDeBorrador(); `t` never changes). */
function borrador(previo: EstadoEjercicio | undefined, clave: string, x: string, ahora: number): EstadoEjercicio {
  const e: EstadoEjercicio = structuredClone(previo) ?? estadoDeBorrador();
  ponerValores(e, { [clave]: limpiarValorEjercicio(clave, x) }, ahora);
  return e;
}

caso('e10·1 · un borrador en un dispositivo que no tenía el ejercicio no deshace «resuelto» del otro (y el borrador se conserva)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [ejercicios()]);
  const B = await nuevoDisp('B', [ejercicios()]);
  // A solves ej-1.9; B, offline, only types in the field a minute later
  reloj.ahora = T0;
  await A.pestanas[0]!.editar('ejercicios', { 'ej-1.9': comprobado(undefined, { r1: '0,3' }, ['r1'], true, T0) });
  reloj.ahora = T0 + M;
  await B.pestanas[0]!.editar('ejercicios', { 'ej-1.9': borrador(undefined, 'r1', '0,29', T0 + M) });
  await asentar([A, B], repo, T0 + 2 * M);
  for (const d of [A, B]) {
    const e = d.almacen('ejercicios').valores['ej-1.9'] as EstadoEjercicio;
    assert.equal(e.resuelto, true, `${d.nombre}: sigue resuelto`);
    assert.equal(e.intentos, 1, d.nombre);
    // the newer draft is kept, and comes back without a verdict (it was not the checked value)
    assert.equal(e.valores?.r1, '0,29', d.nombre);
    assert.equal(valorComprobado(e, 'r1'), false, d.nombre);
  }
});

caso('e10·2 · un borrador anterior a la comprobación del otro dispositivo no se toma por comprobado', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [ejercicios()]);
  const B = await nuevoDisp('B', [ejercicios()]);
  // both had checked r1 = 5 long ago
  reloj.ahora = T0;
  const base = comprobado(undefined, { r1: '5', r2: '1' }, [], false, T0);
  await A.pestanas[0]!.editar('ejercicios', { e: base });
  await asentar([A, B], repo, T0);
  // A types a draft in r2 (offline); B, later, checks again (r1 and r2 unchanged on B)
  reloj.ahora = T0 + 10 * M;
  await A.pestanas[0]!.editar('ejercicios', { e: borrador(A.pestanas[0]!.mem('ejercicios').e as EstadoEjercicio, 'r2', '7', T0 + 10 * M) });
  reloj.ahora = T0 + 20 * M;
  await B.pestanas[0]!.editar('ejercicios', { e: comprobado(B.pestanas[0]!.mem('ejercicios').e as EstadoEjercicio, { r1: '5', r2: '1' }, [], false, T0 + 20 * M) });
  await asentar([A, B], repo, T0 + 30 * M);
  for (const d of [A, B]) {
    const e = d.almacen('ejercicios').valores.e as EstadoEjercicio;
    // B's check re-stamped what it checked: its r2 = 1 (checked) wins over A's older draft, and shows its verdict
    assert.equal(e.valores?.r2, '1', d.nombre);
    assert.equal(valorComprobado(e, 'r2'), true, d.nombre);
    assert.equal(e.intentos, 2, d.nombre);
  }
});

caso('e10·3 · una pista o la solución abiertas en un dispositivo que no sabía que el ejercicio estaba resuelto no lo deshacen', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [ejercicios()]);
  const B = await nuevoDisp('B', [ejercicios()]);
  reloj.ahora = T0;
  await A.pestanas[0]!.editar('ejercicios', { e: comprobado(undefined, { r1: '0,3' }, ['r1'], true, T0) });
  // B, offline, opens both hints and then the solution (aprendizaje.svelte.ts usarPista / verSolucion: the item they
  // create is estadoDeBorrador(), and they do not move `t`)
  reloj.ahora = T0 + M;
  await B.pestanas[0]!.editar('ejercicios', { e: { ...estadoDeBorrador(), pistas: 2, solucion: true } });
  await asentar([A, B], repo, T0 + 2 * M);
  for (const d of [A, B]) {
    const e = d.almacen('ejercicios').valores.e as EstadoEjercicio;
    assert.equal(e.resuelto, true, `${d.nombre}: sigue resuelto`);
    assert.deepEqual([e.intentos, e.pistas, e.solucion], [1, 2, true], d.nombre);
  }
});
