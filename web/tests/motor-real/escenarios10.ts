// Scenarios of 1.0 on the REAL engine (arnes.ts): the transition from 0.12 — a device on 0.12.0 (its engine and modules
// from git) and devices on this version syncing one data repository (ESQUEMA.md «Transition from 0.12») —, the schema
// migration of the device's storage (lib/migrar.ts) and of an older file or backup (lib/esquemas.ts), and the merge of
// an exercise's two versions (lib/union-ejercicios.ts). Added to the cases by correr.ts (revision11-motor.spec.ts and
// datos10.spec.ts run them).
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { fuenteVieja } from '../fuentes-viejas.ts';
import { claveDia } from '../../src/componentes/repaso/srs.ts';
import { unirEjercicios } from '../../src/lib/union-ejercicios.ts';
import { ayudaAlResolver, estadoEjercicio, marcarResuelto, marcarTapada } from '../../src/lib/valores-ejercicio.ts';
import { xpEjercicio } from '../../src/lib/aprendizaje/niveles.ts';
import type { EstadoEjercicio } from '../../src/lib/aprendizaje.svelte.ts';
import { casos } from './escenarios.ts';
import {
  almacenamiento,
  cambiarVersion,
  guardado,
  nuevaPestana,
  nuevoDisp,
  nuevoRepo,
  pasada,
  reloj,
  ultimoError,
  type Almacen,
  type AlmacenDiario,
  type Disp,
  type Pestana,
  type Repo,
} from './arnes.ts';

const M = 60_000;
const H = 60 * M;
const tiempoT = (v: unknown) => (typeof (v as { t?: unknown })?.t === 'number' ? (v as { t: number }).t : undefined);
const igual = (a: unknown, b: unknown, m?: string) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null)), m);
const caso = (nombre: string, f: () => Promise<void>) => casos.push([nombre, f]);

const T0 = new Date(2026, 10, 4, 12).getTime();
const HOY = claveDia(T0);
const AYER = claveDia(T0 - 24 * H);
const diario = (): AlmacenDiario => ({ diario: true, clave: 'progreso-diario' });
const notas = () => guardado('notas', { tiempo: tiempoT, valido: (v) => typeof (v as { texto?: unknown })?.texto === 'string' });
const almacenes = (): Almacen[] => [notas(), diario()];
const tab = (d: Disp) => d.pestanas[0]!;
/** The file's entry of a device (by its id, as its synchronisation state records it). */
const entradaDe = (r: Repo, d: Disp) => {
  const id = (JSON.parse(almacenamiento(d).get('sinc-estado') ?? '{}') as { dispositivo?: string }).dispositivo ?? '';
  return (JSON.parse(r.texto!) as { dispositivos: Record<string, { nombre: string; datos?: number }> }).dispositivos[id];
};
const formato = (r: Repo) => (r.texto ? (JSON.parse(r.texto) as { version: number }).version : 0);

async function actividad(p: Pestana, t: number, n = 1): Promise<void> {
  reloj.ahora = t;
  p.diario!.registrarActividad('paso', n);
  await p.diario!.guardadoDias.volcar();
}
async function pasos(p: Pestana, t: number, dia = HOY): Promise<number> {
  reloj.ahora = t;
  return (await p.diario!.leerDias())[dia]?.pasos ?? 0;
}
async function nota(p: Pestana, t: number, id: string, texto: string): Promise<void> {
  reloj.ahora = t;
  await p.editar('notas', { [id]: { texto, label: id, t } });
}
const textos = (d: Disp) => Object.fromEntries(Object.entries(d.almacen('notas').valores).map(([k, v]) => [k, (v as { texto: string }).texto]));
async function asentar(devs: Disp[], repo: Repo, t: number): Promise<void> {
  for (let r = 0; r < 6; r++) {
    const antes = repo.commits;
    for (const d of devs) for (const p of d.pestanas) await pasada(d, repo, (t += M), { pestana: p });
    if (repo.commits === antes) return;
  }
  throw new Error('los commits no paran');
}
/** The update as the updater does it: every tab writes what it has pending, then the app starts on the migrated storage. */
async function actualizar(d: Disp): Promise<{ migradas: string[]; fallidas: unknown[] }> {
  for (const p of d.pestanas) {
    for (const g of p.guardados.values()) await (g as unknown as { volcar(): Promise<void> }).volcar();
    await p.diario?.guardadoDias.volcar();
  }
  return (await cambiarVersion(d, '0.11')) as { migradas: string[]; fallidas: unknown[] };
}

// ================================================================== the transition from 0.12

