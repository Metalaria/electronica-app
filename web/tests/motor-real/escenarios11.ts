// 1.1 on the REAL engine (arnes.ts): the stores of the real modules built on `guardadoDeRegistro` with their own merge,
// `laboratorio` (lib/laboratorio.svelte.ts) and `seguridad` (lib/aprendizaje/seguridad.svelte.ts). Added to the cases
// by correr.ts; the names start with «e11·» and enlaces11-unidad.spec.ts runs them.
//
// e11·1  Both modules created their Guardado WITHOUT `claveSinc` (every other module passes it): their writes made no
//        marks, so `leerTestigos` returned null and `atestiguado` took ANY other writer's version as proven — a stale
//        tab's copy (its cached view of localStorage lagged; the protection of 0.12, finding 3) written over the
//        reader's step deleted it from the storage and from memory, before any synchronisation had sent it: lost on
//        every device. With `claveSinc` the step is marked, the stale copy is not evidence, the step stays.
//        Fails before the fix: EPA_SUSTITUIR='src/lib/laboratorio.svelte.ts=<copy without claveSinc>'.
import assert from 'node:assert/strict';
import { casos } from './escenarios.ts';
import { almacenamiento, modulo, nuevaPestana, nuevoDisp, nuevoRepo, pasada, reloj, type Disp, type Pestana, type Repo } from './arnes.ts';
import type { RegistroLab } from '../../src/lib/laboratorio.ts';
import type { RegistroSeguridad } from '../../src/lib/aprendizaje/seguridad.ts';

const M = 60_000;
const T0 = new Date(2026, 10, 9, 12).getTime();
const PASOS = ['a', 'b', 'c'];
const caso = (nombre: string, f: () => Promise<void>) => casos.push([nombre, f]);

async function asentar(devs: Disp[], repo: Repo, t: number): Promise<void> {
  for (let r = 0; r < 6; r++) {
    const antes = repo.commits;
    for (const d of devs) for (const p of d.pestanas) await pasada(d, repo, (t += M), { pestana: p });
    if (repo.commits === antes) return;
  }
  throw new Error('los commits no paran');
}

type Mod = Record<string, (...a: unknown[]) => Promise<void>> & { guardadoLab: { refrescar(): Promise<void>; volcar(): Promise<void> }; guardadoSeguridad: { refrescar(): Promise<void>; volcar(): Promise<void> } };
const mod = (p: Pestana, k: string) => p.modulos.get(k) as unknown as Mod;
/** A step as the lab panel records it (laboratorio.svelte.ts anotarPasoLaboratorio). */
async function paso(p: Pestana, n: number, id: string, a: number): Promise<void> {
  reloj.ahora = a;
  await mod(p, 'laboratorio').anotarPasoLaboratorio!(n, id, 1.5, PASOS, a);
}
const pasos = (d: Disp, n: number) => ((d.almacen('laboratorio').valores as Record<string, RegistroLab>)[`p${n}`]?.h ?? []).join(',');
const memoriaLab = (p: Pestana) => (mod(p, 'laboratorio') as unknown as { estadoLab: { items: Record<string, RegistroLab> } }).estadoLab.items;

