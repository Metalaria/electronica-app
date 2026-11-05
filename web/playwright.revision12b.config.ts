// Playwright for the independent review 12b (port 4543, build /tmp/claude-0/epa-revision12b): the two-tab tests of
// tests/revision12b-*.spec.ts. Build first: npx vite build --outDir /tmp/claude-0/epa-revision12b --emptyOutDir
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const dist = process.env.EPA_DIST ?? '/tmp/claude-0/epa-revision12b';
const puerto = Number(process.env.EPA_PUERTO ?? 4543);

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
