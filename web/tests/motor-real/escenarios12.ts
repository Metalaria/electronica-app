// Scenarios of 0.12 on the REAL engine (arnes.ts): the backup's export and import (src/lib/sincronizacion/copia.ts)
// and the daily activity summed across devices (src/lib/progreso-diario.svelte.ts, the real module per tab). Added to
// the cases of escenarios.ts by correr.ts (revision11-motor.spec.ts and datos12.spec.ts run them).
import assert from 'node:assert/strict';
import { claveDia } from '../../src/componentes/repaso/srs.ts';
import { esLapida } from '../../src/lib/sincronizacion/fusion.ts';
import { casos } from './escenarios.ts';
import {
  almacenamiento,
  fallarEscritura,
  guardado,
  limitarEscritura,
  nuevaPestana,
  nuevoDisp,
  nuevoRepo,
  pasada,
  registro,
  reloj,
  tiempos,
  type Almacen,
  type AlmacenDiario,
  type Disp,
  type Pestana,
  type Repo,
} from './arnes.ts';

const M = 60_000;
const H = 60 * M;
const DIA = 24 * H;
const tiempoT = (v: unknown) => (typeof (v as { t?: unknown })?.t === 'number' ? (v as { t: number }).t : undefined);
const igual = (a: unknown, b: unknown, m?: string) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null)), m);
const caso = (nombre: string, f: () => Promise<void>) => casos.push([nombre, f]);

/** Noon of a review day (local time): far from the 04:00 change. */
const T0 = new Date(2026, 10, 4, 12).getTime();
const HOY = claveDia(T0);
const diario = (): AlmacenDiario => ({ diario: true, clave: 'progreso-diario' });
// (as registro.svelte.ts checks a note: a text)
const notas = () => guardado('notas', { tiempo: tiempoT, valido: (v) => typeof (v as { texto?: unknown })?.texto === 'string' });
const marcadores = () => guardado('marcadores', { tiempo: tiempoT });
const almacenes = (): Almacen[] => [notas(), marcadores(), diario()];

/** The reader does something in a tab at time t (the module writes it as it does after a pause). */
async function actividad(p: Pestana, t: number, tipo: 'paso' | 'pregunta' | 'seccion' = 'paso', n = 1): Promise<void> {
  reloj.ahora = t;
  p.diario!.registrarActividad(tipo, n);
  await p.diario!.guardadoDias.volcar();
}
/** The day as the tab adds it up (at time t). */
async function diaDe(p: Pestana, t: number, dia = HOY) {
  reloj.ahora = t;
  return (await p.diario!.leerDias())[dia];
}
async function nota(p: Pestana, t: number, id: string, texto: string): Promise<void> {
  reloj.ahora = t;
  await p.editar('notas', { [id]: { texto, label: id, t } });
}
async function borrarNota(p: Pestana, t: number, id: string): Promise<void> {
  reloj.ahora = t;
  await p.editar('notas', {}, [id]);
}
/** Every device runs in turn until a whole round writes nothing; returns the commits it took. */
async function asentar(devs: Disp[], repo: Repo, t: number, rondas = 8): Promise<number> {
  const c0 = repo.commits;
  let ultima = -1;
  for (let r = 0; r < rondas; r++) {
    const antes = repo.commits;
    for (const d of devs) for (const p of d.pestanas) await pasada(d, repo, (t += M), { pestana: p });
    ultima = repo.commits - antes;
    if (!ultima) break;
  }
  assert.equal(ultima, 0, 'los commits no paran');
  return repo.commits - c0;
}
const tab = (d: Disp) => d.pestanas[0]!;

// ================================================================== daily activity summed across devices

caso('d12·1 · el mismo día en dos dispositivos se suma, y sincronizar otra vez no cuenta dos veces', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const B = await nuevoDisp('B', almacenes());
  await actividad(tab(A), T0, 'paso', 2);
  await actividad(tab(B), T0 + M, 'paso', 2);
  await actividad(tab(B), T0 + 2 * M, 'pregunta', 1);
  await asentar([A, B], repo, T0 + 3 * M);
  for (const d of [A, B]) {
    const x = await diaDe(tab(d), T0 + H);
    igual([x?.pasos, x?.preguntas], [4, 1], `${d.nombre} suma los dos dispositivos`);
  }
  // more runs, in any order: still 4
  for (let i = 0; i < 4; i++) await pasada(i % 2 ? A : B, repo, T0 + H + i * M);
  igual((await diaDe(tab(A), T0 + 2 * H))?.pasos, 4);
  igual((await diaDe(tab(B), T0 + 2 * H))?.pasos, 4);
  // the file holds one record per device and the day's mirror with the sum (what 0.10/0.11 read)
  const v = repo.vivos('progreso-diario');
  igual(Object.keys(v).filter((k) => k.startsWith(`${HOY}@`)).length, 2);
  igual((v[HOY] as { pasos: number }).pasos, 4);
  // an undo on one device subtracts once
  await actividad(tab(A), T0 + 3 * H, 'paso', -1);
  await asentar([A, B], repo, T0 + 3 * H);
  igual((await diaDe(tab(B), T0 + 4 * H))?.pasos, 3);
});

caso('d12·2 · el objetivo que solo se cumple sumando los dos dispositivos cuenta (hoy y como día pasado)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const B = await nuevoDisp('B', almacenes());
  await actividad(tab(A), T0, 'paso', 2);
  await actividad(tab(B), T0 + M, 'paso', 2);
  igual(tab(A).diario!.progresoDiario.cumplidoHoy, false);
  await asentar([A, B], repo, T0 + 2 * M);
  igual(tab(A).diario!.progresoDiario.cumplidoHoy, true, 'A: cumplido con lo de B');
  igual(tab(B).diario!.progresoDiario.cumplidoHoy, true, 'B: cumplido con lo de A');
  const ev = (globalThis as unknown as { __eventos: Record<string, { tipo: string; dia?: string }[]> }).__eventos ?? {};
  assert.ok(Object.values(ev).flat().some((e) => e.tipo === 'objetivo-cumplido' && e.dia === HOY), 'se emite «objetivo-cumplido»');
  // a phone offline until the next day: its two steps still complete yesterday's goal
  const C = await nuevoDisp('C', almacenes());
  const D = await nuevoDisp('D', almacenes());
  const ayer = T0 + DIA;
  await actividad(tab(C), ayer, 'paso', 1);
  await actividad(tab(D), ayer + M, 'paso', 2);
  await pasada(C, repo, ayer + 2 * M);
  await pasada(D, repo, ayer + DIA, {});
  await pasada(C, repo, ayer + DIA + M);
  const x = await diaDe(tab(C), ayer + DIA + 2 * M, claveDia(ayer));
  igual([x?.pasos, x?.cumplido], [3, true], 'el día pasado se cumple con la suma');
});

caso('d12·3 · datos de la 0.11 (solo el día): no se cuentan dos veces al actualizar, y lo nuevo se suma', async () => {
  const repo = nuevoRepo();
  const viejo = JSON.stringify({ [HOY]: { pasos: 3, preguntas: 1, secciones: 0, cumplido: true, t: T0 - H } });
  const A = await nuevoDisp('A', almacenes(), 0, '0.11', { guardado: { 'progreso-diario': viejo } });
  const B = await nuevoDisp('B', almacenes(), 0, '0.11', { guardado: { 'progreso-diario': viejo } });
  // nothing written at load (a lazy migration)
  igual(almacenamiento(A).get('progreso-diario'), viejo, 'cargar no escribe');
  igual((await diaDe(tab(A), T0))?.pasos, 3);
  await asentar([A, B], repo, T0);
  igual((await diaDe(tab(B), T0 + H))?.pasos, 3, 'lo de antes no se duplica');
  await actividad(tab(A), T0 + H, 'paso', 1);
  await actividad(tab(B), T0 + H + M, 'paso', 2);
  await asentar([A, B], repo, T0 + 2 * H);
  for (const d of [A, B]) igual((await diaDe(tab(d), T0 + 3 * H))?.pasos, 6, `${d.nombre}: 3 de antes + 1 + 2`);
  // the legacy activity is held once, in «<day>@0», by both (same value)
  igual((repo.vivos('progreso-diario')[`${HOY}@0`] as { pasos: number }).pasos, 3);
});

caso('d12·4 · un dispositivo con la 0.11 que suma encima: se cuenta, sin duplicar, y todo converge', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  // a 0.11 device: the day item last-write-wins, its own time (registro: memory is its storage)
  const V = await nuevoDisp('V', [registro('progreso-diario', { tiempo: tiempoT })]);
  await actividad(tab(A), T0, 'paso', 2);
  await asentar([A, V], repo, T0 + M);
  const st = V.almacen('progreso-diario');
  const d = st.valores[HOY] as { pasos: number; t: number };
  igual(d.pasos, 2, 'la 0.11 ve la suma');
  // the 0.11 device studies 3 steps on top of what it saw
  st.valores[HOY] = { ...d, pasos: d.pasos + 3, t: T0 + 10 * M };
  V.cambio('progreso-diario', HOY, T0 + 10 * M);
  await asentar([A, V], repo, T0 + 11 * M);
  igual((await diaDe(tab(A), T0 + H))?.pasos, 5, 'A cuenta los 3 pasos de la 0.11');
  await actividad(tab(A), T0 + H, 'paso', 1);
  await asentar([A, V], repo, T0 + H + M);
  igual((await diaDe(tab(A), T0 + 2 * H))?.pasos, 6);
  igual((V.almacen('progreso-diario').valores[HOY] as { pasos: number }).pasos, 6, 'la 0.11 ve 6');
});

