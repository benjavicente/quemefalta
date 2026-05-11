import { describe, it, expect } from 'vitest';
import { pctColor, barColor } from '@/lib/progressColors';

describe('pctColor', () => {
  it('returns red for 0-19%', () => {
    expect(pctColor(0)).toBe('#ef5350');
    expect(pctColor(10)).toBe('#ef5350');
    expect(pctColor(19)).toBe('#ef5350');
  });

  it('returns amber for 20-39%', () => {
    expect(pctColor(20)).toBe('#f59e0b');
    expect(pctColor(39)).toBe('#f59e0b');
  });

  it('returns orange for 40-59%', () => {
    expect(pctColor(40)).toBe('#fb923c');
    expect(pctColor(59)).toBe('#fb923c');
  });

  it('returns yellow for 60-79%', () => {
    expect(pctColor(60)).toBe('#fbbf24');
    expect(pctColor(79)).toBe('#fbbf24');
  });

  it('returns lime for 80-89%', () => {
    expect(pctColor(80)).toBe('#a3e635');
    expect(pctColor(89)).toBe('#a3e635');
  });

  it('returns mint for 90-99%', () => {
    expect(pctColor(90)).toBe('#4dd0a1');
    expect(pctColor(99)).toBe('#4dd0a1');
  });

  it('returns bright green for 100%', () => {
    expect(pctColor(100)).toBe('#34d399');
  });

  it('handles over 100%', () => {
    expect(pctColor(150)).toBe('#34d399');
  });
});

describe('barColor', () => {
  it('returns bright green when complete=true regardless of pct', () => {
    expect(barColor(0, true)).toBe('#34d399');
    expect(barColor(50, true)).toBe('#34d399');
  });

  it('delegates to pctColor when complete=false', () => {
    expect(barColor(45, false)).toBe(pctColor(45));
    expect(barColor(85, false)).toBe(pctColor(85));
  });
});
