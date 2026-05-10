import { createClient } from '@supabase/supabase-js';
import { ref, readonly } from 'vue';
import { createMockClient } from './mockClient';

const useMock = import.meta.env.VITE_MOCK === 'true';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any;

if (useMock) {
  console.log('%c🧪 MOCK MODE — datos locales en mock-data.json', 'color:#f5c542;font-weight:bold');
  _client = createMockClient();
} else {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing Supabase env vars. Check your .env.local file in the project root.');
  }
  _client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase = _client;

// === SESSION STATE ===
// Cuando la sesion muere y no se puede renovar, bloqueamos writes y mostramos popup
const _sessionDead = ref(false);
export const sessionDead = readonly(_sessionDead);

// === KEEP-ALIVE & VISIBILITY REFRESH (skip in mock mode) ===
let lastRefreshAt = Date.now();
let lastActivityAt = Date.now();
const REFRESH_INTERVAL = 10 * 60 * 1000; // Refresh every 10 min (JWT expires in 60 min on free tier)
const STALE_THRESHOLD = 3 * 60 * 1000; // Consider stale after 3 min idle

async function refreshSession(): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      console.warn('[Supabase] No session found during refresh');
      _sessionDead.value = true;
      return false;
    }
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      console.warn('[Supabase] Refresh failed:', error.message);
      // One more attempt — get session again to check if it's truly dead
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        _sessionDead.value = true;
        return false;
      }
      // Session exists but refresh failed — may still be valid
      return true;
    }
    lastRefreshAt = Date.now();
    _sessionDead.value = false;
    console.log('[Supabase] Session refreshed');
    return true;
  } catch {
    console.warn('[Supabase] Refresh threw');
    _sessionDead.value = true;
    return false;
  }
}

if (!useMock) {
  // Proactive refresh every 10 min
  setInterval(() => refreshSession(), REFRESH_INTERVAL);

  // Refresh when tab becomes visible (user returns after idle)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const elapsed = Date.now() - lastRefreshAt;
      // Only refresh if it's been > 2 min since last refresh
      if (elapsed > 2 * 60 * 1000) {
        refreshSession();
      }
    }
  });
}

// === Pre-write: refrescar si lleva rato idle ===
export async function ensureFreshSession(): Promise<boolean> {
  if (useMock) return true;
  if (_sessionDead.value) return false;

  const now = Date.now();
  if (now - lastActivityAt > STALE_THRESHOLD || now - lastRefreshAt > REFRESH_INTERVAL) {
    const ok = await refreshSession();
    if (!ok) return false;
  }
  lastActivityAt = now;
  return true;
}

// === Retry helper: ejecuta un write, si falla por auth reintenta hasta 2 veces ===
const MAX_RETRIES = 2;

function isAuthError(error: { message: string; code?: string }): boolean {
  const msg = error.message?.toLowerCase() ?? '';
  return (
    error.code === '401' ||
    error.code === '403' ||
    msg.includes('jwt') ||
    msg.includes('token') ||
    msg.includes('auth') ||
    msg.includes('permission') ||
    msg.includes('row-level security')
  );
}

export async function withAuthRetry<T>(
  fn: () => PromiseLike<{ data: T; error: { message: string; code?: string } | null }>,
): Promise<{ data: T; error: { message: string; code?: string } | null }> {
  if (_sessionDead.value) {
    return { data: null as T, error: { message: 'Sesión expirada', code: 'session_dead' } };
  }

  const result = await fn();

  if (!result.error) {
    lastActivityAt = Date.now();
    return result;
  }

  if (!isAuthError(result.error)) {
    return result;
  }

  // Auth error — retry up to MAX_RETRIES times with refresh between each
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const { error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr) {
      _sessionDead.value = true;
      return result;
    }

    const retry = await fn();
    if (!retry.error) {
      lastActivityAt = Date.now();
      return retry;
    }

    // If retry error is not auth-related, return it (don't keep retrying)
    if (!isAuthError(retry.error)) {
      return retry;
    }

    // Last attempt failed — mark session dead
    if (attempt === MAX_RETRIES) {
      _sessionDead.value = true;
      return retry;
    }
  }

  return result;
}
