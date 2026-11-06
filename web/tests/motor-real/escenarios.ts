// Scenarios of the second and third independent reviews of 0.11 on the REAL engine (arnes.ts). Each `caso` failed
// before its fix. Run through correr.ts (revision11-motor.spec.ts).
import assert from 'node:assert/strict';
import { REENVIOS_MAXIMOS } from '../../src/lib/sincronizacion/fusion.ts';
import { anotarRespuesta, fusionarRegistros, registroValido, type RegistroItem } from '../../src/lib/aprendizaje/dominio.ts';
import { preferirDia, type DiaComparable } from '../../src/lib/aprendizaje/seleccion.ts';
import {
  almacenamiento,
  cambiarVersion,
  fallarEscritura,
  fallarLectura,
  guardado,
  guardadoSuelto,
  nuevaPestana,
  nuevoDisp,
  nuevoRepo,
  pasada,
  registro,
  reloj,
  tiempos,
  ultimoError,
  type Almacen,
  type AlmacenSim,
  type Disp,
} from './arnes.ts';

const M = 60_000;
const H = 60 * M;
const DIA = 24 * H;
const tiempoT = (v: unknown) => (typeof (v as { t?: unknown })?.t === 'number' ? (v as { t: number }).t : undefined);
const igual = (a: unknown, b: unknown, m?: string) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null)), m);

export const casos: [string, () => Promise<void>][] = [];
const caso = (nombre: string, f: () => Promise<void>) => casos.push([nombre, f]);

const dominio = (extra: Partial<AlmacenSim> = {}): AlmacenSim =>
  registro('dominio', {
    tiempo: (v) => (registroValido(v) ? v.r[v.r.length - 1]?.[0] : undefined),
    valido: registroValido,
    unir: (a, b) => fusionarRegistros(a as RegistroItem, b as RegistroItem),
    tomar: (l, e) => (l && registroValido(l) ? fusionarRegistros(l, e as RegistroItem) : e),
    ...extra,
  });
const problemaDia = (): AlmacenSim =>
  registro('problema-dia', {
    tiempo: (v) => Math.max((v as DiaComparable).t, (v as DiaComparable).r?.t ?? 0),
    unir: (a, b) => preferirDia(a as DiaComparable, b as DiaComparable),
    tomar: (l, e) => (l ? preferirDia(l as DiaComparable, e as DiaComparable) : e),
  });
const responder = (d: Disp, t: number, id = 'X') => {
  const st = d.almacen('dominio');
  st.valores[id] = anotarRespuesta(st.valores[id] as RegistroItem | undefined, 'cap01/sec-1.1', { t, correcta: true, intento: 1, pistas: 0, final: true, clase: 'pregunta' })!;
  d.cambio('dominio', id, t);
};

// ================================================================== second review (now on the real engine)

caso('r2·1 · un almacén que no se puede escribir: ni commits sin fin, ni borra lo que otro recrea, ni pisa ediciones posteriores', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [registro('deducciones')]);
  const B = await nuevoDisp('B', [registro('deducciones')]);
  A.almacen('deducciones').valores = { x: 3, y: 1 };
  await pasada(A, repo, 1000);
  await pasada(B, repo, 1100);
  B.almacen('deducciones').valores.x = 5;
  B.cambio('deducciones', 'x', 1500);
  await pasada(B, repo, 1500);
  delete A.almacen('deducciones').valores.y;
  A.borrado('deducciones', 'y', 2000);
  A.almacen('deducciones').falla = true;
  const w: boolean[] = [];
  for (let t = 3000; t <= 7000; t += 1000) w.push(await pasada(A, repo, t));
  igual(w.slice(1), [false, false, false, false], 'la eliminación sale una vez');
  B.almacen('deducciones').valores.y = 9;
  B.cambio('deducciones', 'y', 7500);
  await pasada(B, repo, 7500);
  await pasada(A, repo, 8000);
  igual(repo.vivos('deducciones'), { x: 5, y: 9 });
  A.almacen('deducciones').falla = false;
  await pasada(A, repo, 9000);
  igual(A.almacen('deducciones').valores, { x: 5, y: 9 });
});

caso('r2·3 · lo borrado mientras una pasada está en curso no vuelve', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [registro('marcadores', { tiempo: tiempoT })]);
  A.almacen('marcadores').valores = { m1: { label: 'x', t: 1000 } };
  await pasada(A, repo, 1000);
  await pasada(A, repo, 2000);
  await pasada(A, repo, 3000, {
    durante: () => {
      delete A.almacen('marcadores').valores.m1;
      A.borrado('marcadores', 'm1', 3001);
    },
  });
  await pasada(A, repo, 4000);
  igual(A.almacen('marcadores').valores, {});
  igual(repo.vivos('marcadores'), {});
});

caso('r2·4 · un valor que el almacén rechaza no se pisa con la copia local', async () => {
  const repo = nuevoRepo();
  const O = await nuevoDisp('O', [registro('notas', { tiempo: tiempoT, valido: (v) => typeof (v as { texto?: unknown }).texto === 'string' })]);
  const N = await nuevoDisp('N', [registro('notas', { tiempo: tiempoT, valido: (v) => typeof (v as { texto?: unknown }).texto === 'string' || Array.isArray((v as { bloques?: unknown }).bloques) })]);
  O.almacen('notas').valores = { n1: { texto: 'viejo', t: 1000 } };
  await pasada(O, repo, 1000);
  await pasada(N, repo, 1100);
  N.almacen('notas').valores.n1 = { bloques: ['nuevo'], t: 2000 };
  await pasada(N, repo, 2000);
  assert.equal(await pasada(O, repo, 3000), false);
  assert.equal(await pasada(O, repo, 4000), false);
  await pasada(N, repo, 5000);
  igual(repo.vivos('notas').n1, { bloques: ['nuevo'], t: 2000 });
  O.almacen('notas').valores.n1 = { texto: 'editado en O', t: 6000 };
  await pasada(O, repo, 6000);
  igual(repo.vivos('notas').n1, { texto: 'editado en O', t: 6000 });
});

caso('r2·5 · la unión de rondas y el día resuelto quedan en el fichero en la misma pasada', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [dominio()]);
  const B = await nuevoDisp('B', [dominio()]);
  await pasada(B, repo, 1 * M);
  responder(A, 10 * M);
  await pasada(A, repo, 11 * M);
  responder(B, 30 * M);
  await pasada(B, repo, 60 * M);
  igual((repo.vivos('dominio').X as RegistroItem).r.map((x) => x[0]), [10 * M, 30 * M]);
  const r2 = nuevoRepo();
  const P = await nuevoDisp('P', [problemaDia()]);
  const Q = await nuevoDisp('Q', [problemaDia()]);
  P.almacen('problema-dia').valores.d = { id: 'x', t: 100, r: { bien: true, intentos: 1, t: 200 } };
  await pasada(P, r2, 300);
  Q.almacen('problema-dia').valores.d = { id: 'y', t: 400 };
  await pasada(Q, r2, 500);
  igual(r2.vivos('problema-dia').d, { id: 'x', t: 100, r: { bien: true, intentos: 1, t: 200 } });
});

