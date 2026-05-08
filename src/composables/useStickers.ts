import { ref, computed, readonly, watch } from 'vue';
import { supabase, ensureFreshSession, withAuthRetry, sessionDead } from '@/lib/supabase';
import { useAuth } from '@/composables/useAuth';
import { TOTAL_STICKERS } from '@/lib/albumData';

export interface StickerState {
  owned: boolean;
  dupes: number;
  note: string;
}

const stickers = ref<Record<number, StickerState>>({});
const loading = ref(false);
const loaded = ref(false);
const syncError = ref<string | null>(null);
let currentUserId: string | null = null;

// Mutex: stickers con operacion en vuelo (evita race conditions)
const inFlight = new Set<number>();
let sectionInFlight = false;

function defaultState(): StickerState {
  return { owned: false, dupes: 0, note: '' };
}

async function loadStickers(userId: string, force = false) {
  if (!force && currentUserId === userId && loaded.value) return;

  loading.value = true;
  syncError.value = null;

  const { data, error } = await supabase
    .from('stickers')
    .select('sticker_number, owned, dupes, note')
    .eq('user_id', userId)
    .abortSignal(AbortSignal.timeout(8000));

  if (error) {
    console.error('[useStickers] Load error:', error);
    syncError.value = error.message;
    loading.value = false;
    return;
  }

  const map: Record<number, StickerState> = {};
  for (const row of data ?? []) {
    map[row.sticker_number] = {
      owned: row.owned,
      dupes: row.dupes ?? 0,
      note: row.note ?? '',
    };
  }

  stickers.value = map;
  currentUserId = userId;
  loaded.value = true;
  loading.value = false;
}

// Upsert con optimistic update
async function setSticker(stickerNumber: number, newState: StickerState) {
  const { user } = useAuth();
  if (!user.value) return;

  // Si ya hay una operacion en vuelo para este sticker, ignorar
  if (inFlight.has(stickerNumber)) return;
  inFlight.add(stickerNumber);

  // Refrescar sesion si lleva rato sin actividad
  if (!(await ensureFreshSession())) {
    syncError.value = 'Sesión expirada. Recarga la página.';
    inFlight.delete(stickerNumber);
    return;
  }

  // Optimistic: actualizar UI inmediato
  const previousState = stickers.value[stickerNumber];
  stickers.value = { ...stickers.value, [stickerNumber]: newState };

  const revert = () => {
    if (previousState) {
      stickers.value = { ...stickers.value, [stickerNumber]: previousState };
    } else {
      const m = { ...stickers.value };
      delete m[stickerNumber];
      stickers.value = m;
    }
  };

  try {
    // Si el nuevo state es el default (todo vacío), mejor borrar la fila
    if (!newState.owned && newState.dupes === 0 && !newState.note) {
      const m = { ...stickers.value };
      delete m[stickerNumber];
      stickers.value = m;

      const { error } = await withAuthRetry(() =>
        supabase
          .from('stickers')
          .delete()
          .eq('user_id', user.value!.id)
          .eq('sticker_number', stickerNumber),
      );

      if (error) {
        console.error('[useStickers] Delete error:', error);
        revert();
        syncError.value = error.message;
      } else {
        syncError.value = null;
      }
      return;
    }

    // Upsert
    const { error } = await withAuthRetry(() =>
      supabase.from('stickers').upsert(
        {
          user_id: user.value!.id,
          sticker_number: stickerNumber,
          owned: newState.owned,
          dupes: newState.dupes,
          note: newState.note || null,
        },
        { onConflict: 'user_id,sticker_number' },
      ),
    );

    if (error) {
      console.error('[useStickers] Upsert error:', error);
      revert();
      syncError.value = error.message;
    } else {
      syncError.value = null;
    }
  } finally {
    inFlight.delete(stickerNumber);
  }
}

// Tap: vacio → owned → ×2 → ×3 → vacio (capped at ×3)
function cycleSticker(stickerNumber: number) {
  if (inFlight.has(stickerNumber)) return;
  const current = stickers.value[stickerNumber] ?? defaultState();
  if (!current.owned) {
    setSticker(stickerNumber, { ...current, owned: true, dupes: 0 });
  } else if (current.dupes < 2) {
    setSticker(stickerNumber, { ...current, dupes: current.dupes + 1 });
  } else {
    // ×3 → back to empty
    setSticker(stickerNumber, { owned: false, dupes: 0, note: '' });
  }
}

// Quitar sticker completamente
function removeSticker(stickerNumber: number) {
  setSticker(stickerNumber, { owned: false, dupes: 0, note: '' });
}