caso('t10·1 · un dispositivo con la 0.12 y otro con la 1.0: la 0.12 no puede escribir el fichero nuevo, sus cambios esperan en ella y llegan al actualizarse', async () => {
  const repo = nuevoRepo();
  const X = await nuevoDisp('X', almacenes(), 0, '0.12');
  const Y = await nuevoDisp('Y', almacenes(), 0, '0.12');
  await nota(tab(X), T0, 'n1', 'de X');
  await actividad(tab(X), T0, 2);
  await asentar([X, Y], repo, T0);
  igual(formato(repo), 1);
  // Y is updated: its first run writes the file in format 2 even with nothing new (fusion.ts migradoDe)
  await actualizar(Y);
  assert.ok(await pasada(Y, repo, T0 + H), 'la 1.0 escribe el formato 2 en su primera pasada');
  igual(formato(repo), 2);
  igual(entradaDe(repo, Y)?.datos, 2, 'la 1.0 se anota con el formato que escribe');
  // X (0.12) is told to update, and writes nothing — before and after editing offline
  const texto = repo.texto;
  for (const t of [T0 + H + M, T0 + 2 * H]) {
    assert.equal(await pasada(X, repo, t), false);
    assert.match(ultimoError, /tiene la versión 2 del formato; actualice la aplicación/);
    igual(repo.texto, texto, 'el fichero no cambia');
    if (t === T0 + H + M) {
      await nota(tab(X), T0 + H + 2 * M, 'n2', 'de X, sin poder sincronizar');
      await actividad(tab(X), T0 + H + 2 * M, 3);
    }
  }
  await nota(tab(Y), T0 + 2 * H, 'n3', 'de Y');
  await actividad(tab(Y), T0 + 2 * H, 1);
  await asentar([Y], repo, T0 + 2 * H);
  // the summary Y shows names X as still to update (its entry has no data format 2)
  assert.ok(entradaDe(repo, X), 'X sigue en la lista');
  igual(entradaDe(repo, X)?.datos, undefined, 'X aún sin actualizar');
  // X is updated: what it did meanwhile reaches the file and Y, nothing is lost, both converge
  const r = await actualizar(X);
  igual(r.fallidas, []);
  await asentar([X, Y], repo, T0 + 3 * H);
  for (const d of [X, Y]) {
    igual(textos(d), { n1: 'de X', n2: 'de X, sin poder sincronizar', n3: 'de Y' }, d.nombre);
    igual(await pasos(tab(d), T0 + 4 * H), 6, `${d.nombre}: 2 + 3 de X y 1 de Y`);
  }
});

caso('t10·2 · la 0.12 lee el fichero de la 0.12 y la 1.0 lo convierte entre su lectura y su escritura (409): la 0.12 no escribe', async () => {
  const repo = nuevoRepo();
  const X = await nuevoDisp('X', almacenes(), 0, '0.12');
  const Y = await nuevoDisp('Y', almacenes(), 0, '0.12');
  await nota(tab(X), T0, 'n1', 'uno');
  await asentar([X, Y], repo, T0);
  await actualizar(Y);
  await nota(tab(X), T0 + H, 'n2', 'dos de X');
  // between X's GET and its PUT, Y writes the file in format 2
  repo.antesDePut = async () => {
    await pasada(Y, repo, T0 + H + 1);
  };
  const c0 = repo.commits;
  // (pasada() says whether the file got a commit during the run: Y's, here)
  await pasada(X, repo, T0 + H + 2);
  repo.antesDePut = undefined;
  assert.match(ultimoError, /actualice la aplicación/);
  igual(repo.commits, c0 + 1, 'solo el commit de Y');
  igual(formato(repo), 2);
  igual(Object.keys(repo.vivos('notas')).sort(), ['n1'], 'la nota de X espera en X');
  await actualizar(X);
  await asentar([X, Y], repo, T0 + 2 * H);
  igual(textos(Y), { n1: 'uno', n2: 'dos de X' });
});

caso('t10·3 · volver de la 1.0 a la 0.12 en un dispositivo: lee sus datos igual, no sincroniza y, actualizado otra vez, no migra dos veces', async () => {
  const repo = nuevoRepo();
  const viejo = JSON.stringify({ [AYER]: { pasos: 4, preguntas: 0, secciones: 0, cumplido: true, t: T0 - 20 * H } });
  const X = await nuevoDisp('X', almacenes(), 0, '0.12', { guardado: { 'progreso-diario': viejo } });
  igual(await pasos(tab(X), T0, AYER), 4, 'la 0.12 lee el día de la 0.11');
  await actividad(tab(X), T0, 2);
  const r = await actualizar(X);
  igual(r.migradas, ['progreso-diario']);
  igual(await pasos(tab(X), T0 + M, AYER), 4, 'la 1.0 cuenta lo mismo');
  igual(await pasos(tab(X), T0 + M), 2);
  assert.ok(await pasada(X, repo, T0 + 2 * M));
  await actividad(tab(X), T0 + 3 * M, 1);
  // back to 0.12: it reads the 1.0 data as 1.0 does, and cannot synchronise
  await cambiarVersion(X, '0.12');
  igual(await pasos(tab(X), T0 + 4 * M, AYER), 4, 'la 0.12 lee los datos de la 1.0');
  igual(await pasos(tab(X), T0 + 4 * M), 3);
  const texto = repo.texto;
  assert.equal(await pasada(X, repo, T0 + 5 * M), false);
  igual(repo.texto, texto);
  await actividad(tab(X), T0 + 6 * M, 1);
  // updated again: its versions say «already migrated» — nothing migrated again, nothing counted twice
  const r2 = await actualizar(X);
  igual(r2.migradas, []);
  igual(await pasos(tab(X), T0 + 7 * M, AYER), 4);
  igual(await pasos(tab(X), T0 + 7 * M), 4);
  await asentar([X], repo, T0 + 8 * M);
  const Z = await nuevoDisp('Z', almacenes());
  await asentar([X, Z], repo, T0 + H);
  igual(await pasos(tab(Z), T0 + 2 * H, AYER), 4);
  igual(await pasos(tab(Z), T0 + 2 * H), 4);
});

