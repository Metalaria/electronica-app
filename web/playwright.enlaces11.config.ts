// 1.1 «enlaces11»: the deep links of the book's QR codes (epa://leccion/<parte>/<label>), the synchronisation of the
// stores of the real modules (laboratorio, seguridad: their marks) and the editor's import of controlled sources. Own
// port and build folder (EPA_DIST, EPA_PUERTO override them).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.enlaces11.config.ts tests/enlaces11-navegador.spec.ts
// The Node tests (the link parser and router, the real-engine scenarios e11, the editor's import) need no browser nor
// server:
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.enlaces11.config.ts tests/enlaces11-unidad.spec.ts
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-enlaces11/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4686);

export default defineConfig({
  ...base,
  testMatch: /enlaces11.*\.spec\.ts/,
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