caso('e11·1 · laboratorio: la copia desfasada de otra pestaña no borra el paso recién hecho (marcas con claveSinc); dos dispositivos lo unen', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [modulo('laboratorio')]);
  const B = await nuevoDisp('B', [modulo('laboratorio')]);
  const A1 = A.pestanas[0]!;
  const A2 = await nuevaPestana(A);
  // tab 2 does a step of lab 2; tab 1 sees it, then does the first step of lab 1
  await paso(A2, 2, 'a', T0);
  reloj.ahora = T0 + 1000;
  await mod(A1, 'laboratorio').guardadoLab.refrescar();
  const ls = almacenamiento(A);
  const rancia = ls.get('laboratorio')!;
  await paso(A1, 1, 'a', T0 + M);
  assert.equal(pasos(A, 1), 'a', 'stored');
  // tab 2 (its cached view of localStorage lagged: still without lab 1) writes the key as it saw it
  ls.set('laboratorio', rancia);
  reloj.ahora = T0 + M + 5000;
  await mod(A1, 'laboratorio').guardadoLab.refrescar();
  assert.deepEqual(memoriaLab(A1).p1?.h, ['a'], 'tab 1 keeps its step in memory');
  await mod(A1, 'laboratorio').guardadoLab.volcar();
  assert.equal(pasos(A, 1), 'a', 'and writes it back over the stale copy');
  await mod(A2, 'laboratorio').guardadoLab.refrescar();
  assert.deepEqual(memoriaLab(A2).p1?.h, ['a'], 'tab 2 gets it');
  // B, offline, did another step of lab 1: both devices end with the union
  await paso(B.pestanas[0]!, 1, 'b', T0 + 2 * M);
  await asentar([A, B], repo, T0 + 10 * M);
  for (const d of [A, B]) {
    assert.equal(pasos(d, 1), 'a,b', `${d.nombre}: lab 1, both steps`);
    assert.equal(pasos(d, 2), 'a', `${d.nombre}: lab 2`);
  }
  assert.deepEqual((repo.vivos('laboratorio').p1 as RegistroLab).h, ['a', 'b'], 'the file');
  const antes = repo.commits;
  await asentar([A, B], repo, T0 + 20 * M);
  assert.equal(repo.commits, antes, 'no more commits');
});

caso('e11·2 · seguridad (1.0): la copia desfasada de otra pestaña no borra el toque recién hecho', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [modulo('seguridad')]);
  const B = await nuevoDisp('B', [modulo('seguridad')]);
  const A1 = A.pestanas[0]!;
  const A2 = await nuevaPestana(A);
  reloj.ahora = T0;
  await mod(A2, 'seguridad').marcarSeguridad!('cap01-01', 'sabia', T0);
  reloj.ahora = T0 + 1000;
  await mod(A1, 'seguridad').guardadoSeguridad.refrescar();
  const ls = almacenamiento(A);
  const rancia = ls.get('seguridad')!;
  reloj.ahora = T0 + M;
  await mod(A1, 'seguridad').marcarSeguridad!('cap02-03', 'dudaba', T0 + M);
  ls.set('seguridad', rancia);
  reloj.ahora = T0 + M + 5000;
  await mod(A1, 'seguridad').guardadoSeguridad.refrescar();
  await mod(A1, 'seguridad').guardadoSeguridad.volcar();
  const items = () => (A.almacen('seguridad').valores as Record<string, RegistroSeguridad>);
  assert.ok(items()['cap02-03'], 'the tap stays in the storage');
  await asentar([A, B], repo, T0 + 10 * M);
  for (const d of [A, B]) assert.deepEqual(Object.keys(d.almacen('seguridad').valores).sort(), ['cap01-01', 'cap02-03'], `${d.nombre}: both taps`);
});

caso('e11·3 · un almacén sincronizado cuyo Guardado no marca con su clave no se registra (guarda de sincronizableGuardado)', async () => {
  const A = await nuevoDisp('A', []);
  const g = (await import(new URL('../../src/lib/sincronizacion/guardado.ts', import.meta.url).href + `?d=${A.pestanas[0]!.grafo}`)) as {
    guardadoDeRegistro(o: unknown): unknown;
    sincronizableGuardado(g: unknown, o: unknown): unknown;
  };
  const sin = g.guardadoDeRegistro({ claveAlmacen: 'x', obtener: () => ({}) });
  assert.throws(() => g.sincronizableGuardado(sin, { clave: 'x', nombre: 'x' }), /marks as «\(nothing\)»/);
  const otra = g.guardadoDeRegistro({ claveAlmacen: 'x', claveSinc: 'y', obtener: () => ({}) });
  assert.throws(() => g.sincronizableGuardado(otra, { clave: 'x', nombre: 'x' }), /marks as «y»/);
  const bien = g.guardadoDeRegistro({ claveAlmacen: 'x', claveSinc: 'x', obtener: () => ({}) });
  assert.ok(g.sincronizableGuardado(bien, { clave: 'x', nombre: 'x' }));
});
