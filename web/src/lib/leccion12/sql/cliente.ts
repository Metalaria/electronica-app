// 1.2 SQL sandbox, page side: runs a query in the SQLite worker (sql.worker.ts), one at a time, and stops a query
// that takes more than `LIMITE_MS` (the worker is terminated and started again on the next run). Imported lazily by
// the SQL card only, so neither the worker nor SQLite's .wasm (≈ 660 kB, 320 kB compressed) loads anywhere else.

import type { Ejecucion } from './ejecutar';

export const LIMITE_MS = 5000;

let trabajador: Worker | null = null;
let siguiente = 1;
let cola: Promise<unknown> = Promise.resolve();

function arrancar(): Worker {
  trabajador ??= new Worker(new URL('./sql.worker.ts', import.meta.url), { type: 'module', name: 'sqlite' });
  return trabajador;
}

function parar() {
  trabajador?.terminate();
  trabajador = null;
}

function una(sql: string, limite: number): Promise<Ejecucion> {
  return new Promise((resolver) => {
    const w = arrancar();
    const id = siguiente++;
    const reloj = setTimeout(() => {
      w.removeEventListener('message', alRecibir);
      parar();
      resolver({ error: `La consulta tarda demasiado (más de ${Math.round(limite / 1000)} s) y se ha parado. ¿Falta la condición del JOIN (ON …) o un WHERE?` });
    }, limite);
    function alRecibir(ev: MessageEvent<{ id: number; ejecucion: Ejecucion; fallo?: boolean }>) {
      if (ev.data.id !== id) return;
      clearTimeout(reloj);
      w.removeEventListener('message', alRecibir);
      if (ev.data.fallo) parar();
      resolver(ev.data.ejecucion);
    }
    w.addEventListener('message', alRecibir);
    w.addEventListener(
      'error',
      (e) => {
        clearTimeout(reloj);
        w.removeEventListener('message', alRecibir);
        parar();
        resolver({ error: `No se ha podido abrir SQLite en este dispositivo (${e.message || 'error del trabajador'}).` });
      },
      { once: true },
    );
    w.postMessage({ id, sql });
  });
}

/** Runs `sql` on a fresh copy of the sample database. Never rejects: an error comes back explained in Spanish. */
export function ejecutarSql(sql: string, limite = LIMITE_MS): Promise<Ejecucion> {
  const r = cola.then(() => una(sql, limite));
  cola = r.catch(() => undefined);
  return r;
}
