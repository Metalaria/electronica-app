// 1.4 (contenido14): small tap zones (`recorte` / `ampliar` on ~200 lesson figures), the consoles' lesson content and
// the explorer data (SNES PAL photos, GBC, Mega Drive, NES). Own port and build folder (EPA_DIST, EPA_PUERTO override
// them); the phone project is the owner's Pixel 8 Pro (412×915, DPR 3.5, touch).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.contenido14.config.ts
// The unit tests in Node need no browser nor server:
//   EPA_SIN_SERVIDOR=1 … tests/contenido14-zonas-unidad.spec.ts
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/build-con14/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4442);

export default defineConfig({
  ...base,
  // (EPA_SPECS: a regular expression to run other specs this work touched, e.g. «averias13|consolas-snes»)
  testMatch: process.env.EPA_SPECS ? new RegExp(process.env.EPA_SPECS) : /contenido14.*\.spec\.ts/,
  timeout: 180_000,
  workers: 1,
  use: { ...base.use, baseURL: `http://localhost:${puerto}/` },
  webServer: process.env.EPA_SIN_SERVIDOR ? undefined : {
    command: `node scripts/ngspice.mjs && npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}/`,
    reuseExistingServer: true,
    timeout: 400_000,
  },
  projects: [
    {
      name: 'telefono',
      use: { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, hasTouch: true, isMobile: true },
    },
    // (for the other specs run with EPA_SPECS that expect a desktop: --project=escritorio)
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
  ],
});
