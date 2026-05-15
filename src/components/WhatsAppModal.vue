<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { track } from '@/lib/analytics';

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const { profile, updateProfile } = useAuth();

const input = ref('');
const saving = ref(false);
const error = ref('');

onMounted(() => {
  input.value = profile.value?.phone ?? '';
});

function normalize(raw: string): string {
  // Mantener el "+" inicial si está, dígitos y espacios. Eliminar otros símbolos.
  const trimmed = raw.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  const digits = trimmed.replace(/[^\d]/g, '');
  return plus + digits;
}

function isValid(value: string): boolean {
  if (value === '') return true;
  const norm = normalize(value);
  const digits = norm.replace(/^\+/, '');
  return digits.length >= 8 && digits.length <= 15;
}

async function save() {
  if (saving.value) return;
  const cleaned = input.value.trim() === '' ? null : normalize(input.value);
  if (cleaned !== null && !isValid(cleaned)) {
    error.value = 'Ingresa un número válido (entre 8 y 15 dígitos, opcionalmente con +).';
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    await updateProfile({ phone: cleaned });
    track('save_phone', { cleared: cleaned === null });
    emit('saved');
    emit('close');
  } catch (e) {
    console.error('[WhatsAppModal] save error:', e);
    error.value = 'No se pudo guardar. Intenta de nuevo.';
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (saving.value) return;
  input.value = '';
  saving.value = true;
  error.value = '';
  try {
    await updateProfile({ phone: null });
    track('save_phone', { cleared: true });
    emit('saved');
    emit('close');
  } catch (e) {
    console.error('[WhatsAppModal] remove error:', e);
    error.value = 'No se pudo quitar. Intenta de nuevo.';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="modal-bg" @click="emit('close')" @keydown.escape="emit('close')">
    <div class="modal" @click.stop>
      <div class="modal-title">MI WHATSAPP</div>
      <p class="modal-desc">
        Otros usuarios autenticados podrán ver este número en tu perfil y en la vista de intercambio
        para escribirte. Anónimos no lo ven.
      </p>

      <label class="wa-label" for="wa-input">Número con código de país</label>
      <input
        id="wa-input"
        v-model="input"
        type="tel"
        class="wa-input"
        placeholder="+56 9 1234 5678"
        autocomplete="tel"
        inputmode="tel"
        :disabled="saving"
        @keydown.enter="save"
      />

      <div v-if="error" class="wa-error" role="alert">{{ error }}</div>

      <div class="wa-actions">
        <button
          v-if="profile?.phone"
          type="button"
          class="wa-btn wa-btn-ghost"
          :disabled="saving"
          @click="remove"
        >
          Quitar
        </button>
        <button type="button" class="wa-btn wa-btn-ghost" :disabled="saving" @click="emit('close')">
          Cancelar
        </button>
        <button type="button" class="wa-btn wa-btn-primary" :disabled="saving" @click="save">
          {{ saving ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-bg {
  position: fixed;
  inset: 0;
  background: rgba(12, 18, 32, 0.75);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 100;
  animation: fadeIn 0.15s ease-out;
}
.modal {
  background: var(--paper);
  color: var(--ink);
  width: 100%;
  max-width: 420px;
  border-radius: 14px;
  padding: 26px 22px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
  animation: popIn 0.2s ease-out;
  font-family: var(--body);
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
  margin-bottom: 10px;
  color: var(--pitch);
}
.modal-desc {
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink-soft);
  margin: 0 0 16px;
}
.wa-label {
  display: block;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--ink-soft);
  text-transform: uppercase;
  margin-bottom: 6px;
}
.wa-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--paper-deep);
  border-radius: 8px;
  font-family: var(--mono);
  font-size: 15px;
  color: var(--pitch);
  background: #fff;
  outline: none;
}
.wa-input:focus {
  border-color: var(--gold);
}
.wa-error {
  margin-top: 8px;
  color: var(--coral);
  font-size: 12px;
}
.wa-actions {
  margin-top: 18px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.wa-btn {
  padding: 10px 14px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
}
.wa-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.wa-btn-primary {
  background: var(--pitch);
  color: var(--paper);
}
.wa-btn-primary:hover:not(:disabled) {
  background: var(--pitch-deep);
}
.wa-btn-ghost {
  background: transparent;
  border-color: var(--paper-deep);
  color: var(--ink);
}
.wa-btn-ghost:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.04);
}
</style>
