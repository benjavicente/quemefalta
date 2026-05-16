/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock del módulo virtual antes de importar pwaUpdate.
vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
});

describe('pwaUpdate', () => {
  it('expone refs updateAvailable y offlineReady en false al inicio', async () => {
    const mod = await import('@/lib/pwaUpdate');
    expect(mod.updateAvailable.value).toBe(false);
    expect(mod.offlineReady.value).toBe(false);
  });

  it('onNeedRefresh setea updateAvailable=true', async () => {
    const { registerSW } = (await import('virtual:pwa-register')) as any;
    const mod = await import('@/lib/pwaUpdate');
    const callbacks = registerSW.mock.calls[0]?.[0];
    expect(callbacks).toBeDefined();
    callbacks.onNeedRefresh();
    expect(mod.updateAvailable.value).toBe(true);
  });

  it('onOfflineReady setea offlineReady=true', async () => {
    const { registerSW } = (await import('virtual:pwa-register')) as any;
    const mod = await import('@/lib/pwaUpdate');
    const callbacks = registerSW.mock.calls[0]?.[0];
    callbacks.onOfflineReady();
    expect(mod.offlineReady.value).toBe(true);
  });

  it('dismissUpdate baja updateAvailable a false', async () => {
    const { registerSW } = (await import('virtual:pwa-register')) as any;
    const mod = await import('@/lib/pwaUpdate');
    const callbacks = registerSW.mock.calls[0]?.[0];
    callbacks.onNeedRefresh();
    expect(mod.updateAvailable.value).toBe(true);
    mod.dismissUpdate();
    expect(mod.updateAvailable.value).toBe(false);
  });

  describe('isBusy', () => {
    it('false cuando no hay overlays ni inputs activos', async () => {
      const mod = await import('@/lib/pwaUpdate');
      expect(mod.isBusy()).toBe(false);
    });

    it('true cuando hay un .modal-bg en el DOM', async () => {
      const mod = await import('@/lib/pwaUpdate');
      const el = document.createElement('div');
      el.className = 'modal-bg';
      document.body.appendChild(el);
      expect(mod.isBusy()).toBe(true);
      el.remove();
    });

    it('true cuando un input enfocado tiene texto', async () => {
      const mod = await import('@/lib/pwaUpdate');
      const input = document.createElement('input');
      input.value = 'algo';
      document.body.appendChild(input);
      input.focus();
      expect(mod.isBusy()).toBe(true);
      input.remove();
    });

    it('false cuando un input enfocado está vacío', async () => {
      const mod = await import('@/lib/pwaUpdate');
      const input = document.createElement('input');
      input.value = '';
      document.body.appendChild(input);
      input.focus();
      expect(mod.isBusy()).toBe(false);
      input.remove();
    });
  });

  describe('applyUpdateAndGoTo (sin SW esperando)', () => {
    it('si no hay SW esperando, hace location.href = targetPath', async () => {
      const mod = await import('@/lib/pwaUpdate');
      const hrefSpy = vi.fn();
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          set href(v: string) {
            hrefSpy(v);
          },
          reload: vi.fn(),
        },
      });
      await mod.applyUpdateAndGoTo('/cambios');
      expect(hrefSpy).toHaveBeenCalledWith('/cambios');
    });

    it('si no hay target, llama a location.reload', async () => {
      const mod = await import('@/lib/pwaUpdate');
      const reloadSpy = vi.fn();
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { reload: reloadSpy, href: '' },
      });
      await mod.applyUpdateAndGoTo();
      expect(reloadSpy).toHaveBeenCalled();
    });
  });
});