caso('d12·5 · dos pestañas del mismo dispositivo suman a la vez sin perder pasos', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const A2 = await nuevaPestana(A);
  await actividad(tab(A), T0, 'paso', 1);
  // the second tab sees it (as the storage event would make it)
  await (A2.diario!.guardadoDias as unknown as { refrescar(): Promise<void> }).refrescar();
  // both count before seeing the other's count: the first one stored, the second tab's memory is older than that
  reloj.ahora = T0 + M;
  tab(A).diario!.registrarActividad('paso', 1);
  reloj.ahora = T0 + M + 1;
  A2.diario!.registrarActividad('paso', 2);
  await tab(A).diario!.guardadoDias.volcar();
  await A2.diario!.guardadoDias.volcar();
  await tab(A).diario!.guardadoDias.escribir();
  await A2.diario!.guardadoDias.escribir();
  igual((await diaDe(tab(A), T0 + H))?.pasos, 4, 'pestaña 1');
  igual((await diaDe(A2, T0 + H))?.pasos, 4, 'pestaña 2');
  await asentar([A], repo, T0 + H);
  const B = await nuevoDisp('B', almacenes());
  await asentar([A, B], repo, T0 + 2 * H);
  igual((await diaDe(tab(B), T0 + 3 * H))?.pasos, 4);
});

// ================================================================== backup: export and import

const textoCopia = async (p: Pestana, t: number) => {
  reloj.ahora = t;
  return (await (await p.copia()).crearCopia()).texto;
};
async function importarEn(p: Pestana, t: number, texto: string, modo: 'unir' | 'sustituir' = 'unir') {
  reloj.ahora = t;
  const c = await p.copia();
  return c.importar(c.leerFicheroCopia(texto), modo);
}
const textos = (d: Disp) => Object.fromEntries(Object.entries(d.almacen('notas').valores).map(([k, v]) => [k, (v as { texto: string }).texto]));

caso('c12·1 · importar en un dispositivo y sincronizar con otros dos: llega a todos, nada local se pierde, los commits paran', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const B = await nuevoDisp('B', almacenes());
  const C = await nuevoDisp('C', almacenes());
  await nota(tab(A), T0, 'n1', 'de A');
  await actividad(tab(A), T0, 'paso', 2);
  await asentar([A, B], repo, T0);
  // a backup made elsewhere (an offline tablet X that never synchronised)
  const X = await nuevoDisp('X', almacenes());
  await nota(tab(X), T0 + H, 'x1', 'de X');
  await nota(tab(X), T0 + H, 'n1', 'n1 editada en X');
  await actividad(tab(X), T0 + H, 'paso', 3);
  const copia = await textoCopia(tab(X), T0 + H);
  // C has its own unsynchronised note; it imports the backup
  await nota(tab(C), T0 + 2 * H, 'c1', 'de C');
  const r = await importarEn(tab(C), T0 + 2 * H, copia);
  igual(r.fallidos, []);
  igual(textos(C), { x1: 'de X', n1: 'n1 editada en X', c1: 'de C' }, 'C une sin perder lo suyo');
  const commits = await asentar([A, B, C], repo, T0 + 3 * H);
  assert.ok(commits <= 3, `commits al asentar: ${commits}`);
  for (const d of [A, B, C]) {
    igual(textos(d), { x1: 'de X', n1: 'n1 editada en X', c1: 'de C' }, `${d.nombre} converge`);
    igual((await diaDe(tab(d), T0 + 5 * H))?.pasos, 5, `${d.nombre}: 2 de A + 3 de X, una vez`);
  }
  // importing the same backup again changes nothing (idempotent) and writes nothing more
  const r2 = await importarEn(tab(B), T0 + 6 * H, copia);
  igual(r2.planes.reduce((n, p) => n + p.nuevos + p.cambiados + p.borrados, 0), 0, 'la segunda importación no cambia nada');
  igual(await asentar([A, B, C], repo, T0 + 6 * H), 0, 'ni commits');
});

caso('c12·2 · una copia vieja importada después de borrar y editar: nada borrado vuelve, nada editado retrocede', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const B = await nuevoDisp('B', almacenes());
  await nota(tab(A), T0, 'n1', 'uno');
  await nota(tab(A), T0, 'n2', 'dos');
  await nota(tab(A), T0, 'n3', 'tres');
  await asentar([A, B], repo, T0);
  const vieja = await textoCopia(tab(A), T0 + M);
  // after the backup: n1 deleted on A, n2 edited on B, n3 deleted on B while A is offline
  await borrarNota(tab(A), T0 + H, 'n1');
  await nota(tab(B), T0 + H, 'n2', 'dos editada');
  await asentar([A, B], repo, T0 + H);
  await borrarNota(tab(B), T0 + 2 * H, 'n3');
  await pasada(B, repo, T0 + 2 * H);
  // A imports the old backup (n3's deletion has not reached it yet), then everybody synchronises
  await importarEn(tab(A), T0 + 3 * H, vieja);
  igual(textos(A), { n2: 'dos editada', n3: 'tres' }, 'n1 sigue borrada; n2 no retrocede');
  await asentar([A, B], repo, T0 + 3 * H);
  for (const d of [A, B]) igual(textos(d), { n2: 'dos editada' }, `${d.nombre}: n3 borrada en B no vuelve`);
  // a fresh install that imports the old backup: it gets n1 and n3 back locally, the first run deletes them again
  const F = await nuevoDisp('F', almacenes());
  await importarEn(tab(F), T0 + 4 * H, vieja);
  igual(textos(F), { n1: 'uno', n2: 'dos', n3: 'tres' });
  await asentar([A, B, F], repo, T0 + 4 * H);
  for (const d of [A, B, F]) igual(textos(d), { n2: 'dos editada' }, `${d.nombre} tras la instalación nueva`);
});

caso('c12·3 · un fichero dañado, cortado, de otra aplicación o de una versión futura no cambia nada; los elementos dañados se descartan', async () => {
  const A = await nuevoDisp('A', almacenes());
  await nota(tab(A), T0, 'n1', 'uno');
  const buena = await textoCopia(tab(A), T0);
  const B = await nuevoDisp('B', almacenes());
  await nota(tab(B), T0, 'b1', 'de B');
  const c = await tab(B).copia();
  const antes = JSON.stringify([...almacenamiento(B)]);
  const malos: [string, RegExp][] = [
    [buena.slice(0, Math.floor(buena.length / 2)), /dañado o incompleto/],
    ['', /dañado o incompleto/],
    ['[1,2,3]', /no contiene una copia/],
    [JSON.stringify({ formato: 'otra-cosa', version: 1, almacenes: {} }), /no es una copia/],
    [JSON.stringify({ ...JSON.parse(buena), version: 99 }), /versión más nueva/],
    [JSON.stringify({ ...JSON.parse(buena), version: 'x' }), /versión de formato/],
    [JSON.stringify({ ...JSON.parse(buena), almacenes: null }), /no contiene datos/],
    [JSON.stringify({ ...JSON.parse(buena), almacenes: { 'de-la-1.5': { a: { t: 1, v: 1 } } } }), /no conoce/],
  ];
  for (const [texto, error] of malos) assert.throws(() => c.leerFicheroCopia(texto), error, texto.slice(0, 40));
  igual(JSON.stringify([...almacenamiento(B)]), antes, 'nada cambió');
  // partly damaged: the bad items are left out and counted, the good ones are imported
  const o = JSON.parse(buena) as { almacenes: Record<string, Record<string, unknown>> };
  o.almacenes.notas!.roto = { t: 'x' };
  o.almacenes.notas!.malo = { t: 5, v: { sinTexto: true } };
  o.almacenes.notas!.nulo = null;
  o.almacenes.desconocido = { a: { t: 1, v: 1 } };
  o.almacenes.marcadores = 'basura' as unknown as Record<string, unknown>;
  const l = c.leerFicheroCopia(JSON.stringify(o));
  igual(l.descartados, { notas: 3, marcadores: 1 });
  igual(l.desconocidos, ['desconocido']);
  reloj.ahora = T0 + H;
  await c.importar(l, 'unir');
  igual(textos(B), { b1: 'de B', n1: 'uno' });
});

