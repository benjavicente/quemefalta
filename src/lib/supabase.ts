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
// Solo marcamos sessionDead ante errores PERMANENTES (refresh_token revocado/inválido).
// Errores transitorios (red, timeouts) reintentan con backoff — nunca matan la sesión.
const _sessionDead = ref(false);
export const sessionDead = readonly(_sessionDead);

let lastRefreshAt = Date.now();

type AuthErr = { message: string; code?: string; name?: string; status?: number } | null;

// === Clasificación de errores ===

const PERMANENT_REFRESH_MESSAGES = [
  'refresh token not found',
  'invalid refresh token',
  'refresh_token_not_found',
  'invalid_grant',
  'refresh token already used',
  'session not found',
  'session_not_found',
  'user not found',
  'user_not_found',
];

// Permanent = el refresh_token está revocado/ausente, recargar no salva, requiere relogin.
function isPermanentAuthError(error: AuthErr): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  const code = (error.code ?? '').toLowerCase();
  if (code === 'refresh_token_not_found' || code === 'session_not_found') return true;
  if (error.status === 400 || error.status === 401) {
    // Status 400/401 SOLO es permanente si el mensaje lo confirma. Si no, podría ser un blip.
    return PERMANENT_REFRESH_MESSAGES.some((m) => msg.includes(m));
  }
  return PERMANENT_REFRESH_MESSAGES.some((m) => msg.includes(m));
}

// Auth error en una query (no en refresh) — requiere refresh+retry pero no necesariamente es fatal.
function isAuthError(error: AuthErr): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  const code = (error.code ?? '').toLowerCase();
  return (
    code === '401' ||
    code === '403' ||
    code.startsWith('pgrst3') ||
    msg.includes('jwt') ||
    msg.includes('token') ||
    msg.includes('auth') ||
    msg.includes('permission') ||
    msg.includes('row-level security')
  );
}

// === Refresh con backoff para errores de red ===

const REFRESH_TIMEOUT_MS = 5_000;

// supabase-js auto-elimina la sesion y emite SIGNED_OUT cuando un refresh falla con
// error no-retryable. Eso vacia user.value en useAuth y el app cae a preview mode
// antes de que podamos setear sessionDead → la dead-modal (que requiere !isPreview)
// nunca aparece. Marcamos refreshInProgress mientras corre el refresh para que useAuth
// pueda ignorar ese SIGNED_OUT sintetico y dejar que el flujo de dead-modal/rescue tome
// la decision de UX.
let _refreshInProgress = false;
export const refreshInProgress = () => _refreshInProgress;

async function refreshOnce(): Promise<{ ok: boolean; error: AuthErr }> {
  // Race el refresh contra un timeout. El cliente Supabase puede colgarse
  // indefinidamente por bugs internos del LockManager u otros, y no podemos
  // dejar que un refresh roto bloquee todos los writes.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ ok: false; error: AuthErr }>((resolve) => {
    timer = setTimeout(() => {
      console.warn('[Supabase] refreshSession timeout >', REFRESH_TIMEOUT_MS, 'ms');
      resolve({
        ok: false,
        error: { message: 'refresh timeout', name: 'TimeoutError' },
      });
    }, REFRESH_TIMEOUT_MS);
  });
  _refreshInProgress = true;
  try {
    return await Promise.race([
      (async () => {
        try {
          const { error } = await supabase.auth.refreshSession();
          return { ok: !error, error: error ?? null };
        } catch (e) {
          return {
            ok: false as const,
            error: { message: (e as Error)?.message ?? 'refresh threw', name: 'NetworkError' },
          };
        }
      })(),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    _refreshInProgress = false;
  }
}

async function refreshSession(): Promise<boolean> {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { ok, error } = await refreshOnce();
    if (ok) {
      lastRefreshAt = Date.now();
      _sessionDead.value = false;
      return true;
    }
    if (isPermanentAuthError(error)) {
      console.warn('[Supabase] Refresh failed (permanent):', error?.message);
      _sessionDead.value = true;
      return false;
    }
    // Transitorio: backoff 200ms, 600ms
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 200 * Math.pow(3, attempt - 1)));
    } else {
      console.warn('[Supabase] Refresh failed (transient, giving up this round):', error?.message);
    }
  }
  // Transitorio agotado: NO matamos la sesión. El próximo intento podrá rescatarla.
  return false;
}

