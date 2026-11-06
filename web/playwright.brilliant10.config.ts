// 1.0 «Brilliant»: challenges with the live figures, building challenges, the explanation of each wrong option and
// the course paths. Own port and build folder (EPA_DIST, EPA_PUERTO override them).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.brilliant10.config.ts
// The content and checker tests in Node (brilliant10-contenido.spec.ts) need no browser nor server:
//   EPA_SIN_SERVIDOR=1 … tests/brilliant10-contenido.spec.ts
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-brilliant10/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4631);

export default defineConfig({
  ...base,
  testMatch: /brilliant10.*\.spec\.ts/,
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
