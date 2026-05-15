/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from 'vitest';

// Configurable result for query builder chains.
// _queryResult: default result devuelto si no hay override por tabla.
// _queryResultByTable: mapa de table → resultado (toma precedencia sobre _queryResult).
let _queryResult: { data: any; error: any } = { data: null, error: null };
const _queryResultByTable = new Map<string, { data: any; error: any }>();

export function setQueryResult(result: { data: any; error: any }) {
  _queryResult = result;
}

// Set per-table query result. Useful cuando una vista hace varias queries a tablas
// distintas y necesitamos shape diferente para cada una (p.ej. profile vs stickers).
export function setQueryResultForTable(table: string, result: { data: any; error: any }) {
  _queryResultByTable.set(table, result);
}

// Chainable query builder that mimics Supabase's PostgREST builder.
// ALL methods return `builder` (chainable). Resolution happens via `.then()`
// when the builder is `await`ed — this matches Supabase's real behavior where
// any chain like `.select().eq().single().abortSignal()` works in any order.
function createQueryBuilder(table?: string) {
  const resolveResult = () => {
    const result = (table && _queryResultByTable.get(table)) ?? _queryResult;
    return Promise.resolve({ ...result });
  };

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
  from: vi.fn((table?: string) => createQueryBuilder(table)),
  rpc: vi.fn(async (_fn?: string, _params?: unknown) => ({ data: null, error: null })),
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

// refreshInProgress: by default returns false (no refresh in flight)
export const refreshInProgress = vi.fn().mockReturnValue(false);

// callWithTimeout: pass-through that calls fn() and returns its result

export const callWithTimeout = vi.fn().mockImplementation(async (fn: () => Promise<any>) => fn());

// sessionDead: reactive ref for tests
import { ref, readonly } from 'vue';
const _sessionDead = ref(false);
export const sessionDead = readonly(_sessionDead);
export function setSessionDead(value: boolean) {
  _sessionDead.value = value;
}

export function resetSupabaseMock() {
  _queryResult = { data: null, error: null };
  _queryResultByTable.clear();

  // Reset from() to return fresh builders
  supabase.from.mockClear();
  supabase.from.mockImplementation((table?: string) => createQueryBuilder(table));

  // Reset rpc to no-op default
  supabase.rpc.mockClear();
  supabase.rpc.mockImplementation(async () => ({ data: null, error: null }));

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

  refreshInProgress.mockClear();
  refreshInProgress.mockReturnValue(false);

  callWithTimeout.mockClear();
  callWithTimeout.mockImplementation(async (fn: () => Promise<any>) => fn());

  _sessionDead.value = false;
}
