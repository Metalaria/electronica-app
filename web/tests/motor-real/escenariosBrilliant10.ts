// 1.0 «¿Qué seguridad tiene?» on the REAL engine (arnes.ts): the store `seguridad` with its own merge
// (lib/aprendizaje/seguridad.ts unirSeguridad) through the real Guardado and synchronisation. Added to the cases by
// correr.ts; the names start with «b10·» and brilliant10-contenido.spec.ts runs them (datos10's «t10» count stays).
import assert from 'node:assert/strict';
import { casos } from './escenarios.ts';
import { guardado, nuevaPestana, nuevoDisp, nuevoRepo, pasada, reloj, type Disp, type Pestana, type Repo } from './arnes.ts';
import { anotarSeguridad, seguridadValida, unirSeguridad, type NivelSeguridad, type RegistroSeguridad } from '../../src/lib/aprendizaje/seguridad.ts';

const M = 60_000;
const H = 60 * M;
const T0 = new Date(2026, 10, 6, 12).getTime();
const caso = (nombre: string, f: () => Promise<void>) => casos.push([nombre, f]);
const seguridad = () => guardado('seguridad', { tiempo: (v) => (v as RegistroSeguridad).t, valido: seguridadValida, unir: (a, b) => unirSeguridad(a as RegistroSeguridad, b as RegistroSeguridad), vivo: true });

async function asentar(devs: Disp[], repo: Repo, t: number): Promise<void> {
  for (let r = 0; r < 6; r++) {
    const antes = repo.commits;
    for (const d of devs) for (const p of d.pestanas) await pasada(d, repo, (t += M), { pestana: p });
    if (repo.commits === antes) return;
  }
  throw new Error('los commits no paran');
}

/** A tap as the module writes it (seguridad.svelte.ts marcarSeguridad): the record with one more entry. */
async function tocar(p: Pestana, item: string, a: number, s: NivelSeguridad): Promise<void> {
  reloj.ahora = a;
  const m = p.mem('seguridad') as Record<string, RegistroSeguridad>;
  await p.editar('seguridad', { [item]: anotarSeguridad(m[item], a, s) });
}

const taps = (d: Disp, item: string) => ((d.almacen('seguridad').valores as Record<string, RegistroSeguridad>)[item]?.e ?? []).map(([a, s]) => `${a - T0}:${s}`);

caso('b10·1 · seguridad de las respuestas en dos dispositivos y dos pestañas: se unen los toques, nada se pierde y el mismo instante se queda con el más prudente', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [seguridad()]);
  const B = await nuevoDisp('B', [seguridad()]);
  // A answers item q1 twice (two rounds) and taps; B, offline, taps the same item and another one
  await tocar(A.pestanas[0]!, 'cap05-01', T0, 'adivinado');
  await tocar(A.pestanas[0]!, 'cap05-01', T0 + 2 * H, 'sabia');
  await tocar(B.pestanas[0]!, 'cap05-01', T0 + H, 'dudaba');
  await tocar(B.pestanas[0]!, 'cap01-reto-fig-1.4-0-2', T0 + H + M, 'sabia');
  // the same instant on both (a tap restored on two devices): the more cautious level wins on both
  await tocar(A.pestanas[0]!, 'cap06-02', T0 + 3 * H, 'sabia');
  await tocar(B.pestanas[0]!, 'cap06-02', T0 + 3 * H, 'adivinado');
  // a second tab on A taps meanwhile (read-merge-write with the store's merge: the first tab's taps stay)
  const A2 = await nuevaPestana(A);
  await tocar(A2, 'cap05-01', T0 + 4 * H, 'dudaba');
  await asentar([A, B], repo, T0 + 5 * H);
  for (const d of [A, B]) {
    assert.deepStrictEqual(taps(d, 'cap05-01'), ['0:adivinado', '3600000:dudaba', '7200000:sabia', '14400000:dudaba'], `${d.nombre}: los cuatro toques de q1`);
    assert.deepStrictEqual(taps(d, 'cap01-reto-fig-1.4-0-2'), ['3660000:sabia'], `${d.nombre}: el toque de B`);
    assert.deepStrictEqual(taps(d, 'cap06-02'), ['10800000:adivinado'], `${d.nombre}: el mismo instante, el más prudente`);
  }
  // nothing more to commit: the union is stable
  const antes = repo.commits;
  await asentar([A, B], repo, T0 + 6 * H);
  assert.equal(repo.commits, antes, 'sin más commits');
});