// Marcar toda una seccion como owned — 1 bulk upsert
async function markSectionComplete(startsAt: number, count: number) {
  const { user } = useAuth();
  if (!user.value || sectionInFlight) return;
  sectionInFlight = true;

  if (!(await ensureFreshSession())) {
    syncError.value = 'Sesión expirada. Recarga la página.';
    sectionInFlight = false;
    return;
  }

  const toInsert: { num: number; prev: StickerState | undefined; note: string }[] = [];
  for (let i = 0; i < count; i++) {
    const num = startsAt + i;
    if (!stickers.value[num]?.owned) {
      toInsert.push({
        num,
        prev: stickers.value[num],
        note: stickers.value[num]?.note ?? '',
      });
    }
  }
  if (toInsert.length === 0) {
    sectionInFlight = false;
    return;
  }

  // Optimistic
  const newMap = { ...stickers.value };
  for (const { num, note } of toInsert) {
    newMap[num] = { owned: true, dupes: 0, note };
  }
  stickers.value = newMap;

  const rows = toInsert.map(({ num, note }) => ({
    user_id: user.value!.id,
    sticker_number: num,
    owned: true,
    dupes: 0,
    note: note || null,
  }));

  const { error } = await withAuthRetry(() =>
    supabase.from('stickers').upsert(rows, { onConflict: 'user_id,sticker_number' }),
  );

  if (error) {
    console.error('[useStickers] Bulk upsert error:', error);
    const revertMap = { ...stickers.value };
    for (const { num, prev } of toInsert) {
      if (prev) {
        revertMap[num] = prev;
      } else {
        delete revertMap[num];
      }
    }
    stickers.value = revertMap;
    syncError.value = error.message;
  } else {
    syncError.value = null;
  }
  sectionInFlight = false;
}

// Borrar toda una seccion — 1 bulk delete
async function clearSection(startsAt: number, count: number) {
  const { user } = useAuth();
  if (!user.value || sectionInFlight) return;
  sectionInFlight = true;

  if (!(await ensureFreshSession())) {
    syncError.value = 'Sesión expirada. Recarga la página.';
    sectionInFlight = false;
    return;
  }

  const toRemove: { num: number; prev: StickerState }[] = [];
  for (let i = 0; i < count; i++) {
    const num = startsAt + i;
    const s = stickers.value[num];
    if (s) {
      toRemove.push({ num, prev: s });
    }
  }
  if (toRemove.length === 0) {
    sectionInFlight = false;
    return;
  }

  // Optimistic
  const newMap = { ...stickers.value };
  for (const { num } of toRemove) {
    delete newMap[num];
  }
  stickers.value = newMap;

  const nums = toRemove.map((r) => r.num);
  const { error } = await withAuthRetry(() =>
    supabase.from('stickers').delete().eq('user_id', user.value!.id).in('sticker_number', nums),
  );

  if (error) {
    console.error('[useStickers] Bulk delete error:', error);
    const revertMap = { ...stickers.value };
    for (const { num, prev } of toRemove) {
      revertMap[num] = prev;
    }
    stickers.value = revertMap;
    syncError.value = error.message;
  } else {
    syncError.value = null;
  }
  sectionInFlight = false;
}

function adjustDupes(stickerNumber: number, delta: number) {
  const current = stickers.value[stickerNumber] ?? defaultState();
  if (!current.owned) return;
  const newDupes = Math.max(0, current.dupes + delta);
  setSticker(stickerNumber, { ...current, dupes: newDupes });
}

function setNote(stickerNumber: number, note: string) {
  const current = stickers.value[stickerNumber] ?? defaultState();
  setSticker(stickerNumber, { ...current, note: note.trim() });
}

// Watcher singleton — se registra una sola vez a nivel de modulo
let watcherSetUp = false;

// Re-cargar stickers cuando el usuario vuelve al tab
function setupVisibilityReload() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUserId && loaded.value) {
      loadStickers(currentUserId, true);
    }
  });
}

const stats = computed(() => {
  let owned = 0;
  let dupes = 0;
  let withNotes = 0;
  for (const key in stickers.value) {
    const s = stickers.value[key];
    if (s.owned) owned++;
    if (s.owned && s.dupes > 0) dupes += s.dupes;
    if (s.note) withNotes++;
  }
  return {
    owned,
    missing: TOTAL_STICKERS - owned,
    dupes,
    withNotes,
    pct: Math.round((owned / TOTAL_STICKERS) * 100 * 10) / 10,
  };
});

export function useStickers() {
  // Registrar watcher solo una vez
  if (!watcherSetUp) {
    watcherSetUp = true;
    const { user } = useAuth();

    // Auto-load cuando el user cambia
    watch(
      user,
      (newUser) => {
        if (newUser) {
          loadStickers(newUser.id);
        } else {
          stickers.value = {};
          loaded.value = false;
          currentUserId = null;
        }
      },
      { immediate: true },
    );

    setupVisibilityReload();
  }

  return {
    stickers: readonly(stickers),
    loading: readonly(loading),
    loaded: readonly(loaded),
    syncError: readonly(syncError),
    sessionDead,
    stats,
    getSticker: (n: number): StickerState => stickers.value[n] ?? defaultState(),
    cycleSticker,
    adjustDupes,
    removeSticker,
    markSectionComplete,
    clearSection,
    setNote,
  };
}
