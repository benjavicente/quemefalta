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
  /** If the element might not exist, try to open it first */
  setup?: () => void;
}

const steps: Step[] = [
  {
    selector: '.acc-group-head',
    text: 'Toca un grupo para ver sus equipos',
    position: 'bottom',
  },
  {
    selector: '.acc-teams .acc-team',
    text: 'Toca un equipo para desplegar sus láminas',
    position: 'bottom',
    setup: () => {
      const head = document.querySelector('.acc-group-head') as HTMLElement;
      if (head && !document.querySelector('.acc-teams')) {
        head.click();
      }
    },
  },
  {
    selector: '[data-stk]:first-child .stk',
    text: 'Toca una lámina para marcarla. Tócala de nuevo y se vuelve repetida (×2, ×3…).',
    position: 'bottom',
    setup: () => {
      // Open first team if none open
      const team = document.querySelector('.acc-teams .acc-team') as HTMLElement;
      if (team && !document.querySelector('.acc-content')) {
        team.click();
      }
    },
  },
  {
    selector: '.sect-grid',
    text: 'Arrastra el dedo sobre varias láminas para marcarlas de corrido',
    position: 'bottom',
  },
  {
    selector: '.complete-btn',
    text: 'Toca "Completar" para marcar toda la sección de una vez',
    position: 'top',
  },
  {
    selector: '.tab-add',
    text: 'Usa "Agregar" para ingresar un sobre completo escribiendo los códigos',
    position: 'top',
  },
  {
    selector: '.tab:nth-child(2)',
    text: 'Aquí ves las que te faltan, agrupadas por equipo. Puedes copiar la lista para mandar por WhatsApp.',
    position: 'top',
    setup: () => {
      const tab = document.querySelector('.tab:nth-child(2)') as HTMLElement;
      if (tab) tab.click();
    },
  },
  {
    selector: '.copy-btn',
    text: 'Este botón copia la lista de faltantes al portapapeles — listo para pegar en WhatsApp.',
    position: 'top',
  },
  {
    selector: '.tab:nth-child(3)',
    text: 'Y aquí tus repetidas con la cantidad de cada una — también puedes copiar la lista para canjear.',
    position: 'top',
    setup: () => {
      const tab = document.querySelector('.tab:nth-child(3)') as HTMLElement;
      if (tab) tab.click();
    },
  },
  {
    selector: '.hdr-icon-btn[title="Compartir mi perfil"]',
    text: 'Comparte tu perfil público para que otros vean tu progreso y te contacten para canjear.',
    position: 'bottom',
    setup: () => {
      // Volver al tab álbum
      const tab = document.querySelector('.tab:nth-child(1)') as HTMLElement;
      if (tab) tab.click();
    },
  },
];

const totalSteps = steps.length;

function updateTarget() {
  const step = steps[currentStep.value];
  if (!step) return;

  const el = document.querySelector(step.selector) as HTMLElement | null;
  if (!el) {
    targetRect.value = null;
    return;
  }

  // Scroll element into view first
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Wait for scroll to settle, then position
  setTimeout(() => {
    const rect = el.getBoundingClientRect();
    targetRect.value = rect;

    const padding = 12;
    const tooltipWidth = 280;
    const tooltipHeight = 120; // approximate
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));

    // Check if tooltip fits below the target
    const fitsBelow = step.position === 'bottom' && rect.bottom + 16 + tooltipHeight < window.innerHeight;
    const fitsAbove = step.position === 'top' && rect.top - 16 - tooltipHeight > 0;

    if (step.position === 'bottom' && fitsBelow) {
      tooltipStyle.value = {
        top: `${rect.bottom + 16}px`,
        left: `${left}px`,
        width: `${tooltipWidth}px`,
        transform: 'none',
      };
    } else if (step.position === 'top' && fitsAbove) {
      tooltipStyle.value = {
        top: `${rect.top - 16}px`,
        left: `${left}px`,
        width: `${tooltipWidth}px`,
        transform: 'translateY(-100%)',
      };
    } else {
      // Fallback: center tooltip in viewport
      tooltipStyle.value = {
        top: '50%',
        left: `${left}px`,
        width: `${tooltipWidth}px`,
        transform: 'translateY(-50%)',
      };
    }
  }, 300);
}

function nextStep() {
  if (currentStep.value < totalSteps - 1) {
    currentStep.value++;
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
  const step = steps[currentStep.value];
  if (step?.setup) step.setup();
  nextTick(() => updateTarget());
});

onMounted(() => {
  setTimeout(() => {
    visible.value = true;
    const step = steps[0];
    if (step?.setup) step.setup();
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
  if (!targetRect.value) return { display: 'none' };
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
      <div v-if="visible" class="onb-overlay" @click.self="nextStep">
        <div class="onb-spotlight" :style="spotlightStyle" />

        <div class="onb-tooltip" :style="tooltipStyle">
          <div class="onb-step-indicator">{{ currentStep + 1 }}/{{ totalSteps }}</div>
          <p class="onb-text">{{ steps[currentStep].text }}</p>
          <div class="onb-actions">
            <button class="onb-skip" @click="finish">Omitir</button>
            <button class="onb-next" @click="nextStep">
              {{ currentStep < totalSteps - 1 ? 'Siguiente' : 'Listo' }}
            </button>
          </div>
          <div class="onb-tap-hint">Toca fuera para avanzar</div>
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
  color: var(--pitch-deep);
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

.onb-tap-hint {
  font-family: var(--mono);
  font-size: 9px;
  color: rgba(246, 241, 225, 0.3);
  text-align: center;
  margin-top: 8px;
  letter-spacing: 0.05em;
}

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