caso('c12·4 · importar mientras una pasada está en curso: espera a que termine y nada se pierde', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const B = await nuevoDisp('B', almacenes());
  await nota(tab(B), T0, 'b1', 'de B');
  await pasada(B, repo, T0);
  const X = await nuevoDisp('X', almacenes());
  await nota(tab(X), T0, 'x1', 'de X');
  await actividad(tab(X), T0, 'paso', 2);
  const copia = await textoCopia(tab(X), T0);
  await nota(tab(A), T0 + M, 'a1', 'de A');
  // the import is asked for while A's run applies what it received (same tab: it waits for the run)
  let imp: Promise<unknown> | null = null;
  let antesDeAcabar = false;
  await pasada(A, repo, T0 + 2 * M, {
    durante: () => {
      imp = importarEn(tab(A), T0 + 2 * M, copia).then((r) => r);
      void Promise.resolve().then(() => (antesDeAcabar = true));
    },
  });
  assert.ok(antesDeAcabar);
  await imp;
  igual(textos(A), { a1: 'de A', b1: 'de B', x1: 'de X' });
  // a run asked for during an import waits for it too
  const A2 = await nuevaPestana(A);
  await nota(A2, T0 + 3 * M, 'a2', 'otra pestaña');
  const i2 = importarEn(tab(A), T0 + 3 * M, copia);
  const s2 = pasada(A, repo, T0 + 3 * M);
  await Promise.all([i2, s2]);
  // and in another tab (no lock between tabs in Node: the engine's «edited during the run» rule protects it)
  const i3 = importarEn(A2, T0 + 4 * M, copia, 'unir');
  await pasada(A, repo, T0 + 4 * M);
  await i3;
  await asentar([A, B], repo, T0 + H);
  for (const d of [A, B]) {
    igual(textos(d), { a1: 'de A', a2: 'otra pestaña', b1: 'de B', x1: 'de X' }, d.nombre);
    igual((await diaDe(tab(d), T0 + 2 * H))?.pasos, 2, `${d.nombre}: los 2 pasos de X, una vez`);
  }
});

caso('c12·5 · almacenamiento lleno al importar: o no se importa nada, o se informa del almacén que falló y lo demás llega bien', async () => {
  const repo = nuevoRepo();
  const X = await nuevoDisp('X', almacenes());
  await nota(tab(X), T0, 'x1', 'de X');
  reloj.ahora = T0;
  await tab(X).editar('marcadores', { m1: { label: 'm1', parte: 'cap01', t: T0 } });
  const copia = await textoCopia(tab(X), T0);
  const A = await nuevoDisp('A', almacenes());
  await nota(tab(A), T0 + M, 'a1', 'de A');
  // the marks cannot be stored: nothing is imported
  fallarEscritura(A, 'sinc-marcas');
  const antes = almacenamiento(A).get('g:notas');
  await assert.rejects(importarEn(tab(A), T0 + 2 * M, copia), /no se ha importado nada/);
  igual(almacenamiento(A).get('g:notas'), antes, 'notas intactas');
  fallarEscritura(A, 'sinc-marcas', false);
  // the notes cannot be stored: reported, left as they were; the bookmarks are imported
  fallarEscritura(A, 'g:notas');
  const r = await importarEn(tab(A), T0 + 3 * M, copia);
  igual(r.fallidos.map((f) => f.clave), ['notas']);
  igual(textos(A), { a1: 'de A' });
  igual(Object.keys(A.almacen('marcadores').valores), ['m1']);
  // a synchronisation meanwhile sends what is stored and nothing that is not
  await pasada(A, repo, T0 + 4 * M);
  igual(Object.keys(repo.vivos('notas')), ['a1']);
  fallarEscritura(A, 'g:notas', false);
  // importing again completes it; the run then converges
  const r2 = await importarEn(tab(A), T0 + 5 * M, copia);
  igual(r2.fallidos, []);
  igual(textos(A), { a1: 'de A', x1: 'de X' });
  const B = await nuevoDisp('B', almacenes());
  await asentar([A, B], repo, T0 + H);
  igual(textos(B), { a1: 'de A', x1: 'de X' });
  // «Sustituir todo» whose automatic backup cannot be stored: nothing is replaced
  fallarEscritura(B, 'copia-automatica');
  await assert.rejects(importarEn(tab(B), T0 + 2 * H, copia, 'sustituir'), /no se ha sustituido nada/);
  igual(textos(B), { a1: 'de A', x1: 'de X' });
});

caso('c12·6 · «Sustituir todo»: los datos pasan a ser los de la copia, también en los demás al sincronizar, y la copia automática los devuelve', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const B = await nuevoDisp('B', almacenes());
  await nota(tab(A), T0, 'n1', 'uno');
  await asentar([A, B], repo, T0);
  const copia = await textoCopia(tab(A), T0 + M);
  await nota(tab(A), T0 + H, 'n2', 'dos');
  await nota(tab(B), T0 + H, 'n1', 'uno editada');
  await actividad(tab(A), T0 + H, 'paso', 2);
  await asentar([A, B], repo, T0 + H);
  const r = await importarEn(tab(A), T0 + 2 * H, copia, 'sustituir');
  assert.ok(r.copiaAutomatica, 'copia automática hecha');
  igual(textos(A), { n1: 'uno' });
  await asentar([A, B], repo, T0 + 2 * H);
  igual(textos(B), { n1: 'uno' }, 'B también');
  // the automatic backup brings the replaced data back
  const auto = await (await tab(A).copia()).leerCopiaAutomatica();
  assert.ok(auto);
  await importarEn(tab(A), T0 + 3 * H, auto!.texto, 'sustituir');
  igual(textos(A), { n1: 'uno editada', n2: 'dos' });
  igual((await diaDe(tab(A), T0 + 3 * H))?.pasos, 2, 'el progreso diario vuelve');
  await asentar([A, B], repo, T0 + 3 * H);
  igual(textos(B), { n1: 'uno editada', n2: 'dos' });
});

caso('c12·7 · la copia lleva todos los almacenes y lápidas, y nunca el token ni lo propio del dispositivo', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  await nota(tab(A), T0, 'n1', 'uno');
  await nota(tab(A), T0, 'n2', 'dos');
  await asentar([A], repo, T0);
  await borrarNota(tab(A), T0 + M, 'n2');
  almacenamiento(A).set('sinc-ajustes', JSON.stringify({ repositorio: 'x/y', ruta: 'r.json', auto: true }));
  const texto = await textoCopia(tab(A), T0 + 2 * M);
  const o = JSON.parse(texto) as { formato: string; version: number; app: string; dispositivo: string; almacenes: Record<string, Record<string, { t: number; x?: 1 }>> };
  igual(o.formato, 'epa-copia-seguridad');
  igual(o.version, 1);
  igual(Object.keys(o.almacenes).sort(), ['marcadores', 'notas', 'progreso-diario']);
  assert.ok(o.almacenes.notas!.n2 && esLapida(o.almacenes.notas!.n2 as never), 'la lápida de n2 viaja');
  for (const prohibido of ['token', 'sinc-ajustes', 'dispositivo-local', 'credencial', 'x/y']) assert.ok(!texto.includes(prohibido), prohibido);
  // its deletion reaches a device that imports it
  const B = await nuevoDisp('B', almacenes());
  await asentar([A, B], repo, T0);
  await nota(tab(B), T0 + 3 * M, 'n3', 'tres');
  const C = await nuevoDisp('C', almacenes());
  await nota(tab(C), T0 + 4 * M, 'n2', 'dos (antigua de C)');
  reloj.ahora = T0 + 5 * M;
  const imp = await importarEn(tab(C), T0 + 5 * M, texto);
  igual(imp.fallidos, []);
  igual(Object.keys(textos(C)).sort(), ['n1', 'n2'], 'la nota de C es más nueva que la lápida y se queda');
});

// ================================================================== found by the randomized simulation (0.12)

caso('r12·1 · dos pestañas escriben a la vez: la escritura de una no pisa la de la otra (escritura condicionada: se vuelve a fusionar)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const A2 = await nuevaPestana(A);
  await nota(tab(A), T0, 'n0', 'antes');
  await (A2.guardados.get('notas') as unknown as { refrescar(): Promise<void> }).refrescar();
  // both tabs save a note of their own at the same moment (two read-merge-write steps in flight at once)
  reloj.ahora = T0 + M;
  await Promise.all([tab(A).editar('notas', { n1: { texto: 'pestaña 1', label: 'n1', t: T0 + M } }), A2.editar('notas', { n2: { texto: 'pestaña 2', label: 'n2', t: T0 + M } })]);
  // each tab then sees what the other stored (the storage event)
  for (const p of [tab(A), A2]) await (p.guardados.get('notas') as unknown as { refrescar(): Promise<void> }).refrescar();
  igual(Object.keys(A.almacen('notas').valores).sort(), ['n0', 'n1', 'n2'], 'almacenamiento');
  for (const p of [tab(A), A2]) igual(Object.keys(p.mem('notas')).sort(), ['n0', 'n1', 'n2'], 'memoria de cada pestaña');
  await asentar([A], repo, T0 + H);
  igual(Object.keys(repo.vivos('notas')).sort(), ['n0', 'n1', 'n2'], 'el fichero');
});

// ================================================================== review 0.12 (revision12a: findings 5 and 6)

