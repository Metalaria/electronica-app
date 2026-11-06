// Playwright on its own port and build folder for the 1.0 «data» block (one active tab, the schema migration and its
// notices), so its specs can run while other agents use other ports.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.datos10.config.ts tests/datos10-pestanas.spec.ts
// (EPA_DIST: build folder, by default /tmp/claude-0/epa-datos10/dist; EPA_PUERTO: port, by default 4601)
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-datos10/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4601);

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
