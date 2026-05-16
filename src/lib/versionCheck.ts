import { ref } from 'vue';

const STALE_MS = 60_000;
const OVERLAY_SELECTOR = '.modal-bg, .pop-bg, .cd-bg, .sc-bg, .onb-overlay, .bi-bg';

export const updateAvailable = ref(false);
export const debugMode = ref(false);
export const debugLastResult = ref<string>('—');

let hiddenAt = 0;
let checking = false;
let started = false;

function isBusy(): boolean {
  if (document.querySelector(OVERLAY_SELECTOR)) return true;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    const value = (el as HTMLInputElement | HTMLTextAreaElement).value;
    if (value && value.trim().length > 0) return true;
  }
  if (el.isContentEditable && el.textContent && el.textContent.trim().length > 0) return true;
  return false;
}

export function applyUpdate(): void {
  updateAvailable.value = false;
  location.reload();
}

export function dismissUpdate(): void {
  updateAvailable.value = false;
}

async function checkForUpdate(): Promise<void> {
  if (checking || updateAvailable.value) {
    debugLastResult.value = checking ? 'ya hay un check en curso' : 'toast ya activo';
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    debugLastResult.value = 'offline';
    return;
  }
  checking = true;
  debugLastResult.value = 'fetcheando…';
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    console.log('[versionCheck] fetch /version.json status=', res.status);
    if (!res.ok) {
      debugLastResult.value = `fetch falló: HTTP ${res.status}`;
      return;
    }
    const data = (await res.json()) as { build?: string };
    console.log('[versionCheck] current=', __BUILD_ID__, 'server=', data.build);
    debugLastResult.value = `current=${__BUILD_ID__} server=${data.build}`;
    if (!data.build) {
      debugLastResult.value += ' — server sin build';
      return;
    }
    if (data.build === __BUILD_ID__) {
      console.log('[versionCheck] up to date');
      debugLastResult.value += ' — IGUALES, no recargo';
      return;
    }
    if (isBusy()) {
      console.log('[versionCheck] update available — busy, showing toast');
      debugLastResult.value += ' — DISTINTOS, mostrando toast (busy)';
      updateAvailable.value = true;
    } else {
      console.log('[versionCheck] update available — reloading');
      debugLastResult.value += ' — DISTINTOS, recargando…';
      applyUpdate();
    }
  } catch (err) {
    console.warn('[versionCheck] fetch failed', err);
    debugLastResult.value = `error: ${String(err)}`;
  } finally {
    checking = false;
  }
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
  } else if (document.visibilityState === 'visible') {
    if (hiddenAt && Date.now() - hiddenAt > STALE_MS) {
      void checkForUpdate();
    }
    hiddenAt = 0;
  }
}

export function triggerCheckNow(): void {
  hiddenAt = 0;
  void checkForUpdate();
}

export function setupVersionCheck(): void {
  if (started) return;
  if (import.meta.env.DEV) return;
  if (typeof document === 'undefined') return;
  started = true;
  document.addEventListener('visibilitychange', onVisibilityChange);
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === '1') {
    debugMode.value = true;
    setInterval(() => {
      triggerCheckNow();
    }, 5000);
  }
  console.log('[versionCheck] active, BUILD_ID=', __BUILD_ID__, 'debug=', debugMode.value);
  (window as unknown as { __qmfCheckVersion?: () => void }).__qmfCheckVersion = triggerCheckNow;
}
