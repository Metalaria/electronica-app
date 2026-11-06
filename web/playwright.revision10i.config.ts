// Review 10i (third and last review of the 1.0 Brilliant-style and exercises blocks): own port
// and build folder (EPA_DIST, EPA_PUERTO override them).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision10i.config.ts
// The unit tests need no browser nor server:
//   EPA_SIN_SERVIDOR=1 … tests/revision10i-unidad.spec.ts
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-revision10i/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4731);

export default defineConfig({
  ...base,
  testMatch: /revision10i-.*\.spec\.ts/,
  timeout: 300_000,
  use: { ...base.use, baseURL: `http://localhost:${puerto}/`, locale: 'es-ES' },
  webServer: process.env.EPA_SIN_SERVIDOR
    ? undefined
    : {
        command: `node scripts/ngspice.mjs && npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
        url: `http://localhost:${puerto}/`,
        reuseExistingServer: true,
        timeout: 400_000,
      },
  projects: [{ name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 }, locale: 'es-ES' } }],
});
