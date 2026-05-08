import { test, expect } from '@playwright/test';
import { setupSupabaseRoutes, injectSession } from './fixtures/handlers';
import { TEST_PROFILE, TEST_PROFILE_NOT_ONBOARDED, SUPABASE_URL } from './fixtures/data';

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
    await expect(page.locator('.title')).toContainText('QueMeFalta');
  });

  test('OAuth callback with code exchanges session and redirects to album', async ({ page }) => {
    await setupSupabaseRoutes(page, { authenticated: true, profile: TEST_PROFILE });
    await injectSession(page);

    await page.goto('/auth/callback?code=fake-e2e-code');

    // Should eventually redirect to /album (onboarded user)
    await expect(page).toHaveURL(/\/album/, { timeout: 10000 });
  });

  test('OAuth callback redirects to onboarding when not onboarded', async ({ page }) => {
    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE_NOT_ONBOARDED,
    });
    await injectSession(page);

    await page.goto('/auth/callback?code=fake-e2e-code');

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10000 });
  });

  test('onboarding flow: set username and redirect to album', async ({ page }) => {
    // Start with non-onboarded profile
    await setupSupabaseRoutes(page, {
      authenticated: true,
      profile: TEST_PROFILE_NOT_ONBOARDED,
    });
    await injectSession(page);

    // Override PATCH to return onboarded profile
    await page.route(`${SUPABASE_URL}/rest/v1/profiles*`, async (route) => {
      if (route.request().method() === 'PATCH') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...TEST_PROFILE, username: 'newuser', onboarded: true }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TEST_PROFILE_NOT_ONBOARDED),
      });
    });

    await page.goto('/onboarding');

    // Should show greeting
    await expect(page.locator('.greet')).toContainText('E2E');

    // Type username and submit
    await page.fill('input', 'newuser');
    await expect(page.locator('.url-preview')).toContainText('newuser');

    await page.click('.btn-solid');

    // Should redirect to album
    await expect(page).toHaveURL(/\/album/, { timeout: 10000 });
  });

  test('persisted session survives page reload', async ({ page }) => {
    await setupSupabaseRoutes(page, { authenticated: true, profile: TEST_PROFILE });
    await injectSession(page);

    await page.goto('/album');
    await expect(page).toHaveURL(/\/album/);

    // Reload
    await page.reload();
    await expect(page).toHaveURL(/\/album/);
    await expect(page.locator('.hdr-sub')).toContainText('@e2euser');
  });

  test('OAuth callback shows error on invalid code', async ({ page }) => {
    await setupSupabaseRoutes(page, { authenticated: false });

    await page.goto('/auth/callback?error=access_denied&error_description=User+cancelled');

    await expect(page.locator('.status')).toContainText('User cancelled');
  });
});
