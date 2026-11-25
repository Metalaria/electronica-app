// Playwright on its own port and build folder for the GameCube of «Consolas» (2.0, gamecube20), so its specs can run
// while other agents use their own servers.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.gamecube20.config.ts tests/consolas-gamecube.spec.ts
// (EPA_DIST: build folder, default /tmp/claude-0/epa-20c; EPA_PUERTO: port, default 4753)
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-20c';
const puerto = Number(process.env.EPA_PUERTO ?? 4753);

export default defineConfig({
  ...base,
  outputDir: process.env.EPA_SALIDA ?? '/tmp/claude-0/tr20c',
  use: { ...base.use, baseURL: `http://localhost:${puerto}/` },
  webServer: {
    command: `npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}/`,
    reuseExistingServer: true,
    timeout: 600_000,
  },
});