caso('a12·4 · los registros de días pasados de este dispositivo se compactan en uno: el total no cambia en ningún dispositivo', async () => {
  const repo = nuevoRepo();
  const V = await nuevoDisp('V', [registro('progreso-diario', { tiempo: tiempoT })]);
  const A = await nuevoDisp('A', almacenes());
  const B = await nuevoDisp('B', almacenes());
  // three days ago: A studies in two tabs (two records; the second tab opened after the first stored the device id),
  // with an undo; B studies too
  const antes = T0 - 3 * DIA;
  const dia = claveDia(antes);
  await actividad(tab(A), antes, 'paso', 2);
  await new Promise((r) => setTimeout(r, 0));
  const A2 = await nuevaPestana(A);
  await actividad(A2, antes + M, 'paso', 3);
  await actividad(A2, antes + 2 * M, 'paso', -1);
  await actividad(tab(B), antes + 3 * M, 'paso', 1);
  await asentar([A, B, V], repo, antes + H);
  const total = async (p: Pestana, t: number) => (await diaDe(p, t, dia))?.pasos;
  igual(await total(tab(B), antes + H), 5);
  const registrosA = () => Object.keys(repo.vivos('progreso-diario')).filter((k) => k.startsWith(`${dia}@`) && k !== `${dia}@0`);
  igual(registrosA().length, 4, 'dos registros de A, su registro de deshechos y el de B');
  // today a new tab of A opens: it compacts A's records of that day into one (and its undo record into one)
  reloj.ahora = T0;
  const A3 = await nuevaPestana(A);
  await A3.diario!.guardadoDias.volcar();
  await asentar([A, B, V], repo, T0 + M);
  igual(registrosA().length, 3, 'A: un registro y uno de deshechos; B: el suyo');
  for (const [n, p] of [['A3', A3], ['B', tab(B)]] as const) igual(await total(p, T0 + H), 5, n);
  igual((V.almacen('progreso-diario').valores[dia] as { pasos: number }).pasos, 5, 'la 0.11 sigue viendo 5');
});

caso('a12·5 · una pestaña duplicada (sessionStorage copiado) toma otro identificador y no comparte registro', async () => {
  const g = globalThis as unknown as { sessionStorage?: unknown };
  const sesion = new Map<string, string>([['epa:pestana', 'abcd1234']]);
  g.sessionStorage = { getItem: (k: string) => sesion.get(k) ?? null, setItem: (k: string, v: string) => void sesion.set(k, v) };
  try {
    const A = await nuevoDisp('A', almacenes());
    await actividad(tab(A), T0, 'paso', 1);
    await new Promise((r) => setTimeout(r, 0));
    // the duplicate (same device id, now stored) starts with the same sessionStorage (the copy); real timers: it waits
    // ESPERA_PESTANA for the other tab's answer on the BroadcastChannel
    sesion.set('epa:pestana', 'abcd1234');
    tiempos.reales = true;
    const A2 = await nuevaPestana(A).finally(() => (tiempos.reales = false));
    await actividad(A2, T0 + 1, 'paso', 1);
    const ids = Object.keys(A2.diario!.itemsDias()).filter((k) => k.includes('@') && !k.endsWith('@0'));
    igual(ids.length, 2, `dos registros: ${ids}`);
    igual((await diaDe(A2, T0 + H))?.pasos, 2);
  } finally {
    delete g.sessionStorage;
  }
});

caso('a12·6 · si las marcas de una importación no se pueden guardar, una escritura posterior no las guarda', async () => {
  const X = await nuevoDisp('X', almacenes());
  await nota(tab(X), T0, 'x1', 'de X');
  const copia = await textoCopia(tab(X), T0);
  const A = await nuevoDisp('A', almacenes());
  await nota(tab(A), T0 + M, 'a1', 'de A');
  fallarEscritura(A, 'sinc-marcas');
  await assert.rejects(importarEn(tab(A), T0 + 2 * M, copia), /no se ha importado nada/);
  fallarEscritura(A, 'sinc-marcas', false);
  // a later edit writes the marks: the import's must not be among them (nothing was imported)
  await nota(tab(A), T0 + 3 * M, 'a2', 'otra de A');
  const marcas = A.marcas as { cambios?: Record<string, Record<string, number>> };
  igual(Object.keys(marcas.cambios?.notas ?? {}).sort(), ['a1', 'a2']);
  igual(textos(A), { a1: 'de A', a2: 'otra de A' });
});

// ================================================================== review 0.12b (findings 2, 4, 6; trial 9138)

const marcasNotas = (d: Disp) => Object.keys((d.marcas as { cambios?: Record<string, Record<string, number>> }).cambios?.notas ?? {}).sort();

caso('b12·1 · una marca que la escritura desfasada de otra pestaña pierde se vuelve a poner: el cambio llega a los demás', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const B = await nuevoDisp('B', almacenes());
  await nota(tab(A), T0, 'x1', 'v1');
  await asentar([A, B], repo, T0 + M);
  igual(textos(B), { x1: 'v1' });
  // A changes x1; a stale tab of A (its cached view of localStorage lagged) then writes sinc-marcas without that mark
  const antes = almacenamiento(A).get('sinc-marcas');
  await nota(tab(A), T0 + H, 'x1', 'v2');
  assert.ok(marcasNotas(A).includes('x1'), 'la marca del cambio');
  if (antes === undefined) almacenamiento(A).delete('sinc-marcas');
  else almacenamiento(A).set('sinc-marcas', antes);
  // the next write of A's tab checks the marks it stored and puts back the lost one
  await nota(tab(A), T0 + H + M, 'x2', 'otra');
  igual(marcasNotas(A), ['x1', 'x2'], 'la marca perdida, de nuevo guardada');
  await asentar([A, B], repo, T0 + 2 * H);
  igual(textos(B), { x1: 'v2', x2: 'otra' }, 'B recibe el cambio de A');
  igual(textos(A), { x1: 'v2', x2: 'otra' }, 'A conserva su cambio');
  // forgotten by the runs (recorded at or after the marks): never put back by a later write
  await nota(tab(A), T0 + 3 * H, 'x3', 'tercera');
  igual(marcasNotas(A), ['x3'], 'solo la marca nueva');
});

caso('b12·2 · una marca de otra pestaña olvidada por una pasada sin registro posterior (valor vuelto al sincronizado) no se repone en cada escritura', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const A2 = await nuevaPestana(A);
  await nota(tab(A), T0, 'x1', 'v1');
  await asentar([A], repo, T0 + M);
  await (A2.guardados.get('notas') as unknown as { refrescar(): Promise<void> }).refrescar();
  // in tab 2, a change and its undo: the item is as recorded (no newer record), the mark not newer than the next
  // run's start — the run, in tab 1, forgets it (tab 2 remembers it stored it)
  const t1 = T0 + H;
  reloj.ahora = t1;
  await A2.editar('notas', { x1: { texto: 'v2', label: 'x1', t: T0 } });
  reloj.ahora = t1 + 1000;
  await A2.editar('notas', { x1: { texto: 'v1', label: 'x1', t: T0 } });
  assert.ok(marcasNotas(A).includes('x1'));
  // the run right after (the mark stored < HOLGURA_MIAS before it: put back at most once), then later ones
  for (const t of [t1 + 1500, t1 + 10_000, t1 + M]) {
    await pasada(A, repo, t, { pestana: tab(A) });
    await nota(A2, t + 100, 'z', `z ${t}`);
  }
  for (let i = 0; i < 3; i++) await nota(A2, T0 + 2 * H + i * M, `y${i}`, 'nueva');
  igual(marcasNotas(A), ['y0', 'y1', 'y2', 'z'], 'la marca olvidada no vuelve');
  const c = repo.commits;
  await asentar([A], repo, T0 + 3 * H);
  assert.ok(repo.commits - c <= 1, 'los commits paran');
  igual(textos(A).x1, 'v1');
});

caso('b12·3 · con el reloj atrasado, el cambio nuevo lleva una marca posterior a la del anterior y gana', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const B = await nuevoDisp('B', almacenes());
  await nota(tab(A), T0, 'x1', 'v1');
  await asentar([A, B], repo, T0 + M);
  await nota(tab(A), T0 + H, 'x1', 'v2');
  // the clock goes back ten minutes (an NTP correction, a manual change): the reader changes x1 again
  await nota(tab(A), T0 + H - 10 * M, 'x1', 'v3');
  const m = A.marcas as { cambios: Record<string, Record<string, number>> };
  assert.ok(m.cambios.notas!.x1! > T0 + H, `marca posterior a la anterior (${m.cambios.notas!.x1! - (T0 + H)} ms)`);
  await asentar([A, B], repo, T0 + H - 9 * M);
  igual(textos(A), { x1: 'v3' }, 'A');
  igual(textos(B), { x1: 'v3' }, 'B');
});

caso('b12·4 · prueba 9138 del azar (reloj atrasado: la marca nueva se perdía y un paso no contaba)', async () => {
  const { simularPrueba } = await import('./azar.ts');
  const r = await simularPrueba(9138);
  igual(r.problemas, []);
});

