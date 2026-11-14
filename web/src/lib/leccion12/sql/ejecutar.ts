// 1.2 SQL sandbox: running a query on a sql.js database, comparing its result with the expected one, and explaining
// SQLite's errors in Spanish. Pure (given a database): the generator runs the reference queries with it in Node,
// the app's worker (sql.worker.ts) runs the reader's.

import type { ResultadoSql } from '../tipos';
import type { BaseSql } from './muestra';

/** Rows sent back to the page at most (the result says how many there were). */
export const MAX_FILAS = 500;

export interface Ejecucion {
  resultado?: ResultadoSql;
  /** Rows of the whole result (only `MAX_FILAS` come back). */
  total?: number;
  /** SQLite's message, explained in Spanish. */
  error?: string;
}

const celda = (x: unknown): number | string | null => (x == null ? null : typeof x === 'number' ? x : typeof x === 'bigint' ? Number(x) : x instanceof Uint8Array ? `(${x.length} bytes)` : String(x));

/** Runs every statement of `sql`; the result is the last one that returns rows (an empty table if none does). */
export function ejecutar(db: BaseSql, sql: string, max = MAX_FILAS): Ejecucion {
  if (!sql.trim()) return { error: 'Escriba una orden SQL.' };
  try {
    const rs = db.exec(sql);
    const ultimo = rs[rs.length - 1];
    if (!ultimo) return { resultado: { columnas: [], filas: [] }, total: 0 };
    return { resultado: { columnas: [...ultimo.columns], filas: ultimo.values.slice(0, max).map((f) => f.map(celda)) }, total: ultimo.values.length };
  } catch (e) {
    return { error: explicarError(e instanceof Error ? e.message : String(e)) };
  }
}

const TABLAS = 'sensores, medidas y horas';

/** SQLite's error messages, in Spanish, with what usually causes them. */
export function explicarError(m: string): string {
  const x = m.replace(/^Error:\s*/i, '').trim();
  let r: RegExpExecArray | null;
  if ((r = /no such table: (\S+)/i.exec(x))) return `No existe la tabla «${r[1]}». Las tablas de la base son ${TABLAS}.`;
  if ((r = /no such column: (\S+)/i.exec(x))) return `No existe la columna «${r[1]}». Revise cómo se escribe, y si es de otra tabla, únala con JOIN.`;
  if ((r = /ambiguous column name: (\S+)/i.exec(x))) return `La columna «${r[1]}» está en más de una tabla: escriba de cuál es (por ejemplo, m.${r[1]!.split('.').pop()}).`;
  if ((r = /near "(.*)": syntax error/i.exec(x))) return `Error de sintaxis cerca de «${r[1]}»: revise el orden de las cláusulas (SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT), las comas y las comillas.`;
  if (/incomplete input/i.test(x)) return 'La orden está incompleta: falta algo al final (un paréntesis, una comilla o una cláusula).';
  if (/unrecognized token: "?'/i.test(x) || /unterminated/i.test(x)) return 'Hay una comilla sin cerrar: los textos van entre comillas simples, \'así\'.';
  if ((r = /unrecognized token: "(.*)"/i.exec(x))) return `SQLite no entiende «${r[1]}»: revise ese trozo.`;
  if (/misuse of aggregate/i.test(x)) return 'Una función de agregado (count, avg, max, min, sum) no puede ir en WHERE, que filtra filas una a una: el filtro sobre grupos va en HAVING.';
  if (/a GROUP BY clause is required before HAVING/i.test(x)) return 'HAVING filtra grupos: necesita un GROUP BY antes.';
  if ((r = /no such function: (\S+)/i.exec(x))) return `SQLite no tiene la función «${r[1]}». Para fechas use date(), time(), datetime() y strftime().`;
  if ((r = /wrong number of arguments to function (\S+)/i.exec(x))) return `La función «${r[1]!.replace(/\(\)$/, '')}» lleva otro número de argumentos.`;
  if ((r = /NOT NULL constraint failed: (\S+)/i.exec(x))) return `La columna «${r[1]}» no admite valores vacíos (NOT NULL).`;
  if ((r = /UNIQUE constraint failed: (\S+)/i.exec(x))) return `Ya hay una fila con ese valor de «${r[1]}»: la clave no admite repetidos.`;
  if (/FOREIGN KEY constraint failed/i.test(x)) return 'La clave ajena no encaja: ese sensor no existe en la tabla sensores.';
  if ((r = /table (\S+) already exists/i.exec(x))) return `La tabla «${r[1]}» ya existe (use CREATE TABLE IF NOT EXISTS).`;
  if (/(\d+) values for (\d+) columns/i.test(x)) return 'El número de valores no coincide con el de columnas.';
  if (/You can only execute one statement|more than one statement/i.test(x)) return 'Escriba una sola orden.';
  return `SQLite dice: ${x}`;
}

const igual = (a: number | string | null, b: number | string | null) =>
  a === b || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)));