caso('r2·7 · normalizaciones opuestas: escrituras acotadas y nada se reaplica sin fin', async () => {
  for (const [fa, fb] of [
    ['a', 'b'],
    ['b', 'a'],
  ] as const) {
    const repo = nuevoRepo();
    const norm = (forma: string): AlmacenSim => registro('ajustes', { tomar: (_l, e) => ({ ...(e as object), forma }) });
    const A = await nuevoDisp('A', [norm(fa)]);
    const B = await nuevoDisp('B', [norm(fb)]);
    A.almacen('ajustes').valores = { x: { n: 1, forma: fa } };
    A.cambio('ajustes', 'x', 900);
    const w: boolean[] = [];
    let t = 1000;
    for (let k = 0; k < 60; k++) w.push(await pasada(k % 2 ? B : A, repo, (t += 1000)));
    assert.ok(w.filter(Boolean).length <= 2 * (REENVIOS_MAXIMOS + 2), `commits ${w.filter(Boolean).length}`);
    assert.ok(!w.slice(-20).some(Boolean));
    for (const d of [A, B]) assert.ok(((d.estado.items.ajustes!.x as number[])[2] ?? 0) <= REENVIOS_MAXIMOS + 1);
  }
});

// ================================================================== third review

caso('r3·1 · el editor con memoria vieja no pisa lo que trajo la sincronización (Guardado, dos escritores)', async () => {
  const tiempo = (v: unknown) => Math.max((v as { actualizado?: number })?.actualizado ?? 0, (v as { borrado?: number })?.borrado ?? 0) || undefined;
  const circ = (id: string, nombre: string, t: number) => ({ id, nombre, creado: 1000, actualizado: t, doc: { titulo: nombre } });
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [guardado('editor-circuitos', { tiempo })]);
  const B = await nuevoDisp('B', [guardado('editor-circuitos', { tiempo })]);
  const editorA = A.pestanas[0]!;
  await editorA.editar('editor-circuitos', { c1: circ('c1', 'filtro v1', 1000) });
  await pasada(A, repo, 1000);
  // another writer of A's storage (the synchronisation of 0.10/0.11 writing the key directly, another tab): a tab
  // whose engine applies B's work, while the editor (the first tab) keeps its old memory
  const otra = await nuevaPestana(A);
  await pasada(B, repo, 1100);
  await B.pestanas[0]!.editar('editor-circuitos', { c1: circ('c1', 'filtro v2 (B)', 5000), c2: circ('c2', 'amplificador (B)', 5000) });
  await pasada(B, repo, 5000);
  await pasada(A, repo, 6000, { pestana: otra });
  igual(Object.keys(A.almacen('editor-circuitos').valores).sort(), ['c1', 'c2']);
  // the reader saves a new circuit in the editor (old memory): read-merge-write keeps B's work
  await editorA.editar('editor-circuitos', { c3: circ('c3', 'nuevo en A', 7000) });
  igual(Object.keys(editorA.mem('editor-circuitos')).sort(), ['c1', 'c2', 'c3']);
  await pasada(A, repo, 8000);
  await pasada(B, repo, 9000);
  const nombres = (v: Record<string, unknown>) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, (x as { nombre: string }).nombre]));
  igual(nombres(repo.vivos('editor-circuitos')), { c1: 'filtro v2 (B)', c2: 'amplificador (B)', c3: 'nuevo en A' });
  igual(nombres(B.pestanas[0]!.mem('editor-circuitos')), { c1: 'filtro v2 (B)', c2: 'amplificador (B)', c3: 'nuevo en A' });
});

caso('r3·1 · defensa del motor: una copia vieja escrita sin marca (con hora propia) no se envía como nueva', async () => {
  const tiempo = (v: unknown) => Math.max((v as { actualizado?: number })?.actualizado ?? 0, (v as { borrado?: number })?.borrado ?? 0) || undefined;
  const circ = (id: string, nombre: string, t: number) => ({ id, nombre, creado: 1000, actualizado: t, doc: { titulo: nombre } });
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [registro('editor-circuitos', { tiempo })]);
  const B = await nuevoDisp('B', [registro('editor-circuitos', { tiempo })]);
  const almA = A.almacen('editor-circuitos');
  almA.valores = { c1: circ('c1', 'filtro v1', 1000) };
  await pasada(A, repo, 1000);
  await pasada(B, repo, 1100);
  const viejo = structuredClone(almA.valores);
  B.almacen('editor-circuitos').valores.c1 = circ('c1', 'filtro v2 (B)', 5000);
  B.almacen('editor-circuitos').valores.c2 = circ('c2', 'amplificador (B)', 5000);
  await pasada(B, repo, 5000);
  await pasada(A, repo, 6000);
  // a module of 0.10 (no Guardado) writes its stale map with a new circuit, without marks
  viejo.c3 = circ('c3', 'nuevo en A', 7000);
  almA.valores = viejo;
  await pasada(A, repo, 8000);
  await pasada(B, repo, 9000);
  const nombres = (v: Record<string, unknown>) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, (x as { nombre: string }).nombre]));
  igual(nombres(repo.vivos('editor-circuitos')), { c1: 'filtro v2 (B)', c2: 'amplificador (B)', c3: 'nuevo en A' });
});

caso('r3·2 · un aplicar que cambia la memoria y luego no puede guardar: nada vuelve atrás ni resucita', async () => {
  // (a) a module that is not atomic (memory changed, then the write throws), on the real engine
  {
    const repo = nuevoRepo();
    const A = await nuevoDisp('A', [registro('notas', { tiempo: tiempoT })]);
    const B = await nuevoDisp('B', [registro('notas', { tiempo: tiempoT })]);
    const a = A.almacen('notas');
    a.valores = { n1: { texto: 'v1', t: 1000 } };
    let guardado = structuredClone(a.valores);
    await pasada(A, repo, 1000);
    await pasada(B, repo, 1100);
    B.almacen('notas').valores.n1 = { texto: 'v2 (B)', t: 2000 };
    await pasada(B, repo, 2000);
    a.fallaParcial = true;
    await pasada(A, repo, 3000);
    a.fallaParcial = false;
    await pasada(A, repo, 4000);
    guardado = structuredClone(guardado);
    a.valores = guardado; // the app restarts: the module loads what the storage kept
    await pasada(A, repo, 5000);
    await pasada(B, repo, 6000);
    igual(repo.vivos('notas').n1, { texto: 'v2 (B)', t: 2000 });
    igual(B.almacen('notas').valores.n1, { texto: 'v2 (B)', t: 2000 });
  }
  // (b) a deletion applied in memory but not stored
  {
    const repo = nuevoRepo();
    const A = await nuevoDisp('A', [registro('progreso-xp', { tiempo: tiempoT })]);
    const B = await nuevoDisp('B', [registro('progreso-xp', { tiempo: tiempoT })]);
    const a = A.almacen('progreso-xp');
    a.valores = { k: { x: 10, t: 1000 }, j: { x: 5, t: 1000 } };
    const guardado = structuredClone(a.valores);
    await pasada(A, repo, 1000);
    await pasada(B, repo, 1100);
    delete B.almacen('progreso-xp').valores.k;
    B.borrado('progreso-xp', 'k', 2000);
    await pasada(B, repo, 2000);
    a.fallaParcial = true;
    await pasada(A, repo, 3000);
    a.fallaParcial = false;
    await pasada(A, repo, 4000);
    a.valores = structuredClone(guardado);
    await pasada(A, repo, 5000);
    await pasada(B, repo, 6000);
    igual(Object.keys(repo.vivos('progreso-xp')), ['j']);
  }
  // (c) the same with a Guardado (atomic): the storage refuses the write; memory and storage stay as they were
  {
    const repo = nuevoRepo();
    const A = await nuevoDisp('A', [guardado('notas', { tiempo: tiempoT })]);
    const B = await nuevoDisp('B', [guardado('notas', { tiempo: tiempoT })]);
    await A.pestanas[0]!.editar('notas', { n1: { texto: 'v1', t: 1000 } });
    await pasada(A, repo, 1000);
    await pasada(B, repo, 1100);
    await B.pestanas[0]!.editar('notas', { n1: { texto: 'v2 (B)', t: 2000 } });
    await pasada(B, repo, 2000);
    fallarEscritura(A, 'g:notas');
    await pasada(A, repo, 3000);
    igual(A.pestanas[0]!.mem('notas').n1, { texto: 'v1', t: 1000 }, 'memoria intacta');
    fallarEscritura(A, 'g:notas', false);
    await pasada(A, repo, 4000);
    igual(A.pestanas[0]!.mem('notas').n1, { texto: 'v2 (B)', t: 2000 });
    igual(repo.vivos('notas').n1, { texto: 'v2 (B)', t: 2000 });
  }
});

