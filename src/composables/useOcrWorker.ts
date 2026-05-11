/**
 * OCR worker lifecycle composable.
 * Handles tesseract.js worker init, image processing, and code extraction.
 */
import { ref } from 'vue';
import { createWorker, type Worker } from 'tesseract.js';
import { extractCodes, type DetectedCode } from '@/lib/ocrUtils';
import { preprocessImage } from '@/lib/canvasUtils';

export function useOcrWorker() {
  const worker = ref<Worker | null>(null);
  const workerReady = ref(false);

  async function initWorker() {
    console.log('[Scanner] Initializing OCR worker...');
    try {
      const w = await createWorker('eng');
      await w.setParameters({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tessedit_pageseg_mode: '11' as any, // Sparse text
      });
      worker.value = w;
      workerReady.value = true;
      console.log('[Scanner] OCR worker ready');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Scanner] OCR init failed:', msg);
      throw new Error(`Error inicializando OCR: ${msg}`);
    }
  }

  async function processCanvas(
    canvas: HTMLCanvasElement,
  ): Promise<{ codes: DetectedCode[]; rawText: string }> {
    if (!workerReady.value) {
      await initWorker();
    }

    if (!worker.value) {
      throw new Error('No se pudo inicializar el motor OCR.');
    }

    console.log('[Scanner] Processing image...');
    const processed = preprocessImage(canvas);
    const dataUrl = processed.toDataURL('image/png');
    const result = await worker.value.recognize(dataUrl);
    const rawText = result.data.text;
    console.log('[Scanner] OCR raw text:', rawText);

    const codes = extractCodes(rawText);

    if (codes.length === 0) {
      console.log('[Scanner] No sticker codes detected');
    } else {
      console.log(
        '[Scanner] Detected',
        codes.length,
        'codes:',
        codes.map((c) => c.code).join(', '),
      );
    }

    return { codes, rawText };
  }

  function terminateWorker() {
    if (worker.value) {
      worker.value.terminate();
      worker.value = null;
      workerReady.value = false;
    }
  }

  return {
    worker,
    workerReady,
    initWorker,
    processCanvas,
    terminateWorker,
  };
}