const claveFila = (f: (number | string | null)[]) => JSON.stringify(f.map((x) => (typeof x === 'number' ? Number(x.toPrecision(10)) : x)));

export interface Diferencia {
  bien: boolean;
  /** What is different, in Spanish (empty when right). */
  texto: string;
}

/** Whether a result is the expected one (column names do not count, only their number and the values). */
export function compararResultados(r: ResultadoSql, esperado: ResultadoSql, ordenado: boolean, total = r.filas.length): Diferencia {
  const ne = esperado.columnas.length;
  const nr = r.columnas.length;
  if (nr !== ne) return { bien: false, texto: `Su resultado tiene ${nr} ${nr === 1 ? 'columna' : 'columnas'} y se piden ${ne}: revise la lista del SELECT.` };
  const fe = esperado.filas.length;
  if (total !== fe) {
    const mas = total > fe;
    return { bien: false, texto: `Su resultado tiene ${total} ${total === 1 ? 'fila' : 'filas'} y se esperan ${fe}: ${mas ? 'sobran filas; ¿falta una condición en WHERE, o agrupar con GROUP BY?' : 'faltan filas; ¿sobra una condición, o agrupa de más?'}` };
  }
  if (ordenado) {
    const k = r.filas.findIndex((f, i) => f.some((x, j) => !igual(x, esperado.filas[i]![j]!)));
    if (k < 0) return { bien: true, texto: '' };
    const mismas = sinOrdenIguales(r.filas, esperado.filas);
    return { bien: false, texto: mismas ? 'Las filas son las buenas, pero en otro orden: revise ORDER BY.' : `La fila ${k + 1} no es la que se espera: revise los cálculos o las condiciones.` };
  }
  return sinOrdenIguales(r.filas, esperado.filas) ? { bien: true, texto: '' } : { bien: false, texto: 'Mismo número de filas y columnas, pero otros valores: revise los cálculos o las condiciones.' };
}

function sinOrdenIguales(a: (number | string | null)[][], b: (number | string | null)[][]): boolean {
  const cuenta = new Map<string, number>();
  for (const f of b) cuenta.set(claveFila(f), (cuenta.get(claveFila(f)) ?? 0) + 1);
  for (const f of a) {
    const k = claveFila(f);
    const n = cuenta.get(k) ?? 0;
    if (!n) return false;
    cuenta.set(k, n - 1);
  }
  return true;
}

/** The query of a fill-in card with its blanks filled («[[1]]» → the first answer). */
export function rellenarPlantilla(plantilla: string, huecos: readonly string[]): string {
  return plantilla.replace(/\[\[(\d+)\]\]/g, (_, n: string) => huecos[Number(n) - 1] ?? '');
}

/** The query of an order card with its clauses in the order on show. */
export function unirClausulas(clausulas: readonly string[], orden: readonly number[]): string {
  return orden.map((k) => clausulas[k]!).join('\n');
}

/** Words a reference query must not use: its result would change from one day to the next. */
export const NO_DETERMINISTA = /\b(now|random|randomblob|current_(?:date|time|timestamp))\b|'now'/i;
