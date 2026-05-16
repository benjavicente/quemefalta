<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { Analytics } from '@vercel/analytics/vue';
import { setupVersionCheck } from '@/lib/versionCheck';
import UpdateToast from '@/components/UpdateToast.vue';
import VersionDebugPanel from '@/components/VersionDebugPanel.vue';

const { init } = useAuth();

// En mock mode (npm run dev:mock) no montamos Analytics: el dev local no debe
// inyectar el script de Vercel ni emitir page views al dashboard de prod.
const analyticsEnabled = import.meta.env.VITE_MOCK !== 'true';

onMounted(() => {
  init();
  setupVersionCheck();
});
</script>

<template>
  <RouterView />
  <UpdateToast />
  <VersionDebugPanel />
  <Analytics v-if="analyticsEnabled" />
</template>