caso('r3·2 · si no se puede guardar el registro de la pasada, lo recibido no se reenvía después', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [registro('marcadores', { tiempo: tiempoT })]);
  const B = await nuevoDisp('B', [registro('marcadores', { tiempo: tiempoT })]);
  A.almacen('marcadores').valores = { m1: { label: 'a', t: 1000 }, m2: { label: 'b', t: 1000 } };
  await pasada(A, repo, 1000);
  await pasada(B, repo, 1100);
  delete B.almacen('marcadores').valores.m1;
  B.borrado('marcadores', 'm1', 2000);
  await pasada(B, repo, 2000);
  fallarEscritura(A, 'sinc-estado');
  await pasada(A, repo, 3000);
  fallarEscritura(A, 'sinc-estado', false);
  // C re-creates m1 later; A's next run must not delete it again
  B.almacen('marcadores').valores.m1 = { label: 'a otra vez', t: 4000 };
  await pasada(B, repo, 4000);
  await pasada(A, repo, 5000);
  igual(repo.vivos('marcadores').m1, { label: 'a otra vez', t: 4000 });
});

caso('r3·3 · las lápidas «borrado» podadas con un reloj atrasado no producen commits sin fin', async () => {
  for (const desfaseB of [-2 * DIA, -10 * M]) {
    const repo = nuevoRepo();
    const A = await nuevoDisp('A', [registro('marcadores', { tiempo: tiempoT })]);
    const B = await nuevoDisp('B', [registro('marcadores', { tiempo: tiempoT })], desfaseB);
    const T0 = 1_760_000_000_000;
    A.almacen('marcadores').valores = { x: { label: 'x', t: T0 - 10 * DIA } };
    await pasada(A, repo, T0 - 10 * DIA);
    await pasada(B, repo, T0 - 9 * DIA);
    delete A.almacen('marcadores').valores.x;
    A.borrado('marcadores', 'x', T0);
    await pasada(A, repo, T0 + M);
    await pasada(B, repo, T0 + 2 * M);
    let t = T0 + 90 * DIA - 3 * H;
    const c0 = repo.commits;
    for (let k = 0; k < (2 * 24 * 60) / 15; k++) {
      t += 15 * M;
      await pasada(A, repo, t);
      await pasada(B, repo, t + M);
    }
    assert.ok(repo.commits - c0 <= 2, `desfase ${desfaseB / M} min: ${repo.commits - c0} commits`);
  }
});

caso('r3·4 · un valor por defecto no gana a uno personalizado de edad desconocida', async () => {
  for (const primero of ['A', 'F']) {
    const porDefecto = (id: string) => (id === 'ajustes' ? { nuevasDia: 10, inversas: false, mazo: 'todo' } : undefined);
    const repo = nuevoRepo();
    const A = await nuevoDisp('A', [registro('repaso-ajustes', { porDefecto })]);
    A.almacen('repaso-ajustes').valores = { ajustes: { nuevasDia: 10, inversas: false, mazo: 'cap03' } };
    A.cambio('repaso-ajustes', 'ajustes', 500);
    await pasada(A, repo, 1000);
    repo.borrar();
    const F = await nuevoDisp('F', [registro('repaso-ajustes', { porDefecto })]);
    F.almacen('repaso-ajustes').valores = { ajustes: { nuevasDia: 10, inversas: false, mazo: 'todo' } };
    const orden = primero === 'A' ? [A, F] : [F, A];
    let t = 2000;
    for (const d of [...orden, ...orden]) await pasada(d, repo, (t += 1000));
    igual((repo.vivos('repaso-ajustes').ajustes as { mazo: string }).mazo, 'cap03', `primero ${primero}`);
    igual((F.almacen('repaso-ajustes').valores.ajustes as { mazo: string }).mazo, 'cap03');
  }
});

caso('r3·4 · con 409: otro dispositivo escribe entre el GET y el PUT y nada se pierde (unir)', async () => {
  const repo = nuevoRepo();
  const ds = [await nuevoDisp('A', [dominio()]), await nuevoDisp('B', [dominio()]), await nuevoDisp('C', [dominio()])];
  for (const d of ds) await pasada(d, repo, 1000);
  const [A, B, C] = ds as [Disp, Disp, Disp];
  responder(A, 10 * H);
  responder(B, 11 * H);
  responder(C, 12 * H);
  repo.antesDePut = async () => {
    await pasada(B, repo, 13 * H);
    repo.antesDePut = async () => {
      await pasada(C, repo, 13 * H + M);
    };
  };
  await pasada(A, repo, 13 * H);
  igual((repo.vivos('dominio').X as RegistroItem).r.map((x) => x[0] / H), [10, 11, 12]);
  responder(A, 30 * H);
  let n = 0;
  const molestar = async () => {
    if (++n > 5) return;
    responder(B, 31 * H + n * 20 * M);
    await pasada(B, repo, 31 * H + n * 20 * M);
    repo.antesDePut = molestar;
  };
  repo.antesDePut = molestar;
  await pasada(A, repo, 32 * H);
  repo.antesDePut = undefined;
  let t = 40 * H;
  for (let k = 0; k < 3; k++) for (const d of ds) await pasada(d, repo, (t += H));
  assert.ok((repo.vivos('dominio').X as RegistroItem).r.some((x) => x[0] === 30 * H), 'la ronda de A tras cinco conflictos');
});

// 1.0: this was «volver a la 0.10 (reinstalar, pestaña vieja) no borra lo recreado después», with the 0.10 engine;
// compatibility with 0.10/0.11 clients was dropped, so the way back is now to 0.12.0 (its engine from git): its runs
// are refused by the file of format 2 — nothing written, nothing deleted —, and once updated again it converges.
caso('r3·5 · volver a la 0.12 (reinstalar): sus pasadas se rechazan sin tocar el fichero y no borran lo recreado después', async () => {
  const repo = nuevoRepo();
  const mk = () => [registro('marcadores', { tiempo: tiempoT }), registro('deducciones')] as Almacen[];
  const A = await nuevoDisp('A', mk(), 0, '0.12');
  const B = await nuevoDisp('B', mk(), 0, '0.12');
  A.almacen('marcadores').valores = { m1: { label: 'a', t: 1000 }, m2: { label: 'b', t: 1000 } };
  A.almacen('deducciones').valores = { d1: 3 };
  A.cambio('deducciones', 'd1', 1000);
  await pasada(A, repo, 1000);
  await pasada(B, repo, 1100);
  igual((JSON.parse(repo.texto!) as { version: number }).version, 1, 'la 0.12 escribe el formato 1');
  await cambiarVersion(A, '0.11');
  await pasada(A, repo, 2000);
  igual((JSON.parse(repo.texto!) as { version: number }).version, 2, 'la primera pasada de la 1.0 lo deja en el formato 2');
  await cambiarVersion(B, '0.11');
  await pasada(B, repo, 2100);
  await pasada(A, repo, 2200);
  delete B.almacen('marcadores').valores.m1;
  B.borrado('marcadores', 'm1', 3000);
  await pasada(B, repo, 3000);
  await pasada(A, repo, 3100);
  B.almacen('marcadores').valores.m1 = { label: 'a otra vez', t: 5000 };
  await pasada(B, repo, 5000);
  await cambiarVersion(A, '0.12');
  const texto = repo.texto;
  const commits = repo.commits;
  assert.equal(await pasada(A, repo, 6000), false);
  assert.match(ultimoError, /versión 2 del formato; actualice la aplicación/);
  igual(repo.texto, texto, 'la 0.12 no toca el fichero');
  igual(repo.commits, commits);
  igual(repo.vivos('marcadores').m1, { label: 'a otra vez', t: 5000 });
  await cambiarVersion(A, '0.11');
  await pasada(A, repo, 7000);
  await pasada(B, repo, 7100);
  igual(A.almacen('marcadores').valores.m1, { label: 'a otra vez', t: 5000 });
  igual(repo.vivos('marcadores').m1, { label: 'a otra vez', t: 5000 });
});

