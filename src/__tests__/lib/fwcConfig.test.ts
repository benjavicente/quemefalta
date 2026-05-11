import { describe, it, expect } from 'vitest';
import { getFwcVariant, FWC_VERTICAL_RANGE, FWC_CODE } from '@/lib/fwcConfig';

describe('fwcConfig', () => {
  it('exports FWC_CODE as FWC', () => {
    expect(FWC_CODE).toBe('FWC');
  });

  it('vertical range is [4, 8]', () => {
    expect(FWC_VERTICAL_RANGE).toEqual([4, 8]);
  });

  describe('getFwcVariant', () => {
    it('returns fwc-h for index 1 (before vertical range)', () => {
      expect(getFwcVariant(1)).toBe('fwc-h');
    });

    it('returns fwc-h for index 3 (just before vertical range)', () => {
      expect(getFwcVariant(3)).toBe('fwc-h');
    });

    it('returns fwc-v for index 4 (start of vertical range)', () => {
      expect(getFwcVariant(4)).toBe('fwc-v');
    });

    it('returns fwc-v for index 6 (middle of vertical range)', () => {
      expect(getFwcVariant(6)).toBe('fwc-v');
    });

    it('returns fwc-v for index 8 (end of vertical range)', () => {
      expect(getFwcVariant(8)).toBe('fwc-v');
    });

    it('returns fwc-h for index 9 (after vertical range)', () => {
      expect(getFwcVariant(9)).toBe('fwc-h');
    });

    it('returns fwc-h for index 20 (last sticker)', () => {
      expect(getFwcVariant(20)).toBe('fwc-h');
    });
  });
});
