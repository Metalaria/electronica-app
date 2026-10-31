// QA harness of 0.11 (tests/qa/): crawls every route of the app in three device profiles with automatic
// checks, runs a seeded interaction monkey and functional sweeps over the book's data, and writes a report
// (tests/qa/informe/informe.json and informe.md, git-ignored). Its own port and build folder, so it can run
// while other suites use theirs.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers nice npx playwright test -c playwright.qa.config.ts
//   QA_MODO=rapido …                       a deterministic sample of the routes (quick reruns)
//   … --shard=1/2, then --shard=2/2        split the run; the report merges the shards that have run
//   … tests/qa/rastreo.spec.ts --project=tableta   only the crawler, only the tablet profile
// Environment: QA_MODO (completo | rapido), QA_SEMILLA (monkey seed), QA_PASOS (monkey steps), QA_FILTRO (regex
// over route ids), QA_WORKERS (default 1), QA_INFORME (report folder, by default tests/qa/informe), EPA_DIST (build folder, by default in the system temp folder),
// EPA_PUERTO (port, by default 4421). The report alone: node tests/qa/informe.ts
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
import { PERFILES, VARIANTES } from './tests/qa/perfiles';

const dist = process.env.EPA_DIST ?? join(tmpdir(), 'epa-dist-qa11');
const puerto = Number(process.env.EPA_PUERTO ?? 4421);

export default defineConfig({
  testDir: 'tests/qa',
  testMatch: /.*\.spec\.ts/,
  timeout: 30 * 60_000,
  expect: { timeout: 30_000 },
  fullyParallel: true,
  workers: Number(process.env.QA_WORKERS ?? 1),
  // The harness collects findings instead of failing: a test fails only when the harness itself breaks.
  retries: 0,
  reporter: [['list']],
  globalSetup: './tests/qa/preparar.ts',
  globalTeardown: './tests/qa/informe.ts',
  use: {
    baseURL: `http://localhost:${puerto}/`,
    trace: 'off',
    // a safety net: a locator read of an element that never appears must not wait for the whole test
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    screenshot: 'off',
    video: 'off',
    // window.gc() for the memory measurements (Chromium only)
    launchOptions: { args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] },
  },
  webServer: {
    command: `npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}/`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
  // The three device profiles run every spec but the layout stress; its seven variants run only that one.
  projects: [
    ...PERFILES.map((p) => ({ name: p.id, use: p.uso, testIgnore: /fase2-maquetacion/ })),
    ...VARIANTES.map((p) => ({ name: p.id, use: p.uso, testMatch: /fase2-maquetacion\.spec\.ts/ })),
  ],
});
