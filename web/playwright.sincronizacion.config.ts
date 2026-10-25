// Playwright for the synchronisation, update-notice and console-board tests on their own port and build
// folder, so they can run while other suites use theirs. GitHub is always mocked with page.route().
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.sincronizacion.config.ts
//   DIST=/some/dir … to build elsewhere (default node_modules/.cache/dist-sincronizacion); TODO=1 runs every spec.
import base from './playwright.config';
import { defineConfig } from '@playwright/test';

const PUERTO = 4221;
const DIST = process.env.DIST ?? 'node_modules/.cache/dist-sincronizacion';

export default defineConfig({
  ...base,
  testMatch: process.env.TODO ? /.*\.spec\.ts/ : /(sincronizacion|consolas-placas)\.spec\.ts/,
  use: { ...base.use, baseURL: `http://localhost:${PUERTO}/` },
  webServer: {
    command: `node scripts/ngspice.mjs && npx vite build --outDir ${DIST} --emptyOutDir && npx vite preview --outDir ${DIST} --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}/`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
