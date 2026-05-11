import { describe, it, expect } from 'vitest';
import {
  expectedNew,
  costPerNew,
  packsToReach,
  totalPacksFromZero,
  projectionTable,
  projectionCurve,
  simulateWithTrade,
  projectionCurvesWithTrade,
} from '@/lib/calcUtils';

describe('calcUtils', () => {
  // User's reference case: K=695, N=980, k=7

  describe('expectedNew (F3)', () => {
    it('1 pack with 695/980 → ~2 new', () => {
      const result = expectedNew(695, 980, 1);
      expect(result).toBeCloseTo(2.02, 0);
    });

    it('50 packs with 695/980 → ~85 new', () => {
      const result = expectedNew(695, 980, 50);
      expect(result).toBeCloseTo(85.4, 0);
    });

    it('100 packs with 695/980 → ~145 new', () => {
      const result = expectedNew(695, 980, 100);
      expect(result).toBeCloseTo(145.5, 0);
    });

    it('returns 0 when album is full', () => {
      expect(expectedNew(980, 980, 100)).toBe(0);
    });

    it('returns 0 when s=0', () => {
      expect(expectedNew(500, 980, 0)).toBe(0);
    });

    it('empty album gets nearly all from first pack', () => {
      const result = expectedNew(0, 980, 1);
      expect(result).toBeCloseTo(7, 0); // ~7 stickers from first pack
    });
  });

  describe('costPerNew (F5)', () => {
    it('695/980 at $1100 → ~$545', () => {
      const result = costPerNew(695, 980, 1100);
      expect(result).toBeCloseTo(545, -1);
    });

    it('returns Infinity when album is full', () => {
      expect(costPerNew(980, 980, 1100)).toBe(Infinity);
    });
  });

  describe('packsToReach (F6)', () => {
    it('695 → 900 needs packs > 0', () => {
      const result = packsToReach(695, 900, 980);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(500);
    });

    it('returns 0 when already at target', () => {
      expect(packsToReach(900, 900, 980)).toBe(0);
    });

    it('returns 0 when above target', () => {
      expect(packsToReach(900, 800, 980)).toBe(0);
    });
  });

  describe('totalPacksFromZero (F7)', () => {
    it('980 stickers → ~1045 packs', () => {
      const result = totalPacksFromZero(980);
      expect(result).toBeCloseTo(1045, -1);
    });
  });

  describe('projectionTable', () => {
    it('returns 7 milestone rows', () => {
      const table = projectionTable(695, 980, 1100);
      expect(table).toHaveLength(7);
      expect(table[0].packs).toBe(10);
      expect(table[6].packs).toBe(300);
    });

    it('rows have increasing totals', () => {
      const table = projectionTable(695, 980, 1100);
      for (let i = 1; i < table.length; i++) {
        expect(table[i].total).toBeGreaterThan(table[i - 1].total);
      }
    });

    it('costPerNew increases with more packs', () => {
      const table = projectionTable(695, 980, 1100);
      for (let i = 1; i < table.length; i++) {
        expect(table[i].costPerNew).toBeGreaterThanOrEqual(table[i - 1].costPerNew);
      }
    });
  });

  describe('projectionCurve', () => {
    it('returns 51 points (0..50 steps)', () => {
      const curve = projectionCurve(695, 980, 300);
      expect(curve).toHaveLength(51);
    });

    it('starts at current pct and ends higher', () => {
      const curve = projectionCurve(695, 980, 300);
      expect(curve[0].x).toBe(0);
      expect(curve[0].y).toBeCloseTo(70.9, 0);
      expect(curve[curve.length - 1].y).toBeGreaterThan(curve[0].y);
    });

    it('y values are monotonically increasing', () => {
      const curve = projectionCurve(695, 980, 300);
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i].y).toBeGreaterThanOrEqual(curve[i - 1].y);
      }
    });
  });

  describe('simulateWithTrade', () => {
    it('tau=0 matches pure pack calculation', () => {
      const sim = simulateWithTrade(695, 363, 980, 50, 1100, 0);
      expect(sim.newFromTrade).toBe(0);
      expect(sim.newDirect).toBeCloseTo(85, -1);
      expect(sim.costPerNewNaive).toBe(sim.costPerNewReal);
    });

    it('tau=0.5 adds new stickers from trade', () => {
      const sim = simulateWithTrade(695, 363, 980, 50, 1100, 0.5);
      expect(sim.newFromTrade).toBeGreaterThan(0);
      expect(sim.newTotal).toBeGreaterThan(sim.newDirect);
      expect(sim.costPerNewReal).toBeLessThan(sim.costPerNewNaive);
    });

    it('trade cannot exceed remaining missing stickers', () => {
      const sim = simulateWithTrade(695, 363, 980, 50, 1100, 0.5);
      expect(sim.totalFinal).toBeLessThanOrEqual(980);
    });

    it('dupesDead = total * (1 - tau)', () => {
      const sim = simulateWithTrade(695, 363, 980, 50, 1100, 0.5);
      expect(sim.dupesDead).toBe(Math.round(sim.dupesTotal * 0.5));
    });

    it('higher tau means more new stickers', () => {
      const low = simulateWithTrade(695, 363, 980, 50, 1100, 0.3);
      const high = simulateWithTrade(695, 363, 980, 50, 1100, 0.8);
      expect(high.newTotal).toBeGreaterThan(low.newTotal);
    });
  });

  describe('projectionCurvesWithTrade', () => {
    it('returns 3 curves', () => {
      const curves = projectionCurvesWithTrade(695, 363, 980, 300, 1100);
      expect(curves).toHaveLength(3);
      expect(curves[0].tau).toBe(0);
      expect(curves[1].tau).toBe(0.5);
      expect(curves[2].tau).toBe(0.8);
    });

    it('higher tau curve is always above lower tau curve', () => {
      const curves = projectionCurvesWithTrade(695, 363, 980, 300, 1100);
      for (let i = 1; i < curves[0].points.length; i++) {
        expect(curves[2].points[i].y).toBeGreaterThanOrEqual(curves[0].points[i].y);
      }
    });
  });
});
