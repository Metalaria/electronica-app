// The randomized simulation of the synchronisation on the REAL engine (arnes.ts), run by revision11-motor.spec.ts.
// Three 0.11 devices — each may open a second browser tab; in every other trial B's storage is like Tauri's (one
// window, values, IPC round trips: fifth review) — an 0.10 device and, half-way, a fresh install; offline
// edits and deletions on: a register with a time of its own (`reg`: one device rejects some of its values, as an older
// version would), a register without one (`sin`), a union store (`conj`) — those three through a real `Guardado`
// (module memory per tab, apart from the device's storage; read-merge-write; atomic application) — and a module
// without Guardado that is not atomic (`crudo`: memory changed, then the write fails). Also: the storage refusing
// writes, clock skew, runs interrupted after the PUT, edits during a run, another device writing between a run's GET
// and PUT (409). Then every device runs in turn until nothing changes.
// Knowledge tracking: a value carries the id of the user operation that wrote it (`op`; a union's elements are
// operation ids); an operation supersedes what the copy it was made on reflected (the tab's memory, or the device's
// storage). Checked: the final value comes from an operation nobody superseded (no loss), a deletion is one nobody
// superseded (no resurrection), a union keeps every element, every device and tab holds what the file has, and the
// commits stop.
// 0.12: the 0.11 devices also keep the daily progress with the app's REAL module (progreso-diario.svelte.ts, one per
// tab: its activity summed across devices) — checked at the end against the activity done, day by day, on every
// device and tab: exactly the sum, never counted twice —, and a device sometimes exports a backup (copia.ts) and one
// imports a backup made earlier on any device («unir»): what it brings counts as known, like a synchronisation.
// 1.0 (compatibility with 0.10/0.11 clients dropped): the 0.10 device is gone; instead W runs 0.12.0 — its engine, its
// Guardado, its daily-progress, repaso and backup modules, from git (arnes.ts) — and is updated to this version at a
// random step (its pending writes flushed first, as the updater does; its storage migrated, lib/migrar.ts). While on
// 0.12 its runs against a file of format 2 are refused («actualice la aplicación»: what it did waits on it, and counts
// as unknown to the file) and it must never write such a file; its backups (format 1) imported by the others are
// migrated, theirs (format 2) refused by it. Checked as for every device: nothing it did is lost once it is updated.
import { REENVIOS_MAXIMOS, huella } from '../../src/lib/sincronizacion/fusion.ts';
import { claveDia } from '../../src/componentes/repaso/srs.ts';
import {
  almacenamiento,
  cambiarVersion,
  esTauri,
  fallarEscritura,
  fallarLectura,
  guardado,
  nuevaPestana,
  nuevoDisp,
  nuevoRepo,
  pasada,
  registro,
  reloj,
  ultimoError,
  type Almacen,
  type Disp,
  type OpcionesPasada,
  type Pestana,
} from './arnes.ts';

const M = 60_000;
const tiempoT = (v: unknown) => (typeof (v as { t?: unknown })?.t === 'number' ? (v as { t: number }).t : undefined);

