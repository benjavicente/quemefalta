<script setup lang="ts">
defineProps<{
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <div class="cd-bg" @click="emit('cancel')" @keydown.escape="emit('cancel')">
    <div class="cd" @click.stop>
      <div class="cd-title">{{ title }}</div>
      <p class="cd-msg">{{ message }}</p>
      <div class="cd-actions">
        <button class="cd-btn cd-cancel" @click="emit('cancel')">
          {{ cancelText ?? 'Cancelar' }}
        </button>
        <button :class="['cd-btn', danger ? 'cd-danger' : 'cd-confirm']" @click="emit('confirm')">
          {{ confirmText ?? 'Confirmar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cd-bg {
  position: fixed;
  inset: 0;
  background: rgba(12, 18, 32, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 150;
  padding: 20px;
  animation: fadeIn 0.12s ease-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.cd {
  background: #141c2b;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 24px 20px;
  max-width: 360px;
  width: 100%;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
  color: var(--chalk);
}
.cd-title {
  font-family: var(--display);
  font-size: 22px;
  letter-spacing: 0.04em;
  margin-bottom: 8px;
}
.cd-msg {
  font-size: 13px;
  line-height: 1.5;
  color: rgba(246, 241, 225, 0.7);
  margin: 0 0 20px;
}
.cd-actions {
  display: flex;
  gap: 8px;
}
.cd-btn {
  flex: 1;
  padding: 12px 0;
  border-radius: 8px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  border: none;
  transition: all 0.15s;
}
.cd-cancel {
  background: transparent;
  border: 1px solid var(--line);
  color: var(--chalk);
}
.cd-cancel:hover {
  background: rgba(246, 241, 225, 0.05);
}
.cd-confirm {
  background: var(--gold);
  color: var(--pitch-deep);
}
.cd-confirm:hover {
  background: var(--gold-deep);
}
.cd-danger {
  background: var(--coral);
  color: white;
}
.cd-danger:hover {
  opacity: 0.9;
}
</style>
