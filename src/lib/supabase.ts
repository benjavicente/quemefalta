import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Check your .env.local file in the project root.'
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,       // guarda la sesión en localStorage
    autoRefreshToken: true,     // refresca el JWT automáticamente
    detectSessionInUrl: true,   // necesario para callback OAuth
  },
})
