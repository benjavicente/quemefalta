import { test, expect } from '@playwright/test';
import { setupSupabaseRoutes, injectSession } from './fixtures/handlers';
import { TEST_PROFILE } from './fixtures/data';

test.describe('Auth Flow', () => {
  test('redirects unauthenticated user from /album to /auth', async ({ page }) => {
    await setupSupabaseRoutes(page, { authenticated: false });
    await page.goto('/album');

    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.locator('.google-btn')).toBeVisible();
  });

  test('shows login page with Google button', async ({ page }) => {
    await setupSupabaseRoutes(page, { authenticated: false });
    await page.goto('/auth');

    await expect(page.locator('.google-btn')).toContainText('Continuar con Google');
  });

  test('persisted session survives page reload', async ({ page }) => {
    await setupSupabaseRoutes(page, { authenticated: true, profile: TEST_PROFILE });
    await injectSession(page);

    await page.goto('/album');
    await expect(page).toHaveURL(/\/album/);

    await page.reload();
    await expect(page).toHaveURL(/\/album/);
    // Verify album content loaded (not redirected to /auth)
    await expect(page.locator('.progress-pct')).toBeVisible();
  });

  test('OAuth callback shows error on invalid code', async ({ page }) => {
    await setupSupabaseRoutes(page, { authenticated: false });

    await page.goto('/auth/callback?error=access_denied&error_description=User+cancelled');

    await expect(page.locator('.status')).toContainText('User cancelled');
  });
});