caso('t10·4 · el exceso de una 0.11 en el fichero de la 0.12 (un día sin tocar desde entonces) se cuenta igual en la 1.0, una sola vez', async () => {
  const repo = nuevoRepo();
  const X = await nuevoDisp('X', almacenes(), 0, '0.12');
  await actividad(tab(X), T0 - 20 * H, 2);
  await asentar([X], repo, T0 - 20 * H);
  // a 0.11 device wrote the day on top of the sum it saw (+3), before 0.12's X changed it again (the legacy excess
  // that 0.12 counted at every read): written straight into the file, as that 0.11 run left it
  const doc = JSON.parse(repo.texto!) as { almacenes: Record<string, Record<string, { t: number; v: { pasos: number; t: number } }>> };
  const e = doc.almacenes['progreso-diario']![AYER]!;
  doc.almacenes['progreso-diario']![AYER] = { t: e.t + 5 * M, v: { ...e.v, pasos: e.v.pasos + 3, t: e.t + 5 * M } };
  repo.texto = JSON.stringify(doc);
  // (0.12 would count 2 + 3, the excess at every read, and absorb it only when it changes the day or applies a merge)
  igual(await pasos(tab(X), T0, AYER), 2, 'X aún no lo ha recibido');
  // a fresh 1.0 device reads that file (format 1: migrated, the excess absorbed into «<day>@0») and counts 5 — and so
  // does X once updated
  const Y = await nuevoDisp('Y', almacenes());
  await asentar([Y], repo, T0 + H);
  igual(formato(repo), 2);
  igual(await pasos(tab(Y), T0 + H + M, AYER), 5, 'la 1.0 cuenta el exceso absorbido por la migración del fichero');
  await actualizar(X);
  await asentar([X, Y], repo, T0 + 2 * H);
  for (const d of [X, Y]) igual(await pasos(tab(d), T0 + 3 * H, AYER), 5, d.nombre);
  igual((repo.vivos('progreso-diario')[`${AYER}@0`] as { pasos: number }).pasos, 3, 'el exceso, una vez, en el registro heredado');
});

caso('t10·5 · copias de seguridad entre versiones: la de la 0.12 (formato 1) se importa en la 1.0 migrada; la de la 1.0 la rechaza la 0.12', async () => {
  const viejo = JSON.stringify({ [AYER]: { pasos: 3, preguntas: 0, secciones: 0, cumplido: true, t: T0 - 20 * H } });
  const X = await nuevoDisp('X', almacenes(), 0, '0.12', { guardado: { 'progreso-diario': viejo } });
  await nota(tab(X), T0, 'n1', 'de X');
  reloj.ahora = T0 + M;
  const copia12 = (await (await tab(X).copia()).crearCopia()).texto;
  igual((JSON.parse(copia12) as { version: number }).version, 1);
  const Y = await nuevoDisp('Y', almacenes());
  reloj.ahora = T0 + 2 * M;
  const c = await tab(Y).copia();
  const r = await c.importar(c.leerFicheroCopia(copia12), 'unir');
  igual(r.fallidos, []);
  igual(textos(Y), { n1: 'de X' });
  igual(await pasos(tab(Y), T0 + 3 * M, AYER), 3, 'el día de la 0.11 dentro de la copia de la 0.12, una vez');
  const copia10 = (await c.crearCopia()).texto;
  igual((JSON.parse(copia10) as { version: number }).version, 2);
  const cx = await tab(X).copia();
  assert.throws(() => cx.leerFicheroCopia(copia10), /versión más nueva de la aplicación \(formato 2/);
});

caso('t10·6 · dos pestañas de la 0.12 abiertas al actualizar: lo pendiente de cada una se guarda antes y nada se pierde', async () => {
  const repo = nuevoRepo();
  const X = await nuevoDisp('X', almacenes(), 0, '0.12');
  const X2 = await nuevaPestana(X);
  await nota(tab(X), T0, 'a', 'pestaña 1');
  await nota(X2, T0 + 1, 'b', 'pestaña 2');
  reloj.ahora = T0 + 2;
  tab(X).diario!.registrarActividad('paso', 1);
  X2.diario!.registrarActividad('paso', 2);
  await actualizar(X);
  await asentar([X], repo, T0 + M);
  igual(textos(X), { a: 'pestaña 1', b: 'pestaña 2' });
  igual(await pasos(tab(X), T0 + H), 3);
  igual(Object.keys(repo.vivos('notas')).sort(), ['a', 'b']);
});

// ================================================================== the exercises' merge (1.0)

const ejercicios = () => guardado('ejercicios', { tiempo: tiempoT, valido: (v) => typeof (v as { intentos?: unknown })?.intentos === 'number', unir: (a, b) => unirEjercicios(a as never, b as never) });

caso('t10·7 · un ejercicio escrito en dos dispositivos sin sincronizar: las respuestas de campos distintos sobreviven las dos', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [ejercicios()]);
  const B = await nuevoDisp('B', [ejercicios()]);
  const base = { intentos: 0, fallos: 0, resuelto: false, pistas: 0, solucion: false };
  reloj.ahora = T0;
  await tab(A).editar('ejercicios', { 'cap01/e1': { ...base, intentos: 1, fallos: 1, valores: { texto: 'mi análisis' }, vt: { texto: T0 }, t: T0 } });
  reloj.ahora = T0 + M;
  await tab(B).editar('ejercicios', { 'cap01/e1': { ...base, intentos: 1, valores: { e1: '4,7' }, vt: { e1: T0 + M }, bien: ['e1'], t: T0 + M } });
  await asentar([A, B], repo, T0 + 2 * M);
  for (const d of [A, B]) {
    const e = d.almacen('ejercicios').valores['cap01/e1'] as { valores: Record<string, string>; intentos: number; fallos: number; bien: string[] };
    igual(e.valores, { e1: '4,7', texto: 'mi análisis' }, d.nombre);
    igual([e.intentos, e.fallos, e.bien], [1, 1, ['e1']], d.nombre);
  }
  // the same field on both: the newer text wins (no conflict copies)
  reloj.ahora = T0 + H;
  const actual = tab(A).mem('ejercicios')['cap01/e1'] as Record<string, unknown>;
  await tab(A).editar('ejercicios', { 'cap01/e1': { ...actual, valores: { ...(actual.valores as object), texto: 'versión de A' }, vt: { ...(actual.vt as object), texto: T0 + H }, t: T0 + H } });
  reloj.ahora = T0 + H + M;
  const deB = tab(B).mem('ejercicios')['cap01/e1'] as Record<string, unknown>;
  await tab(B).editar('ejercicios', { 'cap01/e1': { ...deB, valores: { ...(deB.valores as object), texto: 'versión de B' }, vt: { ...(deB.vt as object), texto: T0 + H + M }, t: T0 + H + M } });
  await asentar([A, B], repo, T0 + 2 * H);
  for (const d of [A, B]) igual((d.almacen('ejercicios').valores['cap01/e1'] as { valores: Record<string, string> }).valores.texto, 'versión de B', d.nombre);
});

