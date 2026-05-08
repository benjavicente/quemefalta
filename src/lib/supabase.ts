import { createClient } from '@supabase/supabase-js';
import { ref, readonly } from 'vue';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing Supabase env vars. Check your .env.local file in the project root.');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// === SESSION STATE ===
// Cuando la sesion muere y no se puede renovar, bloqueamos writes y mostramos popup
const _sessionDead = ref(false);
export const sessionDead = readonly(_sessionDead);

// === KEEP-ALIVE: renovar JWT cada 45 min (expira en 60 min en free tier) ===
setInterval(
  async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const { error } = await supabase.auth.refreshSession();
      if (!error) _sessionDead.value = false;
    }
  },
  45 * 60 * 1000,
);

// Refrescar al volver al tab
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const { error } = await supabase.auth.refreshSession();
      if (!error) _sessionDead.value = false;
    }
  }
});

// === Pre-write: refrescar si lleva rato idle ===
let lastActivityAt = Date.now();
const STALE_THRESHOLD = 5 * 60 * 1000;

export async function ensureFreshSession(): Promise<boolean> {
  if (_sessionDead.value) return false;

  const now = Date.now();
  if (now - lastActivityAt > STALE_THRESHOLD) {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      // Ultimo intento
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        _sessionDead.value = true;
        return false;
      }
    }
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
  fn: () => Promise<{ data: T; error: { message: string; code?: string } | null }>,
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
