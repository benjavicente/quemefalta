<script setup lang="ts">
import { watch, onUnmounted } from 'vue';

const props = defineProps<{
  message: string;
  visible: boolean;
  duration?: number;
}>();

const emit = defineEmits<{
  undo: [];
  dismiss: [];
}>();

let timer: ReturnType<typeof setTimeout> | null = null;

function startTimer() {
  clearTimer();
  timer = setTimeout(() => emit('dismiss'), props.duration ?? 3000);
}

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

watch(
  () => props.visible,
  (v) => {
    if (v) startTimer();
    else clearTimer();
  },
);

onUnmounted(clearTimer);
</script>

<template>
  <Transition name="toast">
    <div v-if="visible" class="toast">
      <span class="toast-msg">{{ message }}</span>
      <button class="toast-undo" @click="emit('undo')">DESHACER</button>
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--paper);
  color: var(--ink);
  padding: 12px 16px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  z-index: 200;
  max-width: 400px;
  width: calc(100% - 40px);
}
.toast-msg {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
}
.toast-undo {
  background: none;
  border: none;
  color: var(--coral);
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.08em;
  cursor: pointer;
  font-family: var(--mono);
  padding: 4px 8px;
  flex-shrink: 0;
}
.toast-undo:hover {
  opacity: 0.8;
}
.toast-enter-active {
  transition: all 0.2s ease-out;
}
.toast-leave-active {
  transition: all 0.15s ease-in;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
</style>
