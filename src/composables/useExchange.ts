import { ref, computed, type Ref } from 'vue';
import { supabase, withAuthRetry } from '@/lib/supabase';
import { TOTAL_STICKERS } from '@/lib/albumData';
import { computeExchange, type StickerMap, type ExchangeResult } from '@/lib/exchangeUtils';

export interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  owned_count: number;
  dupes_count: number;
}

export function useExchange(usernameA: Ref<string>, usernameB: Ref<string>) {
  const loading = ref(true);
  const error = ref<string | null>(null);
  const profileA = ref<PublicProfile | null>(null);
  const profileB = ref<PublicProfile | null>(null);
  const stickerMapA = ref<StickerMap>(new Map());
  const stickerMapB = ref<StickerMap>(new Map());

  const exchange = computed<ExchangeResult | null>(() => {
    if (!profileA.value || !profileB.value) return null;
    return computeExchange(stickerMapA.value, stickerMapB.value);
  });

  const statsA = computed(() => {
    if (!profileA.value) return null;
    const owned = profileA.value.owned_count;
    return {
      pct: Math.round((owned / TOTAL_STICKERS) * 100 * 10) / 10,
      owned,
      missing: TOTAL_STICKERS - owned,
      dupes: profileA.value.dupes_count,
    };
  });

  const statsB = computed(() => {
    if (!profileB.value) return null;
    const owned = profileB.value.owned_count;
    return {
      pct: Math.round((owned / TOTAL_STICKERS) * 100 * 10) / 10,
      owned,
      missing: TOTAL_STICKERS - owned,
      dupes: profileB.value.dupes_count,
    };
  });

  async function fetchProfile(username: string): Promise<PublicProfile | null> {
    const { data, error: err } = await withAuthRetry(() =>
      supabase.from('public_album_stats').select('*').eq('username', username).maybeSingle(),
    );
    if (err || !data) return null;
    return data as PublicProfile;
  }

  async function fetchStickerMap(username: string): Promise<StickerMap> {
    const { data } = await withAuthRetry(() =>
      supabase
        .from('public_user_stickers')
        .select('sticker_number, owned, dupes')
        .eq('username', username),
    );
    const map: StickerMap = new Map();
    if (Array.isArray(data)) {
      for (const s of data as { sticker_number: number; owned: boolean; dupes: number | null }[]) {
        map.set(s.sticker_number, { owned: s.owned, dupes: s.dupes ?? 0 });
      }
    }
    return map;
  }

  async function load() {
    loading.value = true;
    error.value = null;

    if (usernameA.value === usernameB.value) {
      error.value = 'No puedes comparar un perfil consigo mismo.';
      loading.value = false;
      return;
    }

    // Las tablas son publicas y fetchProfile/fetchStickerMap ya usan
    // withAuthRetry con timeout. No hace falta refrescar la sesion aca.
    try {
      const [pA, pB] = await Promise.all([
        fetchProfile(usernameA.value),
        fetchProfile(usernameB.value),
      ]);

      profileA.value = pA;
      profileB.value = pB;

      if (!pA || !pB) {
        if (!pA && !pB) error.value = 'Ninguno de los dos perfiles fue encontrado.';
        else if (!pA) error.value = `No se encontró el perfil @${usernameA.value}.`;
        else error.value = `No se encontró el perfil @${usernameB.value}.`;
        loading.value = false;
        return;
      }

      const [mapA, mapB] = await Promise.all([
        fetchStickerMap(usernameA.value),
        fetchStickerMap(usernameB.value),
      ]);

      stickerMapA.value = mapA;
      stickerMapB.value = mapB;
    } catch {
      error.value = 'Error al cargar los perfiles. Intenta de nuevo.';
    }

    loading.value = false;
  }

  return {
    loading,
    error,
    profileA,
    profileB,
    statsA,
    statsB,
    exchange,
    load,
  };
}
