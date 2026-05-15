import { describe, it, expect } from 'vitest';
import { computeExchange, formatExchangeList, type StickerMap } from '@/lib/exchangeUtils';

function makeMap(entries: Record<number, { owned: boolean; dupes: number }>): StickerMap {
  return new Map(Object.entries(entries).map(([k, v]) => [Number(k), v]));
}

describe('computeExchange', () => {
  it('returns empty when both maps are empty', () => {
    const result = computeExchange(new Map(), new Map());
    expect(result.aGivesB).toHaveLength(0);
    expect(result.bGivesA).toHaveLength(0);
    expect(result.aGivesBCount).toBe(0);
    expect(result.bGivesACount).toBe(0);
  });

  it('returns empty when neither user has dupes', () => {
    const mapA = makeMap({ 1: { owned: true, dupes: 0 }, 2: { owned: true, dupes: 0 } });
    const mapB = makeMap({ 3: { owned: true, dupes: 0 }, 4: { owned: true, dupes: 0 } });
    const result = computeExchange(mapA, mapB);
    expect(result.aGivesBCount).toBe(0);
    expect(result.bGivesACount).toBe(0);
  });

  it('A has dupes that B is missing → aGivesB', () => {
    // Sticker 1 = FWC0 (intro section, startsAt=1)
    const mapA = makeMap({ 1: { owned: true, dupes: 2 } });
    const mapB = makeMap({}); // B doesn't have sticker 1
    const result = computeExchange(mapA, mapB);

    expect(result.aGivesBCount).toBe(1);
    expect(result.aGivesB).toHaveLength(1);
    expect(result.aGivesB[0].items[0].stickerNumber).toBe(1);
    expect(result.aGivesB[0].items[0].code).toBe('FWC0');
    expect(result.aGivesB[0].items[0].dupeCount).toBe(2);
    expect(result.bGivesACount).toBe(0);
  });

  it('B has dupes that A is missing → bGivesA', () => {
    const mapA = makeMap({});
    const mapB = makeMap({ 21: { owned: true, dupes: 1 } }); // MEX1
    const result = computeExchange(mapA, mapB);

    expect(result.bGivesACount).toBe(1);
    expect(result.bGivesA[0].items[0].stickerNumber).toBe(21);
    expect(result.bGivesA[0].items[0].code).toBe('MEX1');
    expect(result.aGivesBCount).toBe(0);
  });

  it('mutual exchange — both directions', () => {
    const mapA = makeMap({
      1: { owned: true, dupes: 1 }, // A has dupe of FWC0
      2: { owned: false, dupes: 0 }, // A missing FWC1
    });
    const mapB = makeMap({
      2: { owned: true, dupes: 1 }, // B has dupe of FWC1
      // B doesn't have sticker 1
    });
    const result = computeExchange(mapA, mapB);

    expect(result.aGivesBCount).toBe(1);
    expect(result.aGivesB[0].items[0].code).toBe('FWC0');
    expect(result.bGivesACount).toBe(1);
    expect(result.bGivesA[0].items[0].code).toBe('FWC1');
  });

  it('does not include sticker if B already owns it', () => {
    const mapA = makeMap({ 1: { owned: true, dupes: 3 } });
    const mapB = makeMap({ 1: { owned: true, dupes: 0 } }); // B already has it
    const result = computeExchange(mapA, mapB);
    expect(result.aGivesBCount).toBe(0);
  });

  it('does not include sticker if A has dupes=0', () => {
    const mapA = makeMap({ 1: { owned: true, dupes: 0 } }); // Owned but no dupes
    const mapB = makeMap({}); // B missing it
    const result = computeExchange(mapA, mapB);
    expect(result.aGivesBCount).toBe(0);
  });

  it('groups items by section', () => {
    const mapA = makeMap({
      1: { owned: true, dupes: 1 }, // FWC0 — intro section
      21: { owned: true, dupes: 1 }, // MEX1 — México section
    });
    const mapB = makeMap({});
    const result = computeExchange(mapA, mapB);

    expect(result.aGivesB).toHaveLength(2);
    expect(result.aGivesB[0].section.code).toBe('FWC');
    expect(result.aGivesB[1].section.code).toBe('MEX');
    expect(result.aGivesBCount).toBe(2);
  });

  it('filters out empty groups', () => {
    // Only stickers in intro section, no stickers in any team section
    const mapA = makeMap({ 1: { owned: true, dupes: 1 } });
    const mapB = makeMap({});
    const result = computeExchange(mapA, mapB);

    // Should only have 1 group (intro), not 49
    expect(result.aGivesB).toHaveLength(1);
    expect(result.aGivesB[0].section.id).toBe('intro');
  });

  it('preserves dupe count in output', () => {
    const mapA = makeMap({ 1: { owned: true, dupes: 5 } });
    const mapB = makeMap({});
    const result = computeExchange(mapA, mapB);
    expect(result.aGivesB[0].items[0].dupeCount).toBe(5);
  });
});

describe('formatExchangeList', () => {
  it('formats a single-group list', () => {
    const groups = [
      {
        section: {
          id: 'intro',
          name: 'Introducción & FIFA Museum',
          code: 'FWC',
          count: 20,
          startsAt: 1,
          zeroIndexed: true,
        },
        items: [
          { stickerNumber: 1, code: 'FWC0', dupeCount: 1 },
          { stickerNumber: 3, code: 'FWC2', dupeCount: 3 },
        ],
      },
    ];
    const text = formatExchangeList('Pedro', 'María', groups, 2);
    expect(text).toContain('Pedro le puede dar 2 láminas a María:');
    expect(text).toContain('Introducción & FIFA Museum: FWC0, FWC2 (+3)');
  });

  it('only shows +N when dupeCount > 1', () => {
    const groups = [
      {
        section: {
          id: 'intro',
          name: 'Intro',
          code: 'FWC',
          count: 20,
          startsAt: 1,
          zeroIndexed: true,
        },
        items: [{ stickerNumber: 1, code: 'FWC0', dupeCount: 1 }],
      },
    ];
    const text = formatExchangeList('A', 'B', groups, 1);
    expect(text).not.toContain('×');
    expect(text).toContain('FWC0');
  });
});
