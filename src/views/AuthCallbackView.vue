<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const router = useRouter()
const status = ref('Procesando login...')
const debugInfo = ref('')

onMounted(async () => {
  console.log('[AuthCallback] URL completa:', window.location.href)
  console.log('[AuthCallback] hash:', window.location.hash)
  console.log('[AuthCallback] search:', window.location.search)

  // Esperar un momento a que detectSessionInUrl haga su trabajo
  await new Promise((r) => setTimeout(r, 500))

  // Si hay un error explícito en la URL, mostrarlo
  const urlParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.substring(1))
  const errorParam = urlParams.get('error') || hashParams.get('error')
  const errorDesc = urlParams.get('error_description') || hashParams.get('error_description')

  if (errorParam) {
    console.error('[AuthCallback] Error en URL:', errorParam, errorDesc)
    status.value = `Error: ${errorDesc || errorParam}`
    debugInfo.value = `Detalles: ${errorParam}`
    setTimeout(() => router.replace('/auth'), 4000)
    return
  }

  // Verificar sesión
  const { data: { session }, error } = await supabase.auth.getSession()

  console.log('[AuthCallback] Session:', session)
  console.log('[AuthCallback] Session error:', error)

  if (error) {
    console.error('[AuthCallback] getSession error:', error)
    status.value = `Error de Supabase: ${error.message}`
    setTimeout(() => router.replace('/auth'), 4000)
    return
  }

  if (!session) {
    // Intentar exchange manual si hay un code en la URL
    const code = urlParams.get('code')
    if (code) {
      console.log('[AuthCallback] Intentando exchange manual con code')
      const { data, error: exchErr } = await supabase.auth.exchangeCodeForSession(code)
      console.log('[AuthCallback] Exchange result:', data, exchErr)
      if (exchErr || !data.session) {
        status.value = `Error en exchange: ${exchErr?.message ?? 'sin sesión'}`
        setTimeout(() => router.replace('/auth'), 4000)
        return
      }
    } else {
      status.value = 'No se encontró sesión ni code. Volviendo al login...'
      debugInfo.value = `URL: ${window.location.href}`
      setTimeout(() => router.replace('/auth'), 4000)
      return
    }
  }

  // Verificar si necesita onboarding
  const userId = (await supabase.auth.getUser()).data.user?.id
  if (!userId) {
    status.value = 'No se pudo obtener el user. Volviendo al login...'
    setTimeout(() => router.replace('/auth'), 3000)
    return
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded')
    .eq('id', userId)
    .single()

  console.log('[AuthCallback] Profile:', profile)

  if (profile?.onboarded) {
    router.replace('/album')
  } else {
    router.replace('/onboarding')
  }
})
</script>

<template>
  <div class="callback">
    <div class="mark">★</div>
    <div class="status">{{ status }}</div>
    <div v-if="debugInfo" class="debug">{{ debugInfo }}</div>
  </div>
</template>

<style scoped>
.callback {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  color: var(--chalk-dim);
  font-family: var(--mono);
  font-size: 13px;
  letter-spacing: 0.05em;
  text-align: center;
  padding: 20px;
}
.mark {
  font-size: 48px;
  color: var(--gold);
  animation: spin 1.5s linear infinite;
}
.debug {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  max-width: 500px;
  word-break: break-all;
}
@keyframes spin {
  from { transform: rotate(0); }
  to { transform: rotate(360deg); }
}
</style>
