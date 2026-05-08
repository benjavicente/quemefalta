<script setup lang="ts">
import { computed, ref } from 'vue';
import type { StickerState } from '@/composables/useStickers';
import ballImg from '@/assets/ball-stadium.png';

const props = defineProps<{
  number: number;
  code: string;
  state: StickerState;
}>();

const emit = defineEmits<{
  cycle: [];
  openDetail: [];
}>();

const owned = computed(() => props.state.owned);
const dupes = computed(() => props.state.dupes);
const hasNote = computed(() => !!props.state.note);

// Long press detection
let pressTimer: ReturnType<typeof setTimeout> | null = null;
const didLongPress = ref(false);

function onPointerDown() {
  didLongPress.value = false;
  pressTimer = setTimeout(() => {
    didLongPress.value = true;
    emit('openDetail');
  }, 400);
}

function onPointerUp() {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
  if (!didLongPress.value) {
    emit('cycle');
  }
}

function onPointerCancel() {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
}
</script>

<template>
  <div class="stk-wrap">
    <div
      class="stk"
      :class="{ 'stk-owned': owned, 'stk-dupe': dupes > 0 }"
      @pointerdown.prevent="onPointerDown"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @pointerleave="onPointerCancel"
      @contextmenu.prevent
    >
      <!-- Art well -->
      <div class="stk-art" :class="{ 'stk-art-owned': owned }">
        <img
          :src="ballImg"
          alt=""
          class="stk-img"
          :class="{ 'stk-img-dim': !owned }"
          draggable="false"
        />
        <div v-if="!owned" class="stk-img-veil" />
      </div>
      <!-- Footer band -->
      <div class="stk-footer" :class="{ 'stk-footer-owned': owned }">
        <span class="stk-code" :class="{ 'stk-code-owned': owned }">{{ code }}</span>
        <span class="stk-num" :class="{ 'stk-num-owned': owned }">{{ number }}</span>
      </div>
      <!-- Badges -->
      <div v-if="dupes > 0" class="stk-badge">×{{ dupes + 1 }}</div>
      <div v-if="hasNote" class="stk-note-dot" />
    </div>
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
  border-radius: 10px;
  overflow: hidden;
  border: 1px dashed rgba(246, 241, 225, 0.18);
  background: rgba(246, 241, 225, 0.025);
  box-shadow: inset 0 1px 0 rgba(246, 241, 225, 0.04);
  transition: transform 120ms ease;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
}
.stk:active {
  transform: scale(0.95);
}
.stk-owned {
  border: 1px solid var(--gold-deep);
  background: linear-gradient(160deg, #f4d57a 0%, var(--gold) 45%, var(--gold-deep) 100%);
  box-shadow:
    0 8px 24px rgba(232, 179, 65, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.stk-dupe::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    45deg,
    transparent 0 6px,
    rgba(0, 0, 0, 0.07) 6px 7px
  );
  pointer-events: none;
  z-index: 1;
}

/* Art well */
.stk-art {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  bottom: 32px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(246, 241, 225, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
}
.stk-art-owned {
  background: rgba(255, 255, 255, 0.55);
}
.stk-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: filter 0.2s ease;
}
.stk-img-dim {
  filter: grayscale(85%) brightness(0.42) contrast(0.95);
}
.stk-img-veil {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.35) 0%,
    rgba(0, 0, 0, 0.15) 50%,
    rgba(0, 0, 0, 0.45) 100%
  );
  pointer-events: none;
}

/* Footer band */
.stk-footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 32px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.stk-footer-owned {
  background: rgba(0, 0, 0, 0.08);
  border-top: 1px solid rgba(0, 0, 0, 0.12);
}
.stk-code {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  font-weight: 600;
  color: rgba(246, 241, 225, 0.4);
}
.stk-code-owned {
  color: var(--pitch-deep);
}
.stk-num {
  font-family: var(--display);
  font-size: 22px;
  line-height: 1;
  font-weight: 700;
  color: rgba(246, 241, 225, 0.45);
}
.stk-num-owned {
  color: var(--pitch-deep);
}

/* Badges */
.stk-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  background: var(--coral);
  color: white;
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 100px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  z-index: 2;
}
.stk-note-dot {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 7px;
  height: 7px;
  background: var(--pitch-deep);
  border-radius: 50%;
  z-index: 2;
}
</style>
