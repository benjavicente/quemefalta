<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { applyUpdate, updateAvailable } from './update';

const dismissed = ref(false);
const showUpdateBanner = computed(() => updateAvailable.value && !dismissed.value);

watch(updateAvailable, (available) => {
  if (!available) dismissed.value = false;
});

function dismissUpdateBanner() {
  dismissed.value = true;
}
</script>

<template>
  <Transition name="update-banner">
    <section v-if="showUpdateBanner" class="update-banner" role="status" aria-live="polite">
      <p class="update-banner-title">Actualización disponible</p>
      <button
        type="button"
        class="update-banner-btn update-banner-secondary"
        @click="dismissUpdateBanner"
      >
        Ahora no
      </button>
      <button type="button" class="update-banner-btn update-banner-primary" @click="applyUpdate">
        Actualizar
      </button>
    </section>
  </Transition>
</template>

<style scoped>
.update-banner {
  position: fixed;
  right: calc(18px + env(safe-area-inset-right, 0px));
  bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  left: calc(18px + env(safe-area-inset-left, 0px));
  z-index: 260;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
  width: min(360px, calc(100% - 36px));
  margin: 0 auto;
  padding: 14px;
  color: var(--ink);
  background: var(--paper);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  box-shadow: var(--shadow);
}

.update-banner-title {
  grid-column: 1 / -1;
  margin: 0;
  font-family: var(--display);
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  color: var(--ink);
}

.update-banner-btn {
  min-width: 0;
  min-height: 42px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  border: 0;
  transition:
    background 0.15s ease,
    opacity 0.15s ease,
    transform 0.15s ease;
}

.update-banner-btn:hover {
  transform: translateY(-1px);
}

.update-banner-secondary {
  color: var(--ink);
  background: transparent;
  border: 1px solid rgba(14, 18, 24, 0.18);
}

.update-banner-primary {
  color: var(--pitch-deep);
  background: var(--gold);
}

.update-banner-primary:hover {
  background: var(--gold-deep);
}

.update-banner-enter-active {
  transition: all 0.2s ease-out;
}

.update-banner-leave-active {
  transition: all 0.15s ease-in;
}

.update-banner-enter-from,
.update-banner-leave-to {
  opacity: 0;
  transform: translateY(16px);
}
</style>
