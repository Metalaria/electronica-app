// 1.1 the book's expansions shown before the book has them (contenido/ampliaciones11/, contenido/ampliaciones.py): own
// port and build folder (EPA_DIST, EPA_PUERTO override them).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.ampliaciones11.config.ts
// The conversion, merge, numbering, undo and data tests in Node (ampliaciones11-unidad.spec.ts) need no browser nor
// server:
//   EPA_SIN_SERVIDOR=1 … tests/ampliaciones11-unidad.spec.ts
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-ampliapp11/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4688);

export default defineConfig({
  ...base,
  testMatch: /ampliaciones11.*\.spec\.ts/,
  timeout: 300_000,
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
