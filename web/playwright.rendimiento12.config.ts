// Playwright on its own port and build folder for the 0.12 performance work on the 3D boards (the studio's
// environment filtered once per device, the 3D code fetched with the board's data, the board geometry without the
// quadratic Path2D.closePath, no blocking GL work while the GPU is busy): tests/rendimiento12.spec.ts.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.rendimiento12.config.ts tests/rendimiento12.spec.ts
// (EPA_DIST: build folder, by default in the system temp folder; EPA_PUERTO: port, by default 4531)
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? join(tmpdir(), 'epa-dist-rendimiento12');
const puerto = Number(process.env.EPA_PUERTO ?? 4531);
// The WebView of the owner's Xiaomi Pad 6 (as in tests/qa/perfiles.ts): Android picks the 2048 px faces.
const UA_TABLETA =
  'Mozilla/5.0 (Linux; Android 14; 23043RP34G Build/UKQ1.230804.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Safari/537.36';

export default defineConfig({
  ...base,
  timeout: 300_000,
  use: { ...base.use, baseURL: `http://localhost:${puerto}/`, launchOptions: { args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] } },
  webServer: {
    command: `npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}/`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
  projects: [
    {
      name: 'tableta',
      use: { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true, userAgent: UA_TABLETA, locale: 'es-ES', colorScheme: 'light', reducedMotion: 'reduce' },
    },
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 }, locale: 'es-ES', colorScheme: 'light', reducedMotion: 'reduce' } },
  ],
});
