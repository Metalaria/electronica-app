// Independent review 12g: scenarios on the REAL engine and modules (arnes.ts). Run from web/:
//   node --experimental-transform-types --no-warnings --import ./tests/motor-real/registrar.mjs tests/motor-real/revision12g.ts
// The last line is the JSON result.
//   g12·1  cost of the daily progress's `rehacerEspejos` (progreso-diario.svelte.ts), run synchronously on every
//          `epa:sincronizado` that names `progreso-diario` (every run that received a day from another device): it
//          remakes the mirror of EVERY day, and `rehacerDia` → `grupoDe` scans the whole map for each day (three times):
//          O(days × items). Measured with years of data of three devices; the budget is 100 ms on this machine (the
//          owner's tablet is ~4× slower).
// Run on its own (as above), every case runs, the timing ones g12·1/g12·1b included. tests/datos12.spec.ts runs this
// file with its other workers busy, where a 100 ms budget is not a fair measure: it leaves g12·1/g12·1b out there and
// checks the same regression with a count of the map's traversals instead (`rehacerDias`, «ronda de arreglos 7 (puro)»).
import assert from 'node:assert/strict';
import { casos, correrCasos } from './escenarios.ts';
import { guardado, nuevaPestana, nuevoDisp, nuevoRepo, pasada, reloj, type AlmacenDiario, type Pestana } from './arnes.ts';

const M = 60_000;
const T0 = new Date(2026, 10, 5, 12).getTime();
const caso = (nombre: string, f: () => Promise<void>) => casos.push([nombre, f]);
const diario = (): AlmacenDiario => ({ diario: true, clave: 'progreso-diario' });
const clave = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** `dias` past days (before yesterday) with one record of each of three other devices and the mirror of their sum. */
function historia(dias: number): string {
  const m: Record<string, unknown> = {};
  for (let k = 3; k < dias + 3; k++) {
    const t = T0 - k * 86_400_000;
    const d = clave(t);
    for (const dev of ['aaaaaaaa', 'bbbbbbbb', 'cccccccc']) m[`${d}@${dev}`] = { pasos: 2, preguntas: 5, secciones: 1, cumplido: false, t };
    m[d] = { pasos: 6, preguntas: 15, secciones: 3, cumplido: true, t };
  }
  return JSON.stringify(m);
}

async function medir(dias: number): Promise<{ bloque: number; pasada: number; items: number }> {
  const repo = nuevoRepo();
  const texto = historia(dias);
  reloj.ahora = T0;
  const B = await nuevoDisp('B', [diario()], 0, '0.11', { guardado: { 'progreso-diario': texto } });
  await pasada(B, repo, T0 + M);
  const A = await nuevoDisp('A', [diario()], 0, '0.11', { guardado: { 'progreso-diario': texto } });
  await pasada(A, repo, T0 + 2 * M);
  // B studies a step today and synchronises: A's next run receives that day (and fires epa:sincronizado)
  const pb: Pestana = B.pestanas[0]!;
  reloj.ahora = T0 + 3 * M;
  pb.diario!.registrarActividad('paso');
  await pb.diario!.guardadoDias.volcar();
  await pasada(B, repo, T0 + 4 * M);
  const p0 = performance.now();
  await pasada(A, repo, T0 + 5 * M);
  const p1 = performance.now();
  // the synchronous block itself: the event the run dispatches (one listener per tab mounted in this process)
  const b0 = performance.now();
  (globalThis as unknown as { window: EventTarget }).window.dispatchEvent(new CustomEvent('epa:sincronizado', { detail: { claves: ['progreso-diario'] } }));
  const b1 = performance.now();
  const items = Object.keys(JSON.parse(texto)).length;
  const hoy = (await A.pestanas[0]!.diario!.leerDias())[clave(T0)];
  assert.equal(hoy?.pasos, 1, 'A recibe el paso de B');
  return { bloque: b1 - b0, pasada: p1 - p0, items };
}

