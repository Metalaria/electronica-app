// Review 11c (functional and UI QA of 1.1) and its fix: the reviewer's regression tests and the fix's own, in the
// browser and in Node. Own port and build folder (EPA_DIST, EPA_PUERTO override them).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision11c.config.ts tests/revision11c-navegador.spec.ts
// The Node tests need no browser nor server:
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.revision11c.config.ts tests/revision11c-unidad.spec.ts
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-fix11c/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4696);

export default defineConfig({
  ...base,
  testMatch: /revision11c-.*\.spec\.ts/,
  timeout: 240_000,
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