caso('r3·6 · la unión de rondas es asociativa, conmutativa e idempotente', async () => {
  const reg = (...ts: number[]): RegistroItem => ({ s: 'cap01/s', c: 'q', r: ts.map((t) => [t * M, 100]) as RegistroItem['r'] });
  const A = reg(0);
  const B = reg(6);
  const C = reg(12);
  igual(fusionarRegistros(fusionarRegistros(A, B), C), fusionarRegistros(A, fusionarRegistros(B, C)));
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const azar = (): RegistroItem => {
    const r: [number, number, ...1[]][] = [];
    let t = Math.floor(rnd() * 30) * M;
    for (let i = 0; i < 1 + Math.floor(rnd() * 8); i++) {
      t += Math.floor(rnd() * 25) * M;
      r.push(rnd() < 0.2 ? [t, 0, 1] : [t, [0, 60, 100][Math.floor(rnd() * 3)]!]);
    }
    return { s: 'c/s', c: 'q', r: r as RegistroItem['r'] };
  };
  for (let i = 0; i < 3000; i++) {
    const [a, b, c] = [azar(), azar(), azar()];
    igual(fusionarRegistros(a, b), fusionarRegistros(b, a), 'conmutativa');
    igual(fusionarRegistros(fusionarRegistros(a, b), c), fusionarRegistros(a, fusionarRegistros(b, c)), 'asociativa');
    const u = fusionarRegistros(a, b);
    igual(fusionarRegistros(u, u), u, 'idempotente');
    igual(fusionarRegistros(u, b), u, 'absorbente');
  }
});

caso('r3·7 · lo editado en otro almacén mientras se aplica uno no se pisa', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [registro('notas', { tiempo: tiempoT }), registro('marcadores', { tiempo: tiempoT })]);
  const B = await nuevoDisp('B', [registro('notas', { tiempo: tiempoT }), registro('marcadores', { tiempo: tiempoT })]);
  await pasada(A, repo, 1000);
  await pasada(B, repo, 1100);
  B.almacen('notas').valores.n = { texto: 'B', t: 2000 };
  B.almacen('marcadores').valores.m = { label: 'de B', t: 2000 };
  await pasada(B, repo, 2000);
  // while A applies the notes, the reader adds the same bookmark on A (a newer one)
  A.almacen('notas').alAplicar = () => {
    A.almacen('marcadores').valores.m = { label: 'de A, más nuevo', t: 3001 };
  };
  await pasada(A, repo, 3000);
  A.almacen('notas').alAplicar = undefined;
  igual(A.almacen('marcadores').valores.m, { label: 'de A, más nuevo', t: 3001 });
  await pasada(A, repo, 4000);
  await pasada(B, repo, 5000);
  igual(repo.vivos('marcadores').m, { label: 'de A, más nuevo', t: 3001 });
});

caso('r3·8 · una petición colgada no deja la sincronización bloqueada', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [registro('notas', { tiempo: tiempoT })]);
  repo.colgado = true;
  tiempos.reales = true;
  (globalThis as { __epaEsperaRed?: number }).__epaEsperaRed = 50;
  const ok = await Promise.race([pasada(A, repo, 1000), new Promise<string>((r) => setTimeout(() => r('colgada'), 3000))]);
  tiempos.reales = false;
  delete (globalThis as { __epaEsperaRed?: number }).__epaEsperaRed;
  repo.colgado = false;
  assert.equal(ok, false, 'la pasada termina con error');
  assert.ok(/tard|respond/i.test(ultimoError), ultimoError);
  assert.equal(await pasada(A, repo, 2000), true, 'la siguiente funciona');
});

caso('r3·1 · dos pestañas del mismo dispositivo no se pisan (Guardado) y sincronizan una tras otra', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [guardado('marcadores', { tiempo: tiempoT })]);
  const p1 = A.pestanas[0]!;
  const p2 = await nuevaPestana(A);
  await p1.editar('marcadores', { a: { label: 'a', t: 1000 } });
  await p2.editar('marcadores', { b: { label: 'b', t: 1100 } });
  igual(Object.keys(p2.mem('marcadores')).sort(), ['a', 'b']);
  await p1.editar('marcadores', {}, ['a']);
  await pasada(A, repo, 2000, { pestana: p2 });
  await pasada(A, repo, 2100, { pestana: p1 });
  igual(Object.keys(repo.vivos('marcadores')), ['b']);
  igual(Object.keys(almacenamiento(A).has('g:marcadores') ? JSON.parse(almacenamiento(A).get('g:marcadores')!) : {}), ['b']);
});

caso('r3·1 · las marcas de una pestaña no pisan las de otra (un borrado sin marca ya no se enviaría)', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [guardado('marcadores', { tiempo: tiempoT }), guardado('notas', { tiempo: tiempoT })]);
  const B = await nuevoDisp('B', [guardado('marcadores', { tiempo: tiempoT }), guardado('notas', { tiempo: tiempoT })]);
  const p1 = A.pestanas[0]!;
  reloj.ahora = 1000;
  await p1.editar('marcadores', { x: { label: 'x', t: 1000 }, y: { label: 'y', t: 1000 } });
  await pasada(A, repo, 2000);
  await pasada(B, repo, 2100);
  const p2 = await nuevaPestana(A);
  // the second tab deletes x (its mark is stored)…
  reloj.ahora = 3000;
  await p2.editar('marcadores', {}, ['x']);
  // …then the first tab, which loaded its marks before, writes one of its own
  reloj.ahora = 3100;
  await p1.editar('notas', { n: { texto: 'n', t: 3100 } });
  assert.ok(A.marcas.borrados.marcadores?.x, `la marca del borrado sigue guardada: ${JSON.stringify(A.marcas)}`);
  await pasada(A, repo, 4000, { pestana: p1 });
  await pasada(B, repo, 4100);
  igual(Object.keys(repo.vivos('marcadores')), ['y']);
  igual(Object.keys(B.almacen('marcadores').valores), ['y']);
  igual(Object.keys(repo.vivos('notas')), ['n']);
  reloj.ahora = 0;
});

