<script setup lang="ts">
import { ref, watch } from 'vue';
import type { StickerState } from '@/composables/useStickers';

const props = defineProps<{
  stickerNumber: number;
  code: string;
  sectionName: string;
  state: StickerState;
  hasPrev?: boolean;
  hasNext?: boolean;
}>();

const emit = defineEmits<{
  update: [state: { dupes: number; note: string }];
  remove: [];
  mark: [];
  close: [];
  prev: [];
  next: [];
}>();

const dupes = ref(props.state.dupes);
const note = ref(props.state.note);
const showNote = ref(false);
const maxNote = 80;

watch(
  () => props.state,
  (s) => {
    dupes.value = s.dupes;
    note.value = s.note;
  },
);

function save() {
  emit('update', { dupes: dupes.value, note: note.value.trim() });
}

function handleRemove() {
  emit('remove');
}

const suggestions = ['Para Pedro', 'Cambio por delantero', 'Promesa', 'Cambio solo por Messi'];
</script>

<template>
  <div class="pop-bg" @click="emit('close')" @keydown.escape="emit('close')">
    <div class="pop" @click.stop>
      <!-- Header -->
      <div class="pop-head">
        <button
          v-if="hasPrev"
          class="pop-nav pop-prev"
          aria-label="Lámina anterior"
          @click="emit('prev')"
        >
          ‹
        </button>
        <div class="pop-thumb">{{ code }}</div>
        <div class="pop-info">
          <div class="pop-label">LÁMINA</div>
          <div class="pop-title">{{ code }} · {{ sectionName }}</div>
        </div>
        <button
          v-if="hasNext"
          class="pop-nav pop-next"
          aria-label="Lámina siguiente"
          @click="emit('next')"
        >
          ›
        </button>
        <button class="pop-close" aria-label="Cerrar" @click="emit('close')">×</button>
      </div>

      <!-- Not owned state -->
      <div v-if="!state.owned" class="unowned-state">
        <div class="unowned-msg">No tienes esta lámina</div>
        <button class="btn-mark" @click="emit('mark')">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Marcar como tenida
        </button>
      </div>

      <!-- Count stepper -->
      <template v-if="state.owned">
        <div class="step-label">CANTIDAD</div>
        <div class="step-row">
          <button class="step-btn" :disabled="dupes <= 0" @click="dupes = Math.max(0, dupes - 1)">
            −
          </button>
          <div class="step-center">
            <span class="step-num">{{ dupes + 1 }}</span>
            <span class="step-total">TOTAL</span>
          </div>
          <button class="step-btn" @click="dupes++">+</button>
        </div>

        <!-- Note row -->
        <button v-if="!showNote" class="note-row" @click="showNote = true">
          <div class="note-icon">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </div>
          <div class="note-content">
            <div class="note-text">{{ note || 'Agregar nota' }}</div>
            <div class="note-hint">Toca para {{ note ? 'editar' : 'agregar' }} nota</div>
          </div>
          <div class="note-arrow">›</div>
        </button>

        <!-- Note editor (inline) -->
        <div v-if="showNote" class="note-editor">
          <div class="note-editor-label">NOTA</div>
          <div class="note-textarea-wrap">
            <textarea
              v-model="note"
              class="note-textarea"
              aria-label="Nota de la lámina"
              placeholder="Ej: prometida a Pedro, canjeable solo por delantero…"
              rows="2"
              :maxlength="maxNote"
            />
            <div class="note-counter" :class="{ 'note-counter-full': note.length >= maxNote }">
              {{ note.length }}/{{ maxNote }}
            </div>
          </div>
          <div class="note-suggestions">
            <div class="note-suggestions-label">RÁPIDAS</div>
            <div class="note-chips">
              <button
                v-for="s in suggestions"
                :key="s"
                class="note-chip"
                @click="note = s.slice(0, maxNote)"
              >
                {{ s }}
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- Divider -->
      <div class="pop-divider" />

      <!-- Actions -->
      <div class="pop-actions">
        <button v-if="state.owned" class="btn-remove" @click="handleRemove">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6" />
          </svg>
          Quitar del álbum
        </button>
        <button v-if="state.owned" class="btn-save" @click="save">Guardar</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pop-bg {
  position: fixed;
  inset: 0;
  background: rgba(12, 18, 32, 0.65);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
  animation: fadeIn 0.12s ease-out;
}
.pop {
  background: #141c2b;
  border: 1px solid var(--line);
  border-radius: 12px 12px 0 0;
  padding: 20px 18px calc(28px + env(safe-area-inset-bottom, 0px));
  width: 100%;
  max-width: 480px;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.4);
  animation: slideUp 0.2s ease-out;
  color: var(--chalk);
  /* Evita que un long-press seleccione títulos/botones como texto (iOS) */
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

/* Nav arrows */
.pop-nav {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(246, 241, 225, 0.06);
  border: 1px solid var(--line);
  color: var(--chalk);
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.12s;
}
.pop-nav:hover {
  background: rgba(232, 179, 65, 0.15);
  border-color: var(--gold);
  color: var(--gold);
}

