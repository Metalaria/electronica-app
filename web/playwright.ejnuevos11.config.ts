// 1.1 new exercises not in the book yet (chapters 22, 25 and 35): own port and build folder (EPA_DIST, EPA_PUERTO
// override them).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.ejnuevos11.config.ts
// The data, checker, merge and PDF tests in Node (ejnuevos11-unidad.spec.ts) need no browser nor server:
//   EPA_SIN_SERVIDOR=1 … tests/ejnuevos11-unidad.spec.ts
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-ejnuevos11/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4683);

export default defineConfig({
  ...base,
  testMatch: /ejnuevos11.*\.spec\.ts/,
  timeout: 180_000,
  use: { ...base.use, baseURL: `http://localhost:${puerto}/` },
  webServer: process.env.EPA_SIN_SERVIDOR ? undefined : {
    command: `node scripts/ngspice.mjs && npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}/`,
    reuseExistingServer: true,
    timeout: 400_000,
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
  ],
});