caso('r3·1 · un borrado que el almacenamiento rechazó se envía en la siguiente pasada de su pestaña, aunque otra sincronizara antes', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [guardado('notas', { tiempo: tiempoT })]);
  const p1 = A.pestanas[0]!;
  reloj.ahora = 1000;
  await p1.editar('notas', { a: { texto: 'a', t: 1000 }, b: { texto: 'b', t: 1000 } });
  await pasada(A, repo, 2000);
  const p2 = await nuevaPestana(A);
  // p2 deletes a, but the storage refuses the write: the deletion lives only in p2's memory
  fallarEscritura(A, 'g:notas');
  reloj.ahora = 3000;
  await p2.editar('notas', {}, ['a']).catch(() => undefined);
  fallarEscritura(A, 'g:notas', false);
  // p1 synchronises first (its copy still has a: the mark of the deletion is seen and forgotten)…
  await pasada(A, repo, 4000, { pestana: p1 });
  // …then p2's run sends its deletion and writes it
  await pasada(A, repo, 5000, { pestana: p2 });
  await pasada(A, repo, 6000, { pestana: p1 });
  igual(Object.keys(repo.vivos('notas')), ['b']);
  igual(Object.keys(A.almacen('notas').valores), ['b']);
  igual(Object.keys(p1.mem('notas')), ['b']);
  reloj.ahora = 0;
});

caso('r3·1 · un cambio pendiente ya enviado no vuelve sobre un borrado posterior de otro dispositivo', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [guardado('notas', { tiempo: () => undefined })]);
  const B = await nuevoDisp('B', [guardado('notas', { tiempo: () => undefined })]);
  const p1 = A.pestanas[0]!;
  reloj.ahora = 1000;
  await p1.editar('notas', { n: { texto: 'v1' } });
  await pasada(A, repo, 1500);
  const p2 = await nuevaPestana(A);
  // p1 changes the note while A's storage refuses it: the change is only in p1's memory (pending, marked)
  fallarEscritura(A, 'g:notas');
  reloj.ahora = 2000;
  await p1.editar('notas', { n: { texto: 'v2' } }).catch(() => undefined);
  await pasada(A, repo, 2500, { pestana: p1 });
  igual(repo.vivos('notas'), { n: { texto: 'v2' } });
  // B gets v2 and deletes the note
  await pasada(B, repo, 2600);
  reloj.ahora = 3000;
  await B.pestanas[0]!.editar('notas', {}, ['n']);
  await pasada(B, repo, 3100);
  // A's storage works again; the other tab synchronises first (the deletion is recorded), then p1
  fallarEscritura(A, 'g:notas', false);
  await pasada(A, repo, 4000, { pestana: p2 });
  await pasada(A, repo, 5000, { pestana: p1 });
  await pasada(B, repo, 5100);
  igual(repo.vivos('notas'), {}, 'B borró la nota sabiendo de v2: no vuelve');
  igual(p1.mem('notas'), {});
  igual(A.almacen('notas').valores, {});
  reloj.ahora = 0;
});

caso('r3·1 · la marca del cambio pendiente de una pestaña no hace pasar por nueva la copia vieja de otra', async () => {
  const repo = nuevoRepo();
  const B = await nuevoDisp('B', [guardado('notas', { tiempo: () => undefined })]);
  const D = await nuevoDisp('D', [guardado('notas', { tiempo: () => undefined })]);
  const p1 = B.pestanas[0]!;
  reloj.ahora = 1000;
  // (the old value sorts after the new one: at an equal time the content would decide for the old)
  await p1.editar('notas', { n: { texto: 'z vieja' } });
  await pasada(B, repo, 1500);
  const p2 = await nuevaPestana(B);
  reloj.ahora = 1800;
  await D.pestanas[0]!.editar('notas', { m: { texto: 'de D' } });
  await pasada(D, repo, 1900);
  // p2 changes the note while B's storage refuses it (pending, marked); its run sends it, and fails to store m: the
  // store's marks are kept
  fallarEscritura(B, 'g:notas');
  reloj.ahora = 2000;
  await p2.editar('notas', { n: { texto: 'a nueva' } }).catch(() => undefined);
  await pasada(B, repo, 2500, { pestana: p2 });
  igual(repo.vivos('notas').n, { texto: 'a nueva' });
  fallarEscritura(B, 'g:notas', false);
  // p1 still holds the old value and runs first: p2's mark must not date p1's old copy as a change
  await pasada(B, repo, 3000, { pestana: p1 });
  await pasada(B, repo, 3500, { pestana: p2 });
  await pasada(B, repo, 4000, { pestana: p1 });
  igual(repo.vivos('notas').n, { texto: 'a nueva' });
  igual(p1.mem('notas').n, { texto: 'a nueva' });
  igual(B.almacen('notas').valores.n, { texto: 'a nueva' });
  reloj.ahora = 0;
});

caso('r3·1 · la marca de un valor no vale para otro valor del mismo elemento (otra pestaña, cambio pendiente)', async () => {
  const repo = nuevoRepo();
  const B = await nuevoDisp('B', [guardado('notas', { tiempo: () => undefined })]);
  const p1 = B.pestanas[0]!;
  reloj.ahora = 1000;
  await p1.editar('notas', { n: { texto: 'uno' } });
  await pasada(B, repo, 1500);
  const p2 = await nuevaPestana(B);
  // p2 stores a change…
  reloj.ahora = 2000;
  await p2.editar('notas', { n: { texto: 'z dos' } });
  // …and then another one the storage refuses (pending in p2; its mark replaces the first one's)
  fallarEscritura(B, 'g:notas');
  reloj.ahora = 2100;
  await p2.editar('notas', { n: { texto: 'a tres' } }).catch(() => undefined);
  fallarEscritura(B, 'g:notas', false);
  // p1 synchronises the stored value ('z dos'): the mark is for 'a tres', not for it
  await pasada(B, repo, 3000, { pestana: p1 });
  await pasada(B, repo, 3500, { pestana: p2 });
  await pasada(B, repo, 4000, { pestana: p1 });
  igual(repo.vivos('notas').n, { texto: 'a tres' });
  igual(p1.mem('notas').n, { texto: 'a tres' });
  igual(B.almacen('notas').valores.n, { texto: 'a tres' });
  reloj.ahora = 0;
});

// ------------------------------------------------------------------ fourth review: races in guardado.ts

type GuardadoPrueba = { escribir(): Promise<void>; aplicar(p: Record<string, unknown>, q: string[]): Promise<void> };
const gd = (p: { guardados: Map<string, unknown> }, k: string) => p.guardados.get(k) as GuardadoPrueba;
const notasDe = (d: Disp) => JSON.parse(almacenamiento(d).get('g:notas') ?? '{}') as Record<string, { texto: string }>;

caso('r4·1 · dos escrituras seguidas de una pestaña no borran lo que guardó otra (memoria leída dentro de la cola)', async () => {
  const A = await nuevoDisp('A', [guardado('notas', { tiempo: tiempoT })]);
  const a = A.pestanas[0]!;
  reloj.ahora = 1000;
  await a.editar('notas', { x: { texto: 'x', t: 1000 } });
  const b = await nuevaPestana(A);
  reloj.ahora = 2000;
  await b.editar('notas', { z: { texto: 'nueva en B', t: 2000 } });
  // two quick writes in tab a (two clicks; an autosave right before a rename)
  reloj.ahora = 3000;
  a.mem('notas').x = { texto: 'x1', t: 3000 };
  const p1 = gd(a, 'notas').escribir();
  a.mem('notas').x = { texto: 'x2', t: 3001 };
  const p2 = gd(a, 'notas').escribir();
  await p1;
  await p2;
  igual(Object.keys(notasDe(A)).sort(), ['x', 'z'], 'z sigue guardada');
  assert.equal(A.marcas.borrados.notas?.z, undefined, 'sin marca de borrado de z');
  igual(notasDe(A).x, { texto: 'x2', t: 3001 });
  reloj.ahora = 0;
});

