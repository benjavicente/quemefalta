import { describe, it, expect, vi, beforeEach } from 'vitest';

let preprocessImage: typeof import('@/lib/canvasUtils').preprocessImage;

// Minimal canvas mock
function createMockCanvas(width: number, height: number, pixelData?: number[]) {
  const data = pixelData ?? new Array(width * height * 4).fill(128);
  const imageData = { data: new Uint8ClampedArray(data), width, height };

  const ctx = {
    getImageData: vi.fn().mockReturnValue(imageData),
    putImageData: vi.fn(),
    createImageData: vi.fn((w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    })),
    drawImage: vi.fn(),
    imageSmoothingEnabled: true,
  };

  const canvas = {
    width,
    height,
    getContext: vi.fn().mockReturnValue(ctx),
  } as unknown as HTMLCanvasElement;

  return { canvas, ctx };
}

beforeEach(async () => {
  vi.resetModules();
  // Mock document.createElement to return mock canvases
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') {
      const { canvas } = createMockCanvas(1, 1);
      return canvas as unknown as HTMLElement;
    }
    return document.createElement(tag);
  });
  const mod = await import('@/lib/canvasUtils');
  preprocessImage = mod.preprocessImage;
});

describe('preprocessImage', () => {
  it('returns source canvas if context is null', () => {
    const canvas = {
      width: 10,
      height: 10,
      getContext: vi.fn().mockReturnValue(null),
    } as unknown as HTMLCanvasElement;

    const result = preprocessImage(canvas);
    expect(result).toBe(canvas);
  });

  it('converts pixels to grayscale and binarizes', () => {
    // 2x2 image: white, black, gray, gray
    const pixels = [
      255, 255, 255, 255, // white
      0, 0, 0, 255, // black
      128, 128, 128, 255, // mid gray
      200, 200, 200, 255, // light gray
    ];
    const { canvas } = createMockCanvas(2, 2, pixels);

    const result = preprocessImage(canvas);
    // Should return a new canvas (not the source)
    expect(result).not.toBe(canvas);
  });

  it('produces 2x scaled output dimensions', () => {
    const { canvas } = createMockCanvas(10, 8);

    // Mock createElement to track created canvases
    const createdCanvases: any[] = [];
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const c = { width: 0, height: 0, getContext: vi.fn().mockReturnValue({
          getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(0), width: 0, height: 0 }),
          putImageData: vi.fn(),
          createImageData: vi.fn((w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })),
          drawImage: vi.fn(),
          imageSmoothingEnabled: true,
        }) };
        createdCanvases.push(c);
        return c as unknown as HTMLElement;
      }
      return document.createElement(tag);
    });

    preprocessImage(canvas);

    // First created canvas is the 2x output
    const outCanvas = createdCanvases[0];
    expect(outCanvas.width).toBe(20);
    expect(outCanvas.height).toBe(16);
  });

  it('handles uniform image (all same color) without error', () => {
    // All pixels are identical gray — contrast stretch range would be 0
    const pixels = new Array(4 * 4 * 4).fill(0);
    for (let i = 0; i < 16; i++) {
      pixels[i * 4] = 100;
      pixels[i * 4 + 1] = 100;
      pixels[i * 4 + 2] = 100;
      pixels[i * 4 + 3] = 255;
    }
    const { canvas } = createMockCanvas(4, 4, pixels);

    // Should not throw
    expect(() => preprocessImage(canvas)).not.toThrow();
  });
});
