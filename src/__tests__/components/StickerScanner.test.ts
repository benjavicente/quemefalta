import { describe, it, expect } from 'vitest';
import { stickerNumberFromCode } from '@/lib/albumData';
import { ALBUM_SECTIONS } from '@/lib/albumData';

/**
 * Extract sticker codes from OCR text — mirrors StickerScanner.vue's extractCodes
 */
const validCodes = new Set(ALBUM_SECTIONS.map((s) => s.code));

function extractCodes(text: string) {
  let cleaned = text.toUpperCase();
  cleaned = cleaned.replace(/[•·°*|]/g, ' ');
  cleaned = cleaned.replace(/[-–—]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ');

  const results: { code: string; stickerNumber: number }[] = [];
  const seen = new Set<string>();
  const pattern = /\b([A-Z]{2,4})\s*(\d{1,2})\b/g;
  let match;

  while ((match = pattern.exec(cleaned)) !== null) {
    const prefix = match[1];
    const num = match[2];
    if (!validCodes.has(prefix)) continue;
    const codeStr = `${prefix}${num}`;
    const stickerNum = stickerNumberFromCode(codeStr);
    if (stickerNum === undefined) continue;
    if (seen.has(codeStr)) continue;
    seen.add(codeStr);
    results.push({ code: codeStr, stickerNumber: stickerNum });
  }
  return results;
}

describe('StickerScanner extractCodes', () => {
  it('extracts ALG 16 from clean text', () => {
    const codes = extractCodes('FIFA WORLD CUP 2026 ALG 16');
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('ALG16');
    expect(codes[0].stickerNumber).toBe(716);
  });

  it('extracts code without space: ALG16', () => {
    const codes = extractCodes('ALG16');
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('ALG16');
  });

  it('extracts multiple codes', () => {
    const codes = extractCodes('MEX 5 ARG 1 BRA 12');
    expect(codes).toHaveLength(3);
    expect(codes.map((c) => c.code)).toEqual(['MEX5', 'ARG1', 'BRA12']);
  });

  it('ignores invalid prefixes', () => {
    const codes = extractCodes('FIFA 16 XYZ 5 ALG 16');
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('ALG16');
  });

  it('ignores out-of-range numbers', () => {
    const codes = extractCodes('ALG 99'); // ALG only has 20
    expect(codes).toHaveLength(0);
  });

  it('handles OCR noise characters', () => {
    const codes = extractCodes('ALG•16 | MEX·5');
    expect(codes).toHaveLength(2);
  });

  it('deduplicates same code', () => {
    const codes = extractCodes('ALG 16 ALG 16');
    expect(codes).toHaveLength(1);
  });

  it('handles dash separators', () => {
    const codes = extractCodes('ALG–16');
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('ALG16');
  });

  it('handles realistic OCR output from sticker back', () => {
    // Simulates what tesseract might return from a sticker photo
    const ocrText = `FIFA WORLD CUP 2026 ALG 16
      Este cromo é parte integrante do Livro Ilustrado Oficial
      PANINI www.paninigroup.com 005460`;
    const codes = extractCodes(ocrText);
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('ALG16');
    expect(codes[0].stickerNumber).toBe(716);
  });

  it('extracts codes from multi-sticker OCR output', () => {
    const ocrText = `MEX 3 ECU 7 CUW 12 HAI 1`;
    const codes = extractCodes(ocrText);
    expect(codes).toHaveLength(4);
    expect(codes.map((c) => c.code)).toEqual(['MEX3', 'ECU7', 'CUW12', 'HAI1']);
  });
});
