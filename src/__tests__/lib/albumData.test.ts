import { describe, it, expect } from 'vitest';
import { ALBUM_SECTIONS, TOTAL_STICKERS, sectionForSticker, codeForSticker } from '@/lib/albumData';

describe('albumData', () => {
  describe('ALBUM_SECTIONS', () => {
    it('has 49 sections (1 intro + 48 teams)', () => {
      expect(ALBUM_SECTIONS).toHaveLength(49);
    });

    it('first section is intro', () => {
      const intro = ALBUM_SECTIONS[0];
      expect(intro.id).toBe('intro');
      expect(intro.code).toBe('FWC');
      expect(intro.startsAt).toBe(1);
      expect(intro.count).toBe(20);
    });

    it('all sections have count of 20', () => {
      for (const s of ALBUM_SECTIONS) {
        expect(s.count).toBe(20);
      }
    });

    it('team sections have groups A through L', () => {
      const teamSections = ALBUM_SECTIONS.filter((s) => s.isTeam);
      expect(teamSections).toHaveLength(48);

      const groups = new Set(teamSections.map((s) => s.group));
      expect(groups.size).toBe(12);
      for (const g of 'ABCDEFGHIJKL') {
        expect(groups.has(g)).toBe(true);
      }
    });

    it('each group has exactly 4 teams', () => {
      const teamSections = ALBUM_SECTIONS.filter((s) => s.isTeam);
      const groupCounts: Record<string, number> = {};
      for (const s of teamSections) {
        groupCounts[s.group!] = (groupCounts[s.group!] || 0) + 1;
      }
      for (const g of 'ABCDEFGHIJKL') {
        expect(groupCounts[g]).toBe(4);
      }
    });

    it('startsAt values are sequential and non-overlapping', () => {
      for (let i = 1; i < ALBUM_SECTIONS.length; i++) {
        const prev = ALBUM_SECTIONS[i - 1];
        const curr = ALBUM_SECTIONS[i];
        expect(curr.startsAt).toBe(prev.startsAt + prev.count);
      }
    });
  });

  describe('TOTAL_STICKERS', () => {
    it('equals 980 (49 sections x 20)', () => {
      expect(TOTAL_STICKERS).toBe(980);
    });
  });

  describe('sectionForSticker', () => {
    it('returns intro section for sticker 1', () => {
      const sec = sectionForSticker(1);
      expect(sec?.id).toBe('intro');
    });

    it('returns intro section for sticker 20', () => {
      const sec = sectionForSticker(20);
      expect(sec?.id).toBe('intro');
    });

    it('returns first team (Mexico) for sticker 21', () => {
      const sec = sectionForSticker(21);
      expect(sec?.code).toBe('MEX');
    });

    it('returns last team (Australia) for sticker 980', () => {
      const sec = sectionForSticker(980);
      expect(sec?.code).toBe('AUS');
    });

    it('returns undefined for sticker 0 (out of bounds)', () => {
      expect(sectionForSticker(0)).toBeUndefined();
    });

    it('returns undefined for sticker 981 (out of bounds)', () => {
      expect(sectionForSticker(981)).toBeUndefined();
    });
  });

  describe('codeForSticker', () => {
    it('returns FWC1 for sticker 1', () => {
      expect(codeForSticker(1)).toBe('FWC1');
    });

    it('returns FWC20 for sticker 20', () => {
      expect(codeForSticker(20)).toBe('FWC20');
    });

    it('returns MEX1 for sticker 21', () => {
      expect(codeForSticker(21)).toBe('MEX1');
    });

    it('returns MEX20 for sticker 40', () => {
      expect(codeForSticker(40)).toBe('MEX20');
    });

    it('returns AUS20 for sticker 980', () => {
      expect(codeForSticker(980)).toBe('AUS20');
    });

    it('returns ?N for invalid sticker number', () => {
      expect(codeForSticker(999)).toBe('?999');
      expect(codeForSticker(0)).toBe('?0');
    });
  });
});
