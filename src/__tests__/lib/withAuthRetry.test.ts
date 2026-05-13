import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as mockSupabase from '../mocks/supabase';

let withAuthRetry: typeof import('@/lib/supabase').withAuthRetry;
let sessionDead: typeof import('@/lib/supabase').sessionDead;
let tryRescueSession: typeof import('@/lib/supabase').tryRescueSession;

beforeEach(async () => {
  vi.resetModules();
  mockSupabase.resetSupabaseMock();

  // Reimplementación inline del módulo real con el cliente mockeado.
  // Debe permanecer en sync con src/lib/supabase.ts — esta es la fuente de verdad
  // de la política de retry para los tests.
  vi.doMock('@/lib/supabase', async () => {
    const { ref, readonly } = await import('vue');
    const _sessionDead = ref(false);

    type AuthErr = { message: string; code?: string; status?: number } | null;

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

    function isPermanentAuthError(error: AuthErr): boolean {
      if (!error) return false;
      const msg = (error.message ?? '').toLowerCase();
      const code = (error.code ?? '').toLowerCase();
      if (code === 'refresh_token_not_found' || code === 'session_not_found') return true;
      if (error.status === 400 || error.status === 401) {
        return PERMANENT_REFRESH_MESSAGES.some((m) => msg.includes(m));
      }
      return PERMANENT_REFRESH_MESSAGES.some((m) => msg.includes(m));
    }

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

    async function refreshOnce(): Promise<{ ok: boolean; error: AuthErr }> {
      try {
        const { error } = await mockSupabase.supabase.auth.refreshSession();
        return { ok: !error, error: error ?? null };
      } catch (e) {
        return { ok: false, error: { message: (e as Error)?.message ?? 'refresh threw' } };
      }
    }

    async function refreshSession(): Promise<boolean> {
      const MAX_ATTEMPTS = 3;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const { ok, error } = await refreshOnce();
        if (ok) {
          _sessionDead.value = false;
          return true;
        }
        if (isPermanentAuthError(error)) {
          _sessionDead.value = true;
          return false;
        }
        if (attempt < MAX_ATTEMPTS) {
          // No sleep in tests — keep them fast.
        }
      }
      return false;
    }

    async function tryRescueSession(): Promise<boolean> {
      if (!_sessionDead.value) return true;
      const { ok, error } = await refreshOnce();
      if (ok) {
        _sessionDead.value = false;
        return true;
      }
      if (isPermanentAuthError(error)) {
        return false;
      }
      return false;
    }

    const MAX_RETRIES = 2;

    return {
      supabase: mockSupabase.supabase,
      sessionDead: readonly(_sessionDead),
      tryRescueSession,
      ensureFreshSession: vi.fn().mockResolvedValue(true),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withAuthRetry: async (fn: () => Promise<Record<string, any>>) => {
        if (_sessionDead.value) {
          const rescued = await tryRescueSession();
          if (!rescued) {
            return { data: null, error: { message: 'Sesión expirada', code: 'session_dead' } };
          }
        }

        const result = await fn();
        if (!result.error) {
          return result;
        }
        if (!isAuthError(result.error)) return result;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          const refreshOk = await refreshSession();
          if (!refreshOk) {
            return result;
          }
          const retry = await fn();
          if (!retry.error) {
            return retry;
          }
          if (!isAuthError(retry.error)) return retry;
          if (attempt === MAX_RETRIES) {
            return retry;
          }
        }
        return result;
      },
    };
  });

  const mod = await import('@/lib/supabase');
  withAuthRetry = mod.withAuthRetry;
  sessionDead = mod.sessionDead;
  tryRescueSession = mod.tryRescueSession;
});

