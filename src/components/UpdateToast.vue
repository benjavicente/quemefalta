<script setup lang="ts">
import { updateAvailable, applyUpdate, dismissUpdate } from '@/lib/pwaUpdate';
</script>

<template>
  <Transition name="upd-toast">
    <div v-if="updateAvailable" class="upd-toast" role="status" aria-live="polite">
      <span class="upd-msg">Hay una versión nueva</span>
      <button class="upd-btn" @click="applyUpdate">ACTUALIZAR</button>
      <button class="upd-x" aria-label="Cerrar" @click="dismissUpdate">×</button>
    </div>
  </Transition>
</template>

<style scoped>
.upd-toast {
  position: fixed;
  bottom: calc(24px + env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  background: var(--paper);
  color: var(--ink);
  padding: 12px 14px 12px 16px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  z-index: 250;
  max-width: 400px;
  width: calc(100% - 40px);
}
.upd-msg {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
}
.upd-btn {
  background: none;
  border: none;
  color: var(--mint);
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.08em;
  cursor: pointer;
  font-family: var(--mono);
  padding: 4px 8px;
  flex-shrink: 0;
}
.upd-btn:hover {
  opacity: 0.8;
}
.upd-x {
  background: none;
  border: none;
  color: var(--ink);
  opacity: 0.6;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 6px;
  flex-shrink: 0;
}
.upd-x:hover {
  opacity: 1;
}
.upd-toast-enter-active {
  transition: all 0.2s ease-out;
}
.upd-toast-leave-active {
  transition: all 0.15s ease-in;
}
.upd-toast-enter-from,
.upd-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
</style>
