<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { Analytics } from '@vercel/analytics/vue';

const { init } = useAuth();

onMounted(() => {
  init();
});
</script>

<template>
  <Analytics />
  <RouterView />
</template>
