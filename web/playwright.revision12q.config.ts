// Playwright for the second independent review of the 0.12 «platform» block (revision12q-*.spec.ts), on its own
// port and build folder so it can run next to the other 0.12 agents.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision12q.config.ts
// (EPA_DIST: build folder, by default /tmp/claude-0/epa-revision12q/dist; EPA_PUERTO: port, by default 4547)
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-revision12q/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4547);

export default defineConfig({
  ...base,
  testMatch: /revision12q-.*\.spec\.ts/,
  use: { ...base.use, baseURL: `http://localhost:${puerto}/` },
  webServer: {
    command: `node scripts/ngspice.mjs && npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}/`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
