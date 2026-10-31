// Playwright on its own port and build folder for the fixes of the independent review of 0.11 (findings 1–11),
// so its spec can run while other agents use other ports.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.revision.config.ts tests/revision11.spec.ts
// (EPA_DIST: build folder, by default /tmp/epa-dist-revision; EPA_PUERTO: port, by default 4471)
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/epa-dist-revision';
const puerto = Number(process.env.EPA_PUERTO ?? 4471);

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
