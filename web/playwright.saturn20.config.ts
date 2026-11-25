// Playwright on its own port and build folder for the Sega Saturn of «Consolas» (2.0, saturn20), so its specs can run
// while other agents use their own servers.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.saturn20.config.ts tests/consolas-saturn.spec.ts
// (EPA_DIST: build folder, default /tmp/claude-0/epa-20b; EPA_PUERTO: port, default 4752)
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-20b';
const puerto = Number(process.env.EPA_PUERTO ?? 4752);

export default defineConfig({
  ...base,
  outputDir: process.env.EPA_SALIDA ?? '/tmp/claude-0/tr20b',
  use: { ...base.use, baseURL: `http://localhost:${puerto}/` },
  webServer: {
    command: `npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}/`,
    reuseExistingServer: true,
    timeout: 600_000,
  },
});
