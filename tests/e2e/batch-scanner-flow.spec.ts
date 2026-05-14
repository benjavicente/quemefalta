import { test, expect } from '@playwright/test';
import { setupSupabaseRoutes, injectSession } from './fixtures/handlers';
import { TEST_PROFILE } from './fixtures/data';

test.describe('Batch Input Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE,
      stickers: [],
    });
    await injectSession(page);
  });

  test('opens modal, enters codes, and marks stickers', async ({ page }) => {
    await page.goto('/album');

    await page.click('.tab-add');
    await expect(page.locator('.bi')).toBeVisible();

    await page.locator('.bi-input').fill('FWC1, FWC5, FWC10');
    await expect(page.locator('.bi-preview')).toContainText('3 láminas');

    await page.click('.bi-btn');
    await expect(page.locator('.bi')).not.toBeVisible();

    // Verify stickers are owned (FWC is zero-indexed: FWC1 = sticker #2, FWC0 = sticker #1).
    // Use the section count badge instead of .stk first, which is FWC0 and not in the batch.
    await expect(page.locator('.acc-team-count').first()).toContainText('3/20', { timeout: 3000 });
  });

  test('full team code adds all 20 stickers', async ({ page }) => {
    await page.goto('/album');

    await page.click('.tab-add');
    await page.locator('.bi-input').fill('FWC');
    await expect(page.locator('.bi-preview')).toContainText('20 láminas');

    await page.click('.bi-btn');
    await expect(page.locator('.bi')).not.toBeVisible();

    await expect(page.locator('.acc-team-count').first()).toContainText('20/20', { timeout: 3000 });
  });

  test('team prefix with bare numbers (MEX 1 5 8)', async ({ page }) => {
    await page.goto('/album');

    await page.click('.tab-add');
    await page.locator('.bi-input').fill('MEX 1 5 8');
    await expect(page.locator('.bi-preview')).toContainText('3 láminas');
  });

  test('duplicate codes show repetidas count', async ({ page }) => {
    await page.goto('/album');

    await page.click('.tab-add');
    await page.locator('.bi-input').fill('FWC1, FWC1, FWC5');
    await expect(page.locator('.bi-preview')).toContainText('2 láminas');
    await expect(page.locator('.bi-preview')).toContainText('1 rep.');
  });
});

test.describe('Scanner Modal', () => {
  test('opens scanner and handles camera denial gracefully', async ({ page }) => {
    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE,
      stickers: [],
    });
    await injectSession(page);

    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException('Permission denied', 'NotAllowedError');
      };
    });

    await page.goto('/album');
    await page.click('.tab-scan');

    await expect(page.locator('.sc')).toBeVisible();
    await expect(page.locator('.sc-title')).toContainText('Lector de laminas');

    // Should show error about camera
    await expect(page.locator('.sc-error')).toBeVisible({ timeout: 5000 });

    // Close button works
    await page.click('.sc-close');
    await expect(page.locator('.sc')).not.toBeVisible();
  });
});
