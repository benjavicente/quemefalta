<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { supabase, callWithTimeout, withAuthRetry } from '@/lib/supabase';

const router = useRouter();
const status = ref('Procesando login...');
const debugInfo = ref('');

onMounted(async () => {
  console.log('[AuthCallback] URL completa:', window.location.href);
  console.log('[AuthCallback] hash:', window.location.hash);
  console.log('[AuthCallback] search:', window.location.search);

  // Esperar un momento a que detectSessionInUrl haga su trabajo
  await new Promise((r) => setTimeout(r, 500));

  // Si hay un error explícito en la URL, mostrarlo
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const errorParam = urlParams.get('error') || hashParams.get('error');
  const errorDesc = urlParams.get('error_description') || hashParams.get('error_description');

  if (errorParam) {
    console.error('[AuthCallback] Error en URL:', errorParam, errorDesc);
    status.value = `Error: ${errorDesc || errorParam}`;
    debugInfo.value = `Detalles: ${errorParam}`;
    setTimeout(() => router.replace('/auth'), 4000);
    return;
  }

  // Verificar sesión — con timeout, si auth-js se cuelga no nos quedamos forever.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionResult = await callWithTimeout<any>(
    () => supabase.auth.getSession(),
    5000,
    'getSession',
  );
  if (!sessionResult) {
    status.value = 'Tiempo de espera agotado. Volviendo al login...';
    setTimeout(() => router.replace('/auth'), 3000);
    return;
  }

  const { data: sessionData, error } = sessionResult;
  const session = sessionData?.session;
  console.log('[AuthCallback] Session:', session);

  if (error) {
    console.error('[AuthCallback] getSession error:', error);
    status.value = `Error de Supabase: ${error.message}`;
    setTimeout(() => router.replace('/auth'), 4000);
    return;
  }

  if (!session) {
    // Intentar exchange manual si hay un code en la URL
    const code = urlParams.get('code');
    if (code) {
      console.log('[AuthCallback] Intentando exchange manual con code');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exchResult = await callWithTimeout<any>(
        () => supabase.auth.exchangeCodeForSession(code),
        5000,
        'exchangeCodeForSession',
      );
      if (!exchResult) {
        status.value = 'Tiempo de espera agotado en exchange. Volviendo al login...';
        setTimeout(() => router.replace('/auth'), 3000);
        return;
      }
      const { data, error: exchErr } = exchResult;
      console.log('[AuthCallback] Exchange result:', data, exchErr);
      if (exchErr || !data.session) {
        status.value = `Error en exchange: ${exchErr?.message ?? 'sin sesión'}`;
        setTimeout(() => router.replace('/auth'), 4000);
        return;
      }
    } else {
      status.value = 'No se encontró sesión ni code. Volviendo al login...';
      debugInfo.value = `URL: ${window.location.href}`;
      setTimeout(() => router.replace('/auth'), 4000);
      return;
    }
  }

  // Verificar si necesita onboarding
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userResult = await callWithTimeout<any>(() => supabase.auth.getUser(), 5000, 'getUser');
  const userId = userResult?.data.user?.id;
  if (!userId) {
    status.value = 'No se pudo obtener el user. Volviendo al login...';
    setTimeout(() => router.replace('/auth'), 3000);
    return;
  }

  const { data: profile, error: profErr } = await withAuthRetry(() =>
    supabase.from('profiles').select('onboarded').eq('id', userId).single(),
  );

  if (profErr) {
    console.error('[AuthCallback] profile load error:', profErr);
    status.value = 'Error al cargar el perfil. Volviendo al login...';
    setTimeout(() => router.replace('/auth'), 4000);
    return;
  }

  console.log('[AuthCallback] Profile:', profile);

  if ((profile as { onboarded?: boolean } | null)?.onboarded) {
    router.replace('/album');
  } else {
    router.replace('/onboarding');
  }
});
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
  from {
    transform: rotate(0);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
