import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as mockSupabase from '../mocks/supabase';

const { supabase, resetSupabaseMock } = mockSupabase;

let useTradeMatches: typeof import('@/composables/useTradeMatches').useTradeMatches;

beforeEach(async () => {
  vi.resetModules();
  resetSupabaseMock();
  vi.doMock('@/lib/supabase', () => mockSupabase);
  ({ useTradeMatches } = await import('@/composables/useTradeMatches'));
});

describe('useTradeMatches', () => {
  it('starts with empty matches and not loaded', () => {
    const { matches, loading, loaded, error } = useTradeMatches();
    expect(matches.value).toEqual([]);
    expect(loading.value).toBe(false);
    expect(loaded.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it('populates matches from RPC and flips loaded to true', async () => {
    const fakeMatches = [
      {
        user_id: 'u1',
        username: 'pedro',
        display_name: 'Pedro',
        avatar_url: null,
        owned_count: 500,
        dupes_count: 50,
        their_dupes_for_me: 20,
        my_dupes_for_them: 10,
      },
    ];
    supabase.rpc.mockResolvedValueOnce({ data: fakeMatches, error: null });

    const { matches, loaded, load } = useTradeMatches();
    await load();

    expect(supabase.rpc).toHaveBeenCalledWith('public_trade_matches');
    expect(matches.value).toEqual(fakeMatches);
    expect(loaded.value).toBe(true);
  });

  it('skips reloading when already loaded unless force=true', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });
    const { load } = useTradeMatches();

    await load();
    await load();
    await load();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);

    await load(true);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it('sets error message on RPC failure', async () => {
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Sin conexión', code: 'timeout' },
    });
    const { error, loaded, load } = useTradeMatches();
    await load();
    expect(error.value).toBe('Sin conexión');
    expect(loaded.value).toBe(false);
  });

  it('treats non-array data as empty list (defensive)', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: null });
    const { matches, loaded, load } = useTradeMatches();
    await load();
    expect(matches.value).toEqual([]);
    expect(loaded.value).toBe(true);
  });

  it('does not start a second load while one is in flight', async () => {
    let resolveCall: ((v: { data: any; error: any }) => void) | null = null;
    supabase.rpc.mockReturnValue(
      new Promise<{ data: any; error: any }>((resolve) => {
        resolveCall = resolve;
      }),
    );

    const { load } = useTradeMatches();
    const firstLoad = load();
    const secondLoad = load();

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    resolveCall!({ data: [], error: null });
    await firstLoad;
    await secondLoad;
  });
});
