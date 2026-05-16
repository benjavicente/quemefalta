<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { Analytics } from '@vercel/analytics/vue';
import '@/pwa/update';
import UpdateBanner from '@/pwa/UpdateBanner.vue';

const { init } = useAuth();

// En mock mode (npm run dev:mock) no montamos Analytics: el dev local no debe
// inyectar el script de Vercel ni emitir page views al dashboard de prod.
const analyticsEnabled = import.meta.env.VITE_MOCK !== 'true';

onMounted(() => {
  init();
});
</script>

<template>
  <RouterView />
  <UpdateBanner />
  <Analytics v-if="analyticsEnabled" />
</template>
