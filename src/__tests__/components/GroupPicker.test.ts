import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, computed } from 'vue';
import GroupPicker from '@/components/GroupPicker.vue';
import type { StickerState } from '@/composables/useStickers';

vi.mock('@/assets/ball-stadium.png', () => ({ default: 'ball.png' }));

let mockStickersData: Record<number, StickerState> = {};

vi.mock('@/composables/useStickers', () => ({
  useStickers: () => ({
    stickers: computed(() => mockStickersData),
    loading: ref(false),
    loaded: ref(true),
    syncError: ref(null),
    stats: computed(() => ({ owned: 0, missing: 980, dupes: 0, pct: 0, withNotes: 0 })),
    getSticker: (n: number): StickerState =>
      mockStickersData[n] ?? { owned: false, dupes: 0, note: '' },
    cycleSticker: vi.fn(),
    markSectionComplete: vi.fn(),
    clearSection: vi.fn(),
    adjustDupes: vi.fn(),
    removeSticker: vi.fn(),
    setNote: vi.fn(),
  }),
}));

beforeEach(() => {
  mockStickersData = {};
});

function mountPicker(activeSection = 'intro') {
  return mount(GroupPicker, {
    props: { activeSection },
  });
}

describe('GroupPicker', () => {
  describe('rendering', () => {
    it('renders intro button', () => {
      const w = mountPicker();
      expect(w.find('.gp-intro').exists()).toBe(true);
      expect(w.find('.gp-intro-name').text()).toBe('Introducción');
    });

    it('renders 12 group headers (A-L)', () => {
      const w = mountPicker();
      const heads = w.findAll('.gp-head');
      expect(heads).toHaveLength(12);
    });

    it('shows group letter and owned count', () => {
      const w = mountPicker();
      const first = w.find('.gp-head');
      expect(first.find('.gp-letter').text()).toBe('A');
      expect(first.find('.gp-owned-count').text()).toContain('/80');
    });

    it('highlights intro when activeSection is intro', () => {
      const w = mountPicker('intro');
      expect(w.find('.gp-intro').classes()).toContain('on');
    });

    it('shows intro count', () => {
      const w = mountPicker();
      expect(w.find('.gp-intro-count').text()).toBe('0/20');
    });
  });

  describe('expand/collapse', () => {
    it('does not show teams by default', () => {
      const w = mountPicker();
      expect(w.find('.gp-teams').exists()).toBe(false);
    });

    it('shows teams when group header clicked', async () => {
      const w = mountPicker();
      await w.findAll('.gp-head')[0].trigger('click'); // Group A
      expect(w.find('.gp-teams').exists()).toBe(true);
      const teams = w.findAll('.gp-team');
      expect(teams).toHaveLength(4); // Group A has 4 teams
    });

    it('collapses when same group clicked again', async () => {
      const w = mountPicker();
      await w.findAll('.gp-head')[0].trigger('click');
      expect(w.find('.gp-teams').exists()).toBe(true);
      await w.findAll('.gp-head')[0].trigger('click');
      expect(w.find('.gp-teams').exists()).toBe(false);
    });

    it('switches expanded group when different group clicked', async () => {
      const w = mountPicker();
      await w.findAll('.gp-head')[0].trigger('click'); // Expand A
      expect(w.findAll('.gp-teams')).toHaveLength(1);
      await w.findAll('.gp-head')[1].trigger('click'); // Expand B
      expect(w.findAll('.gp-teams')).toHaveLength(1);
      // Should now show Group B teams
      expect(w.findAll('.gp-team')[0].find('.gp-team-name').text()).toBe('Estados Unidos');
    });
  });

  describe('events', () => {
    it('emits select when intro clicked', async () => {
      const w = mountPicker();
      await w.find('.gp-intro').trigger('click');
      expect(w.emitted('select')).toHaveLength(1);
      expect(w.emitted('select')![0]).toEqual(['intro']);
    });

    it('emits select when team clicked', async () => {
      const w = mountPicker();
      await w.findAll('.gp-head')[0].trigger('click'); // Expand A
      await w.findAll('.gp-team')[0].trigger('click'); // México
      expect(w.emitted('select')).toHaveLength(1);
      expect(w.emitted('select')![0]).toEqual(['team-mex']);
    });
  });

  describe('progress', () => {
    it('shows owned count for intro section', () => {
      mockStickersData = {
        1: { owned: true, dupes: 0, note: '' },
        2: { owned: true, dupes: 0, note: '' },
      };
      const w = mountPicker();
      expect(w.find('.gp-intro-count').text()).toBe('2/20');
    });

    it('marks group as done when all stickers owned', () => {
      // Fill all of group A (4 teams × 20 stickers, starting at 21)
      for (let i = 21; i <= 100; i++) {
        mockStickersData[i] = { owned: true, dupes: 0, note: '' };
      }
      const w = mountPicker();
      expect(w.findAll('.gp-head')[0].classes()).toContain('done');
    });
  });
});
