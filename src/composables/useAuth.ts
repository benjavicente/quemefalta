import { ref, computed, readonly } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/app'

// State global compartido entre todos los componentes que usen useAuth
const user = ref<User | null>(null)
const profile = ref<Profile | null>(null)
const loading = ref(true)
const initialized = ref(false)

// Cargar profile desde la DB
async function loadProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error loading profile:', error)
    profile.value = null
    return
  }

  profile.value = data as Profile
}

// Inicializar la sesión al arrancar la app
async function init() {
  if (initialized.value) return
  initialized.value = true

  loading.value = true

  // Recuperar sesión existente del localStorage
  const { data: { session } } = await supabase.auth.getSession()

  if (session?.user) {
    user.value = session.user
    await loadProfile(session.user.id)
  }

  // Escuchar cambios en la sesión (login, logout, refresh token)
  supabase.auth.onAuthStateChange(async (event, session) => {
    user.value = session?.user ?? null

    if (session?.user) {
      await loadProfile(session.user.id)
    } else {
      profile.value = null
    }
  })

  loading.value = false
}

// Login con Google
async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  if (error) throw error
}

// Logout
async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  user.value = null
  profile.value = null
}

// Actualizar profile (usado en onboarding)
async function updateProfile(updates: Partial<Profile>) {
  if (!user.value) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.value.id)
    .select()
    .single()

  if (error) throw error

  profile.value = data as Profile
  return data
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
  }
}
