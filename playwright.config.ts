import { defineConfig } from '@playwright/test';

const CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? 'list' : 'html',
  use: {
    baseURL: `http://localhost:${CI ? 4173 : 5174}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 720 } },
    },
  ],
  webServer: {
    // CI: serve built output (faster, matches prod). Local: dev server on 5174 to avoid mock on 5173.
    command: CI ? 'npx vite preview --port 4173' : 'npx vite --port 5174',
    url: `http://localhost:${CI ? 4173 : 5174}`,
    reuseExistingServer: !CI,
    timeout: 15000,
  },
});
