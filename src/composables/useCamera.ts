/**
 * Camera management composable.
 * Handles getUserMedia, stream lifecycle, and live preview scanning.
 */
import { ref, type Ref } from 'vue';
import { extractCodes } from '@/lib/ocrUtils';
import { preprocessImage } from '@/lib/canvasUtils';
import type { Worker } from 'tesseract.js';

export function useCamera(
  videoRef: Ref<HTMLVideoElement | null>,
  ocrWorker: Ref<Worker | null>,
  workerReady: Ref<boolean>,
) {
  const stream = ref<MediaStream | null>(null);
  const error = ref('');
  const liveHint = ref('');
  const liveCodesPreview = ref<string[]>([]);

  let liveScanning = false;
  let liveScanTimer: ReturnType<typeof setTimeout> | null = null;

  async function startCamera() {
    error.value = '';
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      stream.value = mediaStream;
      if (videoRef.value) {
        videoRef.value.srcObject = mediaStream;
        await videoRef.value.play();
        startLivePreview();
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

  function stopCamera() {
    stopLivePreview();
    if (stream.value) {
      stream.value.getTracks().forEach((t) => t.stop());
      stream.value = null;
    }
  }

  function startLivePreview() {
    if (liveScanning) return;
    liveScanning = true;
    liveHint.value = '';
    liveCodesPreview.value = [];
    scheduleLiveScan();
  }

  function stopLivePreview() {
    liveScanning = false;
    if (liveScanTimer) {
      clearTimeout(liveScanTimer);
      liveScanTimer = null;
    }
  }

  function scheduleLiveScan() {
    if (!liveScanning) return;
    liveScanTimer = setTimeout(() => runLiveScan(), 2500);
  }

  async function runLiveScan() {
    if (!liveScanning || !videoRef.value || !ocrWorker.value || !workerReady.value) {
      if (liveScanning) scheduleLiveScan();
      return;
    }

    try {
      const video = videoRef.value;
      const scale = Math.min(1, 480 / video.videoWidth);
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);

      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = w;
      tmpCanvas.height = h;
      const ctx = tmpCanvas.getContext('2d');
      if (!ctx) {
        scheduleLiveScan();
        return;
      }
      ctx.drawImage(video, 0, 0, w, h);

      const processed = preprocessImage(tmpCanvas);
      const dataUrl = processed.toDataURL('image/jpeg', 0.8);

      const result = await ocrWorker.value.recognize(dataUrl);
      if (!liveScanning) return;

      const text = result.data.text;
      const codes = extractCodes(text);

      if (codes.length > 0) {
        liveCodesPreview.value = codes.map((c) => c.code);
        liveHint.value = '';
      } else if (text.trim().length < 5) {
        liveHint.value = 'Apunta al sobre con los códigos';
        liveCodesPreview.value = [];
      } else {
        liveHint.value = 'No se ven códigos — acércate más';
        liveCodesPreview.value = [];
      }
    } catch {
      // Silently ignore live scan errors
    }

    if (liveScanning) scheduleLiveScan();
  }

  return {
    stream,
    error,
    liveHint,
    liveCodesPreview,
    startCamera,
    stopCamera,
  };
}
