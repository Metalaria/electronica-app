// Playwright on its own port and build folder for the schematic editor of 0.10 (new parts, switches and knobs
// while simulating, parameter sweep, tidying up, notes, electrical rule check), so its spec can run while other
// agents use theirs.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.editor10.config.ts tests/editor10.spec.ts
// (EPA_DIST: build folder, by default in the system temp folder; EPA_PUERTO: port, by default 4381)
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? join(tmpdir(), 'epa-dist-editor10');
const puerto = Number(process.env.EPA_PUERTO ?? 4381);

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
