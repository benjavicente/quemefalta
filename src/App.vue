<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'

const { init } = useAuth()

onMounted(() => {
  init()
})
</script>

<template>
  <RouterView />
</template>
