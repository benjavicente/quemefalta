<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { StickerState } from '@/composables/useStickers';
import ballImg from '@/assets/ball-stadium.png';
import crestImg from '@/assets/ball-crest.jpg';
import squadImg from '@/assets/field-squad.jpg';
import { FWC_HORIZONTAL_IMG, FWC_VERTICAL_IMG, FWC_IMG_OVERRIDES } from '@/lib/fwcConfig';

const props = defineProps<{
  number: number;
  code: string;
  state: StickerState;
  variant?: 'normal' | 'crest' | 'squad' | 'fwc-h' | 'fwc-v';
  animDelay?: number;
  /** Estado de sync: 'pending' (reintentando), 'failed' (no se guardo), o null si OK. */
  syncStatus?: 'pending' | 'failed' | null;
}>();

const emit = defineEmits<{
  cycle: [];
  decrement: [];
  openDetail: [];
}>();

const owned = computed(() => props.state.owned);
const dupes = computed(() => props.state.dupes);
const isCrest = computed(() => props.variant === 'crest');
const isSquad = computed(() => props.variant === 'squad');
const isFwcH = computed(() => props.variant === 'fwc-h');
const isFwcV = computed(() => props.variant === 'fwc-v');
const isFwc = computed(() => isFwcH.value || isFwcV.value);
const fwcIndex = computed(() => {
  if (!isFwc.value) return 0;
  const m = props.code.match(/\d+$/);
  return m ? parseInt(m[0]) : 0;
});
const cardImg = computed(() => {
  if (isFwc.value) {
    const override = FWC_IMG_OVERRIDES[fwcIndex.value];
    if (override) return override;
    return isFwcH.value ? FWC_HORIZONTAL_IMG : FWC_VERTICAL_IMG;
  }
  if (isCrest.value) return crestImg;
  if (isSquad.value) return squadImg;
  return ballImg;
});

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
      :class="{
        'stk-owned': owned,
        'stk-dupe': dupes > 0,
        'stk-just-marked': justMarked,
        'stk-crest': isCrest,
        'stk-squad': isSquad,
        'stk-fwc-h': isFwcH,
        'stk-fwc-v': isFwcV,
      }"
      @pointerdown.prevent="onPointerDown"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @pointerleave="onPointerCancel"
      @contextmenu.prevent
    >
      <!-- Variant label -->
      <div v-if="isCrest" class="stk-variant-label stk-variant-crest">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
        </svg>
        ESCUDO
      </div>
      <div v-if="isSquad" class="stk-variant-label stk-variant-squad">SELECCIÓN</div>
      <!-- Art well -->
      <div class="stk-art" :class="{ 'stk-art-owned': owned }">
        <img
          :src="cardImg"
          alt=""
          class="stk-img"
          :class="{ 'stk-img-dim': !owned }"
          draggable="false"
          loading="lazy"
        />
        <div v-if="!owned" class="stk-img-veil" />
        <div class="stk-code-overlay" :class="{ 'stk-code-overlay-owned': owned }">{{ code }}</div>
      </div>
      <!-- Footer band -->
      <div class="stk-footer" :class="{ 'stk-footer-owned': owned }">
        <span class="stk-num" :class="{ 'stk-num-owned': owned }">{{ code }}</span>
      </div>
      <!-- Owned check (not color-only) -->
      <div v-if="owned && dupes === 0" class="stk-check">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0a3d2e"
          stroke-width="3"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <!-- Badges -->
      <div v-if="dupes > 0" class="stk-badge" :class="{ 'stk-badge-bounce': badgeBounce }">
        +{{ dupes }}
      </div>
      <div v-if="hasNote" class="stk-note-dot" />
      <!-- Sync status: orange dot = pendiente de guardar, red = fallo definitivo -->
      <div
        v-if="syncStatus"
        class="stk-sync-dot"
        :class="syncStatus === 'failed' ? 'stk-sync-failed' : 'stk-sync-pending'"
        :title="syncStatus === 'failed' ? 'No se pudo guardar' : 'Guardando...'"
        :aria-label="syncStatus === 'failed' ? 'No se pudo guardar' : 'Guardando'"
      />
    </div>
    <button
      v-if="owned"
      class="stk-minus"
      aria-label="Quitar una copia"
      @pointerdown.stop.prevent
      @pointerup.stop="emit('decrement')"
      @click.stop.prevent
    >
      −
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

/* Owned check mark */
.stk-check {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 18px;
  height: 18px;
  background: var(--gold);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  z-index: 2;
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
.stk-sync-dot {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  z-index: 3;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.4);
}
.stk-sync-pending {
  background: var(--mint);
  animation: stk-sync-pulse 0.7s ease-in-out infinite;
}
.stk-sync-failed {
  background: #e25a3a;
}
@keyframes stk-sync-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

/* Variant: Crest (sticker 1) */
.stk-crest {
  border: 1.5px solid var(--gold-deep);
  box-shadow: 0 0 0 1px rgba(240, 180, 41, 0.15);
}
.stk-crest.stk-owned {
  box-shadow:
    0 0 12px rgba(240, 180, 41, 0.25),
    0 8px 24px rgba(232, 179, 65, 0.18);
}

/* Variant: Squad photo (sticker 13) — wider aspect */
.stk-squad {
  aspect-ratio: 2 / 1.2;
}

/* Variant: FWC horizontal — landscape, aspect controlled by grid span */
.stk-fwc-h {
  aspect-ratio: 2 / 1.2;
}

/* Variant labels */
.stk-variant-label {
  position: absolute;
  top: 4px;
  left: 4px;
  font-family: var(--mono);
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 2px 5px;
  border-radius: 3px;
  z-index: 3;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 3px;
}
.stk-variant-crest {
  background: rgba(240, 180, 41, 0.25);
  color: var(--gold);
}
.stk-crest.stk-owned .stk-variant-crest {
  background: rgba(10, 61, 46, 0.4);
  color: var(--pitch-deep);
}
.stk-variant-squad {
  background: rgba(77, 208, 161, 0.2);
  color: var(--mint);
}
.stk-squad.stk-owned .stk-variant-squad {
  background: rgba(10, 61, 46, 0.4);
  color: var(--pitch-deep);
}

/* Minus button below card */
.stk-minus {
  width: 100%;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: rgba(246, 241, 225, 0.08);
  color: rgba(246, 241, 225, 0.45);
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  touch-action: manipulation;
}
.stk-minus:hover {
  background: rgba(239, 83, 80, 0.15);
  color: var(--coral);
}
.stk-minus:active {
  transform: scale(0.95);
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
