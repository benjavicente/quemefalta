/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Mock Supabase client for local development.
 * Stores all data in-memory and syncs to mock-data.json via Vite dev server.
 * Activate with: npm run dev:mock
 */

// ── Mock user ──
const MOCK_USER = {
  id: 'mock-00000000-0000-0000-0000-000000000001',
  email: 'dev@quemefalta.local',
  app_metadata: { provider: 'google' },
  user_metadata: { full_name: 'Dev User', avatar_url: '' },
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
};

const MOCK_SESSION = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 99999,
  token_type: 'bearer',
  user: MOCK_USER,
};

const DEFAULT_PROFILE = {
  id: MOCK_USER.id,
  username: 'dev',
  display_name: 'Dev User',
  avatar_url: null,
  is_public: true,
  onboarded: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ── In-memory DB ──
interface MockDb {
  profiles: Record<string, any>[];
  stickers: Record<string, any>[];
}

let db: MockDb = { profiles: [DEFAULT_PROFILE], stickers: [] };
let dbLoaded = false;

async function loadDb() {
  if (dbLoaded) return;
  dbLoaded = true;
  try {
    const res = await fetch('/__mock-db');
    if (res.ok) {
      const data = await res.json();
      if (data.profiles?.length || data.stickers?.length) {
        db = { profiles: data.profiles ?? [DEFAULT_PROFILE], stickers: data.stickers ?? [] };
        return;
      }
    }
  } catch {
    // dev server not available, start fresh
  }
  db = { profiles: [DEFAULT_PROFILE], stickers: [] };
}

function saveDb() {
  fetch('/__mock-db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(db, null, 2),
  }).catch(() => {});
}

// ── Query builder ──
type Row = Record<string, any>;

class MockQueryBuilder {
  private table: string;
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private filters: { col: string; method: 'eq' | 'in'; value: any }[] = [];
  private cols: string | null = null;
  private isSingle = false;
  private isMaybe = false;
  private payload: any = null;
  private upsertConflict: string | null = null;
  private doSelectAfter = false;

  constructor(table: string) {
    this.table = table;
  }

  private getTable(): Row[] {
    return (db as any)[this.table] ?? [];
  }

  private setTable(rows: Row[]) {
    (db as any)[this.table] = rows;
    saveDb();
  }

  select(cols?: string) {
    this.op = this.op === 'update' ? 'update' : 'select';
    if (this.op === 'update') this.doSelectAfter = true;
    else this.cols = cols ?? '*';
    return this;
  }

  eq(col: string, value: any) {
    this.filters.push({ col, method: 'eq', value });
    return this;
  }

  in(col: string, values: any[]) {
    this.filters.push({ col, method: 'in', value: values });
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybe = true;
    return this;
  }

  update(data: any) {
    this.op = 'update';
    this.payload = data;
    return this;
  }

  upsert(data: any, opts?: { onConflict?: string }) {
    this.op = 'upsert';
    this.payload = Array.isArray(data) ? data : [data];
    this.upsertConflict = opts?.onConflict ?? null;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  private matchRow(row: Row): boolean {
    return this.filters.every((f) => {
      if (f.method === 'eq') return row[f.col] === f.value;
      if (f.method === 'in') return (f.value as any[]).includes(row[f.col]);
      return true;
    });
  }

  private pickCols(row: Row): Row {
    if (!this.cols || this.cols === '*') return { ...row };
    const keys = this.cols.split(',').map((c) => c.trim());
    const out: Row = {};
    for (const k of keys) {
      if (k in row) out[k] = row[k];
    }
    return out;
  }

  private execute(): { data: any; error: any } {
    const table = this.getTable();

    if (this.op === 'select') {
      const rows = table.filter((r) => this.matchRow(r)).map((r) => this.pickCols(r));
      if (this.isSingle) {
        return rows.length > 0
          ? { data: rows[0], error: null }
          : { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
      }
      if (this.isMaybe) {
        return { data: rows[0] ?? null, error: null };
      }
      return { data: rows, error: null };
    }

    if (this.op === 'delete') {
      const remaining = table.filter((r) => !this.matchRow(r));
      this.setTable(remaining);
      return { data: null, error: null };
    }

    if (this.op === 'update') {
      let updated: Row | null = null;
      const newTable: Row[] = table.map((r) => {
        if (this.matchRow(r)) {
          const merged = { ...r, ...this.payload, updated_at: new Date().toISOString() };
          updated = merged;
          return merged;
        }
        return r;
      });
      this.setTable(newTable);
      if (this.doSelectAfter && this.isSingle) {
        return updated
          ? { data: updated, error: null }
          : { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
      }
      return { data: updated, error: null };
    }

    if (this.op === 'upsert') {
      const conflictKeys = this.upsertConflict?.split(',').map((k) => k.trim()) ?? ['id'];
      const newTable = [...table];

      for (const row of this.payload) {
        const idx = newTable.findIndex((existing) =>
          conflictKeys.every((k) => existing[k] === row[k]),
        );
        const merged = { ...row, updated_at: new Date().toISOString() };
        if (idx >= 0) {
          newTable[idx] = { ...newTable[idx], ...merged };
        } else {
          newTable.push(merged);
        }
      }
      this.setTable(newTable);
      return { data: null, error: null };
    }

    return { data: null, error: null };
  }

  // Make it thenable (PromiseLike) so `await builder` works
  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const result = this.execute();
      return Promise.resolve(result).then(onfulfilled, onrejected);
    } catch (e) {
      return Promise.reject(e).then(onfulfilled, onrejected);
    }
  }
}

// ── Mock auth ──
type AuthCallback = (event: string, session: any) => void;
const authListeners: AuthCallback[] = [];

const mockAuth = {
  getSession: async () => ({ data: { session: MOCK_SESSION }, error: null }),
  refreshSession: async () => ({ data: { session: MOCK_SESSION }, error: null }),
  getUser: async () => ({ data: { user: MOCK_USER }, error: null }),
  signInWithOAuth: async () => {
    // In mock mode, just redirect to album (already "logged in")
    window.location.href = '/album';
    return { data: {}, error: null };
  },
  signOut: async () => {
    return { error: null };
  },
  exchangeCodeForSession: async () => ({
    data: { session: MOCK_SESSION },
    error: null,
  }),
  onAuthStateChange: (cb: AuthCallback) => {
    authListeners.push(cb);
    // Fire initial session event async
    setTimeout(() => cb('INITIAL_SESSION', MOCK_SESSION), 0);
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
};

// ── Public API ──
export function createMockClient() {
  // Load DB on creation
  loadDb();

  return {
    auth: mockAuth,
    from: (table: string) => new MockQueryBuilder(table),
  };
}
