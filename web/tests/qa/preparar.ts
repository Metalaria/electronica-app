// Global set-up of the QA harness: empties the raw findings and screenshots of a previous run, except when this
// is a later shard of the same run (--shard=k/n with k > 1) or QA_CONSERVAR=1, so the report merges the shards.
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import type { FullConfig } from '@playwright/test';

const INFORME = process.env.QA_INFORME ? `${process.env.QA_INFORME.replace(/\/$/, '')}/` : new URL('./informe/', import.meta.url).pathname;

export default function preparar(config: FullConfig): void {
  const shard = config.shard;
  const seguir = process.env.QA_CONSERVAR === '1' || (shard && shard.current > 1);
  if (!seguir) {
    rmSync(`${INFORME}crudo`, { recursive: true, force: true });
    rmSync(`${INFORME}capturas`, { recursive: true, force: true });
  }
  mkdirSync(`${INFORME}crudo`, { recursive: true });
  mkdirSync(`${INFORME}capturas`, { recursive: true });
  const meta = `${INFORME}crudo/_ejecucion.json`;
  const previo = existsSync(meta) ? (JSON.parse(readFileSync(meta, 'utf8')) as { inicio: number; tramos: unknown[] }) : null;
  const tramo = { inicio: Date.now(), shard: shard ? `${shard.current}/${shard.total}` : null, modo: process.env.QA_MODO === 'rapido' ? 'rapido' : 'completo', semilla: process.env.QA_SEMILLA ?? null };
  writeFileSync(meta, JSON.stringify({ inicio: previo?.inicio ?? tramo.inicio, tramos: [...(previo?.tramos ?? []), tramo] }, null, 1));
}
