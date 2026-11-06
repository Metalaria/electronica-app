// Review 10j (exceptional 4th review of the exercises' merge): Node-only tests, no browser nor server.
//   npx playwright test -c playwright.revision10j.config.ts
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: /revision10j-.*\.spec\.ts/,
  timeout: 300_000,
  webServer: undefined,
  projects: [{ name: 'node' }],
});
