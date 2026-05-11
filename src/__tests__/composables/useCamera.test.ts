import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useCamera } from '@/composables/useCamera';

// Mock getUserMedia
const mockGetUserMedia = vi.fn();
Object.defineProperty(globalThis.navigator, 'mediaDevices', {
  value: { getUserMedia: mockGetUserMedia },
  writable: true,
});

// Mock Worker refs
const mockWorker = ref(null);
const mockWorkerReady = ref(false);

beforeEach(() => {
  mockGetUserMedia.mockReset();
  mockWorker.value = null;
  mockWorkerReady.value = false;
});

describe('useCamera', () => {
  it('returns reactive state', () => {
    const videoRef = ref(null);
    const { stream, error, liveHint, liveCodesPreview } = useCamera(
      videoRef,
      mockWorker,
      mockWorkerReady,
    );

    expect(stream.value).toBeNull();
    expect(error.value).toBe('');
    expect(liveHint.value).toBe('');
    expect(liveCodesPreview.value).toEqual([]);
  });

  it('startCamera sets error on permission denied', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('NotAllowedError'));

    const videoRef = ref(null);
    const { startCamera, error } = useCamera(videoRef, mockWorker, mockWorkerReady);
    await startCamera();

    expect(error.value).toContain('Permiso de camara denegado');
  });

  it('startCamera sets error on no camera found', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('NotFoundError'));

    const videoRef = ref(null);
    const { startCamera, error } = useCamera(videoRef, mockWorker, mockWorkerReady);
    await startCamera();

    expect(error.value).toContain('No se encontro una camara');
  });

  it('startCamera sets generic error on unknown failure', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Something weird'));

    const videoRef = ref(null);
    const { startCamera, error } = useCamera(videoRef, mockWorker, mockWorkerReady);
    await startCamera();

    expect(error.value).toContain('Error al acceder a la camara');
  });

  it('stopCamera clears stream', async () => {
    const mockStop = vi.fn();
    const mockStream = { getTracks: () => [{ stop: mockStop }] };
    mockGetUserMedia.mockResolvedValue(mockStream);

    const videoRef = ref({
      srcObject: null,
      play: vi.fn().mockResolvedValue(undefined),
    } as unknown as HTMLVideoElement);

    const { startCamera, stopCamera, stream } = useCamera(videoRef, mockWorker, mockWorkerReady);
    await startCamera();
    expect(stream.value).not.toBeNull();

    stopCamera();
    expect(stream.value).toBeNull();
    expect(mockStop).toHaveBeenCalled();
  });

  it('startCamera clears previous error', async () => {
    mockGetUserMedia.mockRejectedValueOnce(new Error('NotAllowedError'));

    const videoRef = ref(null);
    const { startCamera, error } = useCamera(videoRef, mockWorker, mockWorkerReady);

    await startCamera();
    expect(error.value).not.toBe('');

    // Mock success on retry
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [],
    });
    await startCamera();
    expect(error.value).toBe('');
  });
});
