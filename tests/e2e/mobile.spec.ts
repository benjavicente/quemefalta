import { test, expect } from '@playwright/test';
import { setupSupabaseRoutes, injectSession, disableServiceWorker } from './fixtures/handlers';
import { TEST_PROFILE } from './fixtures/data';

test.use({
  viewport: { width: 375, height: 812 },
  hasTouch: true,
});

test.describe('Mobile (375px)', () => {
  test.beforeEach(async ({ page }) => {
    await disableServiceWorker(page);
    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE,
      stickers: [],
    });
    await injectSession(page);
  });

  test('touch en + marca el sticker y actualiza el conteo', async ({ page }) => {
    await page.goto('/album');

    await page.locator('.acc-team').first().click();
    await expect(page.locator('.stk').first()).toBeVisible();

    // Tap on the + button of 3 stickers
    for (let i = 0; i < 3; i++) {
      const wrap = page.locator('.stk-wrap').nth(i);
      await wrap.locator('.stk-ctrl-plus').tap();
      await expect(wrap.locator('.stk')).toHaveClass(/stk-owned/, { timeout: 3000 });
    }

    await expect(page.locator('.acc-team-count').first()).toContainText('3/20');
  });

  test('tap en sticker abre bottom-sheet de detalle', async ({ page }) => {
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

    await firstSticker.tap();

    const modal = page.locator('.pop');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Mobile bottom sheet has rounded top corners only
    const borderRadius = await modal.evaluate((el) => getComputedStyle(el).borderRadius);
    expect(borderRadius).toContain('12px 12px 0');
  });

  test('accordion expand → team → stickers on small viewport', async ({ page }) => {
    await page.goto('/album');

    await page.locator('.acc-group-head').first().click();
    await expect(page.locator('.acc-teams')).toBeVisible();

    await page.locator('.acc-teams .acc-team').first().click();
    await expect(page.locator('.sect-name')).toBeVisible();
    await expect(page.locator('.stk')).toHaveCount(20);
  });

  test('complete section then switch to missing tab', async ({ page }) => {
    await page.goto('/album');

    await page.locator('.acc-team').first().click();
    await expect(page.locator('.stk').first()).toBeVisible();

    await page.click('.complete-btn');
    await expect(page.locator('.acc-team-count').first()).toContainText('20/20', { timeout: 3000 });

    await page.locator('.tab').nth(1).click();
    await expect(page.locator('.tab').nth(1)).toHaveClass(/on/);
    await expect(page.locator('.list-head-text h2')).toContainText('TE FALTAN 960');
  });

  test('batch input modal fits mobile width', async ({ page }) => {
    await page.goto('/album');

    await page.click('.tab-add');
    await expect(page.locator('.bi')).toBeVisible();

    const modalBox = await page.locator('.bi').boundingBox();
    expect(modalBox!.width).toBeLessThanOrEqual(375);

    await page.locator('.bi-input').fill('FWC1, FWC2');
    await expect(page.locator('.bi-preview-card')).toContainText('+2');
    await page.click('.bi-btn');
    await expect(page.locator('.bi')).not.toBeVisible();
  });

  test('progress bar fits within viewport', async ({ page }) => {
    await page.goto('/album');

    const progress = page.locator('.progress');
    await expect(progress).toBeVisible();
    const box = await progress.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(375);
  });
});