caso('r4·1 · una escritura del lector mientras se aplica la sincronización no guarda la copia vieja marcada', async () => {
  const A = await nuevoDisp('A', [guardado('notas', { tiempo: tiempoT })]);
  const a = A.pestanas[0]!;
  reloj.ahora = 1000;
  await a.editar('notas', { x: { texto: 'viejo', t: 100 }, y: { texto: 'y', t: 100 } });
  reloj.ahora = 5000;
  const p = gd(a, 'notas').aplicar({ x: { texto: 'NUEVO de otro dispositivo', t: 4000 } }, []);
  // the reader edits y right now; its (debounced) write fires while aplicar is still queued
  a.mem('notas').y = { texto: 'y editada', t: 5001 };
  const q = gd(a, 'notas').escribir();
  await p;
  await q;
  igual(notasDe(A).x, { texto: 'NUEVO de otro dispositivo', t: 4000 });
  igual(notasDe(A).y, { texto: 'y editada', t: 5001 });
  igual(a.mem('notas').x, { texto: 'NUEVO de otro dispositivo', t: 4000 });
  // (x's mark at 1000 is the reader's creation of x, never synchronised)
  assert.ok(!((A.marcas.cambios.notas?.x ?? 0) >= 5000), `x no se marca otra vez como cambio del lector: ${JSON.stringify(A.marcas)}`);
  reloj.ahora = 0;
});

caso('r4·2 · aplicar deja en memoria lo que quedó guardado (otra pestaña guardó una x más nueva)', async () => {
  const A = await nuevoDisp('A', [guardado('notas', { tiempo: tiempoT })]);
  const a = A.pestanas[0]!;
  reloj.ahora = 1000;
  await a.editar('notas', { x: { texto: 'base', t: 100 }, y: { texto: 'y', t: 100 }, z: { texto: 'z0', t: 100 } });
  const b = await nuevaPestana(A);
  reloj.ahora = 2000;
  await b.editar('notas', { x: { texto: 'edición en B', t: 2000 }, z: { texto: 'z cambiada en B', t: 2000 } });
  // a applies an older x from the file and the deletion of z (it did not see b's write: no storage event)
  reloj.ahora = 2100;
  await gd(a, 'notas').aplicar({ x: { texto: 'del fichero', t: 1500 } }, ['z']);
  igual(notasDe(A).x, { texto: 'edición en B', t: 2000 });
  igual(a.mem('notas').x, notasDe(A).x, 'la memoria es lo guardado');
  igual(notasDe(A).z, { texto: 'z cambiada en B', t: 2000 }, 'el cambio de la otra pestaña gana al borrado');
  igual(a.mem('notas').z, notasDe(A).z);
  // a's reader edits only y: neither x nor z is marked as a's change
  reloj.ahora = 3000;
  await a.editar('notas', { y: { texto: 'y editada en A', t: 3000 } });
  igual(notasDe(A).x, { texto: 'edición en B', t: 2000 });
  igual(notasDe(A).z, { texto: 'z cambiada en B', t: 2000 });
  const m = A.marcas;
  assert.ok(!(m.cambios.notas?.x > 2100), `x no marcada por a: ${JSON.stringify(m)}`);
  assert.equal(m.borrados.notas?.z, undefined);
  reloj.ahora = 0;
});

caso('r4·1 · un cambio pendiente (escritura rechazada) no gana al cambio posterior de otra pestaña', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [guardado('notas', { tiempo: () => undefined })]);
  const a = A.pestanas[0]!;
  reloj.ahora = 1000;
  await a.editar('notas', { n: { texto: 'uno' }, m: { texto: 'm' } });
  await pasada(A, repo, 1500);
  const b = await nuevaPestana(A);
  fallarEscritura(A, 'g:notas');
  reloj.ahora = 2000;
  await a.editar('notas', { n: { texto: 'vieja, pendiente' } }).catch(() => undefined);
  fallarEscritura(A, 'g:notas', false);
  reloj.ahora = 3000;
  await b.editar('notas', { n: { texto: 'nueva, en la otra pestaña' } });
  // a writes again (its pending change goes with it): the other tab's later change stays
  reloj.ahora = 3500;
  await a.editar('notas', { m: { texto: 'm2' } });
  igual(notasDe(A).n, { texto: 'nueva, en la otra pestaña' });
  igual(a.mem('notas').n, { texto: 'nueva, en la otra pestaña' });
  await pasada(A, repo, 4000, { pestana: a });
  igual(repo.vivos('notas'), { n: { texto: 'nueva, en la otra pestaña' }, m: { texto: 'm2' } });
  reloj.ahora = 0;
});

caso('r4·4 · un registro dañado en sinc-estado (null, número, texto) no detiene ninguna pasada', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [guardado('notas', { tiempo: tiempoT })]);
  reloj.ahora = 1000;
  await A.pestanas[0]!.editar('notas', { a: { texto: 'a', t: 1000 }, b: { texto: 'b', t: 1000 } });
  await pasada(A, repo, 1500);
  const e = JSON.parse(almacenamiento(A).get('sinc-estado')!) as { items: Record<string, Record<string, unknown>>; borrados?: Record<string, unknown> };
  e.items.notas!.a = null;
  // (an item no longer here, with a null record: the case that made every run throw)
  e.items.notas!.zz = null;
  e.items.notas!.c = 5;
  e.items.notas!.d = 'x';
  e.items.otro = null as unknown as Record<string, unknown>;
  e.borrados = { notas: null, x: 3 };
  almacenamiento(A).set('sinc-estado', JSON.stringify(e));
  // the next start reads the damaged record
  await cambiarVersion(A, '0.11');
  reloj.ahora = 2000;
  await A.pestanas[0]!.editar('notas', { b: { texto: 'b2', t: 2000 } });
  assert.ok(await pasada(A, repo, 2500), `la pasada escribe el cambio (error: ${ultimoError})`);
  igual(repo.vivos('notas'), { a: { texto: 'a', t: 1000 }, b: { texto: 'b2', t: 2000 } });
  reloj.ahora = 0;
});

// ------------------------------------------------------------------ fifth review: the Tauri path, loading

const vivo = (d: Disp, k: string) => Object.keys(JSON.parse(almacenamiento(d).get(k) ?? '{}')).sort();
const espera = () => new Promise((r) => setTimeout(r, 0));

caso('r5·1 · Tauri: una escritura sin haber cargado la clave (o tras una carga fallida) no borra lo guardado', async () => {
  for (const como of ['sin cargar', 'carga fallida', 'aplicar tras carga fallida', 'cargada']) {
    const T = await nuevoDisp('T', [], 0, '0.11', { tauri: true });
    almacenamiento(T).set('notas', JSON.stringify({ a: { texto: 'a', t: 1 }, b: { texto: 'b', t: 1 } }));
    const { g, memoria } = await guardadoSuelto(T, 'notas', { tiempo: tiempoT });
    reloj.ahora = 1000;
    if (como === 'carga fallida' || como === 'aplicar tras carga fallida') {
      fallarLectura(T, 'notas');
      // (the module catches it and goes on with an empty memory, as the editor does)
      memoria.m = await g.cargar((m) => (memoria.m = m)).catch(() => ({}));
      fallarLectura(T, 'notas', false);
    }
    if (como === 'cargada') await g.cargar((m) => (memoria.m = m));
    if (como === 'aplicar tras carga fallida') await g.aplicar({ c: { texto: 'del fichero', t: 900 } }, []);
    else {
      memoria.m.nuevo = { texto: 'nuevo', t: 1000 };
      await g.escribir();
    }
    const esperado = como === 'aplicar tras carga fallida' ? ['a', 'b', 'c'] : ['a', 'b', 'nuevo'];
    igual(vivo(T, 'notas'), esperado, `${como}: lo guardado sigue`);
    assert.equal(T.marcas.borrados.notas, undefined, `${como}: sin marcas de borrado`);
    reloj.ahora = 0;
  }
});

