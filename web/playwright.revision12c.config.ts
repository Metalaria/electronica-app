// Playwright for the independent review 12c (port 4551, build /tmp/claude-0/epa-revision12c): the real-tab tests of
// tests/revision12c-*.spec.ts. Build first: npx vite build --outDir /tmp/claude-0/epa-revision12c --emptyOutDir
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-revision12c';
const puerto = Number(process.env.EPA_PUERTO ?? 4551);

export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: `http://localhost:${puerto}/` },
  webServer: {
    command: `npx vite preview --outDir ${dist} --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}/`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
