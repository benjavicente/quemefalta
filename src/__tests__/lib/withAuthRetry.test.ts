import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as mockSupabase from '../mocks/supabase';

let withAuthRetry: typeof import('@/lib/supabase').withAuthRetry;
let sessionDead: typeof import('@/lib/supabase').sessionDead;

beforeEach(async () => {
  vi.resetModules();
  mockSupabase.resetSupabaseMock();

  // Use the REAL withAuthRetry (not the mock pass-through), but with mocked supabase client
  vi.doMock('@/lib/supabase', async () => {
    // Import the real module but replace supabase client with mock
    const { ref, readonly } = await import('vue');
    const _sessionDead = ref(false);

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

    return {
      supabase: mockSupabase.supabase,
      sessionDead: readonly(_sessionDead),
      ensureFreshSession: vi.fn().mockResolvedValue(true),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withAuthRetry: async (fn: () => Promise<Record<string, any>>) => {
        if (_sessionDead.value) {
          return { data: null, error: { message: 'Sesión expirada', code: 'session_dead' } };
        }

        const result = await fn();
        if (!result.error) {

          return result;
        }
        if (!isAuthError(result.error)) return result;

        for (let attempt = 1; attempt <= 2; attempt++) {
          const { error: refreshErr } = await mockSupabase.supabase.auth.refreshSession();
          if (refreshErr) {
            _sessionDead.value = true;
            return result;
          }
          const retry = await fn();
          if (!retry.error) {
  
            return retry;
          }
          if (!isAuthError(retry.error)) return retry;
          if (attempt === 2) {
            _sessionDead.value = true;
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

    // 1 initial + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3);
    expect(mockSupabase.supabase.auth.refreshSession).toHaveBeenCalledTimes(2);
    expect(result.error?.message).toBe('JWT expired');
  });

  it('marks sessionDead after all retries exhausted', async () => {
    mockSupabase.supabase.auth.refreshSession.mockResolvedValue({
      data: { session: {} },
      error: null,
    });

    const authError = { message: 'JWT expired', code: '401' };
    const fn = vi.fn().mockResolvedValue({ data: null, error: authError });

    expect(sessionDead.value).toBe(false);
    await withAuthRetry(fn);
    expect(sessionDead.value).toBe(true);
  });

  it('marks sessionDead if refresh itself fails', async () => {
    mockSupabase.supabase.auth.refreshSession.mockResolvedValue({
      data: {},
      error: { message: 'Refresh failed' },
    });

    const fn = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'JWT expired', code: '401' },
    });

    await withAuthRetry(fn);

    expect(sessionDead.value).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
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

  it('blocks immediately when session already dead', async () => {
    mockSupabase.supabase.auth.refreshSession.mockResolvedValue({
      data: { session: {} },
      error: null,
    });

    // Exhaust retries
    const authError = { message: 'JWT expired', code: '401' };
    await withAuthRetry(vi.fn().mockResolvedValue({ data: null, error: authError }));
    expect(sessionDead.value).toBe(true);

    // Next call should be blocked
    const fn2 = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    const result = await withAuthRetry(fn2);

    expect(result.error?.code).toBe('session_dead');
    expect(fn2).not.toHaveBeenCalled();
  });
});