caso('r5·1 · Tauri: si la lectura falla, la escritura falla y no toca lo guardado', async () => {
  const T = await nuevoDisp('T', [], 0, '0.11', { tauri: true });
  almacenamiento(T).set('notas', JSON.stringify({ a: { texto: 'a', t: 1 } }));
  const { g, memoria } = await guardadoSuelto(T, 'notas', { tiempo: tiempoT });
  fallarLectura(T, 'notas');
  memoria.m = await g.cargar((m) => (memoria.m = m)).catch(() => ({}));
  memoria.m.nuevo = { texto: 'nuevo', t: 1000 };
  const r = await g.escribir().then(() => 'escrita', () => 'rechazada');
  assert.equal(r, 'rechazada');
  igual(vivo(T, 'notas'), ['a']);
  fallarLectura(T, 'notas', false);
  await g.escribir();
  igual(vivo(T, 'notas'), ['a', 'nuevo']);
});

caso('r5·2 · Tauri: una escritura entre la lectura de la carga y su adopción no da todo por borrado', async () => {
  const T = await nuevoDisp('T', [], 0, '0.11', { tauri: true });
  almacenamiento(T).set('marcadores', JSON.stringify({ m1: { label: 'm1', t: 1 }, m2: { label: 'm2', t: 1 } }));
  const { g, memoria } = await guardadoSuelto(T, 'marcadores', { tiempo: tiempoT });
  reloj.ahora = 1000;
  // the module loads several keys at once (a slower one keeps its Promise.all open) and adopts each key in its load
  const lento = (async () => {
    for (let i = 0; i < 6; i++) await espera();
  })();
  const carga = Promise.all([lento, g.cargar((m) => (memoria.m = { ...m, ...memoria.m }))]);
  // the reader toggles a bookmark on the page already shown: its write is queued during the load
  memoria.m.m3 = { label: 'm3', t: 1000 };
  const w = g.escribir();
  await carga;
  await w;
  igual(vivo(T, 'marcadores'), ['m1', 'm2', 'm3']);
  igual(Object.keys(memoria.m).sort(), ['m1', 'm2', 'm3']);
  assert.equal(T.marcas.borrados.marcadores, undefined, `sin borrados: ${JSON.stringify(T.marcas)}`);
  reloj.ahora = 0;
});

caso('r5·3 · Tauri: la edición del lector mientras aplicar espera en la cola queda marcada', async () => {
  const T = await nuevoDisp('T', [], 0, '0.11', { tauri: true });
  almacenamiento(T).set('repaso-diario', JSON.stringify({ d1: { r: 1 }, d2: { r: 5 } }));
  const { g, memoria } = await guardadoSuelto(T, 'repaso-diario');
  await g.cargar((m) => (memoria.m = m));
  reloj.ahora = 1000;
  memoria.m.d1 = { r: 2 };
  const w = g.escribir();
  await espera();
  const ap = g.aplicar({ d0: { r: 9 } }, []);
  await espera();
  reloj.ahora = 1100;
  memoria.m.d2 = { r: 6 };
  await Promise.all([w, ap]);
  await g.volcar();
  igual(JSON.parse(almacenamiento(T).get('repaso-diario')!), { d0: { r: 9 }, d1: { r: 2 }, d2: { r: 6 } });
  assert.ok(T.marcas.cambios['repaso-diario']?.d2, `d2 marcada: ${JSON.stringify(T.marcas)}`);
  assert.equal(T.marcas.cambios['repaso-diario']?.d0, undefined, 'lo aplicado no se marca');
  reloj.ahora = 0;
});

caso('r5·4 · navegador: lo que otra pestaña borró mientras se aplicaba la sincronización sigue borrado', async () => {
  const A = await nuevoDisp('A', [guardado('notas', { tiempo: tiempoT })]);
  const a = A.pestanas[0]!;
  reloj.ahora = 1000;
  await a.editar('notas', { x: { texto: 'v1', t: 1 }, y: { texto: 'y', t: 1 } });
  const b = await nuevaPestana(A);
  reloj.ahora = 2000;
  await b.editar('notas', {}, ['x']);
  // a applies a newer x from the file (its run read the store before b's deletion)
  await gd(a, 'notas').aplicar({ x: { texto: 'remoto', t: 50 } }, []);
  igual(Object.keys(notasDe(A)).sort(), ['y']);
  assert.equal(a.mem('notas').x, undefined);
  assert.ok(A.marcas.borrados.notas?.x, 'la marca del borrado sigue');
  reloj.ahora = 0;
});

caso('r5·5 · navegador: si no se pueden guardar las marcas, el cambio queda pendiente y se marca después', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [guardado('notas', { tiempo: tiempoT })]);
  const a = A.pestanas[0]!;
  reloj.ahora = 1000;
  await a.editar('notas', { x: { texto: 'v1', t: 1000 }, y: { texto: 'y', t: 1000 } });
  await pasada(A, repo, 1500);
  // storage full: the marks cannot be written; the deletion (smaller data) can
  fallarEscritura(A, 'sinc-marcas');
  reloj.ahora = 2000;
  await a.editar('notas', {}, ['x']);
  igual(vivo(A, 'g:notas'), ['y']);
  fallarEscritura(A, 'sinc-marcas', false);
  // the page is hidden (pending writes flushed) and the app closes before synchronising
  await gd(a, 'notas').escribir().catch(() => undefined);
  await (a.guardados.get('notas') as unknown as { volcar(): Promise<void> }).volcar();
  assert.ok(A.marcas.borrados.notas?.x, `la marca del borrado está guardada: ${JSON.stringify(A.marcas)}`);
  await cambiarVersion(A, '0.11');
  await pasada(A, repo, 3000);
  igual(Object.keys(repo.vivos('notas')), ['y']);
  reloj.ahora = 0;
});

// ------------------------------------------------------------------ sixth review

caso('r6·1 · una lectura fallida de sinc-marcas no borra las marcas guardadas (Tauri y navegador)', async () => {
  for (const tauri of [true, false]) {
    const repo = nuevoRepo();
    const A = await nuevoDisp('A', [guardado('notas')], 0, '0.11', { tauri });
    const a = A.pestanas[0]!;
    reloj.ahora = 1000;
    await a.editar('notas', { n1: { texto: 'v1' }, n2: { texto: 'otra' } });
    await pasada(A, repo, 1500);
    // n1 edited offline (marked); then n2 while one read of the marks fails
    reloj.ahora = 2000;
    await a.editar('notas', { n1: { texto: 'v2' } });
    reloj.ahora = 2500;
    fallarLectura(A, 'sinc-marcas');
    await a.editar('notas', { n2: { texto: 'otra editada' } }).catch(() => undefined);
    fallarLectura(A, 'sinc-marcas', false);
    assert.ok(A.marcas.cambios.notas?.n1, `${tauri ? 'Tauri' : 'navegador'}: la marca de n1 sigue guardada: ${JSON.stringify(A.marcas)}`);
    await pasada(A, repo, 3000);
    igual(repo.vivos('notas'), { n1: { texto: 'v2' }, n2: { texto: 'otra editada' } }, tauri ? 'Tauri' : 'navegador');
    reloj.ahora = 0;
  }
});