caso('t10·8 · «Reiniciar» un ejercicio en un dispositivo mientras otro, sin sincronizar, tiene intentos viejos: el reinicio gana y nada vuelve', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [ejercicios()]);
  const B = await nuevoDisp('B', [ejercicios()]);
  const base = { intentos: 0, fallos: 0, resuelto: false, pistas: 0, solucion: false };
  reloj.ahora = T0;
  await tab(A).editar('ejercicios', { e: { ...base, intentos: 3, fallos: 2, resuelto: true, pistas: 2, solucion: true, valores: { e1: 'viejo' }, vt: { e1: T0 }, t: T0 } });
  await asentar([A, B], repo, T0);
  // B, offline, keeps trying on the old state
  reloj.ahora = T0 + 10 * M;
  const deB = tab(B).mem('ejercicios').e as Record<string, number>;
  await tab(B).editar('ejercicios', { e: { ...deB, intentos: 4, fallos: 3, t: T0 + 10 * M } });
  // A resets it (lib/aprendizaje.svelte.ts reiniciarEjercicio: an empty state with r) and tries once more
  reloj.ahora = T0 + 20 * M;
  await tab(A).editar('ejercicios', { e: { ...base, t: T0 + 20 * M, r: T0 + 20 * M } });
  reloj.ahora = T0 + 30 * M;
  await tab(A).editar('ejercicios', { e: { ...base, intentos: 1, valores: { e1: 'nuevo' }, vt: { e1: T0 + 30 * M }, t: T0 + 30 * M, r: T0 + 20 * M } });
  await asentar([B, A], repo, T0 + H);
  for (const d of [A, B]) {
    const e = d.almacen('ejercicios').valores.e as Record<string, unknown>;
    igual([e.intentos, e.fallos, e.resuelto, e.pistas, e.solucion, e.valores], [1, 0, false, 0, false, { e1: 'nuevo' }], `${d.nombre}: nada de antes del reinicio`);
  }
});

// ================================================================== the migration of the device's storage

caso('t10·9 · la migración al arrancar: copia previa una sola vez, idempotente y con el almacenamiento de Tauri', async () => {
  for (const tauri of [false, true]) {
    const viejo = { [AYER]: { pasos: 2, preguntas: 1, secciones: 0, cumplido: false, t: T0 - 20 * H } };
    const X = await nuevoDisp('X', almacenes(), 0, '0.12', { tauri, guardado: { 'progreso-diario': JSON.stringify(viejo) } });
    await nota(tab(X), T0, 'n1', 'uno');
    const r = await actualizar(X);
    igual(r.migradas, ['progreso-diario'], `tauri=${tauri}`);
    const ls = almacenamiento(X);
    const copia = JSON.parse(JSON.parse(ls.get('copia-migracion')!).texto) as { formato: string; claves: Record<string, unknown>; hacia: Record<string, number> };
    igual(copia.formato, 'epa-copia-migracion');
    igual(copia.claves['progreso-diario'], viejo, 'la copia guarda el original');
    igual(copia.hacia, { 'progreso-diario': 2 });
    const sello = JSON.parse(ls.get('esquemas')!) as { almacenes: Record<string, number> };
    igual(sello.almacenes['progreso-diario'], 2);
    igual(sello.almacenes.notas, 1);
    // a start cut after the data but before the versions: the migration runs again on its own output — no change,
    // and the backup still holds the FIRST original
    const migrado = ls.get('progreso-diario');
    ls.delete('esquemas');
    const r2 = await actualizar(X);
    igual(r2.migradas, []);
    igual(ls.get('progreso-diario'), migrado);
    igual((JSON.parse(JSON.parse(ls.get('copia-migracion')!).texto) as { claves: Record<string, unknown> }).claves['progreso-diario'], viejo);
    igual(textos(X), { n1: 'uno' });
    igual(await pasos(tab(X), T0 + M, AYER), 2);
  }
});

