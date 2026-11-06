// Independent review of 0.12 (revision12a): scenarios on the REAL engine (arnes.ts) that show findings of the review.
// Run from web/:
//   nice node --experimental-transform-types --no-warnings --import ./tests/motor-real/registrar.mjs tests/motor-real/revision12a.ts [filtro]
// The last line of the output is the JSON result (as correr.ts casos).
import assert from 'node:assert/strict';
import { claveDia } from '../../src/componentes/repaso/srs.ts';
import { casos, correrCasos } from './escenarios.ts';
import { guardado, nuevaPestana, nuevoDisp, nuevoRepo, pasada, registro, reloj, type AlmacenDiario, type Disp, type Pestana } from './arnes.ts';

const M = 60_000;
const H = 60 * M;
const T0 = new Date(2026, 10, 4, 12).getTime();
const HOY = claveDia(T0);
const tiempoT = (v: unknown) => (typeof (v as { t?: unknown })?.t === 'number' ? (v as { t: number }).t : undefined);
const diario = (): AlmacenDiario => ({ diario: true, clave: 'progreso-diario' });
const caso = (nombre: string, f: () => Promise<void>) => casos.push([nombre, f]);
const refrescar = (p: Pestana) => (p.diario!.guardadoDias as unknown as { refrescar(): Promise<void> }).refrescar();
async function diaDe(p: Pestana, t: number) {
  reloj.ahora = t;
  return (await p.diario!.leerDias())[HOY];
}

caso('a12·1 · el excedente heredado («día@0») absorbido por dos pestañas con vistas distintas se suma dos veces', async () => {
  const repo = nuevoRepo();
  // a 0.11 device V (the day item, last write wins), a 0.12 device B, and a 0.12 browser A with two tabs
  const V = await nuevoDisp('V', [registro('progreso-diario', { tiempo: tiempoT })]);
  const A = await nuevoDisp('A', [diario()]);
  const A2 = await nuevaPestana(A);
  const B = await nuevoDisp('B', [diario()]);
  const st = V.almacen('progreso-diario');
  // V studies 3 steps on 0.11
  st.valores[HOY] = { pasos: 3, preguntas: 0, secciones: 0, cumplido: false, t: T0 };
  V.cambio('progreso-diario', HOY, T0);
  await pasada(V, repo, T0 + M);
  await pasada(A, repo, T0 + 2 * M); // tab 1 runs the synchronisation
  await refrescar(A2); // tab 2 sees it (the storage event)
  await pasada(B, repo, T0 + 3 * M);
  // V studies 2 more steps (on top of the 3 it saw): its day item is now 5
  st.valores[HOY] = { pasos: 5, preguntas: 0, secciones: 0, cumplido: false, t: T0 + 10 * M };
  V.cambio('progreso-diario', HOY, T0 + 10 * M);
  await pasada(V, repo, T0 + 11 * M);
  // B synchronises and studies one step: it absorbs V's 5 into «día@0»
  await pasada(B, repo, T0 + 12 * M);
  reloj.ahora = T0 + 13 * M;
  B.pestanas[0]!.diario!.registrarActividad('paso', 1);
  await B.pestanas[0]!.diario!.guardadoDias.volcar();
  await pasada(B, repo, T0 + 14 * M);
  // tab 1 of A runs a synchronisation: it stores B's «día@0» = 5 (and B's record). Tab 2 has not processed the storage
  // event yet (it comes a task later) when the reader does a step there: with its view (only V's first 3) it absorbs
  // 3 into «día@0», and its write merges that with the stored 5 (no base for «día@0»: unirAportesPestanas sums them)
  await pasada(A, repo, T0 + 20 * M);
  reloj.ahora = T0 + 20 * M + 200;
  A2.diario!.registrarActividad('paso', 1);
  await A2.diario!.guardadoDias.volcar();
  await refrescar(A.pestanas[0]!);
  // true activity: V 5 + B 1 + A 1 = 7
  const x = await diaDe(A2, T0 + H);
  const items = A2.diario!.itemsDias();
  const ahora = `A (pestaña 2) suma ${x?.pasos} pasos, no 7: «${HOY}@0» = ${JSON.stringify(items[`${HOY}@0`])}`;
  // and after every device synchronises a few times
  let t = T0 + H;
  for (let r = 0; r < 4; r++) for (const d of [A, B, V]) await pasada(d, repo, (t += M));
  await refrescar(A2);
  const tras: string[] = [];
  for (const [n, p] of [['A1', A.pestanas[0]!], ['A2', A2], ['B', B.pestanas[0]!]] as const) tras.push(`${n}=${(await diaDe(p, t + H))?.pasos}`);
  tras.push(`V=${(V.almacen('progreso-diario').valores[HOY] as { pasos: number }).pasos}`, `fichero «@0»=${(repo.vivos('progreso-diario')[`${HOY}@0`] as { pasos: number }).pasos}`);
  if (x?.pasos !== 7 || tras.some((s) => !s.endsWith('=7') && !s.includes('@0'))) assert.fail(`${ahora}; tras sincronizar: ${tras.join(', ')}`);
});

