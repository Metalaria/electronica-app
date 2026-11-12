// 1.2 «sync41»: the app as a mirror of book 4.1 (ids of 4.1 and the migration of 1.1 data, numbering, QR codes,
// courses). Node only: no browser, no server.
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.sync41.config.ts
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: /sync41.*\.spec\.ts/,
  timeout: 120_000,
  webServer: undefined,
  projects: [{ name: 'node' }],
});