caso('t10·10 · la migración del progreso diario cuenta cada día como la 0.12 (2000 mapas al azar, también en el fichero), y es idempotente', async () => {
  const src = fuenteVieja('0.12.0');
  if (!src) throw new Error('sin la 0.12.0 en git');
  const v12 = (await import(pathToFileURL(`${src}/lib/progreso-dias.ts`).href)) as typeof import('../../src/lib/progreso-dias.ts');
  const n10 = await import('../../src/lib/progreso-dias.ts');
  const { migrarValor, migrarColecciones } = await import('../../src/lib/esquemas.ts');
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const ent = (k: number) => Math.floor(rnd() * k);
  const dias = ['2026-10-01', '2026-10-02', '2026-10-03'];
  for (let i = 0; i < 2000; i++) {
    const m: Record<string, { pasos: number; preguntas: number; secciones: number; cumplido: boolean; t: number }> = {};
    for (const dia of dias) {
      const base = 1_000_000 + ent(50) * 1000;
      if (rnd() < 0.7) m[dia] = { pasos: ent(9), preguntas: ent(5), secciones: ent(3), cumplido: rnd() < 0.3, t: base + ent(5000) };
      for (const quien of ['a', 'b', 'a~', '0', 'c-x']) if (rnd() < 0.35) m[`${dia}@${quien}`] = { pasos: ent(5), preguntas: ent(3), secciones: ent(2), cumplido: false, t: base + ent(5000) };
    }
    const antes = structuredClone(m);
    const migrado = migrarValor('progreso-diario', 1, m) as typeof m;
    igual(m, antes, 'la migración no cambia su entrada');
    for (const dia of dias) {
      const t12 = v12.totalDia(v12.grupoDe(antes, dia));
      const t10 = n10.totalDia(n10.grupoDe(migrado, dia));
      igual(t10, t12, `mapa ${i}, ${dia}: ${JSON.stringify(antes)}`);
    }
    igual(migrarValor('progreso-diario', 1, migrado), migrado, `mapa ${i}: idempotente`);
    // the same in a file's collection: the times of what it writes are the items' own
    const col = Object.fromEntries(Object.entries(antes).map(([id, v]) => [id, { t: v.t, v }]));
    const r = migrarColecciones({ 'progreso-diario': col }, 1);
    igual(r.fallidas, []);
    const vivos = Object.fromEntries(Object.entries(r.almacenes['progreso-diario']!).map(([id, e]) => [id, (e as { v: unknown }).v])) as typeof m;
    igual(vivos, migrado, `mapa ${i}: el fichero migra igual que el almacén`);
    for (const [id, e] of Object.entries(r.almacenes['progreso-diario']!)) assert.equal((e as { t: number }).t, (e as { v: { t: number } }).v.t, id);
  }
});

// ================================================================== teacher mode (1.0, the real module per tab)

