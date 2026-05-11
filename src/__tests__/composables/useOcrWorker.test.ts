import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWorkerInstance = vi.hoisted(() => ({
  recognize: vi.fn(),
  setParameters: vi.fn().mockResolvedValue(undefined),
  terminate: vi.fn(),
}));

vi.mock('tesseract.js', () => ({
  createWorker: () => Promise.resolve(mockWorkerInstance),
}));

vi.mock('@/lib/canvasUtils', () => ({
  preprocessImage: (c: HTMLCanvasElement) => c,
}));

vi.mock('@/lib/ocrUtils', () => ({
  extractCodes: (text: string) => {
    if (text.includes('ALG 16')) {
      return [{ code: 'ALG16', stickerNumber: 716, selected: true }];
    }
    return [];
  },
}));

import { useOcrWorker } from '@/composables/useOcrWorker';

beforeEach(() => {
  mockWorkerInstance.recognize.mockReset();
  mockWorkerInstance.setParameters.mockReset().mockResolvedValue(undefined);
  mockWorkerInstance.terminate.mockReset();
});

describe('useOcrWorker', () => {
  it('starts with worker not ready', () => {
    const { workerReady } = useOcrWorker();
    expect(workerReady.value).toBe(false);
  });

  it('initWorker sets workerReady to true', async () => {
    const { initWorker, workerReady } = useOcrWorker();
    await initWorker();
    expect(workerReady.value).toBe(true);
  });

  it('initWorker configures sparse text mode', async () => {
    const { initWorker } = useOcrWorker();
    await initWorker();
    expect(mockWorkerInstance.setParameters).toHaveBeenCalledWith({
      tessedit_pageseg_mode: '11',
    });
  });

  it('processCanvas returns codes and rawText', async () => {
    mockWorkerInstance.recognize.mockResolvedValue({ data: { text: 'ALG 16 FIFA' } });

    const { initWorker, processCanvas } = useOcrWorker();
    await initWorker();

    const canvas = document.createElement('canvas');
    const result = await processCanvas(canvas);

    expect(result.rawText).toBe('ALG 16 FIFA');
    expect(result.codes).toHaveLength(1);
    expect(result.codes[0].code).toBe('ALG16');
  });

  it('processCanvas returns empty codes for no matches', async () => {
    mockWorkerInstance.recognize.mockResolvedValue({ data: { text: 'random text' } });

    const { initWorker, processCanvas } = useOcrWorker();
    await initWorker();

    const canvas = document.createElement('canvas');
    const result = await processCanvas(canvas);
    expect(result.codes).toHaveLength(0);
  });

  it('terminateWorker cleans up', async () => {
    const { initWorker, terminateWorker, workerReady } = useOcrWorker();
    await initWorker();
    expect(workerReady.value).toBe(true);

    terminateWorker();
    expect(workerReady.value).toBe(false);
    expect(mockWorkerInstance.terminate).toHaveBeenCalled();
  });
});
