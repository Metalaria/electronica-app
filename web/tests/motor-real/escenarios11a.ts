// Review 11a on the REAL engine (arnes.ts): the store `lecciones` (lib/lecciones.svelte.ts) with its merge
// (lib/union-lecciones.ts), and the lab's «Hágalo por mí» mark. Added to the cases by correr.ts; the names start with
// «r11a·» (revision11a-unidad.spec.ts runs them; enlaces11-unidad.spec.ts runs the «e11» ones).
//
// r11a·1  Two devices, one lesson: A completes it (every card done, `c`), B — offline — opens it an hour later and
//         looks at its first card (anotarPaso: a newer version with h [] and c 0). The store had no `unir`: the newer
//         version won in the file and between tabs, and the completion and the cards were lost on both devices.
//         Fails before the fix: EPA_SUSTITUIR='src/lib/lecciones.svelte.ts=<copy without unir>' and the registration
//         without `unir` (here: the harness registers the module's own pure merge, so the Guardado's is the one shown).
// r11a·2  The lab: «Hágalo por mí» on A marks the step (no XP) and B, after synchronising, sees the mark.
import assert from 'node:assert/strict';
import { casos } from './escenarios.ts';
import { modulo, nuevaPestana, nuevoDisp, nuevoRepo, pasada, reloj, type Disp, type Pestana, type Repo } from './arnes.ts';
import type { ProgresoUnible } from '../../src/lib/union-lecciones.ts';
import type { RegistroLab } from '../../src/lib/laboratorio.ts';

const M = 60_000;
const T0 = new Date(2026, 10, 10, 10).getTime();
const caso = (nombre: string, f: () => Promise<void>) => casos.push([nombre, f]);

async function asentar(devs: Disp[], repo: Repo, t: number): Promise<void> {
  for (let r = 0; r < 6; r++) {
    const antes = repo.commits;
    for (const d of devs) for (const p of d.pestanas) await pasada(d, repo, (t += M), { pestana: p });
    if (repo.commits === antes) return;
  }
  throw new Error('los commits no paran');
}

type ModLec = {
  anotarPaso(parte: string, seccion: string, paso: number, n: number): void;
  completarPaso(parte: string, seccion: string, paso: number, n: number): boolean;
  completarLeccion(parte: string, seccion: string, n: number): boolean;
  guardadoLecciones: { refrescar(): Promise<void>; volcar(): Promise<void> };
  progresoLecciones: { secciones: Record<string, ProgresoUnible> };
};
const lec = (p: Pestana) => p.modulos.get('lecciones') as unknown as ModLec;
const guardado = (d: Disp) => d.almacen('lecciones').valores as unknown as Record<string, ProgresoUnible>;
const ID = 'cap01/sec-1.4';

caso('r11a·1 · lecciones: abrir en B una lección que A completó no borra la compleción ni las tarjetas hechas (unión), en el fichero y entre pestañas', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [modulo('lecciones')]);
  const B = await nuevoDisp('B', [modulo('lecciones')]);
  // A: the 10 cards and the summary
  reloj.ahora = T0;
  for (let k = 0; k < 10; k++) lec(A.pestanas[0]!).completarPaso('cap01', 'sec-1.4', k, 10);
  lec(A.pestanas[0]!).completarLeccion('cap01', 'sec-1.4', 10);
  await lec(A.pestanas[0]!).guardadoLecciones.volcar();
  assert.equal(guardado(A)[ID]?.h.length, 10, 'A stored');
  await asentar([A], repo, T0 + M);
  // B, offline, opened the lesson an hour later and looked at its first card; and did card 3 of another lesson
  reloj.ahora = T0 + 60 * M;
  lec(B.pestanas[0]!).anotarPaso('cap01', 'sec-1.4', 0, 10);
  lec(B.pestanas[0]!).completarPaso('cap01', 'sec-1.5', 3, 8);
  await lec(B.pestanas[0]!).guardadoLecciones.volcar();
  await asentar([A, B], repo, T0 + 61 * M);
  for (const d of [A, B]) {
    const v = guardado(d)[ID]!;
    assert.ok(v.c > 0, `${d.nombre}: the completion stays`);
    assert.equal(v.h.length, 10, `${d.nombre}: the cards done stay`);
    assert.equal(v.u, 0, `${d.nombre}: the last screen is the newer one`);
    assert.deepEqual(guardado(d)['cap01/sec-1.5']?.h, [3], `${d.nombre}: B's other lesson`);
    assert.equal(lec(d.pestanas[0]!).progresoLecciones.secciones[ID]?.h.length, 10, `${d.nombre}: in memory too`);
  }
  // between two tabs of B: a second tab with a stale copy (opened before the merge) writes its own first card
  const B2 = await nuevaPestana(B);
  reloj.ahora = T0 + 90 * M;
  lec(B2).anotarPaso('cap01', 'sec-1.4', 2, 10);
  await lec(B2).guardadoLecciones.volcar();
  assert.equal(guardado(B)[ID]?.h.length, 10, 'B: the other tab keeps the cards');
  assert.ok((guardado(B)[ID]?.c ?? 0) > 0, 'B: and the completion');
  const antes = repo.commits;
  await asentar([A, B], repo, T0 + 100 * M);
  await asentar([A, B], repo, T0 + 200 * M);
  assert.ok(repo.commits - antes <= 2, 'it settles');
  for (const d of [A, B]) assert.deepEqual(guardado(d)[ID], guardado(A)[ID], `${d.nombre}: the same value on both devices`);
});

type ModLab = {
  anotarAyudaLaboratorio(n: number, paso: string, ahora?: number): Promise<void>;
  anotarPasoLaboratorio(n: number, paso: string, lectura: number | null, pasos: readonly string[], ahora?: number): Promise<void>;
};
const lab = (p: Pestana) => p.modulos.get('laboratorio') as unknown as ModLab;

caso('r11a·2 · laboratorio: «Hágalo por mí» en A queda en el registro y B lo recibe (el paso ya no da XP en ningún dispositivo)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [modulo('laboratorio')]);
  const B = await nuevoDisp('B', [modulo('laboratorio')]);
  reloj.ahora = T0;
  await lab(A.pestanas[0]!).anotarAyudaLaboratorio(1, 'b', T0);
  reloj.ahora = T0 + M;
  await lab(B.pestanas[0]!).anotarPasoLaboratorio(1, 'a', 1.5, ['a', 'b', 'c'], T0 + M);
  await asentar([A, B], repo, T0 + 2 * M);
  for (const d of [A, B]) {
    const r = (d.almacen('laboratorio').valores as Record<string, RegistroLab>).p1!;
    assert.deepEqual(r.a, ['b'], `${d.nombre}: the step done for the reader`);
    assert.deepEqual(r.h, ['a'], `${d.nombre}: the step done`);
  }
});
