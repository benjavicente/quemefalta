import { describe, it, expect } from 'vitest';
import { normalizeStr, matchesSection } from '@/lib/searchSections';
import { ALBUM_SECTIONS } from '@/lib/albumData';

const mexSection = ALBUM_SECTIONS.find((s) => s.code === 'MEX')!;
const introSection = ALBUM_SECTIONS.find((s) => s.id === 'intro')!;

describe('normalizeStr', () => {
  it('lowercases input', () => {
    expect(normalizeStr('MÉXICO')).toBe('mexico');
  });

  it('removes accents', () => {
    expect(normalizeStr('México')).toBe('mexico');
    expect(normalizeStr('Perú')).toBe('peru');
    expect(normalizeStr('Türkiye')).toBe('turkiye');
  });

  it('passes plain ASCII through', () => {
    expect(normalizeStr('argentina')).toBe('argentina');
  });

  it('handles empty string', () => {
    expect(normalizeStr('')).toBe('');
  });
});

describe('matchesSection', () => {
  it('returns true for empty query (no filter)', () => {
    expect(matchesSection(mexSection, '')).toBe(true);
    expect(matchesSection(mexSection, '   ')).toBe(true);
  });

  it('matches by full FIFA code', () => {
    expect(matchesSection(mexSection, 'MEX')).toBe(true);
  });

  it('matches by partial FIFA code', () => {
    expect(matchesSection(mexSection, 'me')).toBe(true);
  });

  it('matches case-insensitive code', () => {
    expect(matchesSection(mexSection, 'mex')).toBe(true);
    expect(matchesSection(mexSection, 'MeX')).toBe(true);
  });

  it('matches by full section name', () => {
    expect(matchesSection(mexSection, 'México')).toBe(true);
  });

  it('matches name ignoring accents', () => {
    expect(matchesSection(mexSection, 'mexico')).toBe(true);
    expect(matchesSection(mexSection, 'MEXICO')).toBe(true);
  });

  it('matches partial name', () => {
    expect(matchesSection(mexSection, 'méx')).toBe(true);
    expect(matchesSection(mexSection, 'xic')).toBe(true);
  });

  it('matches intro section by name and code', () => {
    expect(matchesSection(introSection, 'introducción')).toBe(true);
    expect(matchesSection(introSection, 'fifa')).toBe(true);
    expect(matchesSection(introSection, 'FWC')).toBe(true);
  });

  it('does not match unrelated query', () => {
    expect(matchesSection(mexSection, 'argentina')).toBe(false);
    expect(matchesSection(mexSection, 'jpn')).toBe(false);
  });

  it('trims whitespace before matching', () => {
    expect(matchesSection(mexSection, '  mex  ')).toBe(true);
  });
});
