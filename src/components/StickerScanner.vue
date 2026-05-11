<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import type { DetectedCode } from '@/lib/ocrUtils';
import { useCamera } from '@/composables/useCamera';
import { useOcrWorker } from '@/composables/useOcrWorker';

const emit = defineEmits<{
  add: [numbers: number[]];
  close: [];
}>();

// Refs for DOM elements
const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

// Composables
const { worker, workerReady, initWorker, processCanvas, terminateWorker } = useOcrWorker();
const { stream, error, liveHint, liveCodesPreview, startCamera, stopCamera } = useCamera(
  videoRef,
  worker,
  workerReady,
);

// UI state
const phase = ref<'camera' | 'processing' | 'results' | 'no-results'>('camera');
const detectedCodes = ref<DetectedCode[]>([]);
const rawOcrText = ref('');

// Capture snapshot from video
function capture() {
  if (!videoRef.value || !canvasRef.value) return;
  const video = videoRef.value;
  const canvas = canvasRef.value;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(video, 0, 0);
  stopCamera();
  processImage();
}

// Process captured image with OCR
async function processImage() {
  if (!canvasRef.value) return;
  phase.value = 'processing';
  error.value = '';

  try {
    const { codes, rawText } = await processCanvas(canvasRef.value);
    rawOcrText.value = rawText;
    detectedCodes.value = codes;
    phase.value = codes.length === 0 ? 'no-results' : 'results';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    error.value = msg;
    phase.value = 'camera';
    startCamera();
  }
}

// Toggle code selection
function toggleCode(index: number) {
  detectedCodes.value[index].selected = !detectedCodes.value[index].selected;
}

// Select/deselect all
function toggleAll() {
  const allSelected = detectedCodes.value.every((c) => c.selected);
  detectedCodes.value.forEach((c) => (c.selected = !allSelected));
}

// Count selected
const selectedCount = computed(() => detectedCodes.value.filter((c) => c.selected).length);

// Confirm and add to album
function confirmAdd() {
  const numbers = detectedCodes.value.filter((c) => c.selected).map((c) => c.stickerNumber);
  if (numbers.length > 0) {
    emit('add', numbers);
  }
}

// Retry: go back to camera
function retry() {
  detectedCodes.value = [];
  rawOcrText.value = '';
  error.value = '';
  phase.value = 'camera';
  startCamera();
}

onMounted(() => {
  startCamera();
  initWorker();
});

onBeforeUnmount(() => {
  stopCamera();
  terminateWorker();
});
</script>

