// Playwright on its own port and build folder (the schematic editor's agent), so the suite can run while other
// agents use theirs.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.editor.config.ts [tests/editor.spec.ts]
// (EPA_DIST: build folder, by default in the system temp folder; EPA_PUERTO: port, by default 4201)
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? join(tmpdir(), 'epa-dist-editor');
const puerto = Number(process.env.EPA_PUERTO ?? 4201);

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
