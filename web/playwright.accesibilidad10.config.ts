// 1.0 accessibility pass (WCAG 2.2 AA): axe on every kind of route in light, sepia and dark, on the desktop and on a
// 360 px phone, plus keyboard-only flows of the critical paths. Own port and build folder (EPA_DIST, EPA_PUERTO).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb nice npx playwright test -c playwright.accesibilidad10.config.ts
// ACC_FILTRO=<regexp> limits the routes by id; ACC_TEMAS=claro,oscuro the themes; ACC_INFORME=<file.json> writes
// every finding to that file instead of failing (the audit mode used to triage).
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-accesibilidad10/dist';
const puerto = Number(process.env.EPA_PUERTO ?? 4741);

export default defineConfig({
  ...base,
  testMatch: /accesibilidad10.*\.spec\.ts/,
  timeout: 1_800_000,
  use: { ...base.use, baseURL: `http://localhost:${puerto}/` },
  webServer: process.env.EPA_SIN_SERVIDOR ? undefined : {
    command: `node scripts/ngspice.mjs && npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}/`,
    reuseExistingServer: true,
    timeout: 400_000,
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    // a 360 px phone (touch): the narrowest layout the owner uses
    { name: 'telefono', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  ],
});