caso('b12·5 · si no se puede anotar lo aplicado (sinc-aplicados, cuota llena), se aplica igual: nada se bloquea ni se pierde, y la otra pestaña que conservó lo suyo converge en la siguiente pasada (revisión 12c)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const A2 = await nuevaPestana(A);
  const B = await nuevoDisp('B', almacenes());
  await nota(A2, T0, 'x1', 'v1');
  await asentar([A, B], repo, T0 + M);
  // tab 2 of A changes x1 (its own change, stored and sent), then B changes it later
  await nota(A2, T0 + 10 * M, 'x1', 'de A2');
  await asentar([A, B], repo, T0 + 20 * M);
  await nota(tab(B), T0 + H, 'x1', 'de B');
  await nota(tab(B), T0 + H, 'b1', 'nueva de B');
  await pasada(B, repo, T0 + H + M);
  await nota(tab(A), T0 + H + 2 * M, 'a1', 'nueva de A');
  // the quota is full for sinc-aplicados: the run in tab 1 applies anyway (before, the store was never applied)
  fallarEscritura(A, 'sinc-aplicados');
  await pasada(A, repo, T0 + H + 3 * M, { pestana: tab(A) });
  igual(textos(A), { x1: 'de B', a1: 'nueva de A', b1: 'nueva de B' }, 'aplicado sin la anotación');
  igual((repo.vivos('notas').a1 as { texto: string }).texto, 'nueva de A', 'lo de A se envía');
  // tab 2, without the evidence, keeps its own change and writes it back; the next run applies B's again
  reloj.ahora = T0 + H + 4 * M;
  await refrescarG(A2, 'notas').refrescar();
  await refrescarG(A2, 'notas').volcar();
  fallarEscritura(A, 'sinc-aplicados', false);
  await asentar([A, B], repo, T0 + 2 * H);
  for (const p of [tab(A), A2]) await refrescarG(p, 'notas').refrescar();
  igual(textos(A), { x1: 'de B', a1: 'nueva de A', b1: 'nueva de B' }, 'A');
  igual(textos(B), { x1: 'de B', a1: 'nueva de A', b1: 'nueva de B' }, 'B');
  igual((A2.mem('notas').x1 as { texto: string }).texto, 'de B', 'la pestaña 2 también');
});

caso('b12·14 · sinc-aplicados casi sin sitio: una anotación para todo el almacén basta, y la otra pestaña acepta lo aplicado (revisión 12c)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const A2 = await nuevaPestana(A);
  const B = await nuevoDisp('B', almacenes());
  await nota(A2, T0, 'x1', 'v1');
  await asentar([A, B], repo, T0 + M);
  await nota(A2, T0 + 10 * M, 'x1', 'de A2');
  await asentar([A, B], repo, T0 + 20 * M);
  for (let i = 0; i < 6; i++) await nota(tab(B), T0 + H + i, `b${i}`, `nueva ${i} de B`);
  await nota(tab(B), T0 + H + 10, 'x1', 'de B');
  await pasada(B, repo, T0 + H + M);
  // room for one entry for the whole store, not for one per item
  limitarEscritura(A, 'sinc-aplicados', 120);
  await pasada(A, repo, T0 + H + 3 * M, { pestana: tab(A) });
  limitarEscritura(A, 'sinc-aplicados', undefined);
  const ap = JSON.parse(almacenamiento(A).get('sinc-aplicados') ?? '{}') as Record<string, Record<string, unknown>>;
  igual(Object.keys(ap.notas ?? {}), ['*'], 'una anotación para el almacén');
  igual((textos(A) as Record<string, string>).x1, 'de B');
  // tab 2 takes B's version (the store was applied after its change): nothing written back
  const ls = almacenamiento(A);
  let escrituras = 0;
  const set = ls.set.bind(ls);
  ls.set = (k: string, v: string) => {
    if (k === 'g:notas') escrituras++;
    return set(k, v);
  };
  try {
    reloj.ahora = T0 + H + 4 * M;
    await refrescarG(A2, 'notas').refrescar();
    await refrescarG(A2, 'notas').volcar();
  } finally {
    ls.set = set;
  }
  igual((A2.mem('notas').x1 as { texto: string }).texto, 'de B', 'la pestaña 2 acepta lo aplicado');
  igual(escrituras, 0, 'sin reescribir lo suyo');
});

const refrescarG = (p: Pestana, clave: string) =>
  (clave === 'progreso-diario' ? p.diario!.guardadoDias : p.guardados.get(clave)!) as unknown as { refrescar(): Promise<void>; volcar(): Promise<void>; medidas: { treguas: number } };

caso('b12·6 · sin carrera: la pestaña 2 crea y borra un elemento, la 1 lo vuelve a crear igual — se queda, y nadie lo reescribe en bucle', async () => {
  const A = await nuevoDisp('A', almacenes());
  const A2 = await nuevaPestana(A);
  const V = { texto: 'favorita', label: 'f1', t: T0 };
  for (const p of [tab(A), A2]) await refrescarG(p, 'notas').refrescar();
  reloj.ahora = T0 + M;
  await A2.editar('notas', { f1: V });
  await refrescarG(tab(A), 'notas').refrescar();
  reloj.ahora = T0 + 2 * M;
  await A2.editar('notas', {}, ['f1']);
  await refrescarG(tab(A), 'notas').refrescar();
  igual(textos(A), {});
  // tab 1 creates it again with the same value (its mark is for a value tab 2 once wrote: still a real change)
  reloj.ahora = T0 + 3 * M;
  await tab(A).editar('notas', { f1: V });
  // each tab answers the other's writes (the storage event) for a while
  const ls = almacenamiento(A);
  // (the writes of the key, counted: a loop leaves the same text at the end of every round)
  let escrituras = 0;
  const set = ls.set.bind(ls);
  ls.set = (k: string, v: string) => {
    if (k === 'g:notas') escrituras++;
    return set(k, v);
  };
  for (let i = 0; i < 12; i++) {
    reloj.ahora = T0 + 3 * M + (i + 1) * 100;
    for (const p of [A2, tab(A)]) {
      await refrescarG(p, 'notas').refrescar();
      await refrescarG(p, 'notas').volcar();
    }
  }
  ls.set = set;
  igual(textos(A), { f1: 'favorita' }, 'la nota vuelta a crear se queda');
  assert.ok(escrituras <= 2, `las pestañas dejan de reescribirla (${escrituras} escrituras en 12 rondas)`);
  for (const p of [tab(A), A2]) igual(refrescarG(p, 'notas').medidas.treguas, 0, 'sin necesitar la tregua');
});

caso('b12·7 · una copia desfasada del registro propio y luego una al día: el registro no cuenta de más (la base no pasa a la copia desfasada)', async () => {
  const A = await nuevoDisp('A', almacenes());
  const ls = almacenamiento(A);
  await actividad(tab(A), T0, 'paso', 1);
  const s1 = ls.get('progreso-diario')!;
  await actividad(tab(A), T0 + M, 'paso', 1);
  const s2 = ls.get('progreso-diario')!;
  const v2 = JSON.parse(s2) as Record<string, { t: number }>;
  const s2y = JSON.stringify({ ...v2, [`${HOY}@otra-y`]: { pasos: 1, preguntas: 0, secciones: 0, cumplido: false, t: T0 + 2 * M } });
  // another tab (stale: this tab's record at 1) writes; this tab refreshes, and the reader takes a step meanwhile
  reloj.ahora = T0 + 2 * M;
  ls.set('progreso-diario', s1);
  const r = refrescarG(tab(A), 'progreso-diario').refrescar();
  tab(A).diario!.registrarActividad('paso', 1);
  await r;
  // then a third tab, up to date, writes (its record added to what this tab had stored)
  ls.set('progreso-diario', s2y);
  await refrescarG(tab(A), 'progreso-diario').refrescar();
  await tab(A).diario!.guardadoDias.volcar();
  await refrescarG(tab(A), 'progreso-diario').refrescar();
  const items = tab(A).diario!.itemsDias() as Record<string, { pasos: number }>;
  const propio = Object.entries(items).find(([k]) => k.startsWith(`${HOY}@`) && !k.endsWith('@otra-y'))!;
  igual(propio[1].pasos, 3, 'pasos de esta pestaña');
  igual((await diaDe(tab(A), T0 + H))?.pasos, 4, '3 de esta pestaña + 1 de la otra');
  igual((JSON.parse(ls.get('progreso-diario')!) as Record<string, { pasos: number }>)[propio[0]]!.pasos, 3, 'lo guardado');
});

