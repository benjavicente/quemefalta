<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';

const emit = defineEmits<{
  done: [];
}>();

const currentStep = ref(0);
const targetRect = ref<DOMRect | null>(null);
const tooltipStyle = ref<Record<string, string>>({});
const visible = ref(false);

interface Step {
  selector: string;
  text: string;
  position: 'bottom' | 'top';
}

const steps: Step[] = [
  {
    selector: '[data-stk]:first-child .stk',
    text: 'Toca una lamina para marcarla como tenida',
    position: 'bottom',
  },
  {
    selector: '.sect-grid',
    text: 'Arrastra el dedo para marcar varias de corrido',
    position: 'bottom',
  },
  {
    selector: '.tab-add',
    text: 'Usa Agregar para ingresar un sobre completo',
    position: 'bottom',
  },
  {
    selector: '.tab:nth-child(2)',
    text: 'Aqui ves tu lista de faltantes para intercambiar',
    position: 'bottom',
  },
];

const totalSteps = steps.length;

function updateTarget() {
  const step = steps[currentStep.value];
  if (!step) return;

  const el = document.querySelector(step.selector) as HTMLElement | null;
  if (!el) return;

  const rect = el.getBoundingClientRect();
  targetRect.value = rect;

  // Position tooltip
  const padding = 12;
  const tooltipWidth = 280;
  let left = rect.left + rect.width / 2 - tooltipWidth / 2;
  // Keep tooltip within viewport
  left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));

  if (step.position === 'bottom') {
    tooltipStyle.value = {
      top: `${rect.bottom + 16}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
    };
  } else {
    tooltipStyle.value = {
      bottom: `${window.innerHeight - rect.top + 16}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
    };
  }
}

function nextStep() {
  if (currentStep.value < totalSteps - 1) {
    currentStep.value++;
    nextTick(() => {
      updateTarget();
    });
  } else {
    finish();
  }
}

function finish() {
  visible.value = false;
  localStorage.setItem('quemefalta_onboarding_done', '1');
  emit('done');
}

watch(currentStep, () => {
  nextTick(() => updateTarget());
});

onMounted(() => {
  // Small delay to ensure elements are rendered
  setTimeout(() => {
    visible.value = true;
    updateTarget();
  }, 500);

  window.addEventListener('resize', updateTarget);
  window.addEventListener('scroll', updateTarget, true);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateTarget);
  window.removeEventListener('scroll', updateTarget, true);
});

const spotlightStyle = computed(() => {
  if (!targetRect.value) return {};
  const pad = 6;
  return {
    top: `${targetRect.value.top - pad}px`,
    left: `${targetRect.value.left - pad}px`,
    width: `${targetRect.value.width + pad * 2}px`,
    height: `${targetRect.value.height + pad * 2}px`,
  };
});
</script>

<template>
  <Teleport to="body">
    <Transition name="onb-fade">
      <div v-if="visible" class="onb-overlay" @click.self="finish">
        <!-- Spotlight cutout via box-shadow on a positioned div -->
        <div class="onb-spotlight" :style="spotlightStyle" />

        <!-- Tooltip -->
        <div class="onb-tooltip" :style="tooltipStyle">
          <div class="onb-step-indicator">{{ currentStep + 1 }}/{{ totalSteps }}</div>
          <p class="onb-text">{{ steps[currentStep].text }}</p>
          <div class="onb-actions">
            <button class="onb-skip" @click="finish">Omitir</button>
            <button class="onb-next" @click="nextStep">
              {{ currentStep < totalSteps - 1 ? 'Siguiente' : 'Listo' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.onb-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: transparent;
}

.onb-spotlight {
  position: fixed;
  border-radius: 10px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.75);
  z-index: 1001;
  pointer-events: none;
  transition:
    top 0.35s ease,
    left 0.35s ease,
    width 0.35s ease,
    height 0.35s ease;
}

.onb-tooltip {
  position: fixed;
  z-index: 1002;
  background: #1a2235;
  border: 1px solid var(--gold);
  border-radius: 12px;
  padding: 16px 18px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  transition:
    top 0.35s ease,
    left 0.35s ease,
    bottom 0.35s ease;
}

.onb-step-indicator {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--gold);
  margin-bottom: 8px;
}

.onb-text {
  margin: 0 0 14px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  color: var(--chalk);
}

.onb-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.onb-skip {
  background: none;
  border: none;
  color: rgba(246, 241, 225, 0.45);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  padding: 4px 0;
}
.onb-skip:hover {
  color: rgba(246, 241, 225, 0.7);
}

.onb-next {
  padding: 8px 20px;
  background: var(--gold);
  color: var(--pitch-deep, #0b1120);
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s;
}
.onb-next:hover {
  opacity: 0.9;
}

/* Transitions */
.onb-fade-enter-active {
  transition: opacity 0.3s ease;
}
.onb-fade-leave-active {
  transition: opacity 0.2s ease;
}
.onb-fade-enter-from,
.onb-fade-leave-to {
  opacity: 0;
}
</style>