<template>
  <div class="sc-bg" @click="emit('close')" @keydown.escape="emit('close')">
    <div class="sc" @click.stop>
      <!-- Header -->
      <div class="sc-head">
        <div>
          <div class="sc-label">ESCANEAR SOBRE</div>
          <div class="sc-title">Lector de laminas</div>
        </div>
        <button class="sc-close" aria-label="Cerrar" @click="emit('close')">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <!-- Camera phase -->
      <template v-if="phase === 'camera'">
        <p class="sc-hint">
          Apunta la camara al reverso del sobre donde aparecen los codigos de las laminas.
        </p>
        <div class="sc-camera-wrap">
          <video ref="videoRef" class="sc-video" playsinline muted />
          <div class="sc-viewfinder">
            <div class="sc-corner sc-corner-tl" />
            <div class="sc-corner sc-corner-tr" />
            <div class="sc-corner sc-corner-bl" />
            <div class="sc-corner sc-corner-br" />
          </div>
        </div>
        <canvas ref="canvasRef" style="display: none" />

        <div v-if="error" class="sc-error" role="alert">{{ error }}</div>

        <!-- Live preview hint -->
        <div v-if="liveCodesPreview.length > 0" class="sc-live sc-live-found">
          <span class="sc-live-icon">&#9679;</span>
          Veo: <strong>{{ liveCodesPreview.join(', ') }}</strong>
        </div>
        <div v-else-if="liveHint" class="sc-live sc-live-empty">
          {{ liveHint }}
        </div>

        <div class="sc-footer">
          <div class="sc-worker-status">
            <span v-if="!workerReady" class="sc-loading-dot" />
            {{ workerReady ? 'OCR listo' : 'Cargando OCR...' }}
          </div>
          <button class="sc-btn sc-btn-capture" :disabled="!stream" @click="capture">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" fill="currentColor" />
            </svg>
            Capturar
          </button>
        </div>
      </template>

      <!-- Processing phase -->
      <template v-if="phase === 'processing'">
        <div class="sc-processing">
          <div class="sc-spinner" />
          <div class="sc-processing-text">Leyendo codigos...</div>
          <div class="sc-processing-sub">Analizando la imagen con OCR</div>
        </div>
      </template>

      <!-- No results phase -->
      <template v-if="phase === 'no-results'">
        <div class="sc-no-results">
          <div class="sc-no-icon">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--coral)"
              stroke-width="1.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="8" y1="15" x2="16" y2="15" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </div>
          <div class="sc-no-title">No se detectaron láminas</div>
          <p class="sc-no-text">
            No se encontraron códigos válidos en la imagen. Prueba con mejor iluminación, más cerca
            del sobre, o con el reverso de la lámina donde aparece el código (ej: ALG 16).
          </p>
          <div class="sc-no-actions">
            <button class="sc-btn sc-btn-retry" @click="retry">Reintentar</button>
            <button class="sc-btn sc-btn-close-alt" @click="emit('close')">Cerrar</button>
          </div>
        </div>
      </template>

      <!-- Results phase -->
      <template v-if="phase === 'results'">
        <p class="sc-hint">
          Se encontraron <strong>{{ detectedCodes.length }}</strong> codigos. Desmarca los que no
          quieras agregar.
        </p>

        <div class="sc-results">
          <div class="sc-results-header">
            <button class="sc-toggle-all" @click="toggleAll">
              {{ detectedCodes.every((c) => c.selected) ? 'Desmarcar todos' : 'Marcar todos' }}
            </button>
            <span class="sc-selected-count">{{ selectedCount }} seleccionados</span>
          </div>

          <div class="sc-codes-grid">
            <button
              v-for="(item, i) in detectedCodes"
              :key="item.code"
              :class="['sc-code-chip', { selected: item.selected }]"
              @click="toggleCode(i)"
            >
              <span class="sc-code-check">{{ item.selected ? '✓' : '' }}</span>
              <span class="sc-code-text">{{ item.code }}</span>
            </button>
          </div>
        </div>

        <div v-if="error" class="sc-error" role="alert">{{ error }}</div>

        <div class="sc-footer sc-footer-results">
          <button class="sc-btn sc-btn-retry" @click="retry">Reintentar</button>
          <button class="sc-btn sc-btn-add" :disabled="selectedCount === 0" @click="confirmAdd">
            Agregar {{ selectedCount }} al album
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.sc-bg {
  position: fixed;
  inset: 0;
  background: rgba(12, 18, 32, 0.85);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 12px;
  animation: scFadeIn 0.12s ease-out;
}
@keyframes scFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.sc {
  background: #141c2b;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 20px 18px;
  max-width: 440px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
  color: var(--chalk);
}
.sc-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
.sc-label {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--gold);
  margin-bottom: 4px;
}
.sc-title {
  font-family: var(--display);
  font-size: 22px;
  letter-spacing: 0.04em;
}
.sc-close {
  background: transparent;
  border: none;
  color: rgba(246, 241, 225, 0.5);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
}
.sc-hint {
  font-size: 12px;
  color: rgba(246, 241, 225, 0.6);
  line-height: 1.5;
  margin: 0 0 12px;
}
.sc-hint strong {
  color: var(--gold);
}

/* Camera */
.sc-camera-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  background: #000;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 12px;
}
.sc-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.sc-viewfinder {
  position: absolute;
  inset: 15%;
  pointer-events: none;
}
.sc-corner {
  position: absolute;
  width: 24px;
  height: 24px;
  border-color: var(--gold);
  border-style: solid;
  border-width: 0;
}
.sc-corner-tl {
  top: 0;
  left: 0;
  border-top-width: 2px;
  border-left-width: 2px;
  border-top-left-radius: 4px;
}
.sc-corner-tr {
  top: 0;
  right: 0;
  border-top-width: 2px;
  border-right-width: 2px;
  border-top-right-radius: 4px;
}
.sc-corner-bl {
  bottom: 0;
  left: 0;
  border-bottom-width: 2px;
  border-left-width: 2px;
  border-bottom-left-radius: 4px;
}
.sc-corner-br {
  bottom: 0;
  right: 0;
  border-bottom-width: 2px;
  border-right-width: 2px;
  border-bottom-right-radius: 4px;
}

