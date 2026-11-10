// 1.1 guided labs of printed chapter 21 («Laboratorio guiado»): own port and build folder (EPA_DIST, EPA_PUERTO override
// them).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.laboratorio11.config.ts tests/laboratorio11-navegador.spec.ts
// The Node tests (every lab on a real bench with the app's ngspice, the progress store and its merge, XP) need no
// browser nor server:
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.laboratorio11.config.ts tests/laboratorio11-unidad.spec.ts
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-practicas11/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4684);

export default defineConfig({
  ...base,
  testMatch: /laboratorio11.*\.spec\.ts/,
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
