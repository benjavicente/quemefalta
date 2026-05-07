<script setup lang="ts">
import { computed } from 'vue';
import type { StickerState } from '@/composables/useStickers';

const props = defineProps<{
  number: number;
  code: string;
  state: StickerState;
}>();

const emit = defineEmits<{
  cycle: [];
  adjustDupes: [delta: number];
  openNote: [];
}>();

const owned = computed(() => props.state.owned);
const dupes = computed(() => props.state.dupes);
const hasNote = computed(() => !!props.state.note);
</script>

<template>
  <div class="stk-wrap">
    <div class="stk" :class="{ 'stk-owned': owned, 'stk-dupe': dupes > 0 }">
      <button class="stk-main" @click="emit('cycle')">
        <div class="stk-code">{{ code }}</div>
        <div class="stk-num">{{ number }}</div>
        <div v-if="dupes > 0" class="stk-badge">×{{ dupes + 1 }}</div>
        <div v-if="hasNote" class="stk-note-dot" />
      </button>
      <div v-if="owned" class="stk-controls">
        <button
          class="stk-mini"
          :aria-label="`Quitar repetida lámina ${number}`"
          @click.stop="emit('adjustDupes', -1)"
        >
          −
        </button>
        <span class="stk-mini-count">{{ dupes }}</span>
        <button
          class="stk-mini"
          :aria-label="`Agregar repetida lámina ${number}`"
          @click.stop="emit('adjustDupes', 1)"
        >
          +
        </button>
      </div>
    </div>
    <button class="stk-note-btn" @click="emit('openNote')">
      {{ hasNote ? '✎ nota' : '+ nota' }}
    </button>
  </div>
</template>

<style scoped>
.stk-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stk {
  position: relative;
  aspect-ratio: 3/4;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  transition: all 0.2s;
}
.stk-main {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px;
  border-radius: 4px;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  font-family: inherit;
}
.stk-code {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.05em;
  color: var(--chalk-dim);
  opacity: 0.6;
}
.stk-num {
  font-family: var(--display);
  font-size: 26px;
  line-height: 1;
  color: var(--chalk-dim);
}
.stk-owned {
  background: linear-gradient(135deg, var(--gold) 0%, var(--gold-deep) 100%);
  border: 1px solid var(--gold-deep);
  border-style: solid;
  box-shadow: 0 4px 16px rgba(245, 197, 66, 0.25);
}
.stk-owned .stk-num,
.stk-owned .stk-code {
  color: var(--pitch-deep);
  opacity: 1;
}
.stk-owned .stk-code {
  font-weight: 700;
}
.stk-dupe {
  background: linear-gradient(135deg, #e8b94f 0%, #a07d18 100%);
}
.stk-dupe::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    45deg,
    transparent 0 6px,
    rgba(0, 0, 0, 0.06) 6px 7px
  );
  pointer-events: none;
  border-radius: 4px;
}
.stk-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: var(--red);
  color: white;
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 100px;
  z-index: 2;
}
.stk-note-dot {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 6px;
  height: 6px;
  background: var(--pitch);
  border-radius: 50%;
}
.stk-controls {
  position: absolute;
  bottom: 4px;
  left: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  border-radius: 100px;
  padding: 2px;
  z-index: 3;
}
.stk-mini {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: white;
  border-radius: 50%;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
}
.stk-mini:active {
  background: rgba(255, 255, 255, 0.2);
}
.stk-mini-count {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  color: white;
}
.stk-note-btn {
  font-family: var(--mono);
  font-size: 9px;
  color: var(--chalk-dim);
  padding: 2px;
  text-align: center;
  opacity: 0.6;
  background: none;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}
.stk-note-btn:hover {
  opacity: 1;
  color: var(--gold);
}
</style>
