import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import * as mockSupabase from '../mocks/supabase';

const { supabase, resetSupabaseMock } = mockSupabase;

let useExchange: typeof import('@/composables/useExchange').useExchange;

// Helper: create a query builder that resolves to a specific result
function builderWith(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'neq', 'single', 'maybeSingle', 'abortSignal']) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve({ ...result }).then(resolve, reject);
  return builder;
}

// Configure supabase.from to return specific results per table
function mockFromTable(config: Record<string, { data: unknown; error: unknown }>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabase.from as any).mockImplementation((table: string) => {
    const result = config[table] ?? { data: null, error: null };
    return builderWith(result);
  });
}

beforeEach(async () => {
  vi.resetModules();
  resetSupabaseMock();

  vi.doMock('@/lib/supabase', () => mockSupabase);
  vi.doMock('@/composables/useAuth', () => ({
    useAuth: () => ({
      user: ref(null),
      profile: ref(null),
      loading: ref(false),
      init: vi.fn(),
    }),
  }));

  const mod = await import('@/composables/useExchange');
  useExchange = mod.useExchange;
});

describe('useExchange', () => {
  it('loads exchange data for two users', async () => {
    mockFromTable({
      public_album_stats: {
        data: { id: 'u1', username: 'alice', display_name: 'Alice', avatar_url: null, owned_count: 100, dupes_count: 10 },
        error: null,
      },
      public_user_stickers: {
        data: [
          { sticker_number: 1, owned: true, dupes: 2 },
          { sticker_number: 2, owned: true, dupes: 0 },
        ],
        error: null,
      },
    });

    const userA = ref('alice');
    const userB = ref('bob');
    const { loading, error, profileA, profileB, exchange, load } = useExchange(userA, userB);

    expect(loading.value).toBe(true);
    await load();

    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
    expect(profileA.value?.username).toBe('alice');
    // Both profiles get the same mock data (same table), which is fine for this test
    expect(profileB.value).not.toBeNull();
    expect(exchange.value).not.toBeNull();
  });

  it('sets error when both usernames are the same', async () => {
    const userA = ref('alice');
    const userB = ref('alice');
    const { error, load } = useExchange(userA, userB);

    await load();
    expect(error.value).toBe('No puedes comparar un perfil consigo mismo.');
  });

  it('sets error when users are not found', async () => {
    mockFromTable({
      public_album_stats: { data: null, error: null },
      public_user_stickers: { data: [], error: null },
    });

    const userA = ref('ghost');
    const userB = ref('bob');
    const { error, load } = useExchange(userA, userB);

    await load();
    // Mock returns null for all profiles, so both are "not found"
    expect(error.value).not.toBeNull();
  });

  it('sets error when both users not found', async () => {
    mockFromTable({
      public_album_stats: { data: null, error: null },
      public_user_stickers: { data: [], error: null },
    });

    const userA = ref('ghost1');
    const userB = ref('ghost2');
    const { error, load } = useExchange(userA, userB);

    await load();
    expect(error.value).toContain('Ninguno');
  });

  it('computes stats for both users', async () => {
    mockFromTable({
      public_album_stats: {
        data: { id: 'u1', username: 'alice', display_name: 'Alice', avatar_url: null, owned_count: 490, dupes_count: 25 },
        error: null,
      },
      public_user_stickers: { data: [], error: null },
    });

    const userA = ref('alice');
    const userB = ref('bob');
    const { statsA, statsB, load } = useExchange(userA, userB);

    await load();
    expect(statsA.value?.pct).toBe(50);
    expect(statsA.value?.dupes).toBe(25);
    expect(statsB.value).not.toBeNull();
  });

  it('handles supabase errors gracefully', async () => {
    supabase.from.mockImplementation(() => {
      throw new Error('Network error');
    });

    const userA = ref('alice');
    const userB = ref('bob');
    const { error, loading, load } = useExchange(userA, userB);

    await load();
    expect(loading.value).toBe(false);
    expect(error.value).toContain('Error al cargar');
  });
});
