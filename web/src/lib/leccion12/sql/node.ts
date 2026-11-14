// 1.2 SQL sandbox in Node: the sample database built with sql.js (its Node build reads the .wasm from its own
// folder), for the generator (web/scripts/lecciones11.mjs) and the unit tests. Not imported by the app.

import { ejecutar, type Ejecucion } from './ejecutar';
import { llenarBase } from './muestra';

/** A function that runs SQL on a fresh copy of the sample database (each call starts from the same data). */
export async function sqlNode(): Promise<(consulta: string) => Ejecucion> {
  const initSqlJs = (await import('sql.js')).default;
  const SQL = await initSqlJs();
  const db0 = new SQL.Database();
  llenarBase(db0);
  const bytes = db0.export();
  db0.close();
  return (consulta) => {
    const db = new SQL.Database(bytes);
    try {
      db.exec('PRAGMA foreign_keys=ON');
      return ejecutar(db, consulta);
    } finally {
      db.close();
    }
  };
}
