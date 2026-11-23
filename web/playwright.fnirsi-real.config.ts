// The real FNIRSI 2C53T through its «stock-link» USB link (tests/fnirsi-real-*.spec.ts): own port and build folder
// (EPA_DIST, EPA_PUERTO override them), like the real Brymen's tests.
//   npx playwright test -c playwright.fnirsi-real.config.ts tests/fnirsi-real-navegador.spec.ts
// The decoder tests need no browser nor server:
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.fnirsi-real.config.ts tests/fnirsi-real-unidad.spec.ts
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-fnirsi-real/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4737);

export default defineConfig({
  ...base,
  testMatch: /fnirsi-real.*\.spec\.ts/,
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
