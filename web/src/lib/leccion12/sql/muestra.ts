// 1.2 SQL sandbox: the sample measurements database of section 17.10 («Registrar datos: ficheros, SQLite y el
// lenguaje SQL», book file cap18.typ). The schema is the book's own (its CREATE TABLE and INSERT, and the hourly
// summary table `horas`); the measurements are SAMPLE data the app makes up, deterministically: four sensors (BME280
// temperature, humidity and pressure, SCD41 CO₂) every 10 minutes from 2026-02-25 to 2026-04-03, with a daily cycle,
// a slow drift and seeded noise — the shape of a real log, so the book's queries give results of the same shape
// (the daily maximum of March: 31 rows). Never presented as measured values. Pure: the generator (in Node, sql.js)
// and the app's worker build the same database from these lines.

import { generador } from '../azar';

export const NOMBRE_BASE = 'mediciones';

/** The book's schema, verbatim (section 17.10), plus the hourly summary table of «Envejecer los datos». */
export const ESQUEMA = `CREATE TABLE IF NOT EXISTS sensores (
    id       INTEGER PRIMARY KEY,
    nombre   TEXT NOT NULL UNIQUE,
    magnitud TEXT NOT NULL,
    unidad   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS medidas (
    sensor INTEGER NOT NULL REFERENCES sensores(id),
    t      INTEGER NOT NULL,              -- Unix time, s (UTC)
    valor  REAL    NOT NULL,
    PRIMARY KEY (sensor, t)
) WITHOUT ROWID;
INSERT OR IGNORE INTO sensores VALUES
    (1, 'BME280-T', 'temperatura',      '°C'),
    (2, 'BME280-H', 'humedad relativa', '%'),
    (3, 'BME280-P', 'presión',          'hPa'),
    (4, 'SCD41',    'CO2',              'ppm');
CREATE TABLE IF NOT EXISTS horas (
    sensor INTEGER NOT NULL REFERENCES sensores(id),
    t      INTEGER NOT NULL,              -- start of the hour, Unix time
    media REAL, minimo REAL, maximo REAL, n INTEGER,
    PRIMARY KEY (sensor, t)
) WITHOUT ROWID;`;

/** First and last instant (Unix time, s) and the sampling period of the sample data. */
export const DESDE = Date.UTC(2026, 1, 25) / 1000;
export const HASTA = Date.UTC(2026, 3, 4) / 1000;
export const PERIODO = 600;

const r2 = (x: number) => Math.round(x * 100) / 100;

/** The sample rows [sensor, t, valor], in key order (sensor, t). */
export function filasMuestra(): [number, number, number][] {
  const rnd = generador(17_10);
  const ruido = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
  const out: [number, number, number][][] = [[], [], [], []];
  for (let t = DESDE; t < HASTA; t += PERIODO) {
    const dia = (t - DESDE) / 86400;
    const hora = ((t % 86400) / 3600 + 1) % 24; // local time (UTC+1 in March)
    const ciclo = Math.sin((2 * Math.PI * (hora - 9)) / 24);
    const semana = new Date(t * 1000).getUTCDay();
    const laborable = semana >= 1 && semana <= 5;
    const temp = 13 + 0.12 * dia + 5.5 * ciclo + 1.5 * Math.sin((2 * Math.PI * dia) / 6.3) + 0.25 * ruido();
    const hum = 62 - 14 * ciclo - 4 * Math.sin((2 * Math.PI * dia) / 6.3) + 1.2 * ruido();
    const pres = 1014 + 7 * Math.sin((2 * Math.PI * dia) / 8.7) + 0.6 * Math.sin((2 * Math.PI * hora) / 12) + 0.3 * ruido();
    const gente = laborable && hora >= 9 && hora < 18 ? 380 * Math.sin((Math.PI * (hora - 9)) / 9) : 0;
    const co2 = 430 + gente + 12 * ruido();
    out[0]!.push([1, t, r2(temp)]);
    out[1]!.push([2, t, r2(Math.max(5, Math.min(99, hum)))]);
    out[2]!.push([3, t, r2(pres)]);
    out[3]!.push([4, t, Math.round(co2)]);
  }
  return out.flat();
}

/** The minimal interface of a sql.js database the sandbox uses (the app's worker and the generator). */
export interface BaseSql {
  run(sql: string, params?: (number | string | null)[]): unknown;
  exec(sql: string): { columns: string[]; values: unknown[][] }[];
  prepare(sql: string): { run(params: (number | string | null)[]): void; free(): void };
}

/** Fills an empty database with the schema and the sample rows (one transaction). */
export function llenarBase(db: BaseSql): void {
  db.exec(ESQUEMA);
  db.exec('BEGIN');
  const st = db.prepare('INSERT INTO medidas VALUES (?, ?, ?)');
  for (const f of filasMuestra()) st.run(f);
  st.free();
  db.exec('COMMIT');
}
