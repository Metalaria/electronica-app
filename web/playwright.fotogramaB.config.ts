// Playwright on its own port and build folder for «Un fotograma» of the Master System, Mega Drive and Neo Geo
// (tests/fotogramaB.spec.ts), so its suite can run while other agents use theirs.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.fotogramaB.config.ts
// (EPA_DIST: build folder, by default in the system temp folder; EPA_PUERTO: port, by default 4241)
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? join(tmpdir(), 'epa-dist-fotogramaB');
const puerto = Number(process.env.EPA_PUERTO ?? 4241);

export default defineConfig({
  ...base,
  testMatch: /fotogramaB\.spec\.ts/,
  use: { ...base.use, baseURL: `http://localhost:${puerto}/` },
  webServer: {
    command: `npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}/`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
