import { ref } from 'vue';
import { registerSW } from 'virtual:pwa-register';

const OVERLAY_SELECTOR = '.modal-bg, .pop-bg, .cd-bg, .sc-bg, .onb-overlay, .bi-bg';

export const updateAvailable = ref(false);
export const offlineReady = ref(false);

let waitingReg: ServiceWorkerRegistration | null = null;

const skipSW =
  typeof window !== 'undefined' &&
  (window as unknown as { __QMF_SKIP_SW__?: boolean }).__QMF_SKIP_SW__ === true;

if (!skipSW) {
  registerSW({
    onNeedRefresh() {
      updateAvailable.value = true;
    },
    onOfflineReady() {
      offlineReady.value = true;
    },
    onRegisteredSW(_url, reg) {
      waitingReg = reg ?? null;
    },
    onRegisterError(err) {
      console.warn('[PWA] SW register error', err);
    },
  });
}

export function isBusy(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.querySelector(OVERLAY_SELECTOR)) return true;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    const v = (el as HTMLInputElement | HTMLTextAreaElement).value;
    if (v && v.trim().length > 0) return true;
  }
  if (el.isContentEditable && el.textContent && el.textContent.trim().length > 0) return true;
  return false;
}

/**
 * Aplica el SW esperando + navega a `targetPath`. Si no hay target, recarga
 * la URL actual. Si no hay SW esperando, hace navegación/reload simple.
 *
 * Usa SKIP_WAITING + controllerchange manualmente porque updateSW(true) de
 * vite-plugin-pwa hardcodea `location.reload()` y necesitamos llegar al
 * destino del router, no recargar la actual.
 */
export async function applyUpdateAndGoTo(targetPath?: string): Promise<void> {
  updateAvailable.value = false;
  const waiting = waitingReg?.waiting;

  if (!waiting) {
    if (targetPath) window.location.href = targetPath;
    else window.location.reload();
    return;
  }

  const controllerReady = new Promise<void>((resolve) => {
    if (!('serviceWorker' in navigator)) {
      resolve();
      return;
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
  });

  waiting.postMessage({ type: 'SKIP_WAITING' });
  await controllerReady;

  if (targetPath) window.location.href = targetPath;
  else window.location.reload();
}

/** Botón "Actualizar" del toast: reload simple en la pantalla actual. */
export function applyUpdate(): void {
  void applyUpdateAndGoTo();
}

export function dismissUpdate(): void {
  updateAvailable.value = false;
}