/* Processing */
.sc-processing {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 20px;
  gap: 14px;
}
.sc-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(246, 241, 225, 0.1);
  border-top-color: var(--gold);
  border-radius: 50%;
  animation: scSpin 0.8s linear infinite;
}
@keyframes scSpin {
  to {
    transform: rotate(360deg);
  }
}
.sc-processing-text {
  font-family: var(--display);
  font-size: 18px;
  letter-spacing: 0.04em;
}
.sc-processing-sub {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: rgba(246, 241, 225, 0.45);
}

/* Results */
.sc-results {
  margin-bottom: 14px;
}
.sc-results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.sc-toggle-all {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.05em;
  color: var(--gold);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.sc-selected-count {
  font-family: var(--mono);
  font-size: 10px;
  color: rgba(246, 241, 225, 0.5);
}
.sc-codes-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sc-code-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  background: rgba(246, 241, 225, 0.04);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: rgba(246, 241, 225, 0.6);
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
}
.sc-code-chip.selected {
  background: rgba(232, 179, 65, 0.1);
  border-color: var(--gold);
  color: var(--gold);
}
.sc-code-check {
  width: 14px;
  font-size: 12px;
  text-align: center;
}

/* Error */
.sc-error {
  font-size: 11px;
  color: var(--coral);
  margin: 8px 0;
  line-height: 1.4;
}

/* Live preview */
.sc-live {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  text-align: center;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 4px;
  transition: all 0.2s ease;
}
.sc-live-found {
  background: rgba(95, 194, 138, 0.1);
  border: 1px solid rgba(95, 194, 138, 0.3);
  color: var(--mint);
}
.sc-live-found strong {
  font-weight: 700;
  letter-spacing: 0.06em;
}
.sc-live-icon {
  font-size: 8px;
  margin-right: 4px;
  animation: scPulse 1s ease-in-out infinite;
}
.sc-live-empty {
  background: rgba(246, 241, 225, 0.04);
  border: 1px solid rgba(246, 241, 225, 0.1);
  color: rgba(246, 241, 225, 0.5);
}

/* Footer */
.sc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  gap: 12px;
}
.sc-footer-results {
  gap: 10px;
}
.sc-worker-status {
  font-family: var(--mono);
  font-size: 10px;
  color: rgba(246, 241, 225, 0.45);
  display: flex;
  align-items: center;
  gap: 6px;
}
.sc-loading-dot {
  width: 6px;
  height: 6px;
  background: var(--gold);
  border-radius: 50%;
  animation: scPulse 1s ease-in-out infinite;
}
@keyframes scPulse {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}
.sc-btn {
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.sc-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.sc-btn-capture {
  background: var(--gold);
  color: var(--pitch-deep);
  margin-left: auto;
}
.sc-btn-capture:not(:disabled):hover {
  background: var(--gold-deep);
}
.sc-btn-retry {
  background: rgba(246, 241, 225, 0.06);
  color: var(--chalk);
  border: 1px solid var(--line);
}
.sc-btn-retry:hover {
  background: rgba(246, 241, 225, 0.1);
}
.sc-btn-add {
  background: var(--gold);
  color: var(--pitch-deep);
  flex: 1;
  justify-content: center;
}
.sc-btn-add:not(:disabled):hover {
  background: var(--gold-deep);
}

/* No results */
.sc-no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 16px;
  gap: 10px;
}
.sc-no-icon {
  font-size: 48px;
  margin-bottom: 4px;
}
.sc-no-title {
  font-family: var(--display);
  font-size: 20px;
  letter-spacing: 0.04em;
  color: var(--coral);
}
.sc-no-text {
  font-size: 12px;
  color: rgba(246, 241, 225, 0.6);
  line-height: 1.6;
  margin: 0;
  max-width: 320px;
}
.sc-no-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  width: 100%;
}
.sc-btn-close-alt {
  background: transparent;
  color: rgba(246, 241, 225, 0.6);
  border: 1px solid var(--line);
  flex: 1;
  justify-content: center;
}
</style>
