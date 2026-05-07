import { ref, computed, readonly, watch } from 'vue';
import { supabase } from '@/lib/supabase';
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

function defaultState(): StickerState {
  return { owned: false, dupes: 0, note: '' };
}

async function loadStickers(userId: string) {
  if (currentUserId === userId && loaded.value) return;

  loading.value = true;
  syncError.value = null;

  const { data, error } = await supabase
    .from('stickers')
    .select('sticker_number, owned, dupes, note')
    .eq('user_id', userId);

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

  // Optimistic: actualizar UI inmediato
  const previousState = stickers.value[stickerNumber];
  stickers.value = { ...stickers.value, [stickerNumber]: newState };

  // Si el nuevo state es el default (todo vacío), mejor borrar la fila
  if (!newState.owned && newState.dupes === 0 && !newState.note) {
    delete stickers.value[stickerNumber];
    stickers.value = { ...stickers.value };

    const { error } = await supabase
      .from('stickers')
      .delete()
      .eq('user_id', user.value.id)
      .eq('sticker_number', stickerNumber);

    if (error) {
      console.error('[useStickers] Delete error:', error);
      // Revert
      if (previousState) {
        stickers.value = { ...stickers.value, [stickerNumber]: previousState };
      }
      syncError.value = error.message;
    }
    return;
  }

  // Upsert
  const { error } = await supabase.from('stickers').upsert(
    {
      user_id: user.value.id,
      sticker_number: stickerNumber,
      owned: newState.owned,
      dupes: newState.dupes,
      note: newState.note || null,
    },
    { onConflict: 'user_id,sticker_number' },
  );

  if (error) {
    console.error('[useStickers] Upsert error:', error);
    // Revert
    if (previousState) {
      stickers.value = { ...stickers.value, [stickerNumber]: previousState };
    } else {
      delete stickers.value[stickerNumber];
      stickers.value = { ...stickers.value };
    }
    syncError.value = error.message;
  } else {
    syncError.value = null;
  }
}

// Cycle: no tengo → tengo → tengo+repetida → no tengo
function cycleSticker(stickerNumber: number) {
  const current = stickers.value[stickerNumber] ?? defaultState();
  if (!current.owned) {
    setSticker(stickerNumber, { ...current, owned: true, dupes: 0 });
  } else if (current.owned && current.dupes === 0) {
    setSticker(stickerNumber, { ...current, owned: true, dupes: 1 });
  } else {
    setSticker(stickerNumber, { ...current, owned: false, dupes: 0 });
  }
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

export function useStickers() {
  const { user } = useAuth();

  // Auto-load cuando el user cambia
  watch(
    user,
    (newUser) => {
      if (newUser) {
        loadStickers(newUser.value?.id ?? newUser.id);
      } else {
        stickers.value = {};
        loaded.value = false;
        currentUserId = null;
      }
    },
    { immediate: true },
  );

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
      pct: Math.round((owned / TOTAL_STICKERS) * 100),
    };
  });

  return {
    stickers: readonly(stickers),
    loading: readonly(loading),
    loaded: readonly(loaded),
    syncError: readonly(syncError),
    stats,
    getSticker: (n: number): StickerState => stickers.value[n] ?? defaultState(),
    cycleSticker,
    adjustDupes,
    setNote,
  };
}
