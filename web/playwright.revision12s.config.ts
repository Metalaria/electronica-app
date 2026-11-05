// Playwright for the fourth independent review of the 0.12 «platform» block (revision12s-*.spec.ts): CI-side checks
// only (README owner commands run against fakes), so no web build or server is needed.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision12s.config.ts
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: /revision12s-.*\.spec\.ts/,
  use: { ...base.use, baseURL: 'http://localhost:4553/' },
  webServer: undefined,
});
