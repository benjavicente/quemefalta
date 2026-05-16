import { test, expect } from '@playwright/test';
import { setupSupabaseRoutes, injectSession, disableServiceWorker } from './fixtures/handlers';
import { TEST_PROFILE } from './fixtures/data';

test.describe('Album Flow', () => {
  test.beforeEach(async ({ page }) => {
    await disableServiceWorker(page);
    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE,
      stickers: [],
    });
    await injectSession(page);
  });

  test('shows empty album with 0% progress', async ({ page }) => {
    await page.goto('/album');

    await expect(page.locator('.progress-pct')).toContainText('0%');
    await expect(page.locator('.acc-team-count').first()).toContainText('0/20');
  });

  test('botón + marca el sticker como owned', async ({ page }) => {
    await page.goto('/album');

    await page.locator('.acc-team').first().click();
    await expect(page.locator('.stk').first()).toBeVisible();

    const firstWrap = page.locator('.stk-wrap').first();
    const firstSticker = firstWrap.locator('.stk');
    await firstWrap.locator('.stk-ctrl-plus').click();

    await expect(firstSticker).toHaveClass(/stk-owned/, { timeout: 3000 });
  });

  test('tap en el sticker abre el detalle', async ({ page }) => {
    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE,
      stickers: [{ sticker_number: 1, owned: true, dupes: 0, note: null }],
    });
    await injectSession(page);
    await page.goto('/album');

    await page.locator('.acc-team').first().click();
    const firstSticker = page.locator('.stk').first();
    await expect(firstSticker).toHaveClass(/stk-owned/);

    await firstSticker.click();

    await expect(page.locator('.pop')).toBeVisible({ timeout: 3000 });
  });

  test('complete section marks all stickers', async ({ page }) => {
    await page.goto('/album');

    await page.locator('.acc-team').first().click();
    await expect(page.locator('.stk').first()).toBeVisible();

    await page.click('.complete-btn');

    await expect(page.locator('.acc-team-count').first()).toContainText('20/20', { timeout: 3000 });
    const ownedCount = await page.locator('.stk-owned').count();
    expect(ownedCount).toBe(20);
  });

  test('clear section removes all stickers', async ({ page }) => {
    const stickerRows = Array.from({ length: 20 }, (_, i) => ({
      sticker_number: i + 1,
      owned: true,
      dupes: 0,
      note: null,
    }));
    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE,
      stickers: stickerRows,
    });
    await injectSession(page);
    await page.goto('/album');

    await page.locator('.acc-team').first().click();
    await expect(page.locator('.acc-team-count').first()).toContainText('20/20');

    await page.click('.clear-btn');
    await page.click('.cd-danger');

    await expect(page.locator('.acc-team-count').first()).toContainText('0/20', { timeout: 3000 });
  });

  test('accordion navigates between groups and teams', async ({ page }) => {
    await page.goto('/album');

    await page.locator('.acc-group-head').first().click();
    await expect(page.locator('.acc-teams')).toBeVisible();

    await page.locator('.acc-teams .acc-team').first().click();

    await expect(page.locator('.sect-name')).toContainText('México');
    await expect(page.locator('.stk')).toHaveCount(20);
  });
});
