<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue';
import { useUndo } from '@/composables/useUndo';

const props = defineProps<{
  /** Legacy: override message from parent */
  message?: string;
  /** Legacy: override visibility from parent */
  visible?: boolean;
  duration?: number;
}>();

const emit = defineEmits<{
  undo: [];
  dismiss: [];
}>();

const { currentUndo, executeUndo, dismiss } = useUndo();

// Combine legacy props with undo composable
const isVisible = computed(() => props.visible || !!currentUndo.value);
const displayMessage = computed(() => {
  if (props.visible && props.message) return props.message;
  return currentUndo.value?.description ?? '';
});
const hasUndoAction = computed(() => !!currentUndo.value || false);

let legacyTimer: ReturnType<typeof setTimeout> | null = null;

function clearLegacyTimer() {
  if (legacyTimer) {
    clearTimeout(legacyTimer);
    legacyTimer = null;
  }
}

// Legacy timer for parent-controlled toasts
watch(
  () => props.visible,
  (v) => {
    clearLegacyTimer();
    if (v && !currentUndo.value) {
      legacyTimer = setTimeout(() => emit('dismiss'), props.duration ?? 3000);
    }
  },
);

function handleUndo() {
  if (currentUndo.value) {
    executeUndo();
  } else {
    emit('undo');
  }
}

function handleDismiss() {
  if (currentUndo.value) {
    dismiss();
  }
  emit('dismiss');
}

onUnmounted(clearLegacyTimer);
</script>

<template>
  <Transition name="toast">
    <div v-if="isVisible" class="toast" @click="handleDismiss">
      <span class="toast-msg">{{ displayMessage }}</span>
      <button v-if="hasUndoAction" class="toast-undo" @click.stop="handleUndo">DESHACER</button>
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
  cursor: pointer;
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
