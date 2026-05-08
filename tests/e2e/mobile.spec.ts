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
    await expect(page.locator('.stk').first()).toBeVisible();

    // Check grid has 3 columns via computed style
    const columns = await page.locator('.sect-grid').evaluate((el) => {
      return getComputedStyle(el).gridTemplateColumns;
    });

    // Should be 3 equal columns (3 values separated by spaces)
    const colCount = columns.split(' ').length;
    expect(colCount).toBe(3);
  });

  test('section picker is horizontally scrollable', async ({ page }) => {
    await page.goto('/album');

    const picker = page.locator('.sec-picker');
    await expect(picker).toBeVisible();

    // Picker should overflow (scrollWidth > clientWidth for 49 chips)
    const overflows = await picker.evaluate((el) => {
      return el.scrollWidth > el.clientWidth;
    });
    expect(overflows).toBe(true);
  });

  test('section picker can be scrolled to reveal more chips', async ({ page }) => {
    await page.goto('/album');

    const picker = page.locator('.sec-picker');
    await expect(picker).toBeVisible();

    // Scroll the picker to the right
    await picker.evaluate((el) => {
      el.scrollLeft = 300;
    });

    const scrollLeft = await picker.evaluate((el) => el.scrollLeft);
    expect(scrollLeft).toBeGreaterThan(0);
  });

  test('touch tap on sticker marks it as owned', async ({ page }) => {
    await page.goto('/album');
    await expect(page.locator('.stk').first()).toBeVisible();

    const firstSticker = page.locator('.stk').first();
    const box = await firstSticker.boundingBox();
    if (!box) throw new Error('Sticker not visible');

    // Simulate touch tap
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

    await expect(firstSticker).toHaveClass(/stk-owned/, { timeout: 3000 });
  });

  test('detail modal appears as bottom sheet on mobile', async ({ page }) => {
    // Start with owned sticker
    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE,
      stickers: [{ sticker_number: 1, owned: true, dupes: 0, note: null }],
    });
    await injectSession(page);
    await page.goto('/album');

    const firstSticker = page.locator('.stk').first();
    await expect(firstSticker).toHaveClass(/stk-owned/);
    const box = await firstSticker.boundingBox();
    if (!box) throw new Error('Sticker not visible');

    // Long press via mouse (touch long-press is complex)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.up();

    // Modal should be visible at the bottom
    const modal = page.locator('.pop');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // On mobile (<640px), the modal should be at the bottom (border-radius top only)
    const borderRadius = await modal.evaluate((el) => {
      return getComputedStyle(el).borderRadius;
    });
    // Should have rounded top corners and flat bottom
    expect(borderRadius).toContain('12px 12px 0');
  });

  test('progress section is visible and responsive', async ({ page }) => {
    await page.goto('/album');

    const progress = page.locator('.progress');
    await expect(progress).toBeVisible();

    // Progress percentage should be visible
    await expect(page.locator('.progress-pct')).toBeVisible();

    // Check it fits within viewport width
    const box = await progress.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(375);
  });

  test('tabs are visible and tappable at mobile width', async ({ page }) => {
    await page.goto('/album');

    const tabs = page.locator('.tabs');
    await expect(tabs).toBeVisible();

    // All 3 tabs visible
    await expect(page.locator('.tab')).toHaveCount(3);

    // Tap "Faltan" tab
    await page.locator('.tab').nth(1).click();
    await expect(page.locator('.tab').nth(1)).toHaveClass(/on/);
  });
});
