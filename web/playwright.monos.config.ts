// 1.3.1: the whole-app monkey (tests/monos/), not part of the default suite. Builds into EPA_DIST and serves it on
// EPA_PUERTO (QA_SIN_COMPILAR=1: serve the build already there). See tests/monos/monos.spec.ts for MONO_* variables.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers MONO_RUNS=50 MONO_ACCIONES=300 nice npx playwright test -c playwright.monos.config.ts
//   … --project=telefono                                   one profile
//   MONO_RASTRO=test-results/monos/telefono-1312.json …    replay a failing run's shrunk trail
//   … tests/monos/barrido.spec.ts                           the route sweep (themes, offline, CPU ×6, back/forward)
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

const dist = process.env.EPA_DIST ?? join(tmpdir(), 'epa-dist-monos');
const puerto = Number(process.env.EPA_PUERTO ?? 4436);
const comun = { locale: 'es-ES', timezoneId: 'Europe/Madrid' };

export default defineConfig({
  testDir: 'tests/monos',
  // the monkey and the route sweep (barrido.spec.ts); other specs in tests/monos/ are their own
  testMatch: /(^|\/)(monos|barrido)\.spec\.ts$/,
  timeout: 60 * 60_000,
  fullyParallel: true,
  workers: Number(process.env.MONO_WORKERS ?? 1),
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${puerto}/`,
    trace: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    // window.gc() and performance.memory for the heap oracle
    launchOptions: { args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] },
  },
  webServer: {
    command: `${process.env.QA_SIN_COMPILAR ? '' : `npx vite build --outDir ${dist} --emptyOutDir && `}npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}/`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
  projects: [
    // Pixel 8 Pro
    { name: 'telefono', use: { ...comun, viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true, colorScheme: 'dark' } },
    // Xiaomi Pad 6
    { name: 'tableta', use: { ...comun, viewport: { width: 834, height: 1334 }, deviceScaleFactor: 2.25, isMobile: true, hasTouch: true, colorScheme: 'light' } },
    { name: 'escritorio', use: { ...comun, viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' } },
    { name: 'escritorio-hd', use: { ...comun, viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'dark', forcedColors: 'active' } },
  ],
});
