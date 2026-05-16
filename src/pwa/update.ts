import { useRegisterSW } from 'virtual:pwa-register/vue';

let waitingRegistration: ServiceWorkerRegistration | undefined;

const {
  needRefresh: updateAvailable,
  offlineReady,
  updateServiceWorker,
} = useRegisterSW({
  onRegisteredSW(_swUrl, registration) {
    waitingRegistration = registration;
  },
  onRegisterError(error) {
    console.warn('[PWA] Service worker registration failed', error);
  },
});

export { offlineReady, updateAvailable };

// The new service worker can install but remain `waiting` while this page is
// controlled by the old worker. SKIP_WAITING asks it to activate now, and
// controllerchange tells us the new worker controls the page before hard-loading
// the route the user tried to open:
// https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting
function waitForControllerChange(): Promise<void> {
  if (!('serviceWorker' in navigator)) return Promise.resolve();

  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, 1500);

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

export function applyUpdate(): void {
  updateAvailable.value = false;
  void updateServiceWorker(true);
}

export async function applyUpdateAndGoTo(targetPath: string): Promise<void> {
  updateAvailable.value = false;

  const waitingWorker = waitingRegistration?.waiting;
  if (waitingWorker) {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    await waitForControllerChange();
  }

  window.location.href = targetPath;
}
