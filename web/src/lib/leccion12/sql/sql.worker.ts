// 1.2 SQL sandbox: the worker that runs the reader's queries with SQLite compiled to WebAssembly (sql.js 1.14.2,
// MIT). It is started only when an SQL card opens (lib/leccion12/sql/cliente.ts) and loads the .wasm bundled with
// the app (no network: the same file in the browser, the desktop app and the Android WebView). The sample database
// is built once; each query runs on a fresh copy of it, so an INSERT or a DELETE never carries over to the next run.
// In a worker so that a runaway query (a JOIN without its condition) can be stopped: the page terminates it.

import initSqlJs, { type SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import { ejecutar } from './ejecutar';
import { llenarBase } from './muestra';

let listo: Promise<{ SQL: SqlJsStatic; bytes: Uint8Array }> | null = null;

function preparar() {
  listo ??= initSqlJs({ locateFile: () => wasmUrl }).then((SQL) => {
    const db = new SQL.Database();
    llenarBase(db);
    const bytes = db.export();
    db.close();
    return { SQL, bytes };
  });
  return listo;
}

self.onmessage = async (ev: MessageEvent<{ id: number; sql: string }>) => {
  const { id, sql } = ev.data;
  try {
    const { SQL, bytes } = await preparar();
    const db = new SQL.Database(bytes);
    try {
      db.exec('PRAGMA foreign_keys=ON');
      self.postMessage({ id, ejecucion: ejecutar(db, sql) });
    } finally {
      db.close();
    }
  } catch (e) {
    listo = null;
    self.postMessage({ id, ejecucion: { error: `No se ha podido abrir SQLite en este dispositivo (${e instanceof Error ? e.message : String(e)}).` }, fallo: true });
  }
};
