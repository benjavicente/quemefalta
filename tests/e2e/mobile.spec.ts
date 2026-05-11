import { test, expect } from '@playwright/test';
import { setupSupabaseRoutes, injectSession } from './fixtures/handlers';
import { TEST_PROFILE } from './fixtures/data';

test.use({
  viewport: { width: 375, height: 812 }, // iPhone SE
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

  test('sticker grid shows 3 columns at 375px', async ({ page }) => {
    await page.goto('/album');

    // Expand intro section to see sticker grid
    await page.locator('.acc-team').first().click();
    await expect(page.locator('.stk').first()).toBeVisible();

    const columns = await page.locator('.sect-grid').evaluate((el) => {
      return getComputedStyle(el).gridTemplateColumns;
    });

    const colCount = columns.split(' ').length;
    expect(colCount).toBe(3);
  });

  test('accordion groups are visible and interactive', async ({ page }) => {
    await page.goto('/album');

    // Groups A-L should be visible
    const groupHeads = page.locator('.acc-group-head');
    await expect(groupHeads.first()).toBeVisible();

    // Click to expand Group A
    await groupHeads.first().click();
    await expect(page.locator('.acc-teams')).toBeVisible();

    // Teams should be visible
    const teams = page.locator('.acc-teams .acc-team');
    await expect(teams.first()).toBeVisible();
  });

  test('touch tap on sticker marks it as owned', async ({ page }) => {
    await page.goto('/album');

    // Expand intro section
    await page.locator('.acc-team').first().click();
    await expect(page.locator('.stk').first()).toBeVisible();

    const firstSticker = page.locator('.stk').first();
    const box = await firstSticker.boundingBox();
    if (!box) throw new Error('Sticker not visible');

    // Simulate touch tap
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

    await expect(firstSticker).toHaveClass(/stk-owned/, { timeout: 3000 });
  });

  test('detail modal appears as bottom sheet on mobile', async ({ page }) => {
    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE,
      stickers: [{ sticker_number: 1, owned: true, dupes: 0, note: null }],
    });
    await injectSession(page);
    await page.goto('/album');

    // Expand intro section
    await page.locator('.acc-team').first().click();

    const firstSticker = page.locator('.stk').first();
    await expect(firstSticker).toHaveClass(/stk-owned/);
    const box = await firstSticker.boundingBox();
    if (!box) throw new Error('Sticker not visible');

    // Long press
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.up();

    const modal = page.locator('.pop');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // On mobile (<640px), modal should have rounded top only
    const borderRadius = await modal.evaluate((el) => {
      return getComputedStyle(el).borderRadius;
    });
    expect(borderRadius).toContain('12px 12px 0');
  });

  test('progress section is visible and responsive', async ({ page }) => {
    await page.goto('/album');

    const progress = page.locator('.progress');
    await expect(progress).toBeVisible();
    await expect(page.locator('.progress-pct')).toBeVisible();

    const box = await progress.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(375);
  });

  test('tabs are visible and tappable at mobile width', async ({ page }) => {
    await page.goto('/album');

    const tabs = page.locator('.tabs');
    await expect(tabs).toBeVisible();
    await expect(page.locator('.tab')).toHaveCount(3);

    // Tap "Faltan" tab
    await page.locator('.tab').nth(1).click();
    await expect(page.locator('.tab').nth(1)).toHaveClass(/on/);
  });
});
