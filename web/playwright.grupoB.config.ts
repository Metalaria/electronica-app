// Playwright on its own port and build folder for 0.11 «group B» (live figures inside the lessons, mastery per
// concept, «Práctica inteligente», the problem of the day), so its spec can run while other agents use other ports.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.grupoB.config.ts tests/grupoB11.spec.ts
// (EPA_DIST: build folder, by default /tmp/epa-dist-grupoB; EPA_PUERTO: port, by default 4461)
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? join(tmpdir(), 'epa-dist-grupoB');
const puerto = Number(process.env.EPA_PUERTO ?? 4461);

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
