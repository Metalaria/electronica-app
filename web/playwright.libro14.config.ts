// 1.4 (libro14): the sepia slider track (tests/libro14-temas.spec.ts) and the console's 3D board on the phone, clear
// of the bottom tab bar (tests/libro14-placa3d.spec.ts). Own port and build folder (EPA_DIST, EPA_PUERTO override
// them); the phone is the owner's Pixel 8 Pro (412×915, DPR 3.5, touch).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.libro14.config.ts
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/build-lib14/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4443);

export default defineConfig({
  ...base,
  testMatch: /libro14.*\.spec\.ts/,
  timeout: 180_000,
  workers: 1,
  use: { ...base.use, baseURL: `http://localhost:${puerto}/` },
  webServer: {
    command: `node scripts/ngspice.mjs && npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}/`,
    reuseExistingServer: true,
    timeout: 400_000,
  },
  projects: [{ name: 'chromium' }],
});
