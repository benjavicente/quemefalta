import { describe, it, expect } from 'vitest';
import { generateCsv, parseCsv, CsvParseError } from '@/lib/csvUtils';
import { ALBUM_SECTIONS, TOTAL_STICKERS } from '@/lib/albumData';
import type { StickerState } from '@/composables/useStickers';

function makeState(owned: boolean, dupes = 0): StickerState {
  return { owned, dupes, note: '' };
}

describe('csvUtils', () => {
  describe('generateCsv', () => {
    it('produces header + 49 data rows', () => {
      const csv = generateCsv({});
      const lines = csv.split('\n');
      expect(lines).toHaveLength(1 + ALBUM_SECTIONS.length); // header + 49
      expect(lines[0]).toBe('section,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20');
    });

    it('empty stickers map produces all zeros', () => {
      const csv = generateCsv({});
      const lines = csv.split('\n').slice(1);
      for (const line of lines) {
        const values = line.split(',').slice(1);
        expect(values).toHaveLength(20);
        expect(values.every((v) => v === '0')).toBe(true);
      }
    });

    it('owned sticker with no dupes produces 1', () => {
      const stickers: Record<number, StickerState> = {
        1: makeState(true, 0), // FWC1
      };
      const csv = generateCsv(stickers);
      const fwcRow = csv.split('\n')[1]; // first data row = FWC
      const values = fwcRow.split(',');
      expect(values[0]).toBe('FWC');
      expect(values[1]).toBe('1'); // position 1
      expect(values[2]).toBe('0'); // position 2
    });

    it('sticker with dupes produces 1 + dupes', () => {
      const stickers: Record<number, StickerState> = {
        1: makeState(true, 2), // FWC1 with 2 dupes
      };
      const csv = generateCsv(stickers);
      const fwcRow = csv.split('\n')[1];
      expect(fwcRow.split(',')[1]).toBe('3'); // 1 + 2 dupes
    });

    it('sections appear in correct order', () => {
      const csv = generateCsv({});
      const codes = csv
        .split('\n')
        .slice(1)
        .map((l) => l.split(',')[0]);
      expect(codes[0]).toBe('FWC');
      expect(codes[1]).toBe('MEX');
      expect(codes).toHaveLength(ALBUM_SECTIONS.length);
    });

    it('unowned sticker produces 0', () => {
      const stickers: Record<number, StickerState> = {
        1: makeState(false, 0),
      };
      const csv = generateCsv(stickers);
      const fwcRow = csv.split('\n')[1];
      expect(fwcRow.split(',')[1]).toBe('0');
    });
  });

  describe('parseCsv', () => {
    it('parses a valid CSV with header', () => {
      const csv =
        'section,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20\nFWC,1,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0';
      const { data, warnings } = parseCsv(csv);
      expect(data.get(1)).toBe(1); // FWC1
      expect(data.get(3)).toBe(3); // FWC3
      expect(data.has(2)).toBe(true); // FWC2 = 0, still in map
      expect(data.get(2)).toBe(0);
      expect(warnings).toHaveLength(0);
    });

    it('parses CSV without header', () => {
      const csv = 'FWC,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0';
      const { data } = parseCsv(csv);
      expect(data.get(1)).toBe(1);
    });

    it('handles Windows line endings', () => {
      const csv =
        'section,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20\r\nFWC,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0\r\n';
      const { data } = parseCsv(csv);
      expect(data.get(1)).toBe(2);
    });

    it('strips BOM', () => {
      const csv =
        '\uFEFFsection,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20\nFWC,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0';
      const { data } = parseCsv(csv);
      expect(data.get(1)).toBe(1);
    });

    it('warns on unknown section code alongside valid rows', () => {
      const header = 'section,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20';
      const zeros = '0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0';
      const csv = `${header}\nFAKE,${zeros}\nFWC,1,${zeros.slice(2)}`;
      const { warnings } = parseCsv(csv);
      expect(warnings.some((w) => w.includes('FAKE'))).toBe(true);
    });

    it('throws when only unknown section codes', () => {
      const csv = 'FAKE,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0';
      expect(() => parseCsv(csv)).toThrow(CsvParseError);
    });

    it('warns on wrong column count alongside valid rows', () => {
      const zeros = ',0'.repeat(20).slice(1);
      const csv = `FWC,1,2,3\nMEX,1,${zeros.slice(2)}`;
      const { warnings } = parseCsv(csv);
      expect(warnings.some((w) => w.includes('columnas'))).toBe(true);
    });

    it('throws on empty file', () => {
      expect(() => parseCsv('')).toThrow(CsvParseError);
    });

    it('throws on header-only file', () => {
      expect(() => parseCsv('section,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20')).toThrow(
        CsvParseError,
      );
    });

    it('section codes are case-insensitive', () => {
      const csv = 'fwc,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0';
      const { data } = parseCsv(csv);
      expect(data.get(1)).toBe(1);
    });
  });

  describe('round-trip', () => {
    it('generateCsv → parseCsv preserves ownership and dupes', () => {
      const stickers: Record<number, StickerState> = {
        1: makeState(true, 0), // FWC1: qty 1
        3: makeState(true, 2), // FWC3: qty 3
        21: makeState(true, 1), // MEX1: qty 2
      };
      const csv = generateCsv(stickers);
      const { data } = parseCsv(csv);

      expect(data.get(1)).toBe(1);
      expect(data.get(3)).toBe(3);
      expect(data.get(21)).toBe(2);
      // Unowned sticker
      expect(data.get(2)).toBe(0);
    });

    it('full album round-trips correctly', () => {
      // Fill every sticker with random values
      const stickers: Record<number, StickerState> = {};
      for (let n = 1; n <= TOTAL_STICKERS; n++) {
        const qty = n % 4; // 0, 1, 2, 3 pattern
        if (qty > 0) {
          stickers[n] = makeState(true, qty - 1);
        }
      }
      const csv = generateCsv(stickers);
      const { data, warnings } = parseCsv(csv);
      expect(warnings).toHaveLength(0);

      for (let n = 1; n <= TOTAL_STICKERS; n++) {
        const expectedQty = n % 4;
        expect(data.get(n)).toBe(expectedQty);
      }
    });
  });
});