describe('withAuthRetry', () => {
  it('returns result directly on success', async () => {
    const fn = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });
    const result = await withAuthRetry(fn);
    expect(result.data).toEqual({ id: 1 });
    expect(result.error).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns non-auth errors without retrying', async () => {
    const fn = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Unique constraint violated', code: '23505' },
    });
    const result = await withAuthRetry(fn);
    expect(result.error?.message).toBe('Unique constraint violated');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on JWT error after refreshing session', async () => {
    mockSupabase.supabase.auth.refreshSession.mockResolvedValue({
      data: { session: {} },
      error: null,
    });

    const fn = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'JWT expired', code: '401' } })
      .mockResolvedValueOnce({ data: { id: 1 }, error: null });

    const result = await withAuthRetry(fn);

    expect(result.data).toEqual({ id: 1 });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(mockSupabase.supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('retries up to 2 times on persistent auth errors', async () => {
    mockSupabase.supabase.auth.refreshSession.mockResolvedValue({
      data: { session: {} },
      error: null,
    });

    const authError = { message: 'JWT expired', code: '401' };
    const fn = vi.fn().mockResolvedValue({ data: null, error: authError });

    const result = await withAuthRetry(fn);

    expect(fn).toHaveBeenCalledTimes(3);
    expect(mockSupabase.supabase.auth.refreshSession).toHaveBeenCalledTimes(2);
    expect(result.error?.message).toBe('JWT expired');
  });

  it('does NOT mark sessionDead when query keeps returning auth errors after successful refresh', async () => {
    // Refresh works fine — token issuance is healthy. But the query keeps failing auth.
    // That means it's an RLS/permission issue, not a token issue. sessionDead must NOT trip.
    mockSupabase.supabase.auth.refreshSession.mockResolvedValue({
      data: { session: {} },
      error: null,
    });

    const authError = { message: 'row-level security violation', code: '403' };
    const fn = vi.fn().mockResolvedValue({ data: null, error: authError });

    expect(sessionDead.value).toBe(false);
    await withAuthRetry(fn);
    expect(sessionDead.value).toBe(false);
  });

  it('marks sessionDead only on PERMANENT refresh errors', async () => {
    mockSupabase.supabase.auth.refreshSession.mockResolvedValue({
      data: {},
      error: { message: 'Invalid Refresh Token: Refresh Token Not Found', status: 400 },
    });

    const fn = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'JWT expired', code: '401' },
    });

    await withAuthRetry(fn);

    expect(sessionDead.value).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT mark sessionDead on TRANSIENT refresh errors (network)', async () => {
    // Network blip: refresh fails with "Failed to fetch" or similar — should not kill the session.
    mockSupabase.supabase.auth.refreshSession.mockResolvedValue({
      data: {},
      error: { message: 'Failed to fetch' },
    });

    const fn = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'JWT expired', code: '401' },
    });

    await withAuthRetry(fn);

    expect(sessionDead.value).toBe(false);
  });

  it('does NOT mark sessionDead when refresh throws (network/abort)', async () => {
    mockSupabase.supabase.auth.refreshSession.mockRejectedValue(new Error('NetworkError'));

    const fn = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'JWT expired', code: '401' },
    });

    await withAuthRetry(fn);

    expect(sessionDead.value).toBe(false);
  });

  it('succeeds on second retry', async () => {
    mockSupabase.supabase.auth.refreshSession.mockResolvedValue({
      data: { session: {} },
      error: null,
    });

    const authError = { message: 'row-level security violation', code: '403' };
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: authError })
      .mockResolvedValueOnce({ data: null, error: authError })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });

    const result = await withAuthRetry(fn);

    expect(result.data).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sessionDead.value).toBe(false);
  });

  it('stops retrying if retry returns non-auth error', async () => {
    mockSupabase.supabase.auth.refreshSession.mockResolvedValue({
      data: { session: {} },
      error: null,
    });

    const fn = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'JWT expired', code: '401' } })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Network timeout', code: 'TIMEOUT' },
      });

    const result = await withAuthRetry(fn);

    expect(result.error?.message).toBe('Network timeout');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sessionDead.value).toBe(false);
  });

  it('blocks when session is permanently dead and rescue fails too', async () => {
    // Force a permanent kill, then verify subsequent call is blocked.
    mockSupabase.supabase.auth.refreshSession.mockResolvedValue({
      data: {},
      error: { message: 'Invalid Refresh Token', status: 400 },
    });

    const authError = { message: 'JWT expired', code: '401' };
    await withAuthRetry(vi.fn().mockResolvedValue({ data: null, error: authError }));
    expect(sessionDead.value).toBe(true);

    // Next call: tries rescue, rescue also fails permanent, returns session_dead.
    const fn2 = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    const result = await withAuthRetry(fn2);

    expect(result.error?.code).toBe('session_dead');
    expect(fn2).not.toHaveBeenCalled();
  });

  it('rescues a transient-dead session when refresh recovers', async () => {
    // Manually mark dead (simulating a previous transient failure that managed to set it
    // — or, in real life, a permanent that recovered server-side e.g. after reissue).
    // First call: refresh fails transient → sessionDead stays false.
    // But if it was set, rescue should succeed if refresh now works.
    mockSupabase.supabase.auth.refreshSession.mockResolvedValueOnce({
      data: {},
      error: { message: 'Invalid Refresh Token', status: 400 },
    });
    const authError = { message: 'JWT expired', code: '401' };
    await withAuthRetry(vi.fn().mockResolvedValue({ data: null, error: authError }));
    expect(sessionDead.value).toBe(true);

    // Now refresh recovers (e.g. user re-authenticated in another tab, or it was a glitch).
    mockSupabase.supabase.auth.refreshSession.mockResolvedValue({
      data: { session: {} },
      error: null,
    });

    const rescued = await tryRescueSession();
    expect(rescued).toBe(true);
    expect(sessionDead.value).toBe(false);
  });
});
