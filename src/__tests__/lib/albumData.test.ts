import { describe, it, expect } from 'vitest';
import {
  ALBUM_SECTIONS,
  TOTAL_STICKERS,
  TOTAL_SECTIONS,
  GROUPS,
  sectionForSticker,
  codeForSticker,
  stickerNumberFromCode,
  isSectionComplete,
  completedSectionsCount,
  completedTeamsInGroup,
} from '@/lib/albumData';

function ownAll(start: number, count: number): Record<number, { owned: boolean }> {
  const m: Record<number, { owned: boolean }> = {};
  for (let i = 0; i < count; i++) m[start + i] = { owned: true };
  return m;
}

describe('albumData', () => {
  describe('GROUPS', () => {
    it('exports GROUPS with 12 groups (A-L)', () => {
      expect(Object.keys(GROUPS)).toHaveLength(12);
      for (const g of 'ABCDEFGHIJKL') {
        expect(GROUPS[g]).toBeDefined();
      }
    });

    it('each group has 4 teams', () => {
      for (const g of 'ABCDEFGHIJKL') {
        expect(GROUPS[g]).toHaveLength(4);
      }
    });

    it('each team has name and code', () => {
      for (const g of 'ABCDEFGHIJKL') {
        for (const team of GROUPS[g]) {
          expect(team.name).toBeDefined();
          expect(team.code).toBeDefined();
          expect(typeof team.name).toBe('string');
          expect(typeof team.code).toBe('string');
        }
      }
    });
  });

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

    it('returns last team (Panama) for sticker 980', () => {
      const sec = sectionForSticker(980);
      expect(sec?.code).toBe('PAN');
    });

    it('returns undefined for sticker 0 (out of bounds)', () => {
      expect(sectionForSticker(0)).toBeUndefined();
    });

    it('returns undefined for sticker 981 (out of bounds)', () => {
      expect(sectionForSticker(981)).toBeUndefined();
    });
  });

  describe('codeForSticker', () => {
    it('returns FWC0 for sticker 1 (0-based intro)', () => {
      expect(codeForSticker(1)).toBe('FWC0');
    });

    it('returns FWC19 for sticker 20 (0-based intro)', () => {
      expect(codeForSticker(20)).toBe('FWC19');
    });

    it('returns MEX1 for sticker 21', () => {
      expect(codeForSticker(21)).toBe('MEX1');
    });

    it('returns MEX20 for sticker 40', () => {
      expect(codeForSticker(40)).toBe('MEX20');
    });

    it('returns PAN20 for sticker 980', () => {
      expect(codeForSticker(980)).toBe('PAN20');
    });

    it('returns ?N for invalid sticker number', () => {
      expect(codeForSticker(999)).toBe('?999');
      expect(codeForSticker(0)).toBe('?0');
    });
  });

  describe('stickerNumberFromCode', () => {
    it('returns 1 for FWC0 (0-based intro)', () => {
      expect(stickerNumberFromCode('FWC0')).toBe(1);
    });

    it('returns 20 for FWC19', () => {
      expect(stickerNumberFromCode('FWC19')).toBe(20);
    });

    it('returns 21 for MEX1', () => {
      expect(stickerNumberFromCode('MEX1')).toBe(21);
    });

    it('returns 40 for MEX20', () => {
      expect(stickerNumberFromCode('MEX20')).toBe(40);
    });

    it('is case insensitive', () => {
      expect(stickerNumberFromCode('mex1')).toBe(21);
      expect(stickerNumberFromCode('Mex5')).toBe(25);
    });

    it('returns undefined for invalid code prefix', () => {
      expect(stickerNumberFromCode('ZZZ1')).toBeUndefined();
    });

    it('returns undefined for out-of-range index', () => {
      expect(stickerNumberFromCode('MEX0')).toBeUndefined();
      expect(stickerNumberFromCode('MEX21')).toBeUndefined();
      expect(stickerNumberFromCode('FWC20')).toBeUndefined();
    });

    it('returns undefined for non-code strings', () => {
      expect(stickerNumberFromCode('hello')).toBeUndefined();
      expect(stickerNumberFromCode('')).toBeUndefined();
    });

    it('is the inverse of codeForSticker', () => {
      for (let n = 1; n <= 980; n++) {
        const code = codeForSticker(n);
        expect(stickerNumberFromCode(code)).toBe(n);
      }
    });
  });

  describe('TOTAL_SECTIONS', () => {
    it('equals 49 (1 intro + 48 teams)', () => {
      expect(TOTAL_SECTIONS).toBe(49);
    });
  });

  describe('isSectionComplete', () => {
    const intro = ALBUM_SECTIONS[0]; // FWC, startsAt=1, count=20
    const mex = ALBUM_SECTIONS.find((s) => s.code === 'MEX')!; // startsAt=21, count=20

    it('returns false when no stickers are owned', () => {
      expect(isSectionComplete(intro, {})).toBe(false);
      expect(isSectionComplete(mex, {})).toBe(false);
    });

    it('returns false when only some stickers are owned', () => {
      const partial = ownAll(21, 19);
      expect(isSectionComplete(mex, partial)).toBe(false);
    });

    it('returns true when every sticker in the section is owned', () => {
      expect(isSectionComplete(mex, ownAll(21, 20))).toBe(true);
    });

    it('handles zero-indexed sections (FWC)', () => {
      // FWC0..FWC19 = stickers 1..20
      expect(isSectionComplete(intro, ownAll(1, 20))).toBe(true);
      const missingLast = ownAll(1, 19);
      expect(isSectionComplete(intro, missingLast)).toBe(false);
    });

    it('ignores stickers from other sections', () => {
      // Owning every team sticker doesn't complete the intro
      const everyTeam = ownAll(21, 960);
      expect(isSectionComplete(intro, everyTeam)).toBe(false);
    });

    it('treats dupes-only entries (owned=false) as not complete', () => {
      const m: Record<number, { owned: boolean }> = {};
      for (let i = 0; i < 20; i++) m[21 + i] = { owned: false };
      expect(isSectionComplete(mex, m)).toBe(false);
    });
  });

  describe('completedSectionsCount', () => {
    it('returns 0 for an empty album', () => {
      expect(completedSectionsCount({})).toBe(0);
    });

    it('returns 1 when only the intro is complete', () => {
      expect(completedSectionsCount(ownAll(1, 20))).toBe(1);
    });

    it('returns 2 when intro + Mexico are complete', () => {
      expect(completedSectionsCount({ ...ownAll(1, 20), ...ownAll(21, 20) })).toBe(2);
    });

    it('returns 49 for a fully owned album', () => {
      expect(completedSectionsCount(ownAll(1, 980))).toBe(49);
    });
  });

  describe('completedTeamsInGroup', () => {
    it('returns 0/4 for an empty group', () => {
      expect(completedTeamsInGroup('A', {})).toEqual({ completed: 0, total: 4 });
    });

    it('returns 1/4 when only Mexico (group A, startsAt=21) is complete', () => {
      expect(completedTeamsInGroup('A', ownAll(21, 20))).toEqual({ completed: 1, total: 4 });
    });

    it('returns 4/4 when every team in group A is owned (stickers 21..100)', () => {
      expect(completedTeamsInGroup('A', ownAll(21, 80))).toEqual({ completed: 4, total: 4 });
    });

    it('returns {completed:0,total:0} for an unknown group', () => {
      expect(completedTeamsInGroup('Z', ownAll(21, 80))).toEqual({ completed: 0, total: 0 });
    });

    it('does not count the intro (no group)', () => {
      // Intro completo no debe sumar a ningún grupo
      expect(completedTeamsInGroup('A', ownAll(1, 20))).toEqual({ completed: 0, total: 4 });
    });
  });
});
