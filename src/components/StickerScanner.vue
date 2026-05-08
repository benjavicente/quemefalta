<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { createWorker, type Worker } from 'tesseract.js';
import { ALBUM_SECTIONS, stickerNumberFromCode } from '@/lib/albumData';

const emit = defineEmits<{
  add: [numbers: number[]];
  close: [];
}>();

// Valid section codes for matching
const validCodes = new Set(ALBUM_SECTIONS.map((s) => s.code));

// State
const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const stream = ref<MediaStream | null>(null);
const phase = ref<'camera' | 'processing' | 'results' | 'no-results'>('camera');
const error = ref('');
const ocrWorker = ref<Worker | null>(null);
const workerReady = ref(false);

interface DetectedCode {
  code: string;
  stickerNumber: number;
  selected: boolean;
}

const detectedCodes = ref<DetectedCode[]>([]);
const rawOcrText = ref('');

// Start camera
async function startCamera() {
  error.value = '';
  try {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    stream.value = mediaStream;
    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream;
      await videoRef.value.play();
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
      error.value = 'Permiso de camara denegado. Habilita el acceso a la camara en tu navegador.';
    } else if (msg.includes('NotFoundError')) {
      error.value = 'No se encontro una camara disponible en este dispositivo.';
    } else {
      error.value = `Error al acceder a la camara: ${msg}`;
    }
  }
}

// Stop camera
function stopCamera() {
  if (stream.value) {
    stream.value.getTracks().forEach((t) => t.stop());
    stream.value = null;
  }
}

// Initialize OCR worker
async function initWorker() {
  console.log('[Scanner] Initializing OCR worker...');
  try {
    const worker = await createWorker('eng');
    await worker.setParameters({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tessedit_pageseg_mode: '11' as any, // Sparse text — better for sticker codes
    });
    ocrWorker.value = worker;
    workerReady.value = true;
    console.log('[Scanner] OCR worker ready');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Scanner] OCR init failed:', msg);
    error.value = `Error inicializando OCR: ${msg}`;
  }
}

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

// Parse OCR text to extract sticker codes
function extractCodes(text: string): DetectedCode[] {
  const results: DetectedCode[] = [];
  const seen = new Set<string>();

  // Normalize text: uppercase, replace common OCR mistakes
  let cleaned = text.toUpperCase();
  // OCR often reads bullet points as various characters
  cleaned = cleaned.replace(/[•·°*|]/g, ' ');
  // Normalize separators
  cleaned = cleaned.replace(/[-–—]/g, ' ');
  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Pattern: team code (2-3 letters) followed by number (1-2 digits)
  // With optional space, dash, or nothing between them
  const pattern = /\b([A-Z]{2,4})\s*(\d{1,2})\b/g;
  let match;

  while ((match = pattern.exec(cleaned)) !== null) {
    const prefix = match[1];
    const num = match[2];

    // Check if prefix is a valid section code
    if (!validCodes.has(prefix)) continue;

    const codeStr = `${prefix}${num}`;
    const stickerNum = stickerNumberFromCode(codeStr);
    if (stickerNum === undefined) continue;

    // Avoid duplicate entries
    if (seen.has(codeStr)) continue;
    seen.add(codeStr);

    results.push({
      code: codeStr,
      stickerNumber: stickerNum,
      selected: true,
    });
  }

  return results;
}

// Process captured image with OCR
async function processImage() {
  if (!canvasRef.value) return;
  phase.value = 'processing';
  error.value = '';

  // Wait for worker if not ready yet
  if (!workerReady.value) {
    await initWorker();
  }

  if (!ocrWorker.value) {
    error.value = 'No se pudo inicializar el motor OCR.';
    phase.value = 'camera';
    startCamera();
    return;
  }

  try {
    console.log('[Scanner] Processing image...');
    const dataUrl = canvasRef.value.toDataURL('image/png');
    const result = await ocrWorker.value.recognize(dataUrl);
    rawOcrText.value = result.data.text;
    console.log('[Scanner] OCR raw text:', result.data.text);

    const codes = extractCodes(result.data.text);
    detectedCodes.value = codes;

    if (codes.length === 0) {
      console.log('[Scanner] No sticker codes detected');
      phase.value = 'no-results';
    } else {
      console.log(
        '[Scanner] Detected',
        codes.length,
        'codes:',
        codes.map((c) => c.code).join(', '),
      );
      phase.value = 'results';
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Scanner] OCR processing failed:', msg);
    error.value = `Error al leer la imagen: ${msg}`;
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
  if (ocrWorker.value) {
    ocrWorker.value.terminate();
  }
});
</script>

<template>
  <div class="sc-bg" @click="emit('close')">
    <div class="sc" @click.stop>
      <!-- Header -->
      <div class="sc-head">
        <div>
          <div class="sc-label">ESCANEAR SOBRE</div>
          <div class="sc-title">Lector de laminas</div>
        </div>
        <button class="sc-close" @click="emit('close')">&#10005;</button>
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

        <div v-if="error" class="sc-error">{{ error }}</div>

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
          <div class="sc-no-icon">🤷</div>
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

        <div v-if="error" class="sc-error">{{ error }}</div>

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
