import { test, expect } from '@playwright/test';
import { setupSupabaseRoutes, injectSession } from './fixtures/handlers';
import { TEST_PROFILE, PUBLIC_PROFILE, SUPABASE_URL } from './fixtures/data';

test.describe('Share Flow', () => {
  test('opens share modal and shows profile URL', async ({ page }) => {
    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE,
      stickers: [],
    });
    await injectSession(page);
    await page.goto('/album');

    // Click share button in header
    await page.click('.hdr-icon-btn[title="Compartir mi perfil"]');

    // Modal should appear
    await expect(page.locator('.modal')).toBeVisible();
    await expect(page.locator('.url-text')).toContainText('/u/e2euser');
  });

  test('copy button copies URL to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE,
      stickers: [],
    });
    await injectSession(page);
    await page.goto('/album');

    await page.click('.hdr-icon-btn[title="Compartir mi perfil"]');
    await expect(page.locator('.modal')).toBeVisible();

    // Click copy
    await page.click('.url-copy');

    // Clipboard should contain the URL
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('/u/e2euser');
  });

  test('social links have correct hrefs', async ({ page }) => {
    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE,
      stickers: [],
    });
    await injectSession(page);
    await page.goto('/album');

    await page.click('.hdr-icon-btn[title="Compartir mi perfil"]');

    const socialBtns = page.locator('.social-btn');
    await expect(socialBtns.nth(0)).toHaveAttribute('href', /wa\.me/);
    await expect(socialBtns.nth(1)).toHaveAttribute('href', /linkedin\.com/);
    await expect(socialBtns.nth(2)).toHaveAttribute('href', /^mailto:/);
  });

  test('close button closes share modal', async ({ page }) => {
    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE,
      stickers: [],
    });
    await injectSession(page);
    await page.goto('/album');

    await page.click('.hdr-icon-btn[title="Compartir mi perfil"]');
    await expect(page.locator('.modal')).toBeVisible();

    await page.click('.close-btn');
    await expect(page.locator('.modal')).not.toBeVisible();
  });
});

test.describe('Public Profile', () => {
  test('shows public profile with stats', async ({ page }) => {
    await setupSupabaseRoutes(page, { authenticated: false });

    // Override public_album_stats to return data
    await page.route(`${SUPABASE_URL}/rest/v1/public_album_stats*`, (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PUBLIC_PROFILE),
      });
    });

    await page.goto('/u/pedro42');

    await expect(page.locator('.name')).toContainText('PEDRO GARCIA');
    await expect(page.locator('.handle')).toContainText('@pedro42');
    await expect(page.locator('.big-num')).toContainText('50');
  });

  test('shows not found for unknown user', async ({ page }) => {
    await setupSupabaseRoutes(page, { authenticated: false });

    await page.goto('/u/nonexistent');

    await expect(page.locator('h1')).toContainText('Perfil no encontrado', { timeout: 10000 });
  });

  test('shows "Crear mi album" CTA when not authenticated', async ({ page }) => {
    await setupSupabaseRoutes(page, { authenticated: false });

    await page.route(`${SUPABASE_URL}/rest/v1/public_album_stats*`, (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PUBLIC_PROFILE),
      });
    });

    await page.goto('/u/pedro42');

    await expect(page.locator('.cta-btn')).toContainText('Crear mi álbum');
  });
});
