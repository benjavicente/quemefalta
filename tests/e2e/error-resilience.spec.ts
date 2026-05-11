import { test, expect } from '@playwright/test';
import { setupSupabaseRoutes, injectSession } from './fixtures/handlers';
import { TEST_PROFILE } from './fixtures/data';

test.describe('Error Resilience', () => {
  test.describe('401 — expired session triggers retry + sessionDead', () => {
    test('single 401 on sticker save triggers refresh and retries successfully', async ({
      page,
    }) => {
      // First POST returns 401, subsequent ones succeed (failCount=1)
      await setupSupabaseRoutes(page, {
        authenticated: true,
        profile: TEST_PROFILE,
        stickers: [],
        stickerErrors: {
          POST: {
            status: 401,
            body: { message: 'JWT expired', code: '401' },
            failCount: 1,
          },
        },
      });
      await injectSession(page);
      await page.goto('/album');

      await page.locator('.acc-team').first().click();
      await expect(page.locator('.stk').first()).toBeVisible();

      const firstSticker = page.locator('.stk').first();
      await firstSticker.click();

      // After retry succeeds, sticker should stay owned
      await expect(firstSticker).toHaveClass(/stk-owned/, { timeout: 10000 });
    });

    test('persistent 401 shows session dead popup', async ({ page }) => {
      // ALL sticker POSTs return 401 + auth refresh always fails
      await setupSupabaseRoutes(page, {
        authenticated: true,
        profile: TEST_PROFILE,
        stickers: [],
        stickerErrors: {
          POST: {
            status: 401,
            body: { message: 'JWT expired', code: '401' },
          },
        },
        authRefreshError: {
          status: 401,
          body: { error: 'invalid_grant', error_description: 'Token expired' },
        },
      });
      await injectSession(page);
      await page.goto('/album');

      await page.locator('.acc-team').first().click();
      await expect(page.locator('.stk').first()).toBeVisible();

      await page.locator('.stk').first().click();

      // Session dead popup should appear
      await expect(page.locator('.dead-modal')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('.dead-title')).toContainText('SESIÓN EXPIRADA');
      await expect(page.locator('.dead-btn')).toContainText('Recargar página');
    });
  });

  test.describe('500 — server error shows sync error and reverts', () => {
    test('500 on sticker POST shows sync-error banner', async ({ page }) => {
      await setupSupabaseRoutes(page, {
        authenticated: true,
        profile: TEST_PROFILE,
        stickers: [],
        stickerErrors: {
          POST: { status: 500, body: { message: 'Internal Server Error', code: '500' } },
        },
      });
      await injectSession(page);
      await page.goto('/album');

      await page.locator('.acc-team').first().click();
      await expect(page.locator('.stk').first()).toBeVisible();

      const firstSticker = page.locator('.stk').first();
      await firstSticker.click();

      // Sync error banner appears
      await expect(page.locator('.sync-error')).toBeVisible({ timeout: 5000 });

      // Sticker reverts to not-owned
      await expect(firstSticker).not.toHaveClass(/stk-owned/, { timeout: 5000 });
    });

    test('500 on section complete reverts all stickers', async ({ page }) => {
      await setupSupabaseRoutes(page, {
        authenticated: true,
        profile: TEST_PROFILE,
        stickers: [],
        stickerErrors: {
          POST: { status: 500, body: { message: 'Internal Server Error', code: '500' } },
        },
      });
      await injectSession(page);
      await page.goto('/album');

      await page.locator('.acc-team').first().click();
      await expect(page.locator('.stk').first()).toBeVisible();

      // Click "Completar"
      await page.click('.complete-btn');

      // Should show error and revert
      await expect(page.locator('.sync-error')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.acc-team-count').first()).toContainText('0/20', { timeout: 5000 });
    });

    test('500 on initial sticker load shows sync error', async ({ page }) => {
      await setupSupabaseRoutes(page, {
        authenticated: true,
        profile: TEST_PROFILE,
        stickers: [],
        stickerErrors: {
          GET: { status: 500, body: { message: 'Database error', code: '500' } },
        },
      });
      await injectSession(page);

      await page.goto('/album');

      // Sync error banner should be visible
      await expect(page.locator('.sync-error')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Timeout — slow responses', () => {
    test('very slow response still shows optimistic update immediately', async ({ page }) => {
      await setupSupabaseRoutes(page, {
        authenticated: true,
        profile: TEST_PROFILE,
        stickers: [],
        delay: 2000,
      });
      await injectSession(page);
      await page.goto('/album');

      await page.locator('.acc-team').first().click();
      await expect(page.locator('.stk').first()).toBeVisible();

      const firstSticker = page.locator('.stk').first();
      await firstSticker.click();

      // Should appear owned immediately (optimistic), even though network takes 2s
      await expect(firstSticker).toHaveClass(/stk-owned/, { timeout: 500 });
    });
  });

  test.describe('Offline — no network', () => {
    test('going offline after load shows error on sticker action', async ({ page, context }) => {
      await setupSupabaseRoutes(page, {
        authenticated: true,
        profile: TEST_PROFILE,
        stickers: [],
      });
      await injectSession(page);
      await page.goto('/album');

      await page.locator('.acc-team').first().click();
      await expect(page.locator('.stk').first()).toBeVisible();

      // Remove all route handlers, then go offline so requests actually fail
      await page.unrouteAll();
      await context.setOffline(true);

      const firstSticker = page.locator('.stk').first();
      await firstSticker.click();

      // Should show sync error (network request fails)
      await expect(page.locator('.sync-error')).toBeVisible({ timeout: 10000 });

      // Sticker should revert
      await expect(firstSticker).not.toHaveClass(/stk-owned/, { timeout: 5000 });
    });

    test('sticker reverts to unowned after offline error', async ({ page, context }) => {
      await setupSupabaseRoutes(page, {
        authenticated: true,
        profile: TEST_PROFILE,
        stickers: [],
      });
      await injectSession(page);
      await page.goto('/album');

      await page.locator('.acc-team').first().click();
      await expect(page.locator('.stk').first()).toBeVisible();

      // Remove route handlers and go offline so requests actually fail
      await page.unrouteAll();
      await context.setOffline(true);

      const firstSticker = page.locator('.stk').first();
      await firstSticker.click();

      // Should show sync error and revert sticker
      await expect(page.locator('.sync-error')).toBeVisible({ timeout: 10000 });
      await expect(firstSticker).not.toHaveClass(/stk-owned/, { timeout: 5000 });
    });
  });
});