// Intento de rescate para sesiones marcadas como muertas — se usa cuando el usuario
// hace una accion despues de un sessionDead transient (ej: click en boton "Reintentar").
export async function tryRescueSession(): Promise<boolean> {
  if (useMock) return true;
  if (!_sessionDead.value) return true;
  const { ok, error } = await refreshOnce();
  if (ok) {
    lastRefreshAt = Date.now();
    _sessionDead.value = false;
    return true;
  }
  if (isPermanentAuthError(error)) {
    // Confirmado permanente — no insistir.
    return false;
  }
  // Sigue siendo transitorio. Lo dejamos dead, el usuario puede volver a intentar.
  return false;
}

if (!useMock) {
  // El cliente Supabase con autoRefreshToken: true ya refresca proactivamente.
  // Solo agregamos un refresh oportunista al volver al tab tras estar idle,
  // que es el caso que autoRefreshToken no maneja bien (timers pausados en background).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const elapsed = Date.now() - lastRefreshAt;
      if (elapsed > 2 * 60 * 1000) {
        refreshSession();
      }
    }
  });
}

// === Pre-write check ===
// autoRefreshToken del cliente Supabase ya refresca proactivamente. Aca solo
// chequeamos sessionDead. NO disparamos refreshes adicionales — son la fuente
// principal de hangs cuando se acumulan llamadas paralelas contra el lock interno.
export async function ensureFreshSession(): Promise<boolean> {
  if (useMock) return true;

  if (_sessionDead.value) {
    // Intento de rescate antes de bloquear (con timeout interno).
    const rescued = await tryRescueSession();
    if (!rescued) return false;
  }

  return true;
}

// === Retry helper: ejecuta un write, si falla por auth refresca y reintenta ===
const MAX_RETRIES = 2;
const QUERY_TIMEOUT_MS = 8_000;

// Helper generico: aplica timeout a CUALQUIER promesa async. Devuelve `undefined`
// si timeout, o el valor real si resuelve a tiempo. Sirve para wrappear llamadas
// auth (getSession, getUser, exchangeCodeForSession) que pueden colgarse por el
// LockManager interno de auth-js.
export async function callWithTimeout<T>(
  fn: () => Promise<T>,
  ms: number,
  label: string,
): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[Supabase] ${label} timeout > ${ms}ms`);
      resolve(undefined);
    }, ms);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Race fn() vs timeout — si la query se cuelga (ej: lock del cliente Supabase),
// no quedamos esperando para siempre con la UI en optimistic sin feedback.
async function withTimeout<T>(
  fn: () => PromiseLike<{ data: T; error: AuthErr }>,
): Promise<{ data: T; error: AuthErr }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ data: T; error: AuthErr }>((resolve) => {
    timer = setTimeout(() => {
      console.warn('[Supabase] Query timeout >', QUERY_TIMEOUT_MS, 'ms');
      resolve({
        data: null as T,
        error: { message: 'Request timeout', code: 'timeout', name: 'TimeoutError' },
      });
    }, QUERY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function withAuthRetry<T>(
  fn: () => PromiseLike<{ data: T; error: AuthErr }>,
): Promise<{ data: T; error: AuthErr }> {
  if (_sessionDead.value) {
    // Intento de rescate antes de rendirnos.
    const rescued = await tryRescueSession();
    if (!rescued) {
      return { data: null as T, error: { message: 'Sesión expirada', code: 'session_dead' } };
    }
  }

  const result = await withTimeout(fn);

  if (!result.error) {
    return result;
  }

  if (!isAuthError(result.error)) {
    return result;
  }

  // Auth error en la query — refrescar y reintentar
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const refreshOk = await refreshSession();
    if (!refreshOk) {
      // refreshSession ya decide si es permanente (marca sessionDead) o transitorio (no).
      // Si es transitorio, devolvemos el error original sin matar la sesión.
      return result;
    }

    const retry = await withTimeout(fn);
    if (!retry.error) {
      return retry;
    }

    if (!isAuthError(retry.error)) {
      return retry;
    }

    if (attempt === MAX_RETRIES) {
      // Múltiples auth errors aún después de refresh exitoso → algo está mal con
      // los permisos/RLS, no con el token. No marcar sessionDead, devolver el error.
      return retry;
    }
  }

  return result;
}