caso('b12·8 · freno de bucles: dos pestañas que se reescriben sin fin un elemento se frenan solas (tregua, con aviso) sin perder nada', async () => {
  const A = await nuevoDisp('A', almacenes());
  const A2 = await nuevaPestana(A);
  for (const p of [tab(A), A2]) await refrescarG(p, 'notas').refrescar();
  // evidence never found, and the merge never takes the other's (as a rule that cannot tell): without the guard each
  // tab keeps writing its own back
  for (const p of [tab(A), A2]) {
    const g = refrescarG(p, 'notas') as unknown as { atestiguado: () => boolean; ganaElOtro: () => boolean };
    g.atestiguado = () => false;
    g.ganaElOtro = () => false;
  }
  reloj.ahora = T0 + M;
  await A2.editar('notas', { f1: { texto: 'de la 2', label: 'f1', t: T0 + M } });
  reloj.ahora = T0 + M + 10;
  await tab(A).editar('notas', { f1: { texto: 'de la 1', label: 'f1', t: T0 + M } });
  const ls = almacenamiento(A);
  const escrituras: number[] = [];
  const set = ls.set.bind(ls);
  let ronda = 0;
  ls.set = (k: string, v: string) => {
    if (k === 'g:notas') escrituras.push(ronda);
    return set(k, v);
  };
  const avisos: string[] = [];
  const warn = console.warn;
  console.warn = (...x: unknown[]) => void avisos.push(x.join(' '));
  // each tab answers the other's writes (the storage event), in real time: 50 rounds of 100 ms
  tiempos.reales = true;
  try {
    for (ronda = 0; ronda < 50; ronda++) {
      reloj.ahora = T0 + 2 * M + ronda * 100;
      for (const p of [A2, tab(A)]) await refrescarG(p, 'notas').refrescar();
      await new Promise((r) => setTimeout(r, 100));
    }
  } finally {
    tiempos.reales = false;
    ls.set = set;
    console.warn = warn;
  }
  const tarde = escrituras.filter((r) => r >= 20).length;
  assert.ok(escrituras.length > 8, `el bucle empieza (${escrituras.length} escrituras)`);
  // in the truce (RETRASO_TREGUA = 3 s): at most one write back per tab per 3 s — 3 s of the last 30 rounds: ≤ 2 each
  assert.ok(tarde <= 4, `frenado: ${tarde} escrituras en los últimos 3 s (${escrituras.join(',')})`);
  assert.ok(avisos.some((x) => x.includes('written back at most every')), `con aviso (${avisos.join(' | ')})`);
  // nothing taken from the other writer: each tab still holds its own value, still due (a flush writes it)
  igual((tab(A).mem('notas').f1 as { texto: string }).texto, 'de la 1', 'pestaña 1');
  igual((A2.mem('notas').f1 as { texto: string }).texto, 'de la 2', 'pestaña 2');
  assert.ok(['de la 1', 'de la 2'].includes(textos(A).f1!), 'lo guardado');
  await refrescarG(A2, 'notas').volcar();
  igual(textos(A).f1, 'de la 2', 'el volcado de la pestaña 2 escribe su cambio, aunque esté en tregua');
});

caso('b12·9 · un dispositivo que vuelve tras más de 90 días sin sincronizar no trae de vuelta los registros que otro compactó', async () => {
  const repo = nuevoRepo();
  const V = await nuevoDisp('V', [registro('progreso-diario', { tiempo: tiempoT })]);
  const A = await nuevoDisp('A', almacenes());
  const B = await nuevoDisp('B', almacenes());
  const antes = T0 - 3 * DIA;
  const dia = claveDia(antes);
  await actividad(tab(A), antes, 'paso', 2);
  await new Promise((r) => setTimeout(r, 0));
  const A2 = await nuevaPestana(A);
  await actividad(A2, antes + M, 'paso', 3);
  await actividad(A2, antes + 2 * M, 'paso', -1);
  await actividad(tab(B), antes + 3 * M, 'paso', 1);
  await asentar([A, B, V], repo, antes + H);
  const registros = () => Object.keys(repo.vivos('progreso-diario')).filter((k) => k.startsWith(`${dia}@`) && k !== `${dia}@0`).sort();
  const viejos = registros();
  // B goes offline; A compacts its records of that day and keeps synchronising for 100 days (the tombstones of the
  // compacted records are pruned from the file)
  reloj.ahora = T0;
  const A3 = await nuevaPestana(A);
  await A3.diario!.guardadoDias.volcar();
  await asentar([A, V], repo, T0 + M);
  const compactados = registros();
  for (let d = 10; d <= 100; d += 10) await pasada(A, repo, T0 + d * DIA, { pestana: A3 });
  assert.ok(repo.doc!.podado > T0, 'lápidas podadas');
  igual(Object.keys(repo.doc!.almacenes['progreso-diario'] ?? {}).filter((k) => viejos.includes(k) && !compactados.includes(k)), [], 'sin lápidas de los compactados');
  // B comes back: its unchanged copies of A's old records are older than the file's prune horizon — dropped
  await asentar([A, B, V], repo, T0 + 101 * DIA);
  igual(registros(), compactados, 'los registros compactados no vuelven al fichero');
  const total = async (p: Pestana, t: number) => (await diaDe(p, t, dia))?.pasos;
  for (const [n, p] of [['A3', A3], ['B', tab(B)]] as const) igual(await total(p, T0 + 102 * DIA), 5, n);
  igual((V.almacen('progreso-diario').valores[dia] as { pasos: number }).pasos, 5, 'la 0.11 sigue viendo 5');
});

caso('b12·10 · un cambio que la escritura une con el de otra pestaña (unión) lleva la marca de lo guardado: la pasada lo envía (prueba 9301)', async () => {
  type Conj = { s: string[] };
  const unir = (a: unknown, b: unknown): Conj => ({ s: [...new Set([...(a as Conj).s, ...(b as Conj).s])].sort() });
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [guardado('conj', { unir })]);
  const A2 = await nuevaPestana(A);
  const B = await nuevoDisp('B', [guardado('conj', { unir })]);
  // tab 1 adds A1; tab 2, which has not seen it, adds A2: its write unites both — {A1, A2} is stored, the mark was for
  // {A2} (the memory of tab 2) before 0.12b
  reloj.ahora = T0;
  await tab(A).editar('conj', { c1: { s: ['A1'] } });
  reloj.ahora = T0 + M;
  await A2.editar('conj', { c1: { s: ['A2'] } });
  igual(A.almacen('conj').valores.c1, { s: ['A1', 'A2'] }, 'lo guardado');
  await asentar([A, B], repo, T0 + H);
  igual(repo.vivos('conj').c1, { s: ['A1', 'A2'] }, 'el fichero');
  // again: a third tab stores X9 (without a mark: it does not matter here), and tab 1, which has not seen it, adds A3:
  // united with what is stored
  reloj.ahora = T0 + 2 * H;
  almacenamiento(A).set('g:conj', JSON.stringify({ c1: { s: ['A1', 'A2', 'X9'] } }));
  await tab(A).editar('conj', { c1: { s: ['A1', 'A2', 'A3'] } });
  igual(A.almacen('conj').valores.c1, { s: ['A1', 'A2', 'A3', 'X9'] }, 'lo guardado');
  await asentar([A, B], repo, T0 + 3 * H);
  assert.ok((repo.vivos('conj').c1 as Conj).s.includes('A3'), `el fichero tiene A3: ${JSON.stringify(repo.vivos('conj').c1)}`);
  for (const [n, d] of [['A', A], ['B', B]] as const) assert.ok((d.almacen('conj').valores.c1 as Conj).s.includes('A3'), n);
});

caso('b12·11 · un cambio y un borrado del mismo elemento en el mismo milisegundo: la marca del cambio no se repone sobre la del borrado (prueba 557)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [registro('crudo', { tiempo: tiempoT })]);
  const B = await nuevoDisp('B', [registro('crudo', { tiempo: tiempoT })]);
  const crudo = (d: Disp) => d.almacen('crudo').valores;
  reloj.ahora = T0;
  crudo(A).k0 = { op: 'a', t: T0 };
  A.motor.anotarCambio('crudo', 'k0', T0);
  await asentar([A, B], repo, T0 + M);
  igual(crudo(B).k0, { op: 'a', t: T0 });
  // a module without Guardado changes the item and deletes it at the same millisecond (two quick clicks)
  const t = T0 + H;
  reloj.ahora = t;
  crudo(A).k0 = { op: 'b', t };
  A.motor.anotarCambio('crudo', 'k0', t);
  delete crudo(A).k0;
  A.motor.anotarBorrado('crudo', 'k0', t);
  await new Promise((r) => setTimeout(r, 0));
  // any later write of the marks (here a run's) must not put the change back over the deletion
  await asentar([A, B], repo, t + M);
  igual(repo.vivos('crudo').k0, undefined, 'borrado en el fichero');
  igual(crudo(B).k0, undefined, 'borrado en B');
  igual(crudo(A).k0, undefined, 'sigue borrado en A');
});

