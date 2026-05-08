import { ref, computed, readonly } from 'vue';
import type { User } from '@supabase/supabase-js';
import { supabase, ensureFreshSession } from '@/lib/supabase';
import type { Profile } from '@/types/app';

// State global compartido entre todos los componentes que usen useAuth
const user = ref<User | null>(null);
const profile = ref<Profile | null>(null);
const loading = ref(true);
const initialized = ref(false);
let initPromise: Promise<void> | null = null;

// Cargar profile desde la DB
async function loadProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
    .abortSignal(AbortSignal.timeout(8000));

  if (error) {
    console.error('Error loading profile:', error);
    profile.value = null;
    return;
  }

  profile.value = data as Profile;
}

// Inicializar la sesión al arrancar la app
function init(): Promise<void> {
  if (initPromise) return initPromise;

  // Timeout de seguridad: si init tarda mas de 5s, continuar sin sesion
  initPromise = Promise.race([_doInit(), new Promise<void>((r) => setTimeout(r, 5000))]);
  return initPromise;
}

async function _doInit() {
  if (initialized.value) return;
  initialized.value = true;
  loading.value = true;

  // Recuperar sesión existente del localStorage
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    user.value = session.user;
    await loadProfile(session.user.id);
  }

  loading.value = false;

  // Escuchar cambios FUTUROS en la sesión (login, logout, refresh token)
  // Ignorar INITIAL_SESSION porque ya lo manejamos arriba
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION') return;

    user.value = session?.user ?? null;

    if (session?.user) {
      await loadProfile(session.user.id);
    } else {
      profile.value = null;
    }
  });

  // visibilitychange y refresh periodico estan centralizados en supabase.ts
}

// Login con Google
async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

// Logout — nunca debe colgar la UI
async function signOut() {
  try {
    await Promise.race([supabase.auth.signOut(), new Promise((r) => setTimeout(r, 3000))]);
  } catch {
    // Ignorar errores — limpiar estado local de todas formas
  }
  user.value = null;
  profile.value = null;
}

// Actualizar profile (usado en onboarding)
async function updateProfile(updates: Partial<Profile>) {
  if (!user.value) throw new Error('Not authenticated');
  await ensureFreshSession();

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.value.id)
    .select()
    .single();

  if (error) throw error;

  profile.value = data as Profile;
  return data;
}

// Composable que expone todo lo anterior
export function useAuth() {
  return {
    user: readonly(user),
    profile: readonly(profile),
    loading: readonly(loading),
    isAuthenticated: computed(() => !!user.value),
    needsOnboarding: computed(() => !!user.value && !!profile.value && !profile.value.onboarded),
    init,
    signInWithGoogle,
    signOut,
    updateProfile,
  };
}
