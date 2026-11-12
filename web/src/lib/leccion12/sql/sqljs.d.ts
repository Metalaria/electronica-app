// Minimal types of sql.js 1.14 (MIT; https://github.com/sql-js/sql.js): only what the 1.2 SQL sandbox uses.
declare module 'sql.js' {
  export interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }
  export interface Statement {
    run(params?: (number | string | null)[]): void;
    free(): boolean;
  }
  export interface Database {
    run(sql: string, params?: (number | string | null)[]): Database;
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Uint8Array | null) => Database;
  }
  export default function initSqlJs(config?: { locateFile?: (file: string) => string; wasmBinary?: ArrayBuffer | Uint8Array }): Promise<SqlJsStatic>;
}
