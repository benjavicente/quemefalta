import { test, expect } from '@playwright/test';
import { setupSupabaseRoutes, injectSession } from './fixtures/handlers';
import { TEST_PROFILE } from './fixtures/data';

test.use({
  viewport: { width: 375, height: 812 },
  hasTouch: true,
});

test.describe('Mobile (375px)', () => {
  test.beforeEach(async ({ page }) => {
    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE,
      stickers: [],
    });
    await injectSession(page);
  });

  test('touch tap marks sticker as owned and updates count', async ({ page }) => {
    await page.goto('/album');

    await page.locator('.acc-team').first().click();
    await expect(page.locator('.stk').first()).toBeVisible();

    // Tap 3 stickers — locator.tap() dispatches a real touch event AND auto-scrolls
    // the target into view, which page.touchscreen.tap() does not.
    for (let i = 0; i < 3; i++) {
      const sticker = page.locator('.stk').nth(i);
      await sticker.tap();
      await expect(sticker).toHaveClass(/stk-owned/, { timeout: 3000 });
    }

    await expect(page.locator('.acc-team-count').first()).toContainText('3/20');
  });

  test('long press opens bottom-sheet detail modal', async ({ page }) => {
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
    const box = await firstSticker.boundingBox();
    if (!box) throw new Error('Sticker not visible');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.up();

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
