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
import { REENVIOS_MAXIMOS, huella } from '../../src/lib/sincronizacion/fusion.ts';
import { almacenamiento, esTauri, fallarEscritura, fallarLectura, guardado, nuevaPestana, nuevoDisp, nuevoRepo, pasada, registro, reloj, type Almacen, type Disp, type OpcionesPasada, type Pestana } from './arnes.ts';

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
  ];
  const desfase = () => Math.round((rnd() - 0.5) * 20 * M);
  const devs: Disp[] = [await nuevoDisp('A', almacenes011(false), desfase()), await nuevoDisp('B', almacenes011(false), desfase(), '0.11', { tauri: prueba % 2 === 0 }), await nuevoDisp('C', almacenes011(true), desfase())];
  devs.push(await nuevoDisp('V', [registro('reg', { tiempo: tiempoT }), registro('sin'), registro('crudo', { tiempo: tiempoT })], desfase(), '0.10'));
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
    const claves = d.version === '0.10' ? ['reg', 'sin', 'crudo'] : ['reg', 'sin', 'conj', 'crudo'];
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
    if (k === 'reg') nuevo = { op: op.id, t: ahora, ...(d.nombre !== 'C' && d.version === '0.11' && rnd() < 0.2 ? { futuro: true } : {}) };
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
    const w = await pasada(d, repo, t, { ...o, pestana: p });
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

  for (let paso = 0; paso < 70; paso++) {
    t += Math.floor(rnd() * 3 * M) + 1;
    const d = devs[Math.floor(rnd() * devs.length)]!;
    const p = pestanaAzar(d);
    const x = rnd();
    if (paso === 35) {
      // a fresh install joins the existing repository with its defaults
      const F = await nuevoDisp('F', almacenes011(false), desfase());
      await F.pestanas[0]!.editar('reg', { cfg: { op: 'def', t: 0 } });
      await F.pestanas[0]!.editar('sin', { aj: { op: 'def' } });
      // (written by a fresh install before any synchronisation: no mark — they are defaults)
      almacenamiento(F).delete('sinc-marcas');
      devs.push(F);
      await correr(F.pestanas[0]!);
    } else if (x < 0.34) await operar(p);
    else if (x < 0.4) {
      // two edits in a row in one tab, the second before the first's write finished (two quick clicks), unless its
      // storage refuses writes now (the knowledge kept here assumes both are stored)
      const gg = globalThis as unknown as { __fallaEscritura: (a: string, b: string) => boolean; __fallaLectura: (a: string, b: string) => boolean };
      const falla = d.almacenes.some((s) => s.guardado && (gg.__fallaEscritura(d.etiqueta, `g:${s.clave}`) || gg.__fallaLectura(d.etiqueta, `g:${s.clave}`)));
      if (falla || d.version === '0.10') await operar(p);
      else await Promise.all([operar(p), operar(p)]);
    }
    else if (x < 0.44 && d.version === '0.11' && d.pestanas.length < 2 && !esTauri(d)) await nuevaPestana(d);
    else if (x < 0.5 && d.version === '0.11') {
      // the storage refuses (or accepts again) a store's writes; a module without Guardado fails half-way
      const s = d.almacenes[Math.floor(rnd() * d.almacenes.length)]!;
      if (s.guardado && esTauri(d) && rnd() < 0.4) {
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
    else if (x < 0.6 && d.version === '0.11') {
      let hecho: Promise<void> | null = null;
      await correr(p, { durante: () => void (hecho = operar(p, true)) });
      await hecho;
    } else if (x < 0.68) {
      const otro = devs[Math.floor(rnd() * devs.length)]!;
      if (otro !== d) {
        const editar = rnd() < 0.5;
        repo.antesDePut = async () => {
          const q = pestanaAzar(otro);
          if (editar) await operar(q);
          await correr(q);
        };
      }
      await correr(p);
      repo.antesDePut = undefined;
    } else await correr(p);
  }

  // settle: no more failures nor edits; every tab of every device runs in turn
  for (const d of devs)
    for (const s of d.almacenes) {
      if (s.guardado) {
        fallarEscritura(d, `g:${s.clave}`, false);
        fallarLectura(d, `g:${s.clave}`, false);
      }
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
      if (s.guardado) d.pestanas.forEach((p, i) => copias.push([`${d.nombre}#${i}`, p.mem(s.clave)]));
      for (const [nombre, valores] of copias) {
        for (const id of new Set([...Object.keys(vivos), ...Object.keys(valores)])) {
          if (s.valido && id in vivos && !s.valido(vivos[id])) continue;
          if (huella(valores[id] ?? null) !== huella(vivos[id] ?? null)) problemas.push(`${etiqueta}: ${nombre} ${s.clave}/${id} = ${JSON.stringify(valores[id])}, el fichero ${JSON.stringify(vivos[id])}`);
        }
      }
    }
  }
  // no loss, no resurrection (an 0.10 device's own later edit may lose to an earlier one when its clock is behind —
  // 0.10's engine, unchanged —: its operations supersede nothing here)
  const superadas = new Set<string>();
  for (const op of ops.values()) if (!op.id.startsWith('V')) for (const x of op.supera) superadas.add(x);
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
  for (const [id, s] of Object.entries(todos)) {
    const final = new Set((repo.vivos('conj')[id] as Conj | undefined)?.s ?? []);
    for (const x of s) if (!final.has(x)) problemas.push(`${etiqueta}: conj/${id} perdió ${x}`);
  }
  return { problemas, commitsAsentar: asentar };
}
