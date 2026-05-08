import { test, expect } from '@playwright/test';
import { setupSupabaseRoutes, injectSession } from './fixtures/handlers';
import { TEST_PROFILE, SUPABASE_URL } from './fixtures/data';

test('debug album page', async ({ page }) => {
  // Log ALL network requests
  const requests: string[] = [];
  page.on('request', (req) => requests.push(`${req.method()} ${req.url()}`));
  page.on('console', (msg) => console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`));

  await setupSupabaseRoutes(page, { authenticated: true, profile: TEST_PROFILE, stickers: [] });
  await injectSession(page);

  await page.goto('/album');
  await page.waitForTimeout(5000);

  console.log('FINAL URL:', page.url());

  // Print supabase-related requests
  for (const r of requests.filter((r) => r.includes('supabase'))) {
    console.log('[NET]', r);
  }

  // Check if we're on the album page
  const bodyText = await page.locator('body').textContent();
  console.log('BODY TEXT (200 chars):', bodyText?.substring(0, 200));
});
