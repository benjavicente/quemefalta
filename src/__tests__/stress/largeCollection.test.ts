import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { flushPromises } from '@vue/test-utils';
import * as mockSupabase from '../mocks/supabase';
import { createUser, createStickerDbRow } from '../mocks/factories';

const { supabase, setQueryResult, resetSupabaseMock } = mockSupabase;

const mockUser = createUser();

let useStickers: typeof import('@/composables/useStickers').useStickers;

beforeEach(async () => {
  vi.resetModules();
  resetSupabaseMock();

  vi.doMock('@/lib/supabase', () => mockSupabase);
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

// Generate N sticker DB rows starting at sticker 1
function generateStickers(count: number, options?: { dupesEvery?: number; noteEvery?: number }) {
  const dupesEvery = options?.dupesEvery ?? 0;
  const noteEvery = options?.noteEvery ?? 0;

  return Array.from({ length: count }, (_, i) => {
    const num = i + 1;
    const dupes = dupesEvery > 0 && num % dupesEvery === 0 ? 2 : 0;
    const note = noteEvery > 0 && num % noteEvery === 0 ? `note-${num}` : null;
    return createStickerDbRow(num, { owned: true, dupes, note });
  });
}

describe('Large collection (800/980 stickers)', () => {
  describe('loadStickers with 800 items', () => {
    it('loads and populates state correctly', async () => {
      const rows = generateStickers(800);
      setQueryResult({ data: rows, error: null });

      const { stickers, loaded, stats } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      expect(Object.keys(stickers.value)).toHaveLength(800);
      expect(stats.value.owned).toBe(800);
      expect(stats.value.missing).toBe(180); // 980 - 800
    });

    it('computes pct correctly at 800/980', async () => {
      const rows = generateStickers(800);
      setQueryResult({ data: rows, error: null });

      const { stats, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      // 800/980 = 81.6% (1 decimal)
      expect(stats.value.pct).toBe(Math.round((800 / 980) * 100 * 10) / 10);
    });

    it('computes pct at 100% when all 980 owned', async () => {
      const rows = generateStickers(980);
      setQueryResult({ data: rows, error: null });

      const { stats, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      expect(stats.value.owned).toBe(980);
      expect(stats.value.missing).toBe(0);
      expect(stats.value.pct).toBe(Math.round((980 / 980) * 100 * 10) / 10);
    });
  });

  describe('stats accuracy with dupes and notes', () => {
    it('counts dupes correctly across many stickers', async () => {
      // 800 stickers, every 5th has 2 dupes
      const rows = generateStickers(800, { dupesEvery: 5 });
      setQueryResult({ data: rows, error: null });

      const { stats, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      // 800/5 = 160 stickers with dupes, each has dupes=2
      expect(stats.value.dupes).toBe(160 * 2);
    });

    it('counts notes correctly across many stickers', async () => {
      // 800 stickers, every 10th has a note
      const rows = generateStickers(800, { noteEvery: 10 });
      setQueryResult({ data: rows, error: null });

      const { stats, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      expect(stats.value.withNotes).toBe(80); // 800/10
    });
  });

  describe('cycleSticker on large collection', () => {
    it('can cycle a sticker when 800 others exist', async () => {
      const rows = generateStickers(800);
      setQueryResult({ data: rows, error: null });

      const { stickers, cycleSticker, loaded, stats } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      // Cycle sticker 900 (doesn't exist yet)
      setQueryResult({ data: null, error: null });
      cycleSticker(900);
      await flushPromises();

      expect(stickers.value[900]?.owned).toBe(true);
      expect(stats.value.owned).toBe(801);
    });

    it('can remove a sticker from large collection', async () => {
      const rows = generateStickers(800);
      setQueryResult({ data: rows, error: null });

      const { stickers, removeSticker, loaded, stats } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      removeSticker(500);
      await flushPromises();

      expect(stickers.value[500]).toBeUndefined();
      expect(stats.value.owned).toBe(799);
    });
  });

  describe('markSectionComplete with mostly-filled album', () => {
    it('fills the remaining 20 stickers of a section', async () => {
      // 800 stickers already owned (1-800). Section at 801-820 is empty.
      const rows = generateStickers(800);
      setQueryResult({ data: rows, error: null });

      const { stickers, markSectionComplete, loaded, stats } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      // Mark section starting at 801, count 20
      setQueryResult({ data: null, error: null });
      await markSectionComplete(801, 20);

      expect(stats.value.owned).toBe(820);
      for (let i = 801; i <= 820; i++) {
        expect(stickers.value[i]?.owned).toBe(true);
      }
    });

    it('skips already-owned stickers in partial section', async () => {
      // 800 stickers (1-800). Some of section 801-820 are owned too.
      const rows = [
        ...generateStickers(800),
        createStickerDbRow(801, { owned: true, dupes: 0, note: null }),
        createStickerDbRow(805, { owned: true, dupes: 1, note: 'keep me' }),
      ];
      setQueryResult({ data: rows, error: null });

      const { stickers, markSectionComplete, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      await markSectionComplete(801, 20);

      // All should be owned
      for (let i = 801; i <= 820; i++) {
        expect(stickers.value[i]?.owned).toBe(true);
      }
      // Pre-existing sticker 805 should keep its dupes
      expect(stickers.value[805]?.dupes).toBe(1);
    });
  });

  describe('clearSection with large collection', () => {
    it('removes only the targeted section', async () => {
      const rows = generateStickers(980);
      setQueryResult({ data: rows, error: null });

      const { stickers, clearSection, loaded, stats } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      expect(stats.value.owned).toBe(980);

      // Clear section 21-40 (Mexico)
      setQueryResult({ data: null, error: null });
      await clearSection(21, 20);

      expect(stats.value.owned).toBe(960);
      // Cleared stickers should be gone
      for (let i = 21; i <= 40; i++) {
        expect(stickers.value[i]).toBeUndefined();
      }
      // Adjacent stickers should be untouched
      expect(stickers.value[20]?.owned).toBe(true);
      expect(stickers.value[41]?.owned).toBe(true);
    });
  });

  describe('getSticker boundary checks', () => {
    it('returns correct state for sticker at boundary (1, 980)', async () => {
      const rows = generateStickers(980);
      setQueryResult({ data: rows, error: null });

      const { getSticker, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      expect(getSticker(1).owned).toBe(true);
      expect(getSticker(980).owned).toBe(true);
      expect(getSticker(981).owned).toBe(false); // out of album range
    });
  });

  describe('performance sanity', () => {
    it('loads 980 stickers in reasonable time', async () => {
      const rows = generateStickers(980, { dupesEvery: 3, noteEvery: 7 });
      setQueryResult({ data: rows, error: null });

      const start = performance.now();
      const { loaded, stats } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));
      const elapsed = performance.now() - start;

      expect(stats.value.owned).toBe(980);
      // Should load in under 500ms even in test environment
      expect(elapsed).toBeLessThan(500);
    });

    it('stats recomputation is fast after single sticker change', async () => {
      const rows = generateStickers(980);
      setQueryResult({ data: rows, error: null });

      const { stats, removeSticker, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });

      const start = performance.now();
      removeSticker(500);
      await flushPromises();
      const elapsed = performance.now() - start;

      expect(stats.value.owned).toBe(979);
      expect(elapsed).toBeLessThan(100);
    });
  });
});
