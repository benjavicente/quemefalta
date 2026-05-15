import { test, expect } from '@playwright/test';
import { setupSupabaseRoutes } from './fixtures/handlers';

test.describe('Preview Mode (unauthenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await setupSupabaseRoutes(page, { authenticated: false });
  });

  test('auth page shows "Explorar el album sin cuenta" button linking to /album', async ({
    page,
  }) => {
    await page.goto('/auth');

    const previewBtn = page.locator('.preview-btn');
    await expect(previewBtn).toBeVisible();
    await expect(previewBtn).toContainText('Explorar el álbum sin cuenta');
    await expect(previewBtn).toHaveAttribute('href', '/album');
  });

  test('preview banner visible on /album when not logged in', async ({ page }) => {
    await page.goto('/album');

    const banner = page.locator('.preview-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Modo preview');
    await expect(banner).toContainText('Crea tu cuenta');
  });

  test('can open groups and teams and see sticker grid', async ({ page }) => {
    await page.goto('/album');

    // Open first group
    await page.locator('.acc-group-head').first().click();
    await expect(page.locator('.acc-teams')).toBeVisible();

    // Open first team
    await page.locator('.acc-teams .acc-team').first().click();

    // Sticker grid should be visible with 20 stickers
    await expect(page.locator('.sect-name')).toBeVisible();
    await expect(page.locator('.stk')).toHaveCount(20);
  });

  test('tapping a sticker shows login prompt', async ({ page }) => {
    await page.goto('/album');

    // Open a team to see stickers
    await page.locator('.acc-group-head').first().click();
    await page.locator('.acc-teams .acc-team').first().click();
    await expect(page.locator('.stk').first()).toBeVisible();

    // Tap a sticker
    await page.locator('.stk').first().click();

    // Login prompt modal should appear
    const prompt = page.locator('.login-prompt');
    await expect(prompt).toBeVisible({ timeout: 3000 });
    await expect(prompt.locator('.login-prompt-title')).toContainText('Crea tu cuenta');
  });

  test('login prompt has "Crear cuenta con Google" and "Seguir mirando" buttons', async ({
    page,
  }) => {
    await page.goto('/album');

    await page.locator('.acc-group-head').first().click();
    await page.locator('.acc-teams .acc-team').first().click();
    await page.locator('.stk').first().click();

    const prompt = page.locator('.login-prompt');
    await expect(prompt).toBeVisible({ timeout: 3000 });

    await expect(prompt.locator('.login-prompt-btn')).toContainText('Crear cuenta con Google');
    await expect(prompt.locator('.login-prompt-dismiss')).toContainText('Seguir mirando');

    // Dismiss works
    await prompt.locator('.login-prompt-dismiss').click();
    await expect(prompt).not.toBeVisible();
  });

  test('all tabs are accessible: Album, Faltan, Repetidas, Calculadora', async ({ page }) => {
    await page.goto('/album');

    // Album tab (default)
    await expect(page.locator('.tab.on')).toContainText('Álbum');

    // Faltan tab
    await page.locator('.tab', { hasText: 'Faltan' }).click();
    await expect(page).toHaveURL(/\#missing/);

    // Repetidas tab
    await page.locator('.tab', { hasText: 'Repetidas' }).click();
    await expect(page).toHaveURL(/\#dupes/);

    // Calculadora tab
    await page.locator('.tab', { hasText: 'Calculadora' }).click();
    await expect(page).toHaveURL(/\#calc/);
    await expect(page.locator('.calc-view')).toBeVisible();
  });

  test('Calculadora: owned/dupes inputs visible and editable', async ({ page }) => {
    await page.goto('/album');

    await page.locator('.tab', { hasText: 'Calculadora' }).click();
    await expect(page.locator('.calc-view')).toBeVisible();

    // Owned and dupes inputs
    const inputs = page.locator('.calc-estado-num');
    await expect(inputs).toHaveCount(2);

    // Both start at 0
    await expect(inputs.nth(0)).toHaveValue('0');
    await expect(inputs.nth(1)).toHaveValue('0');

    // Editable: set owned to 200
    await inputs.nth(0).fill('200');
    await expect(page.locator('.calc-status-num')).toContainText('200');
  });

  test('header shows "Crear cuenta" button, no profile/share buttons', async ({ page }) => {
    await page.goto('/album');

    // "Crear cuenta" button in header
    const signupBtn = page.locator('.hdr-signup-btn');
    await expect(signupBtn).toBeVisible();
    await expect(signupBtn).toContainText('Crear cuenta');

    // No share, help, or profile buttons
    await expect(page.locator('.hdr-icon-btn')).toHaveCount(0);
    await expect(page.locator('.hdr-profile-btn')).toHaveCount(0);
  });

  test('batch input modal opens but submitting shows login prompt', async ({ page }) => {
    await page.goto('/album');

    // Open batch input
    await page.click('.tab-add');
    await expect(page.locator('.bi')).toBeVisible();

    // Enter some codes and submit
    await page.locator('.bi-input').fill('FWC1, FWC5');
    await expect(page.locator('.bi-preview-card')).toContainText('+2');
    await page.click('.bi-btn');

    // Batch modal closes and login prompt appears
    await expect(page.locator('.bi')).not.toBeVisible();
    const prompt = page.locator('.login-prompt');
    await expect(prompt).toBeVisible({ timeout: 3000 });
    await expect(prompt.locator('.login-prompt-title')).toContainText('Crea tu cuenta');
  });

  test('scan, "+ Agregar" and "− Quitar" buttons are visible in tabs', async ({ page }) => {
    await page.goto('/album');

    await expect(page.locator('.tab-scan')).toBeVisible();
    // "+ Agregar" → .tab-add sin la modifier .tab-remove
    const addBtn = page.locator('.tab-add:not(.tab-remove)');
    await expect(addBtn).toBeVisible();
    await expect(addBtn).toContainText('Agregar');
    // "− Quitar" → .tab-remove
    const removeBtn = page.locator('.tab-remove');
    await expect(removeBtn).toBeVisible();
    await expect(removeBtn).toContainText('Quitar');
  });
});