caso('b12·12 · en tregua, una copia desfasada encima y una pasada de otra pestaña que olvida la marca: el volcado al cerrar escribe el cambio y llega al fichero (revisión 12c)', async () => {
  const repo = nuevoRepo();
  // a store without a time of its own (only the marks say which version is newer)
  const A = await nuevoDisp('A', [guardado('sin')]);
  const A2 = await nuevaPestana(A);
  const B = await nuevoDisp('B', [guardado('sin')]);
  const valores = (d: Disp) => d.almacen('sin').valores;
  reloj.ahora = T0;
  await tab(A).editar('sin', { x: { v: 'v1' } });
  await asentar([A, B], repo, T0 + M);
  for (const p of [tab(A), A2]) await refrescarG(p, 'sin').refrescar();
  const ls = almacenamiento(A);
  const viejo = ls.get('g:sin')!;
  reloj.ahora = T0 + H;
  await tab(A).editar('sin', { x: { v: 'v2' } });
  // the item is in a truce of the loop guard in tab 1 (as after a burst), and a stale tab writes its old copy
  (refrescarG(tab(A), 'sin') as unknown as { treguas: Map<string, number> }).treguas.set('x', Date.now() + 10_000);
  ls.set('g:sin', viejo);
  reloj.ahora = T0 + H + 1000;
  await refrescarG(tab(A), 'sin').refrescar();
  igual((tab(A).mem('sin').x as { v: string }).v, 'v2', 'la pestaña 1 conserva su cambio');
  igual((valores(A).x as { v: string }).v, 'v1', 'en tregua no lo reescribe enseguida');
  // a run in tab 2 sees only the stale copy, and forgets the marks it saw
  await refrescarG(A2, 'sin').refrescar();
  await pasada(A, repo, T0 + H + 5000, { pestana: A2 });
  igual((A.marcas as { cambios?: Record<string, Record<string, number>> }).cambios?.sin?.x, undefined, 'la pasada olvidó la marca');
  // the reader closes tab 1 right then: its flush writes the kept change (marked again)
  reloj.ahora = T0 + H + 6000;
  await refrescarG(tab(A), 'sin').volcar();
  igual((valores(A).x as { v: string }).v, 'v2', 'el volcado lo escribe');
  await asentar([A, B], repo, T0 + 2 * H);
  igual((repo.vivos('sin').x as { v: string }).v, 'v2', 'el fichero');
  igual((valores(B).x as { v: string }).v, 'v2', 'B');
  igual((valores(A).x as { v: string }).v, 'v2', 'A');
});

caso('b12·13 · dos pestañas suman a la vez: el espejo del día guardado es la suma de los registros, sin escrituras de más, y la 0.11 la ve entera (revisión 12c)', async () => {
  const repo = nuevoRepo();
  const V = await nuevoDisp('V', [registro('progreso-diario', { tiempo: tiempoT })]);
  const A = await nuevoDisp('A', almacenes());
  const A2 = await nuevaPestana(A);
  await actividad(tab(A), T0, 'paso', 1);
  await refrescarG(A2, 'progreso-diario').refrescar();
  const ls = almacenamiento(A);
  let escrituras = 0;
  const set = ls.set.bind(ls);
  ls.set = (k: string, v: string) => {
    if (k === 'progreso-diario') escrituras++;
    return set(k, v);
  };
  try {
    // both count before seeing the other's count; the second write merges the first's
    reloj.ahora = T0 + M;
    tab(A).diario!.registrarActividad('paso', 1);
    reloj.ahora = T0 + M + 1;
    A2.diario!.registrarActividad('paso', 2);
    await tab(A).diario!.guardadoDias.volcar();
    await A2.diario!.guardadoDias.volcar();
    igual(escrituras, 2, 'una escritura por pestaña');
    // each tab then sees the other's write (the storage event): nothing more to write
    for (const p of [tab(A), A2]) {
      await refrescarG(p, 'progreso-diario').refrescar();
      await refrescarG(p, 'progreso-diario').volcar();
    }
    await new Promise((r) => setTimeout(r, 0));
    igual(escrituras, 2, 'ninguna escritura más');
  } finally {
    ls.set = set;
  }
  const v = JSON.parse(ls.get('progreso-diario')!) as Record<string, { pasos: number }>;
  const suma = Object.entries(v).filter(([k]) => k.startsWith(`${HOY}@`)).reduce((n, [k, r]) => n + (k.endsWith('~') ? -r.pasos : r.pasos), 0);
  igual(suma, 4, 'los registros');
  igual(v[HOY]!.pasos, 4, 'el espejo guardado (lo que leen la 0.10 y la 0.11)');
  await asentar([A, V], repo, T0 + H);
  igual((V.almacen('progreso-diario').valores[HOY] as { pasos: number }).pasos, 4, 'la 0.11 ve los 4');
});

caso('b12·15 · tras importar («Sustituir todo»), la copia desfasada que otra pestaña escribe encima no gana: ni vuelve lo borrado ni retrocede lo cambiado (revisión 12d)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const B = await nuevoDisp('B', almacenes());
  await nota(tab(A), T0, 'x1', 'v1');
  const copia = await textoCopia(tab(A), T0 + M);
  await nota(tab(A), T0 + H, 'x1', 'v2');
  await nota(tab(A), T0 + H, 'x2', 'otra');
  await asentar([A, B], repo, T0 + H + M);
  const ls = almacenamiento(A);
  const antes = ls.get('g:notas')!;
  await importarEn(tab(A), T0 + 2 * H, copia, 'sustituir');
  igual(textos(A), { x1: 'v1' }, 'importado');
  // another tab of A, whose cached view lagged, writes the key as it was before the import
  ls.set('g:notas', antes);
  reloj.ahora = T0 + 2 * H + 1000;
  await refrescarG(tab(A), 'notas').refrescar();
  await refrescarG(tab(A), 'notas').volcar();
  igual(textos(A), { x1: 'v1' }, 'la copia desfasada no gana');
  await asentar([A, B], repo, T0 + 3 * H);
  igual(textos(B), { x1: 'v1' }, 'B');
  igual(textos(A), { x1: 'v1' }, 'A');
});

caso('b12·16 · tras aplicar una sincronización, la copia desfasada de otra pestaña no gana, y un cambio real posterior de esa pestaña sí (revisión 12d)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const A2 = await nuevaPestana(A);
  const B = await nuevoDisp('B', almacenes());
  await nota(tab(A), T0, 'x1', 'v1');
  await nota(tab(A), T0, 'x2', 'otra');
  await asentar([A, B], repo, T0 + M);
  await borrarNota(tab(B), T0 + H, 'x2');
  await nota(tab(B), T0 + H, 'x1', 'de B');
  await pasada(B, repo, T0 + H + M);
  const ls = almacenamiento(A);
  const antes = ls.get('g:notas')!;
  await pasada(A, repo, T0 + H + 2 * M, { pestana: tab(A) });
  igual(textos(A), { x1: 'de B' }, 'aplicado');
  // a stale tab writes the key as it was before the run
  ls.set('g:notas', antes);
  reloj.ahora = T0 + H + 3 * M;
  await refrescarG(tab(A), 'notas').refrescar();
  await refrescarG(tab(A), 'notas').volcar();
  igual(textos(A), { x1: 'de B' }, 'la copia desfasada no gana');
  // tab 2, up to date, then changes x1 for real: that change is taken
  await refrescarG(A2, 'notas').refrescar();
  await nota(A2, T0 + H + 4 * M, 'x1', 'de A2, después');
  await refrescarG(tab(A), 'notas').refrescar();
  igual((tab(A).mem('notas').x1 as { texto: string }).texto, 'de A2, después', 'el cambio real posterior');
  await asentar([A, B], repo, T0 + 2 * H);
  igual(textos(B), { x1: 'de A2, después' }, 'B');
});

caso('b12·17 · la anotación «*» de sinc-aplicados no hace ganar una copia desfasada sobre un cambio de otra pestaña hecho durante la pasada (revisión 12d)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', almacenes());
  const A2 = await nuevaPestana(A);
  const B = await nuevoDisp('B', almacenes());
  await nota(tab(A), T0, 'x1', 'v1');
  await nota(tab(A), T0, 'y', 'y1');
  await asentar([A, B], repo, T0 + M);
  await refrescarG(A2, 'notas').refrescar();
  for (const id of ['x1', 'x2', 'x3']) await nota(tab(B), T0 + H, id, `${id} de B`);
  await pasada(B, repo, T0 + H + M);
  const ls = almacenamiento(A);
  const antes = ls.get('g:notas')!;
  // only one entry for the whole store fits; tab 2 changes y while the run in tab 1 goes on (after its read)
  limitarEscritura(A, 'sinc-aplicados', 60);
  await pasada(A, repo, T0 + H + 2 * M, {
    pestana: tab(A),
    durante: () => {
      reloj.ahora += 1000;
      // (its change marked at this time; the run's application comes later, at a later time)
      void A2.editar('notas', { y: { texto: 'y de la pestaña 2', label: 'y', t: reloj.ahora } }).then(() => (reloj.ahora += 1000));
    },
  });
  limitarEscritura(A, 'sinc-aplicados', undefined);
  await new Promise((r) => setTimeout(r, 0));
  await refrescarG(A2, 'notas').volcar();
  igual(Object.keys((JSON.parse(ls.get('sinc-aplicados') ?? '{}') as Record<string, object>).notas ?? {}), ['*'], 'una anotación para el almacén');
  // the entry is dated when the run read the store, before tab 2's change: no evidence against that change
  const todo = (JSON.parse(ls.get('sinc-aplicados')!) as Record<string, Record<string, [string, number]>>).notas!['*']!;
  const propio = (refrescarG(A2, 'notas') as unknown as { propios: Map<string, [string, number]> }).propios.get('y')!;
  assert.ok(todo[1] < propio[1], `«*» (${todo[1]}) anterior al cambio de la pestaña 2 (${propio[1]})`);
  // a stale tab writes the key as before the run: y's change in tab 2 must not lose to it
  const v = JSON.parse(antes) as Record<string, unknown>;
  ls.set('g:notas', JSON.stringify(v));
  reloj.ahora += 1000;
  await refrescarG(A2, 'notas').refrescar();
  await refrescarG(A2, 'notas').volcar();
  igual((A2.mem('notas').y as { texto: string }).texto, 'y de la pestaña 2', 'el cambio de la pestaña 2');
  igual((textos(A) as Record<string, string>).y, 'y de la pestaña 2', 'guardado');
});

