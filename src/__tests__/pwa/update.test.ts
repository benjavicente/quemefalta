import { beforeEach, describe, expect, it, vi } from 'vitest';

const pwaMock = vi.hoisted(() => ({
  updateServiceWorker: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('virtual:pwa-register/vue', async () => {
  const { ref } = await import('vue');

  return {
    useRegisterSW: vi.fn(() => ({
      needRefresh: ref(false),
      offlineReady: ref(false),
      updateServiceWorker: pwaMock.updateServiceWorker,
    })),
  };
});

describe('pwa update state', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('exposes the Vue PWA needRefresh ref as updateAvailable', async () => {
    const mod = await import('@/pwa/update');

    mod.updateAvailable.value = true;
    expect(mod.updateAvailable.value).toBe(true);
  });

  it('delegates current-page updates to the vite-pwa updater', async () => {
    const mod = await import('@/pwa/update');
    mod.applyUpdate();

    expect(pwaMock.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('hard navigates to the target path when applying an update for a route', async () => {
    const mod = await import('@/pwa/update');
    const originalLocation = window.location;
    const hrefValues: string[] = [];

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        set href(value: string) {
          hrefValues.push(value);
        },
      },
    });

    await mod.applyUpdateAndGoTo('/cambios');

    expect(hrefValues).toEqual(['/cambios']);

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});
