import { describe, it, expect } from 'vitest';
import { levenshtein, fuzzyMatchCode, fixOcrChars, extractCodes } from '@/lib/ocrUtils';

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('ALG', 'ALG')).toBe(0);
  });

  it('returns 1 for single char difference', () => {
    expect(levenshtein('ALG', 'AIG')).toBe(1);
  });

  it('returns string length for empty vs non-empty', () => {
    expect(levenshtein('', 'ABC')).toBe(3);
    expect(levenshtein('ABC', '')).toBe(3);
  });
});

describe('fuzzyMatchCode', () => {
  it('returns exact match', () => {
    expect(fuzzyMatchCode('ALG')).toBe('ALG');
    expect(fuzzyMatchCode('MEX')).toBe('MEX');
  });

  it('corrects 1-char typo', () => {
    expect(fuzzyMatchCode('MBX')).toBe('MEX'); // B→E
    expect(fuzzyMatchCode('BRS')).toBe('BRA'); // S→A
  });

  it('returns null for 2+ char distance', () => {
    expect(fuzzyMatchCode('ZZZ')).toBeNull();
  });

  it('returns null for too-short strings', () => {
    expect(fuzzyMatchCode('AB')).toBeNull();
  });
});

describe('fixOcrChars', () => {
  it('replaces 0 with O', () => {
    expect(fixOcrChars('C0L')).toBe('COL');
  });

  it('replaces 8 with B', () => {
    expect(fixOcrChars('8RA')).toBe('BRA');
  });

  it('leaves valid chars unchanged', () => {
    expect(fixOcrChars('MEX')).toBe('MEX');
  });
});

describe('extractCodes', () => {
  it('extracts single code', () => {
    const codes = extractCodes('ALG 16');
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('ALG16');
    expect(codes[0].stickerNumber).toBe(776);
  });

  it('extracts code without space', () => {
    const codes = extractCodes('MEX5');
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('MEX5');
  });

  it('extracts multiple codes', () => {
    const codes = extractCodes('MEX 5 ARG 1 BRA 12');
    expect(codes).toHaveLength(3);
    expect(codes.map((c) => c.code)).toEqual(['MEX5', 'ARG1', 'BRA12']);
  });

  it('ignores invalid prefixes', () => {
    const codes = extractCodes('XYZ 5 ALG 16');
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('ALG16');
  });

  it('ignores out-of-range numbers', () => {
    expect(extractCodes('ALG 99')).toHaveLength(0);
  });

  it('deduplicates', () => {
    expect(extractCodes('ALG 16 ALG 16')).toHaveLength(1);
  });

  it('handles OCR noise', () => {
    const codes = extractCodes('ALG•16 | MEX·5');
    expect(codes).toHaveLength(2);
  });

  it('applies fuzzy matching on OCR-mangled prefix', () => {
    const codes = extractCodes('C0L 3'); // 0→O → COL
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('COL3');
  });

  it('sets selected=true by default', () => {
    const codes = extractCodes('MEX 1');
    expect(codes[0].selected).toBe(true);
  });
});
