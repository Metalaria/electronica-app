// Playwright on its own port and build folder for the 0.12 «data» block (backup export and import, the daily activity
// summed across devices), so its spec can run while other agents use other ports.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.datos12.config.ts tests/datos12.spec.ts
// (EPA_DIST: build folder, by default /tmp/claude-0/epa-datos12; EPA_PUERTO: port, by default 4521)
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-datos12';
const puerto = Number(process.env.EPA_PUERTO ?? 4521);

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