/* Header */
.pop-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.pop-thumb {
  min-width: 42px;
  height: 48px;
  border-radius: 5px;
  background: linear-gradient(160deg, #f4d57a, var(--gold) 60%, var(--gold-deep));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  color: var(--pitch-deep);
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0.02em;
  box-shadow: 0 4px 10px rgba(232, 179, 65, 0.25);
}
.pop-info {
  flex: 1;
  min-width: 0;
}
.pop-label {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--gold);
}
.pop-title {
  font-family: var(--display);
  font-size: 22px;
  line-height: 1.05;
  letter-spacing: 0.04em;
  margin-top: 2px;
}
.pop-close {
  background: transparent;
  border: none;
  color: rgba(246, 241, 225, 0.5);
  font-family: var(--mono);
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
}

/* Stepper */
.step-label {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  color: rgba(246, 241, 225, 0.5);
  margin-bottom: 6px;
}
.step-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(246, 241, 225, 0.04);
  border: 1px solid var(--line);
  margin-bottom: 12px;
}
.step-btn {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid rgba(246, 241, 225, 0.18);
  color: var(--chalk);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.step-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.step-center {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.step-num {
  font-family: var(--display);
  font-size: 44px;
  line-height: 0.9;
  color: var(--gold);
}
.step-total {
  font-family: var(--mono);
  font-size: 10px;
  color: rgba(246, 241, 225, 0.55);
  letter-spacing: 0.18em;
}

/* Note row */
.note-row {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  background: rgba(232, 179, 65, 0.08);
  border: 1px solid rgba(232, 179, 65, 0.3);
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  margin-bottom: 10px;
  text-align: left;
  font-family: inherit;
  color: inherit;
}
.note-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(232, 179, 65, 0.2);
  color: var(--gold);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.note-content {
  flex: 1;
}
.note-text {
  font-size: 12px;
  font-weight: 600;
}
.note-hint {
  font-size: 10px;
  color: rgba(246, 241, 225, 0.55);
  margin-top: 2px;
}
.note-arrow {
  color: rgba(246, 241, 225, 0.4);
  font-size: 14px;
}

/* Note editor */
.note-editor {
  margin-bottom: 10px;
}
.note-editor-label {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  color: rgba(246, 241, 225, 0.5);
  margin-bottom: 6px;
}
.note-textarea-wrap {
  position: relative;
  margin-bottom: 12px;
}
.note-textarea {
  width: 100%;
  min-height: 70px;
  padding: 12px 12px 24px;
  background: rgba(246, 241, 225, 0.04);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--chalk);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.45;
  resize: none;
  outline: none;
  user-select: text;
  -webkit-user-select: text;
}
.note-textarea:focus {
  border-color: var(--gold);
}
.note-counter {
  position: absolute;
  right: 10px;
  bottom: 8px;
  font-family: var(--mono);
  font-size: 9px;
  color: rgba(246, 241, 225, 0.4);
  letter-spacing: 0.1em;
}
.note-counter-full {
  color: var(--coral);
}
.note-suggestions-label {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  color: rgba(246, 241, 225, 0.5);
  margin-bottom: 8px;
}
.note-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.note-chip {
  padding: 6px 11px;
  border-radius: 100px;
  font-size: 11px;
  font-weight: 600;
  background: transparent;
  color: var(--chalk);
  border: 1px solid var(--line);
  cursor: pointer;
  font-family: inherit;
}
.note-chip:hover {
  border-color: var(--gold);
  color: var(--gold);
}

/* Divider + actions */
.pop-divider {
  height: 1px;
  background: var(--line);
  margin: 10px 0 12px;
}
.pop-actions {
  display: flex;
  gap: 8px;
}
.btn-remove {
  flex: 1;
  padding: 11px 0;
  background: transparent;
  border: 1px solid rgba(226, 90, 58, 0.4);
  border-radius: 8px;
  color: var(--coral);
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.btn-remove:hover {
  background: rgba(226, 90, 58, 0.08);
}
.btn-save {
  flex: 1.4;
  padding: 11px 0;
  background: var(--gold);
  border: none;
  border-radius: 8px;
  color: var(--pitch-deep);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.02em;
  cursor: pointer;
  font-family: inherit;
}
.btn-save:hover {
  background: var(--gold-deep);
}

/* Unowned state */
.unowned-state {
  text-align: center;
  padding: 16px 0 8px;
}
.unowned-msg {
  font-size: 13px;
  color: rgba(246, 241, 225, 0.55);
  margin-bottom: 14px;
}
.btn-mark {
  width: 100%;
  padding: 14px 0;
  background: var(--gold);
  color: var(--pitch-deep);
  border: none;
  border-radius: 8px;
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.02em;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.btn-mark:hover {
  background: var(--gold-deep);
}

@media (min-width: 640px) {
  .pop {
    border-radius: 12px;
    margin-bottom: 40px;
  }
  .pop-bg {
    align-items: center;
  }
}
</style>
