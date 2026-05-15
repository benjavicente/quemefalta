import { ref, readonly } from 'vue';
import { supabase, withAuthRetry } from '@/lib/supabase';

export interface TradeMatch {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  owned_count: number;
  dupes_count: number;
  their_dupes_for_me: number;
  my_dupes_for_them: number;
}

const matches = ref<TradeMatch[]>([]);
const loading = ref(false);
const loaded = ref(false);
const error = ref<string | null>(null);

async function load(force = false) {
  if (loading.value) return;
  if (loaded.value && !force) return;
  loading.value = true;
  error.value = null;

  const { data, error: err } = await withAuthRetry(() => supabase.rpc('public_trade_matches'));

  if (err) {
    error.value = err.message ?? 'No se pudo cargar la lista.';
    loading.value = false;
    return;
  }

  matches.value = Array.isArray(data) ? (data as TradeMatch[]) : [];
  loaded.value = true;
  loading.value = false;
}

export function useTradeMatches() {
  return {
    matches: readonly(matches),
    loading: readonly(loading),
    loaded: readonly(loaded),
    error: readonly(error),
    load,
  };
}