const DIA = 24 * H;
const notas = () => guardado('notas', { tiempo: tiempoT, valido: (v) => typeof (v as { texto?: unknown })?.texto === 'string' });
const textos = (d: Disp) => Object.keys(d.almacen('notas').valores).sort();
async function nota(p: Pestana, t: number, id: string, texto: string) {
  reloj.ahora = t;
  await p.editar('notas', { [id]: { texto, label: id, t } });
}

caso('a12·2 · una copia de hace más de 90 días importada con «Unir» resucita en todos lo borrado antes de la poda', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [notas()]);
  const B = await nuevoDisp('B', [notas()]);
  await nota(A.pestanas[0]!, T0, 'n1', 'uno');
  await nota(A.pestanas[0]!, T0, 'n2', 'dos');
  for (const d of [A, B, A]) await pasada(d, repo, T0 + M);
  reloj.ahora = T0 + 2 * M;
  const vieja = (await (await A.pestanas[0]!.copia()).crearCopia()).texto;
  // n1 deleted the next day on B; everybody synchronises
  reloj.ahora = T0 + DIA;
  await B.pestanas[0]!.editar('notas', {}, ['n1']);
  for (const d of [B, A, B]) await pasada(d, repo, T0 + DIA + M);
  // four months later (the tombstone is pruned from the file: 90 days), A restores the old backup with «Unir»
  const luego = T0 + 120 * DIA;
  for (const d of [A, B, A, B]) await pasada(d, repo, luego);
  assert.deepEqual(textos(A), ['n2']);
  reloj.ahora = luego + H;
  const c = await A.pestanas[0]!.copia();
  await c.importar(c.leerFicheroCopia(vieja), 'unir');
  for (const d of [A, B, A, B]) await pasada(d, repo, luego + 2 * H);
  assert.deepEqual({ A: textos(A), B: textos(B), fichero: Object.keys(repo.vivos('notas')).sort() }, { A: ['n2'], B: ['n2'], fichero: ['n2'] }, 'n1, borrada hace 119 días, vuelve en todos');
});

// 1.0: compatibility with 0.10/0.11 clients was dropped (a 0.11 device cannot read the file of format 2). This case
// checked that a 0.11 device's step on top of the day counted without bringing an undone step back; 1.0 reads the
// records only, so a day item written on top (by a store that is not the app's module, as V here) is not read: the
// undone step never comes back, and V's write — which no real client can make any more — is not counted.
caso('a12·3 · un paso deshecho en la 0.12 no vuelve a contarse aunque otro escritor reescriba el día encima (1.0: solo cuentan los registros)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [diario()]);
  const V = await nuevoDisp('V', [registro('progreso-diario', { tiempo: tiempoT })]);
  const a = A.pestanas[0]!;
  reloj.ahora = T0;
  a.diario!.registrarActividad('seccion', 3);
  await a.diario!.guardadoDias.volcar();
  for (const d of [A, V]) await pasada(d, repo, T0 + M);
  // A unmarks a section (an undo: 3 -> 2); V (0.11) has not synchronised since and marks one section on top of its 3
  reloj.ahora = T0 + 2 * M;
  a.diario!.registrarActividad('seccion', -1);
  await a.diario!.guardadoDias.volcar();
  await pasada(A, repo, T0 + 3 * M);
  const st = V.almacen('progreso-diario');
  const d = st.valores[HOY] as { secciones: number; t: number };
  st.valores[HOY] = { ...d, secciones: d.secciones + 1, t: T0 + 4 * M };
  V.cambio('progreso-diario', HOY, T0 + 4 * M);
  let t = T0 + 5 * M;
  for (let r = 0; r < 3; r++) for (const x of [V, A]) await pasada(x, repo, (t += M));
  // A's records: 3 − 1 undone = 2 (V's day item is not a record)
  const x = await diaDe(a, t + H);
  assert.equal(x?.secciones, 2, `A cuenta ${x?.secciones} secciones (la deshecha vuelve o cuenta el día de V)`);
});

console.log(JSON.stringify(await correrCasos(process.argv[2] ?? 'a12')));
