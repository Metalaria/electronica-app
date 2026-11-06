// 1.0 exercises: own port and build folder (EPA_DIST, EPA_PUERTO override them).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.ejercicios10.config.ts
// The content and checker tests (ejercicios10-contenido.spec.ts) need no browser nor server.
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-ejercicios10';
const puerto = Number(process.env.EPA_PUERTO ?? 4611);

export default defineConfig({
  ...base,
  testMatch: /ejercicios10.*\.spec\.ts/,
  use: { ...base.use, baseURL: `http://localhost:${puerto}/` },
  // EPA_SIN_SERVIDOR=1: only the content and checker tests (no build, no browser)
  webServer: process.env.EPA_SIN_SERVIDOR ? undefined : {
    command: `npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}/`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
  ],
});