/** mulberry32 */
export function azar(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Op {
  id: string;
  /** «store/item» */
  clave: string;
  borrado: boolean;
  /** what the copy it was made on reflected */
  supera: Set<string>;
}

export interface ResultadoPrueba {
  problemas: string[];
  commitsAsentar: number;
  /** Runs of W refused while it was on 0.12 (the file already in format 2). */
  rechazos012?: number;
}

type Conj = { s: string[] };
const unirConj = (a: unknown, b: unknown): Conj => ({ s: [...new Set([...(a as Conj).s, ...(b as Conj).s])].sort() });

export async function simularPrueba(prueba: number): Promise<ResultadoPrueba> {
  const problemas: string[] = [];
  const rnd = azar(7000 + prueba);
  // TRAZA=<n>: the events of trial n on stderr
  const log = process.env.TRAZA === String(prueba) ? (...a: unknown[]) => console.error(...a) : () => {};
  const repo = nuevoRepo();
  const ops = new Map<string, Op>();
  let nOp = 0;
  // knowledge per holder («A»: A's storage; «A#1»: the memory of A's second tab; «fichero»), per «store/item»
  const saber = new Map<string, Map<string, Set<string>>>();
  const de = (quien: string, k: string) => {
    const m = saber.get(quien) ?? saber.set(quien, new Map()).get(quien)!;
    return m.get(k) ?? m.set(k, new Set()).get(k)!;
  };
  const sumar = (a: string, b: string, k: string) => {
    for (const x of de(b, k)) de(a, k).add(x);
  };
  const rechazaFuturo = (v: unknown) => !(v as { futuro?: boolean }).futuro;
  const almacenes011 = (rechaza: boolean): Almacen[] => [
    guardado('reg', { vivo: true, tiempo: tiempoT, valido: rechaza ? rechazaFuturo : undefined, porDefecto: (id) => (id === 'cfg' ? { op: 'def', t: 0 } : undefined) }),
    guardado('sin', { porDefecto: (id) => (id === 'aj' ? { op: 'def' } : undefined) }),
    guardado('conj', { unir: unirConj }),
    registro('crudo', { tiempo: tiempoT }),
    { diario: true, clave: 'progreso-diario' },
  ];
  const desfase = () => Math.round((rnd() - 0.5) * 20 * M);
  const devs: Disp[] = [await nuevoDisp('A', almacenes011(false), desfase()), await nuevoDisp('B', almacenes011(false), desfase(), '0.11', { tauri: prueba % 2 === 0 }), await nuevoDisp('C', almacenes011(true), desfase())];
  // (1.0: W on 0.12.0, updated at step `pasoW`)
  const W = await nuevoDisp('W', almacenes011(false), desfase(), '0.12', { tauri: prueba % 3 === 0 });
  devs.push(W);
  const pasoW = 10 + Math.floor(rnd() * 50);
  let t = 1_760_000_000_000;
  const todos: Record<string, Set<string>> = {};
  const tieneGuardado = (d: Disp, k: string) => !!d.almacenes.find((s) => s.clave === k)?.guardado;
  const quien = (p: Pestana, k: string) => (tieneGuardado(p.disp, k) ? `${p.disp.nombre}#${p.disp.pestanas.indexOf(p)}` : p.disp.nombre);
  const valoresDe = (p: Pestana, k: string) => (tieneGuardado(p.disp, k) ? p.mem(k) : p.disp.almacen(k).valores);
  /** After a tab's Guardado wrote (its memory equals the storage): both know what either knew. */
  const igualar = (p: Pestana, k: string) => {
    if (!tieneGuardado(p.disp, k)) return;
    const ids = new Set([...Object.keys(p.mem(k)), ...Object.keys(p.disp.almacen(k).valores), ...[...ops.values()].filter((o) => o.clave.startsWith(`${k}/`)).map((o) => o.clave.slice(k.length + 1))]);
    for (const id of ids) {
      sumar(p.disp.nombre, quien(p, k), `${k}/${id}`);
      sumar(quien(p, k), p.disp.nombre, `${k}/${id}`);
    }
  };

  const operar = async (p: Pestana, duranteLaPasada = false) => {
    const d = p.disp;
    const ahora = duranteLaPasada ? reloj.ahora + 1 : t + d.desfase;
    // the device's clock (a Guardado dates its marks with Date.now, when its queued write runs): left there — time
    // only goes forward here, and two edits in flight at once must not put an older time back under each other
    reloj.ahora = ahora;
    await operarA(p, d, ahora);
  };
  const operarA = async (p: Pestana, d: Disp, ahora: number) => {
    const claves = ['reg', 'sin', 'conj', 'crudo'];
    const k = claves[Math.floor(rnd() * claves.length)]!;
    const borrar = k !== 'conj' && rnd() < 0.3;
    const id = k === 'reg' ? ['r0', 'r1', 'cfg'][Math.floor(rnd() * 3)]! : k === 'sin' ? ['s0', 'aj'][Math.floor(rnd() * 2)]! : k === 'conj' ? `c${Math.floor(rnd() * 2)}` : ['k0', 'k1'][Math.floor(rnd() * 2)]!;
    const valores = valoresDe(p, k);
    if (borrar && !(id in valores)) return;
    const op: Op = { id: `${d.nombre}${++nOp}`, clave: `${k}/${id}`, borrado: borrar, supera: new Set(de(quien(p, k), `${k}/${id}`)) };
    ops.set(op.id, op);
    log(`op ${op.id} ${quien(p, k)} ${op.clave} ${borrar ? 'borra' : 'pone'} t=${ahora} supera=${[...op.supera]}`);
    de(quien(p, k), op.clave).add(op.id);
    let nuevo: unknown;
    if (k === 'reg') nuevo = { op: op.id, t: ahora, ...(d.nombre !== 'C' && rnd() < 0.2 ? { futuro: true } : {}) };
    else if (k === 'sin') nuevo = { op: op.id };
    else if (k === 'conj') {
      nuevo = { s: [...((valores[id] as Conj | undefined)?.s ?? []), op.id].sort() };
      (todos[id] ??= new Set()).add(op.id);
    } else nuevo = { op: op.id, t: ahora };
    if (tieneGuardado(d, k)) {
      try {
        await p.editar(k, borrar ? {} : { [id]: nuevo }, borrar ? [id] : []);
        igualar(p, k);
      } catch {
        // the storage refused the write: the change stays in this tab's memory (written by its next write)
      }
    } else {
      // a module without Guardado: memory is storage; it marks its edits and deletions
      if (borrar) {
        delete valores[id];
        p.motor.anotarBorrado(k, id, ahora);
      } else {
        valores[id] = nuevo;
        p.motor.anotarCambio(k, id, ahora);
      }
    }
  };

  const correr = async (p: Pestana, o: OpcionesPasada = {}) => {
    const d = p.disp;
    // the run reads the tab's memory merged with the storage: the file learns what both knew — credited once its PUT is
    // done (after the run), not before: another device writing between this run's GET and PUT learns only what the
    // file had then
    const sabido: [string, Set<string>][] = [];
    for (const s of d.almacenes) {
      const ks = new Set([...[...ops.values()].filter((x) => x.clave.startsWith(`${s.clave}/`)).map((x) => x.clave)]);
      for (const k of ks) sabido.push([k, new Set([...de(d.nombre, k), ...de(quien(p, s.clave), k)])]);
    }
    const kt = process.env.TRAZA_ALMACEN ?? 'sin';
    log(`corre ${quien(p, 'reg')} ${o.interrumpir ? 'interrumpida' : ''}${o.durante ? 'con edición' : ''} t=${t + d.desfase} antes: estado=${JSON.stringify(d.estado.items[kt] ?? {})} mem=${JSON.stringify(valoresDe(p, kt))} alm=${JSON.stringify(d.almacen(kt).valores)} marcas=${JSON.stringify(d.marcas)} fallos=${d.almacenes.filter((s) => s.guardado && (globalThis as unknown as { __fallaEscritura: (a: string, b: string) => boolean }).__fallaEscritura(d.etiqueta, `g:${s.clave}`)).map((s) => s.clave)}`);
    if (p.diario && kt === 'progreso-diario') log(`  memoria del módulo antes: ${JSON.stringify(p.diario.itemsDias())}`);
    const formatoAntes = repo.texto ? (JSON.parse(repo.texto) as { version: number }).version : 0;
    const w = await pasada(d, repo, t, { ...o, pestana: p });
    if (p.diario && kt === 'progreso-diario') log(`  memoria del módulo después: ${JSON.stringify(p.diario.itemsDias())}`);
    // (1.0: a 0.12 device never writes a file of format 2; its refused run sends nothing, so the file learns nothing)
    if (d.version === '0.12' && w && formatoAntes >= 2) problemas.push(`prueba ${prueba}: ${d.nombre} con la 0.12 escribió un fichero del formato ${formatoAntes}`);
    if (d.version === '0.12' && repo.texto && (JSON.parse(repo.texto) as { version: number }).version < formatoAntes)
      problemas.push(`prueba ${prueba}: ${d.nombre} con la 0.12 bajó el formato del fichero`);
    const rechazada = !w && /actualice la aplicación/.test(ultimoError);
    if (rechazada) {
      rechazos012++;
      log(`  → rechazada por la 0.12: ${ultimoError}`);
      return w;
    }
    for (const [k, xs] of sabido) for (const x of xs) de('fichero', k).add(x);
    const k = process.env.TRAZA_ALMACEN ?? 'sin';
    log(`  → ${w ? 'commit' : 'sin commit'} ${k}=${JSON.stringify(repo.doc?.almacenes[k] ?? {})} estado=${JSON.stringify(d.estado.items[k] ?? {})} mem=${JSON.stringify(valoresDe(p, k))} alm=${JSON.stringify(d.almacen(k).valores)} marcas=${JSON.stringify(d.marcas)}`);
    if (!o.interrumpir) {
      for (const s of d.almacenes) {
        if (s.guardado) igualar(p, s.clave);
        const vivos = repo.vivos(s.clave);
        const valores = valoresDe(p, s.clave);
        const ids = new Set([...Object.keys(vivos), ...Object.keys(repo.doc?.almacenes[s.clave] ?? {})]);
        for (const id of ids) {
          const iguales = id in vivos ? valores[id] !== undefined && huella(valores[id]) === huella(vivos[id]) : !(id in valores);
          if (!iguales) continue;
          sumar(quien(p, s.clave), 'fichero', `${s.clave}/${id}`);
          sumar(d.nombre, 'fichero', `${s.clave}/${id}`);
        }
      }
    }
    return w;
  };
  const pestanaAzar = (d: Disp) => d.pestanas[Math.floor(rnd() * d.pestanas.length)]!;
  let rechazos012 = 0;
  /**
   * W is updated from 0.12.0 to this version: as the updater does (lib/almacen.ts guardarTodoAntesDeSalir), every tab
   * writes what it has pending first (the storage accepting writes again for that), then the app starts again on the
   * same storage — migrated (lib/migrar.ts) — with one tab, whose memory is what the storage holds.
   */
  const actualizarW = async () => {
    for (const s of W.almacenes) {
      if (s.guardado) {
        fallarEscritura(W, `g:${s.clave}`, false);
        fallarLectura(W, `g:${s.clave}`, false);
      } else if ('diario' in s) fallarEscritura(W, 'progreso-diario', false);
    }
    for (const q of W.pestanas) {
      for (const g of q.guardados.values()) await (g as unknown as { volcar(): Promise<void> }).volcar().catch(() => undefined);
      await q.diario?.guardadoDias.volcar().catch(() => undefined);
      for (const s of W.almacenes) if (s.guardado) igualar(q, s.clave);
    }
    const viejas = W.pestanas.length;
    const r = (await cambiarVersion(W, '0.11')) as { fallidas: unknown[] };
    if (r.fallidas.length) problemas.push(`prueba ${prueba}: la migración de W dejó sin hacer ${JSON.stringify(r.fallidas)}`);
    // (the new tab knows what the storage holds)
    for (const s of W.almacenes) if (s.guardado) for (const o of ops.values()) if (o.clave.startsWith(`${s.clave}/`)) sumar(`W#0`, 'W', o.clave);
    log(`W pasa de la 0.12 a esta versión (${viejas} pestañas antes)`);
  };

  // 0.12: the daily activity done (day → steps), and the backups made (text, and what they reflected)
  const actividad: Record<string, number> = {};
  const copias: { texto: string; sabido: [string, Set<string>][] }[] = [];
  const conDiario = (d: Disp) => d.almacenes.some((s) => 'diario' in s);
  const estudiar = async (p: Pestana) => {
    const ahora = t + p.disp.desfase;
    reloj.ahora = ahora;
    const n = 1 + Math.floor(rnd() * 2);
    p.diario!.registrarActividad('paso', n);
    const dia = claveDia(ahora);
    actividad[dia] = (actividad[dia] ?? 0) + n;
    log(`estudia ${quien(p, 'reg')} ${dia} +${n}`);
    // (written after a pause, or now; a write the storage refuses stays in memory and is retried)
    if (rnd() < 0.5) await p.diario!.guardadoDias.volcar().catch(() => undefined);
    log(`  → ${quien(p, 'reg')} memoria ${JSON.stringify(p.diario!.itemsDias())}`);
  };
  const exportar = async (p: Pestana) => {
    const d = p.disp;
    reloj.ahora = t + d.desfase;
    const sabido: [string, Set<string>][] = [];
    for (const s of d.almacenes) {
      const ks = new Set([...[...ops.values()].filter((x) => x.clave.startsWith(`${s.clave}/`)).map((x) => x.clave)]);
      for (const k of ks) sabido.push([k, new Set([...de(d.nombre, k), ...de(quien(p, s.clave), k)])]);
    }
    try {
      copias.push({ texto: (await (await p.copia()).crearCopia()).texto, sabido });
      log(`exporta ${quien(p, 'reg')} copia ${copias.length - 1}`);
    } catch {
      // (a store could not be read: no backup)
    }
  };
  const importar = async (p: Pestana) => {
    const c = copias[Math.floor(rnd() * copias.length)];
    if (!c) return;
    const d = p.disp;
    reloj.ahora = t + d.desfase;
    const m = await p.copia();
    let r: Awaited<ReturnType<typeof m.importar>>;
    try {
      r = await m.importar(m.leerFicheroCopia(c.texto), 'unir');
    } catch {
      log(`importa ${quien(p, 'reg')} copia ${copias.indexOf(c)}: nada (sin espacio para las marcas)`);
      return;
    }
    log(`importa ${quien(p, 'reg')} copia ${copias.indexOf(c)} fallidos=${r.fallidos.map((f) => f.clave)}`);
    // the device (and this tab) now hold the merge of what they had and the backup: they know what it reflected —
    // but for the stores it could not write
    const fallidos = new Set(r.fallidos.map((f) => f.clave));
    for (const [k, xs] of c.sabido) {
      const clave = k.split('/')[0]!;
      if (fallidos.has(clave)) continue;
      for (const x of xs) {
        de(d.nombre, k).add(x);
        de(quien(p, clave), k).add(x);
      }
    }
  };

  for (let paso = 0; paso < 70; paso++) {
    t += Math.floor(rnd() * 3 * M) + 1;
    if (paso === pasoW) await actualizarW();
    const d = devs[Math.floor(rnd() * devs.length)]!;
    const p = pestanaAzar(d);
    const x = rnd();
    if (paso === 35) {
      // a fresh install joins the existing repository with its defaults
      const F = await nuevoDisp('F', almacenes011(false), desfase());
      // (written by a fresh install before any synchronisation: no mark — they are defaults). Stored as another
      // writer would (an older version, a module that writes its defaults) and taken by the tab on a refresh: written
      // through the tab and the marks key deleted afterwards, the tab would put its marks back since 0.12b (marcas.ts
      // `reponerMias`: exactly what a stale tab's write of the marks key looks like) and they would be the reader's
      // changes, not defaults
      const ls = almacenamiento(F);
      for (const [k, id, v] of [['reg', 'cfg', { op: 'def', t: 0 }], ['sin', 'aj', { op: 'def' }]] as const) {
        const previo = ls.get(`g:${k}`);
        ls.set(`g:${k}`, JSON.stringify({ ...(previo ? (JSON.parse(previo) as object) : {}), [id]: v }));
        await (F.pestanas[0]!.guardados.get(k) as unknown as { refrescar(): Promise<void> }).refrescar();
      }
      if (!F.pestanas[0]!.mem('reg').cfg || !F.pestanas[0]!.mem('sin').aj) throw new Error('la instalación nueva no tomó sus valores por defecto');
      devs.push(F);
      await correr(F.pestanas[0]!);
    } else if (x < 0.26) await operar(p);
    else if (x < 0.31 && conDiario(d)) await estudiar(p);
    else if (x < 0.325) await exportar(p);
    else if (x < 0.34) await importar(p);
    else if (x < 0.4) {
      // two edits in a row in one tab, the second before the first's write finished (two quick clicks), unless its
      // storage refuses writes now (the knowledge kept here assumes both are stored)
      const gg = globalThis as unknown as { __fallaEscritura: (a: string, b: string) => boolean; __fallaLectura: (a: string, b: string) => boolean };
      const falla = d.almacenes.some((s) => s.guardado && (gg.__fallaEscritura(d.etiqueta, `g:${s.clave}`) || gg.__fallaLectura(d.etiqueta, `g:${s.clave}`)));
      if (falla) await operar(p);
      else await Promise.all([operar(p), operar(p)]);
    }
    else if (x < 0.44 && d.pestanas.length < 2 && !esTauri(d)) await nuevaPestana(d);
    else if (x < 0.5) {
      // the storage refuses (or accepts again) a store's writes; a module without Guardado fails half-way
      const s = d.almacenes[Math.floor(rnd() * d.almacenes.length)]!;
      if ('diario' in s) {
        // the daily progress's storage refuses (or accepts again) writes
        const si = rnd() < 0.6;
        fallarEscritura(d, 'progreso-diario', si);
        log(`fallo de escritura ${d.nombre} progreso-diario ${si}`);
      } else if (s.guardado && esTauri(d) && rnd() < 0.4) {
        // Tauri: the store's IPC fails to read the key (the loads, writes and runs that need it fail; nothing is lost)
        const si = rnd() < 0.6;
        fallarLectura(d, `g:${s.clave}`, si);
        log(`fallo de lectura ${d.nombre} ${s.clave} ${si}`);
      } else if (s.guardado) {
        const si = rnd() < 0.6;
        fallarEscritura(d, `g:${s.clave}`, si);
        log(`fallo de escritura ${d.nombre} ${s.clave} ${si}`);
      } else s.fallaParcial = !s.fallaParcial;
    } else if (x < 0.55) await correr(p, { interrumpir: true });
    else if (x < 0.6) {
      let hecho: Promise<void> | null = null;
      await correr(p, { durante: () => void (hecho = operar(p, true)) });
      await hecho;
    } else if (x < 0.68) {
      const otro = devs[Math.floor(rnd() * devs.length)]!;
      if (otro !== d) {
        const editar = rnd() < 0.5;
        repo.antesDePut = async () => {
          // (the other device's edit and run set the clock to ITS time: the running device's clock is put back for its
          // PUT and its retry — random trial 70207: an 0.10 device retried with a clock 16 min ahead, tied another
          // device's later edit to the millisecond and won by hash, a loss the app cannot have)
          const ahora = reloj.ahora;
          try {
            const q = pestanaAzar(otro);
            if (editar) await operar(q);
            await correr(q);
          } finally {
            reloj.ahora = ahora;
          }
        };
      }
      await correr(p);
      repo.antesDePut = undefined;
    } else await correr(p);
  }

  if (W.version === '0.12') await actualizarW();
  // settle: no more failures nor edits; every tab of every device runs in turn
  for (const d of devs)
    for (const s of d.almacenes) {
      if (s.guardado) {
        fallarEscritura(d, `g:${s.clave}`, false);
        fallarLectura(d, `g:${s.clave}`, false);
      } else if ('diario' in s) fallarEscritura(d, 'progreso-diario', false);
      else s.fallaParcial = false;
    }
  // (a tab's changes whose write the storage refused are not written here: its next synchronisation must send them
  // and write them — guardado.ts `pendientes`)
  const c0 = repo.commits;
  const rondas: number[] = [];
  for (let r = 0; r < 12; r++) {
    const antes = repo.commits;
    for (const d of devs)
      for (const p of d.pestanas) {
        t += M;
        await correr(p);
      }
    rondas.push(repo.commits - antes);
  }
  const asentar = repo.commits - c0;
  const etiqueta = `prueba ${prueba}`;
  if (rondas.slice(-3).some(Boolean)) problemas.push(`${etiqueta}: sigue escribiendo, commits por ronda ${rondas}`);
  if (asentar > devs.length * (REENVIOS_MAXIMOS + 3)) problemas.push(`${etiqueta}: ${asentar} commits al asentar`);

  // convergence: every device's storage and every tab's memory hold what the file has (C skips what it rejects)
  for (const d of devs) {
    for (const s of d.almacenes) {
      const vivos = repo.vivos(s.clave);
      const copias: [string, Record<string, unknown>][] = [[`${d.nombre}`, d.almacen(s.clave).valores]];
      if (s.guardado || 'diario' in s) d.pestanas.forEach((p, i) => copias.push([`${d.nombre}#${i}`, p.mem(s.clave)]));
      for (const [nombre, valores] of copias) {
        for (const id of new Set([...Object.keys(vivos), ...Object.keys(valores)])) {
          if (s.valido && id in vivos && !s.valido(vivos[id])) continue;
          if (huella(valores[id] ?? null) !== huella(vivos[id] ?? null)) problemas.push(`${etiqueta}: ${nombre} ${s.clave}/${id} = ${JSON.stringify(valores[id])}, el fichero ${JSON.stringify(vivos[id])}`);
        }
      }
    }
  }
  // no loss, no resurrection
  const superadas = new Set<string>();
  for (const op of ops.values()) for (const x of op.supera) superadas.add(x);
  const todasSuperadas = new Set<string>();
  for (const op of ops.values()) for (const x of op.supera) todasSuperadas.add(x);
  for (const clave of ['reg', 'sin', 'crudo']) {
    const vivos = repo.vivos(clave);
    const ids = new Set([...[...ops.values()].filter((o) => o.clave.startsWith(`${clave}/`)).map((o) => o.clave.slice(clave.length + 1)), ...Object.keys(vivos)]);
    for (const id of ids) {
      const deEste = [...ops.values()].filter((o) => o.clave === `${clave}/${id}`);
      const v = vivos[id] as { op: string } | undefined;
      if (v) {
        if (v.op === 'def') {
          if (deEste.some((o) => !o.borrado && !todasSuperadas.has(o.id))) problemas.push(`${etiqueta}: ${clave}/${id} se quedó con el valor por defecto`);
        } else if (superadas.has(v.op)) problemas.push(`${etiqueta}: ${clave}/${id} = ${v.op}, que otra operación ya había superado (pérdida)`);
      } else if (deEste.length) {
        const vigentes = deEste.filter((o) => !superadas.has(o.id));
        if (!vigentes.some((o) => o.borrado)) problemas.push(`${etiqueta}: ${clave}/${id} borrado sin un borrado vigente (vigentes ${vigentes.map((o) => o.id)})`);
      }
    }
  }
  // the daily activity: on every device and tab, each day is exactly the sum of what was done on every device
  for (const d of devs) {
    if (!conDiario(d)) continue;
    for (const p of d.pestanas) {
      reloj.ahora = t + d.desfase;
      const dias = await p.diario!.leerDias();
      for (const dia of new Set([...Object.keys(actividad), ...Object.keys(dias)]))
        if ((dias[dia]?.pasos ?? 0) !== (actividad[dia] ?? 0)) problemas.push(`${etiqueta}: ${quien(p, 'reg')} cuenta ${dias[dia]?.pasos ?? 0} pasos el ${dia}, se hicieron ${actividad[dia] ?? 0}`);
    }
  }
  for (const [id, s] of Object.entries(todos)) {
    const final = new Set((repo.vivos('conj')[id] as Conj | undefined)?.s ?? []);
    for (const x of s) if (!final.has(x)) problemas.push(`${etiqueta}: conj/${id} perdió ${x}`);
  }
  return { problemas, commitsAsentar: asentar, rechazos012 };
}
