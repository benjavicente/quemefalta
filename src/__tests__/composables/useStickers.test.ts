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

  // Limpiar la sync queue persistida — tests no deben heredar ops pendientes
  // de tests anteriores que simularon errores.
  try {
    localStorage.clear();
  } catch {
    // jsdom puede no tener localStorage en algunos entornos
  }

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

      // Mensajes tecnicos del servidor se traducen a friendly via friendlyErrorMessage.
      expect(syncError.value).toBe('Sin conexión');
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

    it('keeps incrementing dupes with no cap', async () => {
      setQueryResult({
        data: [createStickerDbRow(10, { owned: true, dupes: 2, note: null })],
        error: null,
      });

      const { stickers, cycleSticker, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      cycleSticker(10);
      await flushPromises();

      // Should increment to 3 dupes — no cap
      expect(stickers.value[10]?.owned).toBe(true);
      expect(stickers.value[10]?.dupes).toBe(3);
    });
  });

  describe('optimistic updates', () => {
    it('enqueues on upsert error — optimistic stays, no syncError banner', async () => {
      // Nueva politica: errors transitorios no revierten ni muestran banner.
      // La op se mete en la sync queue y se reintenta en background.
      setQueryResult({ data: [], error: null });

      const { stickers, cycleSticker, loaded, syncError, pendingOps } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({
        data: null,
        error: { message: 'Upsert failed' },
      });

      cycleSticker(42);
      await flushPromises();

      // Optimistic se mantiene (sticker queda marcado)
      expect(stickers.value[42]?.owned).toBe(true);
      // No mostramos banner amarillo de syncError — la queue tiene su propio banner
      expect(syncError.value).toBeNull();
      // La op esta en la queue con el error capturado
      expect(pendingOps.value.get(42)?.lastError).toBe('Upsert failed');
    });
  });

  describe('inFlight guard', () => {
    it('rapid taps update optimistic — second tap not silently dropped', async () => {
      // Nueva politica: cada tap actualiza optimistic incluso si hay un write
      // en vuelo. setSticker reconcilia al terminar disparando un write nuevo
      // si el estado cambio.
      setQueryResult({ data: [], error: null });

      const { cycleSticker, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });

      cycleSticker(42);
      // Segundo tap inmediato: con la nueva semantica incrementa dupes (no es no-op)
      cycleSticker(42);
      await flushPromises();

      const { stickers } = useStickers();
      // Tap 1: vacio → owned. Tap 2: owned → +1 dupe.
      expect(stickers.value[42]?.owned).toBe(true);
      expect(stickers.value[42]?.dupes).toBe(1);
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

    it('enqueues stickers individually when bulk upsert fails — optimistic stays', async () => {
      // Nueva politica: el bulk falla pero NO revertimos. Cada sticker queda
      // encolado individualmente para retry. Optimistic se mantiene en la UI.
      setQueryResult({ data: [], error: null });

      const { stickers, markSectionComplete, loaded, syncError, pendingCount } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({
        data: null,
        error: { message: 'Bulk error' },
      });

      await markSectionComplete(21, 20);

      // Sin banner de error — la queue tomo control
      expect(syncError.value).toBeNull();
      // Optimistic se mantiene
      for (let i = 21; i <= 40; i++) {
        expect(stickers.value[i]?.owned).toBe(true);
      }
      // Y cada sticker quedo en la queue
      expect(pendingCount.value).toBe(20);
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

    it('enqueues stickers individually when bulk delete fails — optimistic stays', async () => {
      // Nueva politica: bulk delete falla pero NO restauramos los stickers.
      // Cada uno queda encolado con target=default → la queue dispara DELETEs
      // individuales que suelen pasar aunque el bulk timeoutee.
      const data = Array.from({ length: 5 }, (_, i) =>
        createStickerDbRow(21 + i, { owned: true, dupes: 0, note: null }),
      );
      setQueryResult({ data, error: null });

      const { stickers, clearSection, loaded, syncError, pendingCount } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({
        data: null,
        error: { message: 'Delete error' },
      });

      await clearSection(21, 20);

      // Sin banner de error — la queue tomo control
      expect(syncError.value).toBeNull();
      // Stickers 21-25 ya no estan visibles (optimistic los borro)
      for (let i = 21; i <= 25; i++) {
        expect(stickers.value[i]).toBeUndefined();
      }
      // Cada uno quedo en la queue
      expect(pendingCount.value).toBe(5);
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

    it('enqueues op when withAuthRetry returns error — optimistic stays', async () => {
      // Nueva politica: en lugar de revertir, el sticker queda marcado y la op
      // se mete en la sync queue para retry en background.
      setQueryResult({ data: [], error: null });

      const { stickers, cycleSticker, loaded, pendingOps, pendingCount } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      mockSupabase.withAuthRetry.mockResolvedValueOnce({
        data: null,
        error: { message: 'JWT expired', code: '401' },
      });

      cycleSticker(42);
      await flushPromises();

      // Optimistic se mantiene
      expect(stickers.value[42]?.owned).toBe(true);
      // Y la op queda en la queue como pending para retry
      expect(pendingCount.value).toBe(1);
      expect(pendingOps.value.get(42)?.lastError).toBe('JWT expired');
      expect(pendingOps.value.get(42)?.status).toBe('pending');
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

  describe('addBatch()', () => {
    it('marks new stickers as owned', async () => {
      setQueryResult({ data: [], error: null });

      const { stickers, addBatch, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      const count = await addBatch([1, 5, 10]);

      expect(count).toBe(3);
      expect(stickers.value[1]?.owned).toBe(true);
      expect(stickers.value[5]?.owned).toBe(true);
      expect(stickers.value[10]?.owned).toBe(true);
    });

    it('treats duplicate numbers as extra dupes', async () => {
      setQueryResult({ data: [], error: null });

      const { stickers, addBatch, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      await addBatch([1, 1, 1]); // 3 copies → owned + 2 dupes

      expect(stickers.value[1]?.owned).toBe(true);
      expect(stickers.value[1]?.dupes).toBe(2);
    });

    it('adds extra dupes to already owned stickers', async () => {
      setQueryResult({
        data: [createStickerDbRow(5, { owned: true, dupes: 1, note: null })],
        error: null,
      });

      const { stickers, addBatch, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      await addBatch([5, 5]); // 2 copies of already-owned → +1 dupe

      expect(stickers.value[5]?.dupes).toBe(2); // was 1, +1
    });

    it('skips already owned stickers with single count', async () => {
      setQueryResult({
        data: [createStickerDbRow(5, { owned: true, dupes: 0, note: null })],
        error: null,
      });

      const { addBatch, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      const count = await addBatch([5]); // already owned, count=1 → no-op

      expect(count).toBe(0);
    });

    it('filters out invalid sticker numbers', async () => {
      setQueryResult({ data: [], error: null });

      const { stickers, addBatch, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      const count = await addBatch([0, -1, 981, 5]);

      expect(count).toBe(1);
      expect(stickers.value[5]?.owned).toBe(true);
      expect(stickers.value[0]).toBeUndefined();
    });

    it('enqueues stickers individually when batch fails — optimistic stays', async () => {
      setQueryResult({ data: [], error: null });

      const { stickers, addBatch, loaded, syncError, pendingCount } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: { message: 'Batch failed' } });
      await addBatch([1, 2, 3]);

      // Sin banner de error — la queue tomo control
      expect(syncError.value).toBeNull();
      // Optimistic se mantiene (stickers marcados)
      expect(stickers.value[1]?.owned).toBe(true);
      expect(stickers.value[2]?.owned).toBe(true);
      expect(stickers.value[3]?.owned).toBe(true);
      // Y los 3 estan en la queue
      expect(pendingCount.value).toBe(3);
    });

    it('returns 0 for empty input', async () => {
      setQueryResult({ data: [], error: null });

      const { addBatch, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      const count = await addBatch([]);
      expect(count).toBe(0);
    });

    it('blocks when session is expired', async () => {
      setQueryResult({ data: [], error: null });

      const { addBatch, loaded, syncError } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      mockSupabase.ensureFreshSession.mockResolvedValueOnce(false);
      await addBatch([1, 2]);

      expect(syncError.value).toBe('Sesión expirada. Recarga la página.');
    });
  });

  describe('decrementSticker()', () => {
    it('decrements dupes when dupes > 0', async () => {
      setQueryResult({
        data: [createStickerDbRow(10, { owned: true, dupes: 2, note: null })],
        error: null,
      });

      const { stickers, decrementSticker, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      decrementSticker(10);
      await flushPromises();

      expect(stickers.value[10]?.dupes).toBe(1);
    });

    it('removes sticker when dupes = 0', async () => {
      setQueryResult({
        data: [createStickerDbRow(10, { owned: true, dupes: 0, note: null })],
        error: null,
      });

      const { stickers, decrementSticker, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      decrementSticker(10);
      await flushPromises();

      expect(stickers.value[10]).toBeUndefined();
    });

    it('is a no-op for unowned sticker', async () => {
      setQueryResult({ data: [], error: null });

      const { stickers, decrementSticker, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      decrementSticker(10);
      expect(stickers.value[10]).toBeUndefined();
    });
  });

  describe('importBulk()', () => {
    it('merge mode: adds new stickers and updates quantities', async () => {
      setQueryResult({
        data: [createStickerDbRow(1, { owned: true, dupes: 0, note: 'keep me' })],
        error: null,
      });

      const { stickers, importBulk, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      const data = new Map([
        [1, 3], // owned, change from 1 to 3 (dupes: 2)
        [5, 1], // new sticker
      ]);
      const changed = await importBulk(data, 'merge');

      expect(changed).toBe(2);
      expect(stickers.value[1]?.dupes).toBe(2);
      expect(stickers.value[1]?.note).toBe('keep me'); // note preserved in merge
      expect(stickers.value[5]?.owned).toBe(true);
    });

    it('replace mode: wipes stickers not in CSV', async () => {
      setQueryResult({
        data: [
          createStickerDbRow(1, { owned: true, dupes: 0, note: null }),
          createStickerDbRow(5, { owned: true, dupes: 1, note: null }),
        ],
        error: null,
      });

      const { stickers, importBulk, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      const data = new Map([[1, 1]]); // only keep sticker 1
      const changed = await importBulk(data, 'replace');

      expect(changed).toBe(1); // sticker 5 deleted
      expect(stickers.value[1]?.owned).toBe(true);
      expect(stickers.value[5]).toBeUndefined();
    });

    it('returns 0 when no changes needed', async () => {
      setQueryResult({
        data: [createStickerDbRow(1, { owned: true, dupes: 0, note: null })],
        error: null,
      });

      const { importBulk, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      const data = new Map([[1, 1]]); // same as current
      const changed = await importBulk(data, 'merge');

      expect(changed).toBe(0);
    });

    it('enqueues individually when import upsert fails — optimistic stays', async () => {
      setQueryResult({ data: [], error: null });

      const { stickers, importBulk, loaded, syncError, pendingCount } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: { message: 'Import failed' } });
      const data = new Map([
        [1, 1],
        [2, 2],
      ]);
      await importBulk(data, 'merge');

      // Sin banner de error — la queue tomo control
      expect(syncError.value).toBeNull();
      // Optimistic se mantiene (stickers importados visibles)
      expect(stickers.value[1]?.owned).toBe(true);
      expect(stickers.value[2]?.owned).toBe(true);
      // Y estan en la queue
      expect(pendingCount.value).toBe(2);
    });

    it('blocks when session is expired', async () => {
      setQueryResult({ data: [], error: null });

      const { importBulk, loaded, syncError } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      mockSupabase.ensureFreshSession.mockResolvedValueOnce(false);
      const data = new Map([[1, 1]]);
      const changed = await importBulk(data, 'merge');

      expect(changed).toBe(0);
      expect(syncError.value).toBe('Sesión expirada. Recarga la página.');
    });

    it('filters out-of-range sticker numbers', async () => {
      setQueryResult({ data: [], error: null });

      const { importBulk, loaded } = useStickers();
      await vi.waitFor(() => expect(loaded.value).toBe(true));

      setQueryResult({ data: null, error: null });
      const data = new Map([
        [0, 1],
        [981, 1],
        [5, 1],
      ]);
      const changed = await importBulk(data, 'merge');

      expect(changed).toBe(1); // only sticker 5
    });
  });
});
