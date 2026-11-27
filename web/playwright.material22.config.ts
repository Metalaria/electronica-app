// 2.2 «Material en Android» (tests/material22-*.spec.ts): window size classes (bottom bar < 600, rail 600–839, rail and
// index ≥ 840), 48 dp touch targets, the pressed state layer and the focus ring, the system's back closing what is open
// on top first, edge to edge, the system's text size. Own port and build folder (EPA_DIST, EPA_PUERTO override them).
// The «telefono», «tableta» and «apaisada» projects are the owner's Pixel 8 Pro and Xiaomi Pad 6 (each test says which).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.material22.config.ts
// Other specs on this port: EPA_PRUEBAS='<regular expression of spec files>'.
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-22a/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4811);

export default defineConfig({
  ...base,
  testMatch: process.env.EPA_PRUEBAS ? new RegExp(process.env.EPA_PRUEBAS) : /material22-.*\.spec\.ts/,
  timeout: 240_000,
  use: { ...base.use, baseURL: `http://localhost:${puerto}/` },
  webServer: process.env.EPA_SIN_SERVIDOR
    ? undefined
    : {
        command: `node scripts/ngspice.mjs && npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
        url: `http://localhost:${puerto}/`,
        reuseExistingServer: true,
        timeout: 400_000,
      },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    {
      name: 'telefono',
      use: { ...devices['Desktop Chrome'], viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, hasTouch: true, isMobile: true },
    },
    {
      name: 'tableta',
      use: { ...devices['Desktop Chrome'], viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2.5, hasTouch: true, isMobile: true },
    },
    {
      name: 'apaisada',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2.5, hasTouch: true, isMobile: true },
    },
  ],
});
