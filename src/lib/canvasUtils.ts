/**
 * Canvas image preprocessing for OCR.
 * Converts camera frames to high-contrast binarized images for better text recognition.
 */

/** Preprocess canvas for OCR: grayscale → contrast stretch → Otsu binarize → scale 2x */
export function preprocessImage(srcCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) return srcCanvas;

  const srcData = srcCtx.getImageData(0, 0, w, h);
  const pixels = srcData.data;

  // Step 1: Convert to grayscale
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  // Step 2: Contrast stretch
  let min = 255;
  let max = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < min) min = gray[i];
    if (gray[i] > max) max = gray[i];
  }
  const range = max - min || 1;
  for (let i = 0; i < gray.length; i++) {
    gray[i] = Math.round(((gray[i] - min) / range) * 255);
  }

  // Step 3: Otsu's threshold
  const histogram = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) histogram[gray[i]]++;
  const total = gray.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * histogram[i];
  let sumBg = 0;
  let wBg = 0;
  let maxVariance = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wBg += histogram[t];
    if (wBg === 0) continue;
    const wFg = total - wBg;
    if (wFg === 0) break;
    sumBg += t * histogram[t];
    const meanBg = sumBg / wBg;
    const meanFg = (sumAll - sumBg) / wFg;
    const variance = wBg * wFg * (meanBg - meanFg) * (meanBg - meanFg);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  for (let i = 0; i < gray.length; i++) {
    gray[i] = gray[i] > threshold ? 255 : 0;
  }

  // Step 4: Scale 2x
  const scale = 2;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = w * scale;
  outCanvas.height = h * scale;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return srcCanvas;

  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = w;
  tmpCanvas.height = h;
  const tmpCtx = tmpCanvas.getContext('2d');
  if (!tmpCtx) return srcCanvas;

  const outData = tmpCtx.createImageData(w, h);
  for (let i = 0; i < gray.length; i++) {
    outData.data[i * 4] = gray[i];
    outData.data[i * 4 + 1] = gray[i];
    outData.data[i * 4 + 2] = gray[i];
    outData.data[i * 4 + 3] = 255;
  }
  tmpCtx.putImageData(outData, 0, 0);

  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(tmpCanvas, 0, 0, w * scale, h * scale);

  console.log(
    `[Scanner] Preprocessed: ${w}x${h} → ${w * scale}x${h * scale}, threshold=${threshold}`,
  );
  return outCanvas;
}