caso('r6·2 · una escritura rechazada al leer se repite al ocultar la página (volcar) y no se pierde', async () => {
  const T = await nuevoDisp('T', [], 0, '0.11', { tauri: true });
  almacenamiento(T).set('editor-circuitos', JSON.stringify({ c1: { id: 'c1', actualizado: 1 } }));
  const { g, memoria } = await guardadoSuelto(T, 'editor-circuitos', { tiempo: (v) => (v as { actualizado: number }).actualizado });
  fallarLectura(T, 'editor-circuitos');
  await g.cargar((m) => (memoria.m = { ...m, ...memoria.m })).catch(() => undefined);
  memoria.m.nuevo = { id: 'nuevo', actualizado: 10 };
  assert.equal(await g.escribir().then(() => 'ok', () => 'rechazada'), 'rechazada');
  fallarLectura(T, 'editor-circuitos', false);
  // the page is hidden: the module flushes
  await g.volcar();
  igual(vivo(T, 'editor-circuitos'), ['c1', 'nuevo']);
  igual(Object.keys(memoria.m).sort(), ['c1', 'nuevo']);
});

caso('r6·3 · un dispositivo nulo o mal formado en el fichero no rompe las pasadas', async () => {
  for (const malo of [null, 'texto', { nombre: 5 }, 7]) {
    const repo = nuevoRepo();
    const A = await nuevoDisp('A', [guardado('notas')]);
    reloj.ahora = 1000;
    await A.pestanas[0]!.editar('notas', { n1: { texto: 'v1' } });
    await pasada(A, repo, 1500);
    const d = JSON.parse(repo.texto!) as { dispositivos: Record<string, unknown> };
    d.dispositivos.roto = malo;
    repo.texto = JSON.stringify(d);
    repo.doc = JSON.parse(repo.texto);
    await A.pestanas[0]!.editar('notas', { n2: { texto: 'v2' } });
    assert.ok(await pasada(A, repo, 2500), `${JSON.stringify(malo)}: la pasada escribe (${ultimoError})`);
    assert.equal(ultimoError, '', JSON.stringify(malo));
    igual(Object.keys(A.estado.items.notas ?? {}).sort(), ['n1', 'n2'], `${JSON.stringify(malo)}: el registro se guarda`);
    const doc = JSON.parse(repo.texto!) as { dispositivos: Record<string, { nombre?: unknown }> };
    for (const [id, x] of Object.entries(doc.dispositivos)) assert.ok(x && typeof x.nombre === 'string', `${JSON.stringify(malo)}: el fichero queda sano (${id})`);
    reloj.ahora = 0;
  }
});

caso('r6·4 · Tauri: lo que el lector edita durante la escritura de aplicar no se pierde', async () => {
  const T = await nuevoDisp('T', [], 0, '0.11', { tauri: true });
  almacenamiento(T).set('notas', JSON.stringify({ x: { texto: 'v0', t: 1 } }));
  const { g, memoria } = await guardadoSuelto(T, 'notas', { tiempo: tiempoT });
  await g.cargar((m) => (memoria.m = m));
  reloj.ahora = 1000;
  // the reader edits x while aplicar's write is in its IPC wait
  const gg = globalThis as { __alEscribir?: (d: string, c: string) => void };
  gg.__alEscribir = (_d, c) => {
    if (c !== 'notas') return;
    gg.__alEscribir = undefined;
    memoria.m.x = { texto: 'del lector', t: 30 };
    g.guardar(0);
  };
  await g.aplicar({ x: { texto: 'remoto', t: 20 } }, []);
  gg.__alEscribir = undefined;
  await g.volcar();
  for (let i = 0; i < 4; i++) await espera();
  await g.volcar();
  igual(memoria.m.x, { texto: 'del lector', t: 30 });
  igual(JSON.parse(almacenamiento(T).get('notas')!).x, { texto: 'del lector', t: 30 });
  assert.ok(T.marcas.cambios.notas?.x, `x marcada: ${JSON.stringify(T.marcas)}`);
  reloj.ahora = 0;
});

caso('r6·5 · tras una carga fallida, aplicar sí aplica un borrado y un cambio sin hora propia', async () => {
  const T = await nuevoDisp('T', [], 0, '0.11', { tauri: true });
  almacenamiento(T).set('fav', JSON.stringify({ a: { v: 1 }, x: { v: 1 }, y: { v: 'viejo' } }));
  const { g, memoria } = await guardadoSuelto(T, 'fav');
  fallarLectura(T, 'fav');
  await g.cargar((m) => (memoria.m = m)).catch(() => undefined);
  fallarLectura(T, 'fav', false);
  await g.aplicar({ y: { v: 'nuevo del fichero' } }, ['x']);
  igual(JSON.parse(almacenamiento(T).get('fav')!), { a: { v: 1 }, y: { v: 'nuevo del fichero' } });
  igual(memoria.m, { a: { v: 1 }, y: { v: 'nuevo del fichero' } });
});

caso('r6 · menor: reintentar la carga no resucita lo que el lector borró y aún no está escrito', async () => {
  const T = await nuevoDisp('T', [], 0, '0.11', { tauri: true });
  almacenamiento(T).set('notas', JSON.stringify({ a: { texto: 'a', t: 1 }, b: { texto: 'b', t: 1 } }));
  const { g, memoria } = await guardadoSuelto(T, 'notas', { tiempo: tiempoT });
  fallarLectura(T, 'notas');
  await g.cargar((m) => (memoria.m = { ...m, ...memoria.m })).catch(() => undefined);
  fallarLectura(T, 'notas', false);
  // a write brings what is stored into memory; the reader deletes a, and that write is refused
  memoria.m.c = { texto: 'c', t: 5 };
  await g.escribir();
  igual(Object.keys(memoria.m).sort(), ['a', 'b', 'c']);
  fallarEscritura(T, 'notas');
  delete memoria.m.a;
  await g.escribir().catch(() => undefined);
  fallarEscritura(T, 'notas', false);
  // the module retries its load (as after a failure) with the usual adoption
  await g.cargar((m) => (memoria.m = { ...m, ...memoria.m }));
  igual(Object.keys(memoria.m).sort(), ['b', 'c'], 'a sigue borrada');
  await g.volcar();
  igual(vivo(T, 'notas'), ['b', 'c']);
});

caso('r3·1 · una marca hecha por otra pestaña durante la pasada no se olvida', async () => {
  const repo = nuevoRepo();
  const A = await nuevoDisp('A', [guardado('notas', { tiempo: tiempoT })]);
  const p1 = A.pestanas[0]!;
  reloj.ahora = 1000;
  await p1.editar('notas', { a: { texto: 'a', t: 1000 } });
  await pasada(A, repo, 2000);
  const p2 = await nuevaPestana(A);
  // while p1 runs, p2 deletes a (mark dated before the run's end; the run never saw it)
  await pasada(A, repo, 3000, {
    pestana: p1,
    durante: () => {
      reloj.ahora = 2999;
      void p2.editar('notas', {}, ['a']);
    },
  });
  // the next run is p1's again (or the app's after a restart): the mark must be in the storage
  await pasada(A, repo, 4000, { pestana: p1 });
  igual(Object.keys(repo.vivos('notas')), []);
  reloj.ahora = 0;
});

export async function correrCasos(filtro = ''): Promise<{ nombre: string; ok: boolean; error?: string }[]> {
  const r: { nombre: string; ok: boolean; error?: string }[] = [];
  for (const [nombre, f] of casos) {
    if (filtro && !nombre.includes(filtro)) continue;
    try {
      await f();
      r.push({ nombre, ok: true });
    } catch (e) {
      r.push({ nombre, ok: false, error: String((e as Error).message ?? e).split('\n').slice(0, 14).join('\n') });
    }
  }
  return r;
}
