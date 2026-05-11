/**
 * OCR text extraction utilities for sticker code recognition.
 * Pure logic — no DOM or Vue dependencies. Fully testable.
 */
import { ALBUM_SECTIONS, stickerNumberFromCode } from '@/lib/albumData';

export interface DetectedCode {
  code: string;
  stickerNumber: number;
  selected: boolean;
}

const validCodes = new Set(ALBUM_SECTIONS.map((s) => s.code));
const validCodesArray = ALBUM_SECTIONS.map((s) => s.code);

/** Levenshtein distance between two strings */
export function levenshtein(a: string, b: string): number {
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

/** Find closest valid section code within maxDist (default 1) */
export function fuzzyMatchCode(raw: string, maxDist = 1): string | null {
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

/** Common OCR character substitutions (digits that look like letters) */
const OCR_CHAR_FIXES: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '5': 'S',
  '8': 'B',
  '{': '(',
  '}': ')',
  '[': '(',
  ']': ')',
};

/** Fix common OCR digit→letter substitutions in a string */
export function fixOcrChars(s: string): string {
  return s.replace(/[015{}\[\]8]/g, (ch) => OCR_CHAR_FIXES[ch] ?? ch);
}

/** Extract sticker codes from OCR text with fuzzy matching */
export function extractCodes(text: string): DetectedCode[] {
  const results: DetectedCode[] = [];
  const seen = new Set<string>();

  let cleaned = text.toUpperCase();
  cleaned = cleaned.replace(/[•·°*|~`#]/g, ' ');
  cleaned = cleaned.replace(/(\d)[.,](\d)/g, '$1$2');
  cleaned = cleaned.replace(/[-–—_:;,./\\]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ');

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

      const wasFuzzy = matchedCode !== rawPrefix;
      if (wasFuzzy) {
        console.log(`[Scanner] Fuzzy: "${rawPrefix}" → "${matchedCode}" (code: ${codeStr})`);
      }

      results.push({ code: codeStr, stickerNumber: stickerNum, selected: true });
    }
  }

  return results;
}
