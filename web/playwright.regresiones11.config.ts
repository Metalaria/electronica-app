// Playwright on its own port and build folder for the regression tests of the bugs found by the 0.11 QA harness
// (tests/regresiones11.spec.ts), so they can run while other suites use their ports.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.regresiones11.config.ts tests/regresiones11.spec.ts
// (EPA_DIST: build folder, by default in the system temp folder; EPA_PUERTO: port, by default 4422)
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? join(tmpdir(), 'epa-dist-regresiones11');
const puerto = Number(process.env.EPA_PUERTO ?? 4422);

export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: `http://localhost:${puerto}/` },
  webServer: {
    command: `npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}/`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
