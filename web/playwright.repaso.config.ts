// Playwright for the «Repaso» tests on its own port and build folder, so it can run while other suites use :4173.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.repaso.config.ts
import base from './playwright.config';
import { defineConfig } from '@playwright/test';

const PUERTO = 4391;
const DIST = 'node_modules/.cache/dist-repaso';

export default defineConfig({
  ...base,
  testMatch: process.env.TODO ? /.*\.spec\.ts/ : /repaso\.spec\.ts/,
  use: { ...base.use, baseURL: `http://localhost:${PUERTO}/` },
  webServer: {
    command: `node scripts/ngspice.mjs && npx vite build --outDir ${DIST} --emptyOutDir && npx vite preview --outDir ${DIST} --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}/`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
