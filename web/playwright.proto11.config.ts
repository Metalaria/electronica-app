// Playwright on its own port and build folder for the 0.11 breadboard redesign (parts tray, ghost, floating
// bar, wires, «Monta este circuito», first-use tour), so its spec can run while other agents use other ports.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.proto11.config.ts tests/proto11.spec.ts
// (EPA_DIST: build folder, by default in the system temp folder; EPA_PUERTO: port, by default 4441)
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? join(tmpdir(), 'epa-dist-proto11');
const puerto = Number(process.env.EPA_PUERTO ?? 4441);

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
