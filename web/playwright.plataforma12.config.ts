// Playwright on its own port and build folder for the 0.12 «platform» block: signed automatic updates (the
// updater UI with the Tauri APIs stubbed, the anonymous release check and GitHub's rate limit) and the CI side
// of the updates (web/scripts/actualizador.mjs and the publish step of compilar.yml, run with a fake `gh`).
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.plataforma12.config.ts
// EPA_SIN_SERVIDOR=1 … actualizador-ci runs only the CI part, without building the app.
// (EPA_DIST: build folder, by default in the system temp folder; EPA_PUERTO: port, by default 4511)
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? join(tmpdir(), 'epa-dist-plataforma12');
const puerto = Number(process.env.EPA_PUERTO ?? 4511);

export default defineConfig({
  ...base,
  testMatch: /(actualizador-ci|actualizador12|confirmacion12)\.spec\.ts/,
  use: { ...base.use, baseURL: `http://localhost:${puerto}/` },
  // EPA_SIN_SERVIDOR=1: only the CI spec (actualizador-ci), which needs no web build
  webServer: process.env.EPA_SIN_SERVIDOR ? undefined : {
    command: `node scripts/ngspice.mjs && npx vite build --outDir ${dist} --emptyOutDir && npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}/`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