caso('g12·1 · rehacerEspejos con dos años de tres dispositivos: bloque síncrono < 100 ms', async () => {
  const r = await medir(730);
  console.error(`g12·1: ${r.items} elementos; bloque síncrono de epa:sincronizado ${r.bloque.toFixed(0)} ms (2 pestañas montadas); pasada de A ${r.pasada.toFixed(0)} ms`);
  assert.ok(r.bloque < 100, `bloque síncrono de ${r.bloque.toFixed(0)} ms con ${r.items} elementos`);
});
caso('g12·1b · control: 60 días', async () => {
  const r = await medir(60);
  console.error(`g12·1b: ${r.items} elementos; bloque ${r.bloque.toFixed(0)} ms; pasada ${r.pasada.toFixed(0)} ms`);
  assert.ok(r.bloque < 100);
});

// g12·2: tab 2's change of an item lands just after the run's `inicio` and before the run reads that store (so the merge
// SEES it), another device changes the same item a second later and its PUT lands first (a 409: the run merges again),
// so the file's newer version wins the merge and is applied. Its `sinc-aplicados` entry is dated `inicio` (0.12f), i.e.
// before tab 2's change, so tab 2 finds no evidence, keeps its (older, merged-and-lost) change and writes it back; the
// running tab takes it (tab 2's mark is for that value) and the next run dates it "now": the other device's newer edit
// is lost everywhere. A store without a time of its own (as leidas, ejercicios, lecciones, favourites…).
async function g12x2(conTiempo: boolean): Promise<void> {
  const H = 60 * M;
  const sin = () => [guardado('sin', conTiempo ? { tiempo: (v) => (v as { t?: number })?.t } : {})];
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', sin());
  const A2 = await nuevaPestana(A);
  const B = await nuevoDisp('B', sin());
  const G = (p: Pestana) => p.guardados.get('sin')! as unknown as { refrescar(): Promise<void>; volcar(): Promise<void> };
  reloj.ahora = T0;
  await A.pestanas[0]!.editar('sin', { x: { x: 'v1', t: T0 } });
  await pasada(A, repo, T0 + M);
  await pasada(B, repo, T0 + 2 * M);
  await G(A2).refrescar();
  const Trun = T0 + H;
  // tab 2 changes x 50 ms after the run starts (and before the run reads the store: emulated by doing it first)
  reloj.ahora = Trun + 50;
  await A2.editar('sin', { x: { x: 'de A2', t: Trun + 50 } });
  // B changes x one second later and its run's PUT lands before A's
  repo.antesDePut = async () => {
    reloj.ahora = Trun + 1000;
    await B.pestanas[0]!.editar('sin', { x: { x: 'de B', t: Trun + 1000 } });
    await pasada(B, repo, Trun + 1000);
  };
  await pasada(A, repo, Trun, { pestana: A.pestanas[0]! });
  const va = (p: Pestana) => (p.disp.almacen('sin').valores.x as { x?: string } | undefined)?.x;
  assert.equal(va(A.pestanas[0]!), 'de B', 'the merge applies B’s newer version');
  reloj.ahora = Trun + 2000;
  await G(A2).refrescar();
  await G(A2).volcar();
  await G(A.pestanas[0]!).refrescar();
  await G(A.pestanas[0]!).volcar();
  for (let r = 0, t = Trun + 5 * M; r < 3; r++, t += 4 * M) {
    await pasada(A, repo, t, { pestana: A.pestanas[0]! });
    await pasada(B, repo, t + M);
    await G(A2).refrescar();
  }
  assert.equal((repo.vivos('sin').x as { x?: string }).x, 'de B', `the file ends with «${(repo.vivos('sin').x as { x?: string }).x}»: B’s edit (1 s after tab 2’s, already merged over it) is lost`);
  assert.equal(va(B.pestanas[0]!), 'de B', 'B');
}
caso('g12·2 · un cambio de otra pestaña visto por la fusión y perdido ante una versión más nueva de otro dispositivo no vuelve (almacén sin hora propia)', () => g12x2(false));
caso('g12·2b · lo mismo con un almacén con hora propia (control)', () => g12x2(true));

const r = await correrCasos(process.argv[2] ?? 'g12·');
console.log(JSON.stringify(r));
if (r.some((x) => !x.ok)) process.exitCode = 1;
