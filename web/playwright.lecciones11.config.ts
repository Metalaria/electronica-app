// 1.1 hand-authored lessons («lecciones 1.1»): engine, generator, validator, the two reference lessons and their
// integration with progress, XP, mastery and the course. Own port and build folder (EPA_DIST, EPA_PUERTO override them).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones11.config.ts
// The unit tests in Node need no browser nor server:
//   EPA_SIN_SERVIDOR=1 … tests/lecciones11-unidad.spec.ts
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-motor11/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4671);

export default defineConfig({
  ...base,
  testMatch: /lecciones11.*\.spec\.ts/,
  timeout: 120_000,
  workers: 1,
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
