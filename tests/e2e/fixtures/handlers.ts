/* eslint-disable @typescript-eslint/no-explicit-any */
import { Page, Route } from '@playwright/test';
import { SUPABASE_URL, TEST_USER, TEST_SESSION, TEST_PROFILE } from './data';

interface HandlerOptions {
  delay?: number;
  profile?: Record<string, any>;
  stickers?: Record<string, any>[];
  authenticated?: boolean;
}

function json(route: Route, body: any, status = 200, delay = 50) {
  return new Promise<void>((resolve) => {
    setTimeout(async () => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        headers: {
          'content-range': '0-0/*',
          'access-control-allow-origin': '*',
        },
        body: JSON.stringify(body),
      });
      resolve();
    }, delay);
  });
}

/**
 * Sets up all Supabase route interceptors using a single catch-all route.
 * Uses URL path matching inside the handler to avoid glob issues with query strings.
 */
export async function setupSupabaseRoutes(page: Page, options: HandlerOptions = {}) {
  const { delay = 50, profile = TEST_PROFILE, stickers = [], authenticated = true } = options;

  const session = authenticated ? TEST_SESSION : null;
  const user = authenticated ? TEST_USER : null;

  const stickerStore = new Map<number, Record<string, any>>();
  for (const s of stickers) {
    stickerStore.set(s.sticker_number, { ...s });
  }

  // Single catch-all: intercept ALL requests to Supabase
  await page.route(
    (url) => url.href.startsWith(SUPABASE_URL),
    async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();

      // --- Auth ---
      if (path.includes('/auth/v1/token')) {
        return json(route, session ?? { error: 'No session' }, session ? 200 : 401, delay);
      }

      if (path.includes('/auth/v1/user')) {
        return json(route, user ?? { error: 'Not authenticated' }, user ? 200 : 401, delay);
      }

      if (path.includes('/auth/v1/authorize')) {
        return route.fulfill({
          status: 302,
          headers: { location: '/auth/callback?code=fake-e2e-code' },
        });
      }

      if (path.includes('/auth/v1/logout')) {
        return json(route, {}, 204, delay);
      }

      // --- REST: profiles ---
      if (path.includes('/rest/v1/profiles')) {
        if (method === 'GET') {
          return json(route, profile, 200, delay);
        }
        if (method === 'PATCH') {
          const body = route.request().postDataJSON?.() ?? {};
          return json(route, { ...profile, ...body }, 200, delay);
        }
      }

      // --- REST: stickers ---
      if (path.includes('/rest/v1/stickers')) {
        if (method === 'GET') {
          return json(route, Array.from(stickerStore.values()), 200, delay);
        }

        if (method === 'POST') {
          const body = route.request().postDataJSON?.();
          if (body) {
            const items = Array.isArray(body) ? body : [body];
            for (const item of items) {
              stickerStore.set(item.sticker_number, item);
            }
          }
          return json(route, null, 201, delay);
        }

        if (method === 'DELETE') {
          const params = url.searchParams.toString();
          const singleMatch = params.match(/sticker_number=eq\.(\d+)/);
          if (singleMatch) stickerStore.delete(Number(singleMatch[1]));

          const bulkMatch = params.match(/sticker_number=in\.\(([^)]+)\)/);
          if (bulkMatch) {
            for (const n of bulkMatch[1].split(',').map(Number)) stickerStore.delete(n);
          }
          return json(route, null, 200, delay);
        }
      }

      // --- REST: public_album_stats ---
      if (path.includes('/rest/v1/public_album_stats')) {
        return json(route, null, 200, delay);
      }

      // Fallback: let it through (shouldn't happen in tests)
      console.log(`[E2E] Unhandled Supabase request: ${method} ${route.request().url()}`);
      return route.continue();
    },
  );

  return { stickerStore };
}

/**
 * Injects a fake Supabase session into localStorage.
 */
export function injectSession(page: Page, session = TEST_SESSION) {
  return page.addInitScript((sess) => {
    const storageKey = 'sb-zxtnogvmpjgqfoegajgu-auth-token';
    localStorage.setItem(storageKey, JSON.stringify(sess));
  }, session);
}
