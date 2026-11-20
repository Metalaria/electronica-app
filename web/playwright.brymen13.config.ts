// 1.3 real Brymen through the BU-86X cable (tests/brymen13-*.spec.ts): own port and build folder (EPA_DIST, EPA_PUERTO
// override them). The «movil» project (Pixel 8 Pro size, touch) runs the phone cases the default config skips.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.brymen13.config.ts tests/brymen13-navegador.spec.ts
// The decoder tests need no browser nor server:
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.brymen13.config.ts tests/brymen13-unidad.spec.ts
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-brymen13/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4733);

export default defineConfig({
  ...base,
  testMatch: /brymen13.*\.spec\.ts/,
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
    {
      name: 'movil',
      use: { ...devices['Desktop Chrome'], viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, hasTouch: true, isMobile: true },
    },
  ],
});
