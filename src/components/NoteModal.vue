<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  stickerNumber: number;
  initialValue: string;
}>();

const emit = defineEmits<{
  save: [text: string];
  close: [];
}>();

const text = ref(props.initialValue);

watch(
  () => props.initialValue,
  (v) => {
    text.value = v;
  },
);

function handleSave() {
  emit('save', text.value);
}
</script>

<template>
  <div class="modal-bg" @click="emit('close')">
    <div class="modal" @click.stop>
      <div class="modal-title">Nota — lámina #{{ stickerNumber }}</div>
      <textarea
        v-model="text"
        class="modal-text"
        placeholder="Ej: prometida a Pedro / canjeable solo por delantero..."
        rows="4"
        autofocus
      />
      <div class="modal-actions">
        <button class="btn-ghost" @click="emit('close')">Cancelar</button>
        <button class="btn-solid" @click="handleSave">Guardar</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-bg {
  position: fixed;
  inset: 0;
  background: rgba(6, 35, 24, 0.7);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
  animation: fadeIn 0.15s ease-out;
}
.modal {
  background: var(--paper);
  color: var(--pitch-deep);
  width: 100%;
  max-width: 380px;
  border-radius: 4px;
  padding: 22px;
  box-shadow: var(--shadow);
  animation: popIn 0.2s ease-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes popIn {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.modal-title {
  font-family: var(--display);
  font-size: 22px;
  letter-spacing: 0.04em;
  margin-bottom: 14px;
  color: var(--pitch);
}
.modal-text {
  width: 100%;
  padding: 12px;
  font-family: inherit;
  font-size: 14px;
  background: rgba(10, 61, 46, 0.04);
  border: 1px solid rgba(10, 61, 46, 0.15);
  border-radius: 2px;
  resize: vertical;
  outline: none;
  color: var(--pitch-deep);
}
.modal-text:focus {
  border-color: var(--pitch);
}
.modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  justify-content: flex-end;
}
.btn-ghost,
.btn-solid {
  padding: 10px 18px;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.08em;
  border-radius: 2px;
  border: none;
  cursor: pointer;
  font-family: inherit;
}
.btn-ghost {
  background: none;
  color: rgba(10, 61, 46, 0.6);
}
.btn-ghost:hover {
  color: var(--pitch);
}
.btn-solid {
  background: var(--pitch);
  color: var(--chalk);
}
.btn-solid:hover {
  background: var(--pitch-deep);
}
</style>
