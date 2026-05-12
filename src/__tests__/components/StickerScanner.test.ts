import { describe, it, expect } from 'vitest';
import { stickerNumberFromCode } from '@/lib/albumData';
import { ALBUM_SECTIONS } from '@/lib/albumData';

/**
 * Extract sticker codes from OCR text — mirrors StickerScanner.vue's extractCodes
 * with fuzzy matching and OCR char fix support
 */
const validCodes = new Set(ALBUM_SECTIONS.map((s) => s.code));
const validCodesArray = ALBUM_SECTIONS.map((s) => s.code);

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyMatchCode(raw: string, maxDist = 1): string | null {
  if (validCodes.has(raw)) return raw;
  if (raw.length < 3) return null;
  let best: string | null = null;
  let bestDist = maxDist + 1;
  for (const code of validCodesArray) {
    if (Math.abs(code.length - raw.length) > maxDist) continue;
    const d = levenshtein(raw, code);
    if (d < bestDist) {
      bestDist = d;
      best = code;
    }
  }
  return best;
}

const OCR_CHAR_FIXES: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '5': 'S',
  '8': 'B',
};

function fixOcrChars(s: string): string {
  return s.replace(/[0158]/g, (ch) => OCR_CHAR_FIXES[ch] ?? ch);
}

function extractCodes(text: string) {
  let cleaned = text.toUpperCase();
  cleaned = cleaned.replace(/[•·°*|~`#]/g, ' ');
  cleaned = cleaned.replace(/(\d)[.,](\d)/g, '$1$2');
  cleaned = cleaned.replace(/[-–—_:;,./\\]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ');

  const results: { code: string; stickerNumber: number }[] = [];
  const seen = new Set<string>();

  const patterns: RegExp[] = [
    /([A-Z]{2,4})\s*(\d{1,2})(?=\s|$|[^A-Z0-9])/g,
    /([A-Z0-9]*[0-9][A-Z0-9]*)\s+(\d{1,2})(?=\s|$|[^A-Z0-9])/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(cleaned)) !== null) {
      let rawPrefix = match[1];
      const num = match[2];
      if (/^\d+$/.test(rawPrefix)) continue;
      rawPrefix = fixOcrChars(rawPrefix);
      const matchedCode = fuzzyMatchCode(rawPrefix);
      if (!matchedCode) continue;
      const codeStr = `${matchedCode}${num}`;
      const stickerNum = stickerNumberFromCode(codeStr);
      if (stickerNum === undefined) continue;
      if (seen.has(codeStr)) continue;
      seen.add(codeStr);
      results.push({ code: codeStr, stickerNumber: stickerNum });
    }
  }
  return results;
}

describe('StickerScanner extractCodes', () => {
  it('extracts ALG 16 from clean text', () => {
    const codes = extractCodes('FIFA WORLD CUP 2026 ALG 16');
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('ALG16');
    expect(codes[0].stickerNumber).toBe(776);
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
    expect(codes[0].stickerNumber).toBe(776);
  });

  it('extracts codes from multi-sticker OCR output', () => {
    const ocrText = `MEX 3 ECU 7 CUW 12 HAI 1`;
    const codes = extractCodes(ocrText);
    expect(codes).toHaveLength(4);
    expect(codes.map((c) => c.code)).toEqual(['MEX3', 'ECU7', 'CUW12', 'HAI1']);
  });
});

describe('StickerScanner fuzzy matching', () => {
  it('corrects single-char typo: MBX → MEX', () => {
    const codes = extractCodes('MBX 5');
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('MEX5');
  });

  it('corrects single-char typo: ARC → ARG', () => {
    const codes = extractCodes('ARC 1');
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('ARG1');
  });

  it('corrects single-char typo: BRS → BRA', () => {
    const codes = extractCodes('BRS 12');
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('BRA12');
  });

  it('does NOT match with 2+ char distance', () => {
    const codes = extractCodes('ZZZ 5');
    expect(codes).toHaveLength(0);
  });

  it('fixes OCR digit→letter: 0→O in C0L → COL', () => {
    const codes = extractCodes('C0L 3');
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('COL3');
  });

  it('fixes OCR digit→letter: 8→B in 8RA → BRA', () => {
    const codes = extractCodes('8RA 7');
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('BRA7');
  });

  it('combines OCR char fix + fuzzy: 8RS → BRS → BRA', () => {
    // 8→B gives BRS, then fuzzy BRS→BRA (1 char diff)
    const codes = extractCodes('8RS 4');
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('BRA4');
  });

  it('handles comma/slash separators', () => {
    const codes = extractCodes('MEX/5, ARG:1; BRA.12');
    expect(codes).toHaveLength(3);
    expect(codes.map((c) => c.code)).toEqual(['MEX5', 'ARG1', 'BRA12']);
  });

  it('removes OCR dots between digits: PAN 1.3 → PAN13', () => {
    const codes = extractCodes('PAN 1.3');
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('PAN13');
  });

  it('removes OCR commas between digits: ALG 1,6 → ALG16', () => {
    const codes = extractCodes('ALG 1,6');
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('ALG16');
  });

  it('handles real OCR output with noise: PAN 1.3 + FIFA text', () => {
    const ocrText = `PAN 1.3\ni.)\nFIFA\nWORLD cup`;
    const codes = extractCodes(ocrText);
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe('PAN13');
  });
});
