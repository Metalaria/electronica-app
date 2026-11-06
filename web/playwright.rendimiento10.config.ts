// 1.0 performance and stability: the local «Informe de fallos», error boundaries, WebGL context loss, ngspice
// failures, a lazy chunk that does not arrive, and the performance regression checks. Own port and build folder
// (EPA_DIST, EPA_PUERTO override them).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.rendimiento10.config.ts
// The unit tests (report, redaction, no loop, WOFF → sfnt, PDF fonts) need no browser nor server:
//   EPA_SIN_SERVIDOR=1 … tests/rendimiento10-unidad.spec.ts
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-rendimiento10/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4651);

export default defineConfig({
  ...base,
  testMatch: /rendimiento10-.*\.spec\.ts/,
  timeout: 240_000,
  use: { ...base.use, baseURL: `http://localhost:${puerto}/`, locale: 'es-ES', permissions: ['clipboard-read', 'clipboard-write'] },
  webServer: process.env.EPA_SIN_SERVIDOR
    ? undefined
    : {
        command: `node scripts/ngspice.mjs && npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
        url: `http://localhost:${puerto}/`,
        reuseExistingServer: true,
        timeout: 300_000,
      },
  projects: [{ name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 }, locale: 'es-ES', permissions: ['clipboard-read', 'clipboard-write'] } }],
});
