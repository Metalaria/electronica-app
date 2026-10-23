// Playwright on its own port and build folder, for running the suite while another agent uses :4173.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.ejercicios.config.ts [tests/x.spec.ts]
// (EPA_DIST: build folder, by default in the system temp folder; EPA_PUERTO: port, by default 4179)
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? join(tmpdir(), 'epa-dist-ej');
const puerto = Number(process.env.EPA_PUERTO ?? 4179);

export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: `http://localhost:${puerto}/` },
  webServer: {
    command: `npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}/`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
  ],
});
