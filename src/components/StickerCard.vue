<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { StickerState } from '@/composables/useStickers';
import ballImg from '@/assets/ball-stadium.png';

const props = defineProps<{
  number: number;
  code: string;
  state: StickerState;
  animDelay?: number;
}>();

const emit = defineEmits<{
  cycle: [];
  openDetail: [];
}>();

const owned = computed(() => props.state.owned);
const dupes = computed(() => props.state.dupes);

// Micro-animation: pop when becoming owned
const justMarked = ref(false);
const badgeBounce = ref(false);
let prevOwned = props.state.owned;
let prevDupes = props.state.dupes;

watch(
  () => props.state,
  (newState) => {
    // Owned transition: not-owned -> owned
    if (newState.owned && !prevOwned) {
      const delay = props.animDelay ?? 0;
      setTimeout(() => {
        justMarked.value = true;
        setTimeout(() => {
          justMarked.value = false;
        }, 350);
      }, delay);
    }
    // Badge bounce: dupes changed
    if (newState.owned && newState.dupes !== prevDupes && prevOwned) {
      badgeBounce.value = true;
      setTimeout(() => {
        badgeBounce.value = false;
      }, 300);
    }
    prevOwned = newState.owned;
    prevDupes = newState.dupes;
  },
  { deep: true },
);
const hasNote = computed(() => !!props.state.note);

// Long press detection + isPressed guard for paint-mode compatibility
let pressTimer: ReturnType<typeof setTimeout> | null = null;
const didLongPress = ref(false);
const isPressed = ref(false);

function onPointerDown() {
  isPressed.value = true;
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
  // Only cycle if this card initiated the press (prevents ghost cycles during swipe paint)
  if (isPressed.value && !didLongPress.value) {
    emit('cycle');
  }
  isPressed.value = false;
}

function onPointerCancel() {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
  isPressed.value = false;
}
</script>

<template>
  <div class="stk-wrap">
    <div
      class="stk"
      :class="{ 'stk-owned': owned, 'stk-dupe': dupes > 0, 'stk-just-marked': justMarked }"
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
        <div class="stk-code-overlay" :class="{ 'stk-code-overlay-owned': owned }">{{ code }}</div>
      </div>
      <!-- Footer band -->
      <div class="stk-footer" :class="{ 'stk-footer-owned': owned }">
        <span class="stk-num" :class="{ 'stk-num-owned': owned }">{{ code }}</span>
      </div>
      <!-- Badges -->
      <div v-if="dupes > 0" class="stk-badge" :class="{ 'stk-badge-bounce': badgeBounce }">
        ×{{ dupes + 1 }}
      </div>
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
  background: linear-gradient(160deg, #fcd34d 0%, var(--gold) 45%, var(--gold-deep) 100%);
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
.stk-code-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--display);
  font-size: clamp(14px, 3vw, 18px);
  letter-spacing: 0.06em;
  color: rgba(246, 241, 225, 0.5);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
  pointer-events: none;
  z-index: 1;
  white-space: nowrap;
}
.stk-code-overlay-owned {
  color: var(--pitch-deep);
  text-shadow: none;
  opacity: 0.5;
}
.stk-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: filter 0.2s ease;
  /* iOS: evita preview/callout al mantener pulsada la foto (Safari lo trata como imagen) */
  -webkit-touch-callout: none;
  -webkit-user-drag: none;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
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
  justify-content: center;
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
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0.04em;
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

/* Micro-animations */
@keyframes stkPop {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(212, 160, 23, 0);
  }
  40% {
    transform: scale(1.12);
    box-shadow: 0 0 16px 4px rgba(212, 160, 23, 0.35);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 8px 24px rgba(232, 179, 65, 0.18);
  }
}
.stk-just-marked {
  animation: stkPop 0.25s ease-out;
}
.stk-just-marked:active {
  /* Don't shrink during pop animation */
  transform: none;
}

@keyframes badgeBounce {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.25);
  }
  100% {
    transform: scale(1);
  }
}
.stk-badge-bounce {
  animation: badgeBounce 0.2s ease-out;
}
</style>