caso('t10·11 · modo docente en dos dispositivos: crear, editar y borrar un curso y un resultado; el borrado gana, la copia los lleva y la 0.12 no los toca', async () => {
  const repo = nuevoRepo();
  const almacenesD = (): Almacen[] => [notas(), { docente: true, clave: 'docente-propios' }, { docente: true, clave: 'docente-resultados' }];
  const A = await nuevoDisp('A', almacenesD());
  const B = await nuevoDisp('B', almacenesD());
  const examen = { items: [{ k: 'pregunta', ref: 'cap01/q1', puntos: 1 }], minutos: 0, variantes: false, barajar: false, semilla: 7, espacio: 'normal' };
  reloj.ahora = T0;
  const curso = await tab(A).docente!.crearCurso('Curso de A', '', { elementos: [] });
  const ex = await tab(A).docente!.crearExamen('Examen de A', '', examen);
  await asentar([A, B], repo, T0);
  igual(Object.keys(B.almacen('docente-propios').valores).sort(), [curso, ex].sort(), 'B recibe el curso y el examen');
  // B, offline, renames the course; later A deletes it (a tombstone dated after its last version): the deletion wins
  reloj.ahora = T0 + 10 * M;
  await tab(B).docente!.actualizarPropio(curso, { titulo: 'Curso renombrado en B', notas: '' });
  reloj.ahora = T0 + 20 * M;
  await tab(A).docente!.borrarPropio(curso);
  // B takes the exam (a result), A edits the exam's title
  reloj.ahora = T0 + 25 * M;
  const res = await tab(B).docente!.guardarResultado({ examen: ex, titulo: 'Examen de A', semilla: 7, inicio: T0 + 24 * M, t: T0 + 25 * M, puntos: 1, maximo: 1, items: [] });
  await tab(A).docente!.actualizarPropio(ex, { titulo: 'Examen de A (2)', notas: '' });
  await asentar([B, A], repo, T0 + H);
  for (const d of [A, B]) {
    const p = d.almacen('docente-propios').valores as Record<string, { titulo: string; borrado?: number }>;
    assert.ok(p[curso]?.borrado, `${d.nombre}: el curso borrado sigue borrado`);
    igual(p[ex]?.titulo, 'Examen de A (2)', d.nombre);
    assert.ok((d.almacen('docente-resultados').valores as Record<string, unknown>)[res], `${d.nombre}: el resultado de B`);
  }
  // A deletes the result (immutable but for its deletion): the deletion reaches B
  reloj.ahora = T0 + H + 10 * M;
  await (tab(A).docente as unknown as { borrarResultado(id: string): Promise<void> }).borrarResultado(res);
  await asentar([A, B], repo, T0 + H + 20 * M);
  for (const d of [A, B]) assert.ok((d.almacen('docente-resultados').valores as Record<string, { borrado?: number }>)[res]?.borrado, `${d.nombre}: el resultado borrado`);
  // a backup carries both stores; a fresh device that imports it holds the same (the course still deleted)
  reloj.ahora = T0 + 2 * H;
  const texto = (await (await tab(A).copia()).crearCopia()).texto;
  const o = JSON.parse(texto) as { almacenes: Record<string, Record<string, unknown>> };
  assert.ok(o.almacenes['docente-propios'] && o.almacenes['docente-resultados'], 'la copia lleva los dos almacenes');
  const C = await nuevoDisp('C', almacenesD());
  const c = await tab(C).copia();
  igual((await c.importar(c.leerFicheroCopia(texto), 'unir')).fallidos, []);
  igual(C.almacen('docente-propios').valores, A.almacen('docente-propios').valores);
  igual(C.almacen('docente-resultados').valores, A.almacen('docente-resultados').valores);
  // a device still on 0.12 (no teacher mode) cannot write the file: the stores stay in it
  const X = await nuevoDisp('X', almacenesD(), 0, '0.12');
  await pasada(X, repo, T0 + 3 * H);
  assert.match(ultimoError, /actualice la aplicación/);
  assert.ok(Object.keys(repo.vivos('docente-propios')).length === 2 && (repo.vivos('docente-resultados')[res] as { borrado?: number })?.borrado, 'los almacenes del modo docente siguen en el fichero');
});

caso('t10·12 · anotar miles de marcas de un almacén es lineal (rendimiento 10: quitarHuella recorría todas las huellas en cada marca)', async () => {
  const A = await nuevoDisp('A', [notas()]);
  const m = tab(A).motor as unknown as { anotarCambio(c: string, id: string, t?: number, h?: string): void; anotarBorrado(c: string, ids: string | string[], t?: number): void };
  const medir = (n: number, desde: number) => {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) m.anotarCambio('notas', `n${desde + i}`, T0 + i, `h${i}`);
    for (let i = 0; i < n; i++) m.anotarBorrado('notas', `n${desde + i}`, T0 + n + i);
    return performance.now() - t0;
  };
  medir(500, 0);
  const t1 = medir(4000, 10_000);
  const t2 = medir(16_000, 100_000);
  // linear: 4 × the items, at most ~8 × the time (quadratic: 16 ×; before the fix 1,5 s and 34 s) — with room for a
  // loaded machine at these small times; and small in absolute terms
  assert.ok(t2 < Math.max(8 * t1, 400), `4000 marcas: ${t1.toFixed(0)} ms, 16 000: ${t2.toFixed(0)} ms`);
  assert.ok(t2 < 1500, `16 000 marcas y sus borrados: ${t2.toFixed(0)} ms`);
});

// ================================================================== review 10i: a real attempt after a reset it had not seen

/** One «Comprobar» as aprendizaje.svelte.ts registrarIntento stores it (since 10g only an attempt moves `t`). */
function intento(previo: Record<string, unknown> | undefined, valores: Record<string, string>, bien: string[], completo: boolean, t: number): Record<string, unknown> {
  const e = structuredClone(previo ?? { intentos: 0, fallos: 0, resuelto: false, pistas: 0, solucion: false, t: 0 }) as Record<string, unknown> & { intentos: number; fallos: number };
  e.intentos++;
  if (!completo) e.fallos++;
  const v = { ...(e.valores as Record<string, string> | undefined), ...valores, _c: String(t) };
  e.valores = v;
  e.vt = { ...(e.vt as Record<string, number> | undefined), ...Object.fromEntries(Object.keys(v).map((k) => [k, t])) };
  // (review 10j: only the solving check writes «resuelto», with its own time — key `_r`)
  if (completo) marcarResuelto(e as unknown as EstadoEjercicio, true, t);
  e.bien = bien;
  e.t = t;
  return e;
}

/** «¿Lo tenía bien? Sí/No» as aprendizaje.svelte.ts autoevaluar stores it. */
function autoevaluado(previo: Record<string, unknown> | undefined, bien: boolean, t: number): Record<string, unknown> {
  const e = structuredClone(previo ?? { intentos: 0, fallos: 0, resuelto: false, pistas: 0, solucion: false, t: 0 }) as unknown as EstadoEjercicio;
  e.intentos++;
  if (!bien) e.fallos++;
  e.solucion = true; // 1.1: a self-assessment always counts as having seen the solution (no XP)
  marcarResuelto(e, bien, t);
  e.t = t;
  return e as unknown as Record<string, unknown>;
}
const ej = (d: Disp, id = 'e') => d.almacen('ejercicios').valores[id] as EstadoEjercicio;
const enMem = (d: Disp, id = 'e') => structuredClone(tab(d).mem('ejercicios')[id]) as Record<string, unknown> | undefined;

