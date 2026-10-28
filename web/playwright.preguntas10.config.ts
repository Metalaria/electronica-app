// Playwright on its own port and build folder for «Aprender haciendo» (0.10: the practice items of the lessons,
// componentes/practica/), so it can run while other suites use their ports.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.preguntas10.config.ts tests/preguntas10.spec.ts
// (EPA_DIST: build folder, by default in the system temp folder; EPA_PUERTO: port, by default 4391)
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? join(tmpdir(), 'epa-dist-preguntas10');
const puerto = Number(process.env.EPA_PUERTO ?? 4391);

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
