/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from 'vitest';

// Configurable result for query builder chains
let _queryResult: { data: any; error: any } = { data: null, error: null };

export function setQueryResult(result: { data: any; error: any }) {
  _queryResult = result;
}

// Chainable query builder that mimics Supabase's PostgREST builder.
// ALL methods return `builder` (chainable). Resolution happens via `.then()`
// when the builder is `await`ed — this matches Supabase's real behavior where
// any chain like `.select().eq().single().abortSignal()` works in any order.
function createQueryBuilder() {
  const resolveResult = () => Promise.resolve({ ..._queryResult });

  const builder: Record<string, any> = {};

  // All methods are chainable
  for (const method of [
    'select',
    'eq',
    'in',
    'neq',
    'abortSignal',
    'single',
    'maybeSingle',
    'upsert',
    'delete',
    'update',
    'insert',
  ]) {
    builder[method] = vi.fn().mockImplementation(() => builder);
  }

  // Make builder thenable — this is how the result resolves when `await`ed
  builder.then = function (resolve: (v: any) => void, reject?: (e: any) => void) {
    return resolveResult().then(resolve, reject);
  };

  return builder;
}

export const supabase = {
  from: vi.fn(() => createQueryBuilder()),
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
    refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  },
};

export const ensureFreshSession = vi.fn().mockResolvedValue(true);

// withAuthRetry: by default, just execute the fn directly (transparent pass-through)
export const withAuthRetry = vi.fn().mockImplementation(async (fn: () => Promise<any>) => fn());

// tryRescueSession: by default resolves true (rescue succeeded)
export const tryRescueSession = vi.fn().mockResolvedValue(true);

// sessionDead: reactive ref for tests
import { ref, readonly } from 'vue';
const _sessionDead = ref(false);
export const sessionDead = readonly(_sessionDead);
export function setSessionDead(value: boolean) {
  _sessionDead.value = value;
}

export function resetSupabaseMock() {
  _queryResult = { data: null, error: null };

  // Reset from() to return fresh builders
  supabase.from.mockClear();
  supabase.from.mockImplementation(() => createQueryBuilder());

  // Reset auth methods and restore default return values
  supabase.auth.getSession.mockClear().mockResolvedValue({ data: { session: null }, error: null });
  supabase.auth.getUser.mockClear().mockResolvedValue({ data: { user: null }, error: null });
  supabase.auth.signInWithOAuth.mockClear().mockResolvedValue({ error: null });
  supabase.auth.signOut.mockClear().mockResolvedValue({ error: null });
  supabase.auth.onAuthStateChange
    .mockClear()
    .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  supabase.auth.refreshSession
    .mockClear()
    .mockResolvedValue({ data: { session: null }, error: null });
  supabase.auth.exchangeCodeForSession
    .mockClear()
    .mockResolvedValue({ data: { session: null }, error: null });

  ensureFreshSession.mockClear();
  ensureFreshSession.mockResolvedValue(true);

  withAuthRetry.mockClear();
  withAuthRetry.mockImplementation(async (fn: () => Promise<any>) => fn());

  tryRescueSession.mockClear();
  tryRescueSession.mockResolvedValue(true);

  _sessionDead.value = false;
}