caso('t10·13 · «Reiniciar» en A; B, que no lo había visto, lo resuelve después: queda resuelto en los dos, con un intento y sin los fallos de antes (revisión 10i)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [ejercicios()]);
  const B = await nuevoDisp('B', [ejercicios()]);
  reloj.ahora = T0;
  await tab(A).editar('ejercicios', { e: intento(undefined, { r1: '4' }, [], false, T0) });
  await asentar([A, B], repo, T0);
  reloj.ahora = T0 + 10 * M;
  await tab(A).editar('ejercicios', { e: { intentos: 0, fallos: 0, resuelto: false, pistas: 0, solucion: false, t: T0 + 10 * M, r: T0 + 10 * M } });
  await asentar([A], repo, T0 + 10 * M);
  reloj.ahora = T0 + 30 * M;
  await tab(B).editar('ejercicios', { e: intento(tab(B).mem('ejercicios').e as Record<string, unknown>, { r1: '5' }, ['r1'], true, T0 + 30 * M) });
  await asentar([B, A], repo, T0 + H);
  for (const d of [A, B]) {
    const e = d.almacen('ejercicios').valores.e as Record<string, unknown>;
    igual([e.resuelto, e.intentos, e.fallos, e.bien, (e.valores as Record<string, string>).r1], [true, 1, 0, ['r1'], '5'], d.nombre);
    assert.equal(e.r, T0 + 10 * M, `${d.nombre}: el reinicio sigue`);
  }
});

caso('t10·14 · control: el intento de B ANTERIOR al reinicio de A no vuelve (revisión 10i)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [ejercicios()]);
  const B = await nuevoDisp('B', [ejercicios()]);
  reloj.ahora = T0;
  await tab(A).editar('ejercicios', { e: intento(undefined, { r1: '4' }, [], false, T0) });
  await asentar([A, B], repo, T0);
  // B solves it offline; A resets it LATER, not having seen B's attempt
  reloj.ahora = T0 + 10 * M;
  await tab(B).editar('ejercicios', { e: intento(tab(B).mem('ejercicios').e as Record<string, unknown>, { r1: '5' }, ['r1'], true, T0 + 10 * M) });
  reloj.ahora = T0 + 20 * M;
  await tab(A).editar('ejercicios', { e: { intentos: 0, fallos: 0, resuelto: false, pistas: 0, solucion: false, t: T0 + 20 * M, r: T0 + 20 * M } });
  await asentar([A, B], repo, T0 + H);
  for (const d of [A, B]) {
    const e = d.almacen('ejercicios').valores.e as Record<string, unknown>;
    igual([e.resuelto, e.intentos, e.fallos, e.bien ?? null, e.valores ?? null], [false, 0, 0, null, null], d.nombre);
  }
});

caso('t10·15 · A lo resuelve sin conexión; B y C, sin haberlo recibido, fallan comprobaciones parciales después: resuelto en los tres, con las respuestas de todos (revisión 10j, r10j·2)', async () => {
  const repo = nuevoRepo();
  const [A, B, C] = [await nuevoDisp('A', [ejercicios()]), await nuevoDisp('B', [ejercicios()]), await nuevoDisp('C', [ejercicios()])];
  reloj.ahora = T0;
  await tab(A).editar('ejercicios', { e: intento(undefined, { r1: '1' }, [], false, T0) });
  await asentar([A, B, C], repo, T0);
  reloj.ahora = T0 + 10 * M;
  await tab(A).editar('ejercicios', { e: intento(enMem(A), { r1: '2 mA', r2: '6 V' }, ['r1', 'r2'], true, T0 + 10 * M) });
  reloj.ahora = T0 + 20 * M;
  await tab(B).editar('ejercicios', { e: intento(enMem(B), { r1: '2 mA' }, ['r1'], false, T0 + 20 * M) });
  reloj.ahora = T0 + 30 * M;
  await tab(C).editar('ejercicios', { e: intento(enMem(C), { r3: '9' }, [], false, T0 + 30 * M) });
  // every order of arrival in the file
  await asentar([C, B, A], repo, T0 + H);
  for (const d of [A, B, C]) {
    const e = ej(d);
    assert.equal(estadoEjercicio(e), 'resuelto', `${d.nombre}: deja de estar resuelto`);
    // (counters: the larger; r1: C's check re-stamped the r1 it still had, as registrarIntento stamps every value checked)
    igual([e.intentos, e.fallos, e.valores?.r1, e.valores?.r2, e.valores?.r3], [2, 2, '1', '6 V', '9'], d.nombre);
  }
});