// ================================================================== review 0.12f: the REAL repaso module

const repasoReal = (): Almacen[] => [
  { repaso: true, clave: 'repaso-diario' },
  { repaso: true, clave: 'repaso-tarjetas' },
];
const diaRepaso = (d: Disp, dia: string) => (d.almacen('repaso-diario').valores[dia] ?? null) as { r: number; n: number; b: number; dr?: number; dn?: number; db?: number } | null;

caso('b12·18 · «Reiniciar tarjetas» (módulo real) y volver a repasar el mismo día: las cuentas de hoy empiezan del reinicio en todos los dispositivos (revisión 12e·3 con el módulo)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', repasoReal());
  const B = await nuevoDisp('B', repasoReal());
  const R = tab(A).repaso!;
  reloj.ahora = T0;
  for (let i = 0; i < 3; i++) R.calificar(`t${i}`, 3, T0 + i);
  for (const g of Object.values(R.guardadosRepaso)) await g.volcar();
  await asentar([A, B], repo, T0 + M);
  igual(R.efectivo(diaRepaso(B, HOY)).r, 3, 'B ve las 3');
  reloj.ahora = T0 + 2 * M;
  R.reiniciarTarjetas(T0 + 2 * M);
  reloj.ahora = T0 + 3 * M;
  R.calificar('t9', 3, T0 + 3 * M);
  for (const g of Object.values(R.guardadosRepaso)) await g.volcar();
  await asentar([A, B], repo, T0 + H);
  for (const [n, d] of [['A', A], ['B', B]] as const) {
    const e = R.efectivo(diaRepaso(d, HOY));
    igual([e.r, e.n, e.b], [1, 1, 1], `${n}: hoy cuenta desde el reinicio`);
  }
  reloj.ahora = T0 + H;
  igual(R.nuevasHoy(T0 + H), 1, 'nuevas de hoy: 1 (el límite diario)');
  igual(Object.keys(A.almacen('repaso-tarjetas').valores), ['t9'], 'las tarjetas, reiniciadas');
});

caso('b12·19 · «Deshacer» en una pestaña después de «Reiniciar tarjetas» en otra: no deja el día a menos de cero ni resucita la tarjeta (revisión 12f·3)', async () => {
  const A = await nuevoDisp('A', repasoReal());
  const A2 = await nuevaPestana(A);
  const R1 = tab(A).repaso!;
  const R2 = A2.repaso!;
  reloj.ahora = T0;
  for (let i = 0; i < 3; i++) R1.calificar(`t${i}`, 3, T0 + i);
  // (t3 answered twice: the undo of the second would restore the state the first left)
  R1.calificar('t3', 3, T0 + 5);
  const ultima = R1.calificar('t3', 3, T0 + 10);
  for (const g of Object.values(R1.guardadosRepaso)) await g.volcar();
  for (const g of Object.values(R2.guardadosRepaso)) await g.refrescar();
  // tab 2 resets the cards; tab 1 sees it (the storage event), then the reader presses «Deshacer» there
  reloj.ahora = T0 + M;
  R2.reiniciarTarjetas(T0 + M);
  for (const g of Object.values(R2.guardadosRepaso)) await g.volcar();
  for (const g of Object.values(R1.guardadosRepaso)) await g.refrescar();
  reloj.ahora = T0 + 2 * M;
  R1.deshacer(ultima);
  for (const g of Object.values(R1.guardadosRepaso)) await g.volcar();
  const d = diaRepaso(A, HOY)!;
  assert.ok((d.dr ?? 0) <= d.r && (d.dn ?? 0) <= d.n && (d.db ?? 0) <= d.b, `lo deshecho no supera lo respondido: ${JSON.stringify(d)}`);
  igual('t3' in A.almacen('repaso-tarjetas').valores, false, 'la tarjeta reiniciada no vuelve');
  // the next answer of the day counts, and its new card too
  reloj.ahora = T0 + 3 * M;
  R1.calificar('t8', 3, T0 + 3 * M);
  for (const g of Object.values(R1.guardadosRepaso)) await g.volcar();
  const e = R1.efectivo(diaRepaso(A, HOY));
  igual([e.r, e.n], [1, 1], 'la siguiente respuesta cuenta');
});

caso('b12·20 · un módulo no atómico que falla al aplicar un elemento nuevo y una edición encima con el reloj atrasado: la edición no se pierde (prueba 61139)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [registro('crudo', { tiempo: tiempoT })]);
  // C's clock is 20 minutes behind
  const C = await nuevoDisp('C', [registro('crudo', { tiempo: tiempoT })], -20 * M);
  const crudo = (d: Disp) => d.almacen('crudo').valores;
  await asentar([A, C], repo, T0);
  // A creates k0; C's run takes it into memory and then fails (a module that is not atomic: it is not recorded)
  const tA = T0 + H;
  reloj.ahora = tA;
  crudo(A).k0 = { op: 'a', t: tA };
  A.motor.anotarCambio('crudo', 'k0', tA);
  await pasada(A, repo, tA);
  C.almacen('crudo').fallaParcial = true;
  await pasada(C, repo, tA + M);
  C.almacen('crudo').fallaParcial = false;
  igual(crudo(C).k0, { op: 'a', t: tA }, 'C tiene el valor de A');
  // C edits k0 on top of A's value, with its clock behind A's time
  const tC = tA + 2 * M + C.desfase;
  reloj.ahora = tC;
  crudo(C).k0 = { op: 'c', t: tC };
  C.motor.anotarCambio('crudo', 'k0', tC);
  await asentar([C, A], repo, tA + 3 * M);
  igual(repo.vivos('crudo').k0, { op: 'c', t: tC }, 'el fichero tiene la edición de C');
  igual(crudo(A).k0, { op: 'c', t: tC }, 'A');
  igual(crudo(C).k0, { op: 'c', t: tC }, 'C');
});

caso('b12·21 · una pasada cortada después de su PUT y un borrado en otro dispositivo que la vio: la pasada siguiente no resucita el valor (prueba 71337)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [guardado('sin')]);
  // F's clock is 20 minutes behind
  const F = await nuevoDisp('F', [guardado('sin')], -20 * M);
  await asentar([A, F], repo, T0);
  // A sets x; both synchronise (F's record of x: A's time, ahead of F's clock)
  reloj.ahora = T0 + H - 5 * M + A.desfase;
  await tab(A).editar('sin', { x: { op: 'a' } });
  await asentar([A, F], repo, T0 + H - 4 * M);
  // F changes x; its run writes the file and is cut right after the PUT (nothing recorded, the mark kept)
  reloj.ahora = T0 + H + 30_000 + F.desfase;
  await tab(F).editar('sin', { x: { op: 'f' } });
  await pasada(F, repo, T0 + H + M, { interrumpir: true });
  igual(repo.vivos('sin').x, { op: 'f' }, 'el fichero tiene el valor de F');
  // A takes it and deletes it
  await pasada(A, repo, T0 + H + 2 * M);
  igual(A.almacen('sin').valores.x, { op: 'f' }, 'A tiene el valor de F');
  reloj.ahora = T0 + H + 3 * M + A.desfase;
  await tab(A).editar('sin', {}, ['x']);
  await pasada(A, repo, T0 + H + 4 * M);
  igual(repo.vivos('sin').x, undefined, 'borrado en el fichero');
  // F's next run, much later: the deletion, made after F's value was in the file, stays
  await asentar([F, A], repo, T0 + H + 40 * M);
  igual(repo.vivos('sin').x, undefined, 'sigue borrado en el fichero');
  igual(F.almacen('sin').valores.x, undefined, 'borrado en F');
  igual(A.almacen('sin').valores.x, undefined, 'borrado en A');
});

caso('b12·22 · la memoria de una pestaña atrasada respecto a su almacenamiento: la diferencia del espejo no se toma por actividad antigua ni se cuenta dos veces (prueba 71031, la simulación entera)', async () => {
  const { simularPrueba } = await import('./azar.ts');
  const r = await simularPrueba(71031);
  igual(r.problemas, []);
});
