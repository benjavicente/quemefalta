import { describe, it, expect } from 'vitest';
import { ALBUM_SECTIONS } from '@/lib/albumData';

// Same normalize function used in AlbumView
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function filterSections(query: string) {
  const q = normalize(query.trim());
  if (!q) return ALBUM_SECTIONS;
  return ALBUM_SECTIONS.filter(
    (s) => normalize(s.name).includes(q) || normalize(s.code).includes(q),
  );
}

describe('Album section search', () => {
  it('returns all sections when query is empty', () => {
    expect(filterSections('')).toHaveLength(ALBUM_SECTIONS.length);
    expect(filterSections('  ')).toHaveLength(ALBUM_SECTIONS.length);
  });

  it('finds by exact name', () => {
    const results = filterSections('México');
    expect(results.length).toBe(1);
    expect(results[0].code).toBe('MEX');
  });

  it('finds by name without accent (tilde-insensitive)', () => {
    const results = filterSections('mexico');
    expect(results.length).toBe(1);
    expect(results[0].code).toBe('MEX');
  });

  it('finds by partial name', () => {
    const results = filterSections('mex');
    expect(results.length).toBe(1);
    expect(results[0].code).toBe('MEX');
  });

  it('finds by FIFA code', () => {
    const results = filterSections('usa');
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Estados Unidos');
  });

  it('finds by code lowercase (arg matches Argentina + Argelia)', () => {
    const results = filterSections('arg');
    expect(results.length).toBe(2);
    expect(results.map((r) => r.code)).toContain('ARG');
    expect(results.map((r) => r.code)).toContain('ALG');
  });

  it('finds Túnez with and without tilde', () => {
    expect(filterSections('túnez').length).toBe(1);
    expect(filterSections('tunez').length).toBe(1);
    expect(filterSections('tunez')[0].code).toBe('TUN');
  });

  it('finds by partial name "estados"', () => {
    const results = filterSections('estados');
    expect(results.length).toBe(1);
    expect(results[0].code).toBe('USA');
  });

  it('is case insensitive', () => {
    expect(filterSections('BRASIL').length).toBe(1);
    expect(filterSections('brasil').length).toBe(1);
    expect(filterSections('BrAsIl').length).toBe(1);
  });

  it('returns empty for no match', () => {
    expect(filterSections('zzzzz')).toHaveLength(0);
  });

  it('enter selects first match - intro for "intro"', () => {
    const results = filterSections('intro');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('intro');
  });

  it('enter selects first match - multiple results for "a"', () => {
    const results = filterSections('a');
    expect(results.length).toBeGreaterThan(1);
    // First match should be deterministic (album order)
    expect(results[0]).toBeDefined();
  });
});
