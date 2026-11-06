// Review 10f (teacher mode and the local failure report of 1.0, second review of the block): own port and build
// folder (EPA_DIST, EPA_PUERTO override them).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision10f.config.ts
// The unit tests need no browser nor server:
//   EPA_SIN_SERVIDOR=1 … tests/revision10f-unidad.spec.ts
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-revision10f/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4691);

export default defineConfig({
  ...base,
  testMatch: /revision10f-.*\.spec\.ts/,
  timeout: 300_000,
  use: { ...base.use, baseURL: `http://localhost:${puerto}/`, acceptDownloads: true, locale: 'es-ES' },
  webServer: process.env.EPA_SIN_SERVIDOR
    ? undefined
    : {
        command: `node scripts/ngspice.mjs && npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
        url: `http://localhost:${puerto}/`,
        reuseExistingServer: true,
        timeout: 300_000,
      },
  projects: [{ name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 }, locale: 'es-ES' } }],
});
