import { describe, it, expect } from 'vitest';
import { normalizeStr, matchesSection, matchesStickerCode } from '@/lib/searchSections';
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

  it('matches por código de sticker ("mex7" → sección MEX)', () => {
    expect(matchesSection(mexSection, 'mex7')).toBe(true);
    expect(matchesSection(mexSection, 'MEX1')).toBe(true);
    expect(matchesSection(mexSection, 'mex20')).toBe(true);
  });

  it('código de sticker de otra sección no matchea', () => {
    expect(matchesSection(mexSection, 'arg7')).toBe(false);
    expect(matchesSection(mexSection, 'bra1')).toBe(false);
  });

  it('query solo numérico matchea todas las secciones (filtra a nivel sticker)', () => {
    expect(matchesSection(mexSection, '7')).toBe(true);
    expect(matchesSection(mexSection, '17')).toBe(true);
    expect(matchesSection(introSection, '1')).toBe(true);
  });
});

describe('matchesStickerCode', () => {
  it('query vacío matchea cualquier código', () => {
    expect(matchesStickerCode('MEX1', '')).toBe(true);
    expect(matchesStickerCode('ARG17', '   ')).toBe(true);
  });

  it('query sin dígitos es pass-through (no filtra a nivel sticker)', () => {
    expect(matchesStickerCode('MEX1', 'mex')).toBe(true);
    expect(matchesStickerCode('MEX20', 'arg')).toBe(true);
    expect(matchesStickerCode('ARG17', 'argen')).toBe(true);
  });

  it('matchea por prefijo exacto cuando hay dígitos', () => {
    expect(matchesStickerCode('ARG7', 'arg7')).toBe(true);
    expect(matchesStickerCode('ARG7', 'ARG7')).toBe(true);
    expect(matchesStickerCode('ARG7', 'arg1')).toBe(false);
  });

  it('"arg1" matchea ARG1, ARG10, …, ARG19 (prefix ILIKE)', () => {
    expect(matchesStickerCode('ARG1', 'arg1')).toBe(true);
    expect(matchesStickerCode('ARG10', 'arg1')).toBe(true);
    expect(matchesStickerCode('ARG17', 'arg1')).toBe(true);
    expect(matchesStickerCode('ARG2', 'arg1')).toBe(false);
    expect(matchesStickerCode('ARG20', 'arg1')).toBe(false);
  });

  it('query solo numérico matchea por prefijo numérico (cualquier sección)', () => {
    expect(matchesStickerCode('ARG7', '7')).toBe(true);
    expect(matchesStickerCode('MEX7', '7')).toBe(true);
    expect(matchesStickerCode('BRA7', '7')).toBe(true);
    expect(matchesStickerCode('ARG17', '7')).toBe(false);
    expect(matchesStickerCode('ARG10', '7')).toBe(false);
  });

  it('"17" matchea solo los #17 de cada sección', () => {
    expect(matchesStickerCode('ARG17', '17')).toBe(true);
    expect(matchesStickerCode('MEX17', '17')).toBe(true);
    expect(matchesStickerCode('ARG1', '17')).toBe(false);
    expect(matchesStickerCode('ARG7', '17')).toBe(false);
  });

  it('"1" matchea #1 y #10–19', () => {
    expect(matchesStickerCode('ARG1', '1')).toBe(true);
    expect(matchesStickerCode('ARG10', '1')).toBe(true);
    expect(matchesStickerCode('ARG19', '1')).toBe(true);
    expect(matchesStickerCode('ARG2', '1')).toBe(false);
    expect(matchesStickerCode('ARG20', '1')).toBe(false);
  });

  it('FWC0 (zero-indexed) es matcheable por "0"', () => {
    expect(matchesStickerCode('FWC0', '0')).toBe(true);
  });
});