caso('t10·16 · la autoevaluación decide «resuelto» en los dos sentidos con su hora: un «No» posterior en otro dispositivo gana a un «Sí»; un fallo comprobado no (revisión 10j)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [ejercicios()]);
  const B = await nuevoDisp('B', [ejercicios()]);
  reloj.ahora = T0;
  await asentar([A, B], repo, T0);
  // texto exercise: «Sí» on A, then «No» on B (later, not having received it)
  reloj.ahora = T0 + 10 * M;
  await tab(A).editar('ejercicios', { x: autoevaluado(undefined, true, T0 + 10 * M) });
  reloj.ahora = T0 + 20 * M;
  await tab(B).editar('ejercicios', { x: autoevaluado(undefined, false, T0 + 20 * M) });
  await asentar([A, B], repo, T0 + H);
  for (const d of [A, B]) assert.equal(estadoEjercicio(ej(d, 'x')), 'fallado', `${d.nombre}: el «No» posterior no gana`);
  // «Sí» again on A, later: solved on both
  reloj.ahora = T0 + 2 * H;
  await tab(A).editar('ejercicios', { x: autoevaluado(enMem(A, 'x'), true, T0 + 2 * H) });
  await asentar([B, A], repo, T0 + 2 * H);
  for (const d of [A, B]) igual([ej(d, 'x').resuelto, ej(d, 'x').intentos], [true, 2], d.nombre);
});

caso('t10·17 · «Ocultar/Ver solución» de un problema en dos dispositivos y sobre un ítem de la 0.12: gana el último pulsado, aunque no mueva t (revisión 10j, r10j·1)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [ejercicios()]);
  const B = await nuevoDisp('B', [ejercicios()]);
  reloj.ahora = T0;
  // an item as 0.12 left it: hidden, no `_o`, no vt
  await tab(A).editar('ejercicios', { p: { intentos: 1, fallos: 1, resuelto: false, pistas: 0, solucion: false, tapada: true, valores: { r1: '3' }, t: T0 } });
  await asentar([A, B], repo, T0);
  for (const d of [A, B]) assert.equal(ej(d, 'p').tapada, true, d.nombre);
  // «Ver solución» on B (t unchanged), then «Ocultar» on A later — each one synchronised before the other is pressed
  const pulsar = async (d: Disp, tapada: boolean, t: number) => {
    reloj.ahora = t;
    const e = enMem(d, 'p') as unknown as EstadoEjercicio;
    marcarTapada(e, tapada, t);
    await tab(d).editar('ejercicios', { p: e });
  };
  await pulsar(B, false, T0 + 10 * M);
  await asentar([B, A], repo, T0 + 10 * M);
  for (const d of [A, B]) igual([ej(d, 'p').tapada, ej(d, 'p').t], [false, T0], `${d.nombre}: «Ver solución» deshecho`);
  await pulsar(A, true, T0 + 20 * M);
  // B, offline (it has not received A's «Ocultar»), presses «Ver solución» later
  await pulsar(B, false, T0 + 30 * M);
  await asentar([A, B], repo, T0 + H);
  for (const d of [A, B]) assert.equal(ej(d, 'p').tapada, false, `${d.nombre}: no gana el último pulsado`);
  // a failed check on A later does not change it
  reloj.ahora = T0 + 2 * H;
  await tab(A).editar('ejercicios', { p: intento(enMem(A, 'p'), { r1: '4' }, [], false, T0 + 2 * H) });
  await asentar([A, B], repo, T0 + 2 * H);
  for (const d of [A, B]) igual([ej(d, 'p').tapada, ej(d, 'p').intentos], [false, 2], d.nombre);
});

caso('t10·18 · «Reiniciar» en A; B, sin verlo, lo resuelve tras abrir la solución y dos pistas: en A no da la XP que B no dio ni dice «a la primera» (revisión 10j)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [ejercicios()]);
  const B = await nuevoDisp('B', [ejercicios()]);
  reloj.ahora = T0;
  await tab(A).editar('ejercicios', { e: intento(undefined, { r1: '4' }, [], false, T0) });
  await asentar([A, B], repo, T0);
  // B: two hints and the solution (usarPista/verSolucion: no new t), offline
  const b = enMem(B) as unknown as EstadoEjercicio;
  b.pistas = 2;
  b.solucion = true;
  await tab(B).editar('ejercicios', { e: b });
  reloj.ahora = T0 + 10 * M;
  await tab(A).editar('ejercicios', { e: { intentos: 0, fallos: 0, resuelto: false, pistas: 0, solucion: false, t: T0 + 10 * M, r: T0 + 10 * M } });
  await asentar([A], repo, T0 + 10 * M);
  reloj.ahora = T0 + 30 * M;
  await tab(B).editar('ejercicios', { e: intento(enMem(B), { r1: '5' }, ['r1'], true, T0 + 30 * M) });
  // what B awarded live (aprendizaje.svelte.ts avisarEjercicio → progreso.svelte.ts premioDe)
  const enB = ej(B);
  assert.equal(xpEjercicio({ fallos: enB.fallos, pistas: enB.pistas, solucion: enB.solucion }), 0);
  await asentar([B, A], repo, T0 + H);
  for (const d of [A, B]) {
    const e = ej(d);
    // the merge keeps the reset: one attempt after it, its hints and the solution not counted…
    igual([e.resuelto, e.intentos, e.pistas, e.solucion, e.r], [true, 1, 0, false, T0 + 10 * M], d.nombre);
    // …but what is judged (reconciliar's XP, mastery, the summary) is never more generous than on B
    const a = ayudaAlResolver(e);
    assert.equal(xpEjercicio(a), 0, `${d.nombre}: la reconciliación daría la XP que B no dio`);
    assert.ok(a.solucion && a.pistas === 2 && a.intentos >= 2, `${d.nombre}: diría «Resuelto a la primera»: ${JSON.stringify(a)}`);
  }
});
