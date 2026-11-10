// 1.1 errata of the exercise solutions: own port and build folder (EPA_DIST, EPA_PUERTO override them).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.erratas11.config.ts
// The data, grading and PDF tests in Node (erratas11-unidad.spec.ts) need no browser nor server:
//   EPA_SIN_SERVIDOR=1 … tests/erratas11-unidad.spec.ts
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-erratas11/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4674);

export default defineConfig({
  ...base,
  testMatch: /erratas11.*\.spec\.ts/,
  use: { ...base.use, baseURL: `http://localhost:${puerto}/` },
  webServer: process.env.EPA_SIN_SERVIDOR ? undefined : {
    command: `node scripts/ngspice.mjs && npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}/`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
  ],
});
