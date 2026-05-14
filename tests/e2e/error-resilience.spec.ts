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
          // Production marks sessionDead only on PERMANENT refresh errors (see
          // PERMANENT_REFRESH_MESSAGES in src/lib/supabase.ts). The error_description
          // is what auth-js surfaces as error.message, so it must include one of
          // those phrases for isPermanentAuthError() to trip.
          status: 400,
          body: {
            error: 'invalid_grant',
            error_description: 'Invalid Refresh Token: Refresh Token Not Found.',
          },
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
      await expect(page.locator('.dead-btn-secondary')).toContainText('Recargar página');
    });
  });

  test.describe('500 — server error: sticker queues for retry, no revert', () => {
    test('500 on sticker POST queues op, optimistic stays, sync-status banner shows', async ({
      page,
    }) => {
      // Nueva politica: en error transitorio del servidor, el sticker queda
      // marcado (optimistic) y la op va a la sync queue para retry. El usuario
      // ve el banner `.sync-status` (pending o failed), no `.sync-error`.
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

      // Sticker se mantiene marcado (no revierte)
      await expect(firstSticker).toHaveClass(/stk-owned/, { timeout: 5000 });

      // El banner de sync queue aparece (pending o failed)
      await expect(page.locator('.sync-status')).toBeVisible({ timeout: 15000 });

      // Indicador de sync en la lamina (pending o failed)
      await expect(firstSticker.locator('.stk-sync-dot')).toBeVisible({ timeout: 5000 });
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
      await expect(page.locator('.acc-team-count').first()).toContainText('0/20', {
        timeout: 5000,
      });
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
    test('going offline after load: sticker queues for retry, no revert', async ({
      page,
      context,
    }) => {
      // Nueva politica: offline durante una accion → la op va a la queue de
      // sync, el sticker queda marcado y aparece el banner `.sync-status`.
      await setupSupabaseRoutes(page, {
        authenticated: true,
        profile: TEST_PROFILE,
        stickers: [],
      });
      await injectSession(page);
      await page.goto('/album');

      await page.locator('.acc-team').first().click();
      await expect(page.locator('.stk').first()).toBeVisible();

      // Quitar route handlers y poner offline → los requests fallan de verdad.
      await page.unrouteAll();
      await context.setOffline(true);

      const firstSticker = page.locator('.stk').first();
      await firstSticker.click();

      // Optimistic stays — el sticker no revierte.
      await expect(firstSticker).toHaveClass(/stk-owned/, { timeout: 5000 });

      // Banner de sync queue aparece.
      await expect(page.locator('.sync-status')).toBeVisible({ timeout: 15000 });
    });

    test('offline error: sticker keeps optimistic + pending sync indicator', async ({
      page,
      context,
    }) => {
      await setupSupabaseRoutes(page, {
        authenticated: true,
        profile: TEST_PROFILE,
        stickers: [],
      });
      await injectSession(page);
      await page.goto('/album');

      await page.locator('.acc-team').first().click();
      await expect(page.locator('.stk').first()).toBeVisible();

      await page.unrouteAll();
      await context.setOffline(true);

      const firstSticker = page.locator('.stk').first();
      await firstSticker.click();

      // Sticker queda marcado con indicador de pendiente.
      await expect(firstSticker).toHaveClass(/stk-owned/, { timeout: 5000 });
      await expect(firstSticker.locator('.stk-sync-dot')).toBeVisible({ timeout: 5000 });
    });
  });
});
