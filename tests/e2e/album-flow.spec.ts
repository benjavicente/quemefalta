import { test, expect } from '@playwright/test';
import { setupSupabaseRoutes, injectSession } from './fixtures/handlers';
import { TEST_PROFILE, SUPABASE_URL } from './fixtures/data';

test.describe('Album Flow', () => {
  test.beforeEach(async ({ page }) => {
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
    await expect(page.locator('.sect-badge')).toContainText('0/20');
  });

  test('tap sticker marks it as owned', async ({ page }) => {
    await page.goto('/album');

    // Wait for grid to load
    await expect(page.locator('.stk').first()).toBeVisible();

    // First sticker should not be owned
    const firstSticker = page.locator('.stk').first();
    await expect(firstSticker).not.toHaveClass(/stk-owned/);

    // Tap it (quick click)
    await firstSticker.click();

    // Should now be owned (golden)
    await expect(firstSticker).toHaveClass(/stk-owned/, { timeout: 3000 });
  });

  test('long press opens detail modal', async ({ page }) => {
    await page.goto('/album');
    await expect(page.locator('.stk').first()).toBeVisible();

    // First tap to own the sticker
    const firstSticker = page.locator('.stk').first();
    await firstSticker.click();
    await expect(firstSticker).toHaveClass(/stk-owned/, { timeout: 3000 });

    // Long press: pointerdown, wait 500ms, pointerup
    const box = await firstSticker.boundingBox();
    if (!box) throw new Error('Sticker not visible');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.up();

    // Detail modal should appear
    await expect(page.locator('.pop')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.pop-title')).toContainText('#1');
  });

  test('stepper in detail modal changes dupes', async ({ page }) => {
    // Start with 1 owned sticker
    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE,
      stickers: [{ sticker_number: 1, owned: true, dupes: 0, note: null }],
    });
    await injectSession(page);
    await page.goto('/album');

    // Long press first sticker to open modal
    const firstSticker = page.locator('.stk').first();
    await expect(firstSticker).toHaveClass(/stk-owned/);
    const box = await firstSticker.boundingBox();
    if (!box) throw new Error('Sticker not visible');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.up();

    await expect(page.locator('.pop')).toBeVisible();

    // Click + button to add dupes
    await page.locator('.step-btn').last().click();
    await expect(page.locator('.step-num')).toContainText('2');

    // Save
    await page.click('.btn-save');
    await expect(page.locator('.pop')).not.toBeVisible();

    // Badge should show ×2
    await expect(firstSticker.locator('.stk-badge')).toContainText('×2');
  });

  test('complete section marks all stickers', async ({ page }) => {
    await page.goto('/album');
    await expect(page.locator('.stk').first()).toBeVisible();

    // Click "Completar" button
    await page.click('.complete-btn');

    // Badge should show 20/20
    await expect(page.locator('.sect-badge')).toContainText('20/20', { timeout: 3000 });

    // All stickers should be owned
    const ownedCount = await page.locator('.stk-owned').count();
    expect(ownedCount).toBe(20);
  });

  test('clear section removes all stickers', async ({ page }) => {
    // Start with a complete section
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

    await expect(page.locator('.sect-badge')).toContainText('20/20');

    // Click clear button
    await page.click('.clear-btn');

    // Should show 0/20
    await expect(page.locator('.sect-badge')).toContainText('0/20', { timeout: 3000 });
  });

  test('tab "Faltan" shows missing stickers list', async ({ page }) => {
    await page.goto('/album');

    // Click Missing tab
    await page.locator('.tab').nth(1).click();

    await expect(page.locator('.list-head-text h2')).toContainText('TE FALTAN 980');
  });

  test('tab "Repetidas" shows dupes list', async ({ page }) => {
    // Start with some dupes
    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE,
      stickers: [
        { sticker_number: 5, owned: true, dupes: 2, note: 'trade' },
        { sticker_number: 10, owned: true, dupes: 1, note: null },
      ],
    });
    await injectSession(page);
    await page.goto('/album');

    // Click Dupes tab
    await page.locator('.tab').nth(2).click();

    await expect(page.locator('.dupes-list')).toBeVisible();
    await expect(page.locator('.dupe-item')).toHaveCount(2);
  });

  test('optimistic update shows before network response with latency', async ({ page }) => {
    // Set up with 300ms delay
    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE,
      stickers: [],
      delay: 300,
    });
    await injectSession(page);
    await page.goto('/album');

    await expect(page.locator('.stk').first()).toBeVisible();

    // Tap sticker — should appear owned BEFORE 300ms network response
    const firstSticker = page.locator('.stk').first();
    await firstSticker.click();

    // Check immediately — optimistic update should show owned
    await expect(firstSticker).toHaveClass(/stk-owned/, { timeout: 1000 });
  });

  test('network error shows syncError and reverts sticker', async ({ page }) => {
    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE,
      stickers: [],
    });
    await injectSession(page);
    await page.goto('/album');

    await expect(page.locator('.stk').first()).toBeVisible();

    // Override sticker POST to return error
    await page.route(`${SUPABASE_URL}/rest/v1/stickers*`, async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal Server Error', code: '500' }),
        });
      }
      // GET still works
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Tap sticker
    const firstSticker = page.locator('.stk').first();
    await firstSticker.click();

    // Should show sync error banner
    await expect(page.locator('.sync-error')).toBeVisible({ timeout: 5000 });

    // Sticker should revert to not owned
    await expect(firstSticker).not.toHaveClass(/stk-owned/, { timeout: 5000 });
  });

  test('section picker navigates between sections', async ({ page }) => {
    await page.goto('/album');

    // Default section should be "Introduccion"
    await expect(page.locator('.sect-name')).toContainText('Introducción');

    // Click second chip (Mexico)
    await page.locator('.sec-chip').nth(1).click();

    await expect(page.locator('.sect-name')).toContainText('México');
  });
});
