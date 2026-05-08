import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import * as mockSupabase from '../mocks/supabase';
import { createUser, createStickerDbRow } from '../mocks/factories';

const { supabase, setQueryResult, resetSupabaseMock } = mockSupabase;

let useStickers: typeof import('@/composables/useStickers').useStickers;

const mockUser = createUser();

beforeEach(async () => {
  vi.resetModules();
  resetSupabaseMock();

  // Mock supabase
  vi.doMock('@/lib/supabase', () => mockSupabase);

  // Mock useAuth to provide a controlled user
  vi.doMock('@/composables/useAuth', () => ({
    useAuth: () => ({
      user: ref(mockUser),
      profile: ref(null),
      loading: ref(false),
      isAuthenticated: { value: true },
      needsOnboarding: { value: false },
      init: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      updateProfile: vi.fn(),
    }),
  }));

  const mod = await import('@/composables/useStickers');
  useStickers = mod.useStickers;
});

describe('useStickers', () => {
  describe('loadStickers()', () => {
    it('fetches stickers and populates state', async () => {
      setQueryResult({
        data: [
          createStickerDbRow(1, { owned: true, dupes: 0, note: null }),
          createStickerDbRow(5, { owned: true, dupes: 2, note: 'for pedro' }),
        ],
        error: null,
      });

      const { stickers, loaded } = useStickers();

      // The watcher triggers loadStickers automatically via immediate: true
      await vi.waitFor(() => {
        expect(loaded.value).toBe(true);
      });

      expect(stickers.value[1]).toEqual({ owned: true, dupes: 0, note: '' });
      expect(stickers.value[5]).toEqual({
        owned: true,
        dupes: 2,
        note: 'for pedro',
      });
    });

    it('sets syncError on fetch error', async () => {
      setQueryResult({
        data: null,
        error: { message: 'Network error' },
      });

      const { syncError, loading } = useStickers();

      await vi.waitFor(() => {
        expect(loading.value).toBe(false);
      });

      expect(syncError.value).toBe('Network error');
    });
  });

  describe('cycleSticker()', () => {
    it('cycles empty → owned', async () => {
      setQueryResult({ data: [], error: null });

      const { stickers, cycleSticker, loaded } = useStickers();

      await vi.waitFor(() => expect(loaded.value).toBe(true));

      // Sticker 42 doesn't exist yet → cycle should set owned: true
      setQueryResult({ data: null, error: null });
      cycleSticker(42);
      await flushPromises();

      // Optimistic: should be owned after ensureFreshSession resolves
      expect(stickers.value[42]?.owned).toBe(true);
      expect(stickers.value[42]?.dupes).toBe(0);
    });

    it('cycles owned(0 dupes) → owned(1 dupe)', async () => {
      setQueryResult({
        data: [createStickerDbRow(10, { owned: true, dupes: 0, note: null })],
        error: null,
      });

      const { stickers, cycleSticker, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      cycleSticker(10);
      await flushPromises();

      expect(stickers.value[10]?.dupes).toBe(1);
    });

    it('cycles owned(1 dupe) → owned(2 dupes)', async () => {
      setQueryResult({
        data: [createStickerDbRow(10, { owned: true, dupes: 1, note: null })],
        error: null,
      });

      const { stickers, cycleSticker, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      cycleSticker(10);
      await flushPromises();

      expect(stickers.value[10]?.dupes).toBe(2);
    });

    it('stops cycling at owned(2 dupes) — does not cycle back to empty', async () => {
      setQueryResult({
        data: [createStickerDbRow(10, { owned: true, dupes: 2, note: null })],
        error: null,
      });

      const { stickers, cycleSticker, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      cycleSticker(10);
      await flushPromises();

      // Should stay at owned(2 dupes) — cycleSticker does not cycle back to empty
      expect(stickers.value[10]?.owned).toBe(true);
      expect(stickers.value[10]?.dupes).toBe(2);
    });
  });

  describe('optimistic updates', () => {
    it('reverts on upsert error', async () => {
      setQueryResult({
        data: [],
        error: null,
      });

      const { stickers, cycleSticker, loaded, syncError } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      // Set up the upsert to fail
      setQueryResult({
        data: null,
        error: { message: 'Upsert failed' },
      });

      cycleSticker(42);
      await flushPromises();

      // Should revert since upsert failed
      expect(syncError.value).toBe('Upsert failed');
      expect(stickers.value[42]).toBeUndefined();
    });
  });

  describe('inFlight guard', () => {
    it('ignores concurrent operations on same sticker', async () => {
      setQueryResult({ data: [], error: null });

      const { cycleSticker, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      // Make the upsert hang so the sticker stays in-flight
      setQueryResult({ data: null, error: null });

      cycleSticker(42);
      // Second call while first is in-flight — should be a no-op
      cycleSticker(42);
      await flushPromises();

      // Sticker should be owned (first cycle: empty→owned), not double-cycled
      const { stickers } = useStickers();
      expect(stickers.value[42]?.owned).toBe(true);
      expect(stickers.value[42]?.dupes).toBe(0);
    });
  });

  describe('markSectionComplete()', () => {
    it('marks unowned stickers as owned', async () => {
      // Section starts at 21, count 20. Only sticker 21 is owned.
      setQueryResult({
        data: [createStickerDbRow(21, { owned: true, dupes: 0, note: null })],
        error: null,
      });

      const { stickers, markSectionComplete, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      await markSectionComplete(21, 20);

      // All 20 stickers should now be owned
      for (let i = 21; i <= 40; i++) {
        expect(stickers.value[i]?.owned).toBe(true);
      }
    });

    it('is a no-op when all stickers already owned', async () => {
      const data = Array.from({ length: 20 }, (_, i) =>
        createStickerDbRow(21 + i, { owned: true, dupes: 0, note: null }),
      );
      setQueryResult({ data, error: null });

      const { markSectionComplete, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      const callsBefore = supabase.from.mock.calls.length;

      await markSectionComplete(21, 20);

      // No additional supabase.from calls beyond the initial load
      expect(supabase.from.mock.calls.length).toBe(callsBefore);
    });

    it('reverts on bulk upsert error', async () => {
      setQueryResult({ data: [], error: null });

      const { stickers, markSectionComplete, loaded, syncError } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({
        data: null,
        error: { message: 'Bulk error' },
      });

      await markSectionComplete(21, 20);

      expect(syncError.value).toBe('Bulk error');
      // All stickers should be reverted (removed since they didn't exist before)
      for (let i = 21; i <= 40; i++) {
        expect(stickers.value[i]).toBeUndefined();
      }
    });
  });

  describe('clearSection()', () => {
    it('removes all stickers in range', async () => {
      const data = Array.from({ length: 20 }, (_, i) =>
        createStickerDbRow(21 + i, { owned: true, dupes: 0, note: null }),
      );
      setQueryResult({ data, error: null });

      const { stickers, clearSection, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      await clearSection(21, 20);

      for (let i = 21; i <= 40; i++) {
        expect(stickers.value[i]).toBeUndefined();
      }
    });

    it('reverts on bulk delete error', async () => {
      const data = Array.from({ length: 5 }, (_, i) =>
        createStickerDbRow(21 + i, { owned: true, dupes: 0, note: null }),
      );
      setQueryResult({ data, error: null });

      const { stickers, clearSection, loaded, syncError } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({
        data: null,
        error: { message: 'Delete error' },
      });

      await clearSection(21, 20);

      expect(syncError.value).toBe('Delete error');
      // Stickers 21-25 should be restored
      for (let i = 21; i <= 25; i++) {
        expect(stickers.value[i]?.owned).toBe(true);
      }
    });
  });

  describe('stats', () => {
    it('computes correct stats', async () => {
      setQueryResult({
        data: [
          createStickerDbRow(1, { owned: true, dupes: 0, note: null }),
          createStickerDbRow(2, { owned: true, dupes: 2, note: null }),
          createStickerDbRow(3, { owned: true, dupes: 1, note: 'test' }),
        ],
        error: null,
      });

      const { stats, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      expect(stats.value.owned).toBe(3);
      expect(stats.value.missing).toBe(980 - 3);
      expect(stats.value.dupes).toBe(3); // 0 + 2 + 1
      expect(stats.value.withNotes).toBe(1);
      expect(stats.value.pct).toBe(Math.round((3 / 980) * 100 * 10) / 10);
    });

    it('returns pct 0 when no stickers owned', async () => {
      setQueryResult({ data: [], error: null });

      const { stats, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      expect(stats.value.pct).toBe(0);
      expect(stats.value.owned).toBe(0);
      expect(stats.value.missing).toBe(980);
    });
  });

  describe('getSticker()', () => {
    it('returns default state for unknown sticker', async () => {
      setQueryResult({ data: [], error: null });

      const { getSticker, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      const state = getSticker(999);
      expect(state).toEqual({ owned: false, dupes: 0, note: '' });
    });
  });

  describe('removeSticker()', () => {
    it('removes a sticker by resetting to default', async () => {
      setQueryResult({
        data: [createStickerDbRow(5, { owned: true, dupes: 1, note: 'x' })],
        error: null,
      });

      const { stickers, removeSticker, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      removeSticker(5);
      await flushPromises();

      // Optimistic: should be removed
      expect(stickers.value[5]).toBeUndefined();
    });
  });

  describe('adjustDupes()', () => {
    it('increments dupes for owned sticker', async () => {
      setQueryResult({
        data: [createStickerDbRow(10, { owned: true, dupes: 0, note: null })],
        error: null,
      });

      const { stickers, adjustDupes, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      adjustDupes(10, 1);
      await flushPromises();

      expect(stickers.value[10]?.dupes).toBe(1);
    });

    it('does not go below 0 dupes', async () => {
      setQueryResult({
        data: [createStickerDbRow(10, { owned: true, dupes: 0, note: null })],
        error: null,
      });

      const { stickers, adjustDupes, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      adjustDupes(10, -1);
      await flushPromises();

      expect(stickers.value[10]?.dupes).toBe(0);
    });

    it('is a no-op for unowned sticker', async () => {
      setQueryResult({ data: [], error: null });

      const { stickers, adjustDupes, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      adjustDupes(10, 1);

      expect(stickers.value[10]).toBeUndefined();
    });
  });

  describe('setNote()', () => {
    it('sets note on a sticker', async () => {
      setQueryResult({
        data: [createStickerDbRow(10, { owned: true, dupes: 0, note: null })],
        error: null,
      });

      const { stickers, setNote, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      setNote(10, '  for pedro  ');
      await flushPromises();

      expect(stickers.value[10]?.note).toBe('for pedro');
    });
  });

  describe('withAuthRetry integration', () => {
    it('passes through successful writes', async () => {
      setQueryResult({ data: [], error: null });

      const { stickers, cycleSticker, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      cycleSticker(42);
      await flushPromises();

      expect(stickers.value[42]?.owned).toBe(true);
      expect(mockSupabase.withAuthRetry).toHaveBeenCalled();
    });

    it('reverts optimistic update when withAuthRetry returns error', async () => {
      setQueryResult({ data: [], error: null });

      const { stickers, cycleSticker, loaded, syncError } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      // Make withAuthRetry return an auth error (simulating all retries exhausted)
      mockSupabase.withAuthRetry.mockResolvedValueOnce({
        data: null,
        error: { message: 'JWT expired', code: '401' },
      });

      cycleSticker(42);
      await flushPromises();

      expect(stickers.value[42]).toBeUndefined();
      expect(syncError.value).toBe('JWT expired');
    });

    it('blocks writes when sessionDead is true via ensureFreshSession', async () => {
      setQueryResult({ data: [], error: null });

      const { stickers, cycleSticker, loaded, syncError } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      // Simulate session dead
      mockSupabase.ensureFreshSession.mockResolvedValueOnce(false);

      cycleSticker(42);
      await flushPromises();

      // Should not have been set (ensureFreshSession returned false → early return)
      expect(stickers.value[42]).toBeUndefined();
      expect(syncError.value).toBe('Sesión expirada. Recarga la página.');
    });
  });

  describe('sessionDead state', () => {
    it('exposes sessionDead from useStickers', async () => {
      setQueryResult({ data: [], error: null });

      const { sessionDead: sd, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      expect(sd.value).toBe(false);
    });
  });
});
