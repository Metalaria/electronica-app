// Playwright on its own port and build folder for the Nintendo 64 and the PlayStation of «Consolas» (2.0, n64ps1),
// so its specs can run while other agents use their own servers. The phone project is the owner's Pixel 8 Pro
// (412×915, DPR 3.5, touch).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.n64ps1.config.ts
// The unit tests in Node need no browser nor server:
//   EPA_SIN_SERVIDOR=1 … tests/consolas-n64ps1-unidad.spec.ts
// (EPA_DIST: build folder, default /tmp/claude-0/epa-20a; EPA_PUERTO: port, default 4751; EPA_SPECS: a regular
// expression for other specs, e.g. «fotograma09|averias13»)
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-20a';
const puerto = Number(process.env.EPA_PUERTO ?? 4751);

export default defineConfig({
  ...base,
  testMatch: process.env.EPA_SPECS ? new RegExp(process.env.EPA_SPECS) : /consolas-n64ps1.*\.spec\.ts/,
  outputDir: process.env.EPA_SALIDA ?? '/tmp/claude-0/tr20a',
  timeout: 180_000,
  use: { ...base.use, baseURL: `http://localhost:${puerto}/` },
  webServer: process.env.EPA_SIN_SERVIDOR
    ? undefined
    : {
        command: `npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
        url: `http://localhost:${puerto}/`,
        reuseExistingServer: true,
        timeout: 600_000,
      },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    {
      name: 'telefono',
      use: { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, hasTouch: true, isMobile: true },
    },
  ],
});
